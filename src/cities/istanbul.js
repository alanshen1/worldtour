// Istanbul at sunset: in from the Marmara towards the domes and minarets of the old city, between the Blue Mosque and Hagia Sophia,
// over Topkapı and the Golden Horn to the Galata Tower, then out across the Bosphorus among the ferries and round the Maiden's Tower.
import { THREE, mergeGeometries, createWorld, rng, fbm, lerp, smooth, mat, glowMat, facadeMat, mesh, box, cyl, sphere, lathe, instances, terrain, water, trees, lights, traffic, suspensionBridge, clouds, clearance } from '../kit.js';

const PI = Math.PI;
// ferries: parts [geometry, material] that sail together along straight lines [x0, z0, x1, z1]
function fleet(world, parts, lines, n, speed, r) {
  const items = Array.from({ length: n }, (_, i) => { const l = lines[i % lines.length]; return { l, off: r(), len: Math.hypot(l[2] - l[0], l[3] - l[1]), ry: Math.atan2(l[2] - l[0], l[3] - l[1]) }; });
  const ims = parts.map(([g, m]) => world.add(instances(g, m, items))), d = new THREE.Object3D(), at = (it, t, v) => { const u = (it.off + t * speed / it.len) % 1; return v.set(it.l[0] + (it.l[2] - it.l[0]) * u, 0, it.l[1] + (it.l[3] - it.l[1]) * u); };
  world.onUpdate((t) => { items.forEach((it, i) => { at(it, t, d.position); d.rotation.y = it.ry; d.updateMatrix(); for (const im of ims) im.setMatrixAt(i, d.matrix); }); for (const im of ims) im.instanceMatrix.needsUpdate = true; });
  return (i, t, v) => at(items[i % n], t, v);
}

export default {
  build() {
    const r = rng(1453);
    const world = createWorld({
      sky: { top: 0x35549c, horizon: 0xffb25e, bottom: 0x6a5a58, haze: 0.5 },
      sun: { dir: [-0.85, 0.13, 0.45], color: 0xffb070, power: 3.0, disc: 0xffc888, size: 0.0013 },
      ambient: { sky: 0x8a9ad0, ground: 0x6a4a38, power: 0.85 },
      fog: { color: 0xe6a878, density: 0.00033 }, exposure: 1.0, env: 0.9,
    });
    // x is east, z is south. The old city is the peninsula in the south-west, Galata lies north across the Golden Horn, Asia east across the Bosphorus.
    const path = [[980, 60, 430], [450, 80, 305], [150, 100, 270], [-70, 106, 262], [-260, 106, 248], [-310, 102, 110], [-200, 96, -30], [0, 82, -110], [60, 72, -470], [-20, 100, -660], [50, 104, -790], [250, 90, -760], [620, 60, -600], [880, 46, -400], [930, 40, -200], [700, 36, 40]];
    const HAGIA = [-20, 140], BLUE = [-150, 372], GALATA = [60, -700], MAIDEN = [535, 62], BRIDGE = [1135, -1250];
    const focus = [[0.08, BLUE[0], 80, BLUE[1]], [0.255, BLUE[0], 92, BLUE[1]], [0.285, -420, 96, 250], [0.325, HAGIA[0], 88, HAGIA[1]], [0.43, HAGIA[0], 84, HAGIA[1]], [0.48, 170, 40, -30], [0.54, GALATA[0], 70, GALATA[1]], [0.64, GALATA[0], 75, GALATA[1]], [0.7, BRIDGE[0], 70, BRIDGE[1]], [0.75, BRIDGE[0], 70, BRIDGE[1]]];
    const clear = clearance(path);

    // ---- the lie of the land: three shores round the water, hills behind them
    const zGH = (x) => -330 - 0.25 * (300 - Math.min(x, 300)), xBos = (z) => 850 - 0.3 * (z + 300);
    const Lold = (x, z) => Math.min(z - zGH(x) - 120, 780 - z, 340 - 0.0011 * (z - 150) ** 2 - x), Lgal = (x, z) => Math.min(zGH(x) - 120 - z, xBos(z) - 330 - x), Lasia = (x, z) => x - xBos(Math.min(z, -300)) - 330 - 0.12 * Math.max(0, z + 300);
    const hump = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);
    const height = (x, z) => {
      const a = Lold(x, z), b = Lgal(x, z), c = Lasia(x, z), L = Math.max(a, b, c); if (L <= 0) return Math.max(-12, L * 0.08);
      let h = a === L ? 40 * hump(x, z, -120, 260, 520, 300) + 62 * hump(x, z, -900, 150, 600, 350) + 20 * hump(x, z, 160, -10, 170, 210) + 26 * hump(x, z, -1900, 300, 900, 500) : b === L ? 62 * smooth(0, 520, b) * (0.7 + 0.5 * fbm(x / 500, z / 500, 3)) : 70 * smooth(0, 800, c) * (0.4 + 0.9 * fbm(x / 700 + 3, z / 700, 3));
      if (a === L) h = lerp(h, 34, smooth(340, 210, Math.hypot(x + 90, z - 255)));
      return Math.min(L * 0.12, 5) + h * smooth(0, 130, L);
    };
    const land = terrain({ size: 6600, seg: 264, center: [300, -200], height, rough: 1, color: (x, y, z, slope) => (y < 0.4 ? 0x7a7a66 : y < 3 ? 0xc0b090 : slope > 0.12 ? 0x9a8862 : fbm(x / 90, z / 90, 2) > 0.52 ? 0x8f9468 : 0xb09c74) });
    world.add(land); water(world, 0, { color: 0x3c5a78, rough: 0.2, strength: 0.4, ripple: 110 });

    // ---- mosque parts shared by every mosque in the city: lead domes, pencil minarets, stone blocks
    const domes = [], minarets = [], blocks = [], LEAD = 0x7c858e;
    const minaretGeo = new THREE.LatheGeometry([[1.5, 0], [1.5, 0.07], [1, 0.09], [1, 0.5], [1.6, 0.5], [1.6, 0.52], [0.95, 0.53], [0.95, 0.68], [1.5, 0.68], [1.5, 0.7], [0.9, 0.71], [0.9, 0.84], [1.4, 0.84], [1.4, 0.86], [0.85, 0.87], [0.85, 0.885], [0.12, 0.985], [0, 1]].map(([a, b]) => new THREE.Vector2(a, b)), 10);
    const dome = (x, y, z, rad, squash = 0.72) => domes.push({ x, y, z, sx: rad, sy: rad * squash, sz: rad });
    const minaret = (x, y, z, h, color = 0xe6dfd0) => minarets.push({ x, y, z, sx: h / 34, sy: h, sz: h / 34, color });
    const block = (x, y, z, w, h, d, color) => blocks.push({ x, y, z, w, h, d, color });
    // enlarges everything added to the shared lists since `mark`, about the point (cx, cy, cz)
    const mark = () => [domes.length, minarets.length, blocks.length], grow = ([a, b, c], cx, cy, cz, S) => { for (const o of [...domes.slice(a), ...minarets.slice(b)]) { o.x = cx + (o.x - cx) * S; o.y = cy + (o.y - cy) * S; o.z = cz + (o.z - cz) * S; o.sx *= S; o.sy *= S; o.sz *= S; } for (const o of blocks.slice(c)) { o.x = cx + (o.x - cx) * S; o.y = cy + (o.y - cy) * S; o.z = cz + (o.z - cz) * S; o.w *= S; o.h *= S; o.d *= S; } };
    const BIG = 1.45;
    // a small neighbourhood mosque for the skyline
    const mosque = (x, z, s, n) => { const y = height(x, z) - 1; block(x, y, z, 26 * s, 13 * s, 26 * s, 0xc9c0b0); block(x, y + 13 * s, z, 18 * s, 5 * s, 18 * s, 0xc9c0b0); dome(x, y + 17.5 * s, z, 9.5 * s); for (const [a, b] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) dome(x + a * 9 * s, y + 13 * s, z + b * 9 * s, 4 * s); for (let k = 0; k < n; k++) minaret(x + (k % 2 ? 1 : -1) * 15 * s, y, z + (k < 2 ? -1 : 1) * 15 * s, 44 * s); };

    // ---- Hagia Sophia: the great low dome on its square shoulders, half-domes east and west, heavy buttresses, four minarets
    {
      const [x, z] = HAGIA, y = height(x, z) - 0.5, ROSE = 0xc88a6c, OCHRE = 0xd2a06e, m0 = mark(), K = BIG;
      block(x, y, z, 74, 24, 70, ROSE); block(x, y + 24, z, 46, 10, 46, OCHRE); block(x - 43, y, z, 12, 16, 62, ROSE); block(x - 52, y, z, 8, 10, 54, OCHRE);
      for (const s of [-1, 1]) for (const e of [-1, 1]) { block(x + s * 15, y, z + e * 39, 10, 27, 13, OCHRE); block(x + s * 15, y + 27, z + e * 37, 8, 4, 9, ROSE); dome(x + s * 31, y + 22, z + e * 17, 7.5); minaret(x + s * 45, y, z + e * 41, 58, s === 1 && e === 1 ? 0xb8674a : 0xe6dfd0); }
      world.add(cyl(16.8 * K, 16.8 * K, 3.5 * K, facadeMat({ color: OCHRE, round: 16.8, floor: 3.5 * K, bay: 2.64, frame: [0.3, 0.2], glass: 0x2a2018, lit: 0 }), x, y + 34 * K, z, 40), cyl(8 * K, 8 * K, 20 * K, mat(ROSE), x + 38 * K, y, z, 16));
      dome(x, y + 37.5, z, 16.4, 0.62); dome(x - 22, y + 24, z, 15.5, 0.85); dome(x + 22, y + 24, z, 15.5, 0.85); dome(x + 38, y + 20, z, 8.2, 0.7);
      world.add(cyl(0.3, 0.8, 7, mat(0xd9b040, { metal: 0.8, rough: 0.3 }), x, y + 47.5 * K, z, 6)); grow(m0, x, y, z, K);
    }

    // ---- the Blue Mosque: a cascade of domes down from the centre, an arcaded court, six minarets
    {
      const [x, z] = BLUE, y = height(x, z) - 0.5, STONE = 0xc4c0b6, m0 = mark();
      block(x, y, z, 54, 18, 54, STONE); block(x, y + 18, z, 40, 10, 40, STONE); block(x, y + 28, z, 27, 6.5, 27, STONE);
      dome(x, y + 34.5, z, 12.6, 0.78);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { dome(x + a * 14.5, y + 28, z + b * 14.5, 11, 0.8); dome(x + a * 26 + b * 9, y + 18, z + b * 26 + a * 9, 5.2); dome(x + a * 26 - b * 9, y + 18, z + b * 26 - a * 9, 5.2); }
      for (const [a, b] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) { dome(x + a * 20, y + 28, z + b * 20, 5.8); block(x + a * 24.5, y, z + b * 24.5, 6, 30, 6, STONE); dome(x + a * 24.5, y + 30, z + b * 24.5, 3.4, 1.1); minaret(x + a * 31, y, z + b * 31, 64); }
      // forecourt to the west: arcades under a row of little domes, a fountain in the middle
      for (const e of [-1, 1]) { block(x - 59, y, z + e * 28, 60, 8, 6, STONE); block(x - 87 + (e + 1) * 28 - 0.5, y, z, 6, 8, 50, STONE); minaret(x - 90, y, z + e * 31, 50); for (let i = 0; i < 9; i++) dome(x - 85 + i * 6.5, y + 8, z + e * 28, 3.1); }
      for (let i = 0; i < 7; i++) dome(x - 87.5, y + 8, z - 19.5 + i * 6.5, 3.1);
      block(x - 59, y, z, 5, 5, 5, STONE); dome(x - 59, y + 5, z, 3.2); grow(m0, x, y, z, BIG);
    }

    // ---- other mosques on the skyline: Süleymaniye on its ridge, the New Mosque by the bridge, Nuruosmaniye, two in Üsküdar, one under the Bosphorus Bridge
    mosque(-900, 150, 2.5, 4); mosque(-110, -235, 1.6, 2); mosque(-520, 180, 1.5, 2); mosque(70, 440, 1.3, 2); mosque(-330, -120, 1.3, 2); mosque(-1500, 330, 1.5, 4); mosque(-430, 600, 1.3, 2); mosque(-760, 560, 1.4, 4); mosque(-1150, 540, 1.2, 2); mosque(150, 580, 1.2, 2); mosque(1330, -180, 0.9, 2); mosque(1420, 240, 1, 2); mosque(690, -1180, 0.8, 2); mosque(-560, -760, 0.8, 2);

    // ---- Topkapı on the point: battlemented walls and towers, the Tower of Justice, pavilions, kitchens' chimneys, gardens
    const cypress = [], greens = [];
    {
      const wallM = mat(0xb9a88c, { rough: 0.95 }), lead = mat(LEAD, { rough: 0.5, metal: 0.3 }), ring = [[62, 96], [250, 104], [296, -40], [236, -176], [92, -156], [48, -30]], walls = [], towers = [], caps = [];
      ring.forEach(([ax, az], i) => { const [bx, bz] = ring[(i + 1) % ring.length], len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 16); towers.push({ x: ax, y: height(ax, az) - 1, z: az, sx: 5, sy: 16, sz: 5 }); caps.push({ x: ax, y: height(ax, az) + 15, z: az, sx: 6, sy: 8, sz: 6 }); for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u; walls.push({ x, y: height(x, z) - 2, z, sx: len / n + 0.4, sy: 11, sz: 2.6, ry: -Math.atan2(bz - az, bx - ax) }); walls.push({ x, y: height(x, z) + 9, z, sx: (len / n) * 0.45, sy: 1.4, sz: 2.6, ry: -Math.atan2(bz - az, bx - ax) }); } });
      // sea walls round the point and down the Marmara shore
      for (let z = -190; z < 720; z += 22) { const x = 340 - 0.0011 * (z - 150) ** 2 - 16, ry = Math.atan2(1, 0.0022 * (z - 150)); walls.push({ x, y: 0, z, sx: 22.6, sy: 9, sz: 3, ry }); if (Math.round(z / 22) % 5 === 0) towers.push({ x: x + 2, y: 0, z, sx: 4.5, sy: 13, sz: 4.5 }); }
      for (const [x, z, s] of [[140, 78, 1], [176, 78, 1]]) { towers.push({ x, y: height(x, z) - 1, z, sx: 4.4 * s, sy: 19, sz: 4.4 * s }); caps.push({ x, y: height(x, z) + 18, z, sx: 5.2, sy: 9, sz: 5.2 }); }
      world.add(instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wallM, walls), instances(new THREE.CylinderGeometry(1, 1.08, 1, 8).translate(0, 0.5, 0), wallM, towers), instances(new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), lead, caps));
      const y0 = height(160, -20); block(160, y0 - 1, -20, 7, 30, 7, 0xd9cdb8); world.add(mesh(new THREE.ConeGeometry(5.6, 13, 4).rotateY(PI / 4), lead, 160, y0 + 35.5, -20));
      for (const [x, z, w, d] of [[120, 20, 60, 12], [200, 30, 14, 50], [130, -70, 44, 14], [215, -90, 30, 30], [170, -120, 50, 12], [100, -110, 18, 30]]) { const y = height(x, z) - 1; block(x, y, z, w, 7, d, 0xe2d6c0); for (let i = 0; i < Math.max(w, d) / 11; i++) dome(x + (w > d ? -w / 2 + 6 + i * 11 : 0), y + 7, z + (w > d ? 0 : -d / 2 + 6 + i * 11), 4.2); }
      for (let i = 0; i < 10; i++) { const x = 226, z = 20 + i * 7, y = height(x, z); caps.length; world.add(cyl(0.6, 2.4, 9, wallM, x, y + 5, z, 6)); }
      for (let i = 0; i < 150; i++) { const x = r.range(40, 300), z = r.range(-230, 110), L = Lold(x, z); if (L > 14 && clear(x, z, 30) > height(x, z) + 44) (r.chance(0.5) ? cypress : greens).push([x, height(x, z) - 0.5, z]); }
    }
    // Sultanahmet square between the two great mosques, and trees round them
    for (let i = 0; i < 170; i++) { const x = r.range(-360, 140), z = r.range(20, 500); if (Math.hypot(x - HAGIA[0], z - HAGIA[1]) > 100 && !(Math.abs(x - BLUE[0] + 40) < 118 && Math.abs(z - BLUE[1]) < 70) && clear(x, z, 26) > 86) (r.chance(0.55) ? cypress : greens).push([x, height(x, z) - 0.5, z]); }

    // ---- the Galata Tower: a stout stone drum with a balcony and a conical cap
    {
      const [x, z] = GALATA, y = height(x, z) - 1, stone = facadeMat({ color: 0xb8a88e, round: 8.5, floor: 7.2, bay: 5.34, frame: [0.4, 0.3], glass: 0x2a2018, lit: 0.3, litColor: 0xffd9a0, night: 0.8, rough: 0.95 });
      world.add(cyl(8.5, 9, 50, stone, x, y, z, 24), lathe([[8.6, 50], [10.2, 50.6], [10.2, 52], [7.6, 52.2], [7.6, 58], [9.2, 58.4], [9.2, 59.4], [0.3, 76], [0.3, 81], [0, 81]], mat(0x6e767e, { rough: 0.5, metal: 0.3 }), x, y, z, 24), cyl(7.5, 7.5, 6, facadeMat({ color: 0xc8b89c, round: 7.5, floor: 6, bay: 3.36, frame: [0.3, 0.2], glass: 0x2a2018, lit: 0.5, litColor: 0xffd9a0, night: 1 }), x, y + 52, z, 24));
    }

    // ---- the Maiden's Tower on its islet
    {
      const [x, z] = MAIDEN, white = mat(0xece4d4), red = mat(0xb5482e), lead = mat(LEAD, { metal: 0.3, rough: 0.5 });
      world.add(lathe([[0, 2.2], [20, 2.2], [26, 0.6], [30, -2]], mat(0x8a8272), x, 0, z, 20), box(26, 6, 14, white, x - 4, 2.2, z), mesh(new THREE.ConeGeometry(12, 4, 4).rotateY(PI / 4).scale(1.35, 1, 0.75), red, x - 4, 10.2, z), box(8.5, 19, 8.5, white, x + 8, 2.2, z), box(10.5, 0.8, 10.5, white, x + 8, 21.2, z), cyl(3.6, 3.6, 5, white, x + 8, 22, z, 8), mesh(new THREE.SphereGeometry(4, 12, 6, 0, PI * 2, 0, PI / 2), lead, x + 8, 27, z), cyl(0.12, 0.12, 9, lead, x + 8, 31, z, 5), box(3.4, 2.2, 0.1, mat(0xd02020, { side: THREE.DoubleSide }), x + 9.8, 37.6, z));
      lights(world, [[x + 8, 24.5, z], [x - 10, 6, z + 8], [x, 6, z - 8]], { color: 0xffd9a0, size: 7, power: 1 });
    }

    // ---- red-tiled houses by the thousand, climbing every hill
    {
      const paintG = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
      const house = mergeGeometries([paintG(new THREE.BoxGeometry(1, 0.72, 1).translate(0, 0.36, 0).toNonIndexed(), [1, 1, 1]), paintG(new THREE.ConeGeometry(0.76, 0.3, 4).rotateY(PI / 4).translate(0, 0.87, 0).toNonIndexed(), [0.78, 0.3, 0.2])]);
      const near = [], far = [], walls = [0xf0e2cc, 0xe2caa6, 0xf6eee0, 0xd6bc98, 0xe8d2b8, 0xd9c8b4, 0xf0d8b0];
      for (let i = 0; i < 60000 && near.length + far.length < 13000; i++) {
        const wide = i % 4 === 0, x = wide ? r.range(-2700, 3200) : r.range(-1500, 1700), z = wide ? r.range(-3000, 1100) : r.range(-1500, 900), a = Lold(x, z), L = Math.max(a, Lgal(x, z), Lasia(x, z)); if (L < 22) continue;
        if (a === L && ((x > 30 && x < 310 && z > -200 && z < 120) || (Math.hypot(x - HAGIA[0], z - HAGIA[1]) < 120) || (Math.abs(x - BLUE[0] + 40) < 135 && Math.abs(z - BLUE[1]) < 86) || (x > -330 && x < 120 && z > 190 && z < 300))) continue;
        if (Math.hypot(x - GALATA[0], z - GALATA[1]) < 22 || (Math.abs(z - BRIDGE[1]) < 34)) continue;
        const y = height(x, z), h = r.range(6, 12) + (r.chance(0.06) ? 8 : 0); if (clear(x, z, 34) < y + h + 26) continue;
        (clear(x, z, 240) < 1e9 ? near : far).push({ x, y: y - 1.5, z, sx: r.range(9, 15), sy: h + 1.5, sz: r.range(9, 15), ry: r.range(0, 1.6), color: r.pick(walls) });
      }
      const hm = mat(0xffffff, { rough: 0.9, vertexColors: true, flat: true });
      world.add(instances(house, hm, near), instances(house, hm, far, { cast: false }));
    }

    // ---- build the shared mosque parts
    world.add(instances(new THREE.SphereGeometry(1, 20, 8, 0, PI * 2, 0, PI / 2), mat(LEAD, { rough: 0.45, metal: 0.35 }), domes), instances(minaretGeo, mat(0xffffff, { rough: 0.8 }), minarets));
    world.add(instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), facadeMat({ floor: 9, bay: 6, frame: [0.42, 0.37], glass: 0x3a2c22, lit: 0.25, litColor: 0xffd9a0, night: 0.7, rough: 0.9 }), blocks.map((b) => ({ x: b.x, y: b.y, z: b.z, sx: b.w, sy: b.h, sz: b.d, color: b.color }))));
    lights(world, minarets.map((m) => [m.x, m.y + m.sy * 0.69, m.z]), { color: 0xffe0a0, size: 3.5, power: 1 });
    trees(world, cypress, 'cypress', { size: 15, rand: r }); trees(world, greens, 'round', { size: 10, color: [0x4a6a3a, 0x5a7a40, 0x3e5e34], rand: r });

    // ---- bridges: the Bosphorus Bridge to Asia, the low Galata Bridge across the mouth of the Golden Horn
    const bb = suspensionBridge({ length: 1150, towerH: 165, deckY: 64, width: 34, color: 0x8a9098, towerColor: 0x9aa0a8, cableColor: 0x6a7078, towers: [-380, 380], cable: 0.9 });
    bb.position.set(BRIDGE[0], 0, BRIDGE[1]); world.add(bb);
    traffic(world, [[BRIDGE[0] - 570, 65.5, BRIDGE[1] - 6], [BRIDGE[0] + 570, 65.5, BRIDGE[1] - 6]], { count: 50, color: 0xfff0d0, size: 4, speed: 20, spread: 5 }); traffic(world, [[BRIDGE[0] + 570, 65.5, BRIDGE[1] + 6], [BRIDGE[0] - 570, 65.5, BRIDGE[1] + 6]], { count: 50, color: 0xff4030, size: 4, speed: 20, spread: 5 });
    world.add(box(26, 2.4, 268, mat(0x7a7870), 250, 5, -340)); for (let i = 0; i < 9; i++) world.add(box(20, 6, 5, mat(0x6a6860), 250, 0, -450 + i * 28));

    // ---- on the water: white ferries criss-crossing, gulls wheeling behind them
    const hull = mat(0xf2efe8, { rough: 0.6 });
    const where = fleet(world, [[mergeGeometries([new THREE.BoxGeometry(10, 5, 52).translate(0, 1.5, 0), new THREE.BoxGeometry(8.6, 3, 40).translate(0, 5.5, -2), new THREE.BoxGeometry(7, 2.6, 26).translate(0, 8.3, -4), new THREE.CylinderGeometry(1.3, 1.5, 5, 8).translate(0, 12, -8)]), hull], [mergeGeometries([new THREE.BoxGeometry(8.8, 1.3, 38).translate(0, 5.6, -2), new THREE.BoxGeometry(7.2, 1.2, 24).translate(0, 8.4, -4)]), glowMat(0xffc880, 1.2)]],
      [[330, -290, 1150, -140], [1160, -40, 420, -330], [500, -430, 880, 760], [800, -1150, 640, 500], [-700, -575, 260, -335], [1050, 600, 380, -360], [700, 300, 900, -1100]], 11, 7, r);
    {
      const n = 84, gull = new THREE.BufferGeometry(); gull.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, -1.6, 0.5, 0, 0, 0, -0.3, 0, 0, 0.5, 0, 0, -0.3, 1.6, 0.5, 0], 3)); gull.computeVertexNormals();
      const im = instances(gull, mat(0xffffff, { side: THREE.DoubleSide, emissive: 0xffe8d0, glow: 0.25 }), Array.from({ length: n }, () => ({})), { cast: false }), d = new THREE.Object3D(), c = new THREE.Vector3();
      world.add(im); world.onUpdate((t) => { for (let i = 0; i < n; i++) { where(i, t, c); const a = t * (0.5 + (i % 5) * 0.08) + i * 1.7, rad = 14 + (i % 7) * 5; d.position.set(c.x + Math.cos(a) * rad, 14 + (i % 6) * 4 + Math.sin(t * 0.9 + i) * 2, c.z + Math.sin(a) * rad); d.rotation.set(0, -a, 0.3); d.scale.set(1.3, 1 + 0.9 * Math.sin(t * 9 + i * 2.1), 1.3); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; });
    }
    clouds(world, { count: 14, y: [700, 1100], size: 200, color: 0xffb890, self: 0.45, rand: rng(6) });

    return { world, path, focus, duration: 48 };
  },
};
