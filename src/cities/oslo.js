// Oslo on a clear winter evening: in over the fjord's islands, low up the white sloping roof of the Opera House, along the Barcode towers and round the leaning
// Munch museum, back past the Opera's glowing front to Akershus Fortress and the City Hall, then up over the snowy town toward Holmenkollen and a faint aurora.
import { THREE, mergeGeometries, createWorld, rng, mat, glowMat, facadeMat, mesh, box, cyl, sphere, tube, beam, instances, buildings, cityGrid, terrain, water, trees, lights, fbm, smooth, lerp } from '../kit.js';

// merges meshes that share a material into one mesh each
function bake(list, at = [0, 0, 0], ry = 0) {
  const by = new Map();
  for (const o of list.flat()) {
    o.updateMatrix(); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry).applyMatrix4(o.matrix);
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g);
  }
  return [...by].map(([m, gs]) => mesh(mergeGeometries(gs), m, ...at, { ry }));
}
const G = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const gable = (w, h, d) => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
// makes a material keep only what lies above (side = 1) or below (side = -1) the sea level y = 0
function keepSide(material, side) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWy = (modelMatrix * vec4(position, 1.0)).y;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (vWy * ${side}.0 < 0.0) discard;`);
  };
  material.customProgramCacheKey = () => 'side' + side; return material;
}
// the northern lights: long hanging ribbons, drawn additively. Rays shimmer along them, the folds drift, green below and violet at the fringe.
const AURORA_VERT = `attribute vec3 aInfo; uniform float uT; varying vec2 vUv; varying vec3 vInfo;
void main(){ vUv = uv; vInfo = aInfo; vec3 p = position;
  float w = sin(uv.x * 38.0 + uT * 0.17 + aInfo.y * 9.0) * 190.0 + sin(uv.x * 93.0 - uT * 0.29 + aInfo.y * 4.0) * 75.0 + sin(uv.x * 150.0 + uT * 0.5) * 26.0;
  p += normal * w * (1.0 + 0.3 * uv.y); p.y += sin(uv.x * 61.0 + uT * 0.13 + aInfo.y * 5.0) * 50.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const AURORA_FRAG = `uniform float uT, uPower; varying vec2 vUv; varying vec3 vInfo;
float hash(float n){ return fract(sin(n) * 43758.5453); }
float noise(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
void main(){
  float x = vUv.x * 14.0 + vInfo.y * 31.0, y = vUv.y;
  float rays = 0.5 * noise(x * 2.3 + uT * 0.22) + 0.3 * noise(x * 7.1 - uT * 0.5) + 0.2 * noise(x * 23.0 + uT * 1.1);
  float swell = smoothstep(0.15, 0.75, noise(x * 0.33 + uT * 0.06 + 5.0));
  float top = 0.3 + 0.7 * rays;
  float body = smoothstep(0.0, 0.03, y) * pow(max(1.0 - y / top, 0.0), 1.25);
  vec3 c = mix(vec3(0.1, 1.0, 0.42), vec3(0.8, 0.3, 1.0) * 1.9, smoothstep(0.14, 0.72, y / top));
  c = mix(c, vec3(1.0, 0.4, 0.65), smoothstep(0.045, 0.0, y) * 0.55);
  float a = body * (0.25 + 0.75 * rays * rays * 1.6) * (0.25 + 0.75 * swell) * smoothstep(0.0, 0.1, vInfo.x) * smoothstep(1.0, 0.9, vInfo.x) * vInfo.z;
  gl_FragColor = vec4(c * a * uPower, 1.0);   // added straight onto the picture: no tone mapping, so faint parts stay faint
}`;
function auroraGeometry(bands) {
  const pos = [], nor = [], uv = [], info = [], idx = []; let base = 0;
  bands.forEach(([pts, height, power], b) => {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), N = 420, len = c.getLength(), p = new THREE.Vector3(), t = new THREE.Vector3();
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

// a solid with a top that slopes up from (zLow, yLow) to (zHigh, yHigh) and then runs level back to zBack: the Opera's walk-on roof
function wedge(x0, x1, zLow, yLow, zHigh, yHigh, zBack) {
  const s = new THREE.Shape([[-zLow, -3], [-zLow, yLow], [-zHigh, yHigh], [-zBack, yHigh], [-zBack, -3]].map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false }).rotateY(Math.PI / 2).translate(x0, 0, 0);
}

export default {
  build() {
    const r = rng(1048);
    const world = createWorld({
      sky: { top: 0x0a1638, horizon: 0x40609a, bottom: 0x1c2f52, haze: 0.5 },
      sun: { dir: [-0.82, 0.16, 0.5], color: 0xb4c2f0, power: 1.3, disc: 0x7a4a2a, size: 0.0009 },
      ambient: { sky: 0x8fa8e0, ground: 0x505a78, power: 2.0 },
      fog: { color: 0x243a62, density: 0.00022 }, stars: 1200, exposure: 1.3, env: 0.8,
    });
    // north is -Z; the fjord lies to +Z. The Opera stands at the origin, on the water.
    const CH = [-940, -70], AK = [-480, 70], MU = [240, 10], HK = [-1500, -2500];
    const path = [[-110, 30, 900], [-110, 22, 620], [-150, 14, 390], [-60, 12, 232], [105, 15, 140], [118, 27, 50], [100, 43, -45], [160, 52, -135], [330, 55, -50], [300, 42, 120], [0, 24, 250], [-420, 40, 215], [-790, 48, 120], [-852, 62, -120], [-925, 112, -430]];
    const focus = [[0.09, 0, 16, 10], [0.27, 0, 18, 0], [0.35, 0, 34, -42], [0.41, 0, 40, -240], [0.47, MU[0], 40, MU[1]], [0.56, 0, 12, 20], [0.61, 0, 14, 10], [0.68, AK[0], 26, AK[1]], [0.75, AK[0], 28, AK[1]], [0.8, CH[0], 45, CH[1]]];

    // ---- land and fjord: the flat snowy town, the rock of Akershus, islands, the forested hills behind
    const isles = [[-420, 640, 150, 14], [230, 720, 120, 10], [-800, 900, 180, 16], [650, 1050, 160, 12], [100, 1380, 140, 10], [-1300, 600, 200, 18], [1200, 500, 220, 16]];
    const shoreZ = (x) => 34 + 150 * Math.exp(-(((x - AK[0]) / 120) ** 2)) - 75 * Math.exp(-(((x + 900) / 170) ** 2)) + 70 * smooth(-1150, -1400, x) + 40 * smooth(500, 900, x);
    const land = (x, z) => {
      let h = lerp(2.2, -8, smooth(-7, 7, z - shoreZ(x)));
      h += 20 * smooth(150, 40, Math.hypot(x - AK[0], (z - AK[1] - 20) * 0.9)) * smooth(40, 0, z - shoreZ(x) + 30);
      const north = Math.max(0, -700 - z); h += north * 0.1 + smooth(0, 500, north) * 70 * (fbm(x / 400, z / 400, 3) - 0.3) + 150 * Math.exp(-((x - HK[0]) ** 2 + (z - HK[1]) ** 2) / 400000);
      for (const [cx, cz, R, H] of isles) { const d = Math.hypot(x - cx, z - cz) / (R * (0.7 + 0.6 * fbm(x / 70 + cx, z / 70, 2))); if (d < 1.1) h = Math.max(h, H * (1 - d ** 2.2)); }
      return h;
    };
    const C = (v) => new THREE.Color(v), tmp = new THREE.Color(), cSnow = C(0xe4ebf6), cBlue = C(0xc2d0e6), cWood = C(0x34443f), cRock = C(0x5a5f6a);
    const ground = terrain({ size: 8000, center: [0, -600], seg: 230, height: land, color: (x, y, z, slope) => {
      const n = fbm(x / 60, z / 60, 3); tmp.copy(cSnow).lerp(cBlue, n);
      if (y > 30 || Math.hypot(x, z) > 1100 && y > 4) tmp.lerp(cWood, smooth(0.42, 0.6, n) * 0.85);
      return tmp.lerp(cRock, smooth(0.2, 0.45, slope));
    } }); keepSide(ground.material, 1); world.add(ground);
    const mirror = new THREE.Group(); mirror.scale.y = -1; world.add(mirror);
    const both = (...ms) => { world.add(...ms.flat()); for (const m of ms.flat()) mirror.add(m.clone()); };
    const sea = water(world, 0, { size: 9000, z: 1500, color: 0x0e1e36, rough: 0.1, metal: 0.55, ripple: 50, strength: 0.3, env: 1.6 }); sea.material.transparent = true; sea.material.opacity = 0.72;

    // ---- a faint aurora low in the north
    const auroraMat = new THREE.ShaderMaterial({ vertexShader: AURORA_VERT, fragmentShader: AURORA_FRAG, uniforms: { uT: { value: 0 }, uPower: { value: 0.45 } }, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const aurora = new THREE.Mesh(auroraGeometry([[[[-6000, 900, -5200], [-2500, 1000, -6800], [500, 1050, -7300], [3500, 1000, -6600], [6500, 900, -5000]], 1000, 1], [[[-5000, 1500, -4200], [-1500, 1700, -5600], [2500, 1650, -5400], [5500, 1500, -3800]], 900, 0.6]]), auroraMat);
    aurora.frustumCulled = false; world.add(aurora); world.onUpdate((t) => { auroraMat.uniforms.uT.value = t; });

    // ---- the Opera House: white marble sloping out of the fjord, the glowing glass foyer, the fly tower
    const marble = mat(0xf6f5f1, { rough: 0.55, emissive: 0xa8b8dc, glow: 0.32 }), alu = mat(0xd4d8de, { rough: 0.4, metal: 0.4 }), oak = glowMat(0xe2a258, 1.5), dark = mat(0x1a2028, { rough: 0.3, metal: 0.5 });
    const foyer = facadeMat({ color: 0x8090a0, floor: 15, bay: 3.2, frame: [0.03, 0.02], glass: 0x6a4a2a, lit: 1, litColor: 0xffc070, night: 2.4, rough: 0.2, metal: 0.4 });
    const side = (x0, x1) => { const g = wedge(x0, x1, 64, -1.5, -22, 16.5, -58), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) > 100 && p.getZ(i) > 0) p.setX(i, p.getX(i) * 1.22); g.computeVertexNormals(); return mesh(g, marble); };   // outer edges splay toward the water
    const tower = facadeMat({ color: 0xeef2f8, floor: 4.5, bay: 2.2, frame: [0.06, 0.05], glass: 0x9fb4d0, lit: 0.22, litColor: 0xffd9a0, night: 1.5, rough: 0.35, metal: 0.4 });
    const op = [side(-104, -44), side(44, 104), mesh(wedge(-44, 44, 66, -1.5, 27, 1.6, 26), marble), box(88, 15, 30, foyer, 0, 1.5, 11), box(70, 11, 6, oak, 0, 2, 4), box(90, 1.2, 86, marble, 0, 16.5, -15),
      box(46, 27, 36, tower, 0, 17.5, -34), box(47, 0.6, 37, marble, 0, 44.5, -34), box(60, 7, 46, tower, 0, 17.5, -32), box(30, 2.4, 0.4, oak, 0, 30, -15.9), box(209, 6, 3, marble, 0, 0, -58), box(30, 4, 14, alu, 60, 16.5, -30), box(2, 15, 30, marble, -44.5, 1.5, 11), box(2, 15, 30, marble, 44.5, 1.5, 11)];
    for (let i = 0; i < 17; i++) op.push(box(0.4, 15, 0.8, marble, -40 + i * 5, 1.5, 26.2));
    op.push(box(92, 1.2, 4, marble, 0, 16.5, 28), box(88, 0.5, 0.9, marble, 0, 9, 26.2));
    const opera = bake(op); opera.forEach((m) => m.scale.setScalar(1.25)); both(...opera);
    world.add(box(430, 0.4, 112, mat(0x3c4454), 0, 2.2, -22, { cast: false }));                                             // swept dark paving, so the white roof stands out from the snow
    const walkers = []; for (let i = 0; i < 170; i++) { const s = r.chance(0.5) ? -1 : 1, x = s * r.range(48, 100), z = r.range(-50, 55); walkers.push({ x: x * 1.25, y: 1.25 * (z > -22 ? lerp(16.5, -1.5, (z + 22) / 86) : 16.5), z: z * 1.25, sx: 0.7, sy: 1.8, sz: 0.6, color: r.pick([0x1a2030, 0x7a2222, 0x1f3a5a, 0x2a2a2a, 0xb8862a]) }); }
    world.add(instances(G(1, 1, 1, 0, 0.5, 0), mat(0xffffff), walkers.filter((w) => w.y > 0.3)));

    // ---- Barcode: a row of slim towers, no two alike, across the tracks behind the Opera
    const bars = [[-300, 22, 54, 0, 0xe9e6de], [-268, 16, 66, 1, 0x30363e], [-240, 24, 48, 2, 0x8a5a44], [-208, 18, 74, 0, 0xf2f2f0], [-176, 26, 58, 3, 0xb8c2cc], [-140, 20, 70, 1, 0x20262c], [-106, 28, 52, 0, 0xd9d2c4], [-70, 18, 78, 3, 0x9ab0c4], [-38, 22, 62, 2, 0x6a4636], [-2, 30, 56, 1, 0x3a4048], [36, 18, 72, 0, 0xf0ede6], [70, 26, 60, 3, 0xa9b8c8], [106, 20, 80, 1, 0x282e36], [140, 28, 50, 2, 0x94604a], [176, 18, 68, 0, 0xe4e0d6], [210, 24, 58, 3, 0x8ea6bc]];
    const barMats = [facadeMat({ floor: 3.6, bay: 2.4, frame: [0.34, 0.2], glass: 0x141c26, lit: 0.55, litColor: 0xffd9a0, night: 1.7, rough: 0.7 }), facadeMat({ floor: 3.6, bay: 1.5, frame: [0.12, 0.1], glass: 0x1a2634, lit: 0.6, litColor: 0xfff0d0, night: 1.6, rough: 0.3, metal: 0.4 }),
      facadeMat({ floor: 3.6, bay: 3.6, frame: [0.22, 0.3], glass: 0x141a22, lit: 0.5, litColor: 0xffc880, night: 1.8, rough: 0.9 }), facadeMat({ floor: 7.2, bay: 4.8, frame: [0.05, 0.05], glass: 0x223a54, lit: 0.7, litColor: 0xe8f0ff, night: 1.3, rough: 0.25, metal: 0.5 })];
    const barSets = barMats.map(() => []), caps = [];
    for (const [x, w, h, m, color] of bars) { barSets[m].push({ x, z: -220, w, d: 62, h, color }); if (h > 60) barSets[m].push({ x, z: -238, y: h, w: w * 0.8, d: 20, h: 5, color }); caps.push({ x, z: -220, y: h, w: w + 0.4, d: 62.4, h: 0.6 }); }
    both(...barSets.map((s, i) => buildings(s, barMats[i])), buildings(caps, marble, { cast: false }));
    const rails = [box(1500, 0.5, 60, mat(0x3a3f48), 150, 2, -140, { cast: false })]; for (let i = 0; i < 7; i++) rails.push(box(1500, 0.2, 0.5, alu, 150, 2.5, -164 + i * 8, { cast: false }));
    world.add(...bake(rails));
    const train = box(150, 3.6, 3, facadeMat({ color: 0xc8402e, floor: 3.6, bay: 2.5, frame: [0.1, 0.3], glass: 0x20262c, lit: 1, litColor: 0xfff0c8, night: 2, rough: 0.5 }), 0, 2.7, -132); world.add(train);
    world.onUpdate((t) => { train.position.x = 700 - ((t * 22) % 1500); });

    // ---- the Munch museum: a grey tower whose top leans out toward the fjord
    const lam = facadeMat({ color: 0xaab2bc, floor: 4.4, bay: 30, frame: [0.01, 0.36], glass: 0x55606e, lit: 0.5, litColor: 0xffe0b0, night: 1.2, rough: 0.35, metal: 0.6 });
    const lean = new THREE.BoxGeometry(26, 24, 40).translate(0, 12, 0), lp = lean.attributes.position; for (let i = 0; i < lp.count; i++) lp.setZ(i, lp.getZ(i) + lp.getY(i) * 0.42); lean.computeVertexNormals();
    both(...bake([box(26, 36, 40, lam, 0, 0, 0), mesh(lean, lam, 0, 36, 0), box(60, 9, 50, lam, 22, 0, -4), box(26.4, 0.5, 40.4, marble, 0, 60, 10)], [MU[0], 2, MU[1]]));

    // ---- City Hall: two blunt brick towers over the harbour, a clock on the eastern one
    const brick = facadeMat({ color: 0x7c4a36, floor: 4.2, bay: 3.4, frame: [0.36, 0.3], glass: 0x1a1612, lit: 0.45, litColor: 0xffc070, night: 1.8, rough: 0.9, ground: 5 }), brickP = mat(0x7c4a36), clockM = glowMat(0xfff2c8, 1.3);
    const ch = [box(100, 30, 36, brick, 0, 0, 14), box(60, 18, 26, brick, 0, 0, 44), box(101, 0.8, 37, marble, 0, 30, 14)];
    for (const [s, h] of [[-1, 63], [1, 66]]) ch.push(box(26, h, 24, brick, s * 37, 0, -8), box(27, 3, 25, brickP, s * 37, h, -8), box(27.4, 0.7, 25.4, marble, s * 37, h + 3, -8), box(20, 4, 18, brickP, s * 37, h + 3, -8));
    ch.push(mesh(new THREE.CircleGeometry(4.6, 24), clockM, 37, 50, 4.2), box(0.5, 3.6, 0.2, dark, 37, 50, 4.4, { rz: 0.6 }), box(0.5, 2.6, 0.2, dark, 37, 50, 4.4, { rz: -1.9 }), box(140, 0.6, 50, mat(0xcfd6e0), 0, 0, 80, { cast: false }));
    both(...bake(ch, [CH[0], 2.2, CH[1]]));

    // ---- Akershus Fortress on its rock: grey ramparts, the old castle with copper-green spires, floodlit
    const rampart = mat(0x8d877c, { flat: true }), wallW = facadeMat({ color: 0xd8cfbc, floor: 4.5, bay: 4, frame: [0.38, 0.34], glass: 0x1a1612, lit: 0.6, litColor: 0xffc070, night: 1.8, rough: 0.9 }), copper = mat(0x5a9a84, { rough: 0.6 }), snowM = mat(0xe8eef8, { rough: 0.85 }), ak = [], top = land(...AK);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, b = (i + 1) / 14 * 6.283, q = (t) => [Math.cos(t) * 95 * (1 + 0.16 * Math.sin(t * 3)), Math.sin(t) * 66 * (1 + 0.16 * Math.cos(t * 2))], [x0, z0] = q(a), [x1, z1] = q(b); ak.push(box(Math.hypot(x1 - x0, z1 - z0) + 2, 13, 4, rampart, (x0 + x1) / 2, -9, (z0 + z1) / 2, { ry: -Math.atan2(z1 - z0, x1 - x0) })); }
    ak.push(box(62, 14, 16, wallW, -6, 0, -6), mesh(gable(16, 9, 62).rotateY(Math.PI / 2), snowM, -6, 14, -6), box(16, 12, 44, wallW, 26, 0, 10), mesh(gable(16, 8, 44), snowM, 26, 12, 10), box(11, 30, 11, wallW, -34, 0, 0), cyl(0, 8, 20, copper, -34, 30, 0, 4), box(9, 24, 9, wallW, 26, 0, -14), cyl(0, 6.6, 16, copper, 26, 24, -14, 4), cyl(7, 7, 12, rampart, 60, -2, 30, 10), cyl(0, 7.6, 7, snowM, 60, 10, 30, 10));
    both(...bake(ak, [AK[0], top, AK[1] + 6]));

    // ---- Holmenkollen: the ski jump high on the hill, blazing with floodlights
    const hy = land(HK[0], HK[1]), jumpGlow = glowMat(0xf4f8ff, 1.6, { fog: false }), inrun = Array.from({ length: 12 }, (_, i) => { const u = i / 11; return [0, 150 * (1 - u) ** 1.7 + 12, -160 + u * 190]; });
    const jump = [tube(inrun, 7, jumpGlow, { seg: 30, radial: 5 }), beam([0, 150, -150], [0, 0, -60], 8, alu), beam([0, 90, -105], [0, 0, -120], 6, alu), mesh(new THREE.PlaneGeometry(60, 260).rotateX(-Math.PI / 2 + 0.5), glowMat(0xdfe8f6, 1.1, { fog: false, side: THREE.DoubleSide }), 0, -52, 150), box(70, 12, 30, alu, 0, 150, -172)];
    world.add(...bake(jump, [HK[0], hy, HK[1]], -0.25));
    lights(world, Array.from({ length: 16 }, (_, i) => [HK[0] + r.range(-60, 60), hy + 20 + i * 9, HK[1] + r.range(-120, 160)]), { color: 0xeaf2ff, size: 60, power: 1.4 });

    // ---- the town: plain blocks with lit windows and snow on the roofs, street lamps, a quay-side row
    const tones = [0xc9b48c, 0x9a9388, 0xb0705a, 0xd8ccb4, 0x8c7a6a, 0xa8a49c, 0xc4985a, 0x7f8894], far2 = (x, z, px, pz, d) => Math.hypot(x - px, z - pz) > d;
    const town = cityGrid({ rand: r, area: [-2300, -1500, 2100, -10], block: 52, street: 16, jitter: 0.3, split: 0.4, palette: tones,
      keep: (x, z) => z < shoreZ(x) - 45 && !(x > -360 && x < 900 && z > -290 && z < 80) && far2(x, z, CH[0], CH[1] + 20, 105) && far2(x, z, AK[0], AK[1], 150) && far2(x, z, -852, -120, 60) && far2(x, z, -960, -430, 70) && far2(x, z, -900, -280, 60),
      height: (x, z) => r.range(15, 26) + 22 * Math.exp(-((x - 300) ** 2 + (z + 400) ** 2) / 90000) * r() });
    town.forEach((b) => { b.y = land(b.x, b.z) - 1.5; b.h += 1.5; });
    const townF = facadeMat({ floor: 3.5, bay: 2.8, frame: [0.3, 0.26], glass: 0x141a22, lit: 0.5, litColor: 0xffc880, night: 1.9, rough: 0.9, ground: 0.5 });
    both(buildings(town.filter((b) => b.z > -260), townF)); world.add(buildings(town.filter((b) => b.z <= -260), townF), buildings(town.map((b) => ({ x: b.x, z: b.z, y: b.y + b.h, w: b.w + 0.6, d: b.d + 0.6, h: 0.7 })), snowM, { cast: false }));
    const lamps = []; for (let x = -2200; x < 2100; x += 68) for (let z = -1480; z < 0; z += 34) if (z < shoreZ(x) - 20) lamps.push([x + 34, land(x + 34, z) + 6, z]);
    const quay = []; for (let x = -1300; x < 900; x += 22) quay.push([x, 5.5, shoreZ(x) - 9]);
    lights(world, lamps, { color: [0xffb45a, 0xffc470, 0xffd9a0], size: 7, power: 1.2 }); lights(world, quay, { color: 0xffc470, size: 5, power: 1.2 });
    const glints = lights(world, [...quay, ...lamps.filter((p) => p[2] > -200)], { color: 0xffc470, size: 8, power: 0.7 }); glints.renderOrder = -1; mirror.add(glints);

    // ---- ferries crossing the fjord, snowy firs on the islands and hills
    const ferryF = facadeMat({ color: 0xf0f0ec, floor: 2.8, bay: 2.2, frame: [0.2, 0.3], glass: 0x20262c, lit: 0.9, litColor: 0xfff0c8, night: 2, rough: 0.5 });
    const ferries = [[[-900, 300], [500, 1250]], [[700, 420], [-600, 1100]], [[-1300, 1300], [900, 800]]].map(([a, b], i) => {
      const g = new THREE.Group(); g.add(...bake([box(44, 3, 11, mat(0x1c2a44), 0, -1, 0), box(34, 6, 9.6, ferryF, -2, 2, 0), box(12, 3, 7, ferryF, 6, 8, 0), cyl(1.2, 1.4, 4, mat(0xc8402e), -8, 8, 0, 8)])); both(g); return { g, m: mirror.children[mirror.children.length - 1], a, b, i };
    });
    world.onUpdate((t) => { for (const f of ferries) { const u = (t * 0.006 + f.i * 0.37) % 1; for (const o of [f.g, f.m]) { o.position.set(lerp(f.a[0], f.b[0], u), 0.3, lerp(f.a[1], f.b[1], u)); o.rotation.y = Math.atan2(-(f.b[1] - f.a[1]), f.b[0] - f.a[0]); } } });
    const firs = []; for (let i = 0; i < 9000 && firs.length < 420; i++) { const x = r.range(-2200, 1700), z = r.range(-2700, 1500), y = land(x, z); if ((z > 300 ? y > 2.5 : (y > 26 || far2(x, z, AK[0], AK[1], 60) === false && y > 8)) && fbm(x / 60, z / 60, 3) > 0.42 && far2(x, z, HK[0], HK[1], 190)) firs.push([x, y - 0.3, z]); }
    trees(world, firs, 'conifer', { size: 13, color: [0x2a4a40, 0x7f9aa6, 0x3f5f58, 0xa9c0cc] }).children.forEach((m) => { m.castShadow = false; });

    return { world, path, focus, duration: 46 };
  },
};
