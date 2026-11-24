// main.js: the engine. It flies the camera through one city, opens a portal at the end of the flight path,
// draws the next city live through that portal, and swaps the two at the moment the camera passes through.
import * as THREE from 'three';
import { setRenderer, glowMat } from './kit.js';
import { CITIES, loadCity } from './cities/index.js';
import { buildTilesCity, attributions, setApiKey, keyWorks } from './tiles.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search), SHOT = Q.has('shot');
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.autoClear = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
setRenderer(renderer);
const MAX_RATIO = Math.min(window.devicePixelRatio || 1, 2); let ratio = SHOT ? 1 : MAX_RATIO;
const cam = new THREE.PerspectiveCamera(60, 1, 1, 20000), pcam = cam.clone();
const warmRT = new THREE.WebGLRenderTarget(32, 32);
function resize() { const w = innerWidth, h = innerHeight; renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- a stage is one built city, ready to fly
const PORTAL_R = 16, UP = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
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
async function prepare(id) {
  const meta = CITIES.find((c) => c.id === id), t0 = performance.now();
  const city = await loadCity(id);
  // a real city streams Google 3D tiles; a built one comes from the kit (and stays as the fallback where there is no 3D coverage)
  const built = city.kind === 'tiles' ? await buildTilesCity(city, renderer, { timeout: SHOT ? 120000 : 30000 }) : city.build();
  const pts = built.path.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = 600;
  const P0 = curve.getPointAt(0), T0 = curve.getTangentAt(0).normalize(), P1 = curve.getPointAt(1), T1 = curve.getTangentAt(1).normalize();
  const portal = makePortal(); portal.applyMatrix4(frameAt(P1, T1)); built.world.scene.add(portal);
  const st = {
    id, meta, world: built.world, curve, focus: built.focus ?? [], duration: built.duration ?? 42, t: 0, time: 0, portal, length: curve.getLength(),
    entry: frameAt(P0, T0), exit: frameAt(P1, T1), exitInv: frameAt(P1, T1).invert(), clip: new THREE.Plane(T0.clone(), -T0.dot(P0) + 1),
    tiles: built.tiles, settle: built.settle, clear: built.clear, measured: built.measured, lift: 0,
    aheadCam: built.prefetch ? new THREE.PerspectiveCamera(60, cam.aspect, cam.near, cam.far) : null,
  };
  if (st.aheadCam) { pose(st, Math.min(1, 4 / st.duration), st.aheadCam.position, st.aheadCam.quaternion); built.prefetch(st.aheadCam); }
  // warm-up: compile the shaders and draw once into a tiny off-screen target, so nothing stalls when the portal opens
  const wcam = new THREE.PerspectiveCamera(60, cam.aspect, cam.near, cam.far);
  wcam.position.copy(P0); wcam.quaternion.setFromRotationMatrix(st.entry); wcam.updateMatrixWorld();
  if (st.settle) await st.settle(wcam);   // the view through the portal is loaded before the portal may open
  st.world.follow(wcam, T0);
  try { await renderer.compileAsync(st.world.scene, wcam); } catch (e) { /* older browsers: compile on first draw */ }
  renderer.setRenderTarget(warmRT); renderer.render(st.world.scene, wcam); renderer.setRenderTarget(null);
  st.buildMs = Math.round(performance.now() - t0);
  return st;
}

function dispose(st) { st.tiles?.dispose(); st.world.dispose(); }

// ---------------------------------------------------------------- the flight
let cur = null, next = null, nextLoading = null, queued = null, paused = false, hurry = false, pace = 1, openAmt = 0;
const idxOf = (id) => CITIES.findIndex((c) => c.id === id);
function loadNext(tries = 0) {
  if (nextLoading || next || tries >= CITIES.length) return;
  const id = queued ?? CITIES[(idxOf(cur.id) + 1 + tries) % CITIES.length].id; queued = null;
  if (id === cur.id) return loadNext(tries + 1);
  const job = nextLoading = prepare(id).then((st) => { if (nextLoading === job) { next = st; nextLoading = null; showNextHint(); } else dispose(st); })
    .catch((e) => { console.warn(`city "${id}" could not be built:`, e); if (nextLoading === job) { nextLoading = null; loadNext(tries + 1); } });
}
/** Where the camera wants to be and look at flight position u (0..1). Writes pos into `outPos`, the look rotation into `outQ`. */
function pose(st, u, outPos, outQ) {
  st.curve.getPointAt(u, outPos);
  const ahead = Math.min(1, u + 30 / st.length);
  v2.copy(st.curve.getPointAt(ahead, v3)).sub(outPos);
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
function step(dt) {
  const st = cur; st.time += dt; st.world.update(st.time, dt, cam);
  // the next city only needs updating while it is seen; before that its tiles stay as loaded for the entry
  if (next && openAmt > 0) { next.time += dt; next.world.update(next.time, dt, pcam); }
  // the portal opens late in the flight, once the next city is ready; the flight waits in front of it if it is not
  const wantOpen = next && st.t > 0.66;
  openAmt = THREE.MathUtils.clamp(openAmt + (wantOpen ? dt / 2.2 : -dt * 2), 0, 1);
  let speed = (hurry ? 7 : 1) * pace / st.duration;
  if (!next || openAmt < 1) speed *= 1 - THREE.MathUtils.smoothstep(st.t, 0.84, 0.93);
  st.t += speed * dt;
  if (st.t >= 1 && next && openAmt >= 1) return cross();
  st.t = Math.min(st.t, 1);
  pose(st, st.t, cam.position, q1);
  cam.quaternion.slerp(q1, 1 - Math.exp(-dt * 2.4));
  cam.position.y += liftAt(st, st.t, dt);
  // in a real city a second camera rides about four seconds ahead, so the tiles there load before the flight arrives
  if (st.aheadCam) { st.aheadCam.aspect = cam.aspect; st.aheadCam.updateProjectionMatrix(); pose(st, Math.min(1, st.t + 4 * pace / st.duration), st.aheadCam.position, st.aheadCam.quaternion); }
}
const ahead = new THREE.Vector3();
/** In a real city: how far to lift the camera above the authored path to keep it clear of real roofs. It fades out
 * before the portal, so the camera always passes through the ring. dt 0 means jump straight to the answer. */
function liftAt(st, u, dt) {
  if (!st.clear) return 0;
  st.curve.getPointAt(Math.min(1, u + 60 / st.length), ahead);
  const want = st.clear(cam.position, ahead, 28, dt ? 4 : 1) * (1 - THREE.MathUtils.smoothstep(u, 0.86, 0.95));
  st.lift = dt ? st.lift + (want - st.lift) * (1 - Math.exp(-dt * 1.6)) : want;
  return st.lift;
}
function cross() {
  // carry the camera's exact place relative to the portal into the next city, so there is no cut
  cam.updateMatrixWorld(); m2.copy(next.entry).multiply(cur.exitInv).multiply(cam.matrixWorld);
  m2.decompose(cam.position, cam.quaternion, v1);
  const old = cur; cur = next; next = null; openAmt = 0; hurry = false; cur.t = 0; cur.lift = 0;
  setTimeout(() => dispose(old), 50);
  arrived(); setTimeout(loadNext, 1200);
}
const fwd = new THREE.Vector3();
/** The portal camera: where the main camera would be if the portal's ring were the next city's entry. */
function portalCam() {
  pcam.projectionMatrix.copy(cam.projectionMatrix); pcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  pcam.aspect = cam.aspect; pcam.near = cam.near; pcam.far = cam.far;
  cam.updateMatrixWorld(); m2.copy(next.entry).multiply(cur.exitInv).multiply(cam.matrixWorld); m2.decompose(pcam.position, pcam.quaternion, v1); pcam.updateMatrixWorld();
}
function draw() {
  cam.updateMatrixWorld(); renderer.clear();
  const portal = cur.portal, open = next && openAmt > 0.001;
  portal.visible = !!open;
  if (open) {
    const s = easeOut(openAmt); portal.scale.setScalar(Math.max(s, 0.001)); portal.userData.sparks.rotation.z = cur.time * 0.5;
    portalCam();
    next.world.follow(pcam, pcam.getWorldDirection(fwd));
    renderer.clippingPlanes = [next.clip]; renderer.toneMappingExposure = next.world.exposure;
    renderer.render(next.world.scene, pcam);
    renderer.clippingPlanes = []; renderer.clearDepth();
  }
  cur.world.follow(cam, cam.getWorldDirection(fwd));
  renderer.toneMappingExposure = cur.world.exposure;
  renderer.render(cur.world.scene, cam);
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
function jumpTo(id) {
  if (!cur || id === cur.id) return;
  if (next && next.id === id) { hurry = true; return; }
  if (next) { dispose(next); next = null; openAmt = 0; }
  nextLoading = null; queued = id; hurry = true; $('next').classList.remove('on'); loadNext();
}
const sound = (() => {
  let ctx = null, master = null, voices = [], on = false, idx = 0;
  const SCALE = [0, 2, 4, 7, 9];
  function chord(i) { const root = 110 * Math.pow(2, SCALE[i % 5] / 12); return [root, root * 1.5, root * 2, root * 2 * Math.pow(2, SCALE[(i + 2) % 5] / 12), root * 3]; }
  function retune(i) {
    idx = i; if (!ctx) return;
    const now = ctx.currentTime; for (const v of voices) { v.g.gain.setTargetAtTime(0, now, 1.2); v.o.stop(now + 8); }
    voices = chord(i).map((f, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = k % 2 ? 'triangle' : 'sine'; o.frequency.value = f * (1 + (k - 2) * 0.0015); g.gain.value = 0;
      g.gain.setTargetAtTime(0.16 / (k + 1.5), now, 2.5); l.frequency.value = 0.05 + k * 0.031; lg.gain.value = 0.05 / (k + 1.5);
      l.connect(lg).connect(g.gain); o.connect(g).connect(master); o.start(); l.start(); return { o, g };
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
function setPaused(p) { paused = p; $('b-pause').classList.toggle('active', p); $('b-pause').textContent = p ? '▶' : '❚❚'; }
function wireUI() {
  const list = $('cities');
  CITIES.forEach((c, i) => { const b = document.createElement('button'); b.dataset.id = c.id; b.innerHTML = `<i>${i + 1}</i><b>${c.zh}</b><span>${c.en}</span>`; b.onclick = () => { jumpTo(c.id); $('menu').hidden = true; }; list.appendChild(b); });
  $('b-pause').onclick = () => setPaused(!paused);
  $('b-next').onclick = () => { hurry = true; };
  $('b-list').onclick = () => { $('menu').hidden = !$('menu').hidden; };
  $('b-sound').onclick = () => sound.toggle();
  $('b-full').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
  $('r-pace').oninput = (e) => { pace = Number(e.target.value); };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setPaused(!paused); } else if (k === 'arrowright') hurry = true;
    else if (k === 's') sound.toggle(); else if (k === 'f') $('b-full').onclick(); else if (k === 'i' || k === 'c') $('b-list').onclick(); else if (k === 'escape') $('menu').hidden = true;
  });
  let idle = 0; const wake = () => { document.body.classList.add('awake'); clearTimeout(idle); idle = setTimeout(() => { if ($('menu').hidden) document.body.classList.remove('awake'); }, 3200); };
  addEventListener('pointermove', wake); addEventListener('pointerdown', wake); wake();
}

// ---------------------------------------------------------------- start
let last = 0, slow = 0, fast = 0, creditTick = 0;
/** Google's terms ask for its name and the data providers to be on screen whenever its tiles are. */
function showCredits() {
  const el = $('credits'); if (!cur?.tiles) { el.hidden = true; return; }
  const a = attributions(cur.tiles); el.textContent = 'Google' + (a ? ' · ' + a : ''); el.hidden = false;
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
  const raw = Math.max(0, (now - last) / 1000); last = now; const dt = Math.min(raw, 0.1);
  if (!cur) return;
  if (!paused) step(dt);
  draw();
  if ((creditTick += raw) > 1) { creditTick = 0; showCredits(); }
  // keep the flight smooth: lower the drawing resolution when frames run long, raise it again when there is room
  if (raw > 0.03) { slow++; fast = 0; } else if (raw < 0.014) { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 50 && ratio > 0.6) { ratio = Math.max(0.6, ratio * 0.85); slow = 0; resize(); if (ratio <= 0.75) renderer.shadowMap.enabled = false; }
  if (fast > 600 && ratio < MAX_RATIO) { ratio = Math.min(MAX_RATIO, ratio * 1.1); fast = 0; resize(); }
}
async function start() {
  wireUI();
  if (!SHOT && !(await keyWorks())) await askKey();
  const want = Q.get('city') || location.hash.slice(1), first = CITIES.some((c) => c.id === want) ? want : CITIES[0].id;
  if (SHOT && Q.get('city') && first !== Q.get('city')) throw new Error(`city "${Q.get('city')}" is not in src/cities/index.js`);   // never shoot a stand-in
  $('veil-sub').textContent = `正在前往 ${CITIES[idxOf(first)].zh}…`;
  cur = await prepare(first);
  pose(cur, 0, cam.position, cam.quaternion);
  $('veil').classList.add('gone'); arrived(); showCredits();
  if (SHOT) return shotMode();
  loadNext(); last = performance.now(); requestAnimationFrame(loop);
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
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, buildMs: cur.buildMs, pathLength: Math.round(cur.length), next: next?.id ?? null, loaded, lift: Math.round(lift), groundM: cur.measured?.groundM };
    },
  };
}
start().catch((e) => { console.error(e); $('veil-sub').textContent = '出了点问题：' + (e.message || e); });
