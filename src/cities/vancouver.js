// Vancouver on a crisp morning after rain: in over Science World with the glass towers standing against the snowy North Shore mountains,
// west along False Creek and its little ferries, round English Bay and over Stanley Park to the Lions Gate Bridge, then back up Burrard Inlet
// past the freighters and the floatplanes lifting off Coal Harbour, to the white sails of Canada Place.
import { THREE, mergeGeometries, createWorld, rng, fbm, clamp, lerp, smooth, mat, glowMat, facadeMat, box, cyl, mesh, lathe, prism, instances, buildings, cityGrid, terrain, water, trees, lights, traffic, suspensionBridge, clouds, clearance } from '../kit.js';

const TAU = Math.PI * 2;
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
/** Collects static pieces that share a material and merges them into one mesh. */
function pile(material) {
  const list = [];
  return {
    add(g, x = 0, y = 0, z = 0, ry = 0) { g = g.index ? g.toNonIndexed() : g; if (ry) g.rotateY(ry); list.push(g.translate(x, y, z)); return this; },
    geo() { return mergeGeometries(list); },
    mesh(o) { return mesh(mergeGeometries(list), material, 0, 0, 0, o); },
  };
}

export default {
  build() {
    const r = rng(1886);
    const world = createWorld({
      sky: { top: 0x1a5fc8, horizon: 0xb4d8f2, bottom: 0x7fa6c2, haze: 0.62 },
      sun: { dir: [0.82, 0.46, -0.12], color: 0xfff4e2, power: 3.2, disc: 0xfffaf0, size: 0.0005 },
      ambient: { sky: 0x9cc4ff, ground: 0x4a5a58, power: 0.9 },
      fog: { color: 0xc2def2, density: 0.00011 }, exposure: 1.0, env: 1.0,
    });
    const path = [[1010, 112, 770], [870, 96, 700], [520, 50, 452], [150, 36, 372], [-250, 40, 322], [-640, 40, 180], [-960, 46, -80], [-1090, 70, -480], [-1010, 88, -860], [-800, 80, -1080], [-440, 60, -1010], [-60, 50, -810], [220, 44, -662]];
    const focus = [[0.08, 100, 150, -700], [0.14, 300, 60, 150], [0.24, -100, 110, -300], [0.36, -500, 120, -900], [0.46, -300, 200, -1500], [0.56, -1050, 80, -1280], [0.7, -1050, 70, -1350], [0.78, 330, 25, -480]];
    const clear = clearance(path);

    // ---- where the land is: the downtown peninsula between Burrard Inlet and False Creek, Stanley Park at its tip, the North Shore across the water
    const A = [-560, -250], Bp = [620, 80], PX = -900, PZ = -560;
    const downtown = (x, z) => { const ux = Bp[0] - A[0], uz = Bp[1] - A[1], t = clamp(((x - A[0]) * ux + (z - A[1]) * uz) / (ux * ux + uz * uz)); return 330 - Math.hypot(x - A[0] - ux * t, z - A[1] - uz * t); };   // metres inside the shore
    const mainland = (x, z) => Math.min(Math.max(z - 470, Math.min(x - 640, z + 230)), 1e4);
    const northShore = (x) => -1500 - 60 * Math.sin(x / 400) - 150 * Math.exp(-(((x + 1050) / 260) ** 2));
    const N = (x, z) => {
      const d = northShore(x) - z, n = fbm(x / 900 + 2, z / 900, 4), ridge = 1 - Math.abs(2 * fbm(x / 1300, z / 1300 + 5, 3) - 1);
      const lions = 260 * (Math.exp(-(((x + 720) / 120) ** 2) - ((z + 3500) / 120) ** 2) + Math.exp(-(((x + 520) / 110) ** 2) - ((z + 3430) / 110) ** 2));
      const crag = 1 - Math.abs(2 * fbm(x / 330 + 9, z / 330, 3) - 1);
      return -12 + 15 * smooth(-20, 10, d) + smooth(80, 1700, d) ** 1.25 * (330 + 430 * ridge + 300 * n + 170 * crag * crag) + lions * smooth(1200, 1900, d) + 20 * fbm(x / 120, z / 120, 2) * smooth(150, 600, d);
    };
    const c1 = new THREE.Color(), c2 = new THREE.Color();
    world.add(terrain({ size: [9000, 3300], center: [0, -3090], seg: 230, height: N, color: (x, y, z, slope) => {
      const n = fbm(x / 110, z / 110, 3), snow = smooth(520, 640, y + 110 * n - 260 * slope);
      if (y < 3.4) return 0x5f5c54;
      const wood = y < 130 && slope < 0.12 ? c1.set(0x3a5a44).lerp(c2.set(0x6a7a68), n) : c1.set(0x1c4030).lerp(c2.set(0x2f5a3c), n);
      return wood.lerp(c2.set(0x5e6066), smooth(0.24, 0.42, slope) * 0.85).lerp(c2.set(0xf6f9ff), snow);
    } }));
    water(world, 0, { color: 0x1f4f6a, rough: 0.08, strength: 0.22, ripple: 80 });
    const wet = mat(0x3c4148, { rough: 0.32, metal: 0.15 }), cap = [];
    for (let i = 0; i <= 16; i++) { const a = Math.atan2(Bp[1] - A[1], Bp[0] - A[0]) + Math.PI / 2 + i / 16 * Math.PI; cap.push([A[0] + Math.cos(a) * 330, A[1] + Math.sin(a) * 330]); }
    for (let i = 0; i <= 16; i++) { const a = Math.atan2(Bp[1] - A[1], Bp[0] - A[0]) - Math.PI / 2 + i / 16 * Math.PI; cap.push([Bp[0] + Math.cos(a) * 330, Bp[1] + Math.sin(a) * 330]); }
    world.add(prism(cap, 9, wet, 0, -6, 0, { cast: false }), prism([[-4500, 470], [640, 470], [640, -230], [4500, -230], [4500, 3700], [-4500, 3700]], 9, mat(0x4a5048, { rough: 0.6 }), 0, -6, 0, { cast: false }));
    world.add(lathe([[392, -6], [386, 3], [300, 12], [150, 21], [0, 24]], mat(0x2c4a34, { rough: 0.95 }), PX, 0, PZ, 40, { cast: false }), lathe([[398, -6], [398, 2.4], [384, 2.4]], mat(0xb9b4a6, { rough: 0.9 }), PX, 0, PZ, 40, { cast: false }));

    // ---- downtown: a forest of slim glass towers, wet streets between them
    const reserved = (x, z) => Math.hypot(x - 430, z - 250) < 125 || Math.hypot(x - 250, z + 150) < 34 || (Math.abs(x - 350) < 70 && z < -250);
    const core = (x, z) => Math.exp(-(((x - 80) / 420) ** 2) - ((z + 130) / 230) ** 2);
    const lots = cityGrid({ rand: rng(2), area: [-900, -600, 960, 420], block: 27, street: 21, jitter: 0.3, split: 0, fill: 0.92,
      keep: (x, z) => downtown(x, z) > 30 && !reserved(x, z) && r.chance(0.86), height: (x, z) => Math.min((34 + 120 * core(x, z)) * r.range(0.55, 1.25) + (downtown(x, z) < 90 ? 22 : 0), clear(x, z, 80) - 28) });
    const glassA = [], glassB = [], lids = [];
    for (const b of lots) {
      b.y = 3; const pod = { x: b.x, z: b.z, y: 3, w: 40, d: 40, h: r.range(7, 12), color: 0xb9b4aa };
      if (r.chance(0.72)) { b.color = r.pick([0xa9d0d2, 0x9fc4d6, 0xb9dcd6, 0x8fb8cc, 0xc6e0e0]); glassA.push(b); } else { b.color = r.pick([0xe2ddd2, 0xc9c4ba, 0xd8cfc0, 0xb9b0a6]); glassB.push(b); }
      if (b.h > 40) glassB.push(pod);
      lids.push({ x: b.x, z: b.z, y: 3 + b.h, w: b.w * 0.5, d: b.d * 0.5, h: 3.5 });
    }
    const glassM = facadeMat({ floor: 3, bay: 2.2, frame: [0.06, 0.14], glass: 0x4f97a8, lit: 0.06, night: 0.4, rough: 0.2, metal: 0.45 });
    const concM = facadeMat({ floor: 3.2, bay: 3, frame: [0.2, 0.25], glass: 0x35556a, lit: 0.08, night: 0.4, rough: 0.8 });
    world.add(buildings(glassA, glassM), buildings(glassB, concM), buildings(lids, mat(0x9aa2a6, { rough: 0.6 }), { cast: false }));
    // Harbour Centre with its lookout saucer, BC Place under its ring of masts
    const white = pile(mat(0xf4f3ee, { rough: 0.6 })), steel = pile(mat(0x9aa4aa, { rough: 0.35, metal: 0.6 })), dark = pile(mat(0x23272c, { rough: 0.5 }));
    world.add(box(30, 128, 30, concM, 250, 3, -150)); steel.add(new THREE.CylinderGeometry(27, 20, 6, 28), 250, 138, -150).add(new THREE.CylinderGeometry(27, 27, 6, 28), 250, 144, -150).add(new THREE.CylinderGeometry(8, 22, 5, 20), 250, 149.5, -150).add(new THREE.CylinderGeometry(0.5, 1.4, 30, 6), 250, 167, -150); dark.add(new THREE.CylinderGeometry(27.3, 27.3, 2.6, 28), 250, 144, -150);
    white.add(new THREE.CylinderGeometry(96, 100, 26, 40).translate(0, 16, 0), 430, 0, 250).add(new THREE.SphereGeometry(96, 32, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.14, 1), 430, 29, 250);
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; steel.add(new THREE.CylinderGeometry(0.6, 1.3, 46, 5).rotateZ(-0.28).rotateY(-a), 430 + Math.cos(a) * 103, 30, 250 + Math.sin(a) * 103); }
    // Science World: the geodesic sphere at the head of False Creek
    const SX = 585, SZ = 520, geo = new THREE.IcosahedronGeometry(38, 3);
    world.add(mesh(geo, mat(0xc6ced4, { rough: 0.22, metal: 0.75, flat: true }), SX, 34, SZ), box(110, 12, 60, concM, SX, 3, SZ + 6), box(70, 6, 46, mat(0x3a6a9a, { rough: 0.4 }), SX, 15, SZ + 6));
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0x4a545c })); wire.position.set(SX, 34, SZ); wire.scale.setScalar(1.004); world.add(wire);

    // ---- Canada Place: five white sails on a pier in the harbour, a cruise ship alongside
    const CX = 350;
    world.add(box(64, 9, 330, mat(0x8a8e92, { rough: 0.8 }), CX, -4, -475), box(54, 15, 300, facadeMat({ color: 0xe9eef0, floor: 5, bay: 4, frame: [0.1, 0.2], glass: 0x3f6f8a, lit: 0.1, night: 0.4 }), CX, 5, -470));
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const g = new THREE.ConeGeometry(21, 38, 4, 4, true).rotateY(Math.PI / 4), p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const u = 1 - (p.getY(k) + 19) / 38, q = 1 - 0.38 * Math.sin(Math.PI * u); p.setX(k, p.getX(k) * q); p.setZ(k, p.getZ(k) * q); }
      g.computeVertexNormals(); white.add(g, CX + s * 13.5, 39, -350 - i * 58); steel.add(new THREE.CylinderGeometry(0.3, 0.3, 9, 5), CX + s * 13.5, 62, -350 - i * 58);
    }
    const shipM = facadeMat({ color: 0xf6f6f2, floor: 3, bay: 2.6, frame: [0.12, 0.3], glass: 0x1f3f58, lit: 0.1, night: 0.4, rough: 0.5 });
    world.add(buildings([{ x: CX + 62, z: -470, y: 7, w: 30, d: 250, h: 18 }, { x: CX + 62, z: -476, y: 25, w: 26, d: 200, h: 9 }, { x: CX + 62, z: -486, y: 34, w: 20, d: 120, h: 5 }], shipM));
    const hull = new THREE.Shape([[-17, 9], [17, 9], [14, -3], [-14, -3]].map(([a, b]) => new THREE.Vector2(a, b)));
    world.add(mesh(new THREE.ExtrudeGeometry(hull, { depth: 276, bevelEnabled: false }).translate(0, 0, -138), mat(0xf6f6f2, { rough: 0.5 }), CX + 62, 0, -468), box(12, 12, 20, mat(0x1c3f7a, { rough: 0.5 }), CX + 62, 39, -430));

    // ---- Stanley Park's conifers and the Lions Gate Bridge striding out of them
    const firs = []; for (let i = 0; i < 1500; i++) { const a = r() * TAU, q = 372 * Math.sqrt(r()); firs.push([PX + Math.cos(a) * q, 3 + 21 * (1 - q / 385), PZ + Math.sin(a) * q]); }
    for (let i = 0; i < 260; i++) { const x = r.range(-1300, -800), z = r.range(-1900, -1700); if (N(x, z) > 4 && Math.abs(x + 1050) > 24) firs.push([x, N(x, z), z]); }
    trees(world, firs, 'conifer', { size: 24, color: [0x1f4a34, 0x25543a, 0x1a4230, 0x2c5e3e] });
    const lg = suspensionBridge({ length: 870, towerH: 112, deckY: 61, width: 18, color: 0x4f8a68, towers: [-236, 236], cable: 0.6, deckThick: 5 });
    lg.position.set(-1050, 0, -1290); lg.rotation.y = Math.PI / 2; world.add(lg);
    world.add(box(18, 5, 330, mat(0x6a7078, { rough: 0.8 }), -1050, 56, -745), box(18, 5, 260, mat(0x6a7078, { rough: 0.8 }), -1050, 56, -1850));
    for (const z of [-640, -760, -1790, -1900]) world.add(box(10, 60, 5, mat(0x8a9096, { rough: 0.8 }), -1050, -4, z));
    traffic(world, [[-1054, 62.5, -600], [-1054, 62.5, -1950]], { count: 26, color: 0xff5040, size: 2.4, speed: 16, spread: 2 }); traffic(world, [[-1046, 62.5, -1950], [-1046, 62.5, -600]], { count: 26, color: 0xfff0d0, size: 2.4, speed: 16, spread: 2 });

    // ---- False Creek: three bridges, Granville Island, marinas, the little rainbow ferries
    const conc = pile(mat(0x9a9d9e, { rough: 0.8 }));
    for (const [x, z0, k] of [[250, 300, 1], [-200, 190, 0], [-560, 80, 2]]) {
      conc.add(new THREE.BoxGeometry(22, 2.6, 520 - z0).translate(0, 10.7, 0), x, 0, (470 + z0) / 2 + 10); for (let z = z0 + 20; z < 480; z += 46) conc.add(B(14, 16, 4), x, -6, z);
      if (k === 2) for (const z of [200, 340]) conc.add(B(26, 26, 7), x, 0, z).add(B(30, 3, 9), x, 26, z);
      if (k === 0) steel.add(new THREE.BoxGeometry(24, 9, 150).translate(0, 16, 0), x, 0, 330);
      traffic(world, [[x - 5, 13.4, z0 - 20], [x - 5, 13.4, 520]], { count: 9, color: [0xfff0d0, 0xff5040], size: 2.2, speed: 12, spread: 3 });
    }
    world.add(box(150, 8, 70, mat(0x55585c, { rough: 0.7 }), -200, -5, 428)); const sheds = [0, 1, 2, 3, 4, 5].map((i) => ({ x: -255 + (i % 3) * 52, z: 412 + (i / 3 | 0) * 30, y: 3, w: 44, d: 22, h: 9, color: r.pick([0xc0563a, 0x3a8a9a, 0xe2b03a, 0x5a8a4a, 0xb9b4aa]) }));
    const yacht = mergeGeometries([new THREE.BoxGeometry(2.4, 1.2, 8).translate(0, 0.5, 0), new THREE.CylinderGeometry(0.08, 0.08, 10, 4).translate(0, 5.6, 0.6)]);
    const moored = []; for (let i = 0; i < 150; i++) { const x = r.range(-520, 560), z = r.chance(0.5) ? 458 - r.range(0, 22) : 0; const zz = z || (A[1] + (Bp[1] - A[1]) * (x - A[0]) / (Bp[0] - A[0]) + 348 + r.range(0, 20)); if (zz < 462 && mainland(x, zz) < 0 && downtown(x, zz) < -6) moored.push({ x, y: 0, z: zz, ry: r.range(-0.2, 0.2), s: r.range(0.8, 1.3) }); }
    for (let i = 0; i < 90; i++) moored.push({ x: r.range(-420, 60), y: 0, z: r.range(-640, -585) - Math.abs(r.range(-1, 1)) * 30, ry: 1.57 + r.range(-0.2, 0.2), s: r.range(0.9, 1.5) });
    world.add(instances(yacht, mat(0xf4f3ee, { rough: 0.5 }), moored.filter((b) => downtown(b.x, b.z) < -8), { cast: false }));
    const ferryG = pile().add(new THREE.BoxGeometry(3, 1.3, 7).translate(0, 0.6, 0)).add(new THREE.BoxGeometry(2.8, 1.5, 4.6).translate(0, 2, 0)).add(new THREE.BoxGeometry(3.2, 0.25, 5.4).translate(0, 2.9, 0)).geo();
    const ferries = [0x2f8ad0, 0xe2553a, 0xf2c230, 0x3aa86a, 0x8a4ac0, 0xe88a3a].map((c) => world.add(mesh(ferryG, mat(c, { rough: 0.5 }))));
    world.onUpdate((t) => ferries.forEach((m, i) => { const dir = i % 2 ? -1 : 1, x = -700 + ((((i * 210 + t * 4 * dir) % 1250) + 1250) % 1250), zc = A[1] + (Bp[1] - A[1]) * (clamp(x, A[0], Bp[0]) - A[0]) / (Bp[0] - A[0]) + 400; m.position.set(x, 0.2, Math.min(zc + dir * 14, 455)); m.rotation.y = dir * Math.PI / 2 - 0.27; }));

    // ---- floatplanes: taxiing in Coal Harbour, then lifting off and climbing out over the park
    const planeW = pile().add(new THREE.BoxGeometry(1.5, 1.6, 9).translate(0, 2.6, 0)).add(new THREE.BoxGeometry(15, 0.25, 2.2).translate(0, 3.6, -1)).add(new THREE.BoxGeometry(5, 0.2, 1.3).translate(0, 3, 4)).add(new THREE.BoxGeometry(0.2, 2, 1.6).translate(0, 4, 4));
    for (const s of [-1, 1]) planeW.add(new THREE.BoxGeometry(0.9, 0.8, 7).translate(s * 1.9, 0.4, -0.6)).add(new THREE.BoxGeometry(0.15, 1.6, 0.15).translate(s * 1.5, 1.4, -1.6)).add(new THREE.BoxGeometry(0.15, 1.6, 0.15).translate(s * 1.5, 1.4, 1));
    const planeG = planeW.geo(), planes = [0xf4f3ee, 0xf2c230, 0xf4f3ee, 0xe2553a].map((c) => world.add(mesh(planeG, mat(c, { rough: 0.4 }), 0, 0, 0, { scale: 1.5 })));
    world.onUpdate((t) => planes.forEach((m, i) => {
      const u = ((t / 26 + i / 4) % 1), run = smooth(0, 0.3, u), up = Math.max(0, u - 0.28);
      m.position.set(120 - 1400 * (u * 0.35 + run * 0.65 * u), 0.2 + 420 * up ** 1.5, -640 - 300 * u - i * 22); m.rotation.set(-0.3 * smooth(0.26, 0.4, u), Math.PI / 2 + 0.2, 0, 'YXZ');
    }));

    // ---- freighters at anchor, the port's cranes and containers, sulphur heaps on the far shore
    const ships = [[-1750, 60, 0.4], [-2300, -500, 1.2], [-1500, 620, 2.6], [-400, -1280, 0.2], [600, -1200, 3.2], [1300, -900, 0.1], [2100, -1150, 3.0], [-2900, 250, 0.9]];
    world.add(instances(B(1, 1, 1), mat(0xffffff, { rough: 0.6 }), ships.flatMap(([x, z, a], i) => [{ x, y: -4, z, ry: a, sx: 190, sy: 15, sz: 30, color: [0x8a2f24, 0x1f2c3c, 0x2a5a8a, 0x23272c][i % 4] }, { x: x - Math.cos(a) * 78, y: 11, z: z + Math.sin(a) * 78, ry: a, sx: 16, sy: 22, sz: 26, color: 0xf2efe8 }, { x: x + Math.cos(a) * 12, y: 11, z: z - Math.sin(a) * 12, ry: a, sx: 140, sy: 2.5, sz: 24, color: [0xb5553a, 0x6a7078, 0x8a6a3a][i % 3] }])));
    const boxes = [], cranes = [];
    for (let i = 0; i < 420; i++) boxes.push({ x: 760 + r.int(0, 60) * 13, z: -214 + r.int(0, 5) * 7, y: 3 + r.int(0, 3) * 2.7, w: 12.2, d: 2.5, h: 2.6, color: r.pick([0xb5432c, 0x2f6a8c, 0xd9a03a, 0x3c7a52, 0x8c8f94, 0xc96a2c]) });
    for (let x = 800; x < 1560; x += 126) cranes.push({ x, y: 3, z: -236, sx: 3, sy: 62, sz: 3 }, { x: x + 24, y: 3, z: -236, sx: 3, sy: 62, sz: 3 }, { x: x + 12, y: 58, z: -262, sx: 30, sy: 5, sz: 96 }, { x: x + 12, y: 63, z: -236, sx: 4, sy: 22, sz: 4 });
    world.add(buildings(boxes, mat(0xffffff, { rough: 0.7 }), { cast: false }), instances(B(1, 1, 1), mat(0xd8562a, { rough: 0.6 }), cranes));
    for (const x of [380, 450]) world.add(cyl(0, 34, 22, mat(0xe8d23a, { rough: 0.9 }), x, N(x, -1590) - 1, -1590, 16));

    // ---- the rest of the city: houses and leafy streets to the south, North Vancouver climbing the lower slopes
    const south = cityGrid({ rand: rng(5), area: [-3000, 500, 3000, 2600], block: 40, street: 18, jitter: 0.3, palette: [0xd8d2c6, 0xc9c0b0, 0xb9c2c6, 0xe2dcd0, 0xa9b0a8, 0xc6b49c],
      keep: (x, z) => mainland(x, z) > 24 && Math.hypot(x - SX, z - SZ) > 90, height: (x, z) => Math.min(r.range(8, 16) + (r.chance(0.08) ? r.range(20, 50) : 0), clear(x, z, 90) - 30) });
    south.push(...cityGrid({ rand: rng(6), area: [680, -200, 3000, 480], block: 46, street: 18, jitter: 0.3, palette: [0xa0553a, 0xb9b0a0, 0x8a6a5a, 0xc9c0b0], keep: (x, z) => mainland(x, z) > 24 && r.chance(0.8), height: (x, z) => Math.min(r.range(9, 22), clear(x, z, 90) - 30) }));
    south.forEach((b) => { b.y = 3; });
    const north = cityGrid({ rand: rng(7), area: [-3200, -2250, 3200, -1560], block: 36, street: 20, jitter: 0.3, palette: [0xd8d2c6, 0xb9b4a8, 0xa9b2b6, 0xc9b8a4, 0x8a7a6a], keep: (x, z) => N(x, z) > 4 && N(x, z) < 110 && Math.abs(x + 1050) > 60 && r.chance(0.7), height: (x, z) => r.range(7, 13) + 60 * Math.exp(-((x / 260) ** 2) - ((z + 1640) / 90) ** 2) * r() });
    north.forEach((b) => { b.y = N(b.x, b.z) - 14; b.h += 12; });
    world.add(buildings([...south, ...north, ...sheds], concM, { cast: false }));
    const leafy = []; for (let i = 0; i < 520; i++) { const x = r.range(-1500, 1400), z = r.range(480, 1300); leafy.push([x, 3, z]); }
    trees(world, leafy, 'round', { size: 11, color: [0x3e7a3a, 0x4c8a42, 0x35693a, 0xc98a2a] });

    // ---- cloud left over from the rain, caught along the mountains; gulls of light on the water
    clouds(world, { count: 16, area: [-3800, -3000, 3800, -2100], y: [230, 340], size: 150, color: 0xffffff, self: 0.35, rand: rng(3) });
    clouds(world, { count: 8, area: [-4000, -4400, 4000, 3000], y: [1500, 2000], size: 200, color: 0xffffff, self: 0.3, rand: rng(4) });
    world.add(white.mesh(), steel.mesh(), dark.mesh(), conc.mesh());
    lights(world, [[250, 183, -150], [-1050, 114, -1054], [-1050, 114, -1526]], { color: 0xff4030, size: 6, power: 1.2 });

    return { world, path, focus, duration: 48 };
  },
};
