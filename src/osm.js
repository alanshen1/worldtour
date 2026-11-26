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
import { apiKey, configureSharedQueues, dracoLoader, frameGate } from './tiles.js';
import { PERF, perfAdd } from './perf.js';
import { getLandmarkExclusions, placeHeroLandmarks } from './landmarks.js';

const D2R = Math.PI / 180;
const ION_TERRAIN_ASSET = '1';      // Cesium World Terrain
const ION_IMAGERY_ASSET = '2';      // Bing Maps Aerial
const ION_OSM_ASSET = '96188';      // Cesium OSM Buildings

/**
 * The deepest level of aerial photo to ask for. Bing's metadata says its photos go to zoom 20 or 21 everywhere; in most
 * places they stop a level or two short, and beyond that it sends a grey "no image" tile (a crossed-out camera) with a
 * normal 200 answer. The library asks for the deepest level the source claims and goes on splitting terrain tiles to
 * reach it, so the ground near the camera turned into a flat sheet of those tiles, slowly. 19 (about 0.3 m a pixel) is
 * the deepest level that was there at all eight cities asked on 2026-11-26 (level 20: seven of eight, not Taipei, and
 * patchy within a city; level 21: none). ?imagery=<15..21> sets another level by hand: lower it if a city still shows
 * the crossed-out camera.
 */
const MAX_IMAGERY_LEVEL = 19;
export function imageryMaxLevel() {
  const asked = Number(typeof location === 'undefined' ? NaN : new URLSearchParams(location.search).get('imagery'));
  return asked >= 15 && asked <= 21 ? Math.floor(asked) : MAX_IMAGERY_LEVEL;
}
/**
 * Makes an image overlay stop at `maxLevel`: once the overlay has set up its image source, the levels beyond it are
 * dropped from the source's tiling, so every part of the library that asks "how deep does this go?" gets the capped
 * answer (which level to fetch, whether to split a terrain tile further). Returns the overlay.
 */
export function capImageryLevels(overlay, maxLevel) {
  const initSource = overlay._initImageSource.bind(overlay);
  overlay._initImageSource = () => initSource().then((result) => {
    const levels = overlay.imageSource?.tiling?._levels;
    if (levels && levels.length > maxLevel + 1) levels.length = maxLevel + 1;
    return result;
  });
  return overlay;
}
/**
 * Spreads the splitting of terrain tiles over frames. Where the aerial photo goes deeper than the terrain, the overlay
 * plugin cuts a terrain tile's mesh into four "virtual" children so each can carry a sharper photo: that is what makes
 * the ground sharp, and it is done on the main thread, up to 11 ms for one tile. The plugin does it the moment a
 * tile's photo is in, so the tiles whose photos arrived together were all cut in one frame: frames of 20 to 35 ms
 * (measured with ?debug probes: the long gaps between animation frames were this call and nothing else).
 * The cut follows an `await` inside the plugin; here that await also passes a gate that lets about SPLIT_BUDGET_MS of
 * it through per frame, at least one tile. Downloads are not held back and the order is unchanged. Returns the plugin.
 */
const SPLIT_BUDGET_MS = 2;
const splitGate = frameGate(SPLIT_BUDGET_MS, 'groundSplit');   // one gate for every city: the budget is per frame
export function paceTileSplitting(plugin, gate = splitGate) {
  const init = plugin._initTileSceneOverlayInfo;
  if (typeof init !== 'function') return plugin;   // another version of the library: leave it as it is
  // the plugin's _processTileModel awaits this, then cuts the tile (expandVirtualChildren) and sets up its layers
  plugin._initTileSceneOverlayInfo = function (...args) { return Promise.resolve(init.apply(this, args)).then(gate); };
  return plugin;
}

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
 * A coarse map of how high the buildings reach: the tallest roof over each `cell` x `cell` metre square of the city,
 * filled in as building tiles arrive. The roof-clearance check asks this map instead of casting a ray at the building
 * meshes: a ray is tested against every triangle of every large tile it crosses (tens of thousands in a dense city,
 * several times a second), and that showed as a steady stutter. Looking a square up costs nothing.
 * A building is entered by the rectangle around its footprint, so the map errs on the side of flying a little higher.
 */
export function createRoofGrid(cell = 12) {
  const tops = new Map(), OFF = 32768, MAX_CELLS = 20000;
  const key = (ix, iz) => (ix + OFF) * 65536 + (iz + OFF);
  return {
    cell,
    /** Something reaches up to height `top` over the rectangle minX..maxX, minZ..maxZ (city metres). */
    add(minX, maxX, minZ, maxZ, top) {
      const x0 = Math.floor(minX / cell), x1 = Math.floor(maxX / cell), z0 = Math.floor(minZ / cell), z1 = Math.floor(maxZ / cell);
      if (!(x1 >= x0 && z1 >= z0) || (x1 - x0 + 1) * (z1 - z0 + 1) > MAX_CELLS) return;   // NaN, or not a building
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = key(ix, iz), old = tops.get(k);
          if (old === undefined || top > old) tops.set(k, top);
        }
      }
    },
    /** The tallest roof recorded over the square that holds (x, z), or null where no building is known. */
    topAt(x, z) { const v = tops.get(key(Math.floor(x / cell), Math.floor(z / cell))); return v === undefined ? null : v; },
    get size() { return tops.size; },
  };
}

// scratch arrays for osmBuildingsPlugin, grown as needed and reused from tile to tile (no garbage per tile)
let sX = new Float32Array(0), sY = new Float32Array(0), sZ = new Float32Array(0);
let bMinY = new Float32Array(0), bMaxY = new Float32Array(0), bMinX = new Float32Array(0), bMaxX = new Float32Array(0);
let bMinZ = new Float32Array(0), bMaxZ = new Float32Array(0), bSumX = new Float64Array(0), bSumZ = new Float64Array(0);
let bN = new Uint32Array(0), bOut = new Uint8Array(0), bSeed = new Float32Array(0);
function growScratch(vertices, batches) {
  if (sX.length < vertices) { const n = Math.ceil(vertices * 1.5); sX = new Float32Array(n); sY = new Float32Array(n); sZ = new Float32Array(n); }
  if (bN.length < batches) {
    const n = Math.ceil(batches * 1.5);
    bMinY = new Float32Array(n); bMaxY = new Float32Array(n); bMinX = new Float32Array(n); bMaxX = new Float32Array(n);
    bMinZ = new Float32Array(n); bMaxZ = new Float32Array(n); bSumX = new Float64Array(n); bSumZ = new Float64Array(n);
    bN = new Uint32Array(n); bOut = new Uint8Array(n); bSeed = new Float32Array(n);
  }
}
const hashInt = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// The passes over a tile, each over a range [i0, i1) so that the caller can hand the thread back between ranges.
// They are plain functions on plain arrays, kept out of the async function that drives them: written inside it, the
// JavaScript engine optimised these loops only now and then, and a tile took up to four times as long.
// v: what the passes need to know about one mesh (see meshView below).

/** Vertices i0..i1 into city metres (sX, sY, sZ). Returns the largest batch id seen, or -2 if an id is unusable. */
function transformRange(v, i0, i1, maxId) {
  const { pos, raw, stride, off, e, batch, bRaw, bStride } = v;
  for (let i = i0; i < i1; i++) {
    let x, y, z;
    if (raw) { const j = i * stride + off; x = raw[j]; y = raw[j + 1]; z = raw[j + 2]; }
    else { x = pos.getX(i); y = pos.getY(i); z = pos.getZ(i); }
    sX[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
    sY[i] = e[1] * x + e[5] * y + e[9] * z + e[13];
    sZ[i] = e[2] * x + e[6] * y + e[10] * z + e[14];
    if (maxId > -2 && batch) {
      const id = bRaw ? bRaw[i * bStride] : batch.getX(i);
      if (id >= 0 && id === Math.floor(id)) { if (id > maxId) maxId = id; } else maxId = -2;
    }
  }
  return maxId;
}
/** Vertices i0..i1 into the statistics of their buildings: extent, height range, footprint centre. */
function statsRange(v, i0, i1) {
  const { batch, bRaw, bStride } = v;
  for (let i = i0; i < i1; i++) {
    const b = bRaw ? bRaw[i * bStride] : batch.getX(i), x = sX[i], y = sY[i], z = sZ[i];
    if (y < bMinY[b]) bMinY[b] = y;
    if (y > bMaxY[b]) bMaxY[b] = y;
    if (x < bMinX[b]) bMinX[b] = x;
    if (x > bMaxX[b]) bMaxX[b] = x;
    if (z < bMinZ[b]) bMinZ[b] = z;
    if (z > bMaxZ[b]) bMaxZ[b] = z;
    bSumX[b] += x; bSumZ[b] += z; bN[b]++;
  }
}
/** Buildings b0..b1: removed under a hero landmark, or given their seed and entered into the roof map. True if any was removed. */
function buildingsRange(b0, b1, exclusions, roofs) {
  let anyOut = false;
  for (let b = b0; b < b1; b++) {
    if (!bN[b]) continue;
    const cx = bSumX[b] / bN[b], cz = bSumZ[b] / bN[b];
    // Check hero landmark exclusions per whole building footprint (zero half-cut shards!)
    for (let k = 0; k < exclusions.length; k++) {
      const ex = exclusions[k], dx = cx - ex.x, dz = cz - ex.z;
      if (dx * dx + dz * dz < ex.r * ex.r) { bOut[b] = 1; anyOut = true; break; }
    }
    if (bOut[b]) continue;
    bSeed[b] = hashInt(b + Math.round(cx * 0.2) * 31 + Math.round(cz * 0.2) * 17);
    if (roofs) roofs.add(bMinX[b], bMaxX[b], bMinZ[b], bMaxZ[b], bMaxY[b]);
  }
  return anyOut;
}
/** Vertices i0..i1: their building's seed, height and their own height above its base, into buildInfo. */
function writeRange(v, i0, i1, buildInfo) {
  const { pos, batch, bRaw, bStride } = v;
  for (let i = i0; i < i1; i++) {
    const b = bRaw ? bRaw[i * bStride] : batch.getX(i), j = i * 3;
    if (bOut[b]) {
      // Collapse excluded building vertices to a single degenerate point underground
      pos.setXYZ(i, 0, -99999, 0);
      buildInfo[j] = 0; buildInfo[j + 1] = 10; buildInfo[j + 2] = 0;
    } else {
      buildInfo[j] = bSeed[b];
      buildInfo[j + 1] = Math.max(6, bMaxY[b] - bMinY[b]);
      buildInfo[j + 2] = Math.max(0, sY[i] - bMinY[b]);
    }
  }
}
/** A tile without usable batch ids, vertices i0..i1: one height for the whole mesh, a seed by place. */
function fallbackRange(i0, i1, buildInfo, minY, h, roofs) {
  for (let i = i0; i < i1; i++) {
    const j = i * 3;
    buildInfo[j] = hashInt(Math.floor(sX[i] / 35) * 37 + Math.floor(sZ[i] / 35) * 91);
    buildInfo[j + 1] = h; buildInfo[j + 2] = Math.max(0, sY[i] - minY);
    if (roofs) roofs.add(sX[i], sX[i], sZ[i], sZ[i], sY[i]);   // no footprints to go by: every vertex marks its own square
  }
}
/** How to read one mesh: its position attribute straight from the array where that is possible, and its batch ids. */
function meshView(geo, e) {
  const pos = geo.attributes.position, batch = geo.attributes._batchid || geo.attributes._BATCHID || null;
  const inter = pos.isInterleavedBufferAttribute === true;
  return {
    pos, e, batch,
    raw: pos.normalized ? null : (inter ? pos.data.array : pos.array),
    stride: inter ? pos.data.stride : pos.itemSize, off: inter ? pos.offset : 0,
    bRaw: batch && !batch.normalized && batch.isInterleavedBufferAttribute !== true ? batch.array : null,
    bStride: batch ? batch.itemSize : 1,
  };
}

/** Hands the main thread back to the browser (so that a frame can be drawn) and resumes straight after. */
const breatheWaiting = [], breatheChannel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
if (breatheChannel) breatheChannel.port1.onmessage = () => { const go = breatheWaiting.shift(); if (go) go(); };
function breathe() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  return new Promise((go) => { if (breatheChannel) { breatheWaiting.push(go); breatheChannel.port2.postMessage(0); } else setTimeout(go, 0); });
}

/**
 * Plugin that runs during parseTile (BEFORE engineData.materials is snapshotted):
 * 1. Computes per-building hash, real height, and base elevation from `_batchid` (or mesh fallback).
 * 2. Cleanly removes entire OSM buildings whose footprint falls inside a hero landmark's exclusion radius.
 * 3. Applies per-tile clones of the PBR architectural facade material (sharing one compiled WebGLProgram
 *    via customProgramCacheKey, while allowing TilesRenderer to safely dispose individual evicted tiles).
 * 4. Enters every building it keeps into `roofs` (createRoofGrid), for the roof-clearance check.
 *
 * This runs on the main thread for every building tile that arrives, and a large tile takes 10 to 20 ms: three frames
 * of a 144 Hz screen if done in one go. So the work is done in slices of o.sliceMs with the thread handed back between
 * them (and once before starting, so it does not pile onto the library's own parsing of the tile in the same task).
 * The library waits for the promise before it uses the tile. Tiles are taken one at a time: the slices of two tiles
 * never interleave, which also keeps the shared scratch arrays safe.
 * o.onSlice(ms): called after every slice with the time it took (for the test).
 */
export function osmBuildingsPlugin(baseMat, exclusions, osmTiles, roofs = null, o = {}) {
  // 2 ms slices: a 144 Hz frame is 6.9 ms and the engine's own work takes about half of it
  const sliceMs = o.sliceMs ?? 2, CHUNK = 2048;   // CHUNK: vertices between two looks at the clock
  const toWorld = new THREE.Matrix4();
  let sliceStart = 0;
  const endSlice = () => { const ms = performance.now() - sliceStart; if (PERF) perfAdd('osmTile', ms); if (o.onSlice) o.onSlice(ms); };
  const due = () => performance.now() - sliceStart >= sliceMs;
  /** The slice has used up its time: let the browser draw, then start a new one. */
  const pause = async () => { endSlice(); await breathe(); sliceStart = performance.now(); };

  async function buildMesh(mesh) {
    const geo = mesh.geometry;
    if (!geo.attributes.position) return;
    if (!geo.attributes.normal) { geo.computeVertexNormals(); if (due()) await pause(); }

    // Compose mesh -> city ENU matrix so heights & exclusion radii are in exact local metres
    toWorld.multiplyMatrices(osmTiles.group.matrixWorld, mesh.matrixWorld);
    const v = meshView(geo, toWorld.elements), count = v.pos.count;
    const buildInfo = new Float32Array(count * 3);
    growScratch(count, 0);

    let maxId = v.batch ? -1 : -2;
    for (let i = 0; i < count; i += CHUNK) { maxId = transformRange(v, i, Math.min(count, i + CHUNK), maxId); if (due()) await pause(); }
    // batch ids are small whole numbers (0 .. buildings-1); anything else is treated like a tile without ids
    if (maxId > Math.max(65535, count)) maxId = -2;

    if (maxId >= 0) {
      const nb = maxId + 1;
      growScratch(count, nb);
      bMinY.fill(Infinity, 0, nb); bMaxY.fill(-Infinity, 0, nb); bMinX.fill(Infinity, 0, nb); bMaxX.fill(-Infinity, 0, nb);
      bMinZ.fill(Infinity, 0, nb); bMaxZ.fill(-Infinity, 0, nb); bSumX.fill(0, 0, nb); bSumZ.fill(0, 0, nb); bN.fill(0, 0, nb); bOut.fill(0, 0, nb);
      for (let i = 0; i < count; i += CHUNK) { statsRange(v, i, Math.min(count, i + CHUNK)); if (due()) await pause(); }
      let anyOut = false;
      for (let b = 0; b < nb; b += 256) { if (buildingsRange(b, Math.min(nb, b + 256), exclusions, roofs)) anyOut = true; if (due()) await pause(); }
      for (let i = 0; i < count; i += CHUNK) { writeRange(v, i, Math.min(count, i + CHUNK), buildInfo); if (due()) await pause(); }
      if (anyOut) v.pos.needsUpdate = true;
    } else {
      // Fallback if a tile has no (usable) _batchid attribute
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < count; i++) { const y = sY[i]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      const h = Math.max(12, maxY - minY);
      for (let i = 0; i < count; i += CHUNK) { fallbackRange(i, Math.min(count, i + CHUNK), buildInfo, minY, h, roofs); if (due()) await pause(); }
    }

    geo.setAttribute('aBuildInfo', new THREE.BufferAttribute(buildInfo, 3));
    const old = mesh.material;
    mesh.material = cloneFacadeMaterial(baseMat);
    if (old) {
      if (Array.isArray(old)) old.forEach((mm) => mm.dispose());
      else old.dispose();
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  async function buildTile(scene) {
    await breathe();
    sliceStart = performance.now();
    try {
      osmTiles.group.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);
      const meshes = [];
      scene.traverse((ob) => { if (ob.isMesh && ob.geometry) meshes.push(ob); });
      for (const mesh of meshes) { await buildMesh(mesh); if (due()) await pause(); }
    } finally { endSlice(); }
  }
  let chain = Promise.resolve();   // one tile at a time
  return {
    name: 'OSM_PBR_BUILDINGS_PLUGIN',
    priority: -50,
    processTileModel(scene) {
      const job = chain.then(() => buildTile(scene));
      chain = job.catch(() => {});   // a tile that fails is the library's to report; the next one still gets its turn
      return job;
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
  // The aerial photo on the ground. Its levels are capped (see capImageryLevels): without the cap the ground near the
  // camera was papered with Bing's "no image" tile. resolution stays at the library's 256 px per terrain tile: 512 was
  // tried for a sharper ground, but it asks for four times the photo tiles (the ground loaded slowly) and reached the
  // missing levels a level sooner.
  const imagery = capImageryLevels(new CesiumIonOverlay({ apiToken: key, assetId: ION_IMAGERY_ASSET, autoRefreshToken: true }), imageryMaxLevel());
  const overlayPlugin = new ImageOverlayPlugin({ overlays: [imagery] });
  if (!o.shot) paceTileSplitting(overlayPlugin);   // still frames wait for everything anyway: no need to pace them
  terrainTiles.registerPlugin(overlayPlugin);
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
  const roofs = createRoofGrid();   // how high the buildings reach, filled by the plugin as their tiles arrive
  osmTiles.registerPlugin(osmBuildingsPlugin(facadeMaterial, exclusions, osmTiles, roofs));
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
  // The terrain height a landmark may stand on: only from a terrain tile that is fine enough.
  // A ray meets every ACTIVE terrain tile, and where the camera is not looking (or while finer tiles are still on their
  // way) the active tile is a coarse one, kilometres wide, whose surface near mountains can lie hundreds of metres off
  // the valley floor: Taipei 101 hung in mid-air from standing on one. A tile's size tells its level: a mesh whose
  // bounding sphere is within FINE_TILE_RADIUS is level 13 or finer, good to a few metres.
  const FINE_TILE_RADIUS = 2000;
  const hitTerrainFineY = (x, z) => {
    hits.length = 0; from.set(x, 6000, z); ray.set(from, down);
    ray.intersectObject(terrainTiles.group, true, hits);
    if (!hits.length) return null;
    const mesh = hits[0].object, sphere = mesh?.geometry?.boundingSphere;
    if (!sphere) return null;
    return sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis() <= FINE_TILE_RADIUS ? hits[0].point.y : null;
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
  // the highest thing over (x, z): a building (from the roof map, not a ray: see createRoofGrid), the terrain, a landmark
  const hitAnyY = (x, z) => {
    let top = roofs.topAt(x, z);
    const t = hitTerrainY(x, z); if (t !== null && (top === null || t > top)) top = t;
    const h = hitHeroY(x, z); if (h !== null && (top === null || h > top)) top = h;
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
    groundAt: hitTerrainFineY,   // null where the terrain is not fine yet: the landmark then waits at groundM (below)
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

  // A landmark away from the origin has no fine terrain under it yet when the city is built. Until it does it stands
  // at the height of the origin's ground (groundM), which in a city is close. Then it follows the fine terrain below
  // it (twice a second; on every frame of a still shot) until the camera has come within SNAP_NEAR metres, where the
  // terrain is at full detail, and only then stays where it stands. Coarse terrain is never trusted (hitTerrainFineY).
  const pendingSnap = placedLandmarks.filter((obj) => !obj.userData?.grounded);
  if (pendingSnap.length) {
    const SNAP_NEAR = 500, every = o.shot ? 0 : 0.5;
    let since = 0;
    world.onUpdate((t, dt, camera) => {   // runs after track() above, so the rays meet the tiles of this frame
      if (!pendingSnap.length || (since += dt) < every) return;
      since = 0;
      for (let i = pendingSnap.length - 1; i >= 0; i--) {
        const obj = pendingSnap[i], ty = hitTerrainFineY(obj.position.x, obj.position.z);
        if (ty === null) continue;   // no fine terrain there yet
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
