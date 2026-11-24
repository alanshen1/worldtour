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
import { TilesRenderer, WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin, ReorientationPlugin, TileCompressionPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createWorld } from './kit.js';

const ROOT_URL = 'https://tile.googleapis.com/v1/3dtiles/root.json', KEY_STORE = 'worldtour.googleKey', D2R = Math.PI / 180;

// ---------------------------------------------------------------- the API key
// The key is never part of the site: it comes from ?key= or from this browser's storage. With no key at all the
// requests go out bare, which works where a proxy adds the key on the way (the cloud sessions this was built in).
export function apiKey() {
  const fromUrl = new URLSearchParams(location.search).get('key');
  if (fromUrl) { setApiKey(fromUrl); return fromUrl; }
  try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
}
export function setApiKey(k) { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) { /* private window: key lasts this visit only */ } }
/** True when the 3D tiles answer with the key we have (or with none, behind a proxy that adds it). */
export async function keyWorks(key = apiKey()) {
  try { const r = await fetch(ROOT_URL + (key ? '?key=' + encodeURIComponent(key) : '')); return r.ok; } catch (e) { return false; }
}

// ---------------------------------------------------------------- one tileset
let draco = null;
const dracoLoader = () => (draco ??= new DRACOLoader().setDecoderPath(new URL('../vendor/three/addons/libs/draco/gltf/', import.meta.url).href));

function sessionFrom(node) {
  if (!node) return null;
  const uri = node.content?.uri; if (uri && uri.includes('session=')) return new URLSearchParams(uri.split('?')[1]).get('session');
  for (const c of node.children ?? []) { const s = sessionFrom(c); if (s) return s; }
  return null;
}
function makeTiles(look) {
  const key = apiKey(), tiles = new TilesRenderer(ROOT_URL);
  const google = new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true });
  if (!key) {
    // the library always appends key=; with no key that empty value would be rejected, so send the requests bare
    const auth = google.auth;
    auth.fetch = async (url, options) => {
      const u = new URL(url);
      if (u.host === 'tile.googleapis.com' && auth.sessionToken) u.searchParams.set('session', auth.sessionToken);
      const res = await fetch(u, options);
      if (auth.sessionToken === null && res.ok) { const json = await res.json(); auth.sessionToken = sessionFrom(json.root); return json; }
      return res;
    };
  }
  tiles.registerPlugin(google);
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: dracoLoader() }));
  // photographs carry their own light: draw them unlit and untoned, tinted for the hour, and let the fog take the distance
  const tint = new THREE.Color(look.tint ?? 0xffffff);
  tiles.addEventListener('load-model', ({ scene }) => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const old = o.material, m = new THREE.MeshBasicMaterial({ map: old.map ?? null, color: tint, fog: true });
      m.toneMapped = false; o.material = m; old.dispose();
    });
  });
  return tiles;
}

// ---------------------------------------------------------------- building a real city
/**
 * Makes a real city ready to fly. renderer: the page's WebGLRenderer. o.timeout: ms to wait for each loading stage.
 * Returns { world, path, focus, duration, tiles, settle(camera, ms), clear(pos, ahead), measured: { groundM } }.
 */
export async function buildTilesCity(city, renderer, o = {}) {
  const look = city.look ?? {}, world = createWorld({ ...look, stars: 0 });
  const tiles = makeTiles(look);
  tiles.registerPlugin(new ReorientationPlugin({ lat: city.lat * D2R, lon: city.lon * D2R, height: 0, recenter: true }));
  world.add(tiles.group);

  // which camera the tiles load for: the engine calls world.update with the main camera, or the portal camera
  let active = null;
  const track = (camera) => {
    if (active !== camera) { if (active) tiles.deleteCamera(active); tiles.setCamera(camera); active = camera; }
    camera.updateMatrixWorld(); tiles.setResolutionFromRenderer(camera, renderer); tiles.update();
  };
  world.onUpdate((t, dt, camera) => track(camera));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Keeps loading for `camera` until nothing is left to download (true) or `ms` runs out (false). */
  async function settle(camera, ms = o.timeout ?? 30000) {
    const t0 = performance.now(); let quiet = 0;
    while (performance.now() - t0 < ms) {
      track(camera); await sleep(80);
      const s = tiles.stats ?? {}, busy = tiles.loadProgress < 1 || s.downloading > 0 || s.parsing > 0 || !tiles.root;
      quiet = busy ? 0 : quiet + 1; if (quiet >= 4) return true;
    }
    return false;
  }

  // 1. the root tileset fixes where the city sits; 2. load the ground around the origin and measure it
  const probe = new THREE.PerspectiveCamera(60, innerWidth / Math.max(1, innerHeight), 1, 30000);
  probe.position.set(0, 2500, 1); probe.lookAt(0, 0, 0);
  const t0 = performance.now();
  while (!tiles.root && performance.now() - t0 < (o.timeout ?? 30000)) { track(probe); await sleep(80); }
  if (!tiles.root) throw new Error('Google 3D tiles did not answer (check the API key)');
  probe.position.set(0, 900, 1); probe.lookAt(0, 0, 0); await settle(probe);
  tiles.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
  const down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
  const hitY = (x, z) => { from.set(x, 6000, z); ray.set(from, down); const h = ray.intersectObject(tiles.group, true)[0]; return h ? h.point.y : null; };
  const groundM = hitY(0, 0) ?? 0;

  // 3. place the flight: latitude, longitude and height above the origin's ground become local metres
  const toLocal = (lat, lon, alt) => WGS84_ELLIPSOID.getCartographicToPosition(lat * D2R, lon * D2R, groundM + alt, new THREE.Vector3()).applyMatrix4(tiles.group.matrixWorld);
  const path = city.path.map(([la, lo, al]) => toLocal(la, lo, al).toArray());
  const focus = (city.focus ?? []).map(([u, la, lo, al]) => [u, ...toLocal(la, lo, al).toArray()]);

  /** Metres to lift the camera at `pos` (and at `ahead`, a point further along) to stay `gap` metres above real roofs. */
  let calls = 0, lastLift = 0;
  function clear(pos, ahead, gap = 28, every = 4) {
    if (calls++ % every) return lastLift;
    let need = 0;
    for (const p of [pos, ahead]) { if (!p) continue; const y = hitY(p.x, p.z); if (y !== null) need = Math.max(need, y + gap - p.y); }
    return (lastLift = Math.max(0, need));
  }
  tiles.deleteCamera(probe); active = null;
  return { world, path, focus, duration: city.duration ?? 48, tiles, settle, clear, measured: { groundM: Math.round(groundM) } };
}

/** The text Google asks to be shown with its tiles: the data providers for what is on screen. */
export function attributions(tiles) {
  const parts = [];
  for (const a of tiles.getAttributions()) if (a.type === 'string' && a.value) parts.push(a.value);
  return parts.join(' · ');
}
