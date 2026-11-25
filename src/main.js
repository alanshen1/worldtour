// main.js: the engine. It flies the camera through one city, opens a portal at the end of the flight path,
// draws the next city live through that portal, and swaps the two at the moment the camera passes through.
import * as THREE from 'three';
import { setRenderer, glowMat } from './kit.js';
import { CITIES, loadCity } from './cities/index.js';
import { buildTilesCity, attributions, setApiKey, keyWorks, isIonProvider, cacheInfo } from './tiles.js';
import { buildOsmCity } from './osm.js';
import { PERF, perfAdd, perfTime, perfFrame, perfSource } from './perf.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search), SHOT = Q.has('shot');
// ?shot alone takes plain, fully loaded frames for checking a city while building it (wide lens, the authored path,
// no finishing pass). ?shot&live takes the frame a visitor sees: the flight's lens, lifted path, roof clearance, tile
// detail and finishing pass. Anything that changes the look of the flight must hang on LIVE_LOOK, not on SHOT.
const LIVE_LOOK = !SHOT || Q.has('live');
const canvas = $('view');
const DPR = window.devicePixelRatio || 1;
const FOV = LIVE_LOOK ? 46 : 60;   // cinematic 46° telephoto lens: brings landmarks closer & pulls ~35% finer on-axis 3D tiles
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT,
});
renderer.autoClear = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
// Shadows stay switched on for the whole visit. three.js bakes this flag into every shader it compiles, so turning it
// on later leaves already-compiled materials without shadows; a world with no shadow-casting light costs nothing here.
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setRenderer(renderer);
const MAX_RATIO = SHOT ? 1 : Math.min(DPR, 2); let ratio = MAX_RATIO;
const cam = new THREE.PerspectiveCamera(FOV, 1, 1, 20000), pcam = cam.clone();
const aheadCam = new THREE.PerspectiveCamera(FOV, 1, 1, 2600);
const warmRT = new THREE.WebGLRenderTarget(32, 32);

// Lightweight 1-pass post-processing: AMD FidelityFX CAS adaptive sharpening + subtle haze-cutting clarity & vibrance
const USE_POST = LIVE_LOOK && renderer.capabilities.isWebGL2;
const postRT = USE_POST ? new THREE.WebGLRenderTarget(2, 2, {
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  samples: DPR < 1.5 ? 4 : 0,
}) : null;
const postUniforms = {
  tDiffuse: { value: postRT?.texture ?? null },
  uTexel: { value: new THREE.Vector2(1, 1) },
  uSharp: { value: 0.68 },
  // A city's look.exposure. three applies renderer.toneMappingExposure only when it draws straight to the screen, and
  // with this pass the cities are drawn into postRT, so the exposure is applied here instead. One value per frame:
  // the city being flown (the one seen through the portal takes over at the crossing).
  uExposure: { value: 1 },
};
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
if (USE_POST) {
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const postMat = new THREE.ShaderMaterial({
    uniforms: postUniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uTexel;
      uniform float uSharp;
      uniform float uExposure;
      varying vec2 vUv;

      vec3 softShoulder(vec3 c) {
        c = max(c, vec3(0.0));
        vec3 hi = max(c - vec3(0.85), vec3(0.0));
        return min(c, vec3(0.85)) + (0.15 * hi) / (vec3(0.15) + hi);
      }
      vec3 toSrgb(vec3 c) {
        vec3 lo = c * 12.92;
        vec3 hi = 1.055 * pow(max(c, vec3(1e-5)), vec3(1.0 / 2.4)) - 0.055;
        return mix(lo, hi, step(vec3(0.0031308), c));
      }
      vec3 sampleSrgb(vec2 uv) {
        return toSrgb(softShoulder(texture2D(tDiffuse, uv).rgb * uExposure));
      }
      void main() {
        vec3 e = sampleSrgb(vUv);
        vec3 b = sampleSrgb(vUv + vec2(0.0, -uTexel.y));
        vec3 d = sampleSrgb(vUv + vec2(-uTexel.x, 0.0));
        vec3 f = sampleSrgb(vUv + vec2(uTexel.x, 0.0));
        vec3 h = sampleSrgb(vUv + vec2(0.0, uTexel.y));

        // Contrast Adaptive Sharpening (5-tap CAS): crisp building facades/windows without halo ringing
        vec3 mn = min(e, min(min(b, d), min(f, h)));
        vec3 mx = max(e, max(max(b, d), max(f, h)));
        vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0);
        amp = sqrt(amp);
        vec3 w = amp * (-mix(0.125, 0.2, uSharp));
        vec3 col = clamp((e + (b + d + f + h) * w) / (1.0 + 4.0 * w), 0.0, 1.0);

        // Subtle clarity S-curve + natural vibrance to counter aerial photogrammetry haze
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.11);
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
        col = clamp(mix(vec3(luma), col, 1.0 + 0.12 * (1.0 - sat)), 0.0, 1.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const quad = new THREE.Mesh(tri, postMat); quad.frustumCulled = false;
  postScene.add(quad);
}

let viewW = innerWidth, viewH = innerHeight, dirty = true;
function resize() {
  viewW = innerWidth; viewH = innerHeight;
  renderer.setPixelRatio(ratio); renderer.setSize(viewW, viewH, false);
  if (postRT) {
    const pw = Math.max(1, Math.round(viewW * ratio)), ph = Math.max(1, Math.round(viewH * ratio));
    postRT.setSize(pw, ph);
    postUniforms.uTexel.value.set(1 / pw, 1 / ph);
  }
  cam.aspect = aheadCam.aspect = viewW / Math.max(1, viewH);
  cam.updateProjectionMatrix(); aheadCam.updateProjectionMatrix();
  dirty = true;
}
addEventListener('resize', resize); resize();

function desiredFar(st) {
  if (SHOT || !st?.tiles) return 20000;
  return THREE.MathUtils.clamp(Math.round(2.6 / Math.max(st.world.fogDensity || 0.00018, 0.0001)), 12000, 20000);
}
function syncCameraFar(st) {
  const far = desiredFar(st);
  if (cam.far !== far) { cam.far = far; cam.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- a stage is one built city, ready to fly
const PORTAL_R = 16, UP = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
// Circumscribed octagon around the portal disc (+ ring margin) for conservative screen-space scissor bounds
const PORTAL_OCT = Array.from({ length: 8 }, (_, i) => {
  const a = (i + 0.5) * Math.PI / 4, r = PORTAL_R / Math.cos(Math.PI / 8) + 1.8;
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
});
const pCenter = new THREE.Vector3(), pCorner = new THREE.Vector3(), pView = new THREE.Vector3();

function frameAt(pos, dir) { const m = new THREE.Matrix4().lookAt(pos, v1.copy(pos).add(dir), UP); m.setPosition(pos); return m; }
function makePortal() {
  const g = new THREE.Group();
  const mask = new THREE.Mesh(new THREE.CircleGeometry(PORTAL_R, 64), new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, fog: false }));
  mask.renderOrder = -10000; g.add(mask);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R, 0.3, 12, 96), glowMat(0xcfeaff, 4, { fog: false, toneMapped: false }));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R + 0.5, 1.1, 12, 96), glowMat(0x58b8ff, 1, { fog: false, additive: true, opacity: 0.35 }));
  const n = 90, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = i / n * 6.283, r = PORTAL_R + 0.6 + (i * 7 % 5) * 0.45; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.sin(a) * r; p[i * 3 + 2] = ((i * 13) % 7 - 3) * 0.25; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.7, color: 0xdff2ff, fog: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  g.add(ring, halo, sparks); g.userData.sparks = sparks; g.visible = false; return g;
}

/**
 * Draws a newly built city into a tiny off-screen target, a few meshes per animation frame, through the same clipping
 * plane the portal view uses. That compiles the shader variants the portal needs and uploads geometry and textures ahead
 * of time, so neither the flight nor the opening of the portal has one long frame.
 * (compileAsync alone cannot do this: three's compile() takes its clipping-plane count from the last frame drawn, not
 * from renderer.clippingPlanes, and it uploads no geometry.)
 * Nothing else may draw or update this city while this runs: prepare() calls it before the city is handed over.
 */
async function warmDrawGradually(st, wcam, signal, perFrame = 8) {
  const scene = st.world.scene, items = [];
  scene.traverseVisible((o) => { if (o.isMesh || o.isPoints || o.isLine) items.push(o); });
  if (!items.length) return;
  for (const o of items) o.visible = false;
  try {
    for (let i = 0; i < items.length; i += perFrame) {
      if (signal?.aborted) return;
      const end = Math.min(i + perFrame, items.length);
      for (let j = i; j < end; j++) items[j].visible = true;
      renderer.clippingPlanes = [st.clip];
      const t0 = PERF ? performance.now() : 0;
      try { renderer.setRenderTarget(warmRT); renderer.render(scene, wcam); }
      finally { renderer.setRenderTarget(null); renderer.clippingPlanes = []; }
      if (PERF) perfAdd('warm', performance.now() - t0);
      for (let j = i; j < end; j++) items[j].visible = false;
      await new Promise((r) => requestAnimationFrame(r));
    }
  } finally {
    for (const o of items) o.visible = true;
  }
}

const MODE_STORE = 'worldtour.mode';
let renderMode = 'osm', switchingMode = false;
function resolveInitialMode() {
  const fromUrl = Q.get('mode');
  if (fromUrl === 'google') return 'google';
  if (fromUrl === 'osm' && isIonProvider()) return 'osm';
  if (SHOT) return 'google';
  if (!isIonProvider()) return 'google';
  try {
    const saved = localStorage.getItem(MODE_STORE);
    if (saved === 'google' || saved === 'osm') return saved;
  } catch (e) { /* ignore private storage errors */ }
  return 'osm';
}
function syncModeUI() {
  const b = $('b-mode');
  if (b) {
    b.textContent = renderMode === 'osm' ? '矢量精模' : '实景航拍';
    b.classList.toggle('active', renderMode === 'osm');
  }
  postUniforms.uSharp.value = renderMode === 'osm' ? 0.28 : 0.68;
}

/** Builds city `id` ready to fly. o.at: where along the flight (0..1) the camera will start, so that view is the one loaded. */
async function prepare(id, signal, { urgent = false, mode = renderMode, at = 0 } = {}) {
  const meta = CITIES.find((c) => c.id === id), t0 = performance.now();
  const city = await loadCity(id);
  if (signal?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
  // Option 3A+2 ('osm'): Cesium World Terrain + Bing imagery + OSM vector PBR buildings + Hero landmarks
  // Option 1 ('google'): Google Photorealistic 3D Tiles
  let built, actualMode = 'kit';
  if (city.kind === 'tiles') {
    const opts = { id, timeout: SHOT ? 120000 : 18000, shot: SHOT, liveLook: LIVE_LOOK, signal, priority: urgent || !cur ? 3 : 0 };
    if (mode === 'osm' && isIonProvider()) {
      try {
        built = await buildOsmCity(city, renderer, opts);
        actualMode = 'osm';
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        console.warn(`OSM+Hero mode failed for "${id}", falling back to Google 3D tiles:`, e);
        osmUnavailable();   // later cities go straight to Google tiles instead of failing here again
        built = await buildTilesCity(city, renderer, opts);
        actualMode = 'google';
      }
    } else {
      built = await buildTilesCity(city, renderer, opts);
      actualMode = 'google';
    }
  } else {
    built = city.build();
  }
  const pts = built.path.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = 600;
  const P0 = curve.getPointAt(0), T0 = curve.getTangentAt(0).normalize(), P1 = curve.getPointAt(1), T1 = curve.getTangentAt(1).normalize();
  const portal = makePortal(); portal.applyMatrix4(frameAt(P1, T1)); built.world.scene.add(portal);
  const st = {
    id, meta, mode: actualMode, world: built.world, curve, focus: built.focus ?? [], duration: built.duration ?? 42, t: 0, time: 0, portal, length: curve.getLength(),
    entry: frameAt(P0, T0), exit: frameAt(P1, T1), exitInv: frameAt(P1, T1).invert(), clip: new THREE.Plane(T0.clone(), -T0.dot(P0) + 1),
    tiles: built.tiles, settle: built.settle, clear: built.clear, measured: built.measured, lift: 0,
  };
  if (st.tiles) {
    const markDirty = () => { dirty = true; };
    st.tiles.addEventListener('load-model', markDirty);
    st.tiles.addEventListener('load-tileset', markDirty);
    st.tiles.addEventListener('needs-update', markDirty);
  }

  // warm-up: settle near-field entry tiles quickly (so switching cities never stalls for 20-30s on far horizon tiles),
  // then immediately restore full crisp errorTarget for live flight
  const wcam = new THREE.PerspectiveCamera(FOV, cam.aspect, cam.near, SHOT ? desiredFar(st) : 6000);
  if (at > 0) pose(st, at, wcam.position, wcam.quaternion);   // a mode switch resumes mid-flight: load what is seen from there
  else { wcam.position.copy(P0); wcam.quaternion.setFromRotationMatrix(st.entry); }
  wcam.updateMatrixWorld();
  if (st.settle) {
    const savedErr = st.tiles?.errorTarget;
    if (!SHOT && st.tiles) st.tiles.errorTarget = 14;
    await st.settle(wcam, SHOT ? 120000 : 12000, signal);
    if (!SHOT && st.tiles && savedErr !== undefined) st.tiles.errorTarget = savedErr;
    // The first city, and a city rebuilt by a mode switch, are looked at the moment the veil lifts, and nothing is
    // flying meanwhile: give them up to 5 s more to load that first view at full detail, so it opens sharp.
    // (A next city gets the same from refineNext() while it waits behind the portal.)
    if (!SHOT && st.tiles && (!cur || at > 0) && !signal?.aborted) await st.settle(wcam, 5000, signal);
  }
  st.wcam = wcam;   // refineNext() goes on loading this view
  if (signal?.aborted) { dispose(st); const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
  st.world.follow(wcam, wcam.getWorldDirection(v1));

  // The shaders for flying this city directly (no clipping plane) compile in the background where the browser can.
  // The variants for seeing it through the portal (one clipping plane) come from the warm-up drawing below.
  // three builds the variant for whichever target is bound at the moment compile() is called, and a city is drawn into
  // postRT, not onto the screen: bound to the screen it would compile shaders the flight never uses.
  try {
    const prevRT = renderer.getRenderTarget(); let job;
    if (postRT) renderer.setRenderTarget(postRT);
    try { job = renderer.compileAsync(st.world.scene, wcam); } finally { renderer.setRenderTarget(prevRT); }
    await job;
  } catch (e) { /* older browsers: compile on first draw */ }

  if (signal?.aborted) { dispose(st); const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
  if (!cur || SHOT) {
    renderer.setRenderTarget(warmRT); renderer.render(st.world.scene, wcam); renderer.setRenderTarget(null);
  } else {
    await warmDrawGradually(st, wcam, signal);
    if (signal?.aborted) { dispose(st); const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
  }
  st.buildMs = Math.round(performance.now() - t0);
  return st;
}

function dispose(st) { if (!st) return; st.tiles?.dispose(); st.world.dispose(); }
function deferDispose(st) {
  if (!st) return;
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => dispose(st), { timeout: 1500 });
  else setTimeout(() => dispose(st), 400);
}

// ---------------------------------------------------------------- the flight
let cur = null, next = null, nextLoading = null, nextAbort = null, queued = null, paused = false, hurry = false, pace = 1, openAmt = 0;
let nextTimer = 0;
const idxOf = (id) => CITIES.findIndex((c) => c.id === id);
function loadNext(tries = 0, urgent = false) {
  if (switchingMode || nextLoading || next || tries >= CITIES.length || !cur) return;
  const id = queued ?? CITIES[(idxOf(cur.id) + 1 + tries) % CITIES.length].id; queued = null;
  if (id === cur.id) return loadNext(tries + 1, urgent);
  const meta = CITIES.find((c) => c.id === id);
  if (urgent && meta) { $('next').textContent = `正在前往 · ${meta.zh} ${meta.en}…`; $('next').classList.add('on'); }
  const ctrl = new AbortController(); nextAbort = ctrl;
  const job = nextLoading = prepare(id, ctrl.signal, { urgent }).then((st) => {
    if (nextLoading === job) { next = st; nextLoading = null; nextAbort = null; showNextHint(); dirty = true; }
    else dispose(st);
  }).catch((e) => {
    if (e?.name === 'AbortError') return;
    console.warn(`city "${id}" could not be built:`, e);
    if (nextLoading === job) { nextLoading = null; nextAbort = null; loadNext(tries + 1, urgent); }
  });
}
/** Where the camera wants to be and look at flight position u (0..1). Writes pos into `outPos`, the look rotation into `outQ`. */
function pose(st, u, outPos, outQ) {
  st.curve.getPointAt(u, outPos);
  const aheadPt = Math.min(1, u + 30 / st.length);
  v2.copy(st.curve.getPointAt(aheadPt, v3)).sub(outPos);
  if (v2.length() < 15) st.curve.getTangentAt(Math.min(u, 1), v2);
  v2.normalize();
  const f = st.focus;
  if (f.length) {
    const a = f[0][0], b = f[f.length - 1][0];
    let w = Math.min(THREE.MathUtils.smoothstep(u, a - 0.05, a + 0.03), 1 - THREE.MathUtils.smoothstep(u, b - 0.03, b + 0.05));
    w *= THREE.MathUtils.smoothstep(u, 0.03, 0.1) * (1 - THREE.MathUtils.smoothstep(u, 0.74, 0.84));
    if (w > 0) {
      let i = 0; while (i < f.length - 2 && u > f[i + 1][0]) i++;
      const k0 = f[i], k1 = f[Math.min(i + 1, f.length - 1)], s = k1[0] > k0[0] ? THREE.MathUtils.clamp((u - k0[0]) / (k1[0] - k0[0]), 0, 1) : 0, e = s * s * (3 - 2 * s);
      v3.set(k0[1] + (k1[1] - k0[1]) * e, k0[2] + (k1[2] - k0[2]) * e, k0[3] + (k1[3] - k0[3]) * e).sub(outPos).normalize();
      v2.lerp(v3, w * 0.92).normalize();
    }
  }
  m1.lookAt(outPos, v3.copy(outPos).add(v2), UP); outQ.setFromRotationMatrix(m1);
}
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
function syncTilePriorities() {
  if (cur?.tiles?.userData) cur.tiles.userData.priority = hurry && !next ? 1 : 2;
  if (next?.tiles?.userData) next.tiles.userData.priority = hurry || openAmt > 0.001 ? 2 : 0;
}
function updateAheadCam(st) {
  if (SHOT || !st?.tiles) return null;
  const lookAheadSec = hurry ? 10 : 5.5;
  const uAhead = Math.min(1, st.t + (lookAheadSec * pace) / st.duration);
  pose(st, uAhead, aheadCam.position, aheadCam.quaternion);
  aheadCam.position.y += st.lift;
  aheadCam.updateMatrixWorld();
  return aheadCam;
}
function tilesBusy(st) {
  const t = st?.tiles;
  if (!t) return false;
  const s = t.stats ?? {};
  return t.loadProgress < 1 || s.queued > 0 || s.downloading > 0 || s.parsing > 0;
}
const NEXT_AT = 0.17;   // about 12 s into a flight at normal pace
function step(dt) {
  const st = cur; st.time += dt;
  // The next city starts loading 12 s after arrival (nextTimer), or once the flight is NEXT_AT of the way along if
  // that comes first: at a fast pace 12 s is too late for the portal to be ready. Asked once per city here; a city
  // that fails to build is retried inside loadNext, and a mode switch keeps to its own timer.
  if (!st.askedNext && st.t > NEXT_AT && !switchingMode) {
    st.askedNext = true;
    if (!next && !nextLoading) { clearTimeout(nextTimer); loadNext(); }
  }
  // the portal opens late in the flight, once the next city is ready; the flight waits in front of it if it is not
  const wantOpen = next && st.t > 0.66;
  openAmt = THREE.MathUtils.clamp(openAmt + (wantOpen ? dt / 2.2 : -dt * 2), 0, 1);
  let speed = (hurry ? 7 : 1) * pace / st.duration;
  if (!next || openAmt < 1) speed *= 1 - THREE.MathUtils.smoothstep(st.t, 0.84, 0.93);
  st.t += speed * dt;
  if (st.t >= 1 && next && openAmt >= 1) return cross();
  st.t = Math.min(st.t, 1);

  // Move camera first so tiles and scene updaters run on the exact same pose draw() will render
  pose(st, st.t, cam.position, q1);
  cam.quaternion.slerp(q1, 1 - Math.exp(-dt * 2.4));
  cam.position.y += PERF ? perfTime('roof', () => liftAt(st, st.t, dt)) : liftAt(st, st.t, dt);
  cam.updateMatrixWorld();

  syncTilePriorities();
  const aheadC = updateAheadCam(st);
  if (PERF) perfTime('tiles', () => st.world.update(st.time, dt, cam, aheadC)); else st.world.update(st.time, dt, cam, aheadC);
  // the next city is updated every frame only while it is seen; compute pcam first so frame 1 uses the real portal pose
  if (next && openAmt > 0.001) {
    portalCam();
    next.time += dt;
    if (PERF) perfTime('tiles', () => next.world.update(next.time, dt, pcam)); else next.world.update(next.time, dt, pcam);
  } else if (next) refineNext(dt);
  dirty = true;
}
/**
 * A city waiting behind the closed portal was loaded quickly and coarsely (prepare() settles it at errorTarget 14, so
 * that it is ready in time). Left like that, the first seconds after the crossing are blurred while the fine tiles
 * arrive. So while it waits it goes on loading the view its entry will show, at full detail: a few times a second,
 * and at the lowest download priority (syncTilePriorities), behind everything the city being flown asks for.
 */
const REFINE_EVERY = 0.25;
function refineNext(dt) {
  if (SHOT || !next.tiles || !next.wcam) return;
  if ((next.refineWait = (next.refineWait ?? 0) + dt) < REFINE_EVERY) return;
  next.refineWait = 0;
  if (PERF) perfTime('nextRefine', () => next.world.update(next.time, 0, next.wcam)); else next.world.update(next.time, 0, next.wcam);
}
const ahead = new THREE.Vector3();
/** In a real city: how far to lift the camera above the authored path to keep it clear of real roofs. It fades out
 * before the portal, so the camera always passes through the ring. dt 0 means jump straight to the answer. */
function liftAt(st, u, dt) {
  if (!st.clear) return 0;
  const fade = 1 - THREE.MathUtils.smoothstep(u, 0.86, 0.95);
  let want = 0;
  if (fade > 0.001) {
    st.curve.getPointAt(Math.min(1, u + 60 / st.length), ahead);
    want = st.clear(cam.position, ahead, LIVE_LOOK ? 45 : 28, dt ? 20 : 0) * fade;   // in flight: look again every 20 m flown
  }
  // the lift follows faster when the flight is faster, so a fast-forward clears the same roofs the normal flight does
  const rate = 1.6 * Math.max(1, (hurry ? 7 : 1) * pace);
  st.lift = dt ? st.lift + (want - st.lift) * (1 - Math.exp(-dt * rate)) : want;
  return st.lift;
}
function cross() {
  // carry the camera's exact place relative to the portal into the next city, so there is no cut
  cam.updateMatrixWorld(); m2.copy(next.entry).multiply(cur.exitInv).multiply(cam.matrixWorld);
  m2.decompose(cam.position, cam.quaternion, v1);
  const old = cur; cur = next; next = null; openAmt = 0; hurry = false; cur.t = 0; cur.lift = 0;
  syncCameraFar(cur); syncTilePriorities();
  cam.updateMatrixWorld(); cur.world.update(cur.time, 0, cam, updateAheadCam(cur));
  deferDispose(old);
  arrived();
  clearTimeout(nextTimer); nextTimer = setTimeout(loadNext, 12000);
  dirty = true;
}
const fwd = new THREE.Vector3();
/** The portal camera: where the main camera would be if the portal's ring were the next city's entry. */
function portalCam() {
  pcam.projectionMatrix.copy(cam.projectionMatrix); pcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  pcam.aspect = cam.aspect; pcam.near = cam.near; pcam.far = cam.far;
  cam.updateMatrixWorld(); m2.copy(next.entry).multiply(cur.exitInv).multiply(cam.matrixWorld); m2.decompose(pcam.position, pcam.quaternion, v1); pcam.updateMatrixWorld();
}

/** Conservative screen-space scissor rect covering the portal disc so next.world only shades pixels inside the portal. */
function portalScissor(portal, camera) {
  portal.updateMatrixWorld();
  pCenter.setFromMatrixPosition(portal.matrixWorld);
  const scaledR = (PORTAL_R + 2) * Math.max(portal.scale.x, 0.001);
  if (camera.position.distanceTo(pCenter) <= scaledR + camera.near + 8) {
    return { visible: true, full: true, coverage: 1 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < PORTAL_OCT.length; i++) {
    pCorner.copy(PORTAL_OCT[i]).applyMatrix4(portal.matrixWorld);
    pView.copy(pCorner).applyMatrix4(camera.matrixWorldInverse);
    if (pView.z >= -camera.near) return { visible: true, full: true, coverage: 1 };
    pCorner.project(camera);
    if (pCorner.x < minX) minX = pCorner.x;
    if (pCorner.x > maxX) maxX = pCorner.x;
    if (pCorner.y < minY) minY = pCorner.y;
    if (pCorner.y > maxY) maxY = pCorner.y;
  }
  if (maxX < -1 || minX > 1 || maxY < -1 || minY > 1) return { visible: false, full: false, coverage: 0 };
  const pad = 4;
  const x0 = Math.max(0, Math.floor((minX * 0.5 + 0.5) * viewW) - pad);
  const x1 = Math.min(viewW, Math.ceil((maxX * 0.5 + 0.5) * viewW) + pad);
  const y0 = Math.max(0, Math.floor((minY * 0.5 + 0.5) * viewH) - pad);
  const y1 = Math.min(viewH, Math.ceil((maxY * 0.5 + 0.5) * viewH) + pad);
  const sw = x1 - x0, sh = y1 - y0;
  if (sw <= 0 || sh <= 0) return { visible: false, full: false, coverage: 0 };
  return { visible: true, full: false, x: x0, y: y0, w: sw, h: sh, coverage: (sw * sh) / Math.max(1, viewW * viewH) };
}

/**
 * Limits drawing to the portal's rectangle (sc from portalScissor), or lifts the limit (sc null or sc.full).
 * With the finishing pass the limit has to sit on postRT itself: a lit city draws its shadow map inside render(), and
 * when three goes back to the target after that it restores the TARGET's scissor, wiping one set on the renderer.
 */
function setPortalScissor(sc) {
  const on = !!sc && !sc.full;
  if (postRT) {
    if (on) postRT.scissor.set(Math.floor(sc.x * ratio), Math.floor(sc.y * ratio), Math.ceil(sc.w * ratio) + 1, Math.ceil(sc.h * ratio) + 1);
    postRT.scissorTest = on;
    renderer.setRenderTarget(postRT);   // three reads a target's scissor at the moment the target is bound
  } else {
    if (on) renderer.setScissor(sc.x, sc.y, sc.w, sc.h);
    renderer.setScissorTest(on);
  }
}

function draw() {
  cam.updateMatrixWorld();
  if (PERF) renderer.info.reset();   // with ?debug the counters cover the whole frame (see perfSource below)
  if (postRT) { postRT.scissorTest = false; renderer.setRenderTarget(postRT); }
  else renderer.setRenderTarget(null);
  renderer.setScissorTest(false); renderer.clear();
  const portal = cur.portal, open = next && openAmt > 0.001;
  portal.visible = !!open;
  if (open) {
    const s = easeOut(openAmt); portal.scale.setScalar(Math.max(s, 0.001)); portal.userData.sparks.rotation.z = cur.time * 0.5;
    const sc = portalScissor(portal, cam);
    if (sc.visible) {
      portalCam();
      next.world.follow(pcam, pcam.getWorldDirection(fwd));
      setPortalScissor(sc);
      renderer.clippingPlanes = [next.clip]; renderer.toneMappingExposure = next.world.exposure;
      renderer.render(next.world.scene, pcam);
      renderer.clippingPlanes = []; renderer.clearDepth();
      setPortalScissor(null);
    }
  }
  cur.world.follow(cam, cam.getWorldDirection(fwd));
  renderer.clippingPlanes = []; renderer.toneMappingExposure = cur.world.exposure;
  renderer.render(cur.world.scene, cam);
  if (postRT) {
    postUniforms.uExposure.value = cur.world.exposure;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.render(postScene, postCam);
  }
}

// ---------------------------------------------------------------- page furniture
let titleTimer = 0;
function arrived() {
  const m = cur.meta;
  $('t-zh').textContent = m.zh; $('t-en').textContent = m.en; $('t-line').textContent = `${m.where} · ${m.line}`;
  $('t-count').textContent = `${idxOf(m.id) + 1} / ${CITIES.length}`;
  const t = $('title'); t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  clearTimeout(titleTimer); titleTimer = setTimeout(() => t.classList.remove('on'), 6500);
  $('next').classList.remove('on'); document.title = `${m.zh} ${m.en} · 世界巡游`;
  if (!SHOT) history.replaceState(null, '', '#' + m.id);
  for (const b of document.querySelectorAll('#cities button')) b.classList.toggle('here', b.dataset.id === m.id);
  sound.retune(idxOf(m.id));
}
function showNextHint() { if (next) { $('next').textContent = `下一站 · ${next.meta.zh} ${next.meta.en}`; $('next').classList.add('on'); } }
function hurryNext() {
  if (switchingMode) return;   // the city under the veil is being rebuilt: no crossing until it stands
  setPaused(false);
  hurry = true;
  if (!next && !nextLoading) { clearTimeout(nextTimer); loadNext(0, true); }
}
function jumpTo(id) {
  if (!cur || id === cur.id || switchingMode) return;
  clearTimeout(nextTimer);
  setPaused(false);
  if (next && next.id === id) { hurry = true; showNextHint(); return; }
  if (next) { dispose(next); next = null; openAmt = 0; }
  if (nextAbort) { nextAbort.abort(); nextAbort = null; }
  nextLoading = null; queued = id; hurry = true;
  loadNext(0, true);
}
const sound = (() => {
  let ctx = null, master = null, voices = [], on = false, idx = 0;
  const SCALE = [0, 2, 4, 7, 9];
  function chord(i) { const root = 110 * Math.pow(2, SCALE[i % 5] / 12); return [root, root * 1.5, root * 2, root * 2 * Math.pow(2, SCALE[(i + 2) % 5] / 12), root * 3]; }
  function retune(i) {
    idx = i; if (!ctx) return;
    const now = ctx.currentTime;
    for (const v of voices) {
      v.g.gain.setTargetAtTime(0, now, 1.2);
      v.o.stop(now + 8); v.l.stop(now + 8);
      v.o.onended = () => { v.o.disconnect(); v.l.disconnect(); v.g.disconnect(); v.lg.disconnect(); };
    }
    voices = chord(i).map((f, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = k % 2 ? 'triangle' : 'sine'; o.frequency.value = f * (1 + (k - 2) * 0.0015); g.gain.value = 0;
      g.gain.setTargetAtTime(0.16 / (k + 1.5), now, 2.5); l.frequency.value = 0.05 + k * 0.031; lg.gain.value = 0.05 / (k + 1.5);
      l.connect(lg).connect(g.gain); o.connect(g).connect(master); o.start(); l.start(); return { o, g, l, lg };
    });
  }
  function toggle() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; master.connect(lp).connect(ctx.destination); retune(idx);
    }
    on = !on; ctx.resume(); master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.4); $('b-sound').classList.toggle('active', on);
  }
  return { toggle, retune };
})();
function setPaused(p) { paused = p; dirty = true; $('b-pause').classList.toggle('active', p); $('b-pause').textContent = p ? '▶' : '❚❚'; }
const modeLabel = (m) => (m === 'osm' ? '矢量精模' : '实景航拍');
/** Shows a short message where the "next stop" hint lives, then gives the place back to that hint. */
function flashHint(text, ms = 3500) {
  const el = $('next'); el.textContent = text; el.classList.add('on');
  setTimeout(() => { if (el.textContent !== text) return; if (next) showNextHint(); else el.classList.remove('on'); }, ms);
}
/** Vector mode could not be built (no access to the Cesium assets, or the network): the tour carries on with Google
 * tiles and stops asking for vector cities, until the user presses the mode button again. Not saved: next visit retries. */
function osmUnavailable() {
  if (renderMode !== 'osm') return;
  renderMode = 'google'; syncModeUI();
  flashHint('矢量精模暂时不可用，已改用实景航拍');
}
async function switchMode(target) {
  if (switchingMode || !cur || target === renderMode) return;
  if (target === 'osm' && !isIonProvider()) { flashHint('矢量精模需要 Cesium ion token（eyJ…）'); return; }
  switchingMode = true;   // hurryNext, jumpTo and loadNext all stand down until this is over
  clearTimeout(nextTimer);
  if (nextAbort) { nextAbort.abort(); nextAbort = null; }
  nextLoading = null;
  if (next) { dispose(next); next = null; }
  openAmt = 0; hurry = false;
  const oldCur = cur, keepT = Math.min(cur.t, 0.82);
  $('veil-sub').textContent = `正在切换到 ${modeLabel(target)} · ${oldCur.meta.zh}…`;
  $('veil').classList.remove('gone');
  $('next').classList.remove('on');
  try {
    const fresh = await prepare(oldCur.id, undefined, { urgent: true, mode: target, at: keepT });
    fresh.t = keepT; fresh.time = keepT * fresh.duration;
    fresh.askedNext = true;   // the rebuilt city gets the 10 s below to load before the next one competes with it
    cur = fresh;
    dispose(oldCur);
    // The mode, its button and the saved choice change only once the city really stands in the new mode:
    // prepare() falls back to Google tiles when a vector city cannot be built, and a failure leaves everything as it was.
    if (fresh.mode === target) {
      renderMode = target;
      try { localStorage.setItem(MODE_STORE, renderMode); } catch (e) { /* ignore */ }
    } else flashHint(`${modeLabel(target)}暂时不可用，仍为${modeLabel(renderMode)}`);
    syncModeUI();
    syncCameraFar(cur); syncTilePriorities();
    pose(cur, cur.t, cam.position, cam.quaternion);
    cam.position.y += liftAt(cur, cur.t, 0);   // resume already clear of the roofs, not rising to them
    cam.updateMatrixWorld();
    cur.world.update(cur.time, 0, cam, updateAheadCam(cur));
    lastCredits = ''; showCredits();
  } catch (e) {
    console.error('Failed to switch render mode:', e);
    flashHint(`切换失败，仍为${modeLabel(renderMode)}`);
  } finally {
    $('veil').classList.add('gone');
    switchingMode = false;
    dirty = true;
    // the next city was dropped above, so it must be asked for again whether the switch worked or not
    clearTimeout(nextTimer); nextTimer = setTimeout(loadNext, 10000);
  }
}

function wireUI() {
  const list = $('cities');
  CITIES.forEach((c, i) => { const b = document.createElement('button'); b.dataset.id = c.id; b.innerHTML = `<i>${i + 1}</i><b>${c.zh}</b><span>${c.en}</span>`; b.onclick = () => { jumpTo(c.id); $('menu').hidden = true; }; list.appendChild(b); });
  $('b-pause').onclick = () => setPaused(!paused);
  $('b-next').onclick = () => hurryNext();
  if ($('b-mode')) $('b-mode').onclick = () => switchMode(renderMode === 'osm' ? 'google' : 'osm');
  $('b-list').onclick = () => { $('menu').hidden = !$('menu').hidden; };
  $('b-sound').onclick = () => sound.toggle();
  $('b-full').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
  $('r-pace').oninput = (e) => { pace = Number(e.target.value); };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setPaused(!paused); } else if (k === 'arrowright') hurryNext();
    else if (k === 'm') $('b-mode')?.onclick();
    else if (k === 's') sound.toggle(); else if (k === 'f') $('b-full').onclick(); else if (k === 'i' || k === 'c') $('b-list').onclick(); else if (k === 'escape') $('menu').hidden = true;
  });
  let idle = 0; const wake = () => { document.body.classList.add('awake'); clearTimeout(idle); idle = setTimeout(() => { if ($('menu').hidden) document.body.classList.remove('awake'); }, 3200); };
  addEventListener('pointermove', wake); addEventListener('pointerdown', wake); wake();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); dirty = true; } });
}

// ---------------------------------------------------------------- start
let last = 0, avgMs = 16.7, lastScaleAt = 0, fastFrames = 0, creditTick = 0, lastCredits = '';
/** Google's terms ask for its name and the data providers to be on screen whenever its tiles are. */
function showCredits() {
  const el = $('credits');
  if (!cur?.tiles) { if (!el.hidden) { el.hidden = true; lastCredits = ''; } return; }
  const a = attributions(cur.tiles);
  const text = cur.mode === 'osm'
    ? 'Cesium · OpenStreetMap · Bing Maps' + (a ? ' · ' + a : '')
    : 'Google' + (a ? ' · ' + a : '');
  if (text !== lastCredits) { el.textContent = text; lastCredits = text; }
  if (el.hidden) el.hidden = false;
}
/** Shows the key box until a key that works is entered. The key stays in this browser only. */
function askKey() {
  return new Promise((done) => {
    const box = $('keybox'), input = $('key-input'), msg = $('key-msg'); box.hidden = false; $('veil-sub').textContent = '需要一个访问 token';
    $('key-form').onsubmit = async (e) => {
      e.preventDefault(); const k = input.value.trim(); if (!k) return;
      msg.textContent = '正在检查…';
      if (await keyWorks(k)) { setApiKey(k); box.hidden = true; done(); } else msg.textContent = '这个 token 不能用：Cesium ion 的请确认复制完整；Google key 请确认已开通 Map Tiles API，并允许当前网址使用。';
    };
    input.focus();
  });
}
function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden || !cur) { last = now; return; }
  const raw = Math.max(0, (now - last) / 1000); last = now; const dt = Math.min(raw, 0.1);
  if (!paused) {
    step(dt);
    if (PERF) perfTime('draw', draw); else draw();
    dirty = false;
    perfFrame(raw * 1000, now);
    // keep the flight smooth without sacrificing sharpness: only step pixel ratio down on sustained < 33 fps
    if (raw < 0.15) {
      avgMs = avgMs * 0.92 + raw * 1000 * 0.08;
      if (avgMs > 30 && ratio > 1 && now - lastScaleAt > 3000) {
        ratio = Math.max(1, Number((ratio * 0.85).toFixed(2)));
        lastScaleAt = now; fastFrames = 0; avgMs = 20; resize();
      } else if (avgMs < 16 && ratio < MAX_RATIO) {
        if (++fastFrames > 300 && now - lastScaleAt > 5000) {
          ratio = Math.min(MAX_RATIO, Number((ratio * 1.1).toFixed(2)));
          lastScaleAt = now; fastFrames = 0; resize();
        }
      } else fastFrames = Math.max(0, fastFrames - 2);
    }
  } else {
    // When paused, keep refining tiles until the paused view is 100% crisp, then stop redrawing to save GPU/battery
    const loading = tilesBusy(cur) || (next && openAmt > 0.001 && tilesBusy(next));
    if (loading || dirty) {
      syncTilePriorities();
      cur.world.update(cur.time, 0, cam);
      if (next && openAmt > 0.001) { portalCam(); next.world.update(next.time, 0, pcam); }
      if (dirty) { draw(); dirty = false; }
    }
  }
  if ((creditTick += raw) > 1) { creditTick = 0; showCredits(); }
}
// ?debug: what the readout in src/perf.js shows beside the timings, read from the engine once a second
if (PERF) {
  renderer.info.autoReset = false;   // draw() resets the counters itself, so they cover a whole frame and not its last pass
  perfSource(() => ({
    city: cur?.id, mode: cur?.mode, t: cur ? Math.round(cur.t * 100) / 100 : null, pace, hurry,
    next: next?.id ?? (nextLoading ? 'loading' : null),
    calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length,
    tiles: cur?.tiles ? { ...cur.tiles.stats } : null, cache: cacheInfo(),
    ratio, size: `${Math.round(viewW * ratio)}x${Math.round(viewH * ratio)}`, errorTarget: cur?.tiles?.errorTarget,
  }));
}
async function start() {
  wireUI();
  if (!SHOT && !(await keyWorks())) await askKey();
  renderMode = resolveInitialMode();
  syncModeUI();
  const want = Q.get('city') || location.hash.slice(1), first = CITIES.some((c) => c.id === want) ? want : CITIES[0].id;
  if (SHOT && Q.get('city') && first !== Q.get('city')) throw new Error(`city "${Q.get('city')}" is not in src/cities/index.js`);   // never shoot a stand-in
  $('veil-sub').textContent = `正在前往 ${CITIES[idxOf(first)].zh}…`;
  cur = await prepare(first, undefined, { urgent: true, mode: renderMode });
  syncCameraFar(cur); syncTilePriorities();
  pose(cur, 0, cam.position, cam.quaternion);
  $('veil').classList.add('gone'); arrived(); showCredits();
  if (SHOT) return shotMode();
  nextTimer = setTimeout(loadNext, 12000);
  last = performance.now(); requestAnimationFrame(loop);
}
// ?shot: no flight; tools/shot.mjs asks for single frames through window.__tour
async function shotMode() {
  document.body.classList.add('shot');
  const wantNext = Q.get('next'); if (wantNext !== 'none') { try { next = await prepare(wantNext || CITIES[(idxOf(cur.id) + 1) % CITIES.length].id); } catch (e) { next = null; } }
  let debugLine = null;
  window.__tour = {
    buildMs: cur.buildMs,
    async shot(t, overview) {
      cur.t = t; cur.time = t * cur.duration;
      openAmt = next ? THREE.MathUtils.clamp((t - 0.66) * cur.duration / 2.2, 0, 1) : 0;
      if (debugLine) debugLine.visible = !!overview;
      if (overview) {
        if (!debugLine) { debugLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(cur.curve.getSpacedPoints(300)), new THREE.LineBasicMaterial({ color: 0xff2040, fog: false, depthTest: false })); debugLine.renderOrder = 9999; cur.world.scene.add(debugLine); }
        const bb = new THREE.Box3().setFromPoints(cur.curve.getSpacedPoints(60)), c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length() * 0.5;
        const a = (typeof overview === 'number' ? overview : 0.6);
        cam.position.set(c.x + Math.sin(a) * r * 1.1, c.y + r * 1.0, c.z + Math.cos(a) * r * 1.1); cam.lookAt(c);
      } else pose(cur, t, cam.position, cam.quaternion);
      // a real city: wait for the tiles in view, lift clear of roofs as the flight would, and wait again
      let loaded = true, lift = 0;
      if (cur.settle) {
        loaded = await cur.settle(cam, 120000);
        if (!overview) { lift = liftAt(cur, t, 0); if (lift > 0.5) { cam.position.y += lift; loaded = await cur.settle(cam, 120000); } }
      }
      cur.world.update(cur.time, 0.016, cam);
      if (next && openAmt > 0.001) { portalCam(); if (next.settle) await next.settle(pcam, 120000); next.world.update(t * 5, 0.016, pcam); }
      renderer.info.autoReset = false; renderer.info.reset(); draw();
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, buildMs: cur.buildMs, pathLength: Math.round(cur.length), next: next?.id ?? null, loaded, lift: Math.round(lift), groundM: cur.measured?.groundM, mode: cur.mode, live: LIVE_LOOK };
    },
  };
}
start().catch((e) => { console.error(e); $('veil-sub').textContent = '出了点问题：' + (e.message || e); });
