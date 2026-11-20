// London in late afternoon: down the Thames past Parliament and Big Ben, round the London Eye, by St Paul's,
// up among the City towers past the Shard and the Gherkin, and out through Tower Bridge.
import { THREE, mergeGeometries, createWorld, rng, mat, facadeMat, mesh, box, cyl, sphere, dome, lathe, prism, tube, beam, instances, buildings, cityGrid, water, trees, clouds, clearance } from '../kit.js';

const G = 6, RW = 130, zc = (x) => 140 * Math.sin((x + 200) / 620);   // ground level, half the river's width, the river's centre line

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
/** A unit pitched roof: 1 wide (x), 1 high, 1 long (z), ridge along z. */
function gableGeo() {
  const a = [-0.5, 0, 0.5], b = [0.5, 0, 0.5], c = [0, 1, 0.5], d = [-0.5, 0, -0.5], e = [0.5, 0, -0.5], f = [0, 1, -0.5], g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, e, d, f, a, c, f, a, f, d, b, e, f, b, f, c].flat(), 3)); g.computeVertexNormals(); return g;
}
/** A masonry bridge of elliptical arches along Z, centred on the origin, standing in water at y=0. */
function archBridge(len, width, top, spans, material, x = 0, z = 0) {
  const s = new THREE.Shape(), w = len / spans, p = Math.min(4, w * 0.08);
  s.moveTo(-len / 2, top); s.lineTo(len / 2, top); s.lineTo(len / 2, -3);
  for (let i = spans - 1; i >= 0; i--) {
    const a = -len / 2 + i * w + p, b = a + w - 2 * p; s.lineTo(b, -3);
    for (let k = 0; k <= 10; k++) s.lineTo((a + b) / 2 + (b - a) / 2 * Math.cos(k * Math.PI / 10), 1 + (top - 3) * Math.sin(k * Math.PI / 10));
    s.lineTo(a, -3);
  }
  s.lineTo(-len / 2, -3);
  return mesh(new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false }).translate(0, 0, -width / 2).rotateY(-Math.PI / 2), material, x, 0, z);
}
/** The face of the Great Clock. */
function dialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#c9a54e'; x.fillRect(0, 0, 256, 256); x.translate(128, 128);
  x.fillStyle = '#f6efd8'; x.beginPath(); x.arc(0, 0, 122, 0, 7); x.fill();
  x.strokeStyle = '#1d1a14'; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 116, 0, 7); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 80, 0, 7); x.stroke();
  x.fillStyle = '#1d1a14';
  for (let i = 0; i < 12; i++) { x.save(); x.rotate(i * Math.PI / 6); x.fillRect(-4.5, -110, 9, 27); x.restore(); }
  for (const [a, l, w] of [[5.4 / 12, 66, 11], [25 / 60, 104, 7]]) { x.save(); x.rotate(a * Math.PI * 2); x.fillRect(-w / 2, -l, w, l + 14); x.restore(); }
  x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default {
  build() {
    const r = rng(1859);
    const world = createWorld({
      sky: { top: 0x5c82b2, horizon: 0xf2e4c4, bottom: 0x8d9296, haze: 0.42 },
      sun: { dir: [-0.7, 0.36, 0.6], color: 0xffd9a0, power: 3.5, disc: 0xfff0c8, size: 0.0011 },
      ambient: { sky: 0xb4c2d4, ground: 0x5a5244, power: 0.85 },
      fog: { color: 0xd9d4c4, density: 0.00042 }, exposure: 1.0, env: 0.8,
    });
    const path = [[-2100, 42, -40], [-1560, 34, -180], [-1330, 52, -196], [-1190, 66, -150], [-1040, 80, -105], [-800, 52, -95], [-420, 38, -40], [-60, 40, 25],
      [330, 75, 30], [560, 140, -130], [760, 160, -150], [960, 100, -20], [1100, 48, 88], [1250, 34, 100], [1380, 36, 96], [1560, 44, 84]];
    const BEN = [-1302, -298], EYE = [-1040, -10], PAUL = [-60, -250], SHARD = [560, 330], GHERKIN = [750, -300], TB = [1250, 100];
    const focus = [[0.1, BEN[0], 60, BEN[1]], [0.2, BEN[0], 72, BEN[1]], [0.26, EYE[0], 80, EYE[1]], [0.31, EYE[0], 80, EYE[1]], [0.37, -480, 40, -70],
      [0.45, PAUL[0], 75, PAUL[1]], [0.52, PAUL[0], 85, PAUL[1]], [0.61, SHARD[0], 190, SHARD[1]], [0.68, SHARD[0], 230, SHARD[1]], [0.75, GHERKIN[0], 110, GHERKIN[1]], [0.79, GHERKIN[0], 110, GHERKIN[1]]];
    const clear = clearance(path);

    // ---- shared materials
    const honey = mat(0xbfa878), slate = mat(0x454a53, { rough: 0.55, metal: 0.15 }), gold = mat(0xe3bb52, { metal: 0.85, rough: 0.3 }), lead = mat(0x8b959b, { rough: 0.5, metal: 0.3 });
    const portland = mat(0xd8d1bf), road = mat(0x3b3d41), white = mat(0xeef1f2, { rough: 0.5 }), dark = mat(0x1f1c1a);
    const gothic = facadeMat({ color: 0xbfa878, floor: 6.5, bay: 2.1, frame: [0.3, 0.1], glass: 0x4f4130, lit: 0, rough: 0.9 });
    const classic = facadeMat({ color: 0xd8d1bf, floor: 5, bay: 3.4, frame: [0.3, 0.22], glass: 0x2b2f36, lit: 0.1, rough: 0.85 });
    const pins = [], pin = (x, y, z, w, h) => pins.push({ x, y: G + y, z, sx: w, sy: h, sz: w });

    // ---- the Thames and its banks
    water(world, 0, { color: 0x56665f, rough: 0.14, ripple: 70, strength: 0.3 });
    const pave = mat(0x56575a);
    for (const s of [-1, 1]) {
      const o = []; for (let x = -3400; x <= 3400; x += 85) o.push([x, zc(x) + s * RW]); o.push([3400, s * 3600], [-3400, s * 3600]);
      world.add(prism(o, G + 1, pave, 0, -1, 0, { cast: false }));
    }

    // ---- Elizabeth Tower (Big Ben)
    const ben = new THREE.Group(), face = mat(0xffffff, { rough: 0.6, emissive: 0x554422, glow: 0.4 }); face.map = dialTexture();
    ben.add(box(15.5, 4, 15.5, honey), box(12.6, 47, 12.6, gothic, 0, 4, 0), box(15, 1.6, 15, honey, 0, 50, 0), box(14, 11.4, 14, honey, 0, 51.6, 0), box(16, 1.4, 16, honey, 0, 63, 0));
    ben.add(box(12.2, 7.6, 12.2, gothic, 0, 64.4, 0), cyl(6.2, 10.4, 7.5, slate, 0, 72, 0, 4), box(8.8, 5.2, 8.8, gold, 0, 79.5, 0), box(7.4, 3.8, 9, dark, 0, 80.2, 0), box(9, 3.8, 7.4, dark, 0, 80.2, 0));
    ben.add(cyl(0, 6.6, 14, slate, 0, 84.7, 0, 4), cyl(0.25, 0.25, 4, gold, 0, 98, 0, 6), sphere(0.8, gold, 0, 102, 0));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, s = Math.sin(a), c = Math.cos(a);
      ben.add(mesh(new THREE.CircleGeometry(4.6, 40), face, s * 7.08, 57.3, c * 7.08, { ry: a }), mesh(new THREE.TorusGeometry(4.8, 0.4, 6, 40), gold, s * 7.1, 57.3, c * 7.1, { ry: a }));
      const cx = Math.sign(Math.round(s + c)) * 6.6, cz = Math.sign(Math.round(c - s)) * 6.6;
      ben.add(box(1.8, 64, 1.8, honey, cx, 0, cz)); pin(BEN[0] + cx * 1.08, 64, BEN[1] + cz * 1.08, 2, 9);
    }
    ben.position.set(BEN[0], G, BEN[1]); world.add(bake(ben));

    // ---- the Palace of Westminster, and the Abbey behind it
    const pal = new THREE.Group(), PX = -1440, PZ = -296, gable = gableGeo();
    pal.add(box(254, G + 2.5, 18, honey, 0, -G - 1, 29), box(250, 22, 40, gothic), mesh(gable, slate, 0, 22, 0, { ry: Math.PI / 2, scale: [30, 8, 246] }));
    pal.add(box(224, 19, 26, gothic, -6, 0, -40), mesh(gable, slate, -6, 19, -40, { ry: Math.PI / 2, scale: [22, 7, 220] }), box(30, 17, 74, gothic, 62, 0, -78), mesh(gable, slate, 62, 17, -78, { scale: [30, 13, 74] }));
    for (const x of [-118, 0, 118]) { pal.add(box(x ? 14 : 22, 29, 44, gothic, x, 0, 0)); for (const a of [-1, 1]) for (const b of [-1, 1]) pin(PX + x + a * (x ? 7 : 11), 0, PZ + b * 22, 3, 38); }
    for (let x = -106; x <= 106; x += 11.8) if (Math.abs(x) > 14) pin(PX + x, 0, PZ + 20.4, 1.9, 28.5);
    pal.add(box(25, 76, 25, gothic, -110, 0, -8), cyl(0, 14, 7, slate, -110, 76, -8, 4), cyl(0.3, 0.3, 17, white, -110, 82, -8, 6), box(7, 4, 0.3, mat(0xb8203a), -106.4, 94, -8));
    for (const a of [-1, 1]) for (const b of [-1, 1]) pin(PX - 110 + a * 12.5, 0, PZ - 8 + b * 12.5, 5, 95);
    pal.add(cyl(5.6, 6.6, 20, honey, 0, 22, -6, 8), cyl(0, 6.2, 40, honey, 0, 42, -6, 8));
    pal.position.set(PX, G, PZ); world.add(bake(pal));
    const abbey = new THREE.Group(), cream = facadeMat({ color: 0xd6cbae, floor: 9, bay: 3.2, frame: [0.3, 0.14], glass: 0x3f3a36, lit: 0 });
    abbey.add(box(104, 30, 19, cream), mesh(gable, lead, 0, 30, 0, { ry: Math.PI / 2, scale: [19, 9, 104] }), box(19, 30, 62, cream, 16, 0, 0), mesh(gable, lead, 16, 30, 0, { scale: [19, 9, 62] }));
    for (const s of [-1, 1]) { abbey.add(box(10, 64, 10, cream, -52, 0, s * 10)); for (const a of [-1, 1]) for (const b of [-1, 1]) pin(-1500 - 52 + a * 4.6, 58, -470 + s * 10 + b * 4.6, 1.6, 13); }
    abbey.position.set(-1500, G, -470); world.add(bake(abbey));
    world.add(instances(mergeGeometries([new THREE.BoxGeometry(1, 0.62, 1).translate(0, 0.31, 0), new THREE.ConeGeometry(0.66, 0.38, 4).rotateY(Math.PI / 4).translate(0, 0.81, 0)]), honey, pins));

    // ---- the London Eye: rim, cable spokes and capsules turn together on the hub
    const wheel = new THREE.Group(), R = 60, glassy = mat(0xd4e6f0, { rough: 0.15, metal: 0.5 });
    for (const z of [-1.7, 1.7]) wheel.add(mesh(new THREE.TorusGeometry(R, 0.75, 6, 96), white, 0, 0, z));
    wheel.add(mesh(new THREE.TorusGeometry(R - 3.2, 0.5, 6, 96), white), mesh(new THREE.CylinderGeometry(2.4, 2.4, 20, 16).rotateX(Math.PI / 2), white, 0, 0, 3), mesh(new THREE.CylinderGeometry(5, 5, 1.2, 20).rotateX(Math.PI / 2), white, 0, 0, -6), mesh(new THREE.CylinderGeometry(5, 5, 1.2, 20).rotateX(Math.PI / 2), white, 0, 0, 6));
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      wheel.add(beam([c * 4, s * 4, i % 2 ? 6 : -6], [c * R, s * R, i % 2 ? 1.7 : -1.7], 0.3, white), beam([c * R, s * R, -1.7], [c * (R - 3.2), s * (R - 3.2), 0], 0.4, white), beam([c * R, s * R, 1.7], [c * (R - 3.2), s * (R - 3.2), 0], 0.4, white));
      if (i % 2 === 0) wheel.add(mesh(new THREE.SphereGeometry(2.2, 10, 8).scale(1.75, 1, 1).rotateZ(a + Math.PI / 2), glassy, c * (R + 3.4), s * (R + 3.4), 0), mesh(new THREE.TorusGeometry(2.4, 0.3, 5, 14).rotateY(Math.PI / 2).rotateZ(a + Math.PI / 2), white, c * (R + 3.4), s * (R + 3.4), 0));
    }
    const eye = bake(wheel); eye.position.set(EYE[0], G + 70, EYE[1]); world.add(eye); world.onUpdate((t) => { eye.rotation.z = -t * 0.035; });
    const stand = new THREE.Group();
    for (const s of [-1, 1]) stand.add(beam([s * 24, 0, 46], [0, 70, 13], 2.8, white), beam([s * 9, 0, 78], [0, 70, 13], 0.5, white));
    stand.add(box(76, 3, 16, white, 0, -3, -4), box(60, 5, 9, glassy, 0, 0, -2));
    stand.position.set(EYE[0], G, EYE[1]); world.add(bake(stand));
    const hall = new THREE.Group();   // County Hall beside it
    hall.add(box(170, 24, 34, classic), box(160, 6, 26, slate, 0, 24, 0), cyl(2.5, 3.5, 14, portland, 0, 30, 0, 8), cyl(0, 3, 8, lead, 0, 44, 0, 8));
    hall.position.set(-1168, G, zc(-1168) + RW + 30); world.add(bake(hall));

    // ---- the river bridges, with red buses and cars going over
    const spans = [[-1245, 7, 0x6f9a78], [-760, 5, 0xd4d0c4], [-330, 5, 0xb5524a], [200, 3, 0x7d9a6a], [560, 3, 0xbdb9ae]], decks = [];
    for (const [x, n, c] of spans) decks.push(archBridge(RW * 2 + 30, 22, 9.3, n, mat(c), x, zc(x)), box(17, 0.4, RW * 2 + 30, road, x, 9.1, zc(x)));
    decks.push(box(4.5, 1.2, RW * 2 + 20, mat(0xc9ced2, { metal: 0.6, rough: 0.35 }), -60, 9.5, zc(-60)));   // the Millennium footbridge
    for (const s of [-1, 1]) decks.push(box(5, 12, 9, portland, -60, -2, zc(-60) + s * 62), beam([-67, 12.5, zc(-60) + s * 62], [-60, 9.5, zc(-60) + s * 62], 1, white), beam([-53, 12.5, zc(-60) + s * 62], [-60, 9.5, zc(-60) + s * 62], 1, white));
    world.add(bake(decks));
    const lanes = [...spans.map(([x]) => [x, 9.5]), [TB[0], 12.3]];
    const busMat = facadeMat({ color: 0xcf1f1c, floor: 2.15, bay: 1.35, frame: [0.1, 0.24], glass: 0x1b2026, lit: 0, rough: 0.45 });
    const drive = (speed, off) => (i, t) => { const [x, y] = lanes[i % lanes.length], dir = (i >> 1) % 2 ? 1 : -1, L = RW * 2 + 120, s = (((i * 97.3 + t * speed) % L) + L) % L - L / 2; return [x + dir * off, y, zc(x) + dir * s, dir > 0 ? 0 : Math.PI]; };
    fleet(world, new THREE.BoxGeometry(2.6, 4.4, 10.5).translate(0, 2.2, 0), busMat, 30, drive(9, 5.2));
    fleet(world, new THREE.BoxGeometry(1.9, 1.5, 4.4).translate(0, 0.75, 0), mat(0xffffff, { rough: 0.4, metal: 0.3 }), 70, drive(12, 2), [0x18181a, 0xd9dcde, 0x8a8f96, 0x2a3f6a, 0x18181a, 0xa02a2a, 0xf0f0ee]);
    const boat = mergeGeometries([new THREE.BoxGeometry(6.5, 2.6, 34).translate(0, 0.9, 0), new THREE.BoxGeometry(5.4, 2.4, 22).translate(0, 3.4, -2), new THREE.BoxGeometry(3, 1.6, 6).translate(0, 5.4, 4)]);
    fleet(world, boat, mat(0xf2f3f0, { rough: 0.5 }), 12, (i, t) => { const dir = i % 2 ? 1 : -1, x = ((((i * 391 + dir * t * 7) % 4600) + 4600) % 4600) - 2400, e = zc(x + 1) - zc(x); return [x, 0, zc(x) + dir * (58 + (i % 3) * 16), Math.atan2(1, e)]; }, [0xf2f3f0, 0xf2f3f0, 0x2c4f8c, 0xd8c9a0]);

    // ---- St Paul's Cathedral, and Tate Modern across the footbridge
    const paul = new THREE.Group(), baroque = facadeMat({ color: 0xd8d1bf, floor: 13, bay: 5.6, frame: [0.36, 0.2], glass: 0x4a4640, lit: 0, rough: 0.85 });
    paul.add(box(150, 29, 34, baroque), box(146, 3, 26, lead, 0, 29, 0), box(38, 29, 84, baroque), box(30, 3, 80, lead, 0, 29, 0), cyl(18.5, 18.5, 20, portland, 0, 29, 0, 32), cyl(21.5, 21.5, 2, portland, 0, 47, 0, 32), cyl(16.5, 17, 11, portland, 0, 49, 0, 32));
    for (let i = 0; i < 32; i++) paul.add(cyl(0.9, 0.9, 14, portland, Math.cos(i * Math.PI / 16) * 20.3, 33, Math.sin(i * Math.PI / 16) * 20.3, 8));
    paul.add(dome(17, lead, 0, 60, 0, { scale: [1, 1.22, 1] }), cyl(3.2, 3.8, 12, portland, 0, 79.5, 0, 12), dome(3.4, lead, 0, 91.5, 0), sphere(1.3, gold, 0, 96, 0), box(0.5, 5, 0.5, gold, 0, 97, 0), box(3, 0.5, 0.5, gold, 0, 99.6, 0));
    for (const s of [-1, 1]) paul.add(box(12, 44, 12, baroque, -70, 0, s * 21), cyl(4.6, 5.2, 12, portland, -70, 44, s * 21, 12), dome(4.8, lead, -70, 56, s * 21, { scale: [1, 1.3, 1] }), sphere(0.9, gold, -70, 62.6, s * 21));
    paul.add(box(26, 22, 6, portland, -78, 0, 0), mesh(gable, portland, -78, 29, 0, { scale: [34, 7, 6], ry: Math.PI / 2 }));
    paul.scale.setScalar(1.1); paul.position.set(PAUL[0], G, PAUL[1]); world.add(bake(paul));
    const brick = facadeMat({ color: 0x7a5440, floor: 11, bay: 5, frame: [0.38, 0.12], glass: 0x2a2624, lit: 0 }), TZ = zc(-60) + RW + 46;
    world.add(bake(box(196, 33, 38, brick, -60, G, TZ), box(10, 93, 10, brick, -60, G, TZ - 15), box(196, 5, 12, mat(0xcfe0e6, { rough: 0.2 }), -60, G + 33, TZ + 6)));

    // ---- the Shard: a glass spire whose faces never quite meet
    const shardGlass = facadeMat({ color: 0xbfd6e4, floor: 4, bay: 1.7, frame: [0.05, 0.1], glass: 0x86abc8, lit: 0.12, rough: 0.2, metal: 0.45 });
    world.add(cyl(7.5, 44, 262, shardGlass, SHARD[0], G, SHARD[1], 4));
    const sv = [];
    [48, 33, 41, 27].forEach((h, k) => {
      const a = k * Math.PI / 2, n = [Math.sin(a), Math.cos(a)], t = [Math.cos(a), -Math.sin(a)], P = (side, y, dist, half) => [n[0] * dist + t[0] * side * half, y, n[1] * dist + t[1] * side * half];
      sv.push(P(-1, 250, 6.9, 6), P(1, 250, 6.9, 6), P(1, 262 + h, 1.6, 1.3), P(-1, 250, 6.9, 6), P(1, 262 + h, 1.6, 1.3), P(-1, 262 + h, 1.6, 1.3));
    });
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(sv.flat(), 3)); bg.computeVertexNormals();
    world.add(mesh(bg, mat(0xcfe3ee, { rough: 0.12, metal: 0.6, side: THREE.DoubleSide }), SHARD[0], G, SHARD[1]));

    // ---- the Gherkin, wound with dark spiral bands
    const gp = [[24.5, 0], [27, 25], [28.2, 55], [27, 90], [23.4, 120], [16.5, 148], [8.5, 168], [3, 177], [0, 180]];
    const gr = (y) => { let i = 0; while (i < gp.length - 2 && y > gp[i + 1][1]) i++; const [r0, y0] = gp[i], [r1, y1] = gp[i + 1]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); };
    world.add(lathe(gp, facadeMat({ color: 0xa9c4cf, floor: 4.2, bay: 2.2, frame: [0.06, 0.1], glass: 0x5f8ea4, lit: 0.1, rough: 0.2, metal: 0.4, round: 27 }), GHERKIN[0], G, GHERKIN[1], 40));
    const wraps = [], navy = mat(0x1d2f3d, { rough: 0.25, metal: 0.5 }), rib = mat(0xe4eaec, { rough: 0.5 });
    const helix = (a0, turn, rad, m) => wraps.push(tube(Array.from({ length: 30 }, (_, k) => { const y = k / 29 * 172, a = a0 + turn * y / 172; return [Math.cos(a) * (gr(y) + 0.2), y, Math.sin(a) * (gr(y) + 0.2)]; }), rad, m, { seg: 58, radial: 5 }));
    for (let j = 0; j < 6; j++) helix(j * Math.PI / 3, 4.4, 1.15, navy);
    for (let j = 0; j < 18; j++) { helix(j * Math.PI / 9, 4.4, 0.35, rib); helix(j * Math.PI / 9, -4.4, 0.35, rib); }
    const wrap = bake(wraps); wrap.position.set(GHERKIN[0], G, GHERKIN[1]); world.add(wrap);

    // ---- Tower Bridge: stone towers, high walkways, blue suspension chains
    const tb = new THREE.Group(), granite = mat(0xbcae92), blue = mat(0x4a97d8, { rough: 0.5 });
    const tbStone = facadeMat({ color: 0xbcae92, floor: 7.6, bay: 3.3, frame: [0.33, 0.2], glass: 0x2e2a26, lit: 0, ground: 15 });
    const chord = (ys, u) => { const f = u * (ys.length - 1), i = Math.min(ys.length - 2, Math.floor(f)); return ys[i] + (ys[i + 1] - ys[i]) * (f - i); };
    const UP = [55, 43, 33.5, 26, 21, 19.5, 23], LOW = [42, 32, 24.5, 19.5, 16.5, 15.5, 18];
    for (const s of [-1, 1]) {
      const z = s * 48;
      tb.add(box(52, 15, 27, granite, 0, -3, z), cyl(13.5, 13.5, 15, granite, 26, -3, z, 6), cyl(13.5, 13.5, 15, granite, -26, -3, z, 6));
      tb.add(box(22, 47, 20, tbStone, 0, 12, z), box(11, 13, 20.8, dark, 0, 12, z), box(24.5, 1.6, 22.5, granite, 0, 59, z), cyl(0, 13.4, 21, slate, 0, 60.6, z, 4), cyl(0.25, 0.25, 6, gold, 0, 81, z, 6), box(8, 7, 23, tbStone, 0, 60.6, z), mesh(gable, slate, 0, 67.6, z, { scale: [8, 5, 23] }));
      for (const a of [-1, 1]) for (const b of [-1, 1]) tb.add(cyl(3.4, 3.4, 58, granite, a * 11, 12, z + b * 10, 8), cyl(0, 4, 11, slate, a * 11, 70, z + b * 10, 8), sphere(0.6, gold, a * 11, 81.3, z + b * 10));
      tb.add(box(20, 2.4, 84, road, 0, 9.8, s * 100), box(20, 24, 13, tbStone, 0, G, s * 142), box(10, 9, 13.6, dark, 0, G + 3, s * 142), cyl(0, 11.5, 9, slate, 0, G + 24, s * 142, 4), box(20, 6.2, 60, granite, 0, G, s * 176));
      for (const a of [-1, 1]) {
        const x = a * 10.6, P = (ys, u) => [x, chord(ys, u), s * (58 + 80 * u)];
        tb.add(tube(Array.from({ length: 13 }, (_, k) => P(UP, k / 12)), 0.8, blue, { seg: 36, radial: 5 }), tube(Array.from({ length: 13 }, (_, k) => P(LOW, k / 12)), 0.8, blue, { seg: 36, radial: 5 }), box(0.7, 1.7, 84, blue, x, 12.2, s * 100));
        for (let k = 0; k <= 16; k++) {
          const u = k / 16; tb.add(beam(P(UP, u), P(LOW, u), 0.5, blue), beam(P(LOW, u), [x, 12.2, s * (58 + 80 * u)], 0.3, white));
          if (k < 16) tb.add(beam(k % 2 ? P(UP, u) : P(LOW, u), k % 2 ? P(LOW, u + 1 / 16) : P(UP, u + 1 / 16), 0.4, white));
        }
      }
    }
    tb.add(box(20, 2.4, 78, road, 0, 9.8, 0));
    for (const a of [-1, 1]) {
      tb.add(box(0.8, 3.6, 76, blue, a * 10.4, 9.4, 0), box(3.8, 5.6, 76, blue, a * 6.2, 52, 0), box(4.4, 0.6, 76, white, a * 6.2, 51.6, 0), box(4.4, 0.6, 76, white, a * 6.2, 57.4, 0));
      for (let k = -9; k < 9; k++) tb.add(beam([a * 6.2 + a * 2, 52.4, k * 4.2], [a * 6.2 + a * 2, 57.2, k * 4.2 + 4.2], 0.35, white), beam([a * 6.2 + a * 2, 57.2, k * 4.2], [a * 6.2 + a * 2, 52.4, k * 4.2 + 4.2], 0.35, white));
    }
    tb.position.set(TB[0], 0, TB[1]); world.add(bake(tb));
    // the Tower of London on the north bank
    const tol = new THREE.Group(), keep = mat(0xcfc6b0);
    tol.add(box(34, 26, 30, facadeMat({ color: 0xcfc6b0, floor: 8, bay: 4.2, frame: [0.36, 0.3], glass: 0x35302a, lit: 0 })), box(110, 9, 3, keep, 0, 0, 44), box(110, 9, 3, keep, 0, 0, -44), box(3, 9, 88, keep, 55, 0, 0), box(3, 9, 88, keep, -55, 0, 0));
    for (const a of [-1, 1]) for (const b of [-1, 1]) tol.add(cyl(3.6, 3.6, 33, keep, a * 17, 0, b * 15, 10), dome(3.9, lead, a * 17, 33, b * 15, { scale: [1, 1.2, 1] }), cyl(5.5, 5.5, 13, keep, a * 55, 0, b * 44, 10));
    tol.position.set(1110, G, zc(1110) - RW - 62); world.add(bake(tol));

    // ---- the ordinary city: brick and stone terraces under slate roofs, glass towers in the City and at Canary Wharf
    const rects = [[-1600, -360, -1260, -240], [-1575, -505, -1425, -435], [-1385, -455, -1275, -350], [-1980, -790, -1520, -500], [-1265, -10, -1075, 70], [-1100, -30, -980, 90], [-170, -310, 50, -190], [-175, 170, 55, 260],
      [515, 285, 605, 375], [712, -338, 788, -262], [1040, -230, 1180, -40], [1225, -110, 1275, 320], [600, -510, 680, -430], [530, -560, 590, -490], [670, -600, 730, -530], [800, -470, 850, -420]];
    const core = (x, z) => Math.exp(-((x - 700) ** 2 + (z + 400) ** 2) / 70000), wharf = (x, z) => Math.exp(-((x - 2550) ** 2 + (z + 420) ** 2) / 50000);
    const lots = cityGrid({
      rand: r, area: [-2800, -1900, 2900, 1500], block: 46, street: 15, jitter: 0.2, split: 0.4, fill: 0.92,
      keep: (x, z) => Math.abs(z - zc(x)) > RW + 28 && !rects.some(([a, b, c, d]) => x > a - 24 && x < c + 24 && z > b - 24 && z < d + 24),
      height: (x, z) => Math.min(r.range(13, 27) + (r.chance(0.55) ? 170 : 30) * core(x, z) * r.range(0.4, 1.1) + (r.chance(0.5) ? 190 : 20) * wharf(x, z) * r.range(0.5, 1.1) + 16 * Math.exp(-((z - zc(x) - 220) ** 2) / 9000) * r(), clear(x, z, 85) - 28),
    });
    const A = [], B = [[640, -470, 62, 48, 278], [560, -525, 36, 36, 183], [700, -565, 40, 40, 230], [825, -445, 34, 34, 190], [2550, -420, 56, 56, 236]].map(([x, z, w, d, h]) => ({ x, z, w, d, h, y: G }));
    const masonry = [0xb79c6e, 0x93604a, 0xd8d0be, 0xa58a68, 0x8e8c88, 0xe2dccd, 0x7d5646, 0xc2b294], glassTones = [0x9db4c4, 0x86a0b4, 0xb7c6cf, 0x6f8ca4, 0xa8b8b8], roofTones = [0x474c55, 0x545a62, 0x66584e, 0x3f444b, 0x7a5a48];
    const roofs = [];
    for (const b of lots) {
      b.y = G;
      if (b.h > 62) { b.color = r.pick(glassTones); B.push(b); continue; }
      b.color = r.pick(masonry); A.push(b);
      if (b.h < 34) { const turn = b.w > b.d; roofs.push({ x: b.x, y: G + b.h, z: b.z, sx: turn ? b.d : b.w, sy: r.range(3, 6.5), sz: turn ? b.w : b.d, ry: turn ? Math.PI / 2 : 0, color: r.pick(roofTones) }); }
    }
    B.forEach((b) => { b.color ??= r.pick(glassTones); });
    world.add(buildings(A, facadeMat({ floor: 3.5, bay: 2.8, frame: [0.3, 0.26], glass: 0x23272e, lit: 0.12, litColor: 0xffd9a0, night: 0.5, rough: 0.9, ground: 1 })));
    world.add(buildings(B, facadeMat({ floor: 4, bay: 2.3, frame: [0.07, 0.12], glass: 0x58788f, lit: 0.1, rough: 0.25, metal: 0.4 })));
    world.add(instances(gable, mat(0xffffff, { rough: 0.7 }), roofs));
    world.add(cyl(0, 40, 26, lead, 2550, G + 236, -420, 4));   // One Canada Square's pyramid

    // ---- green: plane trees along the embankments, St James's Park, Parliament Square
    world.add(box(450, 0.4, 280, mat(0x5d7f45), -1750, G, -645, { cast: false }), box(96, 0.4, 96, mat(0x5d7f45), -1330, G, -402, { cast: false }), box(250, 0.3, 36, mat(0x4f6b78, { rough: 0.15, metal: 0.3 }), -1750, G + 0.3, -640, { cast: false }));
    const tp = [];
    for (let x = -2500; x <= 2200; x += 25) for (const s of [-1, 1]) {
      const z = zc(x) + s * (RW + 8);
      if (spans.some(([bx]) => Math.abs(x - bx) < 16) || Math.abs(x - TB[0]) < 30 || (s < 0 && x > -1580 && x < -1290) || (s > 0 && Math.abs(x - EYE[0]) < 45)) continue;
      tp.push([x + r.range(-3, 3), G, z]);
    }
    for (let i = 0; i < 130; i++) { const x = r.range(-1965, -1535), z = r.range(-780, -510); if (Math.abs(z + 640) > 26) tp.push([x, G, z]); }
    for (let i = 0; i < 14; i++) tp.push([-1330 + r.range(-44, 44), G, -402 + (i % 2 ? 42 : -42)]);
    trees(world, tp, 'round', { size: 12, color: [0x4f7a3c, 0x5f8a42, 0x6f8f3e, 0x8a9440, 0x456f3a], rand: r });

    // ---- broken cloud catching the low sun
    clouds(world, { count: 34, y: [620, 900], size: 190, color: 0xefe9dc, self: 0.3, rand: rng(4), area: [-3600, -3600, 3600, 3600] });

    return { world, path, focus, duration: 48 };
  },
};
