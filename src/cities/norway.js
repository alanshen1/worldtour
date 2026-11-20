// Lofoten in the polar night: in from the open sea under the northern lights, low past the red rorbu cabins on their stilts, through the harbour,
// by the fish-drying racks and the stave church on its knoll, then up the fjord between granite peaks with the aurora burning overhead.
import { THREE, mergeGeometries, createWorld, rng, mat, glowMat, facadeMat, mesh, box, cyl, sphere, prism, instances, terrain, water, lights, noise2, fbm, smooth, clamp, lerp } from '../kit.js';

// merges meshes that share a material into one mesh each
function bake(list, at = [0, 0, 0], ry = 0) {
  const by = new Map();
  for (const o of list.flat()) {
    o.updateMatrix(); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry).applyMatrix4(o.matrix);
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g);
  }
  return [...by].map(([m, gs]) => mesh(mergeGeometries(gs), m, ...at, { ry }));
}
// merges plain geometries into one, each tinted with its own colour (for a vertexColors material)
function fuse(parts) {
  return mergeGeometries(parts.map(([g, c]) => {
    g = g.index ? g.toNonIndexed() : g; const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) k.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  }));
}
const G = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const gable = (w, h, d) => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
// two roof planes over a gable of width 1, rise 1, depth 1 (scale it per building): the snow lying on a roof
const roofG = () => { const L = Math.hypot(0.5, 1) * 1.14, a = Math.atan2(1, 0.5); return mergeGeometries([1, -1].map((s) => new THREE.BoxGeometry(L, 0.1, 1.1).rotateZ(s * a).translate(-s * 0.27, 0.53, 0))); };
// a polyline on the map; line.near(x, z) gives the distance to it and sets line.t (0..1 along its length)
function line(pts) {
  const segs = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az, len = Math.hypot(dx, dz); segs.push([ax, az, dx, dz, len, total]); total += len; }
  const L = { t: 0, near(x, z) {
    let best = Infinity;
    for (const [ax, az, dx, dz, len, l0] of segs) { const u = clamp(((x - ax) * dx + (z - az) * dz) / (len * len)), d = Math.hypot(x - ax - dx * u, z - az - dz * u); if (d < best) { best = d; L.t = (l0 + u * len) / total; } }
    return best;
  } };
  return L;
}
// makes a material keep only what lies above (side = 1) or below (side = -1) the sea level y = 0
function keepSide(material, side) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWy = (modelMatrix * vec4(position, 1.0)).y;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (vWy * ${side}.0 < 0.0) discard;`);
  };
  material.customProgramCacheKey = () => 'side' + side; return material;
}
// a small repeating grain texture, so snow and rock have some close-up texture
function grain(seed) {
  const N = 256, r = rng(seed), d = new Uint8Array(N * N * 4), f = new Float32Array(N * N);
  for (const [cells, amp] of [[6, 0.42], [14, 0.26], [32, 0.18], [72, 0.14]]) {
    const g = Float32Array.from({ length: cells * cells }, () => r());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * cells, fy = y / N * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      f[y * N + x] += amp * lerp(lerp(g[y0 * cells + x0], g[y0 * cells + x1], su), lerp(g[y1 * cells + x0], g[y1 * cells + x1], su), sv);
    }
  }
  for (let i = 0; i < N * N; i++) { const v = 180 + 68 * clamp(f[i] * 2 - 0.5) + r.range(-6, 6); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// the northern lights: long hanging ribbons, drawn additively. Rays shimmer along them, the folds drift, green below and violet at the fringe.
const AURORA_VERT = `attribute vec3 aInfo; uniform float uT; varying vec2 vUv; varying vec3 vInfo;
void main(){ vUv = uv; vInfo = aInfo; vec3 p = position;
  float w = sin(uv.x * 7.0 + uT * 0.17 + aInfo.y * 9.0) * 95.0 + sin(uv.x * 19.0 - uT * 0.29 + aInfo.y * 4.0) * 38.0 + sin(uv.x * 47.0 + uT * 0.5) * 12.0;
  p += normal * w * (1.0 + 0.35 * uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const AURORA_FRAG = `uniform float uT, uPower; varying vec2 vUv; varying vec3 vInfo;
float hash(float n){ return fract(sin(n) * 43758.5453); }
float noise(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
void main(){
  float x = vUv.x * 14.0 + vInfo.y * 31.0, y = vUv.y;
  float rays = 0.5 * noise(x * 2.3 + uT * 0.22) + 0.3 * noise(x * 7.1 - uT * 0.5) + 0.2 * noise(x * 23.0 + uT * 1.1);
  float swell = smoothstep(0.15, 0.75, noise(x * 0.33 + uT * 0.06 + 5.0));
  float top = 0.3 + 0.7 * rays;
  float body = smoothstep(0.0, 0.035, y) * pow(max(1.0 - y / top, 0.0), 1.6);
  vec3 c = mix(vec3(0.12, 1.0, 0.42), vec3(0.5, 0.22, 1.0), smoothstep(0.18, 0.8, y / top));
  c = mix(c, vec3(0.75, 1.0, 0.7), smoothstep(0.1, 0.0, y) * 0.6);
  float a = body * (0.25 + 0.75 * rays * rays * 1.6) * (0.25 + 0.75 * swell) * smoothstep(0.0, 0.1, vInfo.x) * smoothstep(1.0, 0.9, vInfo.x) * vInfo.z;
  gl_FragColor = vec4(c * a * uPower, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function auroraGeometry(bands) {
  const pos = [], nor = [], uv = [], info = [], idx = []; let base = 0;
  bands.forEach(([pts, height, power], b) => {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), N = 220, len = c.getLength(), p = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      c.getPointAt(i / N, p); c.getTangentAt(i / N, t); const nl = Math.hypot(t.x, t.z) || 1;
      for (const v of [0, 1]) { pos.push(p.x, p.y + v * height, p.z); nor.push(-t.z / nl, 0, t.x / nl); uv.push(i / N * len / 6000, v); info.push(i / N, b * 0.37 + 0.1, power); }
      if (i) idx.push(base + i * 2 - 2, base + i * 2 - 1, base + i * 2, base + i * 2 - 1, base + i * 2 + 1, base + i * 2);
    }
    base += (N + 1) * 2;
  });
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  for (const [name, arr, n] of [['position', pos, 3], ['normal', nor, 3], ['uv', uv, 2], ['aInfo', info, 3]]) g.setAttribute(name, new THREE.Float32BufferAttribute(arr, n));
  return g;
}

export default {
  build() {
    const r = rng(68), moonDir = [-0.55, 0.36, -0.75];
    const world = createWorld({
      sky: { top: 0x040a1c, horizon: 0x163450, bottom: 0x0d2236, haze: 0.5 },
      sun: { dir: moonDir, color: 0xbfd4ff, power: 1.5, disc: 0xe9f0ff, size: 0.0011 },
      ambient: { sky: 0x7fb0c4, ground: 0x3c4a5e, power: 1.5 },
      fog: { color: 0x0f2034, density: 0.00016 }, stars: 2600, exposure: 1.3, env: 0.7,
    });
    // north is -Z. The village sits on islets at the mouth of a fjord that runs north between the peaks.
    const path = [[560, 34, 1400], [430, 24, 1050], [300, 16, 700], [275, 14, 340], [150, 15, 200], [95, 15, 30], [-40, 20, -40], [-130, 22, -150], [-75, 36, -340], [-100, 50, -650], [-110, 62, -1000], [40, 85, -1400], [110, 120, -1800], [100, 150, -2150]];
    const focus = [[0.1, 0, 900, -4500], [0.2, 170, 8, 330], [0.29, 170, 6, 330], [0.36, -20, 8, 110], [0.43, -230, 8, -80], [0.5, -10, 26, -360], [0.56, -10, 30, -360], [0.64, 0, 700, -3200], [0.76, 200, 800, -3600]];
    const flight = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)), false, 'centripetal').getSpacedPoints(320);

    // ---- the land: granite horns standing in the sea, the fjord cut between them, low islets for the village
    const fjord = line([[60, 250], [-60, -300], [-120, -900], [120, -1500], [100, -2300], [300, -3300]]);
    const peaks = [[-620, -520, 680, 520, 4, 0.3], [-700, -1250, 780, 600, 3, 1.1], [-560, -2050, 850, 640, 4, 2], [560, -420, 560, 480, 3, 0.2], [720, -1150, 760, 600, 4, 0.9], [660, -1950, 820, 620, 3, 2.4], [200, -3700, 1000, 900, 4, 0.5], [-900, -3000, 800, 700, 3, 1.7],
      [1100, -2900, 780, 700, 4, 2.6], [-1500, -300, 600, 560, 3, 0.4], [1500, -500, 620, 560, 4, 1.2], [-1700, -1500, 700, 640, 4, 2.2], [1800, -1700, 700, 640, 3, 0.1], [-2700, -900, 650, 700, 3, 1], [2800, -1300, 680, 700, 4, 2], [-2500, -2700, 760, 800, 4, 0.7], [2600, -3000, 760, 800, 3, 1.5], [-3600, 300, 520, 600, 3, 2], [3700, -200, 560, 650, 4, 0.2]];
    const islets = [[170, 330, 75, 6], [-20, 110, 95, 7], [-210, -90, 105, 6.5], [-10, -360, 92, 19], [400, 560, 34, 5], [-330, 250, 26, 3], [20, 520, 20, 2.5], [330, 60, 24, 3], [-150, 330, 16, 2]];
    const ridge = (x, z) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { const v = 1 - Math.abs(2 * noise2(x * f + i * 17.3, z * f - i * 9.1) - 1); s += a * v * v; a *= 0.5; f *= 2.1; } return s / 0.94; };
    const horn = (x, z, [cx, cz, H, R, k, ph]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); return d > R * 1.4 ? 0 : H * Math.pow(Math.max(0, 1 - d / (R * (1 + 0.36 * Math.cos(k * Math.atan2(dz, dx) + ph)))), 1.15); };
    const raw = (x, z) => {
      const wx = x + 70 * (fbm(x / 300, z / 300, 2) - 0.5), wz = z + 70 * (fbm(x / 300 + 9, z / 300, 2) - 0.5);
      let sum = 0; for (const p of peaks) sum += horn(wx, wz, p);
      let m = sum > 0 ? sum * (0.62 + 0.62 * ridge(wx / 270, wz / 270)) + 70 * ridge(wx / 640, wz / 640) * smooth(0, 160, sum) - 14 : -30;
      const fs = fjord.near(x, z) - lerp(270, 185, smooth(0.04, 0.3, fjord.t));
      if (fs < 450) m = smin(m, fs < 0 ? -Math.min(40, -fs * 0.7) : 2.6 * fs ** 0.97 * (0.6 + 0.4 * fbm(x / 190, z / 190, 3) + 0.5 * ridge(x / 280, z / 280)), 24);
      for (const [cx, cz, R, H] of islets) { const d = Math.hypot(x - cx, z - cz) / R; if (d < 1.15) m = Math.max(m, H * (1 - d ** 2.6) + 1.6 * (fbm(x / 22, z / 22, 2) - 0.5)); }
      return Math.max(m, -30);
    };
    const inner = [0, -1350], size = [3400, 5700], NX = 220, NZ = Math.round(NX * size[1] / size[0]), X0 = inner[0] - size[0] / 2, Z0 = inner[1] - size[1] / 2, grid = new Float32Array((NX + 1) * (NZ + 1));
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {   // heights on the terrain's own grid, with a clear corridor carved along the flight
      const x = X0 + i * size[0] / NX, z = Z0 + j * size[1] / NZ; let cap = Infinity;
      for (const p of flight) { const dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz; if (d2 < 40000) { const c = p.y - 15 + 2 * Math.max(0, Math.sqrt(d2) - 22); if (c < cap) cap = c; } }
      grid[j * (NX + 1) + i] = Math.min(raw(x, z), cap);
    }
    const land = (x, z) => {
      const fx = (x - X0) / size[0] * NX, fz = (z - Z0) / size[1] * NZ; if (fx < 0 || fz < 0 || fx >= NX || fz >= NZ) return raw(x, z);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * (NX + 1) + i;
      return lerp(lerp(grid[k], grid[k + 1], u), lerp(grid[k + NX + 1], grid[k + NX + 2], u), v);
    };
    const C = (h) => new THREE.Color(h), tmp = new THREE.Color(), cSnow = C(0xe9f1fb), cSnowB = C(0xc6d6ea), cRock = C(0x50545e), cRockD = C(0x33363e), cWet = C(0x23272e);
    const tint = (x, y, z, slope) => {
      const n = fbm(x / 40, z / 40, 3), n3 = noise2(x / 17, z / 17);
      tmp.copy(cSnow).lerp(cSnowB, smooth(0.35, 0.75, n)).lerp(n3 > 0.5 ? cRock : cRockD, smooth(0.26, 0.5, slope + (n - 0.5) * 0.22));
      return y < 2 ? tmp.lerp(cWet, smooth(2, 0.6, y)) : tmp;
    };
    const ground = terrain({ size, center: inner, seg: NX, height: land, color: tint, rough: 0.9 }); keepSide(ground.material, 1);
    const tex = grain(5); tex.repeat.set(size[0] / 60, size[1] / 60); ground.material.map = tex; ground.material.color.setScalar(1.25);
    const inside = (x, z) => Math.min(size[0] / 2 - Math.abs(x - inner[0]), size[1] / 2 - Math.abs(z - inner[1]));
    const far = terrain({ size: 17000, center: inner, seg: 136, height: (x, z) => land(x, z) - 2500 * smooth(0, 260, inside(x, z)), color: tint }); keepSide(far.material, 1);
    world.add(ground, far);

    // ---- the sea, with everything mirrored in it: upside-down copies under see-through water (land lit once, cabins, lamps, the aurora)
    const mirror = new THREE.Group(); mirror.scale.y = -1; world.add(mirror);
    const refl = terrain({ size, center: inner, seg: 130, height: land, color: tint }), rc = refl.geometry.attributes.color, rn = refl.geometry.attributes.normal, moon = new THREE.Vector3(...moonDir).normalize();
    for (let i = 0; i < rc.count; i++) { const l = 0.42 * Math.max(0, rn.getX(i) * moon.x + rn.getY(i) * moon.y + rn.getZ(i) * moon.z); rc.setXYZ(i, rc.getX(i) * (0.2 + l * 0.8), rc.getY(i) * (0.27 + l * 0.9), rc.getZ(i) * (0.36 + l)); }
    refl.material = keepSide(new THREE.MeshBasicMaterial({ vertexColors: true }), -1); refl.receiveShadow = false; mirror.add(refl);
    const sea = water(world, 0, { size: 16000, color: 0x0a1a2c, rough: 0.1, metal: 0.55, ripple: 55, strength: 0.32, env: 1.7 }); sea.material.transparent = true; sea.material.opacity = 0.6;

    // ---- the aurora (and its reflection)
    const auroraMat = new THREE.ShaderMaterial({ vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, uniforms: { uT: { value: 0 }, uPower: { value: 1.5 } }, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const aurora = new THREE.Mesh(auroraGeometry([
      [[[-5200, 1000, -3600], [-2500, 1150, -5200], [0, 1200, -5900], [2500, 1150, -5200], [5200, 1000, -3400]], 1150, 1],
      [[[-4400, 1300, -1300], [-1800, 1500, -3300], [300, 1560, -4100], [2600, 1500, -3200], [4600, 1300, -1000]], 1400, 0.9],
      [[[3300, 900, 2000], [2300, 1000, 300], [1700, 1100, -1400], [1500, 1150, -3200], [2300, 1100, -5200]], 950, 0.8],
      [[[-2700, 1000, 1400], [-2000, 1100, -600], [-1700, 1200, -2400], [-2400, 1150, -4400]], 850, 0.6],
    ]), auroraMat);
    aurora.frustumCulled = false; const aurora2 = aurora.clone(); aurora2.renderOrder = -1; world.add(aurora); mirror.add(aurora2);
    world.onUpdate((t) => { auroraMat.uniforms.uT.value = t; });

    // ---- rorbu cabins on stilts round the islets: red boards, snow on the roofs, warm windows
    const cabinWall = facadeMat({ floor: 3.4, bay: 2.3, frame: [0.3, 0.3], glass: 0x120e0a, lit: 0.8, litColor: 0xffb45a, night: 2.4, rough: 0.9, ground: 0.3 });
    const reds = [0xa3261c, 0x8f1f18, 0xb53324, 0x9a2a1e, 0xa3261c, 0xc9962e], walls = [], gables = [], snow = [], posts = [], decks = [], lamps = [];
    const cabin = (x, z, dir, w, d, h, color, y) => {
      const ry = Math.atan2(Math.cos(dir), Math.sin(dir)), cx = Math.cos(dir), cz = Math.sin(dir);
      walls.push({ x, y, z, w, d, h, ry, color }); gables.push({ x, y: y + h, z, sx: w, sy: w * 0.42, sz: d, ry, color }); snow.push({ x, y: y + h, z, sx: w, sy: w * 0.42, sz: d, ry });
      lamps.push([x + cx * (d / 2 + 0.6), y + 2.6, z + cz * (d / 2 + 0.6)]);
      return [cx, cz];
    };
    for (const [ix, iz, R, , n, a0, a1] of [[170, 330, 75, 6, 15, -0.4, 4.6], [-20, 110, 95, 7, 15, -1.2, 2.6], [-210, -90, 105, 6.5, 7, -1.0, 0.9], [-10, -360, 92, 19, 6, 0.7, 2.6]]) for (let i = 0; i < n; i++) {
      const a = lerp(a0, a1, (i + r.range(0.2, 0.8)) / n), w = r.range(6, 7.6), d = r.range(8.5, 11), x = ix + Math.cos(a) * R * 0.95, z = iz + Math.sin(a) * R * 0.95;
      const [cx, cz] = cabin(x, z, a, w, d, r.range(3.3, 4), r.pick(reds), 2.3);
      decks.push({ x: x + cx * 1.4, y: 1.95, z: z + cz * 1.4, w: w + 2.4, d: d + 3.4, h: 0.35, ry: Math.atan2(cx, cz) });
      for (const u of [-1, 1]) for (const v of [-1, 0, 1]) posts.push({ x: x + cx * (v * d * 0.45 + 1.4) - cz * u * w * 0.48, y: -2, z: z + cz * (v * d * 0.45 + 1.4) + cx * u * w * 0.48, w: 0.4, d: 0.4, h: 4 });
    }
    const houseTones = [0xe8e2d4, 0xd8b04a, 0xa3261c, 0xf0ece2, 0x7f8f9a, 0xc9962e];
    for (const [ix, iz, R, , n] of [[170, 330, 44, 6, 5], [-20, 110, 60, 7, 8], [-210, -90, 50, 6.5, 3]]) for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + r.range(-0.3, 0.3), q = R * r.range(0.25, 1), x = ix + Math.cos(a) * q, z = iz + Math.sin(a) * q;
      if (ix === -210 && x < -215) continue;
      cabin(x, z, a + r.range(-0.4, 0.4), r.range(7.5, 9.5), r.range(10, 13), r.range(5.4, 6.6), r.pick(houseTones), land(x, z) - 0.5);
    }
    const unit = G(1, 1, 1, 0, 0.5, 0), asBox = (b) => ({ x: b.x, y: b.y, z: b.z, sx: b.w, sy: b.h, sz: b.d, ry: b.ry, color: b.color });
    const wood = mat(0x3b2d22), snowMat = mat(0xe6eef8, { rough: 0.85 }), village = [instances(unit, cabinWall, walls.map(asBox)), instances(gable(1, 1, 1), mat(0xffffff, { rough: 0.9 }), gables), instances(roofG(), snowMat, snow)];
    world.add(...village, instances(unit, wood, posts.map(asBox)), instances(unit, wood, decks.map(asBox)));
    for (const m of village) mirror.add(m.clone());

    // ---- fish-drying racks (hjell): rows of A-frames hung with stockfish, on the flat islet
    const rackParts = [], slant = Math.atan2(3.4, 7.4), tan = 0xb39a6c, pole = 0x6e5a44;
    for (let x = -14; x <= 14; x += 4) for (const s of [-1, 1]) rackParts.push([new THREE.BoxGeometry(0.28, 8.2, 0.28).rotateX(-s * slant).translate(x, 3.7, s * 1.7), pole]);
    rackParts.push([G(29, 0.3, 0.3, 0, 7.4, 0), pole], [G(29.4, 0.35, 0.9, 0, 7.7, 0), 0xe6eef8]);
    for (const s of [-1, 1]) for (const [y, off] of [[2.2, 2.4], [3.8, 1.66], [5.4, 0.92]]) rackParts.push([G(29, 0.2, 0.2, 0, y, s * off), pole], [G(28, 1.1, 0.14, 0, y - 0.7, s * off), tan]);
    const racks = []; for (let i = 0; i < 9; i++) racks.push({ x: -262 + (i % 3) * 36 + r.range(-2, 2), z: -128 + Math.floor(i / 3) * 16, ry: 0.25 + r.range(-0.04, 0.04) });
    racks.forEach((k) => { k.y = land(k.x, k.z) - 0.3; });
    world.add(instances(fuse(rackParts), mat(0xffffff, { vertexColors: true, rough: 0.95 }), racks));

    // ---- the harbour: fishing boats at the quay with their mast lights, two more under way, a lighthouse on the outer skerry
    const hullG = prism([[-5.5, -1.7], [2.6, -1.7], [6, 0], [2.6, 1.7], [-5.5, 1.7]], 1.9, null).geometry.translate(0, -0.5, 0), topG = fuse([[G(2.6, 2.3, 2.5, -2.6, 2.55, 0), 0xf2f0ea], [G(2.8, 0.2, 2.8, -2.6, 3.8, 0), 0xe6eef8], [G(11.6, 0.2, 3.5, 0, 1.4, 0), 0x8a7a66],
      [new THREE.CylinderGeometry(0.09, 0.12, 7, 5).translate(-0.6, 5, 0), 0x3b2d22], [G(3.6, 0.1, 0.1, 1.2, 5.4, 0), 0x3b2d22], [G(1.4, 0.9, 1.6, 2.6, 1.9, 0), 0xd9722a]]);
    const hullTones = [0xf0ede4, 0xb5281f, 0x2f6aa0, 0xf0ede4, 0x1f7a5c, 0xe0a52a], moored = [], mastLights = [];
    for (let i = 0; i < 11; i++) { const a = i < 7 ? -0.75 + i * 0.26 : 3.5 + (i - 7) * 0.3, [ix, iz, R] = i < 7 ? [-20, 110, 113] : [170, 330, 92]; moored.push({ x: ix + Math.cos(a) * R, y: 0.1, z: iz + Math.sin(a) * R, ry: -a + 1.57 + r.range(-0.2, 0.2), color: r.pick(hullTones) }); }
    moored.forEach((b) => mastLights.push([b.x - 0.6 * Math.cos(b.ry), 8.8, b.z + 0.6 * Math.sin(b.ry)], [b.x - 2.6 * Math.cos(b.ry), 3.1, b.z + 2.6 * Math.sin(b.ry)]));
    world.add(instances(hullG, mat(0xffffff, { rough: 0.6 }), moored), instances(topG, mat(0xffffff, { vertexColors: true, rough: 0.7 }), moored));
    const sailing = [[[-420, 620], [330, 900]], [[420, -720], [-300, -1250]]].map(([a, b], i) => {
      const g = new THREE.Group(); g.add(mesh(hullG, mat(hullTones[i + 1], { rough: 0.6 })), mesh(topG, mat(0xffffff, { vertexColors: true, rough: 0.7 })));
      g.add(lights(world, [[-0.6, 8.8, 0], [-2.6, 3.1, 0], [5.6, 2, 0]], { color: [0xfff2c8, 0xffb45a, 0x7dff9a], size: 5, power: 1.6 })); world.add(g); return { g, a, b };
    });
    world.onUpdate((t) => { sailing.forEach(({ g, a, b }, i) => { const u = (t * 0.008 + i * 0.4) % 1; g.position.set(lerp(a[0], b[0], u), 0.1 + Math.sin(t * 1.3 + i) * 0.12, lerp(a[1], b[1], u)); g.rotation.set(Math.sin(t * 0.9 + i) * 0.03, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), 0); }); });
    const white = mat(0xf2f0ea), lh = [400, land(400, 560), 560];
    world.add(...bake([cyl(2.2, 3, 12, white, 0, 0, 0, 12), cyl(2.65, 2.75, 2.4, mat(0xb5281f), 0, 5, 0, 12), cyl(2.8, 2.8, 0.4, wood, 0, 12, 0, 12), cyl(1.5, 1.5, 2.2, glowMat(0xfff0b0, 2.2, { toneMapped: false }), 0, 12.4, 0, 8), cyl(0, 2, 1.6, mat(0xb5281f), 0, 14.6, 0, 8), box(5, 3.4, 6, white, 5, 0, 0)], lh));
    const beam = new THREE.Group(); for (const s of [0, Math.PI]) beam.add(mesh(new THREE.ConeGeometry(16, 260, 12, 1, true).rotateZ(Math.PI / 2).translate(130, 0, 0), glowMat(0xfff2c0, 1, { additive: true, opacity: 0.07, side: THREE.DoubleSide, fog: false }), 0, 0, 0, { ry: s, cast: false, receive: false }));
    beam.position.set(lh[0], lh[1] + 13.5, lh[2]); world.add(beam); world.onUpdate((t) => { beam.rotation.y = t * 0.5; });

    // ---- the stave church on its knoll: tarred timber, tier upon tier of steep snowy roofs, dragon heads on the gables
    const tar = mat(0x2a1c14), tarL = mat(0x3d2a1c), glow = glowMat(0xffb45a, 1.6), sv = [], roof = roofG();
    const tier = (w, d, wallH, y, rise, z = 0) => { sv.push(box(w, wallH, d, tar, 0, y, z), mesh(gable(w, rise, d), tarL, 0, y + wallH, z), mesh(roof.clone().scale(w * 1.12, rise * 1.05, d * 1.04), snowMat, 0, y + wallH, z)); return y + wallH; };
    sv.push(box(17, 4, 25, tar, 0, 0, 0), mesh(roof.clone().scale(19, 3.2, 26), snowMat, 0, 4, 0), box(19.4, 0.5, 26.4, tarL, 0, 3.8, 0));       // the low gallery round the nave
    let y = tier(11, 19, 9, 0, 9.5); sv.push(box(2.6, 1.8, 0.3, glow, 0, 5.4, 9.6), box(2.6, 1.8, 0.3, glow, 0, 5.4, -9.6));
    y = tier(6.4, 10, 4.2, y + 5.4, 6); y = tier(3.4, 3.4, 3.2, y + 3.6, 0.01);
    sv.push(cyl(0, 2.9, 9, snowMat, 0, y, 0, 4), cyl(0.06, 0.12, 4, tar, 0, y + 8.6, 0, 5), box(7, 7, 6, tar, 0, 0, 14.6), mesh(gable(7, 6, 6), tarL, 0, 7, 14.6), mesh(roof.clone().scale(7.9, 6.3, 6.4), snowMat, 0, 7, 14.6), box(2.2, 3.6, 0.3, glow, 0, 0.4, 17.7));
    sv.push(cyl(4.4, 4.4, 7, tar, 0, 0, -12.8, 10), cyl(0, 5.1, 6, snowMat, 0, 7, -12.8, 10), cyl(1.3, 1.3, 2.4, tar, 0, 12, -12.8, 8), cyl(0, 1.7, 4, snowMat, 0, 14.4, -12.8, 8));
    for (const [gy, gz] of [[18.6, 9.6], [18.6, -9.6], [29.6, 5.1], [29.6, -5.1], [13.1, 17.7]]) { const s = Math.sign(gz); sv.push(mesh(G(0.3, 0.3, 3, 0, 0, 1.3), tar, 0, gy, gz, { rx: -s * 0.75, ry: s > 0 ? 0 : Math.PI }), mesh(G(0.34, 0.9, 0.5, 0, 0.3, 2.9), tar, 0, gy, gz, { rx: -s * 0.75, ry: s > 0 ? 0 : Math.PI })); }
    const SC = [-10, land(-10, -360) - 0.4, -360];
    world.add(...bake(sv, SC, 0.5)); lamps.push([SC[0] + 12, SC[1] + 3, SC[2] + 20], [SC[0] - 16, SC[1] + 3, SC[2] + 6]);

    // ---- lamplight: at every door and along the quays, each with its reflection
    for (let i = 0; i < 26; i++) { const [ix, iz, R] = i < 13 ? [-20, 110, 78] : [170, 330, 58], a = i * 0.483; lamps.push([ix + Math.cos(a) * R, land(ix + Math.cos(a) * R, iz + Math.sin(a) * R) + 5, iz + Math.sin(a) * R]); }
    lights(world, lamps, { color: [0xffb45a, 0xffc470, 0xffa040], size: 9, power: 1.5 });
    lights(world, mastLights, { color: [0xfff2c8, 0xffb45a], size: 5, power: 1.6 });
    const glints = lights(world, [...lamps, ...mastLights].map(([x, y2, z]) => [x, y2, z]), { color: 0xffb45a, size: 8, power: 0.8 }); glints.renderOrder = -1; mirror.add(glints);

    return { world, path, focus, duration: 50 };
  },
};
