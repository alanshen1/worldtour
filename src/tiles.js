// tiles.js: real cities. A city file with `kind: 'tiles'` is drawn from Google Photorealistic 3D Tiles instead of
// being built from the kit. This file turns such a city description into the same { world, path, focus, duration }
// a built city returns, plus what the engine needs for streamed tiles: settle() to wait for tiles to load and
// clear() to keep the camera out of real buildings.
//
// City file shape (see src/cities/new-york.js):
//   { kind: 'tiles', lat, lon,                 origin in degrees; ground height is measured here
//     path: [[lat, lon, alt], ...],            alt = metres above the ground at the origin
//     focus: [[u, lat, lon, alt], ...],        what the camera turns to look at, and when (u = 0..1 along the flight)
//     duration,                                seconds for the whole flight
//     look: { sky, sun, fog, exposure, tint } sky, sun and fog as for kit createWorld(); tint multiplies the photo colours }
import * as THREE from 'three';
import {
  TilesRenderer, WGS84_ELLIPSOID, FAILED,
  DEFAULT_LRU_CACHE, DEFAULT_DOWNLOAD_QUEUE, DEFAULT_PARSE_QUEUE, DEFAULT_NODE_QUEUE, unifiedPriorityCallback,
} from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin, CesiumIonAuthPlugin, ReorientationPlugin,
  TileCompressionPlugin, GLTFExtensionsPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createWorld } from './kit.js';
import { PERF, perfAdd } from './perf.js';

const ROOT_URL = 'https://tile.googleapis.com/v1/3dtiles/root.json', KEY_STORE = 'worldtour.googleKey', D2R = Math.PI / 180;
// The same Google tiles can come two ways: straight from Google with a Map Tiles API key (they start "AIza"), or through
// Cesium ion with an ion access token (a free account, no Google Cloud billing). ION_ASSET is Google's tileset in ion.
const ION_ASSET = 2275207, ION_ENDPOINT = `https://api.cesium.com/v1/assets/${ION_ASSET}/endpoint`;
const isGoogleKey = (k) => /^AIza/.test(k);
const searchParams = () => new URLSearchParams(location.search);
/** Which service to ask: 'google' or 'ion'. With no key at all, ?provider= picks (default ion). */
const provider = (key) => key ? (isGoogleKey(key) ? 'google' : 'ion') : (searchParams().get('provider') === 'google' ? 'google' : 'ion');
export const isIonProvider = (key = apiKey()) => provider(key) === 'ion';

// ---------------------------------------------------------------- shared tile cache & queue limits
let queuesConfiguredFor = null;
const activeFirstPriority = (a, b) => {
  const pa = a.internal?.renderer?.userData?.priority ?? 0;
  const pb = b.internal?.renderer?.userData?.priority ?? 0;
  if (pa !== pb) return pa - pb;   // PriorityQueue pops from the end, so higher priority runs first
  return unifiedPriorityCallback(a, b);
};
/**
 * How many megabytes of tiles (geometry and textures, as the library counts them) all cities together may keep.
 * When the cache is full the library REFUSES new tiles, and whatever they would have sharpened stays blurred, so the
 * budget follows the machine: ?cache=<MB> sets it by hand (128..4096), otherwise it goes by navigator.deviceMemory
 * (GB of RAM; Chrome only, and it never reports more than 8). What the page really uses is roughly twice this number,
 * because the browser keeps the decoded pictures as well as the textures made from them.
 */
export function cacheBudgetMB(shot = false) {
  const asked = Number(typeof location === 'undefined' ? NaN : searchParams().get('cache'));
  if (asked >= 128) return Math.min(asked, 4096);
  if (shot) return 500;
  const mem = typeof navigator === 'undefined' ? undefined : navigator.deviceMemory;
  if (mem === undefined) return 768;   // Safari and Firefox do not say
  // Chrome reports 8 for every machine with 8 GB or more, so 8 has to stay safe for a real 8 GB laptop
  return mem >= 16 ? 2048 : mem >= 8 ? 1024 : mem >= 4 ? 768 : 450;
}
/** What the shared cache holds right now, for the ?debug readout. */
export const cacheInfo = () => ({
  mb: Math.round(DEFAULT_LRU_CACHE.cachedBytes / 1048576), maxMb: Math.round(DEFAULT_LRU_CACHE.maxBytesSize / 1048576),
  items: DEFAULT_LRU_CACHE.itemSet.size, maxItems: DEFAULT_LRU_CACHE.maxSize,
});
/**
 * Spreads the starting of a queue's jobs over frames. The library starts up to maxJobs jobs in ONE animation frame,
 * and the first part of a parse runs at once, on the main thread: a terrain tile builds its whole mesh there. Five of
 * those in one frame were the 40 to 70 ms frames of a flight over a dense city. Here jobs are started one after another
 * only until START_BUDGET_MS of the frame has gone; the rest wait for the next frame. As many jobs as before may be
 * under way together (the slow part of most of them runs in a worker), and the order of the jobs is unchanged.
 * name: what the ?debug readout calls the time spent starting jobs.
 */
const START_BUDGET_MS = 2;
export function spreadJobStarts(queue, name = 'parseStart') {
  if (queue.startsSpread) return;
  queue.startsSpread = true;
  const startAll = queue.tryRunJobs.bind(queue);
  queue.tryRunJobs = () => {
    const max = queue.maxJobs, t0 = performance.now();
    try {
      do {
        if (queue.currJobs >= max || queue.items.length === 0) break;
        queue.maxJobs = queue.currJobs + 1;   // room for exactly one more job
        startAll();
      } while (performance.now() - t0 < START_BUDGET_MS);
    } finally { queue.maxJobs = max; }
    if (PERF) perfAdd('in:' + name, performance.now() - t0);
    if (queue.items.length > 0 && queue.currJobs < max) queue.scheduleJobRun();   // the rest: next frame
  };
}
export function configureSharedQueues(shot) {
  if (queuesConfiguredFor === !!shot) return;
  queuesConfiguredFor = !!shot;
  DEFAULT_DOWNLOAD_QUEUE.priorityCallback = activeFirstPriority;
  DEFAULT_PARSE_QUEUE.priorityCallback = activeFirstPriority;
  if (!shot) spreadJobStarts(DEFAULT_PARSE_QUEUE);   // still frames wait for everything anyway: no need to pace them
  // Unloading starts above the lower marks (tiles no longer in use go first); the upper marks are where new tiles
  // are refused. The tile count scales with the bytes so that it is never the count that refuses a tile first.
  const mb = cacheBudgetMB(shot), scale = Math.max(1, mb / 450);
  DEFAULT_LRU_CACHE.minSize = Math.round(4000 * scale);
  DEFAULT_LRU_CACHE.maxSize = Math.round(6000 * scale);
  DEFAULT_LRU_CACHE.minBytesSize = Math.round(mb * 0.72) * 1024 * 1024;
  DEFAULT_LRU_CACHE.maxBytesSize = mb * 1024 * 1024;
  DEFAULT_LRU_CACHE.unloadPercent = shot ? 0.05 : 0.08;
  DEFAULT_DOWNLOAD_QUEUE.maxJobsPerOrigin = 25;
  DEFAULT_PARSE_QUEUE.maxJobs = 5;
  DEFAULT_NODE_QUEUE.maxJobs = 25;
}

// ---------------------------------------------------------------- the API key
// The key (or ion token) is never part of the site: it comes from ?key= or from this browser's storage. With no key at all the
// requests go out bare, which works where a proxy adds the key on the way (the cloud sessions this was built in).
let cachedIon = null;
export function apiKey() {
  const fromUrl = searchParams().get('key');
  if (fromUrl) { setApiKey(fromUrl); return fromUrl; }
  try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
}
export function setApiKey(k) { if (cachedIon && cachedIon.key !== k) cachedIon = null; try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) { /* private window: key lasts this visit only */ } }
/** True when the 3D tiles answer with the key or token we have (or with none, behind a proxy that adds it). */
export async function keyWorks(key = apiKey()) {
  const isGoogle = provider(key) === 'google';
  const url = isGoogle ? ROOT_URL + (key ? '?key=' + encodeURIComponent(key) : '') : ION_ENDPOINT + (key ? '?access_token=' + encodeURIComponent(key) : '');
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    if (!isGoogle) {
      const json = await r.json();
      cachedIon = { key, json };
    }
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- one tileset
let draco = null;
export const dracoLoader = () => (draco ??= new DRACOLoader()
  .setDecoderPath(new URL('../vendor/three/addons/libs/draco/gltf/', import.meta.url).href)
  .setWorkerLimit(Math.min(navigator.hardwareConcurrency || 4, 4)));

function sessionFrom(node) {
  if (!node) return null;
  const uri = node.content?.uri; if (uri && uri.includes('session=')) return new URLSearchParams(uri.split('?')[1]).get('session');
  for (const c of node.children ?? []) { const s = sessionFrom(c); if (s) return s; }
  return null;
}
function ionPlugin(key) {
  // useRecommendedSettings: false for the same reason as in googlePlugin(): ion hands this asset on to the Google plugin
  const ion = new CesiumIonAuthPlugin({ apiToken: key, assetId: String(ION_ASSET), autoRefreshToken: true, useRecommendedSettings: false });
  const auth = ion.auth;
  const origRefresh = key ? auth.refreshToken.bind(auth) : (options) => (auth._tokenRefreshPromise ??= fetch(auth.authURL, options)
    .then((res) => { if (!res.ok) throw new Error(`Cesium ion answered ${res.status}`); return res.json(); })
    .then((json) => { if (json.accessToken && json.url) { auth._bearerToken = `Bearer ${json.accessToken}`; auth._bearerHostname = new URL(json.url).host; } return json; })
    .finally(() => { auth._tokenRefreshPromise = null; }));   // a failed refresh must not stick: the next call tries again
  auth.refreshToken = (options) => {
    // Reuse the validated endpoint response from keyWorks() once on startup to avoid an extra quota hit
    if (cachedIon && cachedIon.key === key) {
      const json = cachedIon.json; cachedIon = null;
      if (json.accessToken && json.url) { auth._bearerToken = `Bearer ${json.accessToken}`; auth._bearerHostname = new URL(json.url).host; }
      return Promise.resolve(json);
    }
    return origRefresh(options);
  };
  return ion;
}
/**
 * Replaces loaded glTF materials with unlit, fogged, tinted MeshBasicMaterial during processTileModel
 * (BEFORE TilesRenderer snapshots engineData.materials), so evicted/disposed tiles never leak materials.
 */
function unlitTintPlugin(tint, maxAniso) {
  return {
    name: 'UNLIT_TINT_PLUGIN',
    priority: -50,
    processTileModel(scene) {
      const t0 = PERF ? performance.now() : 0;
      scene.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const old = o.material;
        const map = old.map ?? null;
        if (map) {
          map.anisotropy = maxAniso;
          map.minFilter = THREE.LinearMipmapLinearFilter;
          map.generateMipmaps = true;
        }
        const m = new THREE.MeshBasicMaterial({ map, color: tint, fog: true });
        m.toneMapped = false;
        o.material = m;
        old.dispose();
      });
      if (PERF) perfAdd('tint', performance.now() - t0);
    },
  };
}
function makeTiles(look, shot, renderer, liveLook = !shot) {
  configureSharedQueues(shot);
  const key = apiKey(), tiles = new TilesRenderer(ROOT_URL);
  // Push foreground landmarks (<1.5 km) to Google's deepest leaf LOD (errorTarget 4 CSS px = ~8 Retina px),
  // while gently relaxing far horizon tiles (>3-5 km) so frame rate stays smooth
  tiles.errorTarget = liveLook ? 4 : 8;
  tiles.errorFalloff = liveLook ? 10 : 0;
  tiles.errorFalloffDensity = 0.00018;
  tiles.loadSiblings = true;
  tiles.userData = { priority: 0 };
  if (provider(key) === 'ion') tiles.registerPlugin(ionPlugin(key));
  else tiles.registerPlugin(googlePlugin(key));
  tiles.registerPlugin(new TileCompressionPlugin({ disableMipmaps: false }));
  const maxAniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  tiles.registerPlugin(unlitTintPlugin(new THREE.Color(look.tint ?? 0xffffff), maxAniso));
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: dracoLoader() }));
  return tiles;
}
function googlePlugin(key) {
  // useRecommendedSettings: false, or the plugin sets tiles.errorTarget = 20 when it is registered, which undid the
  // finer value makeTiles() had just set: with a Google key the photos came out about five times coarser than meant
  const google = new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true, useRecommendedSettings: false });
  if (!key) {
    // the library always appends key=; with no key that empty value would be rejected, so send the requests bare
    const auth = google.auth; let rootRead = false;
    auth.fetch = async (url, options) => {
      const u = new URL(url);
      if (u.host === 'tile.googleapis.com' && auth.sessionToken) u.searchParams.set('session', auth.sessionToken);
      const res = await fetch(u, options);
      // the first answer is the root tileset: read it here for its session token (once, even if it carries none)
      if (!rootRead && res.ok) { rootRead = true; const json = await res.json(); auth.sessionToken = sessionFrom(json.root); return json; }
      return res;
    };
  }
  return google;
}

function abortError() { const e = new Error('aborted'); e.name = 'AbortError'; return e; }

// ---------------------------------------------------------------- building a real city
/**
 * Makes a real city ready to fly. renderer: the page's WebGLRenderer. o.timeout: ms to wait for each loading stage.
 * o.shot: still frames for tools/shot.mjs (patient loading). o.liveLook: give the city the look of the live flight
 * (its tile detail, lifted path and duration); true when not shooting, and for shots taken with --live.
 * Returns { world, path, focus, duration, tiles, settle(camera, ms, signal), clear(pos, ahead), measured: { groundM } }.
 */
export async function buildTilesCity(city, renderer, o = {}) {
  const shot = !!o.shot, signal = o.signal, liveLook = !shot || !!o.liveLook;
  const look = city.look ?? {}, world = createWorld({ ...look, stars: 0, lit: false, shadows: false, env: 0 });
  const tiles = makeTiles(look, shot, renderer, liveLook);
  if (typeof o.priority === 'number') tiles.userData.priority = o.priority;
  tiles.registerPlugin(new ReorientationPlugin({ lat: city.lat * D2R, lon: city.lon * D2R, height: 0, recenter: true }));
  world.add(tiles.group);

  const cleanupOnAbort = () => { tiles.dispose(); world.dispose(); throw abortError(); };
  if (signal?.aborted) cleanupOnAbort();

  // which camera(s) the tiles load for: main camera (or portal camera), plus an optional look-ahead prefetch camera
  let active = null, prefetch = null;
  const resVec = new THREE.Vector2();
  const track = (camera, aheadCamera = null) => {
    if (active !== camera) { if (active) tiles.deleteCamera(active); tiles.setCamera(camera); active = camera; }
    if (prefetch !== aheadCamera) {
      if (prefetch) tiles.deleteCamera(prefetch);
      if (aheadCamera) tiles.setCamera(aheadCamera);
      prefetch = aheadCamera;
    }
    camera.updateMatrixWorld(); tiles.setResolutionFromRenderer(camera, renderer);
    if (aheadCamera) {
      aheadCamera.updateMatrixWorld();
      renderer.getSize(resVec);
      // Prefetch upcoming path at ~45% resolution so leaf tiles are already streaming in 5-6s before arrival
      tiles.setResolution(aheadCamera, Math.max(1, Math.round(resVec.x * 0.45)), Math.max(1, Math.round(resVec.y * 0.45)));
    }
    tiles.update();
  };
  world.onUpdate((t, dt, camera, aheadCamera) => track(camera, aheadCamera));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Keeps loading for `camera` until nothing is left to download (true) or `ms` runs out (false). */
  async function settle(camera, ms = o.timeout ?? 30000, sig = signal) {
    const t0 = performance.now(); let quiet = 0;
    while (performance.now() - t0 < ms) {
      if (sig?.aborted) return false;
      track(camera); await sleep(80);
      if (sig?.aborted) return false;
      const s = tiles.stats ?? {}, busy = tiles.loadProgress < 1 || s.downloading > 0 || s.parsing > 0 || !tiles.root;
      quiet = busy ? 0 : quiet + 1; if (quiet >= 4) return true;
    }
    return false;
  }

  // 1. the root tileset fixes where the city sits; 2. load ground directly around the origin and measure it
  // Narrow FOV + short far plane keeps the origin height probe fast (<1s) without downloading distant horizon tiles
  const probe = new THREE.PerspectiveCamera(shot ? 60 : 30, innerWidth / Math.max(1, innerHeight), 1, shot ? 30000 : 4000);
  probe.position.set(0, 2500, 1); probe.lookAt(0, 0, 0);
  const baseErr = tiles.errorTarget;
  if (!shot) tiles.errorTarget = 32;
  const t0 = performance.now();
  // a root that failed to load (bad key, no access, no network) will not arrive later: stop waiting for it
  while (!tiles.root && tiles.rootLoadingState !== FAILED && performance.now() - t0 < (o.timeout ?? 30000)) {
    if (signal?.aborted) cleanupOnAbort();
    track(probe); await sleep(80);
  }
  if (signal?.aborted) cleanupOnAbort();
  if (!tiles.root) { tiles.dispose(); world.dispose(); throw new Error('the 3D tiles did not answer (check the Google key or Cesium ion token)'); }

  const ray = new THREE.Raycaster(); ray.firstHitOnly = true; ray.far = 6500;
  const down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3(), hits = [];
  const hitY = (x, z) => {
    hits.length = 0; from.set(x, 6000, z); ray.set(from, down);
    ray.intersectObject(tiles.group, true, hits);
    return hits.length ? hits[0].point.y : null;
  };

  let groundM;
  if (typeof city.groundM === 'number') {
    tiles.group.updateMatrixWorld(true);
    groundM = city.groundM;
  } else {
    probe.position.set(0, 900, 1); probe.lookAt(0, 0, 0);
    await settle(probe, shot ? (o.timeout ?? 120000) : Math.min(o.timeout ?? 12000, 10000), signal);
    if (signal?.aborted) cleanupOnAbort();
    tiles.group.updateMatrixWorld(true);
    groundM = hitY(0, 0) ?? 0;
  }
  tiles.errorTarget = baseErr;

  // 3. place the flight: latitude, longitude and height above the origin's ground become local metres
  // Smoothly lift very low segments (<155m) into aerial photogrammetry's crisp sweet spot while keeping landmarks framed
  const aerialAlt = (al) => (liveLook && al < 155) ? al + (155 - al) * 0.45 : al;
  const toLocal = (lat, lon, alt) => WGS84_ELLIPSOID.getCartographicToPosition(lat * D2R, lon * D2R, groundM + alt, new THREE.Vector3()).applyMatrix4(tiles.group.matrixWorld);
  const path = city.path.map(([la, lo, al]) => toLocal(la, lo, aerialAlt(al)).toArray());
  const focus = (city.focus ?? []).map(([u, la, lo, al]) => [u, ...toLocal(la, lo, al).toArray()]);

  /**
   * Metres to lift the camera at `pos` (and at `ahead`, a point further along) to stay `gap` metres above real roofs.
   * step: metres the camera must have flown since the last look before the roofs are measured again (0: measure now).
   * Counting metres, not frames, keeps the looks closer together than the look-ahead at any speed or frame rate.
   */
  let lastLift = 0, lastX = Infinity, lastZ = Infinity;
  function clear(pos, ahead, gap = 28, step = 20) {
    if (step > 0) {
      const dx = pos.x - lastX, dz = pos.z - lastZ;
      if (dx * dx + dz * dz < step * step) return lastLift;
      lastX = pos.x; lastZ = pos.z;
    }
    let need = 0;
    for (const p of [pos, ahead]) { if (!p) continue; const y = hitY(p.x, p.z); if (y !== null) need = Math.max(need, y + gap - p.y); }
    return (lastLift = Math.max(0, need));
  }
  tiles.deleteCamera(probe); active = null;
  const duration = Math.round((city.duration ?? 48) * (liveLook ? 1.15 : 1));
  return { world, path, focus, duration, tiles, settle, clear, measured: { groundM: Math.round(groundM) } };
}

/** The text Google asks to be shown with its tiles: the data providers for what is on screen. */
export function attributions(tiles) {
  const parts = [];
  for (const a of tiles.getAttributions()) if (a.type === 'string' && a.value) parts.push(a.value);
  return parts.join(' · ');
}
