// osm.js: Option 3A + Option 2 city builder.
// Streams real Cesium World Terrain (asset 1) + Bing Maps Aerial imagery (asset 2) + Cesium OSM Buildings (asset 96188),
// renders every OSM vector building with a crisp world-space PBR architectural facade shader (glass curtain walls,
// limestone/concrete facades, real sun shadows, sky reflections, and dusk/night lit windows), and integrates high-detail
// hero landmarks from src/landmarks.js while cleanly removing overlapping OSM footprints.
import * as THREE from 'three';
import { TilesRenderer, WGS84_ELLIPSOID, FAILED } from '3d-tiles-renderer';
import {
  CesiumIonAuthPlugin, ReorientationPlugin, GLTFExtensionsPlugin,
  ImageOverlayPlugin, CesiumIonOverlay,
} from '3d-tiles-renderer/plugins';
import { createWorld } from './kit.js';
import { apiKey, configureSharedQueues, cacheBudgetMB, dracoLoader } from './tiles.js';
import { PERF, perfAdd } from './perf.js';
import { getLandmarkExclusions, placeHeroLandmarks } from './landmarks.js';

const D2R = Math.PI / 180;
const ION_TERRAIN_ASSET = '1';      // Cesium World Terrain
const ION_IMAGERY_ASSET = '2';      // Bing Maps Aerial
const ION_OSM_ASSET = '96188';      // Cesium OSM Buildings

/** Infers time-of-day mood (0 = crisp bright day, 0.35 = late afternoon, 1.0 = dusk/golden evening) from city.look. */
function nightFactor(look) {
  const sunY = look?.sun?.dir?.[1] ?? 0.35;
  if (sunY < 0.20) return 0.95;
  if (sunY < 0.28) return 0.60;
  if (sunY < 0.38) return 0.25;
  return 0.08;
}

/**
 * World-space triplanar PBR architectural facade material for Cesium OSM Buildings.
 * Uses each building's real `_batchid` height & hash (computed in processTileModel) so skyscrapers get reflective
 * glass curtain walls, mid-rise blocks get crisp stone/concrete punched windows, angled streets never stretch,
 * and every building looks razor sharp at any distance.
 */
function createOsmFacadeMaterial(night) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.08,
  });
  const U = {
    uNight: { value: night },
    uLitColor: { value: new THREE.Color(0xffd796) },
    uGlassCool: { value: new THREE.Color(0x1f364d) },
    uGlassWarm: { value: new THREE.Color(0x3a4856) },
  };
  m.userData.uniforms = U;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aBuildInfo;   // x: per-building hash (0..1), y: building height (m), z: local elevation above base (m)
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        varying vec3 vBuildInfo;
      `)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBuildInfo = aBuildInfo;
      `)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wpOsm = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = wpOsm.xyz;
        vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        varying vec3 vBuildInfo;
        uniform float uNight;
        uniform vec3 uLitColor;
        uniform vec3 uGlassCool;
        uniform vec3 uGlassWarm;

        float osmHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        vec3 wallPalette(float h, float tall) {
          if (tall > 0.5) {
            // Modern skyscraper tones: cool steel, silver-blue, bronze-grey, crisp white
            vec3 c0 = vec3(0.42, 0.50, 0.58);
            vec3 c1 = vec3(0.62, 0.67, 0.72);
            vec3 c2 = vec3(0.36, 0.40, 0.46);
            vec3 c3 = vec3(0.55, 0.52, 0.49);
            return h < 0.25 ? c0 : (h < 0.5 ? c1 : (h < 0.75 ? c2 : c3));
          }
          // Classic urban masonry / limestone / warm terracotta / pale concrete
          vec3 a0 = vec3(0.76, 0.72, 0.65);
          vec3 a1 = vec3(0.68, 0.64, 0.60);
          vec3 a2 = vec3(0.64, 0.52, 0.44);
          vec3 a3 = vec3(0.80, 0.77, 0.71);
          vec3 a4 = vec3(0.56, 0.57, 0.59);
          return h < 0.2 ? a0 : (h < 0.4 ? a1 : (h < 0.6 ? a2 : (h < 0.8 ? a3 : a4)));
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wn = normalize(vWorldNorm);
        float isRoof = smoothstep(0.60, 0.78, wn.y);
        float isWall = 1.0 - smoothstep(0.48, 0.72, abs(wn.y));
        float bHash = vBuildInfo.x;
        float bHeight = max(vBuildInfo.y, 12.0);
        float bRelY = max(vBuildInfo.z, 0.0);
        float isTower = smoothstep(55.0, 95.0, bHeight);
        float h2 = fract(bHash * 17.31 + 0.13);
        float h3 = fract(bHash * 31.77 + 0.29);

        // Tangent projection along the wall works cleanly for any street angle (Manhattan 29°, Paris, etc.)
        vec3 tang = abs(wn.y) < 0.9 ? normalize(cross(vec3(0.0, 1.0, 0.0), wn)) : vec3(1.0, 0.0, 0.0);
        float wallU = dot(vWorldPos, tang);
        float wallV = vWorldPos.y;

        float floorH = mix(3.3 + h2 * 0.7, 3.7 + h2 * 0.6, isTower);
        float bayW = mix(2.6 + h3 * 1.1, 2.2 + h3 * 1.0, isTower);
        vec2 fc = vec2(wallU / bayW, wallV / floorH);
        vec2 fid = floor(fc);
        vec2 ff = fract(fc);

        // Analytical anti-aliasing prevents shimmering moire at distance while staying razor sharp up close
        float fw = max(fwidth(fc.x), fwidth(fc.y));
        float faa = clamp(1.0 - fw * 1.15, 0.0, 1.0);

        vec2 frame = mix(vec2(0.24, 0.25), vec2(0.09, 0.14), isTower);
        float fraw = step(frame.x, ff.x) * step(ff.x, 1.0 - frame.x) * step(frame.y, ff.y) * step(ff.y, 1.0 - frame.y);
        float farea = (1.0 - 2.0 * frame.x) * (1.0 - 2.0 * frame.y);
        float groundBand = step(4.5, bRelY) * (1.0 - step(bHeight - 1.4, bRelY));
        float fwin = mix(farea, fraw, faa) * isWall * groundBand;

        // Vertical height ambient occlusion: slightly darker near street canyons, brighter near roofs
        float ao = mix(0.76, 1.03, clamp(bRelY / min(bHeight, 48.0), 0.0, 1.0));
        vec3 baseWall = wallPalette(bHash, isTower) * ao;
        vec3 roofCol = mix(vec3(0.46, 0.47, 0.49), vec3(0.60, 0.57, 0.53), h2) * (0.9 + 0.14 * osmHash(floor(vWorldPos.xz * 0.12)));

        // Per-window interior depth & lit room glow
        float wr = osmHash(fid + vec2(bHash * 53.0, bHash * 19.0));
        float wr2 = osmHash(fid.yx * 1.37 + vec2(bHash * 29.0, 4.7));
        vec3 glassCol = mix(uGlassWarm, uGlassCool, isTower * 0.65 + h3 * 0.35) * (0.72 + 0.56 * wr2);

        float litShare = mix(0.28, 0.48, isTower) * (0.65 + 0.7 * h3);
        float flit = mix(litShare * farea * 0.65, step(1.0 - litShare, wr) * fraw * (0.5 + 1.0 * wr2), faa) * isWall * groundBand;

        vec3 wallFinal = mix(baseWall, glassCol, fwin);
        diffuseColor.rgb = mix(wallFinal, roofCol, isRoof);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.82, 0.58, isTower), mix(0.14, 0.07, isTower), fwin);
        roughnessFactor = mix(roughnessFactor, 0.88, isRoof);
      `)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(mix(0.06, 0.30, isTower), mix(0.55, 0.82, isTower), fwin);
        metalnessFactor = mix(metalnessFactor, 0.04, isRoof);
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uLitColor * flit * uNight * (0.85 + 0.35 * wr2);
      `);
  };
  m.customProgramCacheKey = () => 'osm-pbr-facade-v1';
  return m;
}

function cloneFacadeMaterial(base) {
  const m = base.clone();
  m.onBeforeCompile = base.onBeforeCompile;
  m.customProgramCacheKey = base.customProgramCacheKey;
  m.userData.uniforms = base.userData.uniforms;
  return m;
}

/**
 * Plugin that runs during parseTile (BEFORE engineData.materials is snapshotted):
 * 1. Computes per-building hash, real height, and base elevation from `_batchid` (or mesh fallback).
 * 2. Cleanly removes entire OSM buildings whose footprint falls inside a hero landmark's exclusion radius.
 * 3. Applies per-tile clones of the PBR architectural facade material (sharing one compiled WebGLProgram
 *    via customProgramCacheKey, while allowing TilesRenderer to safely dispose individual evicted tiles).
 */
function osmBuildingsPlugin(baseMat, exclusions, osmTiles) {
  const wp = new THREE.Vector3();
  const hashInt = (n) => {
    const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    name: 'OSM_PBR_BUILDINGS_PLUGIN',
    priority: -50,
    processTileModel(scene) {
      const t0 = PERF ? performance.now() : 0;
      osmTiles.group.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const geo = o.geometry;
        const pos = geo.attributes.position;
        if (!pos) return;
        if (!geo.attributes.normal) geo.computeVertexNormals();

        // Compose mesh -> city ENU matrix so heights & exclusion radii are in exact local metres
        const toWorld = new THREE.Matrix4().multiplyMatrices(osmTiles.group.matrixWorld, o.matrixWorld);
        const batchAttr = geo.attributes._batchid || geo.attributes._BATCHID;
        const count = pos.count;
        const buildInfo = new Float32Array(count * 3);

        if (batchAttr) {
          // Group vertices by real OSM building batch ID
          const stats = new Map();
          for (let i = 0; i < count; i++) {
            const bid = batchAttr.getX(i);
            wp.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
            let st = stats.get(bid);
            if (!st) { st = { minY: wp.y, maxY: wp.y, sumX: 0, sumZ: 0, n: 0, excluded: false }; stats.set(bid, st); }
            if (wp.y < st.minY) st.minY = wp.y;
            if (wp.y > st.maxY) st.maxY = wp.y;
            st.sumX += wp.x; st.sumZ += wp.z; st.n++;
          }
          // Check hero landmark exclusions per whole building footprint (zero half-cut shards!)
          if (exclusions.length) {
            for (const st of stats.values()) {
              const cx = st.sumX / st.n, cz = st.sumZ / st.n;
              for (let k = 0; k < exclusions.length; k++) {
                const ex = exclusions[k], dx = cx - ex.x, dz = cz - ex.z;
                if (dx * dx + dz * dz < ex.r * ex.r) { st.excluded = true; break; }
              }
            }
          }
          let anyExcluded = false;
          for (let i = 0; i < count; i++) {
            const bid = batchAttr.getX(i), st = stats.get(bid);
            if (st.excluded) {
              anyExcluded = true;
              // Collapse excluded building vertices to a single degenerate point underground
              pos.setXYZ(i, 0, -99999, 0);
              buildInfo[i * 3] = 0; buildInfo[i * 3 + 1] = 10; buildInfo[i * 3 + 2] = 0;
            } else {
              wp.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
              const h = Math.max(6, st.maxY - st.minY);
              const seed = hashInt(bid + Math.round(st.sumX / st.n * 0.2) * 31 + Math.round(st.sumZ / st.n * 0.2) * 17);
              buildInfo[i * 3] = seed;
              buildInfo[i * 3 + 1] = h;
              buildInfo[i * 3 + 2] = Math.max(0, wp.y - st.minY);
            }
          }
          if (anyExcluded) pos.needsUpdate = true;
        } else {
          // Fallback if a tile has no _batchid attribute
          let minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < count; i++) {
            wp.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
            if (wp.y < minY) minY = wp.y;
            if (wp.y > maxY) maxY = wp.y;
          }
          const h = Math.max(12, maxY - minY);
          for (let i = 0; i < count; i++) {
            wp.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
            const seed = hashInt(Math.floor(wp.x / 35) * 37 + Math.floor(wp.z / 35) * 91);
            buildInfo[i * 3] = seed; buildInfo[i * 3 + 1] = h; buildInfo[i * 3 + 2] = Math.max(0, wp.y - minY);
          }
        }

        geo.setAttribute('aBuildInfo', new THREE.BufferAttribute(buildInfo, 3));
        const old = o.material;
        o.material = cloneFacadeMaterial(baseMat);
        if (old) {
          if (Array.isArray(old)) old.forEach((mm) => mm.dispose());
          else old.dispose();
        }
        o.castShadow = true;
        o.receiveShadow = true;
      });
      if (PERF) perfAdd('osmTile', performance.now() - t0);
    },
  };
}

/** Ensures terrain tiles receive crisp building shadows and integrate naturally with scene lighting. */
function terrainShadowPlugin() {
  return {
    name: 'TERRAIN_SHADOW_PLUGIN',
    priority: -50,
    processTileModel(scene) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = true;
        if (o.material && 'roughness' in o.material) {
          o.material.roughness = 0.94;
          o.material.metalness = 0.0;
        }
      });
    },
  };
}

function abortError() { const e = new Error('aborted'); e.name = 'AbortError'; return e; }

function makeIonPlugin(key, assetId) {
  const ion = new CesiumIonAuthPlugin({ apiToken: key, assetId: String(assetId), autoRefreshToken: true });
  if (!key) {
    const auth = ion.auth;
    auth.refreshToken = (options) => (auth._tokenRefreshPromise ??= fetch(auth.authURL, options)
      .then((res) => { if (!res.ok) throw new Error(`Cesium ion answered ${res.status}`); return res.json(); })
      .then((json) => { if (json.accessToken && json.url) { auth._bearerToken = `Bearer ${json.accessToken}`; auth._bearerHostname = new URL(json.url).host; } return json; })
      .finally(() => { auth._tokenRefreshPromise = null; }));
  }
  return ion;
}

/**
 * Builds a city in Option 3A + Option 2 mode:
 * - Cesium World Terrain + Bing Maps Aerial imagery (real topography, rivers, roads, parks)
 * - Cesium OSM Buildings with crisp world-space PBR architectural facade shader + real sun shadows + sky reflections
 * - Flagship Hero Landmarks (external .glb via manifest or built-in PBR architectural models)
 */
export async function buildOsmCity(city, renderer, o = {}) {
  const signal = o.signal, cityId = o.id ?? city.id;
  // shot: plain still frames (finest tiles everywhere). With o.liveLook a shot keeps the live flight's tile detail.
  const shot = !!o.shot && !o.liveLook;
  configureSharedQueues(!!o.shot);
  const key = apiKey();
  const look = city.look ?? {};
  const night = nightFactor(look);

  // Full lit PBR world with real directional sunlight, crisp shadows, and sky reflections!
  const sunPower = night > 0.7 ? 2.6 : night > 0.4 ? 3.0 : 3.4;
  const ambPower = night > 0.7 ? 0.78 : 1.05;
  const world = createWorld({
    ...look,
    stars: night > 0.75 ? 900 : 0,
    lit: true,
    shadows: true,
    env: night > 0.7 ? 0.85 : 1.05,
    sun: { ...(look.sun ?? {}), power: look.sun?.power ?? sunPower },
    ambient: {
      sky: look.sky?.top ?? 0x9fc4ff,
      ground: look.sky?.bottom ?? 0x5c5850,
      power: ambPower,
    },
  });

  // 1. Cesium World Terrain + Bing Maps Aerial imagery overlay
  const terrainTiles = new TilesRenderer();
  terrainTiles.errorTarget = shot ? 2 : 4;
  terrainTiles.loadSiblings = true;
  terrainTiles.userData = { priority: typeof o.priority === 'number' ? o.priority : 0 };
  terrainTiles.registerPlugin(makeIonPlugin(key, ION_TERRAIN_ASSET));
  // resolution: the pixels of aerial photo each terrain tile gets. A terrain tile is refined by the error of its shape,
  // not by how sharp its photo is, and at the library's 256 one photo pixel covers about two pixels on screen even when
  // everything has loaded: the ground looks soft. 512 brings it to about one. Four times the texture memory, so only
  // where the tile cache is large enough to hold it.
  terrainTiles.registerPlugin(new ImageOverlayPlugin({
    overlays: [new CesiumIonOverlay({ apiToken: key, assetId: ION_IMAGERY_ASSET, autoRefreshToken: true })],
    resolution: cacheBudgetMB(!!o.shot) >= 768 || o.shot ? 512 : 256,
  }));
  terrainTiles.registerPlugin(new ReorientationPlugin({ lat: city.lat * D2R, lon: city.lon * D2R, height: 0 }));
  terrainTiles.registerPlugin(terrainShadowPlugin());
  world.add(terrainTiles.group);

  // Compute deterministic WGS84 -> local ENU transform immediately so we know hero landmark exclusion footprints
  const reorientGroup = new THREE.Group();
  const tmpHelper = new ReorientationPlugin({ lat: city.lat * D2R, lon: city.lon * D2R, height: 0 });
  tmpHelper.tiles = { group: reorientGroup, ellipsoid: WGS84_ELLIPSOID };
  tmpHelper.transformLatLonHeightToOrigin(city.lat * D2R, city.lon * D2R, 0, 0, 0, 0);
  reorientGroup.updateMatrixWorld(true);
  const toLocalAt = (lat, lon, h) => WGS84_ELLIPSOID.getCartographicToPosition(lat * D2R, lon * D2R, h, new THREE.Vector3()).applyMatrix4(reorientGroup.matrixWorld);
  const exclusions = getLandmarkExclusions(cityId, toLocalAt);

  // 2. Cesium OSM Buildings with world-space PBR facade shader + hero landmark footprint exclusion
  const facadeMaterial = createOsmFacadeMaterial(night);
  const osmTiles = new TilesRenderer();
  osmTiles.errorTarget = shot ? 6 : 8;
  osmTiles.errorFalloff = shot ? 0 : 8;
  osmTiles.errorFalloffDensity = 0.00018;
  osmTiles.loadSiblings = true;
  osmTiles.userData = { priority: typeof o.priority === 'number' ? o.priority : 0 };
  osmTiles.registerPlugin(makeIonPlugin(key, ION_OSM_ASSET));
  osmTiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: dracoLoader() }));
  osmTiles.registerPlugin(new ReorientationPlugin({ lat: city.lat * D2R, lon: city.lon * D2R, height: 0 }));
  osmTiles.registerPlugin(osmBuildingsPlugin(facadeMaterial, exclusions, osmTiles));
  world.add(osmTiles.group);

  // Unified facade object so main.js can listen to events, check stats/busy, set priorities, and dispose both tilesets cleanly
  const listeners = new Set();
  const tileBundle = {
    terrain: terrainTiles,
    osm: osmTiles,
    userData: {
      get priority() { return osmTiles.userData.priority; },
      set priority(v) { osmTiles.userData.priority = v; terrainTiles.userData.priority = v; },
    },
    get loadProgress() { return Math.min(terrainTiles.loadProgress, osmTiles.loadProgress); },
    get stats() {   // every counter of the two tilesets added up (queued, downloading, parsing, visible, refused ...)
      const a = terrainTiles.stats ?? {}, b = osmTiles.stats ?? {}, s = {};
      for (const k in a) if (typeof a[k] === 'number') s[k] = a[k];
      for (const k in b) if (typeof b[k] === 'number') s[k] = (s[k] || 0) + b[k];
      return s;
    },
    get errorTarget() { return osmTiles.errorTarget; },
    set errorTarget(v) { osmTiles.errorTarget = v; },
    addEventListener(type, fn) {
      listeners.add([type, fn]);
      terrainTiles.addEventListener(type, fn);
      osmTiles.addEventListener(type, fn);
    },
    getAttributions() {
      return [...(terrainTiles.getAttributions?.() ?? []), ...(osmTiles.getAttributions?.() ?? [])];
    },
    dispose() {
      for (const [type, fn] of listeners) {
        terrainTiles.removeEventListener(type, fn);
        osmTiles.removeEventListener(type, fn);
      }
      listeners.clear();
      terrainTiles.dispose();
      osmTiles.dispose();
      facadeMaterial.dispose();
    },
  };

  const cleanupOnAbort = () => { tileBundle.dispose(); world.dispose(); throw abortError(); };
  if (signal?.aborted) cleanupOnAbort();

  let active = null, prefetch = null;
  const resVec = new THREE.Vector2();
  const trackOne = (tiles, camera, aheadCamera) => {
    if (active !== camera) { if (active) tiles.deleteCamera(active); tiles.setCamera(camera); }
    if (prefetch !== aheadCamera) {
      if (prefetch) tiles.deleteCamera(prefetch);
      if (aheadCamera) tiles.setCamera(aheadCamera);
    }
    tiles.setResolutionFromRenderer(camera, renderer);
    if (aheadCamera) {
      renderer.getSize(resVec);
      tiles.setResolution(aheadCamera, Math.max(1, Math.round(resVec.x * 0.45)), Math.max(1, Math.round(resVec.y * 0.45)));
    }
    tiles.update();
  };
  const track = (camera, aheadCamera = null) => {
    camera.updateMatrixWorld();
    if (aheadCamera) aheadCamera.updateMatrixWorld();
    trackOne(terrainTiles, camera, aheadCamera);
    trackOne(osmTiles, camera, aheadCamera);
    active = camera;
    prefetch = aheadCamera;
  };
  world.onUpdate((t, dt, camera, aheadCamera) => track(camera, aheadCamera));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function settle(camera, ms = o.timeout ?? 15000, sig = signal) {
    const t0 = performance.now(); let quiet = 0;
    while (performance.now() - t0 < ms) {
      if (sig?.aborted) return false;
      track(camera); await sleep(80);
      if (sig?.aborted) return false;
      const s = tileBundle.stats;
      const busy = !terrainTiles.root || !osmTiles.root || tileBundle.loadProgress < 1 || s.downloading > 0 || s.parsing > 0;
      quiet = busy ? 0 : quiet + 1;
      if (quiet >= 4) return true;
    }
    return false;
  }

  // Probe origin ground elevation on Cesium World Terrain
  const probe = new THREE.PerspectiveCamera(30, innerWidth / Math.max(1, innerHeight), 1, 5000);
  probe.position.set(0, 2200, 1); probe.lookAt(0, 0, 0);
  const t0 = performance.now();
  // A root that failed to load (the token has no access to the asset, or no network) will not arrive later, so the
  // wait ends at once and main.js falls back to Google tiles straight away instead of after the whole timeout.
  const rootFailed = () => terrainTiles.rootLoadingState === FAILED || osmTiles.rootLoadingState === FAILED;
  while ((!terrainTiles.root || !osmTiles.root) && !rootFailed() && performance.now() - t0 < (o.timeout ?? 25000)) {
    if (signal?.aborted) cleanupOnAbort();
    track(probe); await sleep(80);
  }
  if (signal?.aborted) cleanupOnAbort();
  if (!terrainTiles.root || !osmTiles.root) {
    tileBundle.dispose(); world.dispose();
    throw new Error('Cesium World Terrain / OSM Buildings did not answer (requires a Cesium ion token)');
  }

  probe.position.set(0, 900, 1); probe.lookAt(0, 0, 0);
  await settle(probe, Math.min(o.timeout ?? 12000, 8000), signal);
  if (signal?.aborted) cleanupOnAbort();
  terrainTiles.group.updateMatrixWorld(true);
  osmTiles.group.updateMatrixWorld(true);

  const ray = new THREE.Raycaster(); ray.firstHitOnly = true; ray.far = 6500;
  const down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3(), hits = [];
  const hitTerrainY = (x, z) => {
    hits.length = 0; from.set(x, 6000, z); ray.set(from, down);
    ray.intersectObject(terrainTiles.group, true, hits);
    return hits.length ? hits[0].point.y : null;
  };
  // Hero landmarks stand where their OSM footprints were removed, so the roof-clearance ray has to see them as well:
  // without this the camera would fly straight through a tower that the OSM buildings no longer contain.
  // heroBounds is filled once the landmarks are placed: [{ obj, r }] with r the landmark's horizontal reach in metres.
  const heroBounds = [], heroHits = [];
  const hitHeroY = (x, z) => {
    let top = null;
    for (const hb of heroBounds) {
      const dx = x - hb.obj.position.x, dz = z - hb.obj.position.z;
      if (dx * dx + dz * dz > hb.r * hb.r) continue;
      heroHits.length = 0; from.set(x, 6000, z); ray.set(from, down);
      ray.intersectObject(hb.obj, true, heroHits);   // sorted nearest first: from above, that is the highest point
      if (heroHits.length && (top === null || heroHits[0].point.y > top)) top = heroHits[0].point.y;
    }
    return top;
  };
  const hitAnyY = (x, z) => {
    hits.length = 0; from.set(x, 6000, z); ray.set(from, down);
    ray.intersectObject(osmTiles.group, true, hits);
    let top = hits.length ? hits[0].point.y : null;
    for (const y of [hitTerrainY(x, z), hitHeroY(x, z)]) if (y !== null && (top === null || y > top)) top = y;
    return top;
  };

  const groundM = typeof city.groundM === 'number' ? city.groundM : (hitTerrainY(0, 0) ?? 0);

  // Place flight path & focus using the exact aligned local ENU transform
  const toLocal = (lat, lon, alt) => WGS84_ELLIPSOID.getCartographicToPosition(lat * D2R, lon * D2R, groundM + alt, new THREE.Vector3()).applyMatrix4(terrainTiles.group.matrixWorld);
  const path = city.path.map(([la, lo, al]) => toLocal(la, lo, al).toArray());
  const focus = (city.focus ?? []).map(([u, la, lo, al]) => [u, ...toLocal(la, lo, al).toArray()]);

  // Place high-detail Hero Landmarks (external .glb override or built-in PBR model)
  const placedLandmarks = await placeHeroLandmarks(cityId, world, {
    toLocal: (lat, lon, alt) => toLocal(lat, lon, alt),
    groundAt: hitTerrainY,
    groundM,
    night,
    signal,
  });
  if (signal?.aborted) cleanupOnAbort();
  const heroBox = new THREE.Box3();
  for (const obj of placedLandmarks) {
    obj.updateMatrixWorld(true);   // rays are cast before the city is first drawn
    heroBox.setFromObject(obj);
    const px = obj.position.x, pz = obj.position.z;
    const r = Math.hypot(Math.max(px - heroBox.min.x, heroBox.max.x - px), Math.max(pz - heroBox.min.z, heroBox.max.z - pz)) + 2;
    heroBounds.push({ obj, r });
  }

  // Distant landmarks (e.g. Taipei 101 or Tokyo Tower, 2-5 km from origin) may not have terrain tiles loaded yet
  // during initial probe; gently snap them to exact real terrain elevation once their local terrain tile arrives.
  // The terrain first seen under a far landmark is a coarse level that can be several metres off, so the landmark
  // keeps following the terrain (twice a second; on every frame of a still shot) until the camera has come within
  // SNAP_NEAR metres of it, where the terrain below is at full detail. Only then does it stay where it stands.
  const pendingSnap = placedLandmarks.filter((obj) => !obj.userData?.grounded);
  if (pendingSnap.length) {
    const SNAP_NEAR = 500, every = o.shot ? 0 : 0.5;
    let since = 0;
    world.onUpdate((t, dt, camera) => {   // runs after track() above, so the rays meet the tiles of this frame
      if (!pendingSnap.length || (since += dt) < every) return;
      since = 0;
      for (let i = pendingSnap.length - 1; i >= 0; i--) {
        const obj = pendingSnap[i], ty = hitTerrainY(obj.position.x, obj.position.z);
        if (ty === null) continue;   // no terrain in view there yet
        const y = ty + (obj.userData.yOffset ?? 0);
        if (Math.abs(obj.position.y - y) > 0.05) {
          obj.position.y = y;
          obj.updateMatrixWorld(true);   // keep the roof-clearance rays on the landmark where it now stands
        }
        const dx = camera.position.x - obj.position.x, dz = camera.position.z - obj.position.z;
        if (dx * dx + dz * dz < SNAP_NEAR * SNAP_NEAR) { obj.userData.grounded = true; pendingSnap.splice(i, 1); }
      }
    });
  }

  /** As clear() in tiles.js: step is the metres flown between two looks at the roofs (0: look now). */
  let lastLift = 0, lastX = Infinity, lastZ = Infinity;
  function clear(pos, ahead, gap = 32, step = 20) {
    if (step > 0) {
      const dx = pos.x - lastX, dz = pos.z - lastZ;
      if (dx * dx + dz * dz < step * step) return lastLift;
      lastX = pos.x; lastZ = pos.z;
    }
    let need = 0;
    for (const p of [pos, ahead]) { if (!p) continue; const y = hitAnyY(p.x, p.z); if (y !== null) need = Math.max(need, y + gap - p.y); }
    return (lastLift = Math.max(0, need));
  }

  terrainTiles.deleteCamera(probe);
  osmTiles.deleteCamera(probe);
  active = null; prefetch = null;

  return {
    world, path, focus,
    duration: city.duration ?? 58,
    tiles: tileBundle,
    settle, clear,
    measured: { groundM: Math.round(groundM) },
  };
}
