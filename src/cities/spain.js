// Barcelona on a golden afternoon: down from Park Güell over the gingerbread gatehouses, across the Eixample's chamfered blocks to circle the spires
// of the Sagrada Família, past Torre Glòries to the twin towers, low along Barceloneta beach, by Columbus on his column, and out toward Montjuïc and the sun.
import { THREE, mergeGeometries, createWorld, rng, mat, glowMat, facadeMat, mesh, box, cyl, sphere, lathe, prism, beam, instances, buildings, cityGrid, terrain, water, trees, clouds, fbm, smooth } from '../kit.js';

// merges meshes that share a material into one mesh each
function bake(list, at = [0, 0, 0], ry = 0) {
  const by = new Map();
  for (const o of list.flat()) {
    o.updateMatrix(); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry).applyMatrix4(o.matrix);
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g);
  }
  return [...by].map(([m, gs]) => mesh(mergeGeometries(gs), m, ...at, { ry }));
}
// trencadís: gives every face of a geometry its own colour, from a palette or from pick(height)
function mosaic(g, r, palette, pick) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i += 6) { c.set(pick ? pick(p.getY(i)) : r.pick(palette)); for (let k = 0; k < 6 && i + k < n; k++) c.toArray(a, (i + k) * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const G = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const L = (profile, seg = 16) => new THREE.LatheGeometry(profile.map(([a, b]) => new THREE.Vector2(Math.max(a, 0.001), b)), seg);
const gable = (w, h, d) => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);

export default {
  build() {
    const r = rng(1882);
    const world = createWorld({
      sky: { top: 0x3f7ecb, horizon: 0xf7dcae, bottom: 0xc9b08a, haze: 0.42 },
      sun: { dir: [-0.8, 0.36, -0.45], color: 0xffd6a0, power: 3.4, disc: 0xfff0c8, size: 0.0011 },
      ambient: { sky: 0xc4d4f2, ground: 0xa08a6c, power: 1.0 },
      fog: { color: 0xeed5b0, density: 0.00027 }, exposure: 1.05, env: 0.8,
    });
    // the sea lies to +Z, the hills to -Z; +X runs up the coast. The Eixample's blocks sit on a 133 m grid.
    const SF = [266, 0, -532], GL = [798, 0, -399], PG = [-250, -1400], MJ = [-1300, 330], COL = [-330, 330];
    const path = [[-250, 162, -1640], [-250, 112, -1470], [-200, 92, -1250], [0, 80, -900], [150, 78, -690], [165, 75, -530], [250, 70, -400], [420, 80, -440], [735, 95, -310], [840, 80, 0], [775, 60, 380], [560, 30, 606], [150, 22, 640], [-200, 30, 520], [-470, 50, 330], [-760, 72, 230]];
    const focus = [[0.09, SF[0], 90, SF[2]], [0.2, SF[0], 95, SF[2]], [0.28, SF[0], 92, SF[2]], [0.34, SF[0], 85, SF[2]], [0.4, GL[0], 80, GL[2]], [0.45, GL[0], 80, GL[2]], [0.53, 720, 90, 450], [0.6, 720, 80, 450], [0.68, 150, 5, 640], [0.76, COL[0], 45, COL[1]]];

    // ---- the lie of the land: flat city, the hills behind with Park Güell's slope, Montjuïc, the beach shelving into the sea
    const land = (x, z) => {
      const edge = x > -50 ? 632 : x > -170 ? 830 : x > -650 ? 438 : 640, sea = -9 * smooth(edge, edge + (x > -50 ? 80 : 8), z);
      const north = Math.max(0, -1150 - z), calm = 1 - 0.9 * Math.exp(-((x - PG[0]) ** 2 + (z - PG[1]) ** 2) / 30000);
      const hills = north * 0.22 + smooth(0, 300, north) * calm * 60 * (fbm(x / 260, z / 260, 3) - 0.35) + 170 * Math.exp(-((x + 900) ** 2 + (z + 2500) ** 2) / 250000);
      return Math.max(sea + Math.max(hills, 0), 175 * smooth(560, 40, Math.hypot(x - MJ[0], z - MJ[1])) ** 1.3 - (z > 640 ? 9 : 0));
    };
    const C = (h) => new THREE.Color(h), tmp = new THREE.Color(), cCity = C(0x9c9388), cSand = C(0xecd7a2), cPine = C(0x4c7038), cDry = C(0xa39a5e), cBed = C(0x7fae9c);
    world.add(terrain({ size: 6400, center: [0, -300], seg: 250, height: land, color: (x, y, z) => {
      const n = fbm(x / 90, z / 90, 3);
      if (y < -0.6) return tmp.copy(cSand).lerp(cBed, smooth(-0.6, -5, y));
      if (x > -50 && z > 588) return cSand;
      return y > 4 ? tmp.copy(cPine).lerp(cDry, smooth(0.35, 0.7, n)).lerp(cCity, smooth(40, 4, y) * 0.8) : cCity;
    } }));
    water(world, -1.5, { size: [9000, 5000], x: 0, z: 2960, color: 0x1e86b4, rough: 0.09, metal: 0.3, ripple: 70, strength: 0.3, env: 1.3 });
    water(world, -1.5, { size: [520, 420], x: -400, z: 650, color: 0x1e86b4, rough: 0.09, metal: 0.3, ripple: 50, strength: 0.2 });

    // ---- the Eixample: every block a ring of houses with chamfered corners round a courtyard, terracotta on top
    const creams = [0xe9d8b4, 0xdcc49c, 0xf0e2c4, 0xd9b48c, 0xe6c9a0, 0xcfae8a, 0xf2e6d0, 0xdba98a, 0xc9b79c], tiles = [0xb8623c, 0xc47248, 0xa9583a, 0xcf8356, 0x9c5a44, 0xb9a48c];
    const houses = [], roofs = [], yards = [], green = [];
    const skip = (i, j) => (j === -4 && i >= 1 && i <= 3) || ((i === 5 || i === 6) && (j === -3 || j === -4));
    for (let i = -8; i <= 10; i++) for (let j = -8; j <= 1; j++) {
      const cx = i * 133, cz = j * 133;
      if (skip(i, j)) { if (i !== 2) green.push([cx, cz]); continue; }
      const base = r.range(19, 25);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), put = (lx, lz, w, ry) => {
          const h = base + r.range(-3.5, 3.5), x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
          houses.push({ x, z, w, d: 24, h, ry: -a + ry, color: r.pick(creams) }); roofs.push({ x, z, y: h, w: w - 1.6, d: 22.4, h: 0.9, ry: -a + ry, color: r.pick(tiles) });
        };
        for (const t of [-1, 0, 1]) put(t * 27.7, -44.5, 27.3, 0);
        put(-40.5, -40.5, 21.2, -Math.PI / 4);
      }
      yards.push({ x: cx, z: cz, w: 65, d: 65, h: 0.5, color: r.pick([0x8fa86a, 0xb9ad98, 0x9aa37a, 0xc2b49c]) });
      if (r.chance(0.6)) yards.push({ x: cx + r.range(-14, 14), z: cz + r.range(-14, 14), w: r.range(16, 34), d: r.range(14, 30), h: r.range(4, 8), color: r.pick(creams) });
    }
    const wallF = facadeMat({ floor: 3.5, bay: 2.7, frame: [0.3, 0.22], glass: 0x2e3b40, rough: 0.9, ground: 0.6 });
    world.add(buildings(houses, wallF), buildings(roofs, mat(0xffffff, { rough: 0.8 }), { cast: false }), buildings(yards, mat(0xffffff, { rough: 0.9 }), { cast: false }));

    // ---- the old town and Barceloneta below the grid, Gràcia climbing behind it, plainer districts beyond
    const clearOf = (x, z, px, pz, d) => Math.hypot(x - px, z - pz) > d;
    const old = cityGrid({ rand: r, area: [-860, 222, 620, 578], block: 38, street: 9, jitter: 0.3, split: 0.5, fill: 0.95, palette: creams, keep: (x, z) => land(x, z + 30) > -0.5 && land(x, z) < 1 && clearOf(x, z, ...COL, 60) && clearOf(x, z, 730, 455, 120), height: () => r.range(13, 22) });
    const gracia = cityGrid({ rand: r, area: [-1064, -1330, 1330, -1140], block: 44, street: 11, jitter: 0.3, split: 0.4, palette: creams, keep: (x, z) => clearOf(x, z, PG[0], -1330, 130), height: () => r.range(12, 20) });
    const outer = cityGrid({ rand: rng(5), area: [-2600, -1140, 2700, 590], block: 70, street: 20, jitter: 0.35, split: 0.5, palette: creams, keep: (x, z) => (x < -1140 || x > 1400) && land(x, z) < 3 && land(x, z + 60) > -0.5, height: () => r.range(12, 26) });
    const low = [...old, ...gracia, ...outer]; low.forEach((b) => { b.y = Math.max(0, land(b.x, b.z)) - 1; b.h += 1; });
    world.add(buildings(low, wallF), buildings(low.map((b) => ({ x: b.x, z: b.z, y: b.y + b.h, w: b.w - 1.2, d: b.d - 1.2, h: 0.8, color: r.pick(tiles) })), mat(0xffffff, { rough: 0.8 }), { cast: false }));

    // ---- the Sagrada Família: nave, transepts and apse, the three facades, and eighteen spires (twelve apostles, four evangelists, Mary, Jesus)
    const stone = mat(0xcdb78f), stoneOld = mat(0x9a8362), stoneNew = mat(0xe2d3b4), slate = mat(0x8a8478), glass = mat(0x3b4a5c, { rough: 0.2, metal: 0.5 }), cypress = mat(0x3f7a3c), lit = glowMat(0xfffbe8, 1.25);
    const gothic = facadeMat({ color: 0xcdb78f, floor: 11, bay: 5.2, frame: [0.26, 0.1], glass: 0x35465c, rough: 0.85, ground: 3 });
    const sf = [box(46, 40, 88, gothic, 0, 0, 2), box(26, 18, 84, gothic, 0, 40, 2), mesh(gable(26, 9, 84), slate, 0, 58, 2), box(78, 38, 30, gothic, 0, 0, -4), mesh(gable(30, 9, 78).rotateY(Math.PI / 2), slate, 0, 38, -4)];
    sf.push(cyl(23, 23, 40, stone, 0, 0, -42, 20), cyl(0, 23.5, 10, slate, 0, 40, -42, 20));
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) / 7 * Math.PI, x = Math.cos(a) * 23, z = -42 + Math.sin(a) * 23; sf.push(cyl(6, 6, 26, stone, x, 0, z, 10), cyl(0, 6.4, 16, stoneNew, x, 26, z, 10), sphere(1.1, lit, x, 42.6, z, { seg: 8, rows: 6 })); }
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) sf.push(cyl(0, 2.2, 13, stoneNew, s * 23.4, 40, -30 + i * 8.6, 6), cyl(0, 1.7, 9, stoneNew, s * 13.4, 58, -30 + i * 8.6, 6));        // pinnacles along the roofs
      sf.push(lathe([[11, 0], [11, 16], [9.6, 27], [6.6, 36], [2.6, 43], [0.6, 46]], stoneNew, s * 33, 0, -40, 14));                                                 // the sacristy domes
    }
    // Nativity facade (+X): three gabled portals in old dark stone and the green cypress between the spires
    for (const [z, h, w] of [[0, 34, 20], [-15, 25, 13], [15, 25, 13]]) sf.push(box(6, h * 0.55, w, stoneOld, 41, 0, z), mesh(gable(w, h * 0.5, 6).rotateY(Math.PI / 2), stoneOld, 41, h * 0.55, z), box(1, h * 0.36, w * 0.5, glass, 44.2, 0, z), cyl(0, 1.4, 9, stoneOld, 42, h * 1.03, z, 6));
    sf.push(cyl(0, 3.6, 17, cypress, 40, 44, 0, 10), box(8, 30, 62, stoneOld, 36, 0, 0));
    // Passion facade (-X): leaning bone-like columns under a canopy, and the gallery of bones above
    for (let i = 0; i < 6; i++) sf.push(beam([-58, 0, -19 + i * 7.6], [-41, 25, -15 + i * 6], 1.7, stoneNew));
    sf.push(box(8, 30, 62, stone, -36, 0, 0), box(22, 1.6, 50, stoneNew, -47, 25, 0, { rz: -0.12 }), mesh(gable(46, 13, 5).rotateY(Math.PI / 2), stone, -39, 38, 0), box(1, 15, 9, glass, -40.4, 2, 0));
    for (let i = 0; i < 16; i++) sf.push(cyl(0.45, 0.6, 9, stoneNew, -41, 29, -15 + i * 2, 6));
    // Glory facade (+Z): tall columns, the stair, cloud lanterns
    for (let i = 0; i < 7; i++) sf.push(cyl(1.3, 1.6, 30, stoneNew, -19.5 + i * 6.5, 0, 50, 8), cyl(0, 2.4, 9, stoneNew, -19.5 + i * 6.5, 42, 48, 8));
    sf.push(box(52, 12, 5, stoneNew, 0, 30, 49), box(60, 2, 14, stone, 0, 0, 54), box(20, 20, 1, glass, 0, 2, 46.2));
    world.add(...bake(sf, SF));
    const perf = (color, round, bay) => facadeMat({ color, floor: 2.9, bay, frame: [0.3, 0.3], glass: 0x40342a, rough: 0.9, round, ground: 0 });
    const apostleG = L([[5.6, 0], [5.6, 36], [5.4, 50], [4.8, 64], [3.7, 78], [2.5, 89], [1.45, 96], [1.3, 100]], 20), centralG = L([[9, 0], [9, 38], [8.4, 52], [7.2, 66], [5.4, 80], [3.4, 92], [2, 98], [1.8, 100]], 12);
    const finialG = mosaic(L([[1.3, 0], [2, 2], [1.2, 4], [2.5, 6.5], [2.7, 8], [1.6, 9.6], [0.9, 12], [1.6, 13.4], [0.3, 15.4]], 10), r, [0xd8402c, 0xe9b520, 0xf6f2e6, 0xf6f2e6, 0x3f9a52, 0xe87a24, 0xd8402c]);
    const apostles = [], tips = [];
    for (const [fx, fz, hs, tone] of [[32, 0, [98, 107, 107, 98], 0xa58d6a], [-32, 0, [107, 112, 112, 107], 0xcdb78f], [0, 47, [110, 118, 118, 110], 0xe2d3b4]]) hs.forEach((h, i) => {
      const o = (i - 1.5) * 12.4, x = SF[0] + (fx ? fx : o), z = SF[2] + (fx ? o : fz);
      apostles.push({ x, z, sy: h / 100, color: tone }); tips.push({ x, y: h - 0.5, z, s: 1.05 });
    });
    const centrals = [{ x: SF[0], z: SF[2] - 4, sy: 1.56, sx: 1.12, sz: 1.12 }, { x: SF[0], z: SF[2] - 36, sy: 1.26, sx: 0.8, sz: 0.8 }, ...[-1, 1].flatMap((a) => [-1, 1].map((b) => ({ x: SF[0] + a * 13, z: SF[2] - 4 + b * 13, sy: 1.24, sx: 0.6, sz: 0.6 })))];
    world.add(instances(apostleG, perf(0xffffff, 5.6, 2.2), apostles), instances(finialG, mat(0xffffff, { vertexColors: true, rough: 0.4 }), tips), instances(centralG, perf(0xe6d8ba, 9, 2.8), centrals));
    const tops = [box(2.6, 17, 2.6, lit, 0, 156, -4), box(11, 2.6, 2.6, lit, 0, 165, -4), box(2.6, 2.6, 11, lit, 0, 165, -4), mesh(new THREE.OctahedronGeometry(5.5), lit, 0, 132, -36), mesh(new THREE.OctahedronGeometry(5.5).rotateY(0.785).rotateX(0.785), lit, 0, 132, -36)];
    for (const a of [-1, 1]) for (const b of [-1, 1]) tops.push(sphere(1.7, lit, a * 13, 126, -4 + b * 13, { seg: 8, rows: 6 }), box(6, 0.5, 2, lit, a * 13, 127, -4 + b * 13, { ry: a * b * 0.785 }));
    world.add(...bake(tops, SF));

    // ---- Torre Glòries: the bullet, tiled red at the foot through violet to blue at the tip
    const tg = mosaic(L([[19.5, 0], [19.5, 84], [19, 100], [17.2, 116], [13.6, 130], [8, 140], [0.5, 144]].flatMap(([a, b], i, p) => i ? [0.25, 0.5, 0.75, 1].map((t) => [p[i - 1][0] + (a - p[i - 1][0]) * t, p[i - 1][1] + (b - p[i - 1][1]) * t]) : [[a, b]]), 44), r, null,
      (y) => r.pick(y + r.range(-30, 30) < 60 ? [0xc8382e, 0xd9532c, 0xb02a3a, 0xe0703a, 0x8f2a4a] : y + r.range(-25, 25) < 105 ? [0x7a3a8a, 0x5a4aa8, 0xb03a5a, 0x4a62b8] : [0x3f6fc8, 0x5a8fd8, 0x3550a8, 0x7fb0e0]));
    world.add(mesh(tg, mat(0xffffff, { vertexColors: true, rough: 0.3, metal: 0.35, flat: true }), ...GL));

    // ---- the twin towers by the beach (one in a white steel lattice, one banded glass), and the golden fish
    const steel = mat(0xf4f1e8, { rough: 0.5 }), A = [700, 0, 440], B = [762, 0, 472], tw = [box(34, 150, 34, facadeMat({ color: 0x7f9a98, floor: 3.8, bay: 2.6, frame: [0.06, 0.12], glass: 0x244a50, rough: 0.3, metal: 0.4 }), 0, 0, 0)];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), P = (u, y) => [ca * 20 - sa * u, y, sa * 20 + ca * u];
      for (let t = 0; t < 5; t++) tw.push(beam(P(-20, t * 30), P(20, t * 30 + 30), 1.3, steel), beam(P(20, t * 30), P(-20, t * 30 + 30), 1.3, steel), beam(P(-20, t * 30 + 30), P(20, t * 30 + 30), 1.1, steel));
      tw.push(beam(P(20, 0), P(20, 152), 1.5, steel));
    }
    world.add(...bake(tw, A), ...bake([box(36, 152, 36, facadeMat({ color: 0xe9eef0, floor: 3.8, bay: 30, frame: [0.01, 0.3], glass: 0x2a5f8a, rough: 0.25, metal: 0.5 }), 0, 0, 0), box(38, 1.5, 38, steel, 0, 152, 0), cyl(11, 11, 1, steel, 0, 156, 0, 20), cyl(1, 1, 4, steel, 0, 152, 0, 8)], B));
    world.add(mesh(new THREE.SphereGeometry(1, 18, 10).scale(27, 8.5, 6.5), mat(0xd9a63a, { metal: 0.85, rough: 0.32, flat: true }), 640, 26, 545, { ry: 0.5, rz: 0.12 }), ...bake([-14, 0, 14].map((o) => cyl(0.6, 0.6, 22, steel, 640 + o * 0.88, 0, 545 - o * 0.48, 6))));

    // ---- Barceloneta: the promenade, umbrellas on the sand, the sail-shaped hotel on its spit, yachts in the port, boats out at sea
    world.add(box(1010, 0.4, 14, mat(0xd8c8a8), 455, 0, 584, { cast: false }));
    const shades = []; for (let i = 0; i < 330; i++) shades.push({ x: r.range(-40, 950), y: land(0, 0) + 0.1, z: r.range(596, 630), s: r.range(0.9, 1.2), color: r.pick([0xe8412f, 0xf2c21a, 0x2f7fd0, 0xffffff, 0x38a860, 0xf08a24, 0xe85a9a]) });
    world.add(instances(mergeGeometries([new THREE.ConeGeometry(1.7, 0.7, 8).translate(0, 2.3, 0), new THREE.CylinderGeometry(0.05, 0.05, 2.3, 4).translate(0, 1.15, 0)]), mat(0xffffff, { rough: 0.7 }), shades, { cast: false }));
    const sail = new THREE.Shape(); sail.moveTo(-22, 0); sail.lineTo(20, 0); sail.quadraticCurveTo(26, 60, 6, 99); sail.lineTo(-22, 99);
    world.add(mesh(new THREE.ExtrudeGeometry(sail, { depth: 18, bevelEnabled: false }).translate(0, 0, -9), facadeMat({ color: 0xbfd2de, floor: 3.8, bay: 3, frame: [0.05, 0.12], glass: 0x4f86a8, rough: 0.2, metal: 0.6 }), -110, 0, 770, { ry: 1.2 }));
    const yachtG = mergeGeometries([G(9, 1.2, 2.6, 0, 0.2, 0), new THREE.CylinderGeometry(0.07, 0.09, 11, 4).translate(0.6, 6, 0), G(4, 0.9, 1.9, -1.2, 1.2, 0)]), yachts = [];
    for (let px = -610; px <= -210; px += 50) { yachts.push({ x: px, y: -1.2, z: 560, sx: 0.4, sy: 0.5, sz: 62, color: 0x9a8a72 }); for (let k = 0; k < 9; k++) for (const s of [-1, 1]) if (r.chance(0.8)) yachts.push({ x: px + s * 8, y: -1.5, z: 470 + k * 13 + r.range(-2, 2), ry: s > 0 ? 0 : Math.PI, s: r.range(0.8, 1.2), color: 0xf6f4ee }); }
    world.add(instances(yachtG, mat(0xffffff, { rough: 0.5 }), yachts));
    const sailG = mergeGeometries([G(8, 1.1, 2.4, 0, 0, 0), new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0.4, 1), new THREE.Vector2(-4.4, 1.4), new THREE.Vector2(0.4, 13)]), { depth: 0.1, bevelEnabled: false }), new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0.8, 1.4), new THREE.Vector2(4.2, 1.4), new THREE.Vector2(0.8, 10)]), { depth: 0.1, bevelEnabled: false })]);
    const fleet = Array.from({ length: 16 }, (_, i) => ({ x: r.range(-200, 1500), z: r.range(760, 1500), v: r.range(2, 4) * (i % 2 ? 1 : -1), ry: i % 2 ? 0 : Math.PI, s: r.range(1, 1.5) })), sails = instances(sailG, mat(0xffffff, { rough: 0.6, side: THREE.DoubleSide }), fleet), dummy = new THREE.Object3D();
    world.add(sails); world.onUpdate((t) => {
      fleet.forEach((b, i) => { dummy.position.set(-300 + ((((b.x + 300 + b.v * t) % 1900) + 1900) % 1900), -1.4 + Math.sin(t + i) * 0.15, b.z); dummy.rotation.set(Math.sin(t * 0.7 + i) * 0.05, b.ry, 0); dummy.scale.setScalar(b.s); dummy.updateMatrix(); sails.setMatrixAt(i, dummy.matrix); });
      sails.instanceMatrix.needsUpdate = true;
    });

    // ---- Columbus on his column at the foot of the Rambla
    const iron = mat(0x4f463c, { metal: 0.5, rough: 0.5 }), bronze = mat(0x5f6f5a, { metal: 0.5, rough: 0.55 }), pale = mat(0xd8cdb4);
    const col = [cyl(15, 17, 2, pale, 0, 0, 0, 8), cyl(9, 11, 6, pale, 0, 2, 0, 8), cyl(5, 6, 9, pale, 0, 8, 0, 8), cyl(2, 2.5, 30, iron, 0, 17, 0, 16), cyl(3.6, 2, 3, iron, 0, 47, 0, 12), sphere(2.6, iron, 0, 51.5, 0, { seg: 12, rows: 8 }),
      cyl(0.9, 1.2, 4.6, bronze, 0, 53.5, 0, 8), sphere(0.8, bronze, 0, 58.8, 0, { seg: 8, rows: 6 }), beam([0.6, 57.2, 0.3], [1.2, 57.6, 3.6], 0.5, bronze)];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; col.push(box(2.2, 2.6, 4.4, i % 2 ? iron : pale, Math.sin(a) * 12.5, 2, Math.cos(a) * 12.5, { ry: a })); }
    world.add(...bake(col, [COL[0], 0, COL[1]]));

    // ---- Montjuïc: the Palau Nacional on its terraces with the fountain below, the castle and the white telecom needle on top
    const sandst = facadeMat({ color: 0xdcc394, floor: 7, bay: 5, frame: [0.3, 0.2], glass: 0x4a4436, rough: 0.9, ground: 2 }), sandP = mat(0xdcc394), domeM = mat(0x8fa39a, { rough: 0.5, metal: 0.2 }), pool = mat(0x3f8fb4, { rough: 0.1, metal: 0.3 });
    const pal = [box(150, 18, 60, sandP, 0, -18, 6), box(132, 28, 34, sandst, 0, 0, 0), box(44, 36, 44, sandst, 0, 0, 2), box(50, 3, 12, sandP, 0, 0, 24), mesh(new THREE.SphereGeometry(1, 24, 12, 0, 6.283, 0, 1.571).scale(19, 20, 16), domeM, 0, 36, 2), cyl(2.4, 2.4, 6, sandP, 0, 55, 2, 8), cyl(0, 3, 5, domeM, 0, 61, 2, 8)];
    for (const s of [-1, 1]) {
      pal.push(mesh(new THREE.SphereGeometry(1, 16, 8, 0, 6.283, 0, 1.571).scale(9, 10, 9), domeM, s * 46, 28, 0), box(18, 5, 18, sandP, s * 46, 28, 0));
      for (const t of [-1, 1]) pal.push(box(8, 56, 8, sandP, s * 26, 0, 2 + t * 20), box(9.4, 1.5, 9.4, sandP, s * 26, 44, 2 + t * 20), cyl(0, 6, 12, domeM, s * 26, 56, 2 + t * 20, 4));
    }
    for (let i = 0; i < 6; i++) pal.push(box(70 + i * 9, 3, 16, sandP, 0, -3 - i * 9, 34 + i * 17), box(22, 0.4, 13, pool, 0, 0.1 - i * 9, 36 + i * 17));
    for (let i = 0; i < 9; i++) pal.push(cyl(1.2, 1.3, 13, sandP, -17.6 + i * 4.4, 3, 25, 8));
    const PAL = [-1040, land(-1040, 190) + 6, 190]; world.add(...bake(pal, PAL, 1.18));
    const top = land(...MJ), mj = [cyl(46, 52, 9, mat(0xb9a888, { flat: true }), 30, top - 3, 40, 8), cyl(30, 30, 13, mat(0xb9a888, { flat: true }), 30, top - 3, 40, 4), mesh(L([[2.6, 0], [2, 50], [0.5, 118], [0.2, 130]], 10), steel, -150, land(MJ[0] - 150, MJ[1] - 40), -40, { rz: 0.22 }), mesh(new THREE.TorusGeometry(16, 1.3, 6, 24, Math.PI), steel, -164, land(MJ[0] - 150, MJ[1] - 40) + 62, -40)];
    world.add(...bake(mj, [MJ[0], 0, MJ[1]]));

    // ---- Park Güell: the gingerbread gatehouses, the dragon stair, the hall of columns under the terrace with its mosaic bench
    const y0 = land(PG[0], -1345), rubble = mat(0x9a7450, { flat: true }), icing = mat(0xffffff, { vertexColors: true, rough: 0.5 }), creamM = mat(0xefe6d2), sandy = mat(0xd9c49a);
    const bright = [0x2f7fd0, 0xf2c21a, 0xe8412f, 0x38a860, 0xffffff, 0xf08a24, 0x3fb8c8, 0xffffff, 0x7a4fc0], frost = [0xffffff, 0xf4ecd8, 0xffffff, 0xc9a070, 0xfaf4e6], pg = [];
    for (const s of [-1, 1]) {
      const x = s * 27;
      pg.push(cyl(7.5, 8, 9, rubble, x, 0, 0, 10, { scale: [1.25, 1, 1] }), mesh(mosaic(new THREE.SphereGeometry(1, 12, 6, 0, 6.283, 0, 1.571).scale(10.4, 5, 8.6), r, frost), icing, x, 9, 0), mesh(new THREE.TorusGeometry(8.4, 0.7, 5, 14).rotateX(Math.PI / 2).scale(1.25, 1, 1), creamM, x, 9, 0));
      for (let i = 0; i < 6; i++) { const a = i * 1.047; pg.push(box(1.7, 2.6, 0.5, creamM, x + Math.sin(a) * 9.6, 3.4, Math.cos(a) * 7.8, { ry: a })); }
      if (s < 0) pg.push(cyl(2, 2.6, 5, rubble, x, 13, 0, 8), mesh(mosaic(L([[1.9, 0], [1.6, 6], [1.2, 12], [0.8, 16]], 8), r, [0x2f6fd0, 0xffffff]), icing, x, 18, 0), sphere(1.3, creamM, x, 34.4, 0, { seg: 8, rows: 6 }), box(0.5, 4.4, 0.5, creamM, x, 35, 0), box(3, 0.5, 0.5, creamM, x, 37.4, 0), box(0.5, 0.5, 3, creamM, x, 37.4, 0));
      else pg.push(cyl(1.1, 1.3, 5, creamM, x, 13, 0, 8), mesh(mosaic(new THREE.SphereGeometry(1, 10, 5, 0, 6.283, 0, 1.7).scale(3, 2.4, 3), r, [0xd8402c, 0xd8402c, 0xffffff]), icing, x, 17.6, 0), mesh(mosaic(new THREE.SphereGeometry(1, 10, 5, 0, 6.283, 0, 1.571).scale(5, 3.4, 5), r, frost), icing, x - 6, 11, -3));
      pg.push(box(40, 3.4, 1.4, rubble, s * 56, 0, 6), box(40.4, 0.7, 2, creamM, s * 56, 3.4, 6));
    }
    for (let i = 0; i < 16; i++) for (const s of [-1, 1]) pg.push(box(11, 0.5, 2.6, creamM, s * 8.5, i * 0.5, -10 - i * 2.4));
    pg.push(box(5, 8.6, 40, creamM, 0, -0.4, -29, { rx: -0.2 }), mesh(mosaic(new THREE.SphereGeometry(1, 8, 5).scale(1.3, 1, 3.2), r, bright), icing, 0, 5.2, -24, { rx: -0.2 }), box(96, 1, 60, sandy, 0, 7.4, -78), box(92, 2.4, 46, creamM, 0, 15, -72), box(90, 0.5, 44, sandy, 0, 17.3, -72));
    const cols = []; for (let i = 0; i < 11; i++) for (let j = 0; j < 6; j++) cols.push({ x: PG[0] - 41 + i * 8.2, y: y0 + 8.2, z: -1345 - 53 - j * 7.6, sx: 1.25, sy: 7, sz: 1.25 });
    const bench = []; for (let i = 0; i < 60; i++) { const u = i / 59 * 2 - 1, wob = Math.sin(i * 0.9) * 2.6; bench.push(mesh(mosaic(G(3.4, 1.5, 1.6), r, bright), icing, u * 45, 17.5, -50.5 + wob + 21 * u ** 6, { ry: Math.cos(i * 0.9) * -0.7 })); }
    pg.push(...bench, box(26, 11, 16, mat(0xe8a8a0), 86, 6, -40), mesh(gable(16, 5, 26).rotateY(Math.PI / 2), mat(0xb8623c), 86, 17, -40), cyl(1.6, 2, 10, mat(0xe8a8a0), 96, 17, -44, 8), cyl(0, 2, 6, mat(0x5f9aa8), 96, 27, -44, 8));
    world.add(...bake(pg, [PG[0], y0, -1345]), instances(new THREE.CylinderGeometry(0.42, 0.5, 1, 10).translate(0, 0.5, 0), creamM, cols));

    // ---- palms and plane trees, a few clouds lit from below
    const palms = [], planes = [], pines = [];
    for (let x = -40; x < 960; x += 13) palms.push([x, 0.3, 579 + r.range(-1.5, 1.5)]);
    for (let i = 0; i < 26; i++) palms.push([COL[0] + Math.cos(i * 0.5) * (34 + i % 3 * 9), 0.2, COL[1] + Math.sin(i * 0.5) * (34 + i % 3 * 9)], [-170 - i * 17, 0.2, 428]);
    for (let i = 0; i < 14; i++) palms.push([PG[0] + r.range(-90, 90), land(PG[0], -1330) - 0.5, -1328 + r.range(-8, 8)], [PAL[0] + r.range(40, 150), land(PAL[0] + 90, PAL[2] - 60), PAL[2] + r.range(-140, -30)]);
    for (const [cx, cz] of green) for (let i = 0; i < 26; i++) { const x = cx + r.range(-52, 52), z = cz + r.range(-52, 52); if (clearOf(x, z, GL[0], GL[2], 34) && Math.hypot(x - cx, z - cz) > 15) planes.push([x, 0, z]); }
    for (let j = -6; j <= 0; j++) for (let x = -300; x < 900; x += 19) if (!skip(Math.round(x / 133), j)) planes.push([x, 0, j * 133 - 62.5]);
    for (let i = 0; i < 4000 && pines.length < 330; i++) { const x = r.range(-1750, 700), z = r.range(-1900, 800), y = land(x, z); if (y > 8 && fbm(x / 110, z / 110, 2) > 0.45 && clearOf(x, z, PG[0], -1400, 62) && clearOf(x, z, PAL[0], PAL[2], 95) && clearOf(x, z, MJ[0] + 30, MJ[1] + 40, 60) && (z > -1500 || Math.abs(x - PG[0]) > 30) && (z < -1150 ? Math.abs(x - PG[0]) < 480 : true)) pines.push([x, y - 0.4, z]); }
    trees(world, palms, 'palm', { size: 12 });
    trees(world, planes, 'round', { size: 11, color: [0x5a8a3c, 0x6a9a44, 0x4a7a38, 0x7aa24a] });
    trees(world, pines, 'round', { size: 13, color: [0x3f6a34, 0x4a7638, 0x35602f] });
    world.add(cyl(26, 26, 0.5, pool, 399, 0, -532, 24, { cast: false }), box(100, 0.3, 100, mat(0x8fa86a), 133, 0, -532, { cast: false }), box(100, 0.3, 100, mat(0x8fa86a), 399, 0, -532, { cast: false }), box(230, 0.3, 230, mat(0x8fa86a), 731, 0, -465, { cast: false }));
    clouds(world, { count: 10, area: [-3500, -3500, 3500, 3000], y: [1300, 1800], size: 190, color: 0xffe9c8, self: 0.55, rand: rng(3) });

    return { world, path, focus, duration: 50 };
  },
};
