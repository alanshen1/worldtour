// Melbourne on a clear morning: in past the MCG, low along the Yarra among the rowing eights, up over Princes Bridge to the dome of
// Flinders Street Station, along its ochre front above the trams to the clock tower, then across to Southbank, the Eureka Tower and the Arts Centre spire.
import { THREE, mergeGeometries, createWorld, rng, mat, glowMat, facadeMat, mesh, box, cyl, sphere, lathe, prism, tube, beam, instances, buildings, cityGrid, terrain, water, trees, clouds, clearance, smooth, fbm } from '../kit.js';

// merges meshes that share a material into one mesh each, so a detailed landmark costs a handful of draw calls
function bake(list, at = [0, 0, 0], ry = 0) {
  const by = new Map();
  for (const o of list.flat()) {
    o.updateMatrix(); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry).applyMatrix4(o.matrix);
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g);
  }
  return [...by].map(([m, gs]) => mesh(mergeGeometries(gs), m, ...at, { ry }));
}
// merges plain geometries into one, each tinted with its own colour (for a vertexColors material)
function fuse(parts) {
  return mergeGeometries(parts.map(([g, c]) => {
    g = g.index ? g.toNonIndexed() : g; const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) k.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  }));
}
const G = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// a box whose top is drawn in by ix, iz on each side (mansard and hipped roofs)
function taperBox(w, h, d, ix, iz = ix) {
  const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2) { p.setX(i, p.getX(i) - Math.sign(p.getX(i)) * ix); p.setZ(i, p.getZ(i) - Math.sign(p.getZ(i)) * iz); }
  g.computeVertexNormals(); return g;
}
const gable = (w, h, d) => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
// a stone bridge on low arches along X: deck top at y=0, water 7 m below
function archBridge(L, W, n, stone, trim) {
  const s = new THREE.Shape(), span = L / n, rx = span * 0.42; s.moveTo(-L / 2, 0); s.lineTo(-L / 2, -9);
  for (let i = 0; i < n; i++) { const cx = -L / 2 + span * (i + 0.5); s.lineTo(cx - rx, -9); s.lineTo(cx - rx, -5.6); s.absellipse(cx, -5.6, rx, 4.2, Math.PI, 0, true); s.lineTo(cx + rx, -9); }
  s.lineTo(L / 2, -9); s.lineTo(L / 2, 0);
  const out = [mesh(new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -W / 2), stone)];
  for (const z of [-1, 1]) {
    out.push(box(L, 1.3, 0.7, trim, 0, 0, z * (W / 2 - 0.4)), box(L, 0.5, 1.2, trim, 0, -1.2, z * (W / 2)));
    for (let i = 0; i <= n; i++) { const x = -L / 2 + span * i; out.push(box(2.6, 2.4, 2.2, trim, x, 0, z * (W / 2 - 0.4)), cyl(0.14, 0.2, 4.2, stone, x, 2.4, z * (W / 2 - 0.4), 6), sphere(0.55, trim, x, 7, z * (W / 2 - 0.4), { seg: 8, rows: 6 })); }
  }
  return out;
}

export default {
  build() {
    const r = rng(3000);
    const world = createWorld({
      sky: { top: 0x2c6fd6, horizon: 0xcfe5f6, bottom: 0x9fb8c8, haze: 0.6 },
      sun: { dir: [0.6, 0.74, -0.5], color: 0xfff3dc, power: 3.2, disc: 0xfffbe8, size: 0.0005 },
      ambient: { sky: 0xcfe2ff, ground: 0x7a7466, power: 1.25 },
      fog: { color: 0xcfe2f2, density: 0.00032 }, exposure: 1.0, env: 0.8,
    });
    // north is -Z, east is +X. The Yarra runs along X (bending south to the east); ground is y=0 and the river lies 7 m below it.
    const zc = (x) => 90 * smooth(700, 1500, x);
    const path = [[1650, 60, -60], [1250, 46, -170], [1010, 22, 14], [700, 9, 0], [330, 9, 0], [140, 30, -80], [30, 34, -140], [-80, 29, -146], [-325, 29, -144], [-425, 42, -70], [-430, 64, 90], [-300, 86, 185], [-150, 92, 160], [60, 86, 120], [330, 72, 40], [560, 60, -90]];
    const focus = [[0.09, 980, 25, -400], [0.19, 980, 25, -400], [0.27, 500, 0, 0], [0.4, -28, 25, -108], [0.53, -28, 30, -108], [0.58, -190, 12, -112], [0.61, -338, 30, -100], [0.67, -340, 180, 300], [0.74, -75, 110, 240]];
    const clear = clearance(path);

    // ---- river, banks (paved in town, grass to the east), roads
    water(world, -7, { size: [6400, 700], x: 0, z: 60, color: 0x53604a, rough: 0.14, ripple: 36, strength: 0.24 });
    const bank = (side, xa, xb, color) => { const o = []; for (let x = xa; x < xb; x += 50) o.push([x, zc(x) + side * 45]); o.push([xb, zc(xb) + side * 45], [xb, side * 3200], [xa, side * 3200]); return prism(o, 9, mat(color), 0, -9, 0, { cast: false }); };
    world.add(bank(-1, -3200, 200, 0x8d8e88), bank(1, -3200, 20, 0x8d8e88), bank(1, 20, 200, 0x5f8f45));
    // parkland east of the city: sloping river banks, the rolling Domain with the Shrine's mound and the gardens' lake
    const M = [980, -400], lakeD = (x, z) => Math.hypot((x - 930) / 1.6, z - 560);
    const land = (x, z) => {
      const d = z - zc(x), south = smooth(70, 240, d) * smooth(230, 480, x);
      const h = south * ((fbm(x / 240, z / 240, 3) - 0.3) * 20 + 16 * Math.exp(-((x - 430) ** 2 + (z - 520) ** 2) / 26000)) * smooth(70, 130, lakeD(x, z));
      return -9 + (Math.max(h, 0) + 9) * smooth(38, 62, Math.abs(d));
    };
    const gA = new THREE.Color(0x5f8f45), gB = new THREE.Color(0x7fa64f), gC = new THREE.Color(0x4a7a3c), tmp = new THREE.Color();
    world.add(terrain({ size: [3000, 3600], center: [1700, 0], seg: 180, height: land, color: (x, y, z) => y < -6 ? tmp.set(0x4a4f3c) : tmp.copy(gA).lerp(fbm(x / 70, z / 70, 3) > 0.5 ? gB : gC, smooth(200, 320, x) * Math.abs(fbm(x / 70, z / 70, 3) - 0.5) * 2.6) }));
    world.add(mesh(new THREE.CircleGeometry(82, 40).rotateX(-Math.PI / 2).scale(1.6, 1, 1), mat(0x3f6a78, { rough: 0.12, metal: 0.4 }), 930, 0.3, 560, { cast: false }));
    const asphalt = mat(0x6c6f72), paving = mat(0xb8a98c);
    world.add(box(1500, 0.2, 1190, asphalt, -205, 0, -707, { cast: false }));                     // the city grid's streets
    world.add(box(34, 0.24, 1100, asphalt, 0, 0, 600, { cast: false }));                           // St Kilda Road
    world.add(box(900, 0.2, 26, paving, -430, 0, 58, { cast: false }));                            // Southbank promenade

    // ---- Flinders Street Station (front faces north onto the street; the domed entrance faces the corner, north-east)
    const ochre = facadeMat({ color: 0xe0a637, floor: 4.6, bay: 3.3, frame: [0.3, 0.22], glass: 0x2b2f30, rough: 0.85, ground: 5.2 });
    const ochreP = mat(0xe0a637), red = mat(0x9c3a2a), cream = mat(0xf1e4c2), copper = mat(0x5fa88e, { rough: 0.6 }), slate = mat(0x4f5d58, { rough: 0.7 });
    const dark = mat(0x1c2125, { rough: 0.3, metal: 0.4 }), gold = mat(0xd9b24a, { metal: 0.7, rough: 0.35 }), zinc = mat(0x9aa3a6, { rough: 0.5, metal: 0.3 }), white = mat(0xf7f4ea, { rough: 0.6 });
    const shop = facadeMat({ color: 0x9c3a2a, floor: 5.2, bay: 5, frame: [0.14, 0.2], glass: 0x1a1d20, rough: 0.8 });
    const copperDome = (rad, h, x, y, z, seg = 16) => [lathe([[rad, 0], [rad * 1.03, h * 0.08], [rad * 0.97, h * 0.3], [rad * 0.82, h * 0.56], [rad * 0.58, h * 0.78], [rad * 0.3, h * 0.93], [rad * 0.16, h]], copper, x, y, z, seg), cyl(0.06 * rad, 0.14 * rad, h * 0.5, gold, x, y + h, z, 6)];
    const clock = (rad, x, y, z, ry) => [mesh(new THREE.CircleGeometry(rad, 24), white, x, y, z, { ry }), mesh(new THREE.TorusGeometry(rad, rad * 0.09, 6, 24), dark, x, y, z, { ry }),
      mesh(G(rad * 0.09, rad * 0.8, 0.12, 0, rad * 0.4, 0.1), dark, x, y, z, { ry, rz: -0.5 }), mesh(G(rad * 0.11, rad * 0.55, 0.12, 0, rad * 0.27, 0.1), dark, x, y, z, { ry, rz: 2.1 })];
    const St = [], bands = [4.6, 9.2, 13.8, 18.4], train = mat(0x3f6fb0, { metal: 0.3, rough: 0.5 });
    St.push(box(282, 19, 24, ochre, -189, 0, -100), box(282.6, 5, 24.6, shop, -189, 0, -100), mesh(taperBox(282, 6.5, 24, 3, 7.5), slate, -189, 19.4, -100));
    for (const y of bands) St.push(box(283, 0.75, 25, red, -189, y, -100));
    St.push(box(283.4, 1, 25.4, cream, -189, 19, -100), box(270, 0.35, 5.5, mat(0x70342a), -189, 4.7, -115));              // cornice, street verandah
    for (let x = -322; x <= -56; x += 7) St.push(cyl(0.12, 0.12, 4.7, dark, x, 0, -117.4, 5));
    for (let x = -310; x <= -66; x += 9.9) St.push(mesh(taperBox(2.4, 3, 2, 0.5, 0.9), slate, x, 20.3, -109.4), box(1.3, 1.6, 0.3, cream, x, 20.6, -110.6));   // dormers
    for (const x of [-98, -168, -238, -300]) {                                                                             // pavilions with gables and arched windows
      St.push(box(22, 23, 5, ochre, x, 0, -113.5), box(22.6, 5, 5.6, shop, x, 0, -113.5), mesh(gable(22, 7, 5), ochreP, x, 23, -113.5), mesh(gable(24, 8, 1).translate(0, 0, -2.6), red, x, 23, -113.5).translateY(-0.4));
      for (const y of bands) St.push(box(22.8, 0.75, 6, red, x, y, -113.5));
      St.push(mesh(new THREE.CircleGeometry(4.2, 20, 0, Math.PI), dark, x, 14.2, -116.25, { ry: Math.PI }), mesh(new THREE.TorusGeometry(4.5, 0.6, 6, 20, Math.PI), red, x, 14.2, -116.2, { ry: Math.PI }));
      for (const s of [-1, 1]) St.push(box(2.6, 27, 2.6, ochreP, x + s * 11, 0, -115), ...copperDome(1.7, 3, x + s * 11, 27, -115, 8));
    }
    for (let k = 0; k < 6; k++) {                                                                                          // platform canopies and trains behind
      St.push(box(330, 0.5, 5.6, zinc, -175, 6.2, -84 + k * 7.2));
      if (k % 2 === 0) St.push(box(140, 3.3, 2.9, train, -120 - k * 30, 0.7, -80.4 + k * 7.2), box(140.2, 0.9, 2.95, dark, -120 - k * 30, 2.3, -80.4 + k * 7.2));
    }
    St.push(box(46, 12, 60, ochre, -24, 0, -66), box(46.6, 5, 60.6, shop, -24, 0, -66), box(47, 0.75, 61, red, -24, 9.2, -66), box(47.4, 1, 61.4, cream, -24, 12, -66), mesh(taperBox(46, 4, 60, 8, 4), slate, -24, 12.6, -66));   // the Swanston Street wing
    St.push(box(760, 6, 34, mat(0x62666a), -720, 0, -72));                                                                  // the rail viaduct running west
    // the clock tower at the west end
    const T = [-338, -100];
    St.push(box(11, 31, 11, ochre, T[0], 0, T[1]), box(11.6, 5, 11.6, red, T[0], 0, T[1]), box(13, 9, 13, ochreP, T[0], 31, T[1]), box(14.4, 1.2, 14.4, cream, T[0], 40, T[1]), box(13.6, 0.9, 13.6, red, T[0], 31, T[1]));
    for (const y of [...bands, 23, 27.6]) St.push(box(11.7, 0.75, 11.7, red, T[0], y, T[1]));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; St.push(...clock(3.3, T[0] + Math.sin(a) * 6.56, 35.6, T[1] + Math.cos(a) * 6.56, a), box(2, 4.6, 2, ochreP, T[0] + Math.sin(a + 0.785) * 8.6, 41, T[1] + Math.cos(a + 0.785) * 8.6), ...copperDome(1.4, 2.6, T[0] + Math.sin(a + 0.785) * 8.6, 45.6, T[1] + Math.cos(a + 0.785) * 8.6, 8)); }
    St.push(cyl(4.6, 5, 6, ochreP, T[0], 41.2, T[1], 8), cyl(5.4, 5.4, 0.8, red, T[0], 47, T[1], 8), ...copperDome(5, 7.5, T[0], 47.8, T[1]));
    world.add(...bake(St));
    // the corner entrance, built facing +Z and then turned to the north-east: great arch, the row of clocks, turrets, the copper dome
    const D = [], glassArch = mat(0x2d4a5c, { rough: 0.2, metal: 0.5 });
    D.push(box(37, 22, 28, ochre, 0, 0, 0), box(37.6, 5, 28.6, red, 0, 0, 0), box(38.4, 1.4, 29.4, cream, 0, 22, 0), box(26, 4.5, 6, ochreP, 0, 23.4, 11), mesh(gable(26, 5, 6), red, 0, 27.9, 11));
    for (const y of [9.2, 13.8, 18.4, 21.3]) D.push(box(37.8, 0.75, 28.8, red, 0, y, 0));
    D.push(mesh(new THREE.CircleGeometry(9, 32, 0, Math.PI), glassArch, 0, 9.6, 14.5), mesh(new THREE.TorusGeometry(9.6, 1, 8, 32, Math.PI), red, 0, 9.6, 14.5), mesh(new THREE.TorusGeometry(10.8, 0.35, 6, 32, Math.PI), cream, 0, 9.6, 14.5));
    for (let i = 1; i < 8; i++) { const a = i * Math.PI / 8; D.push(beam([0, 9.6, 14.6], [Math.cos(a) * 9, 9.6 + Math.sin(a) * 9, 14.6], 0.28, cream)); }
    D.push(mesh(new THREE.TorusGeometry(4.5, 0.16, 5, 24, Math.PI), cream, 0, 9.6, 14.6), box(19.4, 2.8, 0.8, mat(0x3c2a22), 0, 6.5, 14.3), box(18, 5.9, 0.6, dark, 0, 0.6, 14.2), box(20, 0.5, 4, mat(0x70342a), 0, 6.2, 16));
    for (let i = 0; i < 9; i++) D.push(...clock(0.92, (i - 4) * 2.1, 7.9, 14.75, 0));
    for (let i = 0; i < 4; i++) D.push(box(22 + i * 2.4, 0.32, 3 + i * 1.3, paving, 0, 0.96 - i * 0.32, 15 + i * 0.65));
    for (const s of [-1, 1]) { D.push(box(7, 28.5, 7, ochreP, s * 15.4, 0, 11), box(7.6, 5, 7.6, red, s * 15.4, 0, 11), box(8, 1, 8, cream, s * 15.4, 28.5, 11), ...copperDome(3.9, 6.5, s * 15.4, 29.5, 11, 12)); for (const y of [9.2, 13.8, 18.4, 23, 26.5]) D.push(box(7.5, 0.75, 7.5, red, s * 15.4, y, 11)); }
    D.push(cyl(12, 13, 7.5, ochreP, 0, 23.4, -1, 8), cyl(13.2, 13.2, 0.9, red, 0, 26.5, -1, 8), cyl(12.9, 12.9, 1, cream, 0, 30.9, -1, 16), ...copperDome(12.4, 14.5, 0, 31.9, -1, 24));
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; D.push(box(2.2, 3.6, 0.5, dark, Math.sin(a) * 12, 25.4, -1 + Math.cos(a) * 12, { ry: a })); }
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; D.push(tube([[12.4, 0], [12.8, 1.2], [12.1, 4.4], [10.3, 8.1], [7.3, 11.3], [3.9, 13.5], [2.2, 14.5]].map(([q, y]) => [Math.sin(a) * q, 31.9 + y, -1 + Math.cos(a) * q]), 0.22, slate, { seg: 12, radial: 4 })); }
    D.push(cyl(2.3, 2.6, 4.4, ochreP, 0, 46, -1, 8), cyl(3, 3, 0.5, cream, 0, 50.4, -1, 8), ...copperDome(2.6, 3.6, 0, 50.9, -1, 10));
    world.add(...bake(D, [-28, 0, -108], Math.PI * 0.75));

    // ---- trams: tracks, overhead wires, green-and-cream W class and long modern ones, all moving
    const wClass = fuse([[G(14, 1.25, 2.6, 0, 1.2), 0x2c6a3a], [G(14, 1.15, 2.6, 0, 2.4), 0xf0e4bc], [G(12.8, 0.8, 2.66, 0, 2.4), 0x1d2428], [G(14.02, 0.12, 2.64, 0, 1.85), 0xd9b340], [G(14.3, 0.25, 2.75, 0, 3.1), 0x8d9388], [G(10.5, 0.4, 1.5, 0, 3.4), 0xe9dfbe],
      [G(2.6, 0.6, 2.2, -4.2, 0.4), 0x222222], [G(2.6, 0.6, 2.2, 4.2, 0.4), 0x222222], [G(0.1, 0.1, 5.4).rotateX(-0.5).rotateY(Math.PI / 2).translate(-2.2, 4.9, 0), 0x333333], [G(0.5, 0.5, 2.3, 7.05, 1.3), 0xf0e4bc], [G(0.5, 0.5, 2.3, -7.05, 1.3), 0xf0e4bc]]);
    const eParts = [];
    for (const s of [-1, 0, 1]) eParts.push([G(10.6, 2.5, 2.65, s * 11, 1.75), 0xf3f3ef], [G(10.2, 1.05, 2.7, s * 11, 2.25), 0x15191c], [G(10.6, 0.45, 2.68, s * 11, 0.85), 0x7ab82e], [G(9.6, 0.35, 2.2, s * 11, 3.15), 0xc9ccd0], [G(1.6, 1.9, 2.72, s * 11 - 2.5, 1.7), 0xf2c21a], [G(1.6, 1.9, 2.72, s * 11 + 2.5, 1.7), 0xf2c21a]);
    eParts.push([G(1.4, 2.2, 2.3, -5.5, 1.7), 0x2a2d30], [G(1.4, 2.2, 2.3, 5.5, 1.7), 0x2a2d30], [G(0.1, 0.1, 3.4).rotateX(-0.9).rotateY(Math.PI / 2).translate(0, 4.6, 0), 0x333333]);
    const tramMat = mat(0xffffff, { vertexColors: true, rough: 0.55 });
    const lines = [{ a: [520, -124], b: [-900, -124] }, { a: [-900, -130], b: [520, -130] }, { a: [-3.5, -1250], b: [-3.5, 1100] }, { a: [3.5, 1100], b: [3.5, -1250] }];
    const fleet = []; lines.forEach((l, i) => { const n = i < 2 ? 7 : 9; for (let k = 0; k < n; k++) fleet.push({ l, off: (k + r.range(0.1, 0.5)) / n, modern: (k + i) % 2 === 1 }); });
    const old = fleet.filter((f) => !f.modern), neu = fleet.filter((f) => f.modern), dummy = new THREE.Object3D();
    const wI = instances(wClass, tramMat, old), eI = instances(new THREE.BufferGeometry().copy(fuse(eParts)), tramMat, neu);
    world.add(wI, eI);
    world.onUpdate((t) => {
      for (const [set, im] of [[old, wI], [neu, eI]]) {
        set.forEach((f, i) => { const dx = f.l.b[0] - f.l.a[0], dz = f.l.b[1] - f.l.a[1], len = Math.hypot(dx, dz), u = (f.off + t * 9 / len) % 1; dummy.position.set(f.l.a[0] + dx * u, 0.2, f.l.a[1] + dz * u); dummy.rotation.y = Math.atan2(-dz, dx); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
        im.instanceMatrix.needsUpdate = true;
      }
    });
    const wire = [], rail = [];
    for (const z of [-124, -130]) { wire.push({ x: -190, y: 6.4, z, w: 1420, h: 0.07, d: 0.07 }); for (const o of [-0.72, 0.72]) rail.push({ x: -190, y: 0.2, z: z + o, w: 1420, h: 0.06, d: 0.16 }); }
    for (const x of [-3.5, 3.5]) { wire.push({ x, y: 6.4, z: -75, w: 0.07, h: 0.07, d: 2350 }); for (const o of [-0.72, 0.72]) rail.push({ x: x + o, y: 0.24, z: -75, w: 0.16, h: 0.06, d: 2350 }); }
    for (let x = -880; x <= 500; x += 42) if (Math.abs(x) > 20) wire.push({ x, y: 0, z: -118.6, w: 0.3, h: 7.2, d: 0.3 }, { x, y: 0, z: -135.4, w: 0.3, h: 7.2, d: 0.3 }, { x, y: 6.9, z: -127, w: 0.08, h: 0.08, d: 17 });
    for (let z = -1230; z <= 1080; z += 42) if (Math.abs(z + 127) > 20) wire.push({ x: -9, y: 0, z, w: 0.3, h: 7.2, d: 0.3 }, { x: 9, y: 0, z, w: 0.3, h: 7.2, d: 0.3 }, { x: 0, y: 6.9, z, w: 18, h: 0.08, d: 0.08 });
    world.add(buildings(wire, mat(0x2b2e30), { cast: false }), buildings(rail, mat(0xb9bec2, { metal: 0.6, rough: 0.4 }), { cast: false, receive: false }));
    world.add(box(1420, 0.06, 9, mat(0x7d8082), -190, 0.16, -127, { cast: false }), box(9.6, 0.06, 2350, mat(0x7d8082), 0, 0.2, -75, { cast: false }));

    // ---- Princes Bridge (Swanston Street over the river) and two plainer bridges
    const bluestone = mat(0x6d7379), pb = bake(archBridge(104, 32, 3, bluestone, cream)); pb.forEach((m) => { m.rotation.y = Math.PI / 2; }); world.add(...pb);
    for (const [x, w] of [[-640, 20], [1500, 22]]) { const b = bake(archBridge(110, w, 5, mat(0x8c8f8c), white), [x, 0, zc(x)], Math.PI / 2); world.add(...b); }
    const foot = [box(6, 0.8, 100, white, -330, 0, 0)]; for (const s of [-1, 1]) foot.push(tube(Array.from({ length: 9 }, (_, i) => [-330 + s * 3, 11 * Math.sin(i / 8 * Math.PI), -46 + i * 11.5]), 0.3, white, { seg: 24, radial: 5 }));
    world.add(...bake(foot));

    // ---- St Paul's Cathedral and Federation Square at the corner
    const sand = mat(0xa9885c), C = [box(22, 26, 78, sand, 76, 0, -214), mesh(gable(22, 11, 78), mat(0x5a5f63), 76, 26, -214), box(56, 24, 18, sand, 76, 0, -226), mesh(gable(18, 9, 56).rotateY(Math.PI / 2), mat(0x5a5f63), 76, 24, -226)];
    for (const [x, z, h, s] of [[65, -180, 36, 34], [87, -180, 36, 34], [76, -226, 44, 52]]) C.push(box(9, h, 9, sand, x, 0, z), cyl(0, 5.6, s, sand, x, h, z, 8), ...[-1, 1].flatMap((a) => [-1, 1].map((b) => cyl(0, 1.1, 9, sand, x + a * 4, h, z + b * 4, 6))));
    world.add(...bake(C));
    const fed = [], fedMats = [0xc9a877, 0x9aa39a, 0xb58f66, 0x7f8c84, 0xd1b98c, 0x6f8a80].map((c) => mat(c, { flat: true })), fedGlass = mat(0x4f7480, { rough: 0.25, metal: 0.5 });
    for (const [x, z, w, d, h, a] of [[60, -92, 46, 24, 13, 0.2], [104, -80, 30, 34, 11, -0.3], [52, -64, 30, 20, 9, -0.15], [150, -96, 40, 18, 8, 0.12]]) {
      for (let k = 0; k < 5; k++) fed.push(mesh(taperBox(w * r.range(0.3, 0.6), h * r.range(0.6, 1.1), d * r.range(0.5, 1), r.range(-2, 3), r.range(-1, 3)), r.pick(fedMats), x + r.range(-0.3, 0.3) * w, 0, z + r.range(-0.2, 0.2) * d, { ry: a + r.range(-0.5, 0.5) }));
      fed.push(box(w * 0.5, h * 0.8, d * 0.5, fedGlass, x, 0, z, { ry: a + 0.3 }));
    }
    world.add(...bake(fed), box(170, 0.25, 62, mat(0xc49a72), 110, 0, -80, { cast: false }));

    // ---- the city grid north of Flinders Street
    const glassTones = [0x4a739c, 0x5a86a8, 0x3c6088, 0x7396ad, 0x33527a, 0x5a9090], stoneTones = [0xc9b58f, 0xb39a78, 0xd8c9a8, 0x9c8468, 0xa9a39a, 0xc2a37e];
    const cbd = cityGrid({
      rand: r, area: [-928, -1280, 500, -170], block: 70, street: 24, jitter: 0.3, split: 0.4,
      keep: (x, z) => !(x > 30 && x < 120 && z > -260),
      height: (x, z) => z > -230 ? r.range(20, 46) : 26 + 230 * Math.exp(-((x + 330) ** 2) / 220000 - ((z + 560) ** 2) / 160000) * r.range(0.35, 1.1),
    });
    const lowC = [], highC = [], darkC = [], darkTones = [0x8c9396, 0x6f7a80, 0xa59a8a, 0x59646c, 0xb7b2a6];
    for (const b of cbd) {
      const set = b.h < 75 ? lowC : r.chance(0.55) ? highC : r.chance(0.6) ? darkC : lowC; set.push(b); b.color = r.pick(set === lowC ? stoneTones : set === highC ? glassTones : darkTones);
      if (b.h > 150 && r.chance(0.5)) set.push({ x: b.x, z: b.z, y: b.h, w: b.w * 0.5, d: b.d * 0.5, h: b.h * 0.12, color: b.color });
    }
    const stoneF = facadeMat({ floor: 4, bay: 3.2, frame: [0.28, 0.26], glass: 0x26303a, rough: 0.85, ground: 4 }), glassF = facadeMat({ floor: 3.9, bay: 2.4, frame: [0.07, 0.12], glass: 0x284a6e, rough: 0.35, metal: 0.3 });
    const darkF = facadeMat({ floor: 4, bay: 1.6, frame: [0.3, 0.1], glass: 0x1c2a2e, rough: 0.45, metal: 0.3 });
    world.add(buildings(lowC, stoneF), buildings(highC, glassF), buildings(darkC, darkF));

    // ---- Southbank: the Eureka Tower with its gold crown, other towers, the Arts Centre and its lattice spire
    const E = [-340, 300], eGlass = facadeMat({ color: 0x4f78a8, floor: 3.6, bay: 2.2, frame: [0.05, 0.1], glass: 0x1d3c63, rough: 0.25, metal: 0.45 }), eGold = facadeMat({ color: 0xe0b23a, floor: 3.6, bay: 2.2, frame: [0.06, 0.12], glass: 0xc8922a, rough: 0.2, metal: 0.8 });
    world.add(...bake([box(60, 26, 60, eGlass, E[0], 0, E[1]), box(44, 236, 44, eGlass, E[0], 26, E[1]), box(44.4, 30, 44.4, eGold, E[0], 262, E[1]), mesh(taperBox(44, 12, 44, 0, 10), eGlass, E[0], 292, E[1]),
      box(1.2, 60, 0.6, mat(0xc0392b), E[0] - 8, 232, E[1] - 22.4), ...[0, 1, 2, 3, 4, 5].map((i) => box(45, 0.7, 45, white, E[0], 204 + i * 9, E[1])), box(24, 250, 20, eGlass, E[0] + 30, 0, E[1] + 10)]));
    const sb = cityGrid({
      rand: r, area: [-900, 96, -40, 760], block: 62, street: 26, jitter: 0.35, split: 0.2,
      keep: (x, z) => Math.hypot(x - E[0], z - E[1]) > 75 && !(x > -160 && z < 330),
      height: (x, z) => Math.min(40 + 190 * r() * r.range(0.4, 1), clear(x, z, 85) - 30),
    });
    const sbA = [], sbB = []; for (const b of sb) { const d = r.chance(0.35); (d ? sbB : sbA).push(b); b.color = r.pick(d ? darkTones : glassTones); }
    world.add(buildings(sbA, glassF), buildings(sbB, darkF));
    const A = [-78, 240], lat = mat(0xfbfaf4, { rough: 0.5, emissive: 0xfff8e8, glow: 0.12 }), sp = [], rad = (y) => y < 74 ? 4.5 + 27 * Math.pow(1 - (y - 26) / 48, 2.3) : 4.5 * (1 - (y - 74) / 92) + 0.3;
    for (let i = 0; i < 16; i++) for (const s of [-1, 1]) sp.push(tube(Array.from({ length: 13 }, (_, k) => { const y = 26 + k * 4.5, a = i / 16 * 6.283 + s * (y - 26) * 0.012; return [A[0] + Math.cos(a) * rad(y), y, A[1] + Math.sin(a) * rad(y)]; }), 0.3, lat, { seg: 14, radial: 4 }));
    for (let i = 0; i < 6; i++) sp.push(tube([80, 110, 140, 166].map((y) => [A[0] + Math.cos(i * 1.047) * rad(y), y, A[1] + Math.sin(i * 1.047) * rad(y)]), 0.25, lat, { seg: 6, radial: 4 }));
    for (const y of [26, 35, 44, 53, 62, 74, 86, 98, 110, 122, 134, 146]) sp.push(mesh(new THREE.TorusGeometry(rad(y), y < 80 ? 0.3 : 0.2, 4, 28).rotateX(Math.PI / 2), lat, A[0], y, A[1]));
    sp.push(cyl(0.12, 0.4, 14, gold, A[0], 162, A[1], 6), lathe([[26, 0], [20, 6], [11, 14], [6.5, 22]], mat(0xd9b24a, { metal: 0.5, rough: 0.5, side: THREE.DoubleSide, opacity: 0.55 }), A[0], 26, A[1], 28, { cast: false }));
    const hall = facadeMat({ color: 0xbfae8e, floor: 5, bay: 4, frame: [0.3, 0.3], glass: 0x2a3138, round: 34, rough: 0.85 });
    sp.push(cyl(34, 34, 22, hall, -60, 0, 108, 40), cyl(30, 34, 4, mat(0x8a8f8c), -60, 22, 108, 40), cyl(40, 42, 20, hall, A[0], 0, A[1], 40), cyl(30, 40, 6, mat(0x8a8f8c), A[0], 20, A[1], 40), box(90, 22, 130, mat(0x6a7078), -78, 0, 420));
    world.add(...bake(sp));

    // ---- the MCG with its light towers, and the tennis arenas beside the river
    const mcg = new THREE.Group(), seat = mat(0x56708f, { side: THREE.DoubleSide, rough: 0.8 });
    mcg.add(lathe([[84, 1], [106, 13], [108, 17], [133, 34], [135, 37]], seat, 0, 0, 0, 64), lathe([[115, 43], [150, 49], [156, 45.5], [115, 42.4]], white, 0, 0, 0, 64),
      lathe([[150, 0], [152, 30], [156, 45.5]], facadeMat({ color: 0xb9bcbc, floor: 7, bay: 6, frame: [0.12, 0.3], glass: 0x2f3b46, round: 152, rough: 0.7 }), 0, 0, 0, 64), lathe([[135, 37], [150, 0]], mat(0x7d8286, { side: THREE.DoubleSide }), 0, 0, 0, 48, { cast: false }));
    mcg.add(cyl(84, 84, 1, mat(0x3f9c48), 0, 0, 0, 48), cyl(52, 52, 1.06, mat(0x4bab52), 0, 0, 0, 40), box(3.2, 1.1, 22, mat(0xcdbb8a), 0, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.283 + 0.4, x = Math.cos(a) * 166, z = Math.sin(a) * 166;
      mcg.add(...bake([cyl(1.2, 2.4, 78, white, 0, 0, 0, 8), box(22, 13, 1.6, mat(0x33383c), 0, 72, -2.4, { rx: -0.3 }), box(20, 11, 0.4, glowMat(0xfffdf0, 1.3), 0, 72.2, -3.4, { rx: -0.3 })], [x, 0, z], Math.atan2(x, z)));
    }
    mcg.position.set(M[0], 0, M[1]); mcg.scale.set(1.1, 1, 1); world.add(mcg);
    world.add(...bake([cyl(62, 66, 18, white, 660, 0, -240, 40), mesh(new THREE.SphereGeometry(66.5, 32, 8, 0, 6.283, 0, 1.2).scale(1, 0.2, 1), mat(0xe4eaee), 660, 18, -240)]));

    // ---- rowing eights on the river, boathouses, cruise boats
    const eight = [[new THREE.CylinderGeometry(0.42, 0.42, 18, 6).rotateZ(Math.PI / 2).scale(1, 0.55, 1), 0xf4e9c8]];
    for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1; eight.push([G(0.5, 0.85, 0.5, -6 + i * 1.6, 0.65, 0), [0xc8102e, 0x003c7e, 0xf2c21a, 0x1d6b3a][i >> 1]], [G(0.12, 0.06, 4.6).rotateY(0.25).translate(-6 + i * 1.6 - 0.4, 0.5, s * 2.4), 0xe8e2d0]); }
    const crews = Array.from({ length: 9 }, (_, i) => ({ x0: 160 + i * 115, lane: (i % 4 - 1.5) * 13, dir: i % 3 ? -1 : 1, v: r.range(3.5, 5.2) }));
    const boats = instances(fuse(eight), mat(0xffffff, { vertexColors: true, rough: 0.6 }), crews); world.add(boats);
    world.onUpdate((t) => {
      crews.forEach((c, i) => { const x = 150 + ((((c.x0 - 150 + c.dir * c.v * t) % 1150) + 1150) % 1150); dummy.position.set(x, -6.85, zc(x) + c.lane); dummy.rotation.y = c.dir > 0 ? 0 : Math.PI; dummy.updateMatrix(); boats.setMatrixAt(i, dummy.matrix); });
      boats.instanceMatrix.needsUpdate = true;
    });
    const sheds = [], shedMats = [0xe9e2d0, 0x8fb3c9, 0xd7c29a, 0xc96f5a].map((c) => mat(c)), shedRoof = mat(0x7c4a3c), cabin = mat(0x2a4054, { rough: 0.3 });
    for (let i = 0; i < 7; i++) { const x = 70 + i * 26; sheds.push(box(20, 7, 24, shedMats[i % 4], x, 0, 68), mesh(gable(20, 5, 26), shedRoof, x, 7, 68), box(7, 4.4, 0.4, dark, x, 0.2, 55.9)); }
    for (const [x, z, L] of [[-160, 34, 30], [-260, -32, 26], [250, -34, 30]]) sheds.push(box(L, 1.6, 6, white, x, -7, z), box(L * 0.7, 2.2, 5, cabin, x - 2, -5.4, z), box(L * 0.74, 0.3, 5.6, white, x - 2, -3.2, z));
    world.add(...bake(sheds));

    // ---- parkland and street trees, the suburbs beyond, balloons in the morning air
    const park = [], far = [], avenue = [];
    for (let i = 0; i < 9000 && park.length + far.length < 620; i++) {
      const x = r.range(40, 2000), z = r.range(-640, 800), d = Math.abs(z - zc(x));
      if (d < 64 || (x < 540 && z < -112) || (x < 200 && z < 0) || (x < 260 && z > 48 && z < 86) || lakeD(x, z) < 90 || Math.hypot(x - 430, z - 520) < 46 || Math.hypot(x - 300, z - 250) < 50 || Math.hypot(x - 640, z - 400) < 40) continue;
      if (Math.hypot((x - M[0]) / 1.1, z - M[1]) < 178 || Math.hypot(x - 660, z + 240) < 76 || clear(x, z, 26) < 34 || fbm(x / 130, z / 130, 2) < (clear(x, z, 300) < 1e9 ? 0.42 : 0.6)) continue;
      (clear(x, z, 320) < 1e9 ? park : far).push([x, land(x, z), z]);
    }
    for (let z = 60; z < 1000; z += 17) avenue.push([-15, 0, z], [15, 0, z]);
    for (let x = -860; x < -20; x += 21) avenue.push([x, 0, 49]);
    for (let x = 60; x < 1400; x += 22) for (const s of [-1, 1]) if (clear(x, zc(x) + s * 66, 22) > 30) avenue.push([x, land(x, zc(x) + s * 66), zc(x) + s * 66]);
    const leaf = [0x3f7d3a, 0x4f8f3f, 0x2f6a36, 0x6a9a48, 0x55803a];
    trees(world, park, 'round', { size: 16, color: leaf });
    trees(world, far, 'round', { size: 16, color: leaf }).children.forEach((m) => { m.castShadow = false; });
    trees(world, avenue, 'round', { size: 11, color: [0x4a8a3c, 0x5d9a46, 0x3d7a3a] });
    // in the gardens: the Shrine of Remembrance on its mound, the Music Bowl's white canopy, Government House and its tower
    const granite = mat(0xb9b4a6), Sh = [430, land(430, 520), 520], gd = [box(64, 3, 64, granite, 0, -2, 0), box(40, 15, 40, granite, 0, 1, 0)];
    for (let i = 0; i < 7; i++) gd.push(box(38 - i * 5, 2.2, 38 - i * 5, granite, 0, 16 + i * 2.2, 0));
    for (const s of [-1, 1]) { gd.push(box(30, 1.6, 9, granite, 0, 12.6, s * 23), mesh(gable(30, 5, 9), granite, 0, 14.2, s * 23)); for (let i = 0; i < 8; i++) gd.push(cyl(1.1, 1.3, 11.6, granite, -12.6 + i * 3.6, 1, s * 26, 10)); }
    world.add(...bake(gd, Sh));
    world.add(mesh(new THREE.SphereGeometry(60, 28, 10, 0.5, 2.14, 0.25, 1.05).scale(1, 0.62, 1), mat(0xf4f4ee, { side: THREE.DoubleSide, rough: 0.5 }), 300, land(300, 250) - 14, 250, { ry: 2.4 }));
    world.add(...bake([box(46, 13, 24, white, 0, 0, 0), box(24, 11, 34, white, -8, 0, 20), mesh(taperBox(46, 3, 24, 4), slate, 0, 13, 0), box(8, 44, 8, white, 14, 0, 12), box(10, 1.2, 10, white, 14, 44, 12), box(6.4, 7, 6.4, white, 14, 45.2, 12), mesh(taperBox(8, 2.5, 8, 3.6), slate, 14, 52.2, 12)], [640, land(640, 400), 400], 0.4));
    const burbs = cityGrid({
      rand: rng(12), area: [-2700, -2700, 2700, 2700], block: 44, street: 17, jitter: 0.3, split: 0.5, fill: 0.8, palette: [0xb5533c, 0xc9bca4, 0xa9603f, 0xd8d0c0, 0x8f969a, 0xbf7a52],
      keep: (x, z) => !(x > -960 && x < 540 && z > -1310 && z < -60) && !(x > -940 && x < 30 && z > 40 && z < 790) && Math.abs(z - zc(x)) > 110 && !(x > 30 && x < 2050 && z > -690 && z < 850) && Math.abs(x) > 30,
      height: () => r.range(5, 13),
    });
    world.add(buildings(burbs, facadeMat({ floor: 3.4, bay: 3.6, frame: [0.3, 0.3], glass: 0x2a3036, rough: 0.9 }), { cast: false }));
    const bal = Array.from({ length: 6 }, (_, i) => ({ x: [-520, 250, 900, -150, 1400, 560][i], y: [230, 300, 190, 420, 260, 150][i], z: [-420, -520, 420, 620, -820, -330][i], s: r.range(1.1, 1.6), color: [0xe8412f, 0xf2c21a, 0x2f7fd0, 0xf08a24, 0x9a4fc0, 0x38a860][i] }));
    const balloons = new THREE.Group();
    balloons.add(instances(new THREE.LatheGeometry([[0.9, 0], [2.4, 3], [5.4, 8], [7.8, 13], [8.8, 17.5], [8.2, 22], [5.6, 25.6], [0.1, 27.2]].map(([a, b]) => new THREE.Vector2(a, b)), 20), mat(0xffffff, { rough: 0.6 }), bal),
      instances(new THREE.CylinderGeometry(8.9, 8.2, 3.4, 20, 1, true).translate(0, 16.4, 0), mat(0xfff6e0, { rough: 0.6 }), bal), instances(G(1.6, 1.3, 1.6, 0, -2.6, 0), mat(0x6a4a2c), bal));
    world.add(balloons); world.onUpdate((t) => { balloons.position.set(t * 1.2, Math.sin(t * 0.25) * 4, t * 0.5); });
    clouds(world, { count: 14, y: [900, 1400], size: 150, color: 0xffffff, self: 0.3, rand: rng(4) });

    return { world, path, focus, duration: 46 };
  },
};
