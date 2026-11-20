// Sydney at midday: in from the harbour to the Opera House sails, into Circular Quay, up round Sydney Tower,
// back down over the Quay and out under the great steel arch of the Harbour Bridge.
import { THREE, mergeGeometries, createWorld, rng, mat, facadeMat, mesh, box, cyl, dome, lathe, prism, beam, instances, buildings, cityGrid, water, trees, clouds, clearance } from '../kit.js';

const G = 3;   // quay level above the water
/** Merges static meshes that share a material into one draw call each (transforms are baked in). */
function bake(...objs) {
  const root = new THREE.Group(), by = new Map(), out = new THREE.Group(); root.add(...objs.flat()); root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k in g.attributes) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m.matrixWorld); if (!by.has(m.material)) by.set(m.material, []); by.get(m.material).push(g);
  });
  for (const [material, gs] of by) out.add(mesh(mergeGeometries(gs), material));
  return out;
}
/** Many copies of one shape that move: at(i, t) -> [x, y, z, ry]. */
function fleet(world, geo, material, n, at, colors) {
  const im = instances(geo, material, Array.from({ length: n }, (_, i) => ({ y: -50, color: colors?.[i % colors.length] }))), d = new THREE.Object3D();
  world.onUpdate((t) => { for (let i = 0; i < n; i++) { const [x, y, z, ry] = at(i, t); d.position.set(x, y, z); d.rotation.y = ry; d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; });
  world.add(im); return im;
}
/** A unit pitched roof: 1 wide (x), 1 high, 1 long (z), ridge along z. */
function gableGeo() {
  const a = [-0.5, 0, 0.5], b = [0.5, 0, 0.5], c = [0, 1, 0.5], d = [-0.5, 0, -0.5], e = [0.5, 0, -0.5], f = [0, 1, -0.5], g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, e, d, f, a, c, f, a, f, d, b, e, f, b, f, c].flat(), 3)); g.computeVertexNormals(); return g;
}
const inside = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
/** A point on a circular arc of radius R from A to B that bulges towards `out`. */
function arc(A, B, u, out, R) {
  const c = B.clone().sub(A), L = c.length(); c.normalize(); R = Math.max(R, L * 0.56);
  const n = out.clone().addScaledVector(c, -out.dot(c)).normalize(), h = (x) => Math.sqrt(R * R - x * x);
  return A.clone().lerp(B, u).addScaledVector(n, h(L * (u - 0.5)) - h(L / 2));
}
/**
 * One sail of the Opera House, built the way the real ones are: ribs fan out from a foot on each side of the hall and meet along a shared ridge,
 * every rib an arc of the same 75 m sphere radius. Returns [shell, glass wall]. zFoot/zPeak/zTail run along the hall, the mouth opens towards the peak.
 */
function sail(zFoot, w, zPeak, H, zTail, hTail) {
  const NU = 14, NV = 10, pos = [], idx = [], gp = [], gi = [], P = new THREE.Vector3(0, H, zPeak), T = new THREE.Vector3(0, hTail, zTail), up = new THREE.Vector3(0, 1, 0), dir = Math.sign(zPeak - zFoot);
  for (const s of [-1, 1]) {
    const F = new THREE.Vector3(s * w, 0, zFoot), out = new THREE.Vector3(s, 0.3, 0), base = pos.length / 3;
    for (let v = 0; v <= NV; v++) { const K = arc(P, T, v / NV, up, 95); for (let u = 0; u <= NU; u++) { const p = arc(F, K, u / NU, out, 75); pos.push(p.x, p.y, p.z); if (v === 0) gp.push(p.x * 0.93, p.y * 0.93, p.z - dir * 3.5); } }
    for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const a = base + v * (NU + 1) + u, b = a + NU + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  for (let u = 0; u < NU; u++) gi.push(u, NU + 1 + u, u + 1, u + 1, NU + 1 + u, NU + 2 + u);
  const mk = (p, i) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(i); g.computeVertexNormals(); return g; };
  return [mk(pos, idx), mk(gp, gi)];
}

export default {
  build() {
    const r = rng(1973);
    const world = createWorld({
      sky: { top: 0x1c66cf, horizon: 0xb6dcf7, bottom: 0x2c6aa8, haze: 0.62 },
      sun: { dir: [0.32, 0.84, -0.44], color: 0xfffaf0, power: 3.7, disc: 0xffffff, size: 0.0005 },
      ambient: { sky: 0xa4ccff, ground: 0x6a6f60, power: 1.05 },
      fog: { color: 0xc4e2f6, density: 0.0003 }, exposure: 1.0, env: 0.9,
    });
    const path = [[1500, 30, -430], [800, 26, -360], [380, 36, -330], [150, 48, -335], [-30, 44, -190], [-60, 50, 120], [-110, 110, 420], [-150, 235, 720],
      [-50, 252, 905], [55, 245, 790], [50, 170, 480], [-30, 90, 130], [-140, 50, -140], [-280, 30, -275], [-420, 26, -290], [-720, 36, -290]];
    const OH = [130, -125], TOWER = [-50, 800], BR = [-400, -280];
    const focus = [[0.08, OH[0], 30, OH[1]], [0.3, OH[0], 40, OH[1]], [0.37, OH[0], 42, OH[1] + 10], [0.44, -100, 130, 520], [0.52, TOWER[0], 256, TOWER[1]], [0.66, TOWER[0], 256, TOWER[1]], [0.74, BR[0], 90, BR[1]], [0.8, BR[0], 90, BR[1]]];
    const clear = clearance(path);

    // ---- the harbour and its shores: flat quays and suburbs, with green hills on the headlands
    water(world, 0, { color: 0x0d4a88, rough: 0.14, ripple: 80, strength: 0.27, env: 1.2 });
    const SOUTH = [[-3200, -100], [-1700, -200], [-1500, -150], [-1300, 80], [-960, 150], [-950, 900], [-790, 900], [-770, 200], [-700, 110], [-480, 50], [-465, -32], [-335, -32], [-290, 40], [-280, 335], [45, 335], [52, 60], [58, -200], [95, -265], [168, -265], [205, -200], [215, 70],
      [300, 200], [480, 265], [650, 200], [715, -110], [790, -125], [825, 110], [900, 300], [1000, 10], [1100, -15], [1150, 250], [1400, 300], [1600, 60], [1700, 55], [1760, 300], [2100, 350], [2300, 110], [2410, 120], [2500, 400], [3300, 400], [3300, 3300], [-3200, 3300]];
    const NORTH = [[-3200, -760], [-1000, -700], [-850, -575], [-760, -560], [-700, -640], [-470, -528], [-330, -528], [-250, -640], [0, -600], [150, -525], [420, -540], [500, -650], [900, -750], [1100, -565], [1180, -565], [1300, -800], [1900, -525], [2010, -560], [2100, -900], [3300, -1000], [3300, -3300], [-3200, -3300]];
    const CITY = [[-480, 55], [-465, -31], [-335, -31], [-290, 41], [-280, 336], [45, 336], [52, 60], [58, -200], [95, -264], [168, -264], [205, -200], [214, 70], [214, 520], [340, 520], [340, 1600], [-770, 1600], [-770, 200], [-700, 111]];
    const grass = mat(0x5f8a4a), paving = mat(0x8a8a88);
    world.add(prism(SOUTH, G + 1, grass, 0, -1, 0, { cast: false }), prism(NORTH, G + 1, grass, 0, -1, 0, { cast: false }), prism(CITY, G + 1.15, paving, 0, -1, 0, { cast: false }), box(520, 0.2, 860, paving, -640, G, -1080, { cast: false }));
    const land = (x, z) => inside(SOUTH, x, z) || inside(NORTH, x, z), inland = (x, z, m = 22) => land(x - m, z) && land(x + m, z) && land(x, z - m) && land(x, z + m);
    const hills = [[2050, -930, 330, 380, 62], [1150, -820, 140, 240, 34], [1680, 340, 150, 260, 42], [2400, 470, 190, 300, 46], [280, -700, 210, 120, 24], [-1650, 160, 280, 300, 26], [1300, 700, 500, 350, 40], [1500, -1300, 600, 380, 55], [-1900, -1100, 700, 300, 40], [520, 330, 260, 110, 14]];
    const hillAt = (x, z) => hills.reduce((m, [cx, cz, rx, rz, h]) => Math.max(m, h * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((z - cz) / rz) ** 2))), 0);
    world.add(bake(hills.map(([cx, cz, rx, rz, h]) => dome(1, grass, cx, G - 0.5, cz, { scale: [rx, h, rz], cast: false }))));

    // ---- the Opera House: podium, two halls of white sails, the little restaurant shells
    const oh = new THREE.Group(), tile = mat(0xf4f1e8, { rough: 0.6, side: THREE.DoubleSide, env: 0.25, emissive: 0xfff8ec, glow: 0.22 }), bronze = mat(0x33291f, { rough: 0.2, metal: 0.6, side: THREE.DoubleSide }), granite = mat(0xc0a28a);
    oh.add(box(106, 9, 198, granite, 0, 0, 0), box(94, 4, 156, granite, 0, 9, -14), box(98, 1.2, 190, mat(0x4a3a30), 0, 5.2, 0));
    for (let i = 0; i < 6; i++) oh.add(box(84, 13 - i * 2, 6, granite, 0, 0, 67 + i * 6));
    const hall = (specs, x, z, ry, s) => {
      const h = new THREE.Group();
      for (const sp of specs) { const [shellG, glassG] = sail(...sp); h.add(mesh(shellG, tile), mesh(glassG, bronze)); }
      h.add(box(specs[1][1] * 1.3, 11, Math.abs(specs[0][0] - specs[specs.length - 1][0]), bronze, 0, 0, (specs[0][0] + specs[specs.length - 1][0]) / 2));
      h.position.set(x, 13, z); h.rotation.y = ry; h.scale.setScalar(s); oh.add(h);
    };
    const main = [[26, 19, 55, 50, 6, 30], [0, 22, 27, 67, -20, 33], [-25, 19, -4, 51, -41, 22], [-41, 15, -66, 34, -39, 22]];
    hall(main, -27, -22, Math.PI + 0.1, 1); hall(main, 27, -18, Math.PI - 0.1, 0.84);
    hall([[2, 17, 26, 44, -10, 20], [-12, 15, -34, 34, -10, 20]], -30, 72, Math.PI + 0.1, 0.36);
    oh.position.set(OH[0], G, OH[1]); world.add(bake(oh));

    // ---- the Harbour Bridge: a steel through-arch between granite pylons
    const hb = new THREE.Group(), steel = mat(0x67747b, { rough: 0.6, metal: 0.3 }), stone = mat(0xbfae92), L = 503, N = 28, W = 24.5, DECK = 50;
    const low = (x) => 6 + 110 * (1 - (2 * x / L) ** 2), top = (x) => 62 + 72 * (1 - (2 * x / L) ** 2);
    for (let i = 0; i <= N; i++) {
      const x0 = -L / 2 + i * L / N, x1 = x0 + L / N, l0 = low(x0), u0 = top(x0), l1 = low(x1), u1 = top(x1), mid = i < N / 2;
      for (const z of [-W, W]) {
        hb.add(beam([x0, l0, z], [x0, u0, z], 1.4, steel));
        if (i > 0 && i < N) hb.add(beam([x0, l0, z], [x0, DECK, z], 0.8, steel));
        if (i < N) hb.add(beam([x0, l0, z], [x1, l1, z], 2.8, steel), beam([x0, u0, z], [x1, u1, z], 2.2, steel), beam(mid ? [x0, l0, z] : [x0, u0, z], mid ? [x1, u1, z] : [x1, l1, z], 1.3, steel));
      }
      hb.add(beam([x0, u0, -W], [x0, u0, W], 1.2, steel));
      if (l0 > DECK + 14) hb.add(beam([x0, l0, -W], [x0, l0, W], 1.2, steel));
      if (i < N) { hb.add(beam([x0, u0, -W], [x1, u1, W], 0.8, steel), beam([x0, u0, W], [x1, u1, -W], 0.8, steel)); if (l0 > DECK + 14 && l1 > DECK + 14) hb.add(beam([x0, l0, -W], [x1, l1, W], 0.8, steel)); }
    }
    hb.add(box(L + 520, 3.6, 49, steel, 0, DECK - 3.6, 0), box(L + 520, 0.3, 40, mat(0x3c3e42), 0, DECK, 0));
    for (const s of [-1, 1]) {
      hb.add(box(46, 47, 66, stone, s * (L / 2 + 18), 0, 0));
      for (const z of [-1, 1]) hb.add(cyl(10.5, 12.5, 82, stone, s * (L / 2 + 18), 0, z * 35, 4, { scale: [1, 1, 1.25] }), box(17, 3, 21, stone, s * (L / 2 + 18), 82, z * 35), box(12, 6, 15, stone, s * (L / 2 + 18), 85, z * 35));
      for (let k = 1; k <= 5; k++) hb.add(box(7, 47, 42, stone, s * (L / 2 + 18 + k * 46), 0, 0));
      const a = new THREE.Vector3(s * (L / 2 + 260), DECK - 2, 0), b = new THREE.Vector3(s * (L / 2 + 640), -1, 0), ramp = mesh(new THREE.BoxGeometry(46, 5, a.distanceTo(b)), stone); ramp.position.copy(a).lerp(b, 0.5); ramp.lookAt(b); hb.add(ramp);
      hb.add(cyl(0.2, 0.2, 10, steel, s * 5, 134, W, 6), box(4, 2.4, 0.2, mat(s > 0 ? 0x1f3a8a : 0xb8242c), s * 5 + 2.2, 141, W));
    }
    hb.position.set(BR[0], 0, BR[1]); hb.rotation.y = Math.PI / 2; world.add(bake(hb));
    const carTones = [0xf2f2f0, 0x9aa0a6, 0x22242a, 0xb8262a, 0x2b4f9a, 0xf2f2f0, 0xd9c070];
    fleet(world, new THREE.BoxGeometry(1.9, 1.5, 4.5).translate(0, 0.75, 0), mat(0xffffff, { rough: 0.4, metal: 0.3 }), 60, (i, t) => { const dir = i % 2 ? 1 : -1, s = ((((i * 61.7 + dir * t * 18) % 1000) + 1000) % 1000) - 500; return [BR[0] + dir * (3 + (i % 4) * 4), DECK + 0.3, BR[1] + s, 0]; }, carTones);

    // ---- Sydney Tower: a gold turret on a thin shaft, braced by a net of cables
    const st = new THREE.Group(), gold = mat(0xd8aa48, { metal: 0.75, rough: 0.3 }), pale = mat(0xe4e2da);
    st.add(box(74, 52, 66, facadeMat({ color: 0xcfc8ba, floor: 4.3, bay: 3.2, frame: [0.14, 0.2], glass: 0x2b4258, lit: 0.1 })), cyl(3.6, 3.6, 186, pale, 0, 52, 0, 12));
    st.add(lathe([[3.6, 232], [7, 239], [15, 250], [15.6, 251], [15.6, 264], [13, 267], [9, 273], [6.6, 274], [6.6, 282], [4, 284], [0, 284]], gold, 0, 0, 0, 36), cyl(15.8, 15.8, 2.6, mat(0x1c2a38, { rough: 0.15, metal: 0.6 }), 0, 253.5, 0, 36), cyl(15.8, 15.8, 2.6, mat(0x1c2a38, { rough: 0.15, metal: 0.6 }), 0, 259, 0, 36), cyl(0.4, 1.7, 25, pale, 0, 284, 0, 6));
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, b = a + (i % 2 ? 2.1 : -2.1); st.add(beam([Math.cos(a) * 13, 246, Math.sin(a) * 13], [Math.cos(b) * 15, 52, Math.sin(b) * 15], 0.26, pale)); }
    for (const y of [250.3, 256.6, 262.2, 266.5]) st.add(cyl(y > 264 ? 13.6 : 15.9, y > 264 ? 13.6 : 15.9, 0.7, pale, 0, y, 0, 36));
    st.position.set(TOWER[0], G, TOWER[1]); world.add(bake(st));

    // ---- the city: glass and concrete towers in the CBD and North Sydney, The Rocks, and red-roofed suburbs everywhere else
    const rects = [[-440, -40, -360, 660], [-440, -1180, -360, -520], [215, -300, 850, 530], [45, -280, 225, 345], [70, 950, 210, 1300], [-100, 750, 0, 850], [-300, 330, 60, 372], [-260, 540, -200, 600], [160, 690, 220, 750], [-720, 300, -620, 660]];
    const free = (x, z, m = 20) => !rects.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m);
    const cbd = (x, z) => Math.exp(-((x + 80) ** 2) / 120000 - ((z - 880) ** 2) / 260000), nsyd = (x, z) => Math.exp(-((x + 650) ** 2 + (z + 1020) ** 2) / 60000);
    const glassTones = [0xa9c2d6, 0x93aec6, 0xc2d2dc, 0x7f9fba, 0xcfd6d8, 0xb0c4cc, 0xd8cfc0], stoneTones = [0xd9cdb4, 0xcabfa8, 0xe6dfd0, 0xb9a488, 0xd8d4cc];
    const towers = [...cityGrid({ rand: r, area: [-745, 385, 335, 1560], block: 46, street: 20, jitter: 0.3, split: 0.25, keep: (x, z) => free(x, z, 26), height: (x, z) => Math.min(40 + 215 * cbd(x, z) * r.range(0.35, 1.05), clear(x, z, 82) - 26) }),
      ...cityGrid({ rand: r, area: [-890, -1480, -400, -665], block: 44, street: 20, jitter: 0.3, keep: (x, z) => free(x, z, 26), height: (x, z) => 24 + 150 * nsyd(x, z) * r.range(0.3, 1) }),
      ...[[-670, 420, 44, 44, 217], [-670, 505, 44, 44, 198], [-670, 590, 44, 44, 170], [190, 720, 40, 40, 222]].map(([x, z, w, d, h]) => ({ x, z, w, d, h }))];
    const A = [], B = [];
    for (const b of towers) { b.y = G; if (b.h > 75 || r.chance(0.3)) { b.color = r.pick(glassTones); B.push(b); } else { b.color = r.pick(stoneTones); A.push(b); } }
    for (const b of [...B]) if (b.h > 120 && r.chance(0.5)) B.push({ x: b.x, z: b.z, y: G + b.h, w: b.w * 0.55, d: b.d * 0.55, h: r.range(8, 22), color: b.color });
    const rocks = cityGrid({ rand: r, area: [-470, 30, -285, 335], block: 26, street: 10, keep: (x, z) => free(x, z, 14) && inland(x, z, 14), height: () => r.range(9, 22), palette: [0xc9a878, 0xb5805c, 0xd8c8a8, 0x9c6a4c] });
    rocks.forEach((b) => { b.y = G; }); A.push(...rocks);
    world.add(buildings(A, facadeMat({ floor: 3.6, bay: 3, frame: [0.26, 0.26], glass: 0x26323e, lit: 0.1, rough: 0.85 })), buildings(B, facadeMat({ floor: 4, bay: 2.2, frame: [0.1, 0.17], glass: 0x6f8fa8, lit: 0.08, rough: 0.25, metal: 0.25 })));
    world.add(cyl(21, 21, 172, facadeMat({ color: 0xe2ddd0, floor: 3.6, bay: 2.6, frame: [0.3, 0.16], glass: 0x2a3a48, lit: 0.1, round: 21 }), -230, G, 570, 28));   // Australia Square
    world.add(lathe([[19, 0], [21, 70], [18.5, 160], [12, 235], [4, 268], [0, 272]], facadeMat({ color: 0xdfe8ee, floor: 4, bay: 2.4, frame: [0.07, 0.1], glass: 0x7fb0d0, lit: 0.1, rough: 0.2, metal: 0.4, round: 20 }), -690, G, 340, 28));   // the Barangaroo tower
    const houses = [], hroofs = [], flats = [], gable = gableGeo(), wallTones = [0xeadfc6, 0xf2ece0, 0xc98a66, 0xdcc9a6, 0xf2ece0, 0xb9a48c], roofTones = [0xb5522f, 0xc4633a, 0xa84a2c, 0xb5522f, 0x7c8087, 0xcf7a4a];
    for (let x = -3100; x < 3200; x += 43) for (let z = -2500; z < 2500; z += 43) {
      const px = x + r.range(-6, 6), pz = z + r.range(-6, 6);
      if (!inland(px, pz, 24) || !free(px, pz, 24) || inside(CITY, px, pz) || (px > -910 && px < -380 && pz < -650 && pz > -1500) || r.chance(0.22)) continue;
      const y = G + hillAt(px, pz) - 0.8, w = r.range(14, 24), d = r.range(14, 24);
      if (r.chance(0.05)) { flats.push({ x: px, y, z: pz, w: 20, d: 20, h: r.range(28, 70), color: r.pick(stoneTones) }); continue; }
      const h = r.range(5, 10), turn = r.chance(0.5);
      houses.push({ x: px, y, z: pz, w, d, h, color: r.pick(wallTones) });
      hroofs.push({ x: px, y: y + h, z: pz, sx: (turn ? d : w) + 1.5, sy: r.range(3, 5), sz: (turn ? w : d) + 1.5, ry: turn ? Math.PI / 2 : 0, color: r.pick(roofTones) });
    }
    world.add(buildings([...houses, ...flats], facadeMat({ floor: 3.2, bay: 3.2, frame: [0.3, 0.3], glass: 0x2a3640, lit: 0, rough: 0.9 }), { cast: false }), instances(gable, mat(0xffffff, { rough: 0.8 }), hroofs, { cast: false }));

    // ---- Circular Quay: the station across the head of the cove, ferry wharves, a liner at the passenger terminal
    const quay = new THREE.Group(), hullWhite = mat(0xf4f4f0, { rough: 0.45 }), cabins = facadeMat({ color: 0xf4f4f0, floor: 3, bay: 3, frame: [0.18, 0.3], glass: 0x1c2e40, lit: 0 });
    quay.add(box(336, 15, 22, facadeMat({ color: 0xbfb8a8, floor: 7, bay: 6, frame: [0.12, 0.3], glass: 0x26323c, lit: 0 }), -118, G, 352), box(340, 1.2, 26, mat(0x55585c), -118, G + 15, 352));
    for (let k = 0; k < 5; k++) quay.add(box(9, 2, 62, mat(0x9a948a), -224 + k * 58, G - 1.2, 304), box(11, 5, 30, hullWhite, -224 + k * 58, G + 0.8, 316));
    quay.add(box(30, 15, 236, hullWhite, -260, -2, 170), box(30.4, 4, 236.4, mat(0x1f3358), -260, -1, 170), cyl(15, 15, 15, hullWhite, -260, -2, 52, 3, { scale: [1, 1, 2.2], ry: Math.PI }), box(27, 13, 190, cabins, -260, 13, 180), box(22, 5, 140, cabins, -260, 26, 190), cyl(4.5, 5.5, 13, mat(0xf0b030), -260, 31, 230, 12, { scale: [1, 1, 1.6] }));
    quay.add(box(16, 9, 190, facadeMat({ color: 0xd8d2c6, floor: 4.5, bay: 5, frame: [0.1, 0.25], glass: 0x2a3d50, lit: 0 }), -292, G, 190));
    world.add(bake(quay));

    // ---- on the water: green-and-cream ferries on their runs, yachts under sail
    const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
    const runs = [curve([[-100, 240], [-80, -80], [300, -440], [1200, -380], [1900, -300], [1200, -250], [360, -400], [-40, -130]]), curve([[-160, 240], [-170, -180], [-400, -340], [-900, -250], [-1400, -400], [-900, -400], [-400, -230], [-120, -60]])];
    const sail1 = (i, t) => { const c = runs[i % 2], u = (i * 0.137 + t * 7 / c.getLength()) % 1, p = c.getPointAt(u), g = c.getTangentAt(u); return [p.x, 0, p.z, Math.atan2(g.x, g.z)]; };
    fleet(world, mergeGeometries([new THREE.BoxGeometry(8, 3.4, 32).translate(0, 1, 0), new THREE.CylinderGeometry(4, 4, 3.4, 3).scale(1, 1, 1.6).translate(0, 1, 18.5)]), mat(0x1d6a48, { rough: 0.5 }), 8, sail1);
    fleet(world, mergeGeometries([new THREE.BoxGeometry(7.2, 2.6, 26).translate(0, 4, 0), new THREE.BoxGeometry(6, 2.4, 18).translate(0, 6.5, 0), new THREE.BoxGeometry(3, 2, 4).translate(0, 8.7, 6)]), mat(0xf0e6c4, { rough: 0.6 }), 8, sail1);
    const tri = (p) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; };
    const strip = (g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; };
    const yacht = mergeGeometries([strip(new THREE.BoxGeometry(2.4, 1.2, 9).translate(0, 0.4, 0)), strip(new THREE.BoxGeometry(0.16, 13, 0.16).translate(0, 7.4, 0.6)), tri([0, 2.2, 0.3, 0, 13.6, 0.5, 0, 2.2, -4.4, 0, 1.6, 1, 0, 12, 0.8, 0, 1.6, 4.6])]).scale(1.5, 1.5, 1.5);
    const moor = []; while (moor.length < 46) { const x = r.range(150, 2500), z = r.range(-720, 300); if (!land(x, z) && !land(x - 40, z) && !land(x + 40, z) && !land(x, z - 40) && !land(x, z + 40) && Math.abs(z + 400) > 50) moor.push([x, z, r.chance(0.5) ? 1 : -1, r.range(0.6, 1.8)]); }
    fleet(world, yacht, mat(0xffffff, { rough: 0.6, side: THREE.DoubleSide }), moor.length, (i, t) => { const [x, z, dir, v] = moor[i]; return [x + dir * v * t, 0, z + Math.sin(t * 0.2 + i) * 2, dir > 0 ? Math.PI / 2 : -Math.PI / 2]; });

    // ---- green: the Botanic Gardens, street trees through the suburbs, palms by the water
    const leafy = [], palms = [], bush = [], greens = [0x3f7d3a, 0x4c8a42, 0x35693a, 0x5a9448, 0x2f6336];
    while (leafy.length < 230) { const x = r.range(225, 840), z = r.range(-120, 520); if (inland(x, z, 12) && Math.hypot(x - 380, z + 330) > 80) leafy.push([x, G + hillAt(x, z) - 0.6, z]); }
    while (bush.length < 2600) { const x = r.range(-3100, 3200), z = r.range(-2500, 2500), s = r.range(5, 9); if (inland(x, z, 12) && !inside(CITY, x, z) && free(x, z, 0)) bush.push({ x, y: G + hillAt(x, z) + s * 0.6, z, sx: s, sy: s * 0.85, sz: s, ry: r() * 6, color: r.pick(greens) }); }
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { rough: 0.9, flat: true }), bush, { cast: false }));
    for (let i = 0; i < 26; i++) palms.push([52 + (i % 2) * 160 + r.range(-3, 3), G, 40 + (i >> 1) * 22], [230 + i * 21, G, 210 + 40 * Math.sin(i * 0.5) + (i > 12 ? -60 : 30)]);
    trees(world, leafy, 'round', { size: 13, color: greens, rand: r });
    trees(world, palms.filter(([x, , z]) => inland(x, z, 4)), 'palm', { size: 12, rand: r });

    clouds(world, { count: 9, y: [900, 1300], size: 130, color: 0xffffff, self: 0.45, rand: rng(12) });
    return { world, path, focus, duration: 50 };
  },
};
