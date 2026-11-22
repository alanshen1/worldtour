// Hawaii in the late afternoon: along the fluted green sea cliffs past a waterfall, low over the surf of Waikiki with its canoes and palms,
// up round the seaward flank of Diamond Head and across its crater, out towards a rainbow and a volcano smoking on the horizon.
import { THREE, mergeGeometries, createWorld, rng, fbm, clamp, lerp, smooth, mat, glowMat, facadeMat, box, mesh, lathe, tube, instances, buildings, cityGrid, terrain, water, trees, lights, clouds, clearance } from '../kit.js';

const TAU = Math.PI * 2;
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
/** Collects static pieces into one geometry; `tint` paints a piece (for materials drawn with vertex colours). */
function pile() {
  const list = [];
  return {
    add(g, x = 0, y = 0, z = 0, tint = 0xffffff) {
      g = g.index ? g.toNonIndexed() : g; g.translate(x, y, z);
      const c = new THREE.Color(tint), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g); return this;
    },
    geo() { return mergeGeometries(list); },
  };
}
/** A ribbon of n quads; f(i) gives its [left, right] points at step i, or null to leave a gap. */
function strip(n, f) {
  const p = [], uv = [];
  for (let i = 0; i < n; i++) { const a = f(i), b = f(i + 1); if (a && b) { p.push(...a[0], ...a[1], ...b[1], ...a[0], ...b[1], ...b[0]); uv.push(0, i / n, 1, i / n, 1, (i + 1) / n, 0, i / n, 1, (i + 1) / n, 0, (i + 1) / n); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}

export default {
  build() {
    const r = rng(1959);
    const world = createWorld({
      sky: { top: 0x2a78d4, horizon: 0xc4e6f4, bottom: 0x8fc4dc, haze: 0.5 },
      sun: { dir: [-0.74, 0.5, 0.45], color: 0xfff0d2, power: 3.3, disc: 0xfff6e0, size: 0.0006 },
      ambient: { sky: 0xa6d2ff, ground: 0x6f8f5c, power: 1.0 },
      fog: { color: 0xcde8f3, density: 0.0002 }, exposure: 1.05, env: 0.9,
    });
    const path = [[-2000, 70, 430], [-1850, 66, 405], [-1560, 52, 340], [-1220, 34, 250], [-850, 18, 170], [-350, 16, 60], [150, 28, 135], [480, 68, 470], [900, 150, 640], [1110, 232, 230], [1150, 262, -100], [1450, 232, -170], [1750, 180, -30], [1980, 155, 130]];
    const focus = [[0.07, -1590, 130, -40], [0.14, -1590, 120, -60], [0.3, -500, 30, -160], [0.42, -300, 40, -200], [0.52, 900, 110, -100], [0.64, 950, 120, -150], [0.72, 960, 60, -150], [0.8, 1200, 110, -170]];
    const clear = clearance(path);

    // ---- the shape of the islands: fluted sea cliffs to the west, the flat of Waikiki under the Ko'olau range, the tuff cone of Diamond Head
    const shore = (x) => (x < -1150 ? 30 + 45 * Math.sin((x + 1150) / 210) : x < 300 ? 30 - 110 * Math.sin(Math.PI * (x + 1150) / 1450) : 30);
    const spurAt = (x, period) => 1 - Math.abs(Math.sin(x * Math.PI / period + 1.3 * Math.sin(x / 310)));
    const DX = 950, DZ = -150, rimAt = (a) => 166 + 62 * Math.exp(-(((a - 0.85) / 0.5) ** 2)) + 12 * Math.sin(5 * a + 1), gully = (a) => Math.abs(Math.sin(11 * a + 1.5 * Math.sin(3 * a)));
    const H = (x, z) => {
      const d = Math.min(shore(x) - z, 1540 + 0.3 * z - x), cliffs = smooth(-1050, -1300, x), n = fbm(x / 420, z / 420, 3);
      const spur = spurAt(x, 140), dc = d + 70 * spur - 20, flute = 1 - 0.09 * Math.abs(Math.sin(x * Math.PI / 23)) * smooth(0, 120, dc);
      const wall = (250 + 130 * n) * smooth(0, 150 + 330 * (1 - spur) ** 1.4, dc) ** 0.8 * flute;
      const spur2 = spurAt(x + 60, 190), dm = d - 900 - 520 * (1 - spur2) ** 1.3;
      const range = (390 + 220 * n) * smooth(0, 620, dm) ** 0.85 * (1 - 0.08 * Math.abs(Math.sin(x * Math.PI / 31)) * smooth(0, 200, dm)) + 26 * smooth(500, 900, d) * fbm(x / 130, z / 130, 2);
      const land = lerp((1 + 1.5 * smooth(0, 40, d)) * smooth(-6, 4, d) + range, wall, cliffs);
      const rx = x - DX, rz = z - DZ, q = Math.hypot(rx, rz), a = Math.atan2(rz, -rx), rim = rimAt(a);
      const cone = q > 330 ? rim * (1 - clamp((q - 330) / 250)) ** 1.5 * (1 - 0.24 * gully(a) * clamp((q - 336) / 70)) : lerp(56, rim, smooth(205, 330, q) ** 1.6) + 5 * fbm(x / 60, z / 60, 2);
      const sea = -40 * (1 - smooth(-30, 2, Math.max(d, cliffs * dc)));
      const h = Math.max(land * smooth(-8, 6, d) + sea, cone > 0.4 ? cone : -40);
      return h > 8 ? Math.min(h, clear(x, z, 80) - 28) : h;
    };
    const fine = (x, z, x0, x1, z0, z1) => smooth(x0, x0 + 40, x) * smooth(x1, x1 - 40, x) * smooth(z0, z0 + 40, z) * smooth(z1, z1 - 40, z);
    const c1 = new THREE.Color(), c2 = new THREE.Color();
    const paint = (x, y, z, slope) => {
      const q = Math.hypot(x - DX, z - DZ), n = fbm(x / 90, z / 90, 3);
      if (q < 590 && y > 2) { const g = q > 330 ? gully(Math.atan2(z - DZ, DX - x)) : n; const band = 0.82 + 0.18 * Math.sin(y * 0.42 + n * 5); return (slope > 0.5 ? c1.set(0x8f7650).lerp(c2.set(0x5f5a40), n) : c1.set(0x5f7a36).lerp(c2.set(0xb8a068), smooth(0.25, 0.8, g * 0.7 + n * 0.5))).multiplyScalar(q > 300 ? band : 1); }
      if (y < 2.6) return x < -1150 ? 0x4a443c : x < 420 || x > 1300 ? 0xe8d8a6 : 0x8f9a78;
      if (y < 9 && x > -1150) return c1.set(0x8f9a78).lerp(c2.set(0x6f9a52), n);
      return slope > 0.55 ? c1.set(0x6f5238).lerp(c2.set(0x3c6a30), smooth(0.25, 0.6, n)) : c1.set(0x3f8434).lerp(c2.set(0x6fa843), smooth(0.35, 0.75, n) * 0.8);
    };
    world.add(terrain({ size: [6600, 4300], center: [0, -1250], seg: 210, color: paint, height: (x, z) => H(x, z) - 7 * Math.max(fine(x, z, -2700, -1000, -750, 150), fine(x, z, 330, 1570, -770, 470)) }));
    world.add(terrain({ size: [1700, 900], center: [-1850, -300], seg: 210, color: paint, height: (x, z) => H(x, z) + 0.5 }), terrain({ size: [1240, 1240], center: [950, -150], seg: 150, color: paint, height: (x, z) => H(x, z) + 0.5 }));

    // ---- the sea: turquoise over the reef, deepening to blue
    const sea = water(world, 0, { size: 9000, color: 0xffffff, rough: 0.08, metal: 0.25, strength: 0.3, ripple: 60 });
    const sg = new THREE.PlaneGeometry(9000, 9000, 200, 200).rotateX(-Math.PI / 2), sp = sg.attributes.position, sc = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), z = sp.getZ(i), off = Math.min(x > 1500 ? 1e4 : (z - shore(x)) * (x < -1150 ? 2.2 : 1), (Math.hypot(x - DX, z - DZ) - 560) * 1.8, Math.abs(Math.hypot(x - 2380, z - 560) - 60) * 2.5);
      c1.set(0x2fd0bc).lerp(c2.set(0x1790bc), smooth(60, 330, off)).lerp(c2.set(0x0f5c9c), smooth(300, 1000, off)).toArray(sc, i * 3);
    }
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3)); sea.geometry.dispose(); sea.geometry = sg; sea.material.vertexColors = true;

    // ---- surf: bands of foam rolling in to the beach, a fringe of white along every shore
    const foamM = () => glowMat(0xffffff, 1, { opacity: 0.9, side: THREE.DoubleSide }), bands = [];
    for (let k = 0; k < 6; k++) {
      const g = strip(150, (i) => { const x = -1130 + i * 9.8, w = 22 * (fbm(x / 70 + k * 31, k * 7.7, 2) - 0.38), z = shore(x) + 16 * Math.sin(x / 110 + k * 2); return w > 0.8 ? [[x, 0.35, z + w], [x, 0.35, z - w * 0.5]] : null; });
      const m = mesh(g, foamM(), 0, 0, 0, { cast: false, receive: false }); bands.push(m); world.add(m);
      // surfers riding just ahead of the white water
      const riders = pile();
      for (let j = 0; j < 3; j++) { const x = -1000 + r.range(0, 1150), z = shore(x) - 7 - r.range(0, 5); riders.add(new THREE.SphereGeometry(1, 8, 5).scale(1.5, 0.08, 0.34).rotateY(0.5), x, 0.5, z, r.pick([0xf4f0e0, 0xf2d24a, 0x4ac0d8, 0xf08a5a])).add(B(0.42, 1.25, 0.34).rotateZ(0.25), x, 0.6, z, 0x8a5a3c).add(B(0.4, 0.4, 0.36), x - 0.35, 1.8, z, 0x3a2a20); }
      m.add(mesh(riders.geo(), mat(0xffffff, { vertexColors: true, rough: 0.7 }), 0, 0, 0, { receive: false }));
    }
    const fringe = [strip(170, (i) => { const x = -1180 + i * 9.4, w = 2.5 + 4 * fbm(x / 40, 3, 2); return [[x, 0.3, shore(x) + w + 3], [x, 0.3, shore(x) - 2]]; }),
      strip(160, (i) => { const x = -3300 + i * 13.5, z = shore(x) + 52 - 70 * (1 - spurAt(x, 140)) ** 1.2, w = 4 + 9 * fbm(x / 50, 9, 2); return [[x, 0.3, z + w], [x, 0.3, z - 6]]; }),
      strip(90, (i) => { const a = 0.35 + i / 90 * 3.9, w = 5 + 9 * fbm(a * 9, 5, 2); return [[DX - Math.cos(a) * (562 + w), 0.3, DZ + Math.sin(a) * (562 + w)], [DX - Math.cos(a) * 552, 0.3, DZ + Math.sin(a) * 552]]; })]
      .map((g) => world.add(mesh(g, foamM(), 0, 0, 0, { cast: false, receive: false })));
    world.onUpdate((t) => {
      bands.forEach((m, k) => { const p = (k / 6 + t / 27) % 1; m.position.z = lerp(340, 10, p); m.material.opacity = 0.92 * smooth(0, 0.12, p) * (1 - smooth(0.88, 1, p)); });
      fringe.forEach((m, k) => { m.material.opacity = 0.62 + 0.3 * Math.sin(t * 0.9 + k * 2); });
    });

    // ---- Waikiki: the curve of sand, the promenade, hotel towers, the pink Royal Hawaiian, umbrellas, pools
    world.add(mesh(strip(132, (i) => { const x = -1180 + i * 12; return [[x, 0.25, shore(x) + 9], [x, 3, shore(x) - 50]]; }), mat(0xeedcae, { rough: 0.95, side: THREE.DoubleSide }), 0, 0, 0, { cast: false }));
    world.add(mesh(strip(132, (i) => { const x = -1180 + i * 12; return [[x, 3.1, shore(x) - 62], [x, 3.1, shore(x) - 78]]; }), mat(0x5c5f66, { rough: 0.9, side: THREE.DoubleSide }), 0, 0, 0, { cast: false }));
    const hotels = [], tones = [0xf4efe4, 0xe9e0cc, 0xf0d9c0, 0xd9e6e6, 0xf6f2ea, 0xe6cfc0, 0xcfe0d8];
    for (let row = 0; row < 4; row++) for (let x = -1100; x < 250; x += r.range(46, 62)) {
      if (r.chance(0.18) || (row < 2 && Math.abs(x + 450) < 75)) continue;
      const z = shore(x) - 104 - row * 66 - r.range(-8, 8), h = Math.min(r.range(52, 132) * (1 - row * 0.15), clear(x, z, 90) - 30);
      hotels.push({ x, z, w: r.range(27, 40), d: r.range(24, 32), h, color: r.pick(tones), ry: r.range(-0.2, 0.2) });
    }
    const hotelM = facadeMat({ floor: 3.2, bay: 4.2, frame: [0.07, 0.3], glass: 0x3c6c88, lit: 0.12, night: 0.6, rough: 0.7, ground: 5 });
    const lids = (list, c) => buildings(list.map((b) => ({ x: b.x, z: b.z, y: (b.y ?? 0) + b.h, w: b.w + 1, d: b.d + 1, h: 1.2, ry: b.ry })), mat(c, { rough: 0.8 }), { cast: false });
    world.add(buildings(hotels, hotelM), lids(hotels, 0xf1ede4));
    const RX = -450, RZ = shore(-450) - 112, pinkM = facadeMat({ color: 0xee9aa6, floor: 3.6, bay: 3.4, frame: [0.3, 0.25], glass: 0x4a3a40, lit: 0.2, night: 0.6 }), tile = mat(0xb5482f, { rough: 0.8 });
    const royal = [{ x: RX, z: RZ, w: 96, d: 24, h: 22 }, { x: RX - 30, z: RZ - 24, w: 26, d: 40, h: 22 }, { x: RX + 30, z: RZ - 24, w: 26, d: 40, h: 22 }, { x: RX, z: RZ + 2, w: 16, d: 16, h: 34 }, { x: RX - 46, z: RZ + 2, w: 11, d: 11, h: 28 }, { x: RX + 46, z: RZ + 2, w: 11, d: 11, h: 28 }];
    world.add(buildings(royal, pinkM), instances(new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), tile, royal.map((b) => ({ x: b.x, y: b.h, z: b.z, sx: b.w + 2, sy: b.w > 20 ? 6 : 7, sz: b.d + 2 }))));
    const shades = [], pools = [];
    for (let i = 0; i < 300; i++) { const x = r.range(-1120, 380); shades.push({ x, y: 2.2 + r.range(0, 0.6), z: shore(x) - r.range(8, 44), s: r.range(0.8, 1.2), color: r.pick([0xf04a3a, 0xf2c230, 0x2f8ad0, 0xf4f0e6, 0x2fae8a, 0xf07a2a]) }); }
    world.add(instances(new THREE.ConeGeometry(1.7, 0.9, 8).translate(0, 1.6, 0), mat(0xffffff, { rough: 0.8 }), shades, { cast: false }));
    for (let i = 0; i < 26; i++) { const x = r.range(-1080, 240); pools.push({ x, z: shore(x) - r.range(84, 92), w: r.range(12, 22), d: 8, h: 0.5, y: 2.9 }); }
    world.add(buildings(pools, mat(0x46d0e0, { rough: 0.1, metal: 0.2, emissive: 0x2a9ab0, glow: 0.4 }), { cast: false }));
    // the low town behind, running back to the foot of the mountains
    const town = cityGrid({ rand: rng(4), area: [-1150, -1150, 1500, -200], block: 40, street: 15, palette: [0xf2ede2, 0xe6dcc8, 0xd8e2dc, 0xf0e2d0, 0xcfd8d0, 0xe9d2c2], jitter: 0.3,
      keep: (x, z) => shore(x) - z > 385 && H(x, z) < 12 && H(x, z) > 2 && Math.hypot(x - DX, z - DZ) > 640, height: (x, z) => r.range(6, 15) + (r.chance(0.07) ? r.range(25, 60) : 0) });
    world.add(buildings(town, facadeMat({ floor: 3.3, bay: 3.6, frame: [0.25, 0.28], glass: 0x4a6a80, lit: 0.1, night: 0.5 })), lids(town, 0xd9d4c8));

    // ---- palms everywhere, banyans in the park, a white lighthouse at the foot of Diamond Head
    const palms = [], shady = [];
    for (let x = -1170; x < 400; x += 6.5) palms.push([x + r.range(-3, 3), 3, shore(x) - r.range(47, 60)]);
    for (let i = 0; i < 420; i++) { const x = r.range(-1150, 300), z = shore(x) - r.range(82, 380); if (hotels.every((b) => Math.abs(b.x - x) > b.w / 2 + 3 || Math.abs(b.z - z) > b.d / 2 + 3) && !(Math.abs(x - RX) < 52 && Math.abs(z - RZ + 10) < 40)) palms.push([x, 2.5, z]); }
    for (let i = 0; i < 150; i++) { const x = r.range(300, 640), z = r.range(-420, 0); if (Math.hypot(x - DX, z - DZ) > 560) (r.chance(0.6) ? palms : shady).push([x, H(x, z), z]); }
    for (let i = 0; i < 70; i++) { const x = r.range(-2650, -1250), z = shore(x) - r.range(-10, 90), y = H(x, z); if (y > 1.5 && y < 40) palms.push([x, y, z]); }
    for (let i = 0; i < 60; i++) { const a = r() * TAU, q = r.range(0, 190); shady.push([DX + Math.cos(a) * q, H(DX + Math.cos(a) * q, DZ + Math.sin(a) * q), DZ + Math.sin(a) * q]); }
    const scrub = []; for (let i = 0; i < 3400; i++) { const a = r() * TAU, q = 560 * Math.sqrt(r()), x = DX + Math.cos(a) * q, z = DZ + Math.sin(a) * q, y = H(x, z); if (y > 3 && (q < 300 || gully(Math.atan2(z - DZ, DX - x)) < 0.5)) scrub.push({ x, y, z, s: r.range(2, 5.5), sy: r.range(1.4, 3), color: r.pick([0x4f6a30, 0x62783a, 0x3f5a2c, 0x7a8440]) }); }
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { rough: 0.95, flat: true }), scrub, { cast: false }));
    trees(world, palms, 'palm', { size: 13 }); trees(world, shady, 'round', { size: 11, color: [0x3f7a36, 0x4c8a3c, 0x356c34] });
    const white = mat(0xf6f3ec, { rough: 0.6 }), LA = 1.55, lx = DX - Math.cos(LA) * 548, lz = DZ + Math.sin(LA) * 548, ly = H(lx, lz);
    world.add(lathe([[2.4, 0], [1.7, 13], [2.3, 13.2], [2.3, 14]], white, lx, ly, lz, 10), lathe([[1.5, 0], [1.5, 2.2], [0.1, 3.6]], tile, lx, ly + 14, lz, 8), box(9, 4, 7, white, lx + 9, ly - 1, lz - 3), box(10, 0.8, 8, tile, lx + 9, ly + 3, lz - 3));

    // ---- the waterfall, down the back of a hanging valley and off the cliff to the sea
    let WX = -1600; for (let x = -1660; x < -1540; x += 2) if (spurAt(x, 140) < spurAt(WX, 140)) WX = x;
    const fc = document.createElement('canvas'), fx = fc.getContext('2d'); fc.width = 64; fc.height = 256;
    for (let i = 0; i < 260; i++) { fx.fillStyle = `rgba(255,255,255,${r.range(0.25, 0.95)})`; fx.fillRect(r.range(0, 64), r.range(-40, 256), r.range(1, 5), r.range(20, 90)); }
    const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(1, 5);
    const fallM = new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xffffff });
    const top = shore(WX) - 330, fall = strip(110, (i) => { const z = lerp(top, shore(WX) + 40, i / 110), w = 5 + 5 * i / 110; return [[WX - w, H(WX, z) + 2.2, z], [WX + w, H(WX, z) + 2.2, z]]; });
    world.add(mesh(fall, fallM, 0, 0, 0, { cast: false, receive: false }), mesh(fall, glowMat(0xe8f6ff, 1, { opacity: 0.55, side: THREE.DoubleSide }), 0, -0.6, 0, { cast: false, receive: false, scale: [1, 1, 1] })); world.onUpdate((t) => { ft.offset.y = t * 0.55; });
    lights(world, Array.from({ length: 14 }, () => [WX + r.range(-12, 12), r.range(2, 16), shore(WX) + r.range(20, 50)]), { color: 0xffffff, size: 26, power: 0.22 });

    // ---- outrigger canoes and bright-sailed catamarans
    const canoe = pile().add(new THREE.SphereGeometry(1, 10, 6).scale(5.4, 0.42, 0.42), 0, 0.3, 0, 0xe8b830).add(new THREE.SphereGeometry(1, 8, 5).scale(3.2, 0.2, 0.2), 0, 0.15, 2.3, 0xe8b830).add(B(0.14, 0.14, 2.6), -1.6, 0.6, 1.2, 0x5a3a20).add(B(0.14, 0.14, 2.6), 1.6, 0.6, 1.2, 0x5a3a20);
    for (let i = 0; i < 6; i++) canoe.add(B(0.4, 0.8, 0.44), -3.4 + i * 1.3, 0.5, 0, i % 2 ? 0x8a5a3c : 0x9a6a48).add(B(0.34, 0.34, 0.34), -3.4 + i * 1.3, 1.3, 0, 0x2a2018).add(B(0.08, 1.3, 0.2).rotateX(i % 2 ? 0.7 : -0.7), -3.2 + i * 1.3, 0.1, i % 2 ? 0.6 : -0.6, 0xc9a060);
    const canoeM = mat(0xffffff, { vertexColors: true, rough: 0.6 }), canoes = [0, 1, 2, 3].map(() => world.add(mesh(canoe.geo(), canoeM)));
    world.onUpdate((t) => canoes.forEach((m, i) => { const x = -1000 + ((i * 330 + t * 4.5) % 1250); m.position.set(x, 0.1 + 0.25 * Math.sin(t * 1.4 + i), shore(x) + 95 + i * 34); m.rotation.z = 0.05 * Math.sin(t * 1.4 + i); }));
    const cat = pile();
    for (const s of [-1, 1]) cat.add(new THREE.SphereGeometry(1, 8, 5).scale(6, 0.5, 0.6), 0, 0.4, s * 2.2, 0xf4f0e6);
    cat.add(B(5, 0.2, 4.4), 0, 0.8, 0, 0xf4f0e6).add(B(0.16, 13, 0.16), 0.6, 0.9, 0, 0xd0d0d0);
    const sails = instances(new THREE.ConeGeometry(4.6, 12, 3).scale(1, 1, 0.05).translate(-1.6, 7.6, 0), mat(0xffffff, { rough: 0.7, side: THREE.DoubleSide }), [], {});
    const fleet = Array.from({ length: 16 }, (_, i) => { const x = i < 9 ? r.range(-1300, 700) : r.range(1600, 2900); return { x, y: 0, z: i < 9 ? shore(x) + r.range(380, 900) : r.range(-250, 900), ry: r.range(-0.6, 0.6), s: r.range(0.9, 1.3), color: r.pick([0xf2c230, 0xf04a3a, 0xf4f0e6, 0x2f8ad0, 0xf07a2a]) }; });
    world.add(instances(cat.geo(), canoeM, fleet.map((b) => ({ ...b, color: undefined }))), instances(sails.geometry, sails.material, fleet));

    // a rocky islet off the point, ringed with foam
    world.add(lathe([[130, -6], [118, 3], [96, 22], [60, 44], [24, 56], [0, 58]], mat(0x6a6048, { rough: 0.95, flat: true }), 2380, 0, 560, 11, { scale: [1.3, 1, 0.8], ry: 0.4 }), lathe([[60, 44.2], [24, 56.2], [0, 58.2]], mat(0x5f8a3c, { rough: 0.95, flat: true }), 2380, 0, 560, 11, { scale: [1.3, 1, 0.8], ry: 0.4, cast: false }));
    world.add(mesh(new THREE.RingGeometry(112, 132, 40).rotateX(-Math.PI / 2), glowMat(0xffffff, 1, { opacity: 0.75 }), 2380, 0.3, 560, { scale: [1.3, 1, 0.8], ry: 0.4, cast: false, receive: false }));

    // ---- the volcano on the horizon: a broad shield, lava glowing in its crater and down its flank, a plume leaning on the trade wind
    const VX = 4700, VZ = 2000, lavaM = glowMat(0xff5a1a, 2.4, { toneMapped: false });
    world.add(lathe([[1900, -10], [1400, 70], [900, 220], [450, 380], [170, 455], [110, 440], [0, 425]], mat(0x4c463e, { rough: 0.95 }), VX, 0, VZ, 40, { cast: false }), mesh(new THREE.CircleGeometry(112, 24).rotateX(-Math.PI / 2), lavaM, VX, 442, VZ));
    for (let i = 0; i < 4; i++) { const a = 3.3 + i * 0.5, P = (q, y) => [VX + Math.cos(a + (i - 1.5) * 0.0004 * q) * q, y, VZ + Math.sin(a + (i - 1.5) * 0.0004 * q) * q]; world.add(tube([P(165, 458), P(300, 425), P(470, 376), P(700, 290), P(950 + i * 60, 208)], 7 - i, lavaM, { radial: 5 })); }
    const smoke = []; for (let i = 0; i < 46; i++) { const u = i / 45, s = 70 + 330 * u; smoke.push({ x: VX - 900 * u * u + r.range(-0.3, 0.3) * s, y: 480 + 1250 * Math.sqrt(u) + r.range(-0.2, 0.2) * s, z: VZ - 500 * u * u + r.range(-0.3, 0.3) * s, sx: s, sy: s * 0.8, sz: s, color: new THREE.Color(0xd08a6a).lerp(new THREE.Color(0xf2ece8), u).getHex() }); }
    const smokeM = new THREE.MeshLambertMaterial({ color: 0xffffff }); smokeM.emissive = new THREE.Color(0x4a4040);
    world.add(instances(new THREE.IcosahedronGeometry(1, 2), smokeM, smoke, { cast: false, receive: false }));
    lights(world, [[VX, 470, VZ]], { color: 0xff6a20, size: 900, power: 0.8 });

    // ---- a rainbow over the sea where a shower is passing, and the trade-wind clouds
    const bow = [], hue = new THREE.Color(), BN = 72, BR = 9;
    for (let i = 0; i <= BN; i++) for (let k = 0; k <= BR; k++) { const a = Math.PI * i / BN, q = 1900 + 150 * k / BR, e = Math.sin(Math.PI * k / BR) ** 0.8; hue.setHSL(0.78 - 0.78 * k / BR, 1, 0.5).multiplyScalar(e * 0.6); bow.push([Math.cos(a) * q, Math.sin(a) * q, hue.r, hue.g, hue.b]); }
    const bg = new THREE.BufferGeometry(), bi = []; for (let i = 0; i < BN; i++) for (let k = 0; k < BR; k++) { const a = i * (BR + 1) + k, b = a + BR + 1; bi.push(a, b, a + 1, b, b + 1, a + 1); }
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bow.flatMap((v) => [v[0], v[1], 0]), 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(bow.flatMap((v) => v.slice(2)), 3)); bg.setIndex(bi);
    const rainbow = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    rainbow.position.set(3500, -620, 1150); rainbow.rotation.y = -Math.atan2(160, 230) - Math.PI / 2; rainbow.frustumCulled = false; world.add(rainbow);
    clouds(world, { count: 30, area: [-3300, -3300, 3000, -1500], y: [560, 760], size: 210, color: 0xffffff, self: 0.3, rand: rng(6) });
    clouds(world, { count: 9, area: [-2700, -700, -1250, -250], y: [470, 560], size: 150, color: 0xffffff, self: 0.3, rand: rng(7) });
    clouds(world, { count: 26, area: [-3500, 900, 5200, 4200], y: [750, 1200], size: 170, color: 0xfff6ea, self: 0.3, rand: rng(8) });

    return { world, path, focus, duration: 50 };
  },
};
