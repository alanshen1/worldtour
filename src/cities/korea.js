// Seoul on a golden autumn afternoon: in over the tiled roofs of the hanok village to Gyeongbokgung under Bugaksan, out through Gwanghwamun,
// down a street of Hangul signs, up through the red and gold woods of Namsan round N Seoul Tower, then along the Han and its bridges towards Lotte World Tower.
import { THREE, mergeGeometries, createWorld, rng, fbm, clamp, lerp, smooth, mat, glowMat, facadeMat, box, cyl, mesh, lathe, tube, hipRoof, instances, buildings, cityGrid, terrain, water, trees, lights, traffic, sign, clouds, clearance } from '../kit.js';

const TAU = Math.PI * 2;
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const C = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0).rotateY(Math.PI / seg);
/** Collects static pieces that share a material and merges them into one mesh. */
function pile(material) {
  const list = [];
  return {
    add(g, x = 0, y = 0, z = 0, ry = 0) { g = g.index ? g.toNonIndexed() : g; if (ry) g.rotateY(ry); list.push(g.translate(x, y, z)); return this; },
    mesh(o) { return mesh(mergeGeometries(list), material, 0, 0, 0, o); },
  };
}
/** A small curved tiled roof, one unit square and one unit high, light enough to instance by the hundred. */
function smallRoof() {
  const g = new THREE.PlaneGeometry(1, 1, 4, 4).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) * 2, v = p.getZ(i) * 2, m = Math.max(Math.abs(v), (Math.abs(u) - 0.5) / 0.5); p.setY(i, Math.pow(1 - clamp(m), 1.5) + 0.3 * Math.pow(Math.abs(u * v), 2.5)); }
  g.computeVertexNormals(); return g;
}

export default {
  build() {
    const r = rng(1392);
    const world = createWorld({
      sky: { top: 0x3a82d2, horizon: 0xf4e3c0, bottom: 0xcbb99a, haze: 0.5 },
      sun: { dir: [-0.58, 0.44, 0.68], color: 0xffe0aa, power: 3.3, disc: 0xfff0d0, size: 0.0007 },
      ambient: { sky: 0xa9c6f0, ground: 0x8a6a48, power: 0.95 },
      fog: { color: 0xecdcc0, density: 0.00023 }, exposure: 1.05, env: 0.8,
    });
    const path = [[780, 66, -800], [640, 62, -808], [400, 52, -850], [150, 48, -905], [92, 40, -720], [0, 48, -570], [0, 34, -380], [0, 30, -120], [0, 34, 200], [-60, 110, 400], [60, 200, 760], [420, 250, 900], [700, 150, 1300], [1000, 72, 1650], [1500, 64, 1830]];
    const focus = [[0.1, 0, 20, -850], [0.17, 0, 18, -850], [0.22, 0, 14, -560], [0.3, 0, 22, 100], [0.44, 0, 25, 320], [0.52, 300, 280, 620], [0.66, 300, 270, 620], [0.72, 800, 20, 1700], [0.8, 2700, 250, 2300]];
    const clear = clearance(path);

    // ---- the land: granite Bugaksan and Inwangsan to the north, wooded Namsan in the middle, the Han cutting across the south
    const bump = (x, z, cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);
    const river = (x) => 1700 + 80 * Math.sin(x / 900);
    const H = (x, z) => {
      const hills = bump(x, z, -100, -1760, 400, 360, 330) + bump(x, z, -850, -1380, 330, 430, 240) + bump(x, z, 950, -1650, 520, 380, 190) + bump(x, z, 520, -900, 270, 230, 26)
        + bump(x, z, 300, 620, 440, 330, 180) + bump(x, z, -700, 3700, 900, 600, 360) + bump(x, z, 1800, 3800, 800, 500, 280);
      const h = 6 + hills * (0.78 + 0.44 * fbm(x / 230, z / 230, 3) * smooth(20, 90, hills)) - 16 * (1 - smooth(235, 262, Math.abs(z - river(x))));
      return h > 12 ? Math.min(h, clear(x, z, 80) - 30) : h;
    };
    const fall = [0xb8402a, 0xd8742a, 0xe6ac3a, 0xc9552a, 0x8a8a3a, 0xe0903a, 0xa83a2a].map((c) => new THREE.Color(c)), tc = new THREE.Color();
    world.add(terrain({ size: [7600, 6600], center: [200, 900], seg: 200, height: H, color: (x, y, z, slope) => {
      const n = fbm(x / 60, z / 60, 3), rocky = bump(x, z, -100, -1760, 230, 200, 1) + bump(x, z, -850, -1380, 170, 220, 1);
      if (y < 4) return 0x8a8468;
      if (y < 16) return tc.set(0x8f8b82).lerp(fall[2], n * 0.12);
      if (rocky > 0.42 || slope > 0.55) return tc.set(0xc9c0b0).lerp(fall[1], n * 0.25);
      return tc.copy(fall[Math.floor(fbm(x / 35 + 7, z / 35, 2) * 13) % 7]).lerp(fall[3], n * 0.4);
    } }));
    water(world, 0, { color: 0x4a6a78, rough: 0.14, strength: 0.25 });

    // ---- piles of static detail
    const tileM = mat(0x3e4349, { rough: 0.75, side: THREE.DoubleSide }), tile = pile(tileM), red = pile(mat(0x8a2e24, { rough: 0.8 })), green = pile(mat(0x2f7f66, { rough: 0.7 }));
    const stone = pile(mat(0xbdb5a4, { rough: 0.9 })), white = pile(mat(0xf0ebe0, { rough: 0.8 })), dark = pile(mat(0x1c1a1c, { rough: 0.7 })), gold = pile(mat(0xd9a63a, { rough: 0.35, metal: 0.8 }));
    /** A palace hall: red timber body, a band of green dancheong under the eaves, sweeping tiled roof; `upper` adds a second tier. */
    const hall = (x, y, z, w, d, hb, hr, upper = 0, ry = 0) => {
      const R = (g, dy) => g.add(B(w, hb, d), x, y + dy, z, ry);
      R(red, 0); green.add(B(w + 1.4, hb * 0.2, d + 1.4), x, y + hb * 0.86, z, ry); white.add(B(w + 0.3, hb * 0.2, d + 0.3), x, y + hb * 0.5, z, ry); dark.add(B(w * 0.86, hb * 0.48, d + 0.5), x, y, z, ry);
      tile.add(hipRoof(w * 1.4, d * 1.6, hr, tileM, 0, 0, 0, { ridge: 0.45, lift: hr * 0.3 }).geometry, x, y + hb + 0.4, z, ry);
      let top = y + hb + 0.4 + hr;
      if (upper) {
        const y2 = y + hb + hr * 0.45, h2 = hb * 0.62;
        red.add(B(w * 0.74, h2, d * 0.68), x, y2, z, ry); green.add(B(w * 0.74 + 1.4, h2 * 0.3, d * 0.68 + 1.4), x, y2 + h2 * 0.78, z, ry);
        tile.add(hipRoof(w * 1.14, d * 1.24, hr * 1.25, tileM, 0, 0, 0, { ridge: 0.45, lift: hr * 0.36 }).geometry, x, y2 + h2 + 0.3, z, ry); top = y2 + h2 + 0.3 + hr * 1.25;
      }
      white.add(B(w * (upper ? 0.5 : 0.62), 0.8, 1), x, top - 0.3, z, ry);
    };

    // ---- Gyeongbokgung: the gate on its stone base, courts and cloisters, the two-tiered throne hall on its terrace, the pavilion on the pond
    const GZ = -560, wallM = pile(mat(0xa59c8a, { rough: 0.9 }));
    stone.add(B(50, 13, 17), 0, 0, GZ); hall(0, 13, GZ, 30, 9, 5.5, 4.2, 1);
    const archS = new THREE.Shape(); archS.moveTo(-3.2, 0); archS.lineTo(3.2, 0); archS.lineTo(3.2, 5); archS.absarc(0, 5, 3.2, 0, Math.PI, false); archS.lineTo(-3.2, 0);
    for (const dx of [-12, 0, 12]) for (const s of [-1, 1]) dark.add(new THREE.ShapeGeometry(archS, 8).rotateY(s > 0 ? 0 : Math.PI).scale(dx ? 0.85 : 1, dx ? 0.85 : 1, 1), dx, 0, GZ + s * 8.6);
    for (const [x0, z0, x1, z1] of [[-260, GZ, -25, GZ], [25, GZ, 260, GZ], [-260, -1260, 260, -1260], [-260, GZ, -260, -1260], [260, GZ, 260, -1260]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = x0 === x1 ? Math.PI / 2 : 0;
      wallM.add(B(len, 5, 2.2), (x0 + x1) / 2, 0, (z0 + z1) / 2, ry); tile.add(B(len, 0.8, 3.4), (x0 + x1) / 2, 5, (z0 + z1) / 2, ry);
    }
    for (const s of [-1, 1]) { stone.add(B(9, 8, 9), s * 260, 0, GZ); hall(s * 260, 8, GZ, 7, 7, 3.4, 3); }
    hall(0, 2, -690, 26, 9, 6, 4.2, 1); hall(0, 1.5, -768, 22, 8, 5.5, 3.6);                                // Heungnyemun and Geunjeongmun, the inner gates
    for (const [x, z, w, ry] of [[-45, -768, 60, 0], [45, -768, 60, 0], [0, -932, 150, 0], [-75, -850, 164, Math.PI / 2], [75, -850, 164, Math.PI / 2], [-52, -690, 70, 0], [52, -690, 70, 0], [-88, -728, 76, Math.PI / 2], [88, -728, 76, Math.PI / 2]]) hall(x, 0.6, z, w, 5.5, 4.4, 2.6, 0, ry);
    world.add(box(144, 0.6, 158, mat(0xcfc6b4, { rough: 0.9 }), 0, 0, -850, { cast: false }), box(170, 0.5, 70, mat(0xc6bda9, { rough: 0.9 }), 0, 0, -728, { cast: false }), box(20, 0.7, 120, mat(0xddd5c4, { rough: 0.9 }), 0, 0, -800, { cast: false }));
    stone.add(B(66, 2.4, 60), 0, 0.6, -862).add(B(54, 2.2, 48), 0, 3, -862).add(B(14, 2.6, 12), 0, 0.6, -828);
    for (const [w, d, y] of [[66, 60, 3], [54, 48, 5.2]]) for (const s of [-1, 1]) stone.add(B(w, 1.1, 0.5), 0, y, -862 + s * d / 2).add(B(0.5, 1.1, d), s * w / 2, y, -862);
    hall(0, 5.2, -862, 31, 21, 9.5, 6.2, 1);                                                                 // Geunjeongjeon, the throne hall
    hall(0, 0.6, -975, 28, 14, 6, 4.4); hall(0, 0.6, -1030, 36, 14, 5.5, 4.2); hall(0, 0.6, -1082, 34, 13, 5.5, 4.2); hall(-70, 0.6, -1040, 22, 11, 5, 3.6); hall(74, 0.6, -1050, 24, 11, 5, 3.6); hall(120, 0.6, -985, 20, 10, 5, 3.4); hall(140, 0.6, -700, 26, 11, 5, 3.6); hall(-170, 0.6, -1010, 18, 9, 4.6, 3.2);
    // Gyeonghoeru: a great open pavilion standing on stone pillars in its square pond
    const pondM = mat(0x3f5a4e, { rough: 0.08, metal: 0.5 });
    world.add(box(132, 0.5, 116, pondM, -172, 0.4, -862, { cast: false })); stone.add(B(46, 1.6, 36), -160, 0.2, -862).add(B(8, 1.2, 22), -132, 0.4, -862);
    for (let i = 0; i < 8; i++) for (let k = 0; k < 6; k++) stone.add(i % 7 && k % 5 ? C(0.6, 0.6, 5, 8) : B(1.1, 5, 1.1), -160 - 19.6 + i * 5.6, 1.8, -862 - 14 + k * 5.6);
    stone.add(B(42, 0.8, 31), -160, 6.8, -862); hall(-160, 7.6, -862, 38, 27, 5.4, 6.4);
    for (const [x, z] of [[-215, -905], [-205, -818]]) { stone.add(C(7, 8, 1.4, 12), x, 0.3, z); }
    world.add(box(70, 0.5, 60, pondM, 0, 0.4, -1170, { cast: false })); stone.add(C(9, 10, 1.6, 6), 0, 0.2, -1170); hall(0, 1.8, -1170, 8, 8, 6, 4, 1);   // Hyangwonjeong
    hall(0, H(0, -1345), -1345, 46, 18, 9, 7); white.add(B(46.4, 6, 18.4), 0, H(0, -1345), -1345);          // the house under the mountain
    world.add(mesh(hipRoof(66, 30, 7.2, mat(0x2f6fb0, { rough: 0.5, side: THREE.DoubleSide }), 0, 0, 0, { ridge: 0.45, lift: 2 }).geometry, tileM.clone(), 0, -100, 0));

    // ---- Gwanghwamun square: the boulevard, King Sejong in gold, the admiral on his column
    const roadM = mat(0x4a4c52, { rough: 0.9 });
    world.add(box(80, 0.4, 420, roadM, 0, 5.7, -345, { cast: false }), box(30, 0.5, 330, mat(0xb9b2a2, { rough: 0.9 }), 0, 5.8, -360, { cast: false }), box(44, 0.4, 470, roadM, 0, 5.7, 90, { cast: false }));
    stone.add(B(10, 5, 8), 0, 6, -430).add(B(4, 10, 4), 0, 6, -250); gold.add(new THREE.SphereGeometry(3.2, 12, 8).scale(1.2, 1, 1), 0, 13.4, -430).add(new THREE.SphereGeometry(1.5, 10, 8), 0, 17.4, -430).add(B(7, 1.6, 5), 0, 11, -430);
    dark.add(C(0.9, 1.3, 5.4, 8), 0, 16, -250).add(new THREE.SphereGeometry(0.9, 8, 6), 0, 22, -250);
    traffic(world, [[-30, 7, -545], [-30, 7, -140]], { count: 22, color: 0xffe9c0, size: 2.4, speed: 11, spread: 5 }); traffic(world, [[30, 7, -140], [30, 7, -545]], { count: 22, color: 0xff5040, size: 2.4, speed: 11, spread: 5 });

    // ---- the hanok village: low houses under curved grey tiles, packed along the lanes of the hill east of the palace
    const hanok = [], yards = [];
    for (let x = 300; x < 800; x += 15) for (let z = -1010; z < -640; z += 14) {
      if (r.chance(0.16) || Math.round(x / 15) % 6 === 0) continue;
      const hx = x + r.range(-1.5, 1.5), hz = z + r.range(-1.5, 1.5), across = r.chance(0.35);
      hanok.push({ x: hx, y: H(hx, hz), z: hz, ry: across ? Math.PI / 2 : 0, w: r.range(9, 12), d: r.range(5.4, 6.6) });
    }
    world.add(instances(B(1, 1, 1), mat(0xffffff, { rough: 0.85 }), hanok.map((h) => ({ x: h.x, y: h.y - 2, z: h.z, ry: h.ry, sx: h.w, sy: 5, sz: h.d, color: r.pick([0xf2ede2, 0xe8dfd0, 0x8a6a4a, 0xf2ede2]) }))));
    world.add(instances(smallRoof(), tileM, hanok.map((h) => ({ x: h.x, y: h.y + 2.8, z: h.z, ry: h.ry, sx: h.w * 1.34, sy: 2.6, sz: h.d * 1.6 }))));
    world.add(instances(B(1, 1, 1), mat(0x6a4a30, { rough: 0.9 }), hanok.map((h) => ({ x: h.x, y: h.y + 0.4, z: h.z, ry: h.ry, sx: h.w + 0.3, sy: 0.5, sz: h.d + 0.3 })), { cast: false }));

    // ---- a street of Hangul signs running south from the square
    const shopM = facadeMat({ floor: 3.6, bay: 3.2, frame: [0.2, 0.25], glass: 0x2c3a48, lit: 0.3, litColor: 0xffe0b0, night: 0.7, ground: 4.5 });
    const shops = [], words = ['약국', '노래방', '커피', '치킨', '서울식당', '부동산', '미용실', 'PC방', '김밥천국', '학원', '호프', '병원', '편의점', '삼겹살', '떡볶이', '안경', '당구장', '한의원', '찜질방', '서점', '국밥', '사진관', '꽃집', '은행'];
    const inks = [['#fff', '#d8262c'], ['#fff', '#1f5fbf'], ['#222', '#ffd23a'], ['#fff', '#1f8a4c'], ['#d8262c', '#fff'], ['#fff', '#e8641e'], ['#ffe14a', '#222'], ['#fff', '#8a2fb0']];
    const kfont = '"Noto Sans CJK KR","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK SC",sans-serif';
    let wi = 0;
    for (let z = -150; z < 270; z += 27) for (const s of [-1, 1]) {
      const h = r.range(20, 40); shops.push({ x: s * 30, z, y: 5, w: 16, d: 25, h, color: r.pick([0xd9d2c4, 0xc9c4bc, 0xb9aea0, 0xe6e0d4, 0xa9b0b6, 0xcbb9a4]) });
      for (const [dz, y, tall] of [[-8, 13 + r.range(0, 6), 1], [5, 9, 0]]) {
        const [ink, bg] = inks[wi % inks.length], sg = sign(words[wi++ % words.length], tall ? r.range(8, 12) : 2.6, { color: ink, bg, vertical: !!tall, font: kfont });
        if (tall) { sg.position.set(s * 20.4, y + 5, z + dz); sg.rotation.y = Math.PI; } else { sg.position.set(s * 21.9, y + 5, z + dz); sg.rotation.y = -s * Math.PI / 2; }
        world.add(sg);
      }
    }
    world.add(buildings(shops, shopM), buildings(shops.map((b) => ({ x: b.x - Math.sign(b.x) * 7.6, z: b.z, y: 5, w: 1.4, d: 25, h: 4.4 })), mat(0x3a3430, { rough: 0.6 }), { cast: false }));
    traffic(world, [[-8, 7, -130], [-8, 7, 300]], { count: 14, color: 0xff5040, size: 2.2, speed: 9, spread: 3 }); traffic(world, [[8, 7, 300], [8, 7, -130]], { count: 14, color: 0xffe9c0, size: 2.2, speed: 9, spread: 3 });

    // ---- N Seoul Tower on the summit of Namsan, the cable car climbing to it
    const NX = 300, NZ = 620, NY = H(NX, NZ), mast = pile(mat(0xd8422e, { rough: 0.6 }));
    stone.add(C(26, 30, 5, 20), NX, NY - 3, NZ); white.add(C(9, 10, 12, 16), NX, NY + 2, NZ).add(C(5.2, 6.4, 96, 16), NX, NY + 14, NZ).add(C(8, 5.4, 6, 20), NX, NY + 104, NZ);
    for (let i = 0; i < 5; i++) { white.add(C(15 - i * 0.6, 15 - i * 0.6, 1.2, 28), NX, NY + 110 + i * 4.4, NZ); dark.add(C(13.6 - i * 0.6, 13.6 - i * 0.6, 3.2, 28), NX, NY + 111.2 + i * 4.4, NZ); }
    white.add(C(4, 12, 6, 20), NX, NY + 132, NZ);
    for (let i = 0; i < 9; i++) (i % 2 ? white : mast).add(C(2.6 - i * 0.26, 2.9 - i * 0.26, 5.4, 8), NX, NY + 138 + i * 5.4, NZ);
    mast.add(C(0.15, 0.5, 12, 6), NX, NY + 186.6, NZ);
    hall(NX - 40, NY - 0.5, NZ + 22, 9, 9, 5, 4.6); stone.add(B(46, 3, 14), NX + 34, NY - 2, NZ - 22);
    const cableA = [60, H(60, 330) + 14, 330], cableB = [NX - 46, NY + 10, NZ - 34];
    world.add(tube([cableA, cableB], 0.25, mat(0x2a2a2e)), box(12, 14, 10, mat(0xd9d4c8), cableA[0], cableA[1] - 14, cableA[2]));
    const cars = [0, 1].map(() => world.add(box(4.4, 3.6, 3, mat(0xf2efe6, { rough: 0.5 }), 0, 0, 0)));
    world.onUpdate((t) => cars.forEach((m, i) => { const u = (Math.sin(t * 0.12 + i * Math.PI) + 1) / 2; m.position.set(lerp(cableA[0], cableB[0], u), lerp(cableA[1], cableB[1], u) - 4, lerp(cableA[2], cableB[2], u) + (i ? 2 : -2)); }));

    // ---- autumn woods: real trees where the flight passes close, a canopy of coloured crowns over the rest of the hills
    const near = [], crowns = [], wooded = (x, z) => H(x, z) > 17 && !(x > 280 && x < 800 && z > -1030 && z < -620) && Math.hypot(x - NX, z - NZ) > 34;
    for (let i = 0; i < 1500; i++) { const x = r.range(-420, 900), z = r.range(150, 1150), y = H(x, z); if (wooded(x, z)) (clear(x, z, 190) < Infinity && near.length < 640 ? near : crowns).push(clear(x, z, 190) < Infinity && near.length < 640 ? [x, y, z] : { x, y: y + 4, z, s: r.range(5, 8.5), color: r.pick(fall).getHex() }); }
    for (let i = 0; i < 2600; i++) { const x = r.range(-1500, 1700), z = r.range(-2300, -1090), y = H(x, z), rocky = bump(x, z, -100, -1760, 230, 200, 1) + bump(x, z, -850, -1380, 170, 220, 1); if (y > 17 && rocky < 0.42) crowns.push({ x, y: y + 4, z, s: r.range(5, 9), color: r.pick(fall).getHex() }); }
    for (let x = -240; x <= 240; x += 16) for (const z of [-1235, -600]) if (Math.abs(x) > 40) near.push([x, 6, z]);
    for (let i = 0; i < 130; i++) { const x = r.range(-250, 250), z = r.range(-1240, -950); if (Math.abs(x) > 95 || z < -1110) near.push([x, 6, z]); }
    for (let z = -520; z < -150; z += 17) near.push([-17, 6, z], [17, 6, z]);
    trees(world, near, 'autumn', { size: 11, color: [0xd9762b, 0xc9412a, 0xe8b23a, 0xe2a02e, 0xb5432a, 0xf0c440] }).children.forEach((m, i) => { m.castShadow = i === 1; });
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { rough: 0.95, flat: true }), crowns, { cast: false }));

    // ---- the modern city: offices and flats on the plain, towers by the river, rows of white apartment slabs south of it
    const flat = (x, z) => { const y = H(x, z); return y > 4.5 && y < 13; };
    const palace = (x, z) => x > -290 && x < 830 && z > -1300 && z < -540, lane = (x, z) => Math.abs(x) < 46 && z > -560 && z < 330;
    const core = (x, z) => Math.exp(-(((x - 200) / 700) ** 2) - ((z + 150) / 420) ** 2);
    const lots = cityGrid({ rand: rng(5), area: [-2600, -1500, 3200, 1420], block: 50, street: 17, jitter: 0.35, split: 0.3, palette: [0xd9d4c8, 0xc6c2ba, 0xb9b0a2, 0xe2ddd2, 0xa9aeb4, 0xcdbfae, 0x9aa4ae],
      keep: (x, z) => flat(x, z) && !palace(x, z) && !lane(x, z), height: (x, z) => Math.min(14 + 22 * r() + 110 * core(x, z) * r() * r(), clear(x, z, 95) - 30) });
    const south = cityGrid({ rand: rng(6), area: [-2600, 2010, 3600, 3300], block: 58, street: 22, jitter: 0.3, split: 0.2, palette: [0xd9d4c8, 0xc6c2ba, 0xe2ddd2, 0xa9b4be, 0x8fa2b4],
      keep: (x, z) => flat(x, z) && r.chance(0.55) && Math.hypot(x - 2700, z - 2300) > 150, height: (x, z) => 18 + 30 * r() + 150 * Math.exp(-(((x - 600) / 500) ** 2) - ((z - 2500) / 300) ** 2) * r() });
    const slabs = []; for (let i = 0; i < 46; i++) { const x = r.range(-2500, 3400), z = r.range(2020, 3200), n = r.int(3, 5), h = r.range(42, 78), turn = r.chance(0.5); if (!flat(x, z) || Math.hypot(x - 2700, z - 2300) < 220) continue; for (let k = 0; k < n; k++) slabs.push({ x: x + (turn ? k * 38 : 0), z: z + (turn ? 0 : k * 38), w: turn ? 13 : 62, d: turn ? 62 : 13, h, color: 0xf0ece4 }); }
    const cityM = facadeMat({ floor: 3.6, bay: 3.2, frame: [0.22, 0.25], glass: 0x2c3a48, lit: 0.2, night: 0.6, rough: 0.85 });
    const all = [...lots, ...south, ...slabs]; all.forEach((b) => { b.y = 2; b.h += 4; });
    world.add(buildings(all, cityM), buildings(all.map((b) => ({ x: b.x, z: b.z, y: b.y + b.h, w: b.w, d: b.d, h: 0.8 })), mat(0x8a8c90, { rough: 0.9 }), { cast: false }));
    // Lotte World Tower: a slender, tapering shaft of pale glass, split at the crown
    const lotte = lathe([[38, 0], [36.5, 110], [32, 270], [25, 410], [17, 510], [12.5, 555]], facadeMat({ color: 0xc6d6e2, floor: 4.4, bay: 2.6, frame: [0.07, 0.12], glass: 0x4a7090, lit: 0.15, night: 0.6, rough: 0.25, metal: 0.4, round: 30 }), 2700, 0, 2300, 36);
    const lp = lotte.geometry.attributes.position; for (let i = 0; i < lp.count; i++) { const a = Math.atan2(lp.getZ(i), lp.getX(i)), q = (Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4) ** -0.25; lp.setX(i, lp.getX(i) * q); lp.setZ(i, lp.getZ(i) * q); } lotte.geometry.computeVertexNormals();
    world.add(lotte, box(3.4, 78, 40, mat(0x1c2630, { rough: 0.4 }), 2700, 484, 2300, { ry: 0.6 }), box(150, 30, 110, cityM, 2700, 0, 2420), cyl(120, 120, 0.6, mat(0x4a6a78, { rough: 0.1, metal: 0.4 }), 2560, 5.6, 2520, 32, { cast: false }));
    world.add(box(34, 240, 44, facadeMat({ color: 0xe2b85a, floor: 4, bay: 2.4, frame: [0.06, 0.1], glass: 0x8a6420, lit: 0.1, night: 0.5, rough: 0.2, metal: 0.7 }), -1500, 0, 2130));

    // ---- the Han: girder bridges on rows of piers, an arched railway bridge, a cable-stayed one beyond, traffic on them all
    const deck = pile(mat(0x9a9c9e, { rough: 0.8 })), steel = pile(mat(0x3f7a5a, { rough: 0.5, metal: 0.3 }));
    for (const [x, kind] of [[-1900, 0], [-1200, 1], [-500, 0], [300, 0], [800, 1], [1300, 0], [2100, 2], [2900, 0]]) {
      const zc = river(x), w = kind === 1 ? 14 : 30;
      deck.add(B(w, 2.4, 640), x, 16, zc); for (let z = -280; z <= 280; z += 56) deck.add(B(w * 0.5, 34, 5), x, -16, zc + z);
      if (kind === 1) for (let z = -252; z < 280; z += 112) for (const s of [-1, 1]) steel.add(new THREE.TorusGeometry(52, 1.1, 5, 14, Math.PI).rotateY(Math.PI / 2).scale(1, 0.42, 1), x + s * 7, 18.4, zc + z);
      if (kind === 2) for (const s of [-1, 1]) { deck.add(new THREE.BoxGeometry(3.4, 96, 4).rotateZ(s * 0.18), x + s * 9, 62, zc); for (let k = 1; k <= 7; k++) for (const e of [-1, 1]) deck.add(new THREE.BoxGeometry(0.4, 0.4, Math.hypot(k * 30, 30 + k * 9)).rotateX(e * Math.atan2(30 + k * 9, k * 30)).translate(0, 18 + (30 + k * 9) / 2, e * k * 15), x + s * 11, 0, zc); }
      traffic(world, [[x - w / 4, 19.4, zc - 330], [x - w / 4, 19.4, zc + 330]], { count: kind === 1 ? 5 : 18, color: kind === 1 ? 0xffffff : 0xff5040, size: kind === 1 ? 5 : 2.6, speed: kind === 1 ? 22 : 15, spread: kind === 1 ? 0 : 4 });
      if (kind !== 1) traffic(world, [[x + w / 4, 19.4, zc + 330], [x + w / 4, 19.4, zc - 330]], { count: 18, color: 0xffe9c0, size: 2.6, speed: 15, spread: 4 });
    }
    for (const s of [-1, 1]) {
      world.add(mesh(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, (_, i) => { const x = -2800 + (i >> 1) * 110 + (i % 2) * 110; return new THREE.Vector3(x, 6.6, river(x) + s * 290); })), new THREE.LineBasicMaterial({ color: 0x4a4c52 })));
      traffic(world, Array.from({ length: 14 }, (_, i) => [-2800 + i * 500, 7.2, river(-2800 + i * 500) + s * 292]), { count: 80, color: [0xffe9c0, 0xff5040], size: 2.6, speed: 16 * s, spread: 5 });
    }
    const boat = world.add(box(34, 5, 9, mat(0xf2efe6, { rough: 0.5 }), 0, 0, 0)); boat.add(box(22, 3, 7, mat(0x3a5a78, { rough: 0.3 }), -2, 5, 0));
    world.onUpdate((t) => { const x = 400 + ((t * 7) % 1600); boat.position.set(x, 0, river(x) + 60); });

    world.add(tile.mesh(), red.mesh(), green.mesh(), stone.mesh(), white.mesh(), dark.mesh(), gold.mesh(), wallM.mesh(), mast.mesh(), deck.mesh(), steel.mesh());
    lights(world, [[NX, NY + 199, NZ], [2700, 560, 2300]], { color: 0xff4030, size: 9, power: 1.2 });
    clouds(world, { count: 18, y: [1300, 1900], size: 220, color: 0xfff2dc, self: 0.3, rand: rng(4) });

    return { world, path, focus, duration: 50 };
  },
};
