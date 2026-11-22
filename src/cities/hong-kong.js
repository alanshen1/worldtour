// Hong Kong at night: down a Kowloon street hung with neon signs, out low across Victoria Harbour among the ferries and a red-sailed junk,
// along the wall of towers at Central, round the Bank of China Tower and up the slope beside the Peak Tram to look back from Victoria Peak.
import { THREE, mergeGeometries, createWorld, rng, fbm, smooth, lerp, mat, glowMat, facadeMat, mesh, box, cyl, sphere, tube, beam, instances, buildings, cityGrid, terrain, water, lights, traffic, sign, clearance } from '../kit.js';

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
/** Flat-shaded geometry from a list of triangles' corner points. */
function facets(pts) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return g; }

export default {
  build() {
    const r = rng(1997);
    const world = createWorld({
      sky: { top: 0x070b24, horizon: 0x56386a, bottom: 0x120f20, haze: 0.42 },
      sun: { dir: [0.4, 0.75, -0.5], color: 0xc0c8f0, power: 0.8, disc: 0xe6ecff, size: 0.0008 },   // the moon
      ambient: { sky: 0x5466b0, ground: 0x4a3044, power: 1.3 },
      fog: { color: 0x2a2248, density: 0.00033 }, stars: 700, exposure: 1.4, env: 0.6,
    });
    const path = [[600, 34, -1400], [600, 30, -1050], [600, 28, -640], [480, 14, -250], [150, 14, 60], [-180, 45, 260], [-200, 110, 420], [0, 150, 520], [230, 190, 560],
      [480, 235, 650], [520, 275, 800], [420, 300, 960], [180, 350, 1160], [-150, 400, 1320], [-430, 440, 1400], [-640, 455, 1310], [-700, 450, 1120], [-700, 440, 930]];
    const IFC = [-350, 520], BOC = [380, 720], ICC = [-900, -820], PEAK = [-470, 1570], KX = 600, HW = 22;   // KX: the neon street's centre line, HW: half its width
    const focus = [[0.29, BOC[0], 190, BOC[1]], [0.38, IFC[0], 200, IFC[1]], [0.47, IFC[0], 250, IFC[1]], [0.56, BOC[0], 220, BOC[1]], [0.68, BOC[0], 270, BOC[1]], [0.74, PEAK[0], 400, PEAK[1]], [0.8, PEAK[0], 410, PEAK[1]]];
    const clear = clearance(path);

    // ---- the harbour, the flat reclaimed shores, and the hills: Victoria Peak behind the island city, Lion Rock far behind Kowloon
    water(world, 0, { color: 0x16305e, rough: 0.1, ripple: 80, strength: 0.3, env: 1.6 });
    const tarmac = mat(0x2b2e3c, { rough: 0.8 });
    world.add(bake(box(9000, 4, 4100, tarmac, 0, -2, 2500), box(9000, 4, 4000, tarmac, 0, -2, -2500), box(520, 4, 260, tarmac, -900, -2, -420), box(300, 4, 70, tarmac, 1000, -2, 425), box(260, 4, 50, tarmac, -150, -2, 430)));
    const hillAt = (x, z) => {
      if (z > -2700 && z < 840) return 0;
      const peak = 445 * smooth(840, 1640, z) * (0.74 + 0.5 * fbm(x / 600 + 3, z / 600, 3)) * (0.5 + 0.5 * smooth(3200, 1300, Math.abs(x + 100))) * (1 - 0.35 * smooth(1900, 3200, z));
      return Math.max(Math.min(peak, clear(x, z, 130) - 55), 420 * smooth(-2700, -3600, z) * (0.45 + 0.9 * fbm(x / 700, z / 700, 3)));
    };
    world.add(terrain({ size: 9000, seg: 150, height: (x, z) => hillAt(x, z) - 4, color: (x, y, z, slope) => (slope > 0.2 ? 0x6a8a6c : 0x5c8c62) }));
    const tufts = [], dark = [0x4a8456, 0x569060, 0x40784c, 0x5e9662];
    while (tufts.length < 4200) { const x = r.range(-2200, 2000), z = r.range(880, 2100), y = hillAt(x, z), s = r.range(6, 11); if (y > 12) tufts.push({ x, y: y - 3 + s * 0.3, z, sx: s, sy: s * 0.7, sz: s, ry: r() * 6, color: r.pick(dark) }); }
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { rough: 0.9, flat: true }), tufts, { cast: false }));

    // ---- the Bank of China Tower: four triangular shafts that stop at different heights under slanted glass, tied with white cross-bracing
    const S = 26, P = [[-S, -S], [S, -S], [S, S], [-S, S]], HB = [315, 232, 150, 68], pts = [], brace = [], white = mat(0xffffff, { emissive: 0xeaf2ff, glow: 1.5 });
    const bocGlass = facadeMat({ color: 0x8fb0cc, floor: 4.1, bay: 2.6, frame: [0.05, 0.08], glass: 0x1a3048, lit: 0.34, litColor: 0xcfe4ff, night: 1.2, rough: 0.15, metal: 0.6 }); bocGlass.side = THREE.DoubleSide;
    P.forEach((A, k) => {
      const B = P[(k + 1) % 4], H = HB[k], lo = H - 40, a0 = [A[0], 0, A[1]], b0 = [B[0], 0, B[1]], c0 = [0, 0, 0], a1 = [A[0], lo, A[1]], b1 = [B[0], lo, B[1]], c1 = [0, H, 0];
      pts.push(a0, b0, b1, a0, b1, a1, b0, c0, c1, b0, c1, b1, c0, a0, a1, c0, a1, c1, a1, b1, c1);
      brace.push(beam(a1, c1, 1.3, white), beam(b1, c1, 1.3, white), beam(a1, b1, 1.3, white), beam(a0, a1, 1.5, white), beam(b0, b1, 1.5, white));
      for (let y = 0; y + 26 < lo; y += 52) {
        const y1 = Math.min(y + 52, lo), f = (y1 - y) / 52;
        brace.push(beam([A[0], y, A[1]], [lerp(A[0], B[0], f), y1, lerp(A[1], B[1], f)], 1.2, white), beam([B[0], y, B[1]], [lerp(B[0], A[0], f), y1, lerp(B[1], A[1], f)], 1.2, white));
        if (y) brace.push(beam([A[0], y, A[1]], [B[0], y, B[1]], 1.2, white));
      }
    });
    brace.push(beam([0, 68, 0], [0, 315, 0], 1.3, white), cyl(0.5, 1, 54, white, -4, 300, -4, 6), cyl(0.5, 1, 54, white, 4, 300, 4, 6));
    const boc = bake(brace); boc.add(mesh(facets(pts), bocGlass, 0, 0, 0, { cast: false })); boc.position.set(BOC[0], hillAt(...BOC) + 2, BOC[1]); boc.rotation.y = 0.5; world.add(boc);

    // ---- the other stars of the skyline: IFC, Central Plaza, The Center, and ICC across the water
    const icy = facadeMat({ color: 0xa8b8cc, floor: 4.2, bay: 2.4, frame: [0.08, 0.12], glass: 0x121c2c, lit: 0.55, litColor: 0xe6f0ff, night: 1.35, rough: 0.25, metal: 0.4 });
    const warm = facadeMat({ color: 0xb8a888, floor: 4.2, bay: 2.6, frame: [0.1, 0.14], glass: 0x1c1810, lit: 0.6, litColor: 0xffd890, night: 1.4, rough: 0.3, metal: 0.4 });
    const land = new THREE.Group(), crown = mat(0xffffff, { emissive: 0xf0f6ff, glow: 1.6 }), goldGlow = mat(0xffd070, { emissive: 0xffb030, glow: 1.5 }), lit = [];
    for (const [w, y, h] of [[62, 0, 70], [56, 70, 150], [52, 220, 110], [47, 330, 56], [42, 386, 20]]) land.add(box(w, h, w, icy, IFC[0], y, IFC[1]));
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = 21 / Math.max(Math.abs(c), Math.abs(s)); land.add(box(1.6, 26 - (i % 5 ? 0 : -6), 1.6, crown, IFC[0] + c * k, 392, IFC[1] + s * k)); }
    land.add(cyl(30, 30, 296, warm, 1150, 0, 640, 3), cyl(0, 30, 44, goldGlow, 1150, 296, 640, 3), cyl(0.6, 2, 60, crown, 1150, 336, 640, 6));
    land.add(box(46, 290, 46, icy, -640, 0, 700, { ry: Math.PI / 4 }), box(46, 290, 46, icy, -640, 0, 700), cyl(0.5, 2, 56, crown, -640, 290, 700, 6));
    for (const [w, y, h] of [[72, 0, 120], [66, 120, 260], [60, 380, 70]]) land.add(box(w, h, w, icy, ICC[0], y, ICC[1]));
    for (const s of [-1, 1]) land.add(box(60, 40, 3, crown, ICC[0], 446, ICC[1] + s * 29, { rx: s * 0.12 }));
    // the Convention Centre's wings on the water, the big wheel by the Central piers, a clock tower at the Kowloon pier
    for (const [x, s] of [[1000, 1], [940, 0.7], [1065, 0.7]]) land.add(mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(70 * s, 26 * s, 44 * s), mat(0xcfd8e4, { emissive: 0x8fa8d0, glow: 0.5, metal: 0.5, rough: 0.3 }), x, 2, 420));
    land.add(box(9, 38, 9, mat(0xb8866a, { emissive: 0xff9a50, glow: 0.45 }), 520, 2, -530), cyl(0, 6.5, 8, mat(0x6a5a50), 520, 40, -530, 4), box(170, 16, 60, mat(0xd8c8c0, { emissive: 0xff8a70, glow: 0.3 }), 340, 2, -560));
    world.add(bake(land));
    const wheel = new THREE.Group(), neonBlue = mat(0xdfeaff, { emissive: 0x9ac4ff, glow: 1.6 });
    wheel.add(mesh(new THREE.TorusGeometry(28, 0.6, 6, 60), neonBlue)); for (let i = 0; i < 21; i++) { const a = i / 21 * Math.PI * 2; wheel.add(beam([0, 0, 0], [Math.cos(a) * 28, Math.sin(a) * 28, 0], 0.3, neonBlue), sphere(1.5, crown, Math.cos(a) * 29.5, Math.sin(a) * 29.5, 0, { seg: 8, rows: 6 })); }
    const eye = bake(wheel); eye.position.set(-60, 34, 448); world.add(eye, bake(beam([-76, 2, 452], [-60, 34, 452], 1.2, crown), beam([-44, 2, 452], [-60, 34, 452], 1.2, crown))); world.onUpdate((t) => { eye.rotation.z = t * 0.05; });

    // ---- the island city: a wall of towers along the water, thinner ones climbing the lower slopes
    const spots = [[IFC[0], IFC[1], 62], [BOC[0], BOC[1], 66], [1150, 640, 56], [-640, 700, 56], [-60, 448, 44], [1000, 440, 100]];
    const tramAt = (u) => [lerp(300, PEAK[0] + 30, u), lerp(905, PEAK[1] - 30, u)], nearTram = (x, z) => { const u = (z - 905) / (PEAK[1] - 935); return u > -0.05 && u < 1.05 && Math.abs(x - tramAt(u)[0]) < 26; };
    const isle = cityGrid({
      rand: r, area: [-2700, 478, 2700, 1330], block: 36, street: 13, jitter: 0.32, split: 0.3, fill: 0.86,
      keep: (x, z) => !spots.some(([a, b, c]) => Math.hypot(x - a, z - b) < c) && !nearTram(x, z) && hillAt(x, z) < 210 && (z < 900 || r.chance(0.62)),
      height: (x, z) => { const g = hillAt(x, z), wall = Math.exp(-(((z - 610) / 190) ** 2)) * (0.45 + 0.55 * Math.exp(-((x / 1500) ** 2))); return Math.min((z > 900 ? r.range(70, 150) : r.range(46, 100)) + 215 * wall * r.range(0.3, 1), clear(x, z, 85) - 30 - g); },
    });
    const glassTones = [0x56627c, 0x4a5670, 0x626e88, 0x545a72, 0x6a6474, 0x4a6274], oldTones = [0x7c7a80, 0x8c8480, 0x6c7080, 0x8a8a8c, 0x787c88];
    const A = [], B = [], crowns = [], strips = [], roofTop = [], neon = [0xff3b6b, 0x39e6ff, 0xffe14a, 0xff7a1a, 0x7dff6a, 0xffffff, 0xff5ad1, 0x6aa8ff, 0xffffff];
    const dress = (b) => {
      if (b.h <= 120) return;
      const c = r.pick(neon), y = b.y ?? 0, front = b.z - Math.sign(b.z) * b.d / 2; roofTop.push([b.x, y + b.h + 8, b.z]);
      if (r.chance(0.5)) crowns.push({ x: b.x, y: y + b.h - 3, z: front, sx: b.w + 0.5, sy: 3, sz: 0.8, color: c });
      if (r.chance(0.35)) for (const s of [-1, 1]) strips.push({ x: b.x + s * b.w / 2, y, z: front, sx: 0.9, sy: b.h, sz: 0.9, color: c });
    };
    for (const b of isle) { if (!(b.h > 12)) continue; b.y = hillAt(b.x, b.z) - 3; b.h += 3; if (b.h > 105) { b.color = r.pick(glassTones); B.push(b); } else { b.color = r.pick(oldTones); A.push(b); } dress(b); }

    // ---- Kowloon: lower and denser, with the neon street running down to the water
    const kow = cityGrid({
      rand: r, area: [-2700, -2700, 2700, -572], block: 40, street: 14, jitter: 0.3, split: 0.3,
      keep: (x, z) => !(Math.abs(x - KX) < 76 && z > -1560) && Math.hypot(x - ICC[0], z - ICC[1]) > 75 && !(x > 240 && x < 545 && z > -640),
      height: (x, z) => Math.min(r.range(22, 62) + (r.chance(0.5) ? 190 : 30) * Math.exp(-((x - ICC[0] - 100) ** 2 + (z - ICC[1] + 60) ** 2) / 110000) * r.range(0.4, 1) + (r.chance(0.3) ? 90 : 0) * Math.exp(-(((z + 700) / 260) ** 2)) * r(), clear(x, z, 85) - 30),
    });
    for (const b of kow) { if (!(b.h > 8)) continue; if (b.h > 105) { b.color = r.pick(glassTones); B.push(b); } else { b.color = r.pick(oldTones); A.push(b); } dress(b); }
    // the street itself: tenements either side, shopfronts glowing, signs cantilevered out over the road
    const words = ['茶餐廳', '大押', '麻雀', '珠寶金行', '藥房', '海鮮酒家', '桑拿', '夜總會', '燒臘', '粥麵', '鐘錶', '涼茶', '賓館', '電器', '茶樓', '餅家', '卡拉OK', '足浴', '銀行', '雀館', '火鍋', '酒吧', '相機', '點心', '當', '洋服', '眼鏡', '冰室', '參茸', '燕窩', '皮鞋', '涮涮鍋', '髮廊', '找換店', '海味', '雲吞麵', '牛腩', '百貨'];
    const css = ['#ff3b6b', '#39e6ff', '#ffe14a', '#ff7a1a', '#7dff6a', '#ffffff', '#ff5ad1'], solid = ['#c2142c', '#0c3fa8', '#0a6a3a', '#111111', '#7a12a0', '#d8480a', '#b00a18'];
    const panels = [], boards = new THREE.Group(), pools = [];
    let wi = 0;
    for (const s of [-1, 1]) for (let z = -1340; z < -596;) {
      const w = r.range(18, 34), d = r.range(24, 34), face = KX + s * HW; z += w / 2;
      const h = Math.min(r.range(34, 74), clear(face + s * 12, z, 30) - 24);
      A.push({ x: face + s * d / 2, z, w: d, d: w - 1, h, color: r.pick(oldTones) });
      panels.push({ x: face - s * 0.3, y: 0.6, z, sx: 0.5, sy: 4.6, sz: w - 3, color: r.pick([0xffe2b0, 0xfff4e0, 0xffc0d0, 0xc0f0ff, 0xffd080]) });
      for (let k = r.int(1, 3); k > 0; k--) panels.push({ x: face - s * 0.3, y: r.range(8, h - 8), z: z + r.range(-w / 2 + 3, w / 2 - 3), sx: 0.5, sy: r.range(1.2, 8), sz: r.range(1.5, 8), color: r.pick(neon) });
      for (let k = 0; k < 2; k++) if (wi < 58 && r.chance(k ? 0.45 : 0.95)) {
        const txt = words[wi++ % words.length], upright = r.chance(0.4), plain = r.chance(0.5), tall = upright ? Math.min(3.6 * ([...txt].length + 0.5), h - 9) : r.range(3.2, 4.6);
        const b = sign(txt, tall, { vertical: upright, color: plain ? r.pick(css) : '#ffffff', bg: plain ? '#0b0b10' : r.pick(solid), glow: 1.9 }), bw = b.geometry.parameters.width;
        b.position.set(face - s * (0.6 + bw / 2 + (upright ? r.range(0, 3) : 0)), upright ? r.range(7 + tall / 2, Math.max(8 + tall / 2, h - 4 - tall / 2)) : r.range(9, 21), z + (k ? w * 0.3 : -w * 0.2)); b.rotation.y = Math.PI; boards.add(b);
      }
      pools.push([face - s * 3, 4, z], [face - s * 2, h * 0.45, z]);
      z += w / 2 + 0.5;
    }
    // a few big names along the island's rooftops, facing the harbour
    [['香港', -900, 560], ['維多利亞港', 760, 540], ['東方之珠', 1700, 560], ['中環', 130, 560]].forEach(([txt, x, z], i) => { const b = sign(txt, 15, { color: css[i], glow: 2 }); b.position.set(x, 150 + i * 14, z - 60); b.rotation.y = Math.PI; world.add(b, box(b.geometry.parameters.width + 6, 142 + i * 14, 30, icy, x, 0, z - 44, { cast: false })); });
    world.add(buildings(A, facadeMat({ floor: 3.3, bay: 2.9, frame: [0.22, 0.28], glass: 0x0f1218, lit: 0.44, litColor: 0xffd9a0, night: 1.45, rough: 0.9 }), { cast: false }));
    [[0xe2ecff, 0.42], [0xffd890, 0.5], [0x9fe8e0, 0.34]].forEach(([litColor, share], k) => world.add(buildings(B.filter((b, i) => i % 3 === k), facadeMat({ floor: 4, bay: 2.8, frame: [0.11, 0.18], glass: 0x0e1420, lit: share, litColor, night: 1.3, rough: 0.35, metal: 0.3 }), { cast: false })));
    world.add(boards);
    for (const a of [-1, 1]) for (const b of [-1, 1]) strips.push({ x: ICC[0] + a * 34, y: 0, z: ICC[1] + b * 34, sx: 1.2, sy: 440, sz: 1.2, color: 0xdfeaff }, { x: IFC[0] + a * 27, y: 70, z: IFC[1] + b * 27, sx: 1, sy: 300, sz: 1, color: 0xdfeaff });
    const lamps = [];
    for (const b of [...A, ...B]) { if (r.chance(0.6)) lamps.push([b.x + 26, (b.y ?? 0) + 8, b.z + r.range(-18, 18)]); if (b.h < 105 && r.chance(0.22)) panels.push({ x: b.x, y: (b.y ?? 0) + b.h, z: b.z, sx: r.range(4, 12), sy: r.range(2, 5), sz: 1, color: r.pick(neon) }); }
    lights(world, lamps, { color: [0xffc070, 0xffe0b0, 0xfff0e0], size: 6, power: 0.85 });
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    world.add(instances(unit, glowMat(0xffffff, 1.5, { toneMapped: false }), [...panels, ...crowns, ...strips], { cast: false, receive: false }));
    world.add(box(HW * 2, 0.1, 800, glowMat(0x2c2244), KX, 2.02, -960, { cast: false, receive: false }));
    world.onUpdate((t, dt, cam) => { boards.visible = Math.hypot(cam.position.x - KX, cam.position.z + 960) < 1100; });
    lights(world, pools, { color: neon, size: 44, power: 0.15, rand: rng(6) });
    const red = lights(world, roofTop, { color: 0xff2a1a, size: 6, power: 1.5 }); world.onUpdate((t) => { red.material.opacity = 0.55 + 0.45 * Math.sin(t * 2.4); });

    // ---- the Peak Tram: a lit track straight up the hill, a red car climbing it, and the Peak Tower at the top
    const track = Array.from({ length: 24 }, (_, i) => { const [x, z] = tramAt(i / 23); return [x, hillAt(x, z) + 1.5, z]; }), rail = new THREE.CatmullRomCurve3(track.map((p) => new THREE.Vector3(...p)));
    world.add(tube(track, 1.3, mat(0x8a8478, { emissive: 0xffc070, glow: 0.35 }), { seg: 90, radial: 5 }));
    lights(world, rail.getSpacedPoints(60).map((p) => [p.x, p.y + 3, p.z]), { color: 0xffc878, size: 5, power: 1 });
    fleet(world, new THREE.BoxGeometry(3.2, 3.6, 12).translate(0, 3.4, 0), mat(0xb8201c, { emissive: 0xff5030, glow: 0.8 }), 2, (i, t) => { const u = 0.5 - 0.5 * Math.cos(t * 0.09 + i * Math.PI), p = rail.getPointAt(u); return [p.x, p.y, p.z, -0.5]; });
    const py = hillAt(...PEAK) - 4, pt = new THREE.Group(), shell = mat(0xd8dce4, { emissive: 0xffe2b0, glow: 0.7 });
    pt.scale.setScalar(1.5); pt.add(box(30, 30, 22, facadeMat({ color: 0x8a8e9a, floor: 5, bay: 3, frame: [0.1, 0.2], glass: 0x141824, lit: 0.9, litColor: 0xffe2b0, night: 1.8 }), 0, 0, 0), mesh(new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(38, 12, 17), shell, 0, 42, 0), box(76, 1.2, 34, shell, 0, 42, 0));
    pt.add(box(40, 40, 30, mat(0x6a6e78), 0, -40, 0)); pt.position.set(PEAK[0], py - 10, PEAK[1]); world.add(bake(pt));
    const homes = []; while (homes.length < 900) { const x = r.range(-2400, 2400), z = r.range(950, 2100), y = hillAt(x, z); if (y > 30) homes.push([x, y + 2, z]); }
    lights(world, homes, { color: [0xffc070, 0xffe0b0, 0xfff0e0], size: 6, power: 0.8 });

    // ---- A Symphony of Lights: beams sweeping from the rooftops
    const beams = [[IFC[0], 412, IFC[1], 0x7dff9a], [BOC[0], 330, BOC[1], 0xffffff], [1150, 380, 640, 0xffe14a], [-640, 300, 700, 0x6aa8ff], [ICC[0], 470, ICC[1], 0xffffff], [-1300, 190, 600, 0x39e6ff], [1800, 190, 600, 0xff5ad1], [700, 200, 590, 0x7dff9a]].map(([x, y, z, c], i) => {
      const m = mesh(new THREE.CylinderGeometry(16, 1.2, 900, 8, 1, true).translate(0, 450, 0), glowMat(c, 1, { additive: true, opacity: 0.09, side: THREE.DoubleSide }), x, y, z, { cast: false, receive: false });
      world.add(m); return [m, i];
    });
    world.onUpdate((t) => { for (const [m, i] of beams) { m.rotation.z = 0.7 * Math.sin(t * 0.35 + i * 1.7); m.rotation.x = -0.35 + 0.3 * Math.sin(t * 0.23 + i); } });

    // ---- on the water: Star Ferries plying across, junks under red sails, the city's lights scattered over the swell
    const routes = [[[860, -470], [800, 440]], [[250, -480], [-330, 432]], [[1500, -470], [1700, 440]]];
    const ply = (i, t) => { const [a, b] = routes[i % 3], ph = t * 0.012 + i * 0.37, u = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2), back = Math.sin(ph * Math.PI * 2) < 0; return [lerp(a[0], b[0], u), 0, lerp(a[1], b[1], u), Math.atan2(b[0] - a[0], b[1] - a[1]) + (back ? Math.PI : 0)]; };
    fleet(world, mergeGeometries([new THREE.BoxGeometry(9, 3.6, 30).translate(0, 1, 0), new THREE.CylinderGeometry(4.5, 4.5, 3.6, 3).scale(1, 1, 1.5).translate(0, 1, 18.4), new THREE.CylinderGeometry(4.5, 4.5, 3.6, 3).scale(1, 1, 1.5).rotateY(Math.PI).translate(0, 1, -18.4)]), mat(0x1f7a4a, { emissive: 0x1a6a3a, glow: 0.45 }), 6, ply);
    fleet(world, mergeGeometries([new THREE.BoxGeometry(8.4, 2.6, 32).translate(0, 4.1, 0), new THREE.BoxGeometry(7.6, 2.4, 26).translate(0, 6.6, 0), new THREE.BoxGeometry(8.8, 0.4, 33).translate(0, 8, 0), new THREE.CylinderGeometry(1, 1.2, 4, 8).translate(0, 10, 0)]), mat(0xf4f0e0, { emissive: 0xffe8c0, glow: 0.85 }), 6, ply);
    const moored = [[330, 30, 25], [-760, -120, 50], [1250, 90, 60]], drift = (i, t) => { const [x, z, rad] = moored[i], a = t * 0.05 + i * 2; return [x + Math.cos(a) * rad, 0, z + Math.sin(a) * rad, -a]; }, big = (g) => g.scale(1.5, 1.5, 1.5);
    fleet(world, big(mergeGeometries([new THREE.BoxGeometry(7, 3.4, 24).translate(0, 1.2, 0), new THREE.BoxGeometry(7.4, 3.4, 7).translate(0, 4, -9.5), new THREE.BoxGeometry(5, 2, 5).translate(0, 3.4, 11), ...[-7, 1, 9].map((z, k) => new THREE.CylinderGeometry(0.25, 0.3, [15, 22, 13][k], 5).translate(0, [15, 22, 13][k] / 2 + 2, z))])), mat(0x4a3024, { emissive: 0x6a3a1a, glow: 0.4 }), 3, drift);
    const sails = []; [[-7, 14, 9], [1, 21, 12], [9, 12, 7]].forEach(([z, top, w]) => { const a = [0.4, 5, z + 1], b = [0.4, 5.5, z - w], c = [0.4, top, z - w * 0.72], d = [0.4, top + 2.5, z + 1.6]; sails.push(a, b, c, a, c, d); });
    fleet(world, big(facets(sails)), mat(0xd42a18, { emissive: 0xff2a0c, glow: 0.95, side: THREE.DoubleSide }), 3, drift);
    const streaks = []; for (let i = 0; i < 260; i++) { const s = i % 3 ? 1 : -1, l = r.range(60, 230); streaks.push({ x: r.range(-2400, 2400), y: 0.25, z: s > 0 ? 448 - l / 2 : -498 + l / 2, sx: r.range(5, 16), sy: 0.1, sz: l, color: r.pick(neon) }); }
    world.add(instances(new THREE.BoxGeometry(1, 1, 1), glowMat(0xffffff, 1, { additive: true, opacity: 0.16 }), streaks, { cast: false, receive: false }));
    const glint = []; for (let i = 0; i < 1500; i++) { const d = r() * r(), s = i % 2 ? 1 : -1; glint.push([r.range(-2600, 2600), 0.4, i % 3 === 0 ? r.range(-490, 440) : s > 0 ? 448 - d * 430 : -498 + d * 380]); }
    lights(world, glint, { color: [0xffd9a0, 0xfff0d8, 0xff9a60, 0x9ad0ff, 0xff6a8a, 0x7dff9a], size: 4.5, power: 0.6, rand: rng(9) });

    for (const [z, c, n] of [[-300, 0xffe0a0, 9], [-80, 0xfff6e0, 7], [180, 0xffb060, 9], [330, 0x9ad0ff, 6]]) traffic(world, [[-2400, 2.5, z], [-800, 2.5, z + 60], [800, 2.5, z - 50], [2400, 2.5, z]], { count: n, color: c, size: 9, speed: 6 });
    // ---- traffic: the neon street, the waterfront roads on both shores
    const road = (a, b, n, o = {}) => { traffic(world, [a, b], { count: n, color: 0xfff2d8, size: 3.6, speed: 14, spread: 2.5, ...o }); };
    road([KX - 7, 3.2, -1800], [KX - 7, 3.2, -580], 70); road([KX + 7, 3.2, -580], [KX + 7, 3.2, -1800], 70, { color: 0xff2a1a });
    road([-2400, 3.2, 466], [2400, 3.2, 466], 150, { spread: 3 }); road([2400, 3.2, 474], [-2400, 3.2, 474], 150, { color: 0xff2a1a, spread: 3 });
    road([-2400, 3.2, -565], [2400, 3.2, -565], 110); road([2400, 3.2, -558], [-2400, 3.2, -558], 110, { color: 0xff2a1a });
    fleet(world, new THREE.BoxGeometry(2.6, 4.4, 10.5).translate(0, 2.2, 0), facadeMat({ color: 0xd8301c, floor: 2.15, bay: 1.35, frame: [0.1, 0.24], glass: 0x1b2026, lit: 1, litColor: 0xfff0d0, night: 1.6 }), 12, (i, t) => { const dir = i % 2 ? 1 : -1, s = ((((i * 97.3 + dir * t * 9) % 900) + 900) % 900); return [KX + dir * 12, 2, -1480 + s, dir > 0 ? 0 : Math.PI]; });

    return { world, path, focus, duration: 50 };
  },
};
