// San Francisco at sunset: past Alcatraz towards the fog pouring through the Golden Gate, down the length of the bridge between its towers,
// then low over the Painted Ladies and up California Street with the cable cars, to the towers of downtown and the Bay Bridge.
import { THREE, mergeGeometries, createWorld, rng, fbm, lerp, smooth, mat, glowMat, facadeMat, box, cyl, mesh, tube, lathe, instances, buildings, cityGrid, terrain, water, trees, lights, traffic, suspensionBridge, clouds, clearance } from '../kit.js';

const TAU = Math.PI * 2;
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const C = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0).rotateY(Math.PI / seg);
/** A square beam between two points, as a geometry. */
function beamG(a, b, t) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), o = new THREE.Object3D();
  o.position.copy(A).lerp(Bv, 0.5); o.lookAt(Bv); o.updateMatrix();
  return new THREE.BoxGeometry(t, t, A.distanceTo(Bv)).applyMatrix4(o.matrix);
}
/** Collects static pieces that share a material and merges them into one mesh. `tint` paints the piece (for piles drawn with vertex colours). */
function pile(material) {
  const list = [];
  return {
    add(g, x = 0, y = 0, z = 0, ry = 0, tint) {
      g = g.index ? g.toNonIndexed() : g; if (ry) g.rotateY(ry); g.translate(x, y, z);
      if (tint !== undefined) { const c = new THREE.Color(tint), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
      list.push(g); return this;
    },
    geo() { return mergeGeometries(list); },
    mesh(o) { return mesh(mergeGeometries(list), material, 0, 0, 0, o); },
  };
}

export default {
  build() {
    const r = rng(1937);
    const world = createWorld({
      sky: { top: 0x1d3f8e, horizon: 0xffa35c, bottom: 0x7d6f78, haze: 0.5 },
      sun: { dir: [-0.9, 0.14, -0.34], color: 0xffa25c, power: 3.0, disc: 0xffcf9a, size: 0.0016 },
      ambient: { sky: 0x8f9dcc, ground: 0x6a5446, power: 1.0 },
      fog: { color: 0xeaa67c, density: 0.00027 }, exposure: 1.0, env: 0.9,
    });
    const path = [[1300, 85, -722], [1160, 84, -748], [860, 84, -800], [400, 92, -880], [120, 92, -870], [0, 78, -740], [0, 68, -600], [0, 66, -200], [0, 70, 540], [0, 76, 720], [200, 82, 930], [760, 62, 1030], [1020, 72, 1062], [1270, 112, 1225], [1530, 132, 1250], [1800, 114, 1250]];
    const focus = [[0.07, 900, 30, -545], [0.13, 900, 30, -545], [0.22, 0, 100, -300], [0.3, 0, 80, 900], [0.52, 0, 80, 1100], [0.63, 1000, 36, 1030], [0.7, 1010, 36, 1030], [0.79, 2300, 150, 1250]];
    const clear = clearance(path);

    // ---- the lie of the land: San Francisco's hills to the south, the Marin headlands to the north
    const bump = (x, z, cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);
    const inS = (x, z) => Math.min(z - (715 + 30 * Math.sin(x / 300) - 62 * Math.exp(-((x / 120) ** 2))), x + 640 + 60 * Math.sin(z / 250), 2620 + (z - 1000) * 0.22 - x);
    const hS = (x, z) => {
      const d = inS(x, z); if (d < -40) return -12;
      const hills = bump(x, z, 120, 1230, 330, 300, 80) + bump(x, z, 0, 830, 170, 130, 46) + bump(x, z, 950, 1380, 480, 250, 100) + bump(x, z, 1500, 1170, 240, 230, 96) + bump(x, z, 1850, 880, 95, 95, 66)
        + bump(x, z, 650, 2550, 520, 480, 270) + bump(x, z, -250, 1900, 300, 500, 90) + bump(x, z, 1900, 2500, 420, 300, 60);
      return Math.min(-12 + 16 * smooth(-40, 25, d) + hills * smooth(0, 200, d), clear(x, z, 70) - 36);
    };
    const shoreM = (x) => (x > 100 ? -700 - (x - 100) * 0.8 : -700 + (x - 100) * 0.28);
    const hM = (x, z) => {
      const d = shoreM(x) - z + 50 * (fbm(x / 260, z / 260, 2) - 0.5); if (d < -30) return -12;
      const ridge = 1 - Math.abs(2 * fbm(x / 800 + 3, z / 800, 3) - 1);
      return Math.min(-12 + 12 * smooth(-30, 0, d) + 48 * smooth(0, 80, d) + smooth(60, 650, d) * (40 + 250 * ridge * ridge) + (40 * (1 - Math.abs(2 * fbm(x / 210, z / 210, 3) - 1)) + 14 * fbm(x / 70, z / 70, 2)) * smooth(30, 320, d), clear(x, z, 90) - 30);
    };
    const NS = (k) => 500 + 80 * k, EW = (j) => 800 + 150 * j;          // the street grid of the Victorian hills
    const park = (x, z) => x > 826 && x < 974 && z > 956 && z < 1094;   // Alamo Square
    const tc = new THREE.Color(), t2 = new THREE.Color();
    world.add(terrain({ size: [5400, 2600], center: [1200, 1960], seg: 220, height: hS, color: (x, y, z, slope) => {
      if (y < 2.5) return 0xb8a27c;
      const n = fbm(x / 140, z / 140, 3);
      if (park(x, z) || (x < 480 && z < 1560) || y > 150) return tc.set(0x587a40).lerp(t2.set(0x8a9450), n);
      return slope > 0.3 ? 0x8a7a66 : tc.set(0x8d877c).lerp(t2.set(0x7c8a58), 0.3 + n * 0.7);
    } }));
    world.add(terrain({ size: [5600, 2400], center: [0, -1840], seg: 190, height: hM, color: (x, y, z, slope) => (y < 3 ? 0x6a5c4c : slope > 0.33 ? tc.set(0x7d6850).lerp(t2.set(0x5e5346), fbm(x / 60, z / 60, 2)) : tc.set(0xc9a258).lerp(t2.set(0x6c7a3e), smooth(0.38, 0.62, fbm(x / 170, z / 170, 3)))) }));
    water(world, 0, { color: 0x2c4a5e, rough: 0.14, strength: 0.3 });

    // ---- the Golden Gate Bridge in International Orange (seven tenths of life size), along x = 0 from Marin (north) to the city
    const orangeM = mat(0xc63a26, { rough: 0.55 }), GG = pile(orangeM), concrete = pile(mat(0xa69c8e, { rough: 0.9 })), roadM = mat(0x3c3d42, { rough: 0.85 });
    const DECK = 50, TOP = 165, LX = 18, TZ = 450, END = 700, lamps = [], beacons = [];
    for (const zt of [-TZ, TZ]) {
      for (const s of [-1, 1]) {
        // each leg steps in as it rises, with raised ribs on every face: the Art Deco fluting
        for (const [y, h, w, d] of [[-4, 54, 9, 13], [50, 39, 8, 12], [89, 27, 7, 10.6], [116, 24.5, 6.2, 9.4], [140.5, 24.5, 5.4, 8.4]]) {
          GG.add(B(w, h, d), s * LX, y, zt);
          for (const e of [-1, 1]) GG.add(B(w * 0.46, h - 0.8, 0.9), s * LX, y, zt + e * d / 2).add(B(0.9, h - 0.8, d * 0.46), s * LX + e * w / 2, y, zt);
        }
        GG.add(B(4.2, 3, 6.6), s * LX, 165, zt).add(B(2.8, 2.6, 4.4), s * LX, 168, zt); beacons.push([s * LX, 172, zt]);
        GG.add(beamG([-s * LX, 3, zt], [s * LX, 45, zt], 1.8)).add(beamG([-s * LX, 3, zt - 4], [s * LX, 45, zt - 4], 1.2));
      }
      // the portal struts: stepped panels with vertical fluting and corbelled corners
      for (const [y, h, d] of [[86, 6, 9.6], [113, 5, 8.6], [138, 4.6, 7.6], [159, 6, 6.8]]) {
        GG.add(B(LX * 2, h, d), 0, y, zt).add(B(LX * 2 - 8, 1.6, d + 1), 0, y - 1.2, zt).add(B(LX * 2, 1, d + 1.2), 0, y + h - 0.6, zt);
        for (let i = -3; i <= 3; i++) GG.add(B(1.3, h + 1.2, d + 1.6), i * 4.1, y - 0.6, zt);
        for (const s of [-1, 1]) GG.add(B(3, 3.4, d), s * (LX - 5.4), y - 3.4, zt).add(B(1.8, 2.4, d), s * (LX - 7.6), y - 2.4, zt);
      }
      GG.add(B(LX * 2, 2.4, 9), 0, 22, zt).add(B(LX * 2, 3, 11), 0, 44.5, zt); concrete.add(B(66, 13, 36), 0, -6, zt).add(B(58, 3, 30), 0, 7, zt);
    }
    // main cables, suspenders, the stiffening truss under the roadway
    const cableY = (z) => { const a = Math.abs(z); if (a <= TZ) return DECK + 5 + (TOP - DECK - 5) * (a / TZ) ** 2; const u = (a - TZ) / (END - TZ); return lerp(TOP, DECK + 3, u) - 9 * Math.sin(Math.PI * u); };
    const cpts = []; for (let z = -END; z <= END; z += 25) cpts.push(z); const iron = [];
    for (const s of [-1, 1]) {
      world.add(tube(cpts.map((z) => [s * LX, cableY(z), z]), 0.8, orangeM, { seg: 160, tension: 0.2 }));
      for (let z = -END + 12.5; z < END; z += 12.5) if (Math.abs(Math.abs(z) - TZ) > 8) iron.push({ x: s * LX, y: DECK, z, sx: 0.28, sy: cableY(z) - DECK, sz: 0.28 });
      for (let z = -END; z < END; z += 14) iron.push({ x: s * 15.5, y: DECK - 8, z, sx: 0.7, sy: 9.9, sz: 0.7, rx: Math.PI / 4 }, { x: s * 15.5, y: DECK - 8, z: z + 14, sx: 0.7, sy: 9.9, sz: 0.7, rx: -Math.PI / 4 });
      for (let z = -END; z <= END; z += 35) { iron.push({ x: s * 17.2, y: DECK, z, sx: 0.35, sy: 9, sz: 0.35 }); lamps.push([s * 16.6, DECK + 9.2, z]); }
      GG.add(B(1, 1, END * 2), s * 15.5, DECK - 8.6, 0).add(B(1.2, 3.2, END * 2), s * 17.6, DECK - 2, 0).add(B(0.3, 0.3, END * 2), s * 17.6, DECK + 1.9, 0);
      for (const e of [-1, 1]) concrete.add(B(12, 72, 26), s * 27, -6, e * (END + 6)).add(B(8.5, 4, 20), s * 27, 66, e * (END + 6)).add(B(5, 3, 14), s * 27, 70, e * (END + 6));
    }
    for (let z = -END; z <= END; z += 14) iron.push({ x: 0, y: DECK - 8.6, z, sx: 31, sy: 0.8, sz: 0.8 });
    world.add(instances(B(1, 1, 1), orangeM, iron, { cast: false }), GG.mesh(), concrete.mesh());
    world.add(box(34.4, 1.4, END * 2, roadM, 0, DECK - 1.2, 0), box(30, 3, 420, roadM, 0, DECK - 2.8, -END - 210), box(30, 3, 330, roadM, 0, DECK - 2.8, END + 165));
    world.add(instances(B(0.25, 0.06, 5), mat(0xd9d2c0), Array.from({ length: 560 }, (_, i) => ({ x: ((i % 5) - 2) * 5.6, y: DECK + 0.2, z: -END + (i / 5 | 0) * 12.6 })), { cast: false, receive: false }));
    traffic(world, [[-8, DECK + 1.4, -1100], [-8, DECK + 1.4, 1020]], { count: 60, color: 0xff3a28, size: 2.6, speed: 20, spread: 5 });
    traffic(world, [[8, DECK + 1.4, 1020], [8, DECK + 1.4, -1100]], { count: 60, color: 0xfff0d0, size: 2.8, speed: 20, spread: 5 });
    lights(world, lamps, { color: 0xffb060, size: 3, power: 1.2 }); lights(world, beacons, { color: 0xff3020, size: 10, power: 1.3 });

    // ---- the fog bank: pouring in from the ocean, deep to the west, thinning to wisps under the roadway and out into the bay
    const puffs = [], puff = (x, z, top, q) => puffs.push({ x, y: top - q * 0.3 - r.range(0, 14), z, sx: q, sy: q * 0.3, sz: q * r.range(0.6, 1) });
    for (let i = 0; i < 180; i++) { const x = r.range(-3300, -150); puff(x, r.range(-2000, 2000), lerp(112, 44, smooth(-1300, -150, x)), r.range(140, 260)); }
    for (let i = 0; i < 150; i++) { const x = r.range(-250, 820), k = smooth(-250, 820, x); puff(x, r.range(-1, 1) * lerp(760, 220, k) + 60, lerp(42, 15, k), lerp(130, 60, k) * r.range(0.7, 1.2)); }
    const fogM = mat(0xfff0e4, { rough: 1, emissive: 0x9a7c84, glow: 0.55, opacity: 0.92, env: 0 });   // each puff fades out towards its rim, so the bank reads as soft
    fogM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= smoothstep(0.0, 0.7, abs(dot(normalize(vNormal), normalize(vViewPosition))));'); };
    const bank = instances(new THREE.IcosahedronGeometry(1, 2), fogM, puffs, { cast: false, receive: false });
    world.add(bank, mesh(new THREE.PlaneGeometry(2600, 5200).rotateX(-Math.PI / 2), mat(0xfff0e4, { rough: 1, emissive: 0x9a7c84, glow: 0.55, env: 0 }), -2500, 30, 0, { cast: false, receive: false }));
    world.onUpdate((t) => { bank.position.x = 200 * Math.sin(t * 0.012); });

    // ---- Alcatraz: the rock, the cellhouse, the lighthouse, the water tower
    const AX = 900, AZ = -545, rockM = mat(0x8a7860, { rough: 0.95, flat: true });
    const rock = lathe([[150, -8], [147, 3], [139, 15], [126, 25], [104, 31], [60, 34.5], [0, 36]], rockM, AX, 0, AZ, 40, { scale: [1.25, 1, 0.5], ry: 0.25 });
    const rp = rock.geometry.attributes.position; for (let i = 0; i < rp.count; i++) { const j = 1 + 0.3 * (fbm(rp.getX(i) / 34 + 9, rp.getZ(i) / 34, 3) - 0.5); rp.setX(i, rp.getX(i) * j); rp.setZ(i, rp.getZ(i) * j); } rock.geometry.computeVertexNormals();
    const jailM = facadeMat({ color: 0xd8ccb4, floor: 5, bay: 4, frame: [0.3, 0.25], glass: 0x2a2c30, lit: 0.15, night: 0.8 });
    const alc = (dx, dz) => [AX + dx * Math.cos(0.25) + dz * Math.sin(0.25), AZ - dx * Math.sin(0.25) + dz * Math.cos(0.25)];
    world.add(rock, buildings([[0, 0, 120, 30, 15, 35], [-95, 6, 50, 16, 9, 30], [70, -18, 26, 12, 8, 34], [-40, 28, 40, 10, 7, 30], [110, 12, 16, 12, 10, 30]].map(([dx, dz, w, d, h, y]) => ({ x: alc(dx, dz)[0], z: alc(dx, dz)[1], w, d, h, y, ry: 0.25 })), jailM));
    const [lx, lz] = alc(84, 22), white = pile(mat(0xe9e4da, { rough: 0.7 })), dark = pile(mat(0x26262a, { rough: 0.5 }));
    white.add(C(2.3, 3.4, 22, 8), lx, 34, lz).add(C(3, 3, 0.8, 8), lx, 56, lz).add(B(12, 6, 9), lx - 7, 33, lz); dark.add(C(2, 2, 3.2, 8), lx, 56.8, lz).add(C(0.2, 2.4, 2, 8), lx, 60, lz);
    const [wx, wz] = alc(-128, -4); dark.add(C(5, 5, 7, 12), wx, 44, wz).add(C(0.5, 5.2, 2.4, 12), wx, 51, wz); for (let i = 0; i < 4; i++) dark.add(beamG([wx + Math.cos(i * 1.57 + 0.8) * 5.5, 22, wz + Math.sin(i * 1.57 + 0.8) * 5.5], [wx + Math.cos(i * 1.57 + 0.8) * 4, 44, wz + Math.sin(i * 1.57 + 0.8) * 4], 0.6));
    const beam = lights(world, [[lx, 58.4, lz]], { color: 0xfff2c0, size: 30, power: 1.5 });
    world.onUpdate((t) => { beam.material.size = 8 + 36 * Math.max(0, Math.sin(t * 1.5)) ** 6; });
    trees(world, Array.from({ length: 26 }, () => { const [x, z] = alc(r.range(-140, 130), r.range(-40, 44)); return [x, 28, z]; }).filter(([x, , z]) => Math.abs((x - AX) * 0.2 + (z - AZ)) > 26), 'cypress', { size: 13 });

    // ---- the Victorian hills: streets draped over the slopes, rows of pastel houses stepping up them
    const strip = [], ribbon = (x0, z0, x1, z1, w, lift = 0.9) => {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 12), nx = -(z1 - z0), nz = x1 - x0, q = w / 2 / Math.hypot(nx, nz), P = (i, s) => { const x = lerp(x0, x1, i / n) + s * nx * q, z = lerp(z0, z1, i / n) + s * nz * q; return [x, hS(x, z) + lift, z]; };
      for (let i = 0; i < n; i++) strip.push(...P(i, -1), ...P(i, 1), ...P(i + 1, 1), ...P(i, -1), ...P(i + 1, 1), ...P(i + 1, -1));
    };
    for (let k = 0; k <= 17; k++) for (let j = 0; j < 6; j++) if (!(k === 5 && j === 1)) ribbon(NS(k), EW(j), NS(k), EW(j + 1), 16);
    for (let j = 0; j <= 6; j++) ribbon(NS(0), EW(j), j === 3 ? 2640 : NS(17), EW(j), 16, 1.0);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(strip, 3)); sg.computeVertexNormals();
    world.add(mesh(sg, mat(0x5e5f66, { rough: 0.9, side: THREE.DoubleSide }), 0, 0, 0, { cast: false }));
    // one house: body with a bay window and gabled attic, dark roof, white trim and dark or lamplit windows. Its front faces +Z.
    const bodyP = pile(), roofP = pile(), trimP = pile(), tri = new THREE.Shape([[-3.8, 10], [3.8, 10], [0, 13.4]].map(([a, b]) => new THREE.Vector2(a, b)));
    bodyP.add(new THREE.BoxGeometry(7.6, 16, 13).translate(0, 2, -6.5)).add(new THREE.ExtrudeGeometry(tri, { depth: 13, bevelEnabled: false }).translate(0, 0, -13)).add(new THREE.CylinderGeometry(1.9, 1.9, 9, 6).translate(1.7, 5.4, 0.1));
    for (const s of [-1, 1]) roofP.add(new THREE.BoxGeometry(5.6, 0.35, 13.8).rotateZ(-s * 0.73).translate(s * 2, 11.95, -6.5));
    const pane = (w, h, x, y, z, c, ry = 0) => trimP.add(new THREE.PlaneGeometry(w, h).rotateY(ry).translate(x, y, z), 0, 0, 0, 0, c);
    trimP.add(B(8, 0.5, 0.5), 0, 9.8, 0.1, 0, 0xf4efe4).add(B(2.4, 1.6, 2.6), -2.1, 0, 1.2, 0, 0xcfc6b8).add(new THREE.CylinderGeometry(2.15, 2.15, 0.5, 6, 1, true).translate(1.7, 10, 0.1), 0, 0, 0, 0, 0xf4efe4);
    for (const s of [-1, 1]) trimP.add(new THREE.BoxGeometry(5.3, 0.45, 0.5).rotateZ(-s * 0.73).translate(s * 1.95, 11.6, 0.15), 0, 0, 0, 0, 0xf4efe4);
    pane(1.3, 2.5, -2.1, 2.9, 0.03, 0x3a2a22); pane(1.4, 2.3, -2.1, 7, 0.03, 0x232a36); pane(1.1, 1.2, 0, 11.2, 0.03, 0xffd890);
    for (const [y, c] of [[2.9, 0xffd890], [7.2, 0x232a36]]) { pane(1.2, 2.3, 1.7, y, 1.76, c); pane(1.2, 2.3, 3.15, y, 0.93, y > 5 ? 0xffd890 : 0x232a36, Math.PI / 3); pane(1.2, 2.3, 0.25, y, 0.93, 0x232a36, -Math.PI / 3); }
    const pastel = [0xf2d98c, 0xe9b7a0, 0xa9c6d8, 0xb9d6b0, 0xe8e2d0, 0xd7b0c8, 0xf0c27a, 0x9fbfb6, 0xdfa58c, 0xc8c2e0, 0xf5efe2, 0x8fb0c8];
    const nearPath = clearance(path.slice(10)), homes = [], plain = [], flats = [], shade = [];
    for (let k = 0; k < 17; k++) for (let j = 0; j < 6; j++) if (!((k === 4 || k === 5) && j === 1)) for (const side of [-1, 1]) for (let i = 0; i < 17; i++) {
      const x = side < 0 ? NS(k) + 8.5 : NS(k + 1) - 8.5, z = EW(j) + 14.2 + i * 7.6, y = Math.min(hS(x, z), hS(x - side * 13, z)) - 0.6, near = nearPath(x, z, 160) < Infinity;
      if (y < 2) continue;
      const lot = { x: x - side * 6.5, z, y: y - 6, w: 13, d: 7.6, color: r.pick(pastel) };
      if (r.chance(0.28)) flats.push({ ...lot, h: r.range(15, 21) });                       // a flat-fronted Edwardian among the gables
      else if (near) homes.push({ x, y, z, ry: side * Math.PI / 2, color: lot.color, sy: r.range(0.92, 1.18) });
      else plain.push({ ...lot, h: 16.5 });
      if (near && i % 6 === 2) shade.push(r.chance(0.5) ? [x + side * 5, y, z, 0.6] : [x - side * 24, hS(x - side * 24, z), z + 3, r.range(0.7, 1.1)]);
    }
    const bare = (h) => ({ ...h, color: undefined });
    world.add(instances(bodyP.geo(), mat(0xffffff, { rough: 0.85 }), homes), instances(roofP.geo(), mat(0x6e6266, { rough: 0.8 }), homes.map(bare), { cast: false }), instances(trimP.geo(), mat(0xffffff, { rough: 0.7, vertexColors: true }), homes.map(bare), { cast: false }));
    const plainM = facadeMat({ floor: 4.2, bay: 3.8, frame: [0.3, 0.25], glass: 0x232a36, lit: 0.4, litColor: 0xffd890, night: 0.9 });
    world.add(buildings([...plain, ...flats], plainM), instances(new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), mat(0x6e6266), plain.map((h) => ({ x: h.x, y: h.y + 16.5, z: h.z, sx: 13, sy: 3.4, sz: 7.6 })), { cast: false }));
    trees(world, shade, 'round', { size: 8, color: [0x4d7a3a, 0x5c8a40, 0x6f8f3c] });
    // cable cars climbing California Street
    const carM = [mat(0x7a1c1c, { rough: 0.6 }), mat(0xe8dcb8, { rough: 0.7 }), mat(0x2a2422)], cars = [0, 1, 2].map((i) => {
      const g = new THREE.Group(); g.add(box(8.6, 1.5, 2.7, carM[0], 0, 0.5, 0), box(4, 1.3, 2.6, carM[1], -2.3, 2, 0), box(9, 0.3, 2.9, carM[1], 0, 3.3, 0), box(5.2, 0.25, 1.4, carM[0], 0, 3.6, 0), box(8, 0.5, 2.2, carM[2], 0, 0, 0));
      for (const x of [-4.2, -0.3, 1.8, 4.2]) g.add(box(0.2, 1.4, 2.7, carM[0], x, 2, 0));
      world.add(g); return g;
    });
    world.onUpdate((t) => cars.forEach((g, i) => {
      const dir = i === 1 ? -1 : 1, x = 1120 + (((i * 290 + t * 7 * dir) % 800) + 800) % 800, z = 1250 + dir * 3;
      g.position.set(x, hS(x, z) + 1.2, z); g.rotation.z = Math.atan((hS(x + 4, z) - hS(x - 4, z)) / 8);
    }));

    // ---- the rest of the city: low pastel blocks over the hills, towers downtown
    const downtown = (x, z) => x > 1950 && z > 880 && z < 1960;
    const low = cityGrid({ rand: rng(5), area: [-620, 740, 2700, 3200], block: 46, street: 16, palette: pastel, jitter: 0.3,
      keep: (x, z) => inS(x, z) > 30 && !(x > 470 && x < 1880 && z > 780 && z < 1720) && !(x < 480 && z < 1560) && !downtown(x, z) && hS(x, z) < 150 && Math.abs(x) > 40,
      height: () => r.range(9, 17) });
    low.forEach((b) => { b.y = hS(b.x, b.z) - 7; b.h += 7; });
    const lids = (list) => list.map((b) => ({ x: b.x, z: b.z, y: (b.y ?? 0) + b.h, w: b.w, d: b.d, h: 0.7, ry: b.ry }));
    const glassM = facadeMat({ floor: 4, bay: 2.6, frame: [0.1, 0.16], glass: 0x1e3044, lit: 0.45, litColor: 0xffe2b0, night: 1.2, rough: 0.4, metal: 0.3 });
    const stoneM = facadeMat({ floor: 3.8, bay: 3, frame: [0.28, 0.25], glass: 0x20242c, lit: 0.45, litColor: 0xffd090, night: 1.2, rough: 0.85 });
    const core = (x, z) => Math.exp(-(((x - 2330) / 260) ** 2) - ((z - 1400) / 330) ** 2);
    const tall = cityGrid({ rand: rng(6), area: [1960, 890, 2700, 1960], block: 52, street: 20, jitter: 0.35, split: 0.3,
      keep: (x, z) => inS(x, z) > 40 && Math.abs(z - 1250) > 28 && Math.hypot(x - 2150, z - 1050) > 60 && Math.hypot(x - 2390, z - 1440) > 62,
      height: (x, z) => Math.min(24 + 210 * core(x, z) * r.range(0.4, 1.1), clear(x, z, 100) - 30) });
    const gl = [], st = []; for (const b of tall) { b.y = -2; b.h += 2; if (b.h > 90 && r.chance(0.65)) { b.color = r.pick([0x8fa3b8, 0xa9b6c2, 0x6f8fb0, 0xb9c2c8, 0x86a6b4]); gl.push(b); } else { b.color = r.pick([0xd8c9b0, 0xc9b8a4, 0xe2d8c6, 0xb5a696, 0xa9907a]); st.push(b); } }
    world.add(buildings(gl, glassM), buildings(st, stoneM), buildings(low, plainM), buildings(lids([...low, ...gl, ...st, ...flats]), mat(0x6c6a70, { rough: 0.9 }), { cast: false }));
    // the Transamerica Pyramid
    const pyrM = facadeMat({ color: 0xe9e3d6, floor: 4, bay: 2.6, frame: [0.22, 0.3], glass: 0x2c3440, lit: 0.4, litColor: 0xffe0b0, night: 1.1, rough: 0.7 });
    world.add(cyl(1.6, 38, 232, pyrM, 2150, 0, 1050, 4), cyl(0.1, 1.6, 30, mat(0xd9dde0, { metal: 0.7, rough: 0.3 }), 2150, 232, 1050, 4), box(6, 100, 9, pyrM, 2142.5, 112, 1050), box(6, 100, 9, pyrM, 2157.5, 112, 1050), box(64, 8, 64, pyrM, 2150, 0, 1050));
    lights(world, [[2150, 263, 1050]], { color: 0xfff0d0, size: 16, power: 1.6 });
    // the Salesforce Tower: a rounded glass obelisk with a glowing crown
    const sf = lathe([[27, 0], [27, 190], [25.6, 232], [22.5, 265], [18, 288], [14.5, 300], [0, 300]], facadeMat({ color: 0xa7bccc, floor: 4.2, bay: 2.4, frame: [0.07, 0.12], glass: 0x223a54, lit: 0.4, night: 1.1, rough: 0.25, metal: 0.45, round: 30 }), 2390, 0, 1440, 40);
    const sp = sf.geometry.attributes.position; for (let i = 0; i < sp.count; i++) { const a = Math.atan2(sp.getZ(i), sp.getX(i)), q = (Math.abs(Math.cos(a)) ** 5 + Math.abs(Math.sin(a)) ** 5) ** -0.2; sp.setX(i, sp.getX(i) * q); sp.setZ(i, sp.getZ(i) * q); } sf.geometry.computeVertexNormals();
    world.add(sf, cyl(16, 22, 30, glowMat(0xffd9a8, 0.9, { opacity: 0.5 }), 2390, 268, 1440, 4, { cast: false }));
    // Coit Tower on Telegraph Hill, the Ferry Building at the foot of the street, Sutro Tower on Twin Peaks
    white.add(C(7, 8.4, 52, 16), 1850, hS(1850, 880), 880).add(C(7.8, 7.8, 3, 16), 1850, hS(1850, 880) + 52, 880).add(C(5.8, 6.4, 7, 16), 1850, hS(1850, 880) + 55, 880);
    white.add(B(30, 16, 210), 2650, 0, 1250).add(B(11, 50, 11), 2646, 16, 1250).add(B(8, 12, 8), 2646, 66, 1250).add(C(0.4, 5.6, 9, 4), 2646, 78, 1250); dark.add(new THREE.CircleGeometry(4, 20).rotateY(-Math.PI / 2), 2640.4, 56, 1250);
    const sutro = pile(mat(0xd4553a, { rough: 0.6 })), SY = hS(650, 2550);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3, P = (q, y) => [650 + Math.cos(a) * q, SY + y, 2550 + Math.sin(a) * q], Q = (q, y) => [650 + Math.cos(a + TAU / 3) * q, SY + y, 2550 + Math.sin(a + TAU / 3) * q];
      sutro.add(beamG(P(34, 0), P(9, 120), 3.4)).add(beamG(P(9, 120), P(17, 215), 2.6)).add(beamG(P(17, 215), P(17, 290), 1.2));
      for (const [q, y] of [[26, 38], [17, 80], [9, 120], [13, 168], [17, 215]]) sutro.add(beamG(P(q, y), Q(q, y), 1.6));
      beacons.push(P(17, 290));
    }
    lights(world, beacons.slice(-3), { color: 0xff3020, size: 12, power: 1.3 });
    world.add(sutro.mesh(), white.mesh(), dark.mesh());

    // ---- the Bay Bridge in the distance, with its string of lights, and Yerba Buena Island
    const bay = suspensionBridge({ length: 1560, towerH: 150, deckY: 56, width: 24, color: 0x8d979c, towers: [-560, -190, 190, 560], cable: 0.7, deckThick: 7 });
    bay.position.set(3380, 0, 1120); bay.rotation.y = 0.24; world.add(bay);
    const bl = []; for (let x = -780; x <= 780; x += 22) bl.push([3380 + Math.cos(0.24) * x, 60, 1120 - Math.sin(0.24) * x]);
    lights(world, bl, { color: 0xfff2d8, size: 6, power: 1.2 });
    world.add(lathe([[330, -6], [300, 20], [220, 62], [110, 92], [0, 100]], mat(0x4e5a3c, { rough: 0.95, flat: true }), 4350, 0, 880, 14, { scale: [1.2, 1, 0.8] }), box(1400, 7, 24, mat(0x9aa0a2), 5300, 46, 640, { ry: 0.24 }));

    // ---- trees, boats, a container ship heading for the Gate, the first lights of evening
    const forest = []; for (let i = 0; i < 700; i++) { const x = r.range(-560, 470), z = 740 + 800 * r() ** 1.5, y = hS(x, z); if (y > 4 && Math.abs(x) > 34) forest.push([x, y - 0.5, z]); }
    trees(world, forest, 'conifer', { size: 17, color: [0x2c4a30, 0x355636, 0x27402c, 0x415e38] });
    const green = []; for (let i = 0; i < 46; i++) { const x = r.range(832, 968), z = r.range(962, 1088); green.push([x, hS(x, z), z]); }
    for (let x = 1980; x < 2600; x += 22) green.push([x, 1.2, 1238], [x, 1.2, 1262]);
    trees(world, green, 'round', { size: 9 });
    trees(world, Array.from({ length: 40 }, (_, i) => [2620 + (i * 24 - 480) * 0.22, 1.5, 1000 + i * 24 - 480 + 480]), 'palm', { size: 12 });
    const boat = mergeGeometries([new THREE.BoxGeometry(2.6, 1.4, 9).translate(0, 0.5, 0), new THREE.ConeGeometry(3.4, 12, 3).scale(0.06, 1, 1).translate(0, 7.4, 0.6)]);
    world.add(instances(boat, mat(0xf4efe6, { rough: 0.6 }), Array.from({ length: 44 }, () => ({ x: r.range(250, 3000), y: 0, z: r.range(-560, 640), ry: r.range(-0.5, 0.5) + 1.3, s: r.range(0.9, 1.5) })).filter((b) => Math.hypot(b.x - AX, b.z - AZ) > 240)));
    const ship = new THREE.Group(), boxes = [];
    for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) for (let y = 0; y < r.int(2, 4); y++) boxes.push({ x: -92 + i * 11.4, y: 10 + y * 2.9, z: (k - 1.5) * 6.6, w: 11, h: 2.8, d: 6.2, color: r.pick([0xb5432c, 0x2f6a8c, 0xd9a03a, 0x3c7a52, 0x8c8f94, 0xc96a2c]) });
    ship.add(box(236, 14, 30, mat(0x1f2c3c, { rough: 0.6 }), 0, -4, 0), box(238, 2, 30.4, mat(0x8a2f24), 0, -1, 0), buildings(boxes, mat(0xffffff, { rough: 0.7 })), box(14, 22, 26, mat(0xeeeae2), 104, 10, 0), box(5, 8, 6, mat(0xc23a26), 106, 32, 0));
    world.add(ship); world.onUpdate((t) => { ship.position.set(560 - t * 4, 0, -560); });
    const glow = []; for (let k = 0; k <= 17; k += 1) for (let z = 815; z < 1700; z += 37.5) glow.push([NS(k) + 7, hS(NS(k), z) + 7, z]);
    for (let x = 500; x < 2640; x += 30) glow.push([x, hS(x, 1250) + 7, 1258]);
    lights(world, glow, { color: 0xffbe78, size: 3, power: 1.1 });
    traffic(world, [[2640, 2.2, 1246], [1960, 2.2, 1246]], { count: 16, color: 0xfff0d0, size: 2.6, speed: 9 });
    traffic(world, [[2700, 2, 1900], [2620, 2, 1000], [2400, 2, 790], [1700, 2, 740], [700, 2, 748]], { count: 50, color: [0xfff0d0, 0xff4030], size: 2.8, speed: 12, spread: 3 });
    clouds(world, { count: 10, y: [1900, 2500], size: 260, color: 0xf3a27a, self: 0.4, rand: rng(3), area: [-3500, -3500, 3500, 3500] });

    return { world, path, focus, duration: 50 };
  },
};
