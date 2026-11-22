// Auckland on a bright, breezy afternoon: over the crater of Mt Eden, across the city to circle the pod of the Sky Tower, down to the Viaduct,
// over and then under the Harbour Bridge, and out along the Waitemata among the yachts toward Rangitoto.
import { THREE, mergeGeometries, createWorld, rng, mat, glowMat, facadeMat, mesh, box, cyl, sphere, lathe, beam, instances, buildings, cityGrid, terrain, water, trees, clouds, clearance, fbm, smooth, lerp } from '../kit.js';

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

export default {
  build() {
    const r = rng(1840);
    const world = createWorld({
      sky: { top: 0x2a6fd8, horizon: 0xbfe0f6, bottom: 0x8fb4c8, haze: 0.6 },
      sun: { dir: [-0.68, 0.62, -0.32], color: 0xfff6e2, power: 3.4, disc: 0xffffff, size: 0.0005 },
      ambient: { sky: 0xc8dcff, ground: 0x7c8468, power: 1.15 },
      fog: { color: 0xc6e0f2, density: 0.00019 }, exposure: 1.0, env: 0.85,
    });
    // north is -Z: the harbour lies north of the city, the Sky Tower stands at the origin, the bridge crosses at x = -1000.
    const EDEN = [-60, 1000, 430, 185, 95, 52], RANGI = [2700, -2700, 1500, 260, 60, 14], BX = -1000;
    const path = [[-60, 262, 1340], [-60, 230, 1050], [75, 200, 80], [70, 205, -40], [0, 208, -80], [-75, 200, -30], [-330, 150, -330], [-600, 100, -540], [-950, 95, -700], [-1240, 55, -820], [-1320, 26, -1010], [-1150, 20, -1030], [-820, 20, -1020], [-380, 30, -900], [40, 45, -1130]];
    const focus = [[0.1, 0, 205, 0], [0.2, 0, 205, 0], [0.31, 0, 200, 0], [0.37, -500, 10, -520], [0.45, BX, 50, -1000], [0.53, BX, 45, -1000], [0.62, BX, 40, -1020], [0.72, -300, 5, -950], [0.78, 1500, 80, -1900]];
    const clear = clearance(path);

    // ---- the isthmus: gentle ground, grassy volcanic cones with their craters, the harbour, the North Shore, Rangitoto's shield
    const cones = [EDEN, RANGI, [900, 1500, 330, 150, 60, 30], [-900, 1250, 260, 110, 50, 24], [950, -2150, 210, 85, 40, 14], [500, 700, 200, 70, 40, 16]];
    const cone = (x, z, [cx, cz, R, H, rim, dip]) => { const d = Math.hypot(x - cx, z - cz) * (1 + 0.12 * (fbm(x / 150, z / 150, 2) - 0.5)); return d > R ? 0 : d > rim ? H * ((R - d) / (R - rim)) ** 1.25 : H - dip * smooth(rim, rim * 0.25, d); };
    const shoreS = (x) => -450 - 100 * smooth(-650, -950, x) + 330 * smooth(850, 1700, x), shoreN = (x) => -1780 - 130 * Math.sin(x / 640) + 260 * smooth(1500, 2400, x);
    const land = (x, z) => {
      const south = smooth(-8, 8, z - shoreS(x)), north = smooth(8, -8, z - shoreN(x)) * smooth(RANGI[2] + 500, RANGI[2] + 900, Math.hypot(x - RANGI[0], z - RANGI[1]) + (x < 1700 ? 5000 : 0));
      let h = -9 + south * (13 + 16 * smooth(-300, 700, z) + 22 * (fbm(x / 500, z / 500, 3) - 0.4) * smooth(100, 900, z)) + north * (17 + 30 * fbm(x / 400, z / 400, 3));
      for (const c of cones) { const k = cone(x, z, c); if (k > 0) h = Math.max(h, k + (c === RANGI ? -2 : Math.max(h, 0))); }
      return h;
    };
    const C = (v) => new THREE.Color(v), tmp = new THREE.Color(), cGrass = C(0x79a84a), cLawn = C(0x93bd58), cBush = C(0x3f6b3a), cTown = C(0x9a9c98), cSand = C(0xe4d6ac), cLava = C(0x2f4a32);
    world.add(terrain({ size: 8400, center: [300, -500], seg: 260, height: land, color: (x, y, z, slope) => {
      const n = fbm(x / 80, z / 80, 3), rg = Math.hypot(x - RANGI[0], z - RANGI[1]) < RANGI[2];
      if (y < 1.2) return cSand;
      if (rg) return tmp.copy(cLava).lerp(cBush, n);
      tmp.copy(cGrass).lerp(cLawn, smooth(0.3, 0.7, n)).lerp(cBush, smooth(0.52, 0.66, fbm(x / 140 + 7, z / 140, 2)) * 0.8);
      return Math.abs(x) < 430 && z > -450 && z < 330 ? tmp.lerp(cTown, 0.9) : tmp;
    } }));
    water(world, 0, { size: [9000, 5200], x: 300, z: -2400, color: 0x2a8fb4, rough: 0.1, metal: 0.3, ripple: 55, strength: 0.36, env: 1.3, speed: 1.6 });

    // ---- the Sky Tower: eight-legged foot, slim concrete shaft, the pod of ringed decks, the banded needle
    const conc = mat(0xc2c5c8, { rough: 0.7 }), glassD = mat(0x24384c, { rough: 0.15, metal: 0.6 }), whiteM = mat(0xf4f4f0, { rough: 0.5 }), redM = mat(0xd2382c), y0 = land(0, 0);
    const st = [lathe([[7.2, 0], [6.6, 60], [6, 150], [5.8, 184]], conc, 0, 0, 0, 16), lathe([[5.8, 180], [13.5, 186], [15, 188], [15, 189.6]], conc, 0, 0, 0, 24), cyl(15.6, 15.6, 4.2, glassD, 0, 189.6, 0, 32), cyl(16.6, 16.6, 1.2, whiteM, 0, 193.8, 0, 32),
      cyl(14.2, 14.6, 4, glassD, 0, 195, 0, 32), cyl(17.2, 17.2, 1.4, whiteM, 0, 199, 0, 32), cyl(15, 15.4, 4.6, glassD, 0, 200.4, 0, 32), cyl(16.4, 16.4, 1.2, whiteM, 0, 205, 0, 32), lathe([[15.6, 206.2], [12, 210], [8.6, 216], [7, 224], [6.2, 236], [4.6, 248], [3.4, 252]], conc, 0, 0, 0, 24),
      cyl(8.4, 8.4, 2.4, glassD, 0, 217, 0, 24), cyl(5.2, 5.2, 1, whiteM, 0, 252, 0, 16), cyl(0.4, 0.6, 8, whiteM, 0, 322, 0, 6)];
    for (let i = 0; i < 7; i++) st.push(cyl(2.9 - i * 0.36, 3.2 - i * 0.36, 10, i % 2 ? redM : whiteM, 0, 253 + i * 10, 0, 10));
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; st.push(beam([Math.cos(a) * 19, 0, Math.sin(a) * 19], [Math.cos(a) * 6.4, 46, Math.sin(a) * 6.4], 3.2, conc)); }
    st.push(cyl(24, 24, 9, conc, 0, 0, 0, 8), box(70, 22, 56, facadeMat({ color: 0xb9b4a8, floor: 4.4, bay: 3.4, frame: [0.2, 0.2], glass: 0x2a3a4a, rough: 0.7 }), 46, 0, 22));
    world.add(...bake(st, [0, y0 - 1, 0]));

    // ---- the CBD and the waterfront: towers, wharves, the old ferry building, container cranes
    const glassT = [0x5f8fb8, 0x7fa8c4, 0x4a7498, 0x86b0b8, 0x3c5f84, 0x9ab8c8], stoneT = [0xd9d2c4, 0xc4b8a4, 0xe6e0d4, 0xa8a49c, 0xb89a80], far2 = (x, z, px, pz, d) => Math.hypot(x - px, z - pz) > d;
    const cbd = cityGrid({ rand: r, area: [-430, -430, 430, 330], block: 44, street: 18, jitter: 0.35, split: 0.3, keep: (x, z) => far2(x, z, 0, 0, 44) && !(x > 5 && x < 90 && z > -12 && z < 56),
      height: (x, z) => Math.min(28 + 150 * Math.exp(-((x - 60) ** 2) / 60000 - ((z + 190) ** 2) / 50000) * r.range(0.3, 1.05), clear(x, z, 75) - 32) });
    const tall = [], lowB = []; for (const b of cbd) { b.y = land(b.x, b.z) - 2; b.h += 2; const t = b.h > 62; (t ? tall : lowB).push(b); b.color = r.pick(t ? glassT : stoneT); if (b.h > 120) tall.push({ x: b.x, z: b.z, y: b.y + b.h, w: b.w * 0.55, d: b.d * 0.55, h: 14, color: b.color }); }
    world.add(buildings(tall, facadeMat({ floor: 3.9, bay: 2.3, frame: [0.07, 0.12], glass: 0x23486a, rough: 0.3, metal: 0.35 })), buildings(lowB, facadeMat({ floor: 3.8, bay: 3, frame: [0.26, 0.24], glass: 0x2a3640, rough: 0.85, ground: 3 })));
    const wharf = mat(0xa9a59c), shed = mat(0xe8e6e0), brick = facadeMat({ color: 0xc08a4a, floor: 4.4, bay: 3.2, frame: [0.3, 0.24], glass: 0x2a2a2a, rough: 0.85 }), craneM = mat(0xd2382c, { rough: 0.5 }), wf = [];
    for (const [x, w, L] of [[-140, 34, 190], [20, 30, 230], [150, 26, 170], [420, 190, 210], [660, 170, 190]]) wf.push(box(w, 4, L, wharf, x, -1.4, -450 - L / 2 + 8));
    wf.push(box(22, 12, 150, shed, -140, 2.6, -545), box(18, 8, 170, shed, 20, 2.6, -560), box(74, 14, 20, brick, 70, 3, -436), box(9, 30, 9, brick, 70, 3, -436), cyl(0, 6, 7, mat(0x6a6f74), 70, 33, -436, 4), mesh(new THREE.CircleGeometry(3, 16), whiteM, 70, 27, -440.7, { ry: Math.PI }));
    for (let i = 0; i < 6; i++) { const x = 350 + i * 68, z = -648; for (const s of [-1, 1]) wf.push(box(2, 44, 2, craneM, x + s * 11, 2.6, z), box(2, 44, 2, craneM, x + s * 11, 2.6, z + 22)); wf.push(box(26, 3, 26, craneM, x, 44, z + 11), box(4, 3, 96, craneM, x, 47, z - 14), beam([x, 66, z + 11], [x, 48, z - 58], 1.2, craneM), box(3, 20, 3, craneM, x, 47, z + 11)); }
    const boxes = []; for (let i = 0; i < 260; i++) boxes.push({ x: r.range(335, 740), y: 2.6 + Math.floor(r() * 3) * 2.6, z: r.range(-600, -470), w: 12, d: 2.5, h: 2.6, ry: r.chance(0.5) ? 0 : 1.571, color: r.pick([0xb5402f, 0x2f6aa0, 0xe0a52a, 0x3f7a5a, 0xd8d8d0, 0x8a4a2a]) });
    world.add(...bake(wf), buildings(boxes, mat(0xffffff, { rough: 0.7 }), { cast: false }));

    // ---- the Harbour Bridge: a steel truss arch, deck 43 m over the channel, long approach spans on piers
    const steel = mat(0x8f979c, { rough: 0.55, metal: 0.4 }), hb = [], deckY = (z) => 43 - 21 * ((z + 1010) / 520) ** 2, zs = [];
    for (let z = -1530; z <= -490; z += 40) zs.push(z);
    zs.forEach((z, i) => { if (i) hb.push(beam([0, deckY(zs[i - 1]), zs[i - 1]], [0, deckY(z), z], 3, steel).translateY(0)); });
    hb.forEach((m) => m.scale.set(9.4, 1, 1.02));
    for (const z of zs) if (Math.abs(z + 1010) > 130 && (z / 40) % 2 === 0) hb.push(box(20, deckY(z) + 6, 4, conc, 0, -8, z));
    for (const s of [-1, 1]) {
      const X = s * 13.5, up = (z) => 30 + 38 * (1 - ((z + 1010) / 125) ** 2), lo = (z) => 14 + 27 * (1 - ((z + 1010) / 125) ** 2);
      for (let k = 0; k < 10; k++) { const a = -1135 + k * 25, b = a + 25; hb.push(beam([X, up(a), a], [X, up(b), b], 1.6, steel), beam([X, lo(a), a], [X, lo(b), b], 1.6, steel), beam([X, lo(a), a], [X, up(b), b], 1, steel), beam([X, up(a), a], [X, lo(a), a], 1, steel)); if (s > 0) hb.push(beam([-X, up(b), b], [X, up(b), b], 1, steel)); }
      hb.push(box(6, 34, 10, conc, X, -8, -1137), box(6, 34, 10, conc, X, -8, -883));
    }
    world.add(...bake(hb, [BX, 0, 0]));

    // ---- the harbour alive: yachts under sail by the hundred, moored boats in the Viaduct and Westhaven, a ferry drawing its wake
    const sailG = mergeGeometries([G(8, 1.1, 2.4, 0, 0, 0).toNonIndexed(), new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0.4, 1), new THREE.Vector2(-4.4, 1.4), new THREE.Vector2(0.4, 13)]), { depth: 0.1, bevelEnabled: false }), new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0.8, 1.4), new THREE.Vector2(4.2, 1.4), new THREE.Vector2(0.8, 10)]), { depth: 0.1, bevelEnabled: false })]);
    const fleet = []; for (let i = 0; i < 900 && fleet.length < 150; i++) { const x = r.range(-2200, 2300), z = r.range(-1700, -640); if (land(x, z) < -6 && Math.abs(x - BX) > 60 && clear(x, z, 45) > 60) fleet.push({ x, z, a: r.range(-0.5, 0.5) + (r.chance(0.5) ? 0 : Math.PI), v: r.range(1.5, 3.5), s: r.range(1.3, 2.4) }); }
    const sails = instances(sailG, mat(0xffffff, { rough: 0.6, side: THREE.DoubleSide }), fleet), dummy = new THREE.Object3D(); world.add(sails);
    world.onUpdate((t) => {
      fleet.forEach((b, i) => { dummy.position.set(b.x + Math.cos(b.a) * b.v * t, 0.3 + Math.sin(t * 1.4 + i) * 0.2, b.z - Math.sin(b.a) * b.v * t); dummy.rotation.set(0.16 + Math.sin(t * 0.8 + i) * 0.06, b.a, 0); dummy.scale.setScalar(b.s); dummy.updateMatrix(); sails.setMatrixAt(i, dummy.matrix); });
      sails.instanceMatrix.needsUpdate = true;
    });
    const moorG = mergeGeometries([G(9, 1.2, 2.6, 0, 0.2, 0), new THREE.CylinderGeometry(0.07, 0.09, 11, 4).translate(0.6, 6, 0), G(4, 0.9, 1.9, -1.2, 1.2, 0)]), moor = [];
    for (const [x0, x1, z0, n] of [[-520, -220, -470, 5], [-960, -640, -590, 7]]) for (let px = x0; px <= x1; px += 44) { moor.push({ x: px, y: 0.2, z: z0 - n * 6.5, sx: 0.4, sy: 0.5, sz: n * 5.4, color: 0x9a8a72 }); for (let k = 0; k < n; k++) for (const s of [-1, 1]) if (r.chance(0.85)) moor.push({ x: px + s * 8, y: 0.1, z: z0 - k * 13 + r.range(-2, 2), ry: s > 0 ? 0 : Math.PI, s: r.range(0.8, 1.2), color: 0xf6f4ee }); }
    world.add(instances(moorG, mat(0xffffff, { rough: 0.5 }), moor));
    const ferry = new THREE.Group(), foam = glowMat(0xffffff, 1, { opacity: 0.55 });
    ferry.add(...bake([box(30, 3, 9, mat(0x1f4f8a), 0, 0, 0), box(24, 3.4, 8, whiteM, -1, 3, 0), box(12, 2.6, 6.6, whiteM, 2, 6.4, 0), cyl(0.9, 1, 3, redM, -6, 6.4, 0, 8)]));
    for (const s of [-1, 1]) ferry.add(mesh(new THREE.PlaneGeometry(130, 5).rotateX(-Math.PI / 2).translate(-65, 0.25, 0), foam, -12, 0, s * 3, { ry: s * 0.16, cast: false, receive: false }));
    ferry.add(mesh(new THREE.PlaneGeometry(70, 7).rotateX(-Math.PI / 2).translate(-35, 0.3, 0), foam, -14, 0, 0, { cast: false, receive: false })); world.add(ferry);
    world.onUpdate((t) => { const u = (t * 0.012 + 0.2) % 1; ferry.position.set(lerp(-250, 820, u), 0.6, lerp(-700, -1640, u)); ferry.rotation.y = Math.atan2(940, 1070); });

    // ---- suburbs of small houses with coloured roofs, bush and park trees, fair-weather clouds
    const homes = cityGrid({ rand: rng(9), area: [-3000, -3300, 3600, 2400], block: 22, street: 15, jitter: 0.25, split: 0, fill: 0.7, palette: [0xf0ece2, 0xe6dcc8, 0xd9e2e4, 0xf4e9d2, 0xdcd0c0],
      keep: (x, z) => { const y = land(x, z); return y > 4 && y < 70 && !(Math.abs(x) < 450 && z > -450 && z < 350) && cones.every((c) => far2(x, z, c[0], c[1], c[2] * 0.72)) && fbm(x / 170, z / 170, 2) < 0.6 && far2(x, z, RANGI[0], RANGI[1], RANGI[2] + 300); }, height: () => r.range(4, 7) });
    homes.forEach((b) => { b.x += r.range(-5, 5); b.z += r.range(-5, 5); b.ry = r.range(-0.5, 0.5); b.y = land(b.x, b.z) - 1.5; b.h += 1.5; });
    world.add(buildings(homes, mat(0xffffff, { rough: 0.9 }), { cast: false }), instances(gable(1, 1, 1), mat(0xffffff, { rough: 0.6 }), homes.map((b) => ({ x: b.x, y: b.y + b.h, z: b.z, sx: b.w * 1.1, sy: 2.6, sz: b.d * 1.1, ry: b.ry, color: r.pick([0xb5402f, 0x4f5a66, 0x8a3a2c, 0x5f7f9a, 0x6a6f74, 0x3f6a4a, 0xc4744a]) })), { cast: false }));
    const bush = []; for (let i = 0; i < 20000 && bush.length < 520; i++) { const x = r.range(-1600, 1700), z = r.range(-2300, 1900), y = land(x, z); if (y > 5 && clear(x, z, 30) > y + 40 && (fbm(x / 140 + 7, z / 140, 2) > 0.58 || cones.some((c) => !far2(x, z, c[0], c[1], c[2] * 0.75) && far2(x, z, c[0], c[1], c[4] * 1.5) && r.chance(0.25))) && !(Math.abs(x) < 440 && z > -450 && z < 340)) bush.push([x, y - 0.5, z]); }
    trees(world, bush, 'round', { size: 14, color: [0x3f6b3a, 0x4a7a3c, 0x356034, 0x5a8a44] }).children.forEach((m, i) => { if (i) m.castShadow = false; });
    clouds(world, { count: 20, area: [-4000, -4500, 4500, 3000], y: [1100, 1600], size: 170, color: 0xffffff, self: 0.75, rand: rng(2) });

    return { world, path, focus, duration: 50 };
  },
};
