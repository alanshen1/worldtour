// Paris at the blue hour: over the Arc de Triomphe and its star of avenues, down to the Trocadéro, across the Seine and under the sparkling Eiffel Tower,
// around it, then east along the river over the bridges to the Louvre's pyramid, towards Notre-Dame on its island.
import { THREE, mergeGeometries, createWorld, rng, lerp, mat, glowMat, facadeMat, box, cyl, mesh, lathe, prism, instances, buildings, cityGrid, water, trees, lights, traffic, clouds, clearance } from '../kit.js';

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
/** A stone bridge across the river (along Z, centred on z=0): half-length L, n arches, deck width w. */
function archBridge(L, n, w) {
  const s = new THREE.Shape(), span = (L * 2 - 8) / n;
  s.moveTo(-L, 1.2); s.quadraticCurveTo(0, 3.2, L, 1.2); s.lineTo(L, -8);
  for (let i = n - 1; i >= 0; i--) { const x0 = -L + 4 + i * span + 2.5, x1 = x0 + span - 5; s.lineTo(x1, -8); s.bezierCurveTo(x1, 0.6, x0, 0.6, x0, -8); }
  s.lineTo(-L, -8);
  return new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -w / 2).rotateY(Math.PI / 2);
}

export default {
  build() {
    const r = rng(1889);
    const world = createWorld({
      sky: { top: 0x0a1440, horizon: 0x4a5fa8, bottom: 0x1a2040, haze: 0.5 },
      sun: { dir: [-0.93, 0.035, 0.3], color: 0x8fa0e0, power: 0.7, disc: 0xff9a5a, size: 0.00002 },
      ambient: { sky: 0x4f68b8, ground: 0x2c2838, power: 1.0 },
      fog: { color: 0x2c3c72, density: 0.00024 }, stars: 350, exposure: 1.15, env: 0.9,
    });
    const path = [[-1000, 110, -990], [-935, 74, -590], [-900, 52, -380], [-900, 38, -170], [-900, 24, 150], [-900, 24, 340], [-740, 105, 640], [-580, 140, 520], [-520, 135, 300], [-500, 85, 60], [-330, 45, -5], [80, 34, 0], [330, 50, -190], [560, 60, -190], [740, 58, -34], [1000, 50, 0]];
    const focus = [[0.09, -900, 30, -680], [0.13, -900, 150, 260], [0.22, -900, 130, 260], [0.3, -900, 30, 600], [0.42, -900, 170, 260], [0.56, -900, 160, 260], [0.63, 250, 110, -1450], [0.7, 300, 20, 0], [0.79, 500, 12, -195]];
    const clear = clearance(path);
    const stoneM = mat(0xb9ab90, { rough: 0.85 }), groundM = mat(0x3a3d52, { rough: 0.9 }), lamps = [], floods = [];

    // ---- the Seine between its stone quays, widening around the Île de la Cité
    water(world, -7, { color: 0x14224a, rough: 0.1, strength: 0.28, ripple: 70 });
    const bank = (s) => [[-3400, s * 3200], [3800, s * 3200], [3800, s * 60], [1840, s * 60], [1780, s * 115], [880, s * 115], [820, s * 60], [-3400, s * 60]];
    world.add(prism(bank(-1), 8, groundM, 0, -8, 0, { cast: false }), prism(bank(1).reverse(), 8, groundM, 0, -8, 0, { cast: false }));
    world.add(prism([[900, 0], [965, -44], [1700, -44], [1760, 0], [1700, 44], [965, 44]], 8, stoneM, 0, -8, 0));
    for (const s of [-1, 1]) world.add(box(4220, 8.6, 1.6, stoneM, -1290, -8, s * 60.8), box(1960, 8.6, 1.6, stoneM, 2820, -8, s * 60.8), box(900, 8.6, 1.6, stoneM, 1330, -8, s * 115.8), box(5200, 0.4, 6, stoneM, -800, -6.4, s * 57, { cast: false }));

    // ---- the Eiffel Tower: four lattice legs curving into one, three platforms, arches, lit gold and sparkling
    const EX = -900, EZ = 260, iron = [], ends = [];
    const keyed = (keys) => (y) => { let i = 0; while (i < keys.length - 2 && y > keys[i + 1][0]) i++; const [y0, a] = keys[i], [y1, b] = keys[i + 1]; return a * Math.pow(b / a, (y - y0) / (y1 - y0)); };
    const W = keyed([[0, 62.5], [57, 35.5], [115, 20.5], [200, 11.5], [276, 7.2], [300, 5.6]]), LW = keyed([[0, 25], [57, 14.5], [115, 9.5]]);   // half-width of the tower, width of one leg
    const strut = (a, b, t) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
      iron.push({ x: EX + a[0], y: a[1], z: EZ + a[2], sx: t, sy: len, sz: t, rz: Math.asin(-dx / len), rx: Math.atan2(dz, dy) }); ends.push([a, b]);
    };
    const faces = [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = (y, [i, j]) => [sx * (W(y) - i * LW(y)), y, sz * (W(y) - j * LW(y))];
      for (let k = 0; k < 12; k++) {
        const y0 = k * 115 / 12, y1 = (k + 1) * 115 / 12, t = lerp(1.7, 1.0, k / 11);
        for (const [p, q] of faces) { strut(c(y0, p), c(y1, p), t); strut(c(y0, p), c(y1, q), t * 0.5); strut(c(y0, q), c(y1, p), t * 0.5); strut(c(y1, p), c(y1, q), t * 0.6); }
      }
    }
    for (let k = 0; k < 14; k++) {
      const y0 = 115 + k * 185 / 14, y1 = 115 + (k + 1) * 185 / 14, t = lerp(1.0, 0.6, k / 13);
      for (let f = 0; f < 4; f++) {
        const a = [[1, 1], [-1, 1], [-1, -1], [1, -1]][f], b = [[-1, 1], [-1, -1], [1, -1], [1, 1]][f], P = (y, q, m) => [(m ? (a[0] + b[0]) / 2 : q[0]) * W(y), y, (m ? (a[1] + b[1]) / 2 : q[1]) * W(y)];
        strut(P(y0, a), P(y1, a), t); strut(P(y1, a), P(y1, b), t * 0.6);
        strut(P(y0, a), P(y1, 0, 1), t * 0.5); strut(P(y0, 0, 1), P(y1, a), t * 0.5); strut(P(y0, 0, 1), P(y1, b), t * 0.5); strut(P(y0, b), P(y1, 0, 1), t * 0.5);
      }
    }
    // the four great arches under the first platform
    for (let f = 0; f < 4; f++) {
      const U = W(6) - LW(6), N = 16, A = (i, lift) => { const u = -U + 2 * U * i / N, y = 45 - 39 * (u / U) ** 2 + lift, q = W(y) - 1.5; return f < 2 ? [u, y, (f ? -1 : 1) * q] : [(f === 2 ? -1 : 1) * q, y, u]; };
      for (let i = 0; i < N; i++) { strut(A(i, 0), A(i + 1, 0), 1.3); strut(A(i, 4.5), A(i + 1, 4.5), 0.9); strut(A(i, 0), A(i + 1, 4.5), 0.5); strut(A(i + 1, 0), A(i, 4.5), 0.5); if (i > 2 && i < N - 1) { const p = A(i, 4.5); strut(p, [p[0] * (f < 2 ? 1 : W(53) / W(p[1])), 53, p[2] * (f < 2 ? W(53) / W(p[1]) : 1)], 0.45); } }
    }
    const ironM = mat(0xa97c3c, { rough: 0.6, metal: 0.3, emissive: 0xff9c2a, glow: 0.72 }), deck = pile(mat(0x8a6430, { rough: 0.7, emissive: 0xff8a20, glow: 0.55 }));
    for (const [y, h, w, hole] of [[52, 6.5, W(55) * 2 + 5, 46], [112, 5, W(114) * 2 + 4, 22], [273, 5, 19, 0]]) {
      if (!hole) deck.add(B(w, h, w), EX, y, EZ);
      else for (const s of [-1, 1]) deck.add(B(w, h, (w - hole) / 2), EX, y, EZ + s * (w + hole) / 4).add(B((w - hole) / 2, h, hole), EX + s * (w + hole) / 4, y, EZ);
      for (let i = 0; i < 4; i++) for (let k = -3; k <= 3; k++) floods.push([EX + (i < 2 ? k * w / 7 : (i - 2.5) * w * 1.02), y + h + 1.5, EZ + (i < 2 ? (i - 0.5) * w * 1.02 : k * w / 7)]);
    }
    deck.add(B(10, 7, 10), EX, 278, EZ).add(C(2.6, 5.2, 6, 8), EX, 285, EZ).add(C(0.25, 1.3, 40, 6), EX, 291, EZ);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { world.add(box(30, 4, 30, stoneM, EX + sx * 50, 0, EZ + sz * 50)); floods.push([EX + sx * 34, 3, EZ + sz * 34], [EX + sx * 66, 5, EZ + sz * 66]); }
    world.add(box(176, 0.5, 176, mat(0x6a6052, { rough: 0.9 }), EX, 0, EZ, { cast: false }));
    world.add(instances(B(1, 1, 1), ironM, iron, { cast: false }), deck.mesh());
    const twinkle = lights(world, Array.from({ length: 1400 }, () => { const [a, b] = r.pick(ends), u = r(); return [EX + lerp(a[0], b[0], u), lerp(a[1], b[1], u), EZ + lerp(a[2], b[2], u)]; }), { color: [0xffffff], size: 5.5, power: 3 });
    const tc = twinkle.geometry.attributes.color;
    world.onUpdate((t) => { const f = Math.floor(t * 9); for (let i = 0; i < tc.count; i++) { const h = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453, on = h - Math.floor(h) > 0.84 ? 3 : 0; tc.setXYZ(i, on, on, on * 0.92); } tc.needsUpdate = true; });
    const ray = mergeGeometries([new THREE.PlaneGeometry(760, 9).translate(380, 0, 0), new THREE.PlaneGeometry(760, 9).rotateX(Math.PI / 2).translate(380, 0, 0)]);
    const beacon = new THREE.Group(), rayM = glowMat(0xcfe0ff, 1, { additive: true, opacity: 0.08, side: THREE.DoubleSide });
    beacon.add(mesh(ray, rayM, 0, 0, 0, { cast: false, receive: false }), mesh(ray, rayM, 0, 0, 0, { cast: false, receive: false, ry: Math.PI })); beacon.position.set(EX, 300, EZ); world.add(beacon);
    world.onUpdate((t) => { beacon.rotation.y = t * 0.45; });
    lights(world, [[EX, 304, EZ]], { color: 0xffffff, size: 26, power: 2 });

    // ---- pale stone, flood-lit: the piles that the monuments are made of
    const paleM = mat(0xe4d6b8, { rough: 0.8, emissive: 0xb07a3a, glow: 0.42 }), pale = pile(paleM), zinc = pile(mat(0x56627a, { rough: 0.45, metal: 0.4 })), gold = pile(mat(0xe9b03a, { rough: 0.3, metal: 0.9, emissive: 0xc07a10, glow: 0.6 })), dark = pile(mat(0x14151c, { rough: 0.6 }));
    const whiteM = mat(0xf4f1ea, { rough: 0.8, emissive: 0x9a98a8, glow: 0.6 }), white = pile(whiteM), glowing = pile(glowMat(0xffc27a, 1.1));

    // ---- the Arc de Triomphe at the centre of the Étoile, turned to look down the Champs-Élysées
    const AX = -900, AZ = -680, arc = new THREE.Group(), as = new THREE.Shape(), ah = new THREE.Path(), sa = new THREE.Shape();
    as.moveTo(-22.5, 0); as.lineTo(22.5, 0); as.lineTo(22.5, 41); as.lineTo(-22.5, 41);
    ah.moveTo(-7.3, 0); ah.lineTo(-7.3, 21.5); ah.absarc(0, 21.5, 7.3, Math.PI, 0, true); ah.lineTo(7.3, 0); as.holes.push(ah);
    sa.moveTo(-4.2, 0); sa.lineTo(4.2, 0); sa.lineTo(4.2, 14.5); sa.absarc(0, 14.5, 4.2, 0, Math.PI, false); sa.lineTo(-4.2, 0);
    const shadeM = mat(0x4a3a2a, { rough: 0.9, emissive: 0xff9a40, glow: 0.1 }), ap = pile(paleM), ad = pile(shadeM);
    ap.add(B(47.5, 1.6, 24.5), 0, 41, 0).add(B(45, 7.5, 22), 0, 42.6, 0).add(B(46.5, 1, 23.5), 0, 50.1, 0).add(B(48, 1.2, 25), 0, 0, 0).add(B(46, 0.8, 23), 0, 29, 0);
    for (const sx of [-1, 1]) {
      ap.add(B(0.5, 41, 22), sx * 22.6, 0, 0); ad.add(new THREE.ShapeGeometry(sa, 10).rotateY(sx * Math.PI / 2), sx * 22.9, 1.2, 0);
      for (const sz of [-1, 1]) ap.add(B(9, 14, 2.6), sx * 15, 1.2, sz * 11.8).add(B(10.5, 5, 1.2), sx * 15, 31.5, sz * 11.3);
      for (let i = -3; i <= 3; i++) ad.add(B(3.4, 3.4, 0.4), i * 6, 44.6, sx * 11.1);
    }
    arc.add(mesh(new THREE.ExtrudeGeometry(as, { depth: 22, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, -11), [paleM, shadeM]), ap.mesh(), ad.mesh());
    arc.position.set(AX, 0, AZ); arc.rotation.y = Math.PI / 3; world.add(arc);
    world.add(cyl(118, 118, 0.3, mat(0x5c5a6c, { rough: 0.9 }), AX, 0, AZ, 48, { cast: false }));
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; lamps.push([AX + Math.cos(a) * 112, 7, AZ + Math.sin(a) * 112]); if (i % 3 === 0) floods.push([AX + Math.cos(a) * 32, 3, AZ + Math.sin(a) * 32]); }
    traffic(world, Array.from({ length: 16 }, (_, i) => [AX + Math.cos(i / 16 * TAU) * 84, 1.2, AZ + Math.sin(i / 16 * TAU) * 84]), { count: 46, color: [0xfff0d0, 0xff4030], size: 2.6, speed: 9, spread: 16, loop: true });

    // ---- Haussmann's city: cream stone blocks of even height under grey zinc mansards, twelve avenues radiating from the Étoile
    const blocks = [], near = (x, z, cx, cz, q) => Math.hypot(x - cx, z - cz) < q, rect = (x, z, x0, z0, x1, z1) => x > x0 && x < x1 && z > z0 && z < z1;
    const reserved = (x, z) => Math.abs(z) < 84 || rect(x, z, -1090, -250, -710, -60) || rect(x, z, -1020, 60, -780, 1080) || rect(x, z, -480, 60, -320, 720) || rect(x, z, -520, -320, -280, -84) || near(x, z, -147, -245, 105)
      || rect(x, z, -70, -340, 800, -70) || rect(x, z, -210, 84, -90, 170) || near(x, z, 250, -1450, 330) || rect(x, z, 860, -130, 1800, 130) || near(x, z, 0, 1250, 60);
    const tall = (x, z) => Math.min(r.range(20, 25), clear(x, z, 62) - 27);
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12, ca = Math.cos(a), sa = Math.sin(a), far = i === 3 ? 400 : 660;
      for (let d = 172; d < far; d += 50) {
        for (const s of [-1, 1]) { const x = AX + ca * d - sa * s * 28, z = AZ + sa * d + ca * s * 28, h = tall(x, z); if (h > 8 && !reserved(x, z)) blocks.push({ x, z, w: 47, d: 22, h, ry: -a }); }
        const gap = d * 0.52 - 84, b = a + TAU / 24, x = AX + Math.cos(b) * (d + 20), z = AZ + Math.sin(b) * (d + 20), h = tall(x, z);
        if (gap > 22 && h > 8 && !reserved(x, z)) blocks.push({ x, z, w: 47, d: gap, h, ry: -b });
        lamps.push([AX + ca * d - sa * 15, 7, AZ + sa * d + ca * 15], [AX + ca * d + sa * 15, 7, AZ + sa * d - ca * 15]);
      }
      if (!(i % 3)) traffic(world, [[AX + ca * 125, 1.2, AZ + sa * 125], [AX + ca * (far + 200), 1.2, AZ + sa * (far + 200)]], { count: i ? 26 : 50, color: [0xfff0d0, 0xff4030], size: 2.6, speed: 12, spread: 9 });
    }
    for (let x = -2400; x < 2800; x += 61) for (const s of [-1, 1]) { const z = s * (x > 800 && x < 1820 ? 153 : 98), h = tall(x, z); if (h > 8 && !reserved(x, z)) blocks.push({ x, z, w: 55, d: 28, h }); }
    blocks.push(...cityGrid({ rand: rng(3), area: [-2600, -2600, 3000, 2300], block: 58, street: 15, jitter: 0, split: 0.3,
      keep: (x, z) => { const ok = !reserved(x, z) && !near(x, z, AX, AZ, 700) && Math.abs(z) > (x > 800 && x < 1820 ? 186 : 131); if (ok && near(x, z, 0, 0, 1900)) lamps.push([x - 36.5, 7, z - 36.5], [x, 7, z - 36.5]); return ok; }, height: tall }));
    const hausM = facadeMat({ color: 0xd9ccb2, floor: 3.6, bay: 2.9, frame: [0.27, 0.2], glass: 0x1c2233, lit: 0.55, litColor: 0xffc27a, night: 1.5, rough: 0.85, ground: 1 });
    const roofM = facadeMat({ color: 0x5a667e, floor: 5.2, bay: 2.9, frame: [0.36, 0.3], glass: 0x1c2233, lit: 0.45, litColor: 0xffc27a, night: 1.4, rough: 0.45, metal: 0.4 });
    const mansard = new THREE.CylinderGeometry(0.585, 0.707, 1, 4).translate(0, 0.5, 0).rotateY(Math.PI / 4);
    const roofs = (list, sy = 5.2) => instances(mansard, roofM, list.map((b) => ({ x: b.x, y: (b.y ?? 0) + b.h, z: b.z, sx: b.w, sy, sz: b.d, ry: b.ry })), { cast: false });

    // ---- the Trocadéro: the two curved wings of the Palais de Chaillot, the long basin of fountains running down to the river
    const wings = [];
    for (const s of [-1, 1]) {
      wings.push({ x: -900 + s * 58, z: -205, w: 42, d: 56, h: 27 });
      for (let i = 1; i <= 7; i++) { const f = i * 0.2; wings.push({ x: -900 + s * (80 + 122 * Math.sin(f)), z: -212 + 122 * (1 - Math.cos(f)), w: 27, d: 20, h: 21, ry: -s * f }); }
    }
    world.add(buildings(wings, facadeMat({ color: 0xe0d2b4, floor: 10, bay: 3.2, frame: [0.3, 0.12], glass: 0x2a2a30, lit: 0.5, litColor: 0xffc27a, night: 1.3, ground: 2 })));
    world.add(box(70, 0.6, 62, mat(0x6a6660, { rough: 0.8 }), -900, 0, -205, { cast: false }), box(26, 0.5, 78, mat(0x3a5a88, { rough: 0.15, metal: 0.3, emissive: 0x4a7ac0, glow: 0.5 }), -900, 0, -112, { cast: false }));
    const jets = []; for (let i = 0; i < 12; i++) for (const s of [-1, 1]) { jets.push({ x: -900 + s * 8, y: 0.5, z: -148 + i * 6.4, sx: 0.7, sy: 5 + (i % 3) * 2.5, sz: 0.7, rx: 0.5, rz: -s * 0.25 }); floods.push([-900 + s * 8, 1.5, -148 + i * 6.4]); }
    world.add(instances(new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), glowMat(0xdcecff, 1.2, { opacity: 0.7 }), jets, { cast: false, receive: false }));

    // ---- the Champ de Mars, Les Invalides under its gilded dome, the Palais Bourbon, the Grand Palais, the Place de la Concorde
    const lawnM = mat(0x24402c, { rough: 0.95 }), leafy = [];
    for (const [x, z, w, d] of [[-900, 660, 150, 560], [-400, 300, 110, 400], [115, -200, 330, 200]]) world.add(box(w, 0.4, d, lawnM, x, 0, z, { cast: false }));
    for (let z = 370; z < 940; z += 13) for (const x of [-1004, -988, -812, -796]) leafy.push([x, 0, z]);
    for (let z = 100; z < 500; z += 14) for (const x of [-468, -332]) leafy.push([x, 0, z]);
    world.add(buildings([{ x: -900, z: 985, w: 190, d: 40, h: 24 }, { x: -400, z: 610, w: 200, d: 150, h: 22 }, { x: -150, z: 128, w: 100, d: 60, h: 20 }, { x: -400, z: -200, w: 190, d: 70, h: 20 }, { x: 0, z: 1250, w: 52, d: 34, h: 205, color: 0x4a4038 }], hausM));
    pale.add(C(14, 14, 26, 20), -400, 22, 610).add(C(15.5, 15.5, 2, 20), -400, 46, 610).add(C(11, 11, 12, 20), -400, 48, 610); gold.add(new THREE.SphereGeometry(14, 24, 12, 0, TAU, 0, Math.PI / 2).scale(1, 1.25, 1), -400, 58, 610).add(C(3, 3.6, 9, 12), -400, 75, 610).add(C(0.2, 2.6, 18, 8), -400, 84, 610);
    pale.add(C(8, 8, 14, 16), -900, 24, 985); zinc.add(new THREE.SphereGeometry(9, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 1.3, 1), -900, 38, 985);
    for (let i = 0; i < 12; i++) pale.add(C(1.3, 1.3, 16, 10), -150 - 33 + i * 6, 2, 96); pale.add(B(74, 2, 6), -150, 18, 96).add(new THREE.CylinderGeometry(37, 37, 4, 3, 1, false).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.22, 1).translate(0, 22, 0), -150, 0, 96).add(B(80, 2, 10), -150, 0, 96);
    const glassM = mat(0x9fc0c8, { rough: 0.2, metal: 0.3, emissive: 0xbfe0d8, glow: 0.22 });
    for (let x = -480; x <= -320; x += 13.3) zinc.add(new THREE.TorusGeometry(24.3, 0.5, 4, 14, Math.PI).rotateY(Math.PI / 2), x, 20, -200);
    world.add(mesh(new THREE.CylinderGeometry(24, 24, 170, 20, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), glassM, -400, 20, -200), mesh(new THREE.SphereGeometry(22, 20, 10, 0, TAU, 0, Math.PI / 2), glassM, -400, 30, -200));
    const OX = -147, OZ = -245;
    world.add(cyl(100, 100, 0.3, mat(0x4a4a58, { rough: 0.9 }), OX, 0, OZ, 40, { cast: false })); pale.add(B(5, 5, 5), OX, 0, OZ).add(C(1, 1.9, 21, 4), OX, 5, OZ); gold.add(C(0.05, 1, 2.4, 4), OX, 26, OZ);
    for (const s of [-1, 1]) { pale.add(C(7, 7.6, 1.2, 20), OX + s * 45, 0, OZ).add(C(1, 2.4, 5, 10), OX + s * 45, 1, OZ).add(C(3.6, 0.8, 1, 12), OX + s * 45, 6, OZ); floods.push([OX + s * 45, 5, OZ]); }
    for (let i = 0; i < 28; i++) lamps.push([OX + Math.cos(i / 28 * TAU) * 92, 7, OZ + Math.sin(i / 28 * TAU) * 92]);

    // ---- the Louvre: long wings around the Cour Napoléon and its glass pyramid, the Cour Carrée, the Tuileries in front
    const louvre = [{ x: 485, z: -300, w: 310, d: 26, h: 25 }, { x: 485, z: -92, w: 310, d: 26, h: 25 }, { x: 715, z: -272, w: 150, d: 24, h: 25 }, { x: 715, z: -120, w: 150, d: 24, h: 25 }, { x: 652, z: -196, w: 24, d: 128, h: 25 }, { x: 778, z: -196, w: 24, d: 128, h: 25 }];
    const pav = [[338, -300], [338, -92], [485, -300], [485, -92], [640, -300], [640, -92], [652, -196], [778, -196], [790, -272], [790, -120]].map(([x, z]) => ({ x, z, w: 30, d: 32, h: 30 }));
    const louvreM = facadeMat({ color: 0xdccba6, floor: 8, bay: 4, frame: [0.3, 0.16], glass: 0x2a2620, lit: 0.6, litColor: 0xffc27a, night: 1.3, rough: 0.85, ground: 1 });
    world.add(buildings([...louvre, ...pav], louvreM), roofs(louvre, 6), roofs(pav, 10), box(300, 0.4, 180, mat(0x7c766c, { rough: 0.7 }), 490, 0, -196, { cast: false }));
    const pc = document.createElement('canvas'), px = pc.getContext('2d'); pc.width = 256; pc.height = 128;
    const pg = px.createLinearGradient(0, 0, 0, 128); pg.addColorStop(0, '#fff0c8'); pg.addColorStop(1, '#f2a84c'); px.fillStyle = pg; px.fillRect(0, 0, 256, 128); px.strokeStyle = '#4a3c30'; px.lineWidth = 1.3;
    for (let i = -8; i < 40; i++) { px.beginPath(); px.moveTo(i * 8, 128); px.lineTo(i * 8 + 64, 0); px.moveTo(i * 8, 0); px.lineTo(i * 8 + 64, 128); px.stroke(); }
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
    const pyrM = glowMat(0xffffff, 1, { map: pt });
    world.add(cyl(0.05, 24.7, 21.6, pyrM, 500, 0.4, -195, 4, { cast: false }));
    for (const [dx, dz] of [[-34, 0], [0, -34], [0, 34]]) world.add(cyl(0.05, 5.6, 4.9, pyrM, 500 + dx, 0.4, -195 + dz, 4, { cast: false }));
    for (const [dx, dz] of [[-24, -24], [-24, 24], [24, -24], [24, 24]]) world.add(box(20, 0.5, 20, mat(0x16223a, { rough: 0.1, metal: 0.5 }), 500 + dx, 0.3, -195 + dz, { ry: Math.PI / 4, cast: false }));
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; floods.push([500 + Math.cos(a) * 60, 1.5, -195 + Math.sin(a) * 48]); }
    for (let x = -50; x < 290; x += 17) for (const z of [-290, -265, -135, -110]) leafy.push([x, 0, z]);
    world.add(cyl(22, 22, 0.5, mat(0x1c2c50, { rough: 0.1, metal: 0.4 }), 60, 0.2, -200, 24, { cast: false }));

    // ---- Notre-Dame on the Île de la Cité: twin towers, rose window, the long nave with its flying buttresses and spire
    const NX = 1125;
    for (const s of [-1, 1]) {
      pale.add(B(13, 69, 13), NX + 6.5, 0, s * 13.5).add(B(13.8, 1, 13.8), NX + 6.5, 44, s * 13.5).add(B(14, 1.4, 14), NX + 6.5, 68, s * 13.5);
      dark.add(B(0.6, 14, 2.6), NX - 0.1, 48, s * 13.5 - 2.6).add(B(0.6, 14, 2.6), NX - 0.1, 48, s * 13.5 + 2.6).add(new THREE.CircleGeometry(3.4, 12, 0, Math.PI).rotateY(-Math.PI / 2).scale(1, 1.6, 1), NX - 0.15, 4, s * 13.5).add(B(0.6, 4, 6.8), NX - 0.1, 0, s * 13.5);
      for (const a of [-1, 1]) for (const b of [-1, 1]) pale.add(B(1.8, 69, 1.8), NX + 6.5 + a * 6.4, 0, s * 13.5 + b * 6.4);
      pale.add(B(100, 15, 9), NX + 66, 0, s * 13).add(B(112, 1, 1.6), NX + 60, 15, s * 17.6);
      for (let x = NX + 22; x < NX + 118; x += 8) { pale.add(B(1.2, 22, 2), x, 0, s * 18.6).add(new THREE.BoxGeometry(0.9, 0.9, 15).rotateX(s * 0.72).translate(0, 23, s * 12.6), x, 0, 0); zinc.add(C(0.1, 0.9, 4, 4), x, 22, s * 18.6); }
    }
    pale.add(B(13, 45, 14), NX + 6.5, 0, 0).add(B(1, 3, 40), NX + 0.2, 19, 0).add(B(1, 2.5, 40), NX + 0.2, 41, 0).add(B(110, 33, 14), NX + 68, 0, 0).add(B(14, 33, 50), NX + 66, 0, 0).add(C(7, 7, 33, 16), NX + 123, 0, 0).add(C(17.5, 17.5, 15, 16), NX + 123, 0, 0);
    glowing.add(new THREE.RingGeometry(1.3, 4.8, 24).rotateY(-Math.PI / 2), NX - 0.2, 32, 0).add(new THREE.CircleGeometry(4.5, 20), NX + 66, 25, 25.2).add(new THREE.CircleGeometry(4.5, 20).rotateY(Math.PI), NX + 66, 25, -25.2);
    for (let z = -18; z <= 18; z += 2.4) dark.add(B(0.5, 3.6, 1.1), NX - 0.4, 41.2, z).add(B(0.5, 2.2, 1.1), NX - 0.4, 19.4, z);
    dark.add(new THREE.CircleGeometry(4, 12, 0, Math.PI).rotateY(-Math.PI / 2).scale(1, 1.7, 1), NX - 0.15, 4, 0).add(B(0.6, 4, 8), NX - 0.1, 0, 0);
    const gableRoof = (len, w, h) => { const s = new THREE.Shape([[-w / 2, 0], [w / 2, 0], [0, h]].map(([a, b]) => new THREE.Vector2(a, b))); return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); };
    zinc.add(gableRoof(110, 15, 11).rotateY(Math.PI / 2), NX + 68, 33, 0).add(gableRoof(50, 15, 11), NX + 66, 33, 0).add(C(0.1, 7.6, 11, 16), NX + 123, 33, 0).add(C(1.6, 2.4, 14, 8), NX + 66, 42, 0).add(C(0.1, 1.9, 40, 8), NX + 66, 56, 0);
    for (let x = NX + 4; x < NX + 126; x += 9) floods.push([x, 2, 26], [x, 2, -26]); for (const z of [-20, -7, 7, 20]) floods.push([NX - 8, 2, z]);
    const isle = cityGrid({ rand: rng(8), area: [985, -36, 1075, 40], block: 34, street: 9, jitter: 0, split: 0, fill: 1, height: (x, z) => Math.min(r.range(19, 23), clear(x, z, 60) - 30) });
    isle.push(...cityGrid({ rand: rng(9), area: [1290, -36, 1700, 40], block: 34, street: 9, jitter: 0, split: 0, fill: 1, height: () => r.range(19, 23) }));
    blocks.push(...isle);
    world.add(buildings(blocks, hausM, { cast: false }), roofs(blocks));
    for (const [x, z] of [[1000, -36], [1030, -38], [1060, -38]]) { pale.add(C(6, 6, 22, 12), x, 0, z); zinc.add(C(0.2, 6.6, 12, 12), x, 22, z); }
    

    // ---- Sacré-Cœur, white on the hill of Montmartre
    const MX = 250, MZ = -1450;
    world.add(lathe([[430, -2], [330, 26], [210, 62], [95, 86], [0, 90]], mat(0x1e2a30, { rough: 0.95 }), MX, 0, MZ, 28, { cast: false }));
    white.add(B(48, 30, 84), MX, 86, MZ).add(B(36, 16, 14), MX, 86, MZ + 47).add(C(11.5, 11.5, 22, 20), MX, 116, MZ + 8).add(lathe([[11.5, 0], [11.8, 6], [10.8, 15], [8, 24], [4.2, 30], [2.4, 32], [2.4, 38], [0, 45]], whiteM, 0, 0, 0, 20).geometry, MX, 138, MZ + 8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) white.add(C(5, 5, 9, 12), MX + sx * 17, 116, MZ + 8 + sz * 19).add(lathe([[5, 0], [5.2, 3], [4.2, 9], [2, 14], [0, 18]], whiteM, 0, 0, 0, 12).geometry, MX + sx * 17, 125, MZ + 8 + sz * 19);
    white.add(B(12, 88, 12), MX, 86, MZ - 50).add(C(0.2, 8.4, 16, 4), MX, 174, MZ - 50);
    dark.add(B(7, 11, 0.6), MX - 11, 87, MZ + 54.1).add(B(7, 11, 0.6), MX, 87, MZ + 54.1).add(B(7, 11, 0.6), MX + 11, 87, MZ + 54.1);
    for (let i = 0; i < 40; i++) lamps.push([MX + r.range(-12, 12), 20 + i * 1.6, MZ + 330 - i * 6.6]);
    const hillTown = []; for (let i = 0; i < 150; i++) { const a = r() * TAU, d = r.range(130, 330), h = lerp(86, 22, (d - 95) / 235); hillTown.push({ x: MX + Math.cos(a) * d, z: MZ + Math.sin(a) * d, y: h - 8, w: r.range(20, 34), d: r.range(16, 24), h: r.range(22, 28), ry: -a }); }
    world.add(buildings(hillTown, hausM), roofs(hillTown));

    // ---- bridges: stone arches, and the Pont Alexandre III with its gilded statues and candelabras
    const bridges = pile(mat(0xbcae92, { rough: 0.85, emissive: 0x8a6230, glow: 0.3 }));
    for (const [x, n, w] of [[-900, 5, 26], [-650, 3, 22], [-150, 5, 24], [200, 3, 18], [600, 7, 11]]) { bridges.add(archBridge(64, n, w), x, 0, 0); for (let z = -56; z <= 56; z += 16) lamps.push([x - w / 2, 8, z], [x + w / 2, 8, z]); }
    bridges.add(archBridge(119, 9, 22), 930, 0, 0); for (let z = -110; z <= 110; z += 14) lamps.push([919, 8, z], [941, 8, z]);
    const ax = new THREE.Shape(); ax.moveTo(-64, 1.4); ax.quadraticCurveTo(0, 4, 64, 1.4); ax.lineTo(64, -8); ax.lineTo(54, -8); ax.quadraticCurveTo(0, 2.4, -54, -8); ax.lineTo(-64, -8);
    world.add(mesh(new THREE.ExtrudeGeometry(ax, { depth: 34, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -17).rotateY(Math.PI / 2), mat(0x66707e, { rough: 0.5, metal: 0.4 }), -400, 0, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pale.add(B(5, 17, 5), -400 + sx * 19, 0, sz * 66); gold.add(B(2.4, 3.4, 4.4), -400 + sx * 19, 17, sz * 66).add(new THREE.ConeGeometry(2.6, 4.5, 5).rotateZ(sx * 0.6), -400 + sx * 19, 21.6, sz * 66); floods.push([-400 + sx * 19, 14, sz * 62]); }
    const candelabra = []; for (let z = -58; z <= 58; z += 5.8) for (const s of [-1, 1]) candelabra.push([-400 + s * 16.6, 7.2 - (z / 64) ** 2 * 2.4, z]);
    lights(world, candelabra, { color: 0xffe2a8, size: 3.4, power: 1.5 });

    // ---- bateaux-mouches gliding under the bridges, their glass decks lit
    const hullM = mat(0xe8e6e0, { rough: 0.5 }), cabinM = glowMat(0xffd08a, 1.1), boats = [0, 1, 2, 3, 4].map(() => {
      const g = new THREE.Group(); g.add(box(52, 2.2, 9.5, hullM, 0, -7.4, 0), box(42, 2.3, 8, cabinM, -1, -5.2, 0, { cast: false }), box(44, 0.3, 8.6, hullM, -1, -2.9, 0), box(7, 1.2, 7, hullM, 21, -5.2, 0));
      world.add(g); return g;
    });
    const boatGlow = lights(world, new Float32Array(15), { color: 0xffc070, size: 30, power: 0.5 });
    world.onUpdate((t) => boats.forEach((g, i) => {
      const dir = i % 2 ? -1 : 1, x = -1500 + ((((i * 640 + t * 8 * dir) % 3200) + 3200) % 3200), z = dir * (x > 840 && x < 1800 ? 82 : 24);
      g.position.set(x, 0, z); g.rotation.y = dir > 0 ? 0 : Math.PI; boatGlow.geometry.attributes.position.setXYZ(i, x, -3, z); boatGlow.geometry.attributes.position.needsUpdate = true;
    }));

    // ---- trees, lamps, floodlights and the evening traffic
    for (let x = -2400; x < 2800; x += 21) if (!(x > 850 && x < 1790)) leafy.push([x, 0, -68 - (x % 2) * 4], [x + 10, 0, 68]);
    for (let d = 190; d < 720; d += 15) for (const s of [-1, 1]) leafy.push([AX + Math.cos(TAU / 12) * d - Math.sin(TAU / 12) * s * 12, 0, AZ + Math.sin(TAU / 12) * d + Math.cos(TAU / 12) * s * 12]);
    trees(world, leafy, 'round', { size: 9, color: [0x23402c, 0x2a4a30, 0x1e3828, 0x314f2e] }).children.forEach((m) => { m.castShadow = false; });
    for (let x = -2400; x < 2800; x += 28) lamps.push([x, 7, -74], [x, 7, 74]);
    for (let z = 350; z < 940; z += 24) lamps.push([-975, 6, z], [-825, 6, z], [-900, 6, z]);
    lights(world, lamps, { color: 0xffb964, size: 4.2, power: 1.25 }); lights(world, lamps, { color: 0xff9440, size: 30, power: 0.16 });
    lights(world, floods, { color: 0xffd9a0, size: 15, power: 0.55 });
    for (const s of [-1, 1]) traffic(world, [[-2500, 1.2, s * 79], [2900, 1.2, s * 79]], { count: 90, color: s > 0 ? 0xfff0d0 : 0xff4030, size: 2.6, speed: 12 * s, spread: 2 });
    world.add(pale.mesh(), white.mesh(), zinc.mesh(), gold.mesh(), dark.mesh(), glowing.mesh({ cast: false }), bridges.mesh());
    clouds(world, { count: 12, y: [1100, 1700], size: 220, color: 0x5a5f9a, self: 0.5, rand: rng(2) });

    return { world, path, focus, duration: 50 };
  },
};
