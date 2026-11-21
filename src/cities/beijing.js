// Beijing in the golden early morning: round the Temple of Heaven, over the grey hutong roofs to Tiananmen,
// then north along the central axis through the Meridian Gate and across the Forbidden City to Jingshan, the Great Wall on the far hills.
import { THREE, mergeGeometries, createWorld, rng, fbm, clamp, mat, facadeMat, mesh, box, cyl, sphere, dome, lathe, beam, hipRoof, instances, buildings, cityGrid, terrain, water, trees, clouds, clearance } from '../kit.js';

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
/** A unit sweeping hip roof (1 x 1 x 1, ridge along x) light enough to instance by the hundred. */
function hipGeo(ridge = 0.5, curve = 1.6, lift = 0.25, N = 8) {
  const g = new THREE.PlaneGeometry(1, 1, N, N).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i) * 2, v = p.getZ(i) * 2, m = Math.max(Math.abs(v), (Math.abs(u) - ridge) / (1 - ridge)); p.setY(i, Math.pow(1 - clamp(m), curve) + lift * Math.pow(Math.abs(u * v), 2.5)); }
  g.computeVertexNormals(); return g;
}
/** A unit courtyard house (1 long in x, 1 high, 1 deep): pale brick walls under a darker pitched roof, shaded by vertex colour. */
function houseGeo() {
  const paint = (g, v) => { g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(v), 3)); return g; };
  const walls = new THREE.BoxGeometry(1, 0.58, 1).translate(0, 0.29, 0).toNonIndexed(); walls.deleteAttribute('uv');
  const a = [-0.54, 0.55, 0.56], b = [0.54, 0.55, 0.56], c = [-0.54, 1, 0], d = [0.54, 1, 0], e = [-0.54, 0.55, -0.56], f = [0.54, 0.55, -0.56], roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute([a, b, d, a, d, c, f, e, c, f, c, d, e, a, c, b, f, d].flat(), 3)); roof.computeVertexNormals();
  return mergeGeometries([paint(walls, 0.95), paint(roof, 0.5)]);
}

export default {
  build() {
    const r = rng(1420);
    const world = createWorld({
      sky: { top: 0x5c96d8, horizon: 0xffd08c, bottom: 0xb89878, haze: 0.4 },
      sun: { dir: [0.84, 0.3, 0.28], color: 0xffc27a, power: 3.7, disc: 0xffe2b0, size: 0.0014 },
      ambient: { sky: 0xaec2e2, ground: 0x7a6248, power: 0.8 },
      fog: { color: 0xecc99c, density: 0.00038 }, exposure: 1.05, env: 0.8,
    });
    const path = [[330, 70, 1990], [600, 42, 1720], [790, 34, 1560], [760, 38, 1380], [400, 40, 1130], [150, 55, 910], [132, 42, 640], [0, 44, 370],
      [0, 64, 170], [0, 62, -270], [0, 52, -450], [20, 30, -540], [78, 34, -660], [40, 50, -850], [0, 70, -1100], [0, 88, -1340]];
    const T = [700, 1500];   // the Hall of Prayer for Good Harvests
    const focus = [[0.08, T[0], 22, T[1]], [0.22, T[0], 24, T[1]], [0.32, 0, 30, 900], [0.4, 0, 25, 560], [0.46, 0, 24, 200], [0.54, 0, 26, 200], [0.59, 0, 30, -265], [0.66, 0, 30, -265], [0.71, 0, 26, -655], [0.8, 0, 26, -655]];
    const clear = clearance(path);

    // ---- materials: palace red, imperial yellow tiles, white marble, the blue-green of painted eaves
    const red = mat(0xa2342a), tile = mat(0xe3a22c, { rough: 0.45, metal: 0.1 }), marble = mat(0xefe9dc), band = mat(0x2c6f68, { rough: 0.6 }), dark = mat(0x2a1512), gold = mat(0xf0c040, { metal: 0.85, rough: 0.3 });
    const blue = mat(0x23439c, { rough: 0.4, metal: 0.15, side: THREE.DoubleSide }), grey = mat(0x8a8884), greyTile = mat(0x5f6a62, { rough: 0.7 }), stone = mat(0xd9cfba);
    const columns = facadeMat({ color: 0xa8322a, floor: 30, bay: 4.6, frame: [0.17, 0.03], glass: 0x5e1e16, lit: 0, rough: 0.8 });
    const fc = new THREE.Group();   // everything static along the axis is collected here and merged per material

    /** A palace hall on its base y: red colonnaded body, painted band, sweeping roof; `double` adds the second eave of the grandest halls. */
    const hall = (g, x, y, z, w, d, o = {}) => {
      const hb = o.hb ?? 6.5, h2 = o.h2 ?? w * 0.17, tl = o.tile ?? tile, ov = o.over ?? 4.5;
      g.add(box(w, hb, d, columns, x, y, z), box(w + 0.8, 1.3, d + 0.8, band, x, y + hb - 1.3, z));
      let W = w, D = d, top = y + hb;
      if (o.double) {
        const h1 = o.h1 ?? h2 * 0.7, hu = o.hu ?? h1 * 0.8;
        g.add(hipRoof(w + ov * 2 + 2, d + ov * 2 + 2, h1, tl, x, top, z, { ridge: 0.72, curve: 1.2, lift: h1 * 0.22 }));
        W = w * 0.86; D = d * 0.74; g.add(box(W, hu, D, red, x, top, z), box(W + 0.8, 1.3, D + 0.8, band, x, top + hu - 1.3, z)); top += hu;
      }
      g.add(hipRoof(W + ov * 2 + 2, D + ov * 2 + 2, h2, tl, x, top, z, { ridge: o.ridge ?? 0.58, curve: 1.7, lift: h2 * 0.24 }), box((W + ov * 2) * (o.ridge ?? 0.58), 1, 1.2, tl, x, top + h2 - 0.4, z));
      for (const s of [-1, 1]) g.add(box(1.2, 2.2, 1.4, gold, x + s * (W + ov * 2) * (o.ridge ?? 0.58) / 2, top + h2 - 0.4, z));
    };
    /** A square pavilion with one to three pyramid roofs and a gold finial. */
    const pavilion = (g, x, y, z, s, tiers = 2, tl = tile) => {
      for (let t = 0; t < tiers; t++) {
        const last = t === tiers - 1, hb = t ? s * 0.2 + 1.6 : s * 0.34, hr = last ? s * 0.5 : s * 0.3, sink = t ? s * 0.12 : 0;
        g.add(box(s, hb + sink, s, t ? red : columns, x, y - sink, z), box(s + 0.6, 1, s + 0.6, band, x, y + hb - 1, z), hipRoof(s + 6, s + 6, hr, tl, x, y + hb, z, { ridge: 0.02, curve: last ? 1.5 : 1.15, lift: hr * 0.26 }));
        y += hb + (last ? hr : hr * 0.26); s *= 0.7;
      }
      g.add(sphere(s * 0.14 + 0.5, gold, x, y + 0.3, z));
    };
    /** A city gate: a tall masonry platform pierced by arches, with a double-eaved hall on top. */
    const gate = (g, x, z, w, d, hp, o = {}) => {
      g.add(box(w, hp, d, o.base ?? red, x, 0, z), box(w + 2, 1.6, d + 2, marble, x, 0, z));
      const n = o.arches ?? 5; for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; g.add(box(k ? 5.5 : 7, k ? 7.5 : 9, d + 0.8, dark, x + k * w / (n + 2.4), 0, z)); }
      hall(g, x, hp, z, w * 0.52, d * 0.6, { double: true, hb: 6, h1: 5, hu: 4.5, h2: 8, ...o.hall });
    };

    // ---- the ground: paving with the palace moat cut out of it, the hills that ring the city to the north and west
    const gs = new THREE.Shape([[-4600, -4600], [4600, -4600], [4600, 4600], [-4600, 4600]].map(([a, b]) => new THREE.Vector2(a, b)));
    gs.holes.push(new THREE.Path([[-440, 186], [440, 186], [440, 1274], [-440, 1274]].map(([a, b]) => new THREE.Vector2(a, b))));
    world.add(mesh(new THREE.ExtrudeGeometry(gs, { depth: 3, bevelEnabled: false }).rotateX(-Math.PI / 2), mat(0x8f887a), 0, -3, 0, { cast: false }));
    const court = mat(0xb7ad98), lawn = mat(0x5f7a44);
    world.add(bake(box(776, 3, 984, court, 0, -2.95, -730, { cast: false }), box(320, 3, 70, court, 0, -2.95, -212, { cast: false }), box(70, 3, 70, court, 0, -2.95, -1244, { cast: false }), box(70, 3, 30, court, 410, -2.95, -420, { cast: false }), box(70, 3, 30, court, -410, -2.95, -420, { cast: false }),
      box(520, 0.25, 570, court, 0, 0, 592, { cast: false }), box(206, 0.25, 400, court, 0, 0, 20, { cast: false }), box(826, 0.2, 936, lawn, 702, 0, 1706, { cast: false }), box(340, 0.2, 388, lawn, 276, 0, 44, { cast: false }), box(340, 0.2, 388, lawn, -276, 0, 44, { cast: false }), box(6400, 0.2, 62, mat(0x4a4b4e), 0, 0, 275, { cast: false })));
    water(world, -1.3, { size: [900, 1110], x: 0, z: -730, color: 0x4f6f78, rough: 0.12, ripple: 50, strength: 0.25 });
    const ridgeN = (x) => -2950 + 190 * Math.sin(x / 520), ridgeW = (z) => -3050 + 190 * Math.sin(z / 520), crest = (s) => 250 + 110 * Math.sin(s / 330 + 1) + 70 * Math.sin(s / 140);
    const hillAt = (x, z) => (0.62 + 0.8 * fbm(x / 420 + 9, z / 420, 3)) * Math.max(crest(x) * Math.exp(-(((z - ridgeN(x)) / 400) ** 2)), crest(z + 900) * Math.exp(-(((x - ridgeW(z)) / 400) ** 2)), 620 * Math.max(clamp((-z - 3300) / 900), clamp((-x - 3400) / 900)) * (0.6 + 0.5 * Math.sin(x / 410 + z / 370) ** 2)) - 6;
    world.add(terrain({ size: 9200, seg: 116, height: hillAt, color: (x, y, z, slope) => (slope > 0.12 ? 0x6a6a58 : y > 150 ? 0x5d6c50 : 0x566a48) }));
    const gw = [], sand = mat(0xd6bf96), wallPts = [];
    for (let x = 3900; x >= -2700; x -= 70) wallPts.push([x, ridgeN(x)]);
    for (let z = -2700; z <= 3300; z += 70) wallPts.push([ridgeW(z), z]);
    wallPts.forEach(([x, z], i) => {
      const y = hillAt(x, z) + 8; if (i % 4 === 0) gw.push(box(30, 46, 30, sand, x, y - 16, z));
      if (i) { const [px, pz] = wallPts[i - 1]; gw.push(beam([px, hillAt(px, pz) + 8, pz], [x, y, z], 20, sand)); }
    });
    world.add(bake(gw));

    // ---- the Temple of Heaven: the round Hall of Prayer on its triple terrace, the Imperial Vault to the south
    const th = new THREE.Group(), drum = facadeMat({ color: 0xa8322a, floor: 30, bay: 3.456, frame: [0.17, 0.03], glass: 0x5e1e16, lit: 0, round: 13.2 });
    const cone = (y, R, rTop, h) => { th.add(lathe(Array.from({ length: 8 }, (_, k) => [R + (rTop - R) * k / 7, y + h * Math.pow(k / 7, 1.6)]), blue, 0, 0, 0, 48), cyl(R - 1.6, R - 1.6, 1.5, band, 0, y - 0.9, 0, 40), cyl(R + 0.15, R + 0.15, 0.5, gold, 0, y - 0.25, 0, 48, { open: true })); };
    th.add(lathe([[46, 0], [46, 2], [40.5, 2], [40.5, 4], [35, 4], [35, 6], [0, 6]], marble, 0, 0, 0, 56));
    for (let k = 0; k < 4; k++) for (let i = 0; i < 3; i++) th.add(box(11, 2 * (3 - i), 6, marble, Math.sin(k * Math.PI / 2) * (37.5 + i * 5.5), 0, Math.cos(k * Math.PI / 2) * (37.5 + i * 5.5), { ry: k * Math.PI / 2 }));
    th.add(cyl(12.3, 12.3, 16.5, red, 0, 6, 0, 40), cyl(9.4, 9.4, 23.5, red, 0, 6, 0, 32));
    cone(14.2, 18, 12.4, 4.2); cone(21.4, 15, 9.5, 4); cone(28.2, 12.2, 0.3, 8.8);
    th.add(cyl(0.9, 1.4, 1.6, gold, 0, 36.6, 0, 12), sphere(1.5, gold, 0, 39, 0), cyl(0.2, 0.5, 2.2, gold, 0, 40, 0, 8));
    for (const [w, d, x, z] of [[204, 2.4, 0, 101], [204, 2.4, 0, -101], [2.4, 204, 101, 0], [2.4, 204, -101, 0]]) th.add(box(w, 4.5, d, red, x, 0, z), box(w + 1, 0.9, d + 1, blue, x, 4.5, z));
    hall(th, 0, 0, 101, 40, 12, { tile: blue, hb: 7 }); hall(th, 0, 2, -128, 44, 16, { tile: blue, hb: 7 }); th.add(box(60, 2, 30, marble, 0, 0, -128), box(240, 0.25, 240, court, 0, 0, 0, { cast: false }));
    th.add(box(30, 3, 372, stone, 0, 0, 292), lathe([[21, 0], [21, 3], [0, 3]], marble, 0, 0, 500, 40), cyl(8.6, 8.6, 9, red, 0, 3, 500, 32), cyl(33, 33, 5, red, 0, 0, 500, 48, { open: true }), cyl(33.4, 33.4, 0.8, blue, 0, 5, 500, 48, { open: true }));
    th.add(lathe(Array.from({ length: 8 }, (_, k) => [11.5 - 11.2 * k / 7, 11.2 + 8 * Math.pow(k / 7, 1.6)]), blue, 0, 0, 500, 40), sphere(1.1, gold, 0, 19.8, 500));
    th.position.set(T[0], 0, T[1]); world.add(bake(th));
    world.add(cyl(13.2, 13.2, 9, drum, T[0], 6, T[1], 48));

    // ---- Tiananmen and the square: the gate, Chang'an Avenue, the monument, the great halls either side, Qianmen at the south end
    gate(fc, 0, 200, 122, 40, 13); gate(fc, 0, 0, 108, 36, 12);
    fc.add(box(5.4, 7, 0.5, mat(0xe8d8b8), 0, 9.6, 220.3), box(6.4, 8, 0.3, gold, 0, 9.1, 220.2));
    for (const s of [-1, 1]) {
      fc.add(box(330, 9, 5, red, s * 226, 0, 200), box(331, 0.9, 6.4, tile, s * 226, 9, 200), box(30, 1.2, 0.5, mat(0xf6f0e0), s * 36, 9.2, 220.3), cyl(0.9, 1, 9.5, marble, s * 44, 0, 238, 10), box(4, 0.6, 1, marble, s * 44, 8.6, 238));
      fc.add(box(176, 34, 320, facadeMat({ color: 0xd9c9a6, floor: 34, bay: 7, frame: [0.3, 0.12], glass: 0x6a5a48, lit: 0 }), s * 352, 0, 525), box(182, 3, 326, stone, s * 352, 34, 525), box(90, 10, 150, stone, s * 352, 37, 525));
      fc.add(box(5, 9, 336, red, s * 105, 0, 14), box(6.4, 0.9, 337, tile, s * 105, 9, 14));
    }
    for (const x of [-22, -11, 0, 11, 22]) fc.add(box(6, 1.4, 16, marble, x, 0, 231));
    fc.add(box(64, 3, 64, stone, 0, 0, 560), box(44, 2.5, 44, stone, 0, 3, 560), cyl(3.4, 5.2, 29, stone, 0, 5.5, 560, 4), hipRoof(11, 11, 3, stone, 0, 34.5, 560, { ridge: 0.3 }));
    fc.add(box(108, 4, 108, stone, 0, 0, 715), box(76, 25, 76, facadeMat({ color: 0xe0d2b0, floor: 26, bay: 6.3, frame: [0.3, 0.06], glass: 0x7a6850, lit: 0 }), 0, 4, 715), box(86, 2.2, 86, mat(0xd8a84a), 0, 29, 715), box(80, 2, 80, mat(0xd8a84a), 0, 32.4, 715));
    const flag = mat(0xd0261e), globe = mat(0xfff6e0, { emissive: 0xfff0d0, glow: 0.5 });
    fc.add(cyl(0.3, 0.4, 27, marble, 0, 0, 320, 8), box(5, 3.2, 0.2, flag, 2.7, 23.4, 320));
    for (let i = 0; i < 12; i++) for (const s of [-1, 1]) fc.add(cyl(0.25, 0.3, 11, marble, s * 245, 0, 340 + i * 46, 6), sphere(1.1, globe, s * 245, 11.4, 340 + i * 46, { seg: 8, rows: 6 }), box(0.2, 3, 2.2, flag, s * 56, 22.5, 182 + i * 3.2));
    gate(fc, 0, 905, 96, 30, 13, { base: grey, arches: 1, hall: { tile: greyTile, hb: 7, h1: 6, hu: 6, h2: 9 } });
    fc.add(box(54, 26, 22, facadeMat({ color: 0x8a8884, floor: 5.5, bay: 4.2, frame: [0.36, 0.34], glass: 0x2a2826, lit: 0 }), 0, 0, 996), hipRoof(62, 30, 8, greyTile, 0, 26, 996));

    // ---- the Meridian Gate: a U of red ramparts, the main hall and four pavilions on top
    fc.add(box(126, 13, 34, red, 0, 0, -267), box(128, 1.6, 36, marble, 0, 0, -267));
    for (const x of [-24, 0, 24]) fc.add(box(x ? 5.5 : 7, x ? 7.5 : 9, 35, dark, x, 0, -267));
    hall(fc, 0, 13, -267, 60, 22, { double: true, hb: 7, h1: 6, hu: 5, h2: 9 });
    for (const s of [-1, 1]) {
      fc.add(box(26, 13, 98, red, s * 50, 0, -203), box(28, 1.6, 100, marble, s * 50, 0, -203), box(12, 5, 66, columns, s * 50, 13, -213), hipRoof(72, 18, 5, tile, s * 50, 18, -213, { ry: Math.PI / 2, ridge: 0.86 }));
      pavilion(fc, s * 50, 13, -262, 17); pavilion(fc, s * 50, 13, -165, 17);
    }

    // ---- the Forbidden City: walls and corner towers, the three great halls on their marble terrace, and a sea of lesser golden roofs
    for (const [w, d, x, z] of [[760, 8, 0, -1210], [314, 8, 220, -252], [314, 8, -220, -252], [8, 968, 376, -730], [8, 968, -376, -730]]) fc.add(box(w, 10, d, red, x, 0, z), box(w + 2, 1, d + 2, tile, x, 10, z));
    for (const a of [-1, 1]) { for (const z of [-252, -1210]) pavilion(fc, a * 376, 10, z, 16, 3); pavilion(fc, a * 376, 10, -420, 20, 2); }
    fc.add(box(84, 3.5, 46, marble, 0, 0, -450)); hall(fc, 0, 3.5, -450, 58, 26, { double: true, hb: 6.5, h1: 6, hu: 5, h2: 9 });
    for (let i = 0; i < 3; i++) fc.add(box(142 - i * 13, 2.7, 252 - i * 13, marble, 0, i * 2.7, -716), box(26, 2.7 * (3 - i), 9, marble, 0, 0, -578 - i * 8), box(26, 2.7 * (3 - i), 9, marble, 0, 0, -854 + i * 8));
    hall(fc, 0, 8.1, -655, 64, 37, { double: true, hb: 9, h1: 7, hu: 7.5, h2: 12.5 });
    pavilion(fc, 0, 8.1, -728, 24, 1);
    hall(fc, 0, 8.1, -790, 50, 25, { double: true, hb: 7, h1: 6, hu: 5, h2: 9.5 });
    fc.add(box(74, 3, 170, marble, 0, 0, -962)); hall(fc, 0, 3, -930, 50, 24, { double: true, hb: 6.5, h1: 6, hu: 5, h2: 9 }); pavilion(fc, 0, 3, -975, 15, 1); hall(fc, 0, 3, -1015, 46, 22, { double: true, hb: 6, h1: 5, hu: 4.5, h2: 8 });
    pavilion(fc, 52, 0, -1110, 12, 2); pavilion(fc, -52, 0, -1110, 12, 2);
    gate(fc, 0, -1210, 84, 30, 10, { arches: 3 });
    const river = Array.from({ length: 25 }, (_, k) => { const x = -150 + k * 12.5; return [x, 0.12, -372 + 26 * Math.cos(x / 96)]; }), jade = mat(0x4a7a78, { rough: 0.15, metal: 0.3 });
    for (let k = 1; k < river.length; k++) { const seg = beam(river[k - 1], river[k], 1, jade); seg.scale.set(9, 0.2, 1.1); fc.add(seg); }
    for (const x of [-26, -13, 0, 13, 26]) fc.add(box(x ? 5 : 7, 1.6, 17, marble, x, 0, -346));
    world.add(bake(fc));
    const bodies = [], roofs = [], lows = [], minor = (x, z, w, d, ns) => { bodies.push({ x, z, w: ns ? d : w, d: ns ? w : d, h: 5.6 }); roofs.push({ x, y: 5.6, z, sx: w + 5, sy: 4.8, sz: d + 5, ry: ns ? Math.PI / 2 : 0 }); };
    for (const s of [-1, 1]) {
      for (let z = -500; z >= -830; z -= 66) minor(s * 108, z, 60, 11, true);
      for (let z = -890; z >= -1060; z -= 58) minor(s * 62, z, 52, 10, true);
      minor(s * 70, -450, 32, 12); minor(s * 62, -868, 40, 11);
      for (const cx of [152, 236, 320]) for (let k = 0; k < 10; k++) {
        const x = s * cx, z = -338 - k * 87; if (Math.abs(z + 420) < 50 && cx === 320) continue;
        minor(x, z - 22, r.range(34, 46), 13); minor(x - 26, z + 14, 30, 10, true); minor(x + 26, z + 14, 30, 10, true);
        lows.push({ x, z: z + 38, w: 76, d: 1.4, h: 4 }, { x: x - 38, z, w: 1.4, d: 78, h: 4 }, { x: x + 38, z, w: 1.4, d: 78, h: 4 });
      }
    }
    minor(0, -868, 44, 13); minor(0, -1125, 30, 14);
    world.add(buildings(bodies, columns), buildings(lows, red, { cast: false }), instances(hipGeo(), mat(0xe3a22c, { rough: 0.45, metal: 0.1, side: THREE.DoubleSide }), roofs));

    // ---- Jingshan behind the palace, and the White Dagoba over Beihai lake
    const north = new THREE.Group(), leaf = mat(0x4f6b3c), lake = mat(0x55747c, { rough: 0.12, metal: 0.35 });
    north.add(dome(1, leaf, 0, -0.5, -1480, { scale: [170, 47, 110], cast: false }), box(500, 0.2, 370, lawn, 0, 0, -1475, { cast: false })); pavilion(north, 0, 45, -1480, 17, 3);
    for (const s of [-1, 1]) { pavilion(north, s * 62, 38, -1480, 10, 2, band); pavilion(north, s * 116, 24, -1480, 9, 2, blue); }
    north.add(mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), lake, -710, 0.15, -1180, { scale: [215, 1, 350], cast: false }), mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), lake, -730, 0.15, -400, { scale: [190, 1, 440], cast: false }));
    north.add(dome(1, leaf, -700, 0, -1090, { scale: [85, 30, 85], cast: false }), lathe([[11, 0], [12, 3], [9.5, 5], [11, 9], [9.6, 14], [4, 16.5], [3, 27], [1.2, 30.5], [2.6, 31], [0, 35]], mat(0xf4f1ea), -700, 29, -1090, 24));
    world.add(bake(north));

    // ---- hutongs: rows of low grey courtyard houses with trees in the yards, filling the old city
    const zones = [[-446, -1290, 446, -150], [-446, -150, 446, 240], [-4000, 238, 4000, 312], [-262, 310, 262, 878], [-446, 330, -260, 722], [260, 330, 446, 722], [-70, 876, 70, 1032], [290, 1235, 1115, 2175], [-250, -1660, 250, -1290], [-960, -1570, -470, 120]];
    const open = (x, z, m = 0) => !zones.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m), old = (x, z) => Math.abs(x) < 905 && z > -1510 && z < 2170;
    const hut = [], greys = [0x9a9894, 0xa39f98, 0x8f8d8a, 0xa89c90, 0x98958e];
    for (let z = -1500; z < 2165; z += 15.5) for (let x = -900; x < 900;) {
      const L = r.range(13, 30); x += L / 2 + 1.2;
      if (open(x, z, L / 2 + 3) && Math.abs(((x + 2000) % 190) - 95) > 6 && Math.abs(((z + 3000) % 232) - 116) > 9 && r.chance(0.9)) hut.push({ x, y: 0, z, sx: L, sy: r.range(5.6, 7), sz: 8.2, color: r.pick(greys) });
      x += L / 2;
    }
    world.add(instances(houseGeo(), mat(0xffffff, { rough: 0.9, vertexColors: true }), hut, { cast: false }));

    // ---- the modern city beyond the old one, the CBD to the east with the CCTV loop
    const cbdAt = (x, z) => Math.exp(-((x - 2250) ** 2 + (z - 320) ** 2) / 160000);
    const blocks = cityGrid({ rand: r, area: [-2750, -2500, 3100, 2800], block: 66, street: 26, jitter: 0.3, split: 0.3, keep: (x, z) => !old(x, z) && Math.hypot(x - 2250, z - 350) > 150, palette: [0xcfc4b0, 0xbfb5a4, 0xd8d2c4, 0xa9a39a, 0xc4b49c, 0xb8bcc0],
      height: (x, z) => Math.min(r.range(12, 26 + 22 * clamp((Math.hypot(x, z) - 1500) / 900)) + (r.chance(0.6) ? 250 : 40) * cbdAt(x, z) * r.range(0.4, 1), clear(x, z, 90) - 30) });
    world.add(buildings(blocks.filter((b) => b.h <= 80), facadeMat({ floor: 3.3, bay: 3.4, frame: [0.24, 0.3], glass: 0x3a444e, lit: 0.05, rough: 0.9 }), { cast: false }));
    const glassy = facadeMat({ floor: 4, bay: 2.4, frame: [0.07, 0.12], glass: 0x6f8a9a, lit: 0.05, rough: 0.25, metal: 0.4 }), tall = blocks.filter((b) => b.h > 80);
    tall.forEach((b) => { b.color = r.pick([0xa9bcc8, 0x9ab0bd, 0xc2ccd0, 0xb8a890]); });
    world.add(buildings(tall, glassy), lathe([[37, 0], [31, 150], [28, 330], [32, 500], [34, 528]], glassy, 2050, 0, 180, 4, { ry: Math.PI / 4 }));
    const cctv = new THREE.Group(), smoke = facadeMat({ color: 0x66727c, floor: 4.2, bay: 3, frame: [0.08, 0.12], glass: 0x36444f, lit: 0.05, rough: 0.3, metal: 0.4 });
    cctv.add(box(48, 236, 48, smoke, 0, 0, 0, { rz: -0.07, rx: 0.07 }), box(48, 212, 48, smoke, 112, 0, 112, { rz: 0.07, rx: -0.07 }), box(170, 52, 48, smoke, 60, 184, 8), box(48, 52, 170, smoke, 121, 184, 62), box(48, 42, 160, smoke, 0, 0, 56), box(160, 42, 48, smoke, 56, 0, 112));
    cctv.position.set(2250, 0, 350); cctv.rotation.y = 0.5; world.add(cctv);

    // ---- green: cypress groves round the altars and beside the gates, plane trees on the avenue, a tree in every other courtyard
    const cyp = [], broad = [], tufts = [], greens = [0x4f7a3c, 0x5c8a44, 0x466f3a, 0x6a8f48];
    while (cyp.length < 900) { const x = r.range(300, 1105), z = r.range(1245, 2165), dx = x - T[0], dz = z - T[1]; if (Math.abs(dx) > 108 || dz < -108 || (dz > 108 && Math.abs(dx) > 22 && Math.hypot(dx, dz - 500) > 40)) cyp.push([x, 0, z]); }
    while (cyp.length < 1200) { const x = r.range(75, 440) * (r.chance(0.5) ? 1 : -1), z = r.range(-140, 190); if (Math.abs(Math.abs(x) - 105) > 8) cyp.push([x, 0, z]); }
    while (cyp.length < 1600) { const a = r() * 6.28, d = Math.sqrt(r()), x = Math.cos(a) * d * 160, z = Math.sin(a) * d * 100; if (Math.hypot(x, z) > 22) cyp.push([x, 46 * Math.sqrt(Math.max(0, 1 - (x / 170) ** 2 - (z / 110) ** 2)) - 1.5, z - 1480]); }
    for (let i = 0; i < 40; i++) cyp.push([r.range(-100, 100), 0, r.range(-1180, -1085)]);
    for (let x = -840; x <= 840; x += 24) for (const z of [242, 308]) if (Math.abs(x) > 70 || z > 300) broad.push([x, 0, z]);
    while (tufts.length < 1500) { const x = r.range(-900, 900), z = r.range(-1500, 2160), s = r.range(4, 6.5); if (open(x, z, 4)) tufts.push({ x, y: 5 + s * 0.4, z, sx: s, sy: s * 0.8, sz: s, ry: r() * 6, color: r.pick(greens) }); }
    trees(world, cyp, 'cypress', { size: 16, color: [0x33522f, 0x3c5c33, 0x2c482c], rand: r });
    trees(world, broad, 'round', { size: 10, color: greens, rand: r });
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { rough: 0.9, flat: true }), tufts, { cast: false }));

    // ---- morning traffic on Chang'an Avenue, a few thin clouds
    fleet(world, new THREE.BoxGeometry(4.5, 1.5, 1.9).translate(0, 0.95, 0), mat(0xffffff, { rough: 0.4, metal: 0.3 }), 120, (i, t) => { const dir = i % 2 ? 1 : -1, x = ((((i * 53.3 + dir * t * 15) % 3200) + 3200) % 3200) - 1600; return [x, 0, 275 + dir * (5 + (i % 5) * 5), 0]; }, [0xf2f2f0, 0x22242a, 0x9aa0a6, 0xb8262a, 0xf2f2f0, 0x2b4f9a, 0xd0b060]);
    fleet(world, new THREE.BoxGeometry(12, 3.1, 2.6).translate(0, 1.75, 0), mat(0xffffff, { rough: 0.5 }), 14, (i, t) => { const dir = i % 2 ? 1 : -1, x = ((((i * 231 + dir * t * 11) % 3200) + 3200) % 3200) - 1600; return [x, 0, 275 + dir * 28.5, 0]; }, [0xc23a2e, 0x2f7a4a, 0xe8e4d8]);
    clouds(world, { count: 10, y: [1300, 1700], size: 220, color: 0xffe2bd, self: 0.4, rand: rng(3), area: [-4000, -4500, 4000, 2000] });

    return { world, path, focus, duration: 50 };
  },
};
