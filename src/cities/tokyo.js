// Tokyo at night: in under the Rainbow Bridge to Tokyo Tower, across to the lantern gate and pagoda of Senso-ji,
// up past the Skytree, then down into a neon canyon and over the scramble crossing, Mt Fuji faint at the end of the street.
import { THREE, mergeGeometries, createWorld, rng, lerp, mat, glowMat, facadeMat, mesh, box, cyl, sphere, lathe, prism, tube, beam, hipRoof, instances, buildings, cityGrid, water, trees, lights, traffic, sign, suspensionBridge, clearance } from '../kit.js';

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
  for (const [material, gs] of by) out.add(mesh(mergeGeometries(gs), material, 0, 0, 0, { cast: false }));
  return out;
}
/** Many copies of one shape that move: at(i, t) -> [x, y, z, ry]. */
function fleet(world, geo, material, n, at, colors) {
  const im = instances(geo, material, Array.from({ length: n }, (_, i) => ({ y: -50, color: colors?.[i % colors.length] })), { cast: false }), d = new THREE.Object3D();
  world.onUpdate((t) => { for (let i = 0; i < n; i++) { const [x, y, z, ry] = at(i, t); d.position.set(x, y, z); d.rotation.y = ry; d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; });
  world.add(im); return im;
}

export default {
  build() {
    const r = rng(1964);
    const world = createWorld({
      sky: { top: 0x080c2a, horizon: 0x4c3676, bottom: 0x141022, haze: 0.45 },
      sun: { dir: [-0.35, 0.78, 0.45], color: 0xc0c8f0, power: 0.8, disc: 0xe6ecff, size: 0.0008 },   // the moon
      ambient: { sky: 0x5262ac, ground: 0x4a3040, power: 1.35 },
      fog: { color: 0x2a2148, density: 0.00036 }, stars: 900, exposure: 1.45, env: 0.6,
    });
    const path = [[240, 60, 1650], [150, 28, 1250], [70, 140, 700], [680, 42, 460], [700, 40, 230], [770, 80, -110], [1010, 200, -50], [1075, 265, -250], [960, 170, -560], [700, 60, -700], [400, 32, -700], [100, 28, -700], [-200, 30, -700], [-480, 44, -700]];
    const TT = [0, 650], SKY = [1180, -160], GATE = [700, 230], PAG = [640, 20], CZ = -700, HW = 22;   // CZ: the canyon's centre line, HW: half its width
    const focus = [[0.08, TT[0], 170, TT[1]], [0.26, TT[0], 185, TT[1]], [0.33, GATE[0], 12, GATE[1]], [0.4, GATE[0], 12, GATE[1]], [0.44, PAG[0], 34, PAG[1]], [0.5, PAG[0], 40, PAG[1]], [0.55, SKY[0], 340, SKY[1]], [0.63, SKY[0], 350, SKY[1]], [0.7, 420, 36, CZ], [0.78, 0, 30, CZ]];
    const clear = clearance(path);

    // ---- the bay, the Sumida river and the land between
    water(world, -1.5, { color: 0x1c3468, rough: 0.1, ripple: 80, strength: 0.3, env: 1.6 });
    const tarmac = mat(0x2b2e3c, { rough: 0.8 });
    for (const o of [[[-4300, 1000], [-900, 1000], [-900, 1130], [-700, 1130], [-700, 1000], [-350, 1000], [-350, 1095], [-120, 1095], [-120, 1000], [880, 1000], [880, -4300], [-4300, -4300]], [[960, 1000], [4300, 1000], [4300, -4300], [960, -4300]], [[700, 1150], [4300, 1150], [4300, 4300], [700, 4300]]])
      world.add(prism(o, 3, tarmac, 0, -3, 0, { cast: false }));

    // ---- Rainbow Bridge: white towers and cables strung with lamps, traffic streaming over
    const rb = suspensionBridge({ length: 1250, towerH: 126, deckY: 52, width: 28, color: 0xe2e6ea, towers: [-285, 285], cable: 0.8 });
    rb.traverse((m) => { if (m.material) { m.material.emissive = new THREE.Color(0x8fa4c8); m.material.emissiveIntensity = 0.32; m.castShadow = false; } });
    rb.position.set(150, -1.5, 1250); world.add(rb);
    const concrete = mat(0x4d5058), rbx = [];
    world.add(bake(box(40, 56, 46, concrete, -475, -3, 1250), box(40, 56, 46, concrete, 775, -3, 1250), box(26, 3.5, 250, concrete, -475, 45.5, 1125), ...[1060, 1130, 1200].map((z) => box(8, 48, 8, concrete, -475, -3, z))));
    for (const s of [-1, 1]) for (let i = 0; i <= 150; i++) {
      const x = -625 + i * 1250 / 150, a = Math.abs(x), u = a < 285 ? a / 285 : (a - 285) / 340, y = a < 285 ? 56 + 70 * u * u : lerp(126, 52, 1 - (1 - u) * (1 - u));
      rbx.push([150 + x, y + 0.5, 1250 + s * 14]);
    }
    lights(world, rbx, { color: [0xffffff, 0xffffff, 0x7dff9a, 0xff6a8a, 0x9ad0ff], size: 6, power: 1.1, rand: rng(2) });
    traffic(world, [[-475, 54, 1244], [775, 54, 1244]], { count: 46, color: 0xfff0d0, size: 4.5, speed: 20, spread: 5 });
    traffic(world, [[775, 54, 1257], [-475, 54, 1257]], { count: 46, color: 0xff3020, size: 4.5, speed: 20, spread: 5 });

    // ---- Tokyo Tower: a red-and-white lattice, floodlit orange
    const tt = new THREE.Group(), orange = mat(0xe8521e, { emissive: 0xff5412, glow: 0.9, rough: 0.6 }), ivory = mat(0xf2ede4, { emissive: 0xffc890, glow: 0.75 }), wAt = (y) => 1.6 + 38.4 * Math.exp(-y / 128), glowPts = [];
    const levels = [0, 46]; for (let y = 46, step = 17; y < 258;) { y += step; step = Math.max(8, step * 0.93); levels.push(Math.min(y, 262)); }
    levels.forEach((y1, i) => {
      if (!i) return;
      const y0 = levels[i - 1], w0 = wAt(y0), w1 = wAt(y1), m = Math.floor((i + 1) / 3) % 2 ? ivory : orange, t = lerp(3.4, 0.9, y1 / 262);
      for (let k = 0; k < 4; k++) {
        const c = [[1, 1], [1, -1], [-1, -1], [-1, 1]], [ax, az] = c[k], [bx, bz] = c[(k + 1) % 4];
        tt.add(beam([ax * w0, y0, az * w0], [ax * w1, y1, az * w1], t, m), beam([ax * w1, y1, az * w1], [bx * w1, y1, bz * w1], t * 0.55, m));
        if (i > 1) tt.add(beam([ax * w0, y0, az * w0], [bx * w1, y1, bz * w1], t * 0.45, m), beam([bx * w0, y0, bz * w0], [ax * w1, y1, az * w1], t * 0.45, m));
        else tt.add(tube([[ax * w0, 0, az * w0], [lerp(ax, bx, 0.2) * 36, 30, lerp(az, bz, 0.2) * 36], [(ax + bx) * 14, 43, (az + bz) * 14], [lerp(ax, bx, 0.8) * 36, 30, lerp(az, bz, 0.8) * 36], [bx * w0, 0, bz * w0]], 1.3, orange, { seg: 30, radial: 5 }));
        for (let y = y0; y < y1; y += 9) glowPts.push([TT[0] + ax * wAt(y) * 1.02, y, TT[1] + az * wAt(y) * 1.02]);
      }
    });
    const deck = facadeMat({ color: 0xf2ede4, floor: 4.2, bay: 2.2, frame: [0.1, 0.2], glass: 0x2a2a30, lit: 0.95, litColor: 0xffe2b0, night: 2.2 });
    tt.add(box(36, 13, 36, deck, 0, 146, 0), box(38, 1.2, 38, ivory, 0, 145, 0), box(38, 1.2, 38, ivory, 0, 159, 0), box(17, 8, 17, deck, 0, 246, 0), box(64, 18, 64, deck, 0, 0, 0));
    [[262, 24, 2.6, ivory], [286, 22, 2, orange], [308, 25, 1.2, ivory]].forEach(([y, h, w, m]) => tt.add(cyl(w * 0.75, w, h, m, 0, y, 0, 4)));
    tt.position.set(TT[0], 0, TT[1]); world.add(bake(tt));
    lights(world, glowPts, { color: 0xff8a30, size: 13, power: 0.6 });
    lights(world, [[TT[0], 334, TT[1]], [TT[0], 264, TT[1]]], { color: 0xff3020, size: 9, power: 1.6 });

    // ---- Tokyo Skytree: a pale diagrid shaft, two glowing decks, the mast above
    const sk = new THREE.Group(), ice = mat(0x9fc0e8, { emissive: 0x4f9cff, glow: 0.6 }), violet = mat(0xc9a0ff, { emissive: 0xa860ff, glow: 1.6 }), rAt = (y) => 34 - 21 * Math.pow(y / 350, 0.7), skyPts = [];
    const pod = facadeMat({ color: 0xdfe6ee, floor: 4.6, bay: 2.4, frame: [0.08, 0.2], glass: 0x1c2230, lit: 0.9, litColor: 0xdfeaff, night: 2, round: 22 });
    for (let k = 0; k < 14; k++) {
      const y0 = k * 25, y1 = y0 + 25, r0 = rAt(y0), r1 = rAt(y1);
      for (let j = 0; j < 24; j++) {
        const a = (j + k * 0.5) / 24 * Math.PI * 2, p = [Math.cos(a) * r0, y0, Math.sin(a) * r0], q = (d) => [Math.cos(a + d) * r1, y1, Math.sin(a + d) * r1];
        sk.add(beam(p, q(Math.PI / 24), 0.75, ice), beam(p, q(-Math.PI / 24), 0.75, ice));
        if (j % 2 === 0) skyPts.push([SKY[0] + p[0], y0, SKY[1] + p[2]]);
      }
      sk.add(mesh(new THREE.TorusGeometry(r1, 0.5, 5, 48).rotateX(Math.PI / 2), ice, 0, y1, 0));
    }
    sk.add(cyl(9, 12, 350, mat(0x2a3040), 0, 0, 0, 16), cyl(11, 12.5, 66, ice, 0, 374, 0, 20), cyl(5, 9, 42, ice, 0, 460, 0, 12), cyl(2.2, 5, 132, ice, 0, 502, 0, 8));
    for (const y of [351, 367, 443, 457]) sk.add(mesh(new THREE.TorusGeometry(y < 400 ? 24.6 : 17.6, 0.7, 6, 48).rotateX(Math.PI / 2), violet, 0, y, 0));
    sk.position.set(SKY[0], 0, SKY[1]); world.add(bake(sk));
    world.add(lathe([[13, 340], [19, 346], [24, 352], [24.5, 366], [22, 372], [13, 377]], pod, SKY[0], 0, SKY[1], 40, { cast: false }), lathe([[11, 437], [17, 444], [17.5, 456], [11, 461]], pod, SKY[0], 0, SKY[1], 32, { cast: false }));
    lights(world, skyPts, { color: 0x8fc8ff, size: 6, power: 0.9 });
    lights(world, [[SKY[0], 636, SKY[1]], [SKY[0], 502, SKY[1]], [SKY[0], 462, SKY[1]]], { color: 0xffffff, size: 11, power: 1.6 });

    // ---- Senso-ji: the gate with its giant red lantern, the lane of stalls, the inner gate, the main hall and the five-storey pagoda
    const sj = new THREE.Group(), vermilion = mat(0xc9341f, { emissive: 0xff3408, glow: 0.26 }), shoji = mat(0xffe0a8, { emissive: 0xffb860, glow: 1.15 }), roofTile = mat(0x46524f, { rough: 0.6, emissive: 0x203038, glow: 0.35 }), paper = mat(0xd81e12, { emissive: 0xff2606, glow: 1.5 }), black = mat(0x15120f), brass = mat(0xe6b84a, { metal: 0.8, rough: 0.3, emissive: 0xffb030, glow: 0.5 }), flag = mat(0x5a5650);
    const lantern = (x, y, z, s, m = paper) => sj.add(lathe([[0.8, 0], [2.6, 0.5], [3.3, 2.2], [3.3, 4.4], [2.6, 6], [0.9, 6.5]], m, x, y, z, 20, { scale: s }), cyl(2.75 * s, 2.75 * s, 0.7 * s, black, x, y + 0.1 * s, z, 20), cyl(2.75 * s, 2.75 * s, 0.7 * s, black, x, y + 5.7 * s, z, 20), cyl(1 * s, 2.2 * s, 0.5 * s, brass, x, y - 0.4 * s, z, 12));
    sj.add(box(184, 0.3, 380, flag, 0, 0, -160));
    for (const s of [-1, 1]) sj.add(box(7, 11.5, 8, vermilion, s * 8, 0, 0), box(5.4, 7, 8.4, black, s * 8, 1.4, 0));
    sj.add(box(23, 3.2, 8, vermilion, 0, 11, 0), hipRoof(33, 17, 7, roofTile, 0, 14.2, 0, { ridge: 0.6, lift: 1.8 }), box(19, 0.9, 1.2, brass, 0, 20.9, 0));
    lantern(0, 3.6, 0, 1.08);
    for (const s of [-1, 1]) { const t = sign('雷門', 4.8, { vertical: true, color: '#120a08', weight: 900 }); t.position.set(0, 7.3, s * 3.62); t.rotation.y = s > 0 ? 0 : Math.PI; sj.add(t); }
    const H = -190;   // the inner gate, relative to the outer one
    sj.add(box(36, 9.5, 13, vermilion, 0, 0, H), hipRoof(47, 22, 5.5, roofTile, 0, 9.5, H, { ridge: 0.8, curve: 1.2, lift: 1.5 }), box(30, 7, 10, vermilion, 0, 11, H), hipRoof(43, 20, 8.5, roofTile, 0, 18, H, { ridge: 0.6, lift: 2 }));
    for (const x of [-11, 0, 11]) { sj.add(box(7.5, 7.4, 13.4, black, x, 0, H)); lantern(x, 2.4, H + 6.9, x ? 0.6 : 0.8, x ? mat(0x3a4a44, { emissive: 0x406058, glow: 0.4 }) : paper); }
    sj.add(box(42, 3, 40, flag, 0, 0, H - 92), box(35, 11.5, 31, vermilion, 0, 3, H - 92), box(26, 6, 31.4, shoji, 0, 4.5, H - 92), box(30, 3, 10.3, shoji, 0, 12.6, H), hipRoof(52, 47, 17.5, roofTile, 0, 14.5, H - 92, { ridge: 0.45, curve: 1.5, lift: 2.4 }), box(22, 1.2, 1.4, brass, 0, 31.6, H - 92));
    for (let i = 0; i < 5; i++) {
      const s = 9 - i * 0.95, y = 3 + i * 8.6;
      sj.add(box(s, 8.6, s, vermilion, -60, y, H - 20), box(s - 1.6, 2.4, s + 0.3, shoji, -60, y + 1.2, H - 20), box(s + 0.3, 2.4, s - 1.6, shoji, -60, y + 1.2, H - 20), hipRoof(s + 11.5, s + 11.5, i === 4 ? 5.5 : 3.4, roofTile, -60, y + 5.6, H - 20, { ridge: 0.02, curve: i === 4 ? 1.4 : 1.15, lift: 1.3 }));
    }
    sj.add(box(17, 3, 17, flag, -60, 0, H - 20), cyl(0.25, 0.45, 12.5, brass, -60, 51.4, H - 20, 8));
    for (let i = 0; i < 7; i++) sj.add(mesh(new THREE.TorusGeometry(1.25 - i * 0.1, 0.16, 5, 14).rotateX(Math.PI / 2), brass, -60, 54 + i * 1.15, H - 20));
    for (const s of [-1, 1]) for (let z = -16; z > H + 14; z -= 7.2) sj.add(box(5, 4.2, 6.6, vermilion, s * 9.2, 0, z), box(0.4, 2.2, 6, shoji, s * 6.6, 0.6, z), box(6.4, 0.5, 7.2, roofTile, s * 9, 4.2, z));
    sj.position.set(GATE[0], 0, GATE[1]); world.add(bake(sj));
    const lamps = [], halo = [];
    for (let z = -12; z > H + 12; z -= 3.6) for (const s of [-1, 1]) lamps.push([GATE[0] + s * 6.3, 5, GATE[1] + z]);
    for (let i = 0; i < 5; i++) for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lamps.push([PAG[0] + a * (10.2 - i * 0.48), 8.8 + i * 8.6, PAG[1] + b * (10.2 - i * 0.48)]);
    lights(world, lamps, { color: [0xffb060, 0xff7040, 0xffd090], size: 3.2, power: 1.2 });
    halo.push([GATE[0], 9, GATE[1] + 9], [GATE[0], 10, GATE[1] + H + 12], [GATE[0], 16, GATE[1] + H - 70], [PAG[0], 20, PAG[1] + 8], [PAG[0], 40, PAG[1] + 8], [GATE[0], 4, GATE[1] - 60], [GATE[0], 4, GATE[1] - 130]);
    lights(world, halo, { color: 0xff6a30, size: 60, power: 0.3 });
    const grove = []; for (let i = 0; i < 70; i++) { const x = r.range(-88, 88), z = r.range(-330, 10); if (Math.abs(x) > 30 && Math.hypot(x + 60, z - H + 20) > 16) grove.push([GATE[0] + x, 0, GATE[1] + z]); }
    trees(world, grove, 'round', { size: 10, color: [0x1f3a2a, 0x24452e, 0x2c4a30], rand: r });

    // ---- the neon canyon: towers either side of the avenue, hung with blade signs, boards and glowing panels
    const words = ['カラオケ', '居酒屋', 'ラーメン', '焼肉', '寿司', 'ホテル', '薬', '本', '酒', '喫茶', 'カメラ', '映画', '電気', 'ゲーム', 'カフェ', 'たこ焼き', '東京', '渋谷', '銀座', '新宿', '祭', '夢', '大売出し', '24時間', '麺', '天ぷら', 'そば', 'うどん', '花', '時計', '宝石', 'ビール', '音楽', '書店', '百貨店', '温泉', '焼鳥', '居酒屋', 'カラオケ'];
    const neon = ['#ff3b6b', '#39e6ff', '#ffe14a', '#ff7a1a', '#7dff6a', '#ffffff', '#ff5ad1', '#6aa8ff'], solid = ['#c2142c', '#0c3fa8', '#111111', '#0a6a3a', '#111111', '#7a12a0', '#d8480a'];
    const canyon = [], panels = [], boards = new THREE.Group(), pools = [], beacons = [];
    let blades = 0, wi = 0;
    for (const s of [-1, 1]) for (let x = 642; x > -392;) {
      const w = r.range(20, 40), d = r.range(26, 36), z = CZ + s * (HW + d / 2), face = CZ + s * HW; x -= w / 2;
      const h = Math.min(r.range(38, 82), clear(x, CZ + s * (HW + 13), 30) - 24);
      if (h > 9 && !(x > -232 - w / 2 && x < -168 + w / 2) && Math.abs(x - 150) > 14 + w / 2) {
        canyon.push({ x, z, w: w - 1.2, d, h });
        panels.push({ x, y: 0.6, z: face - s * 0.3, sx: w - 3, sy: 4.4, sz: 0.5, color: r.pick([0xffe2b0, 0xfff4e0, 0xffc0d0, 0xc0f0ff, 0xffd080]) });
        for (let k = r.int(2, 4); k > 0; k--) { const tall = r.chance(0.5); panels.push({ x: x + r.range(-w / 2 + 3, w / 2 - 3), y: r.range(7, h - 12), z: face - s * 0.3, sx: tall ? r.range(1.2, 2.2) : r.range(4, 9), sy: tall ? r.range(6, 12) : r.range(1.2, 3), sz: 0.5, color: r.pick(neon) }); }
        if (r.chance(0.5)) panels.push({ x, y: h - 1.2, z: face - s * 0.3, sx: w - 1.2, sy: 1, sz: 0.6, color: r.pick(neon) });
        if (h > 22 && blades < 46 && r.chance(0.85)) {
          const txt = words[wi++ % words.length], n = [...txt].length, tall = Math.min(4.7 * (100.8 * n + 48) / 144, h - 9), plain = r.chance(0.45);
          const b = sign(txt, tall, { vertical: true, color: plain ? r.pick(neon) : '#ffffff', bg: plain ? '#0b0b10' : r.pick(solid), glow: 1.9 });
          b.position.set(x + w / 2 - 1.5, r.range(7 + tall / 2, h - 3 - tall / 2), face - s * (0.5 + b.geometry.parameters.width / 2)); b.rotation.y = Math.PI / 2; boards.add(b); blades++;
        }
        if (h > 30 && r.chance(0.4)) {
          const txt = words[wi++ % words.length], plain = r.chance(0.5), b = sign(txt, r.range(4.5, 6.5), { color: plain ? r.pick(neon) : '#ffffff', bg: plain ? '#0b0b10' : r.pick(solid), glow: 1.8 });
          b.position.set(x, r.range(h * 0.5, h - 8), face - s * 0.7); b.rotation.y = s > 0 ? Math.PI : 0; boards.add(b);
        }
        if (h > 44 && r.chance(0.45)) {   // a rooftop hoarding, turned to face down the avenue
          const b = sign(words[wi++ % words.length], r.range(7, 10), { color: '#ffffff', bg: r.pick(solid), glow: 1.9 });
          b.position.set(x + w / 2 - 1, h + 1 + b.geometry.parameters.height / 2, z - s * (d / 2 - b.geometry.parameters.width / 2 - 1)); b.rotation.y = Math.PI / 2; boards.add(b);
        }
        pools.push([x, 4, face - s * 3], [x, h * 0.5, face - s * 2]);
        if (h > 60) beacons.push([x - w / 2 + 1, h + 1, z], [x + w / 2 - 1, h + 1, z]);
      }
      x -= w / 2 + 0.6;
    }
    world.add(buildings(canyon.map((b) => ({ ...b, color: r.pick([0x555a6c, 0x6a6474, 0x484e62, 0x746e7c]) })), facadeMat({ floor: 3.8, bay: 2.6, frame: [0.16, 0.22], glass: 0x10131c, lit: 0.4, litColor: 0xffdcae, night: 1.25, rough: 0.6 }), { cast: false }), boards);
    world.add(instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), glowMat(0xffffff, 1.5, { toneMapped: false }), panels, { cast: false, receive: false }));
    world.onUpdate((t, dt, cam) => { boards.visible = Math.hypot(cam.position.x - 120, cam.position.z - CZ) < 1150; });
    lights(world, pools, { color: neon.map((c) => new THREE.Color(c).getHex()), size: 52, power: 0.24, rand: rng(6) });
    world.add(box(1060, 0.1, HW * 2, glowMat(0x2c2244), 125, 0.02, CZ, { cast: false, receive: false }));

    // ---- the scramble crossing: zebra stripes every way, a crowd walking, giant screens on the corner buildings
    const X0 = -200, stripes = [], zebra = glowMat(0xb8bcc8, 0.55), ways = [];
    for (const s of [-1, 1]) {
      for (let k = -17; k <= 17; k++) stripes.push({ x: X0 + s * 31, y: 0.06, z: CZ + k * 1.2, sx: 5, sy: 0.05, sz: 0.6 }, { x: X0 + k * 1.3, y: 0.06, z: CZ + s * 27, sx: 0.65, sy: 0.05, sz: 5 });
      for (let k = -14; k <= 14; k++) stripes.push({ x: X0 + k * 1.6, y: 0.06, z: CZ + s * k * 1.4, sx: 0.6, sy: 0.05, sz: 4.4, ry: s * 0.72 });
      ways.push([[X0 + s * 31, CZ - 21], [X0 + s * 31, CZ + 21]], [[X0 - 23, CZ + s * 27], [X0 + 23, CZ + s * 27]], [[X0 - 22, CZ - s * 20], [X0 + 22, CZ + s * 20]]);
    }
    world.add(instances(new THREE.BoxGeometry(1, 1, 1), zebra, stripes, { cast: false, receive: false }));
    fleet(world, new THREE.BoxGeometry(0.6, 1.7, 0.45).translate(0, 0.85, 0), glowMat(0xffffff, 0.75), 260, (i, t) => {
      const [a, b] = ways[i % 6], dir = i % 2 ? 1 : -1, u = ((i * 0.6180339 + dir * t * (0.035 + (i % 7) * 0.003)) % 1 + 1) % 1, off = ((i * 7) % 11 - 5) * 0.5, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      return [lerp(a[0], b[0], u) - dz / l * off, 0, lerp(a[1], b[1], u) + dx / l * off, Math.atan2(dx, dz)];
    }, [0xe8e8ea, 0x9aa0b0, 0xffd0b0, 0x5a6278, 0xf0c8d0, 0x303644, 0xc8d8f0]);
    [[X0 - 36.6, 30, CZ - 40, 26, 15, Math.PI / 2, '東京'], [X0 - 36.6, 26, CZ + 40, 22, 13, Math.PI / 2, '渋谷'], [X0 + 60, 44, CZ - 22.9, 20, 11, 0, '夢']].forEach(([x, y, z, w, h, ry, txt], k) => {
      const m = mesh(new THREE.PlaneGeometry(w, h), glowMat(0xffffff, 1.3, { toneMapped: false }), x, y, z, { ry, cast: false, receive: false }), t = sign(txt, h * 0.62, { color: '#ffffff', glow: 2 });
      t.position.set(x + (ry ? 0.3 : 0), y, z + (ry ? 0 : 0.3)); t.rotation.y = ry; world.add(m, t);
      world.onUpdate((time) => { m.material.color.setHSL((time * 0.07 + k * 0.31) % 1, 0.85, 0.3 + 0.12 * Math.sin(time * 1.7 + k)).multiplyScalar(1.6); });
    });
    world.add(cyl(15, 15, 62, facadeMat({ color: 0x8a8e9a, floor: 4, bay: 2.4, frame: [0.1, 0.2], glass: 0x141824, lit: 0.8, litColor: 0xdff0ff, night: 2, round: 15 }), X0 - 52, 0, CZ - 40, 28, { cast: false }));

    // ---- the rest of the city: lit windows to the horizon, towers in clusters, red beacons on the tall ones
    const rects = [[600, -130, 795, 255], [-75, 575, 75, 725], [1115, -225, 1245, -95], [-240, -1150, -160, -250], [860, -4300, 980, 1000], [-4300, CZ - 24, -380, CZ + 24]];
    const hub = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (s * s));
    const lots = cityGrid({
      rand: r, area: [-2700, -2700, 2700, 2300], block: 40, street: 14, jitter: 0.3, split: 0.3,
      keep: (x, z) => (z < 978 || (x > 725 && z > 1175)) && !(Math.abs(z - CZ) < 78 && x > -415 && x < 668) && !rects.some(([a, b, c, d]) => x > a - 22 && x < c + 22 && z > b - 22 && z < d + 22),
      height: (x, z) => Math.min((r.range(12, 40) + (r.chance(0.5) ? 1 : 0.25) * (190 * hub(x, z, -350, 480, 330) + 150 * hub(x, z, -80, -900, 300) + 210 * hub(x, z, -1500, -1500, 420) + 170 * hub(x, z, 380, -230, 260) + 120 * hub(x, z, 1600, 400, 400))) * (1 - 0.7 * hub(x, z, 700, 60, 280)), clear(x, z, 85) - 30),
    });
    const A = [], B = [], lampPts = [];
    for (const b of lots) {
      if (b.h > 70) { b.color = r.pick([0x46526a, 0x3c4860, 0x525e78, 0x484e64]); B.push(b); beacons.push([b.x - b.w / 2, b.h + 1, b.z - b.d / 2], [b.x + b.w / 2, b.h + 1, b.z + b.d / 2]); }
      else { b.color = r.pick([0x6c7080, 0x80828c, 0x5e6478, 0x8c8480, 0x767a86]); A.push(b); }
      lampPts.push([b.x + 27, 6, b.z + r.range(-20, 20)], [b.x + r.range(-20, 20), 6, b.z + 27]);
    }
    world.add(buildings(A, facadeMat({ floor: 3.4, bay: 3, frame: [0.25, 0.3], glass: 0x0f1218, lit: 0.38, litColor: 0xffd9a0, night: 1.4, rough: 0.9 }), { cast: false }));
    world.add(buildings(B, facadeMat({ floor: 4.2, bay: 3.2, frame: [0.12, 0.2], glass: 0x0e1420, lit: 0.3, litColor: 0xdfe8ff, night: 1.15, rough: 0.35, metal: 0.3 }), { cast: false }));
    lights(world, lampPts, { color: [0xffc070, 0xffe0b0, 0xfff0e0], size: 6, power: 0.85 });
    const red = lights(world, beacons, { color: 0xff2a1a, size: 6, power: 1.5 }); red.material.transparent = true;
    world.onUpdate((t) => { red.material.opacity = 0.55 + 0.45 * Math.sin(t * 2.4); });

    // ---- streams of head and tail lights on the avenues, lantern boats on the water
    const road = (a, b, n, o = {}) => { traffic(world, [a, b], { count: n, color: 0xfff2d8, size: 3.6, speed: 15, spread: 2.5, ...o }); };
    road([-1600, 1.2, CZ - 7], [900, 1.2, CZ - 7], 120); road([900, 1.2, CZ + 7], [-1600, 1.2, CZ + 7], 120, { color: 0xff2a1a });
    road([X0 - 5, 1.2, -1700], [X0 - 5, 1.2, 300], 70); road([X0 + 5, 1.2, 300], [X0 + 5, 1.2, -1700], 70, { color: 0xff2a1a });
    road([-1400, 1.2, 286], [850, 1.2, 286], 90, { spread: 4 }); road([850, 1.2, 296], [-1400, 1.2, 296], 90, { color: 0xff2a1a, spread: 4 });
    road([850, 1.2, 960], [850, 1.2, -1800], 80); road([993, 1.2, -1800], [993, 1.2, 960], 80, { color: 0xff2a1a });
    traffic(world, [[-800, 1, 1500], [0, 1, 1420], [700, 1, 1560], [1500, 1, 1800], [600, 1, 2100], [-400, 1, 1900]], { count: 9, color: 0xffa040, size: 10, speed: 5, loop: true });
    traffic(world, [[920, 1, 900], [925, 1, -200], [915, 1, -1500]], { count: 7, color: 0xffb060, size: 8, speed: 5 });
    const glint = []; for (let i = 0; i < 900; i++) { const d = r() * r(); glint.push(i % 5 ? [r.range(-1500, 880), -1.2, 998 - 0 + d * 420] : [r.range(884, 956), -1.2, r.range(-1800, 990)]); }
    lights(world, glint, { color: [0xffd9a0, 0xfff0d8, 0xff9a60, 0x9ad0ff, 0xff6a8a], size: 4.5, power: 0.55, rand: rng(9) });
    const spans = []; for (const z of [700, 268, -320, CZ, -1200]) spans.push(box(88, 2, z === CZ ? 44 : 18, concrete, 920, 0, z));
    world.add(bake(spans));

    // ---- Mt Fuji, far off at the end of the avenue: a dark cone, a faint cap of snow
    const fuji = lathe([[1650, 0], [1000, 170], [560, 360], [290, 520], [150, 630], [0, 632]], glowMat(0x12132e, 1, { fog: false }), -4400, 0, CZ, 48, { cast: false, receive: false, scale: 0.82 });
    const snow = new THREE.LatheGeometry([[470, 400], [292, 521], [151, 631], [0, 634]].map(([a, b]) => new THREE.Vector2(a, b)), 48), sp = snow.attributes.position;
    for (let i = 0; i < sp.count; i++) if (sp.getY(i) < 410) { const a = Math.atan2(sp.getZ(i), sp.getX(i)), k = 1 + 0.16 * Math.sin(a * 9) + 0.1 * Math.sin(a * 23 + 1); sp.setY(i, 400 + 70 * (k - 1) * 3); }
    world.add(fuji, mesh(snow, glowMat(0x6f7ca8, 0.62, { fog: false }), -4400, 0, CZ, { cast: false, receive: false, scale: 0.82 }));

    return { world, path, focus, duration: 50 };
  },
};
