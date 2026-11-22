// Fukuoka at dusk: in over Hakata Bay to the mirror-glass Fukuoka Tower on Momochi beach, over the PayPay Dome, past the castle walls
// and the shrine with its red drum bridge, then low along the Naka river beside the yatai stalls, with the neon of Nakasu in the water.
import { THREE, mergeGeometries, createWorld, rng, clamp, mat, glowMat, facadeMat, mesh, box, cyl, sphere, tube, beam, hipRoof, instances, buildings, cityGrid, water, trees, lights, traffic, sign, clearance } from '../kit.js';

const PI = Math.PI, V2 = THREE.Vector2, UNIT = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
// a gable roof: w wide, h high, d long, ridge along Z
const gable = (w, h, d, m, x, y, z, o) => mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new V2(-w / 2, 0), new V2(w / 2, 0), new V2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), m, x, y, z, o);
// collects static parts and bakes them into one mesh per material
function bag() {
  const map = new Map();
  return {
    add(...ms) { for (const m of ms.flat()) { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; g.applyMatrix4(m.matrix); if (!map.has(m.material)) map.set(m.material, []); map.get(m.material).push(g); } return this; },
    build(o) { return [...map].map(([m, gs]) => mesh(mergeGeometries(gs), m, 0, 0, 0, o)); },
  };
}
// a canvas texture drawn by `draw(ctx, w, h)`
function paint(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
// a battered stone wall block (ishigaki): w by d at the foot, leaning in by `lean`, with wall UVs in metres
function ishigaki(w, d, h, lean) {
  const pos = [], uv = [], A = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], B = A.map(([x, z]) => [x - Math.sign(x) * lean, z - Math.sign(z) * lean]);
  for (let i = 0, u = 0; i < 4; i++) { const j = (i + 1) % 4, l = Math.hypot(A[j][0] - A[i][0], A[j][1] - A[i][1]); pos.push(A[i][0], 0, A[i][1], B[j][0], h, B[j][1], A[j][0], 0, A[j][1], A[i][0], 0, A[i][1], B[i][0], h, B[i][1], B[j][0], h, B[j][1]); uv.push(u, 0, u + l, h, u + l, 0, u, 0, u, h, u + l, h); u += l; }
  pos.push(B[0][0], h, B[0][1], B[2][0], h, B[2][1], B[1][0], h, B[1][1], B[0][0], h, B[0][1], B[3][0], h, B[3][1], B[2][0], h, B[2][1]); uv.push(0, 0, 9, 9, 9, 0, 0, 0, 0, 9, 9, 9);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
// boats: parts [geometry, material] that sail together along straight lines [x0, z0, x1, z1]
function fleet(world, parts, lines, n, speed, r) {
  const items = Array.from({ length: n }, (_, i) => { const l = lines[i % lines.length]; return { l, off: r(), len: Math.hypot(l[2] - l[0], l[3] - l[1]), ry: Math.atan2(l[2] - l[0], l[3] - l[1]) }; });
  const ims = parts.map(([g, m]) => world.add(instances(g, m, items, { cast: false }))), d = new THREE.Object3D();
  world.onUpdate((t) => {
    items.forEach((it, i) => { const u = (it.off + t * speed / it.len) % 1, l = it.l; d.position.set(l[0] + (l[2] - l[0]) * u, 0, l[1] + (l[3] - l[1]) * u); d.rotation.y = it.ry; d.updateMatrix(); for (const im of ims) im.setMatrixAt(i, d.matrix); });
    for (const im of ims) im.instanceMatrix.needsUpdate = true;
  });
}

export default {
  build() {
    const r = rng(1889);
    const world = createWorld({
      sky: { top: 0x1c2468, horizon: 0xff7e40, bottom: 0x2a2c50, haze: 0.2 },
      sun: { dir: [-0.93, 0.07, -0.3], color: 0xff9a5a, power: 1.7, disc: 0xffb478, size: 0.0018 },
      ambient: { sky: 0x7480c8, ground: 0x4a3832, power: 1.35 },
      fog: { color: 0x7a5a6c, density: 0.00034 }, stars: 200, exposure: 1.12, env: 0.9,
    });
    // x is east, z is south; Hakata Bay lies to the north (z < -300), the Naka river runs north at x = 1130..1200. Land stands 2.5 m above the water.
    const path = [[-222, 46, -470], [-160, 50, -320], [-128, 70, -150], [10, 84, -10], [230, 112, 40], [430, 80, 250], [540, 46, 425], [760, 34, 525], [980, 20, 590], [1095, 13, 596], [1150, 10, 515], [1143, 9.5, 300], [1140, 10.5, 120], [1148, 17, -55], [1215, 31, -158], [1430, 34, -168]];
    const TOWER = [-60, -160], DOME = [260, -40], CASTLE = [570, 365], SHRINE = [1560, -240], G = 2.5;
    const focus = [[0.08, TOWER[0], 125, TOWER[1]], [0.15, TOWER[0], 125, TOWER[1]], [0.21, DOME[0], 40, DOME[1]], [0.29, DOME[0], 40, DOME[1]], [0.37, 610, 20, 345], [0.44, 610, 20, 345], [0.63, 1122, 5, 520], [0.67, 1122, 5, 450], [0.72, 1122, 5, 320], [0.78, 1122, 5, 170], [0.8, 1122, 5, 110]];
    const clear = clearance(path), shade = (o) => { o.traverse((c) => { c.userData.shade = true; }); return o; };

    // ---- sea, river and land
    water(world, 0, { size: [9400, 4700], z: -2650, color: 0x2b3a55, rough: 0.16, strength: 0.22, ripple: 130 });
    const river = water(world, 0, { size: [70, 3500], x: 1165, z: 1450, color: 0x0c1220, rough: 0.1, strength: 0.2, ripple: 40 });
    Object.assign(river.material, { transparent: true, opacity: 0.55, depthWrite: false });
    const P = 42, streetGlow = paint(128, 128, (g) => { const w = 12 * 128 / P / 2; g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#4a321c'; g.fillRect(0, 0, 128, w); g.fillRect(0, 128 - w, 128, w); g.fillRect(0, 0, w, 128); g.fillRect(128 - w, 0, w, 128); }, [1, 1]);
    const landMat = mat(0x54565a, { rough: 0.95, emissive: 0xffffff, glow: 1 }); landMat.emissiveMap = streetGlow;
    const slab = (x0, z0, x1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, 5.5, z1 - z0).translate((x0 + x1) / 2, G - 2.75, (z0 + z1) / 2), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / P, p.getZ(i) / P); return g; };
    world.add(mesh(mergeGeometries([slab(-3400, -240, 1130, 3400), slab(-3400, -300, -430, -240), slab(250, -300, 1130, -240), slab(1200, -300, 3400, 3400)]), landMat, 0, 0, 0, { cast: false }));
    const sand = new THREE.BufferGeometry(); sand.setAttribute('position', new THREE.Float32BufferAttribute([-430, G, -240, 250, G, -240, 250, -0.8, -312, -430, G, -240, 250, -0.8, -312, -430, -0.8, -312], 3)); sand.computeVertexNormals();
    world.add(mesh(sand, mat(0xe6cfa0, { rough: 1, side: THREE.DoubleSide }), 0, 0.05, 0, { cast: false }), box(700, 0.2, 26, mat(0x8a8478), -90, G, -226, { cast: false }));

    // ---- Fukuoka Tower: a triangular shaft of mirror glass, lit edges, the mast above
    {
      const [x, z] = TOWER, g = new THREE.Group(), mirror = facadeMat({ color: 0x7f93a8, glass: 0xa9c0d6, floor: 5, bay: 4.6, frame: [0.035, 0.04], lit: 0, rough: 0.08, metal: 0.95 }); mirror.flatShading = true; mirror.envMapIntensity = 1.5;
      const tri = (rt, rb, h, m, y) => mesh(new THREE.CylinderGeometry(rt, rb, h, 3).translate(0, h / 2, 0), m, 0, y, 0), edge = glowMat(0xbfe8ff, 2.4, { toneMapped: false }), steel = mat(0xe8e8ea, { rough: 0.5, metal: 0.4, emissive: 0xffd0a0, glow: 0.35, flat: true });
      g.add(tri(15, 17, 150, mirror, 0), tri(15.5, 15.5, 7, glowMat(0xffe2a8, 1.5), 116), tri(3.5, 15, 22, mirror, 150), tri(1, 3.5, 60, steel, 172), sphere(1.3, glowMat(0xff3020, 4, { toneMapped: false }), 0, 233, 0));
      g.add(mesh(new THREE.CylinderGeometry(40, 44, 9, 3).translate(0, 4.5, 0), mat(0x8c98a4, { rough: 0.3, metal: 0.6, flat: true })));
      for (let k = 0; k < 3; k++) { const a = k * PI * 2 / 3; g.add(beam([Math.sin(a) * 17.2, 9, Math.cos(a) * 17.2], [Math.sin(a) * 15.2, 150, Math.cos(a) * 15.2], 0.7, edge)); }
      g.rotation.y = PI; g.position.set(x, G, z); world.add(shade(g));
      // the evening illumination: a river of lights up the seaward face
      const dots = []; for (let i = 0; i < 90; i++) { const y = 14 + i * 1.1 + r.range(0, 1), w = 5 + 4 * Math.sin(i * 0.21); dots.push([x + r.range(-w, w), G + y, z - 9.2]); }
      lights(world, dots, { color: [0xfff0c0, 0xffffff, 0xa0e0ff, 0xffc0e0], size: 2.6, power: 1.4 });
    }

    // ---- PayPay Dome (titanium roof in three fans) and the Sea Hawk hotel beside it
    {
      const [x, z] = DOME, R = 105, rise = 56, Rs = (R * R + rise * rise) / (2 * rise), g = new THREE.Group();
      const roofTex = paint(1024, 256, (c) => {
        c.fillStyle = '#aab2ba'; c.fillRect(0, 0, 1024, 256);
        for (let k = 0; k < 3; k++) { c.fillStyle = ['rgba(255,255,255,0.10)', 'rgba(60,70,90,0.10)', 'rgba(255,255,255,0.03)'][k]; c.fillRect(k * 1024 / 3, 0, 1024 / 3, 256); }
        c.strokeStyle = 'rgba(40,50,64,0.55)'; c.lineWidth = 1.5; for (let i = 0; i < 72; i++) { c.beginPath(); c.moveTo(i * 1024 / 72, 0); c.lineTo(i * 1024 / 72, 256); c.stroke(); }
        c.lineWidth = 2; for (const v of [20, 70, 130, 190, 240]) { c.beginPath(); c.moveTo(0, v); c.lineTo(1024, v); c.stroke(); }
        c.lineWidth = 5; c.strokeStyle = 'rgba(30,36,48,0.8)'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(k * 1024 / 3 + 2, 0); c.lineTo(k * 1024 / 3 + 2, 256); c.stroke(); }
      });
      const roof = mat(0xffffff, { rough: 0.32, metal: 0.75 }); roof.map = roofTex;
      const wall = facadeMat({ color: 0xc4c8cc, round: 107, floor: 7, bay: 8, frame: [0.2, 0.3], glass: 0x2a3440, lit: 0.6, litColor: 0xffd9a0, night: 1.3 });
      g.add(mesh(new THREE.SphereGeometry(Rs, 72, 14, 0, PI * 2, 0, Math.asin(R / Rs)).translate(0, rise - Rs, 0), roof, 0, 28, 0), cyl(107, 107, 28, wall, 0, 0, 0, 72), cyl(110, 112, 4, mat(0x9aa0a6), 0, 26, 0, 72), cyl(9, 9, 2, mat(0x8a9098, { metal: 0.6, rough: 0.4 }), 0, 83.4, 0, 20));
      g.position.set(x, G, z); world.add(shade(g));
      const rim = []; for (let i = 0; i < 60; i++) { const a = i / 60 * PI * 2; rim.push([x + Math.cos(a) * 112, G + 31, z + Math.sin(a) * 112]); }
      lights(world, rim, { color: 0xfff0d0, size: 5, power: 1.2 });
      const sg = sign('PayPay ドーム', 11, { color: '#ffffff', bg: '#d6202c', glow: 1.6, pad: 0.35 }); sg.position.set(x - 96, G + 17, z - 62); sg.rotation.y = -2.15; world.add(sg);
      const hotel = facadeMat({ color: 0x7f8a98, floor: 3.6, bay: 3, frame: [0.1, 0.2], glass: 0x26384c, lit: 0.3, litColor: 0xffd9a0, night: 1, rough: 0.4, metal: 0.3 });
      world.add(box(28, 138, 96, hotel, 455, G, -175), cyl(14, 14, 138, facadeMat({ color: 0x7f8a98, round: 14, floor: 3.6, bay: 3, frame: [0.1, 0.2], glass: 0x26384c, lit: 0.3, litColor: 0xffd9a0, night: 1, rough: 0.4, metal: 0.3 }), 455, G, -223, 24), box(60, 26, 70, hotel, 418, G, -150));
    }

    // ---- Marizon: the pier off Momochi beach with its gabled halls
    {
      const b = bag(), white = mat(0xe6dfd2, { emissive: 0xffb070, glow: 0.18 }), tiles = mat(0xa8552e, { rough: 0.8 }), deck = mat(0x8a8176), lit = glowMat(0xffd9a0, 1.3);
      b.add(box(18, 4, 150, deck, -60, -1, -372), box(84, 4, 66, deck, -60, -1, -462));
      for (const [dx, dz, w, d, h, ry] of [[-22, -470, 22, 34, 9, 0], [18, -476, 26, 30, 11, 0], [-4, -446, 40, 14, 7, PI / 2], [30, -444, 12, 12, 16, 0]]) b.add(box(w, h, d, white, -60 + dx, 3, dz, { ry }), gable(w + 2, h * 0.55, d + 2, tiles, -60 + dx, 3 + h, dz, { ry }), box(w + 0.3, 2.2, d + 0.3, lit, -60 + dx, 4.2, dz, { ry }));
      world.add(...b.build());
      const lamps = []; for (let zz = -300; zz > -440; zz -= 12) lamps.push([-68, 6.5, zz], [-52, 6.5, zz]); for (let xx = -420; xx < 250; xx += 16) lamps.push([xx, G + 5, -232]);
      lights(world, lamps, { color: 0xffd9a0, size: 3.6, power: 1.2 });
    }

    // ---- Fukuoka Castle ruins: battered stone walls in tiers, a white turret, trees; Ohori pond beside it
    const pines = [], greens = [];
    {
      const [x, z] = CASTLE, stoneTex = paint(256, 256, (c) => { c.fillStyle = '#3c3a36'; c.fillRect(0, 0, 256, 256); for (let row = 0; row < 8; row++) for (let i = 0, px = -r.range(0, 30); px < 256; i++) { const w = r.range(22, 52), v = r.range(96, 150) | 0; c.fillStyle = `rgb(${v},${v - 6},${v - 16})`; c.fillRect(px + 1.5, row * 32 + 1.5, w - 3, 29); px += w; } }, [1 / 14, 1 / 9]);
      const stone = mat(0xffffff, { rough: 0.95 }); stone.map = stoneTex;
      const grass = mat(0x66784c), plaster = mat(0xe9e4d8, { emissive: 0xffa060, glow: 0.12 }), tile = mat(0x3c4046, { rough: 0.7 }), b = bag();
      for (const [dx, dz, w, d, y, h] of [[0, 0, 210, 130, 0, 9], [18, -8, 130, 84, 9, 8], [52, -22, 46, 38, 17, 9], [-120, 30, 60, 60, 0, 6]]) b.add(mesh(ishigaki(w, d, h, h * 0.42), stone, x + dx, G + y, z + dz), box(w - h * 0.84 - 3, 0.3, d - h * 0.84 - 3, grass, x + dx, G + y + h, z + dz));
      // turret on the corner of the upper tier, long storehouse on the lower
      b.add(box(20, 6, 10, plaster, x + 52, G + 26, z - 22), box(10, 4.5, 7, plaster, x + 52, G + 34.6, z - 22), box(44, 5, 8, plaster, x - 52, G + 9, z - 48));
      world.add(...b.build().map(shade), hipRoof(26, 15, 4, tile, x + 52, G + 32, z - 22, { ridge: 0.6 }), hipRoof(15, 11, 3.6, tile, x + 52, G + 39, z - 22, { ridge: 0.4 }), hipRoof(50, 12, 3.4, tile, x - 52, G + 14, z - 48, { ridge: 0.8 }));
      for (let i = 0; i < 130; i++) { const px = x + r.range(-150, 130), pz = z + r.range(-95, 100), dx = px - x, dz = pz - z, y = Math.abs(dx - 18) < 50 && Math.abs(dz + 8) < 30 ? 17 : Math.abs(dx) < 92 && Math.abs(dz) < 52 ? 9 : Math.abs(dx) > 112 || Math.abs(dz) > 72 ? 0 : -1; if (y >= 0 && !(Math.abs(dx - 52) < 30 && Math.abs(dz + 22) < 24) && clear(px, pz, 30) > G + y + 34) (r.chance(0.3) ? pines : greens).push([px, G + y, pz]); }
      const pond = water(world, G + 0.15, { size: [1, 1], x: 290, z: 420, color: 0x2a3550, ripple: 50, strength: 0.25 }); pond.geometry = new THREE.CircleGeometry(1, 40).rotateX(-PI / 2).scale(120, 1, 95); pond.material.normalMap.repeat.set(4, 4);
      world.add(box(330, 0.2, 204, mat(0x55653f, { rough: 1 }), CASTLE[0] - 22, G, CASTLE[1], { cast: false }), cyl(14, 16, 1.6, grass, 290, G, 420, 16), box(3, 0.5, 96, mat(0x8a8176), 290, G + 0.6, 372));
      for (let i = 0; i < 46; i++) { const a = i / 46 * PI * 2; greens.push([290 + Math.cos(a) * 128, G, 420 + Math.sin(a) * 102]); } greens.push([290, G + 1.6, 424], [284, G + 1.6, 414]);
    }

    // ---- the shrine: torii, stone lanterns, pond and red drum bridge, tower gate, great hall, the old camphor tree
    {
      const [x, z] = SHRINE, b = bag(), red = mat(0xd23c1c, { rough: 0.6, emissive: 0xff3010, glow: 0.22 }), black = mat(0x1e1a18), white = mat(0xece6da, { emissive: 0xffa060, glow: 0.15 }), bark = mat(0x6e5c4a, { rough: 0.75 }), stone = mat(0x8c887e), gold = glowMat(0xffc870, 1.5);
      const torii = (tx, s) => { for (const e of [-1, 1]) b.add(cyl(0.5 * s, 0.6 * s, 9 * s, red, tx, G, z + e * 4.6 * s, 10)); b.add(box(0.7 * s, 0.7 * s, 11.6 * s, red, tx, G + 6.6 * s, z), box(1 * s, 0.9 * s, 14 * s, red, tx, G + 8.4 * s, z), box(1.3 * s, 0.4 * s, 15 * s, black, tx, G + 9.3 * s, z)); };
      torii(x - 150, 1.25); torii(x - 92, 1);
      b.add(box(180, 0.25, 7, stone, x - 60, G + 0.1, z, { cast: false }), box(290, 0.2, 118, mat(0x6e685e, { rough: 1 }), x - 40, G, z, { cast: false }));
      // drum bridge over the pond
      const arch = (u) => 5.2 * (1 - u * u), deck = new THREE.PlaneGeometry(30, 5, 20, 1).rotateX(-PI / 2), dp = deck.attributes.position; for (let i = 0; i < dp.count; i++) dp.setY(i, arch(dp.getX(i) / 15)); deck.computeVertexNormals();
      world.add(mesh(deck, mat(0x9a3a22, { side: THREE.DoubleSide, emissive: 0xff3010, glow: 0.15 }), x - 52, G + 0.5, z));
      for (const e of [-1, 1]) { world.add(tube(Array.from({ length: 11 }, (_, i) => [x - 67 + i * 3, G + 1.7 + arch((i - 5) / 5), z + e * 2.5]), 0.16, red, { radial: 5 })); for (let i = 0; i < 9; i++) b.add(box(0.25, 1.3, 0.25, red, x - 64 + i * 3, G + 0.5 + arch((i - 4) / 5), z + e * 2.5)); }
      const pond = water(world, G + 0.15, { size: [1, 1], x: x - 52, z, color: 0x243048, ripple: 30, strength: 0.2 }); pond.geometry = new THREE.CircleGeometry(1, 32).rotateX(-PI / 2).scale(24, 1, 30); pond.material.normalMap.repeat.set(2, 2);
      // tower gate (romon) and the hall behind it, joined by roofed corridors
      b.add(box(5, 6.5, 4, red, x - 16, G, z - 5), box(5, 6.5, 4, red, x - 16, G, z + 5), box(6, 1, 15, red, x - 16, G + 6.5, z), box(5, 4.5, 11, white, x - 16, G + 9.5, z), box(6.4, 0.5, 12.4, red, x - 16, G + 9.2, z));
      b.add(box(26, 1.2, 34, stone, x + 44, G, z), box(18, 6.2, 24, white, x + 44, G + 1.2, z), box(18.6, 0.6, 24.6, red, x + 44, G + 6.8, z), box(8, 5, 12, white, x + 60, G + 1.2, z), box(5, 0.4, 9, gold, x + 34.6, G + 3, z));
      for (let i = 0; i < 7; i++) b.add(box(0.6, 6.2, 0.6, red, x + 34.7, G + 1.2, z - 12 + i * 4), box(0.6, 6.2, 0.6, red, x + 53.3, G + 1.2, z - 12 + i * 4));
      for (const e of [-1, 1]) b.add(box(46, 4, 2.4, white, x + 7, G, z + e * 24), box(46, 0.5, 4, red, x + 7, G + 4, z + e * 24), box(2.4, 4, 17, white, x - 16, G, z + e * 15.5));
      world.add(...b.build().map(shade));
      world.add(hipRoof(13, 21, 3, bark, x - 16, G + 7, z, { ridge: 0.3, curve: 1.4, lift: 1.2 }), hipRoof(12, 20, 5, bark, x - 16, G + 14, z, { ridge: 0.35, curve: 1.9, lift: 1.6 }));
      world.add(hipRoof(30, 38, 9.5, bark, x + 44, G + 7.4, z, { ridge: 0.3, curve: 1.9, lift: 2.6 }), hipRoof(13, 17, 4.5, bark, x + 60, G + 6.2, z, { ridge: 0.3, curve: 1.7, lift: 1.2 }), hipRoof(50, 5, 1.6, bark, x + 7, G + 4.5, z - 24, { ridge: 0.9 }), hipRoof(50, 5, 1.6, bark, x + 7, G + 4.5, z + 24, { ridge: 0.9 }));
      // stone lanterns along the approach, paper lanterns under the gate
      const toro = [], glow = [];
      for (let i = 0; i < 12; i++) for (const e of [-1, 1]) { if (i > 4 && i < 9) continue; const lx = x - 160 + i * 12; toro.push({ x: lx, y: G, z: z + e * 5.6 }); glow.push([lx, G + 2.5, z + e * 5.6]); }
      for (let i = 0; i < 7; i++) glow.push([x - 18.6, G + 6, z - 6 + i * 2], [x + 34, G + 5.6, z - 9 + i * 3]);
      world.add(instances(mergeGeometries([new THREE.CylinderGeometry(0.25, 0.4, 2, 6).translate(0, 1, 0), new THREE.BoxGeometry(0.9, 0.8, 0.9).translate(0, 2.4, 0), new THREE.ConeGeometry(0.95, 0.7, 4).rotateY(PI / 4).translate(0, 3.15, 0)]), stone, toro));
      lights(world, glow, { color: 0xffb060, size: 3.4, power: 1.5 });
      // the great camphor: a thick trunk bound with a sacred rope, a wide crown of many clumps
      const cx = x + 20, cz = z - 48, crown = [];
      world.add(cyl(2, 3, 9, bark, cx, G, cz, 10), mesh(new THREE.TorusGeometry(2.7, 0.3, 6, 16).rotateX(PI / 2), mat(0xe8dcc0), cx, G + 3, cz));
      for (const [a, len] of [[0.4, 9], [2.3, 10], [4.2, 9], [5.5, 8]]) world.add(beam([cx, G + 7, cz], [cx + Math.cos(a) * len, G + 15, cz + Math.sin(a) * len], 1.3, bark));
      for (let i = 0; i < 16; i++) { const a = i * 2.4, d = i ? r.range(5, 15) : 0; crown.push({ x: cx + Math.cos(a) * d, y: G + r.range(14, 21) - d * 0.25, z: cz + Math.sin(a) * d, s: r.range(6, 9), sy: r.range(4.5, 6), color: r.pick([0x2f5a34, 0x3a6a3a, 0x2a4f30]) }); }
      world.add(instances(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff, { flat: true }), crown));
      for (let i = 0; i < 70; i++) { const px = x + r.range(-170, 95), pz = z + r.range(-75, 75); if ((Math.abs(pz - z) > 30 || px > x + 66) && Math.hypot(px - cx, pz - cz) > 20 && clear(px, pz, 26) > 40) (r.chance(0.35) ? pines : greens).push([px, G, pz]); }
    }

    // ---- the yatai: a long row of food stalls on the west bank, lanterns, noren, steam, customers on their stools
    {
      const X = 1119, K = 1.8, wood = mat(0x3a2a20, { rough: 0.9 }), stalls = [], roofs = [], lanterns = [], people = [], warm = [], redDots = [], noren = [], shops = ['ラーメン', 'おでん', '焼き鳥', '天ぷら', '餃子', 'もつ鍋', '博多屋台', '明太子'];
      const atlas = paint(512, 512, (c) => { shops.forEach((t, i) => { c.fillStyle = ['#b3221c', '#1f2f6a', '#f2ead8', '#7a1c18', '#274a3a', '#b3221c', '#f2ead8', '#1f2f6a'][i]; c.fillRect(0, i * 64, 512, 64); c.fillStyle = i === 2 || i === 6 ? '#8a1a14' : '#fff6e0'; c.font = '700 46px "Noto Sans CJK JP","WenQuanYi Zen Hei",sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; [...t].forEach((ch, k, a) => c.fillText(ch, 512 * (k + 0.5) / a.length, i * 64 + 34)); c.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 1; k < 4; k++) c.fillRect(k * 128 - 1, i * 64 + 20, 2, 44); }); });
      // one stall, front towards +X: posts, counter, back and side boards
      const frame = mergeGeometries([...[[-1.6, -2.6], [-1.6, 2.6], [1.6, -2.6], [1.6, 2.6]].map(([a, c]) => new THREE.BoxGeometry(0.14, 2.6, 0.14).translate(a, 1.3, c)), new THREE.BoxGeometry(0.7, 1, 5.2).translate(1.15, 0.5, 0), new THREE.BoxGeometry(0.12, 2.5, 5.4).translate(-1.65, 1.25, 0), new THREE.BoxGeometry(3.2, 1.1, 0.12).translate(0, 0.55, -2.65), new THREE.BoxGeometry(3.2, 1.1, 0.12).translate(0, 0.55, 2.65)]);
      for (let z = 548, i = 0; z > 76; z -= 14.5, i++) {
        stalls.push({ x: X, y: G, z, s: K }); roofs.push({ x: X + 0.3, y: G + 2.6 * K, z, s: K, rz: -0.07, color: r.pick([0xb3261e, 0x1f3a7a, 0xe8e0cc, 0x2a5a40, 0xc8a030]) });
        const row = i % shops.length, pg = new THREE.PlaneGeometry(5 * K, 0.95 * K).rotateY(PI / 2).translate(X + 1.75 * K, G + 2.1 * K, z), uv = pg.attributes.uv; for (let k = 0; k < 4; k++) uv.setY(k, 1 - (row + 1 - uv.getY(k)) / 8); noren.push(pg);
        for (const e of [-1, 1]) { lanterns.push({ x: X + 1.9 * K, y: G + 1.75 * K, z: z + e * 2.95 * K, s: K }); redDots.push([X + 2 * K, G + 1.75 * K, z + e * 2.95 * K]); }
        lanterns.push({ x: X + 2.1 * K, y: G + 2 * K, z: z + 5.4, s: 2.6 }); redDots.push([X + 2.2 * K, G + 2 * K, z + 5.4]); warm.push([X + 1, G + 2.4, z]);
        for (let k = 0; k < 5; k++) if (r.chance(0.8)) people.push({ x: X + 2.15 * K + r.range(-0.1, 0.2), y: G, z: z - 3.1 + k * 1.55, sx: 0.6, sy: r.range(1.5, 1.8), sz: 0.5, color: r.pick([0x1c1c24, 0x2a2430, 0x3a3038, 0x20283a, 0x4a3a34]) });
        if (r.chance(0.6)) people.push({ x: X + r.range(5.5, 8.5), y: G, z: z + r.range(-6, 6), sx: 0.55, sy: 1.75, sz: 0.45, color: 0x22222a });
      }
      world.add(instances(frame, wood, stalls, { cast: false }), instances(new THREE.BoxGeometry(4.2, 0.14, 6.2), mat(0xffffff, { rough: 0.8 }), roofs, { cast: false }), instances(mergeGeometries([new THREE.BoxGeometry(0.08, 1.9, 5.2).translate(-1.55, 1.35, 0), new THREE.BoxGeometry(0.72, 0.06, 5.2).translate(1.15, 1.04, 0)]), glowMat(0xffc070, 1.6, { toneMapped: false }), stalls, { cast: false }));
      world.add(instances(new THREE.SphereGeometry(0.3, 10, 8).scale(1, 1.3, 1), glowMat(0xff3418, 2, { toneMapped: false }), lanterns, { cast: false }), instances(UNIT(), mat(0xffffff, { rough: 0.9 }), people, { cast: false }), mesh(mergeGeometries(noren), glowMat(0xffffff, 1.25, { map: atlas, side: THREE.DoubleSide }), 0, 0, 0, { cast: false }));
      lights(world, redDots, { color: 0xff4020, size: 4, power: 1.3 }); lights(world, warm, { color: 0xffb060, size: 16, power: 0.8 });
      // steam curling up from the pots
      const n = stalls.length * 4, sp = new Float32Array(n * 3), steam = lights(world, sp, { color: 0xfff0e0, size: 3.4, power: 0.22 });
      world.onUpdate((t) => { for (let i = 0; i < n; i++) { const st = stalls[i >> 2], u = (t * 0.22 + i * 0.37) % 1; sp[i * 3] = st.x + 0.6 + Math.sin(t * 0.7 + i) * 0.7 * u + u * 1.6; sp[i * 3 + 1] = G + 4.3 + u * 7; sp[i * 3 + 2] = st.z + ((i & 3) - 1.5) * 1.6 + Math.cos(t * 0.5 + i * 2) * 0.8 * u; } steam.geometry.attributes.position.needsUpdate = true; });
      // promenade: paving, a string of bulbs along the river rail
      world.add(box(24, 0.2, 520, mat(0x5a544e, { rough: 0.8, emissive: 0xff9a50, glow: 0.14 }), 1118, G, 315, { cast: false }));
      const bulbs = []; for (let z = 560; z > 60; z -= 3.2) bulbs.push([1129.4, G + 1.4, z]); lights(world, bulbs, { color: 0xffe0a0, size: 1.5, power: 1.2 });
    }

    // ---- Nakasu across the river: neon-fronted buildings, and their mirror image under the see-through water
    const nakasu = new THREE.Group();
    {
      const NEON = ['#ff3b6b', '#ffd23b', '#37e0ff', '#7dff6b', '#ff7a2b', '#e07bff', '#ffffff'], words = ['中洲', '博多ラーメン', 'カラオケ', '居酒屋', '焼鳥', 'サウナ', 'ホテル', 'パチンコ', 'クラブ', '寿司', 'うどん', '酒', 'もつ鍋', 'スナック', '明太子', 'バー', '麻雀', '焼肉', '博多', '屋台'];
      const row = []; let i = 0;
      for (let z = 640; z > 20; ) {
        const w = r.range(22, 34), h = r.range(24, 52); z -= w / 2; row.push({ x: 1224, z, w: 34, d: w - 1.5, h, y: G, color: r.pick([0x4a4650, 0x5a5660, 0x3e3c48, 0x66606a]) });
        for (const off of [0]) { const t = words[i++ % words.length], c = r.pick(NEON), inv = r.chance(0.4), sh = Math.min(h - 6, t.length * 4.6 + 2), sg = sign(t, sh, { vertical: true, color: inv ? '#fff' : c, bg: inv ? (c === '#ffffff' ? '#c01030' : c) : '#12060e', glow: 2.2, pad: 0.2 }); sg.position.set(1206.5, G + r.range(5, h - sh - 1) + sh / 2, z + off); sg.rotation.y = -PI / 2; nakasu.add(sg); }
        if (h > 44) { const t = words[i++ % words.length], sg = sign(t, 7, { color: r.pick(NEON), bg: null, glow: 2.4 }); sg.position.set(1207.5, G + h + 4.5, z); sg.rotation.y = -PI / 2; nakasu.add(sg); }
        z -= w / 2;
      }
      nakasu.add(buildings(row, facadeMat({ floor: 3.6, bay: 3, frame: [0.24, 0.28], glass: 0x14141c, lit: 0.6, litColor: 0xffc890, night: 1.5 }), { cast: false }));
      nakasu.add(box(1.2, 4, 600, glowMat(0xffb070, 1.1), 1206, G, 330, { cast: false }));
      const mirror = nakasu.clone(true); mirror.scale.y = -1; world.add(nakasu, mirror);
      world.add(box(84, 1.6, 16, mat(0x6a6660), 1165, G - 0.6, 700));
    }

    // ---- the ordinary city: low and dense, taller round Momochi and Tenjin, windows coming on
    const EXPWY = [[-2600, 150], [-600, 150], [150, 190], [700, 130], [985, 60], [1000, -200]];
    const distLine = (L, x, z) => { let best = 1e9; for (let i = 0; i < L.length - 1; i++) { const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; };
    const tall = (x, z) => 45 * Math.exp(-((x - 100) ** 2) / 500 ** 2 - ((z + 60) ** 2) / 200 ** 2) + 60 * Math.exp(-((x - 850) ** 2 + (z - 200) ** 2) / 220 ** 2) + 40 * Math.exp(-((x - 1500) ** 2 + (z - 400) ** 2) / 300 ** 2);
    const lots = cityGrid({
      rand: r, area: [-2600 + 6, -234, 2600, 2500], block: 30, street: 12, jitter: 0.35, split: 0.2, palette: [0xc9c6be, 0xb5b2aa, 0xd8d2c4, 0x9a968e, 0xa89e90, 0x8e8a86, 0x7a7670],
      keep: (x, z) => !(x > 1095 && x < 1245 && z < 720 && z > -30) && !(x > 1110 && x < 1220) && Math.hypot(x - TOWER[0], z - TOWER[1]) > 70 && Math.hypot(x - DOME[0], z - DOME[1]) > 135 && !(Math.abs(x - 440) < 55 && Math.abs(z + 175) < 75) && !(Math.abs(x - CASTLE[0] + 20) < 160 && Math.abs(z - CASTLE[1]) < 100) && ((x - 290) / 150) ** 2 + ((z - 420) / 125) ** 2 > 1 && !(Math.abs(x - SHRINE[0] + 35) < 150 && Math.abs(z - SHRINE[1]) < 92) && distLine(EXPWY, x, z) > 32 && !(z < -200 && x > -440 && x < 260),
      height: (x, z) => (clear(x, z, 30) < 60 ? 0 : Math.min(r.range(8, 20) + tall(x, z) * r.range(0.4, 1.2), Math.max(6.5, clear(x, z, 80) - 26 - G))),
    });
    lots.forEach((b) => { b.y = G; });
    world.add(buildings(lots, facadeMat({ floor: 3.3, bay: 3, frame: [0.26, 0.3], glass: 0x1c222c, lit: 0.5, litColor: 0xffcf90, night: 1.35, rough: 0.85 }), { cast: false }));
    const backs = []; for (let z = 560; z > 70; z -= 26) backs.push({ x: 1090, z, w: 26, d: 24, h: r.range(14, 26), y: G, color: r.pick([0x8a8680, 0x9a948c, 0x76726c]) });
    world.add(buildings(backs, facadeMat({ floor: 3.3, bay: 3, frame: [0.26, 0.3], glass: 0x1c222c, lit: 0.6, litColor: 0xffcf90, night: 1.4 }), { cast: false }));

    // ---- the urban expressway on its piers, street traffic, Hakata Port Tower at the river mouth
    {
      const y = G + 13, c = new THREE.CatmullRomCurve3(EXPWY.map(([x, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.3), n = Math.round(c.getLength() / 16), pts = c.getSpacedPoints(n), pos = [], idx = [], piers = [], lamps = [];
      pts.forEach((p, i) => { const t = c.getTangentAt(i / n); pos.push(p.x - t.z * 9, y, p.z + t.x * 9, p.x + t.z * 9, y, p.z - t.x * 9); if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); if (i % 2 === 0) { piers.push({ x: p.x, y: G, z: p.z, sx: 2.4, sy: 12.6, sz: 2.4 }); lamps.push([p.x, y + 7, p.z]); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      world.add(mesh(g, mat(0x5a5c60, { side: THREE.DoubleSide }), 0, 0, 0, { cast: false }), instances(UNIT(), mat(0x77797c), piers, { cast: false }));
      lights(world, lamps, { color: 0xffb060, size: 4, power: 1.1 });
      const lane = (d) => pts.filter((_, i) => i % 3 === 0).map((p, i, a) => { const t = c.getTangentAt(Math.min(1, i * 3 / n)); return [p.x - t.z * d, y + 1, p.z + t.x * d]; });
      traffic(world, lane(4), { count: 110, color: 0xfff2d8, size: 3.4, speed: 24, spread: 2 }); traffic(world, lane(-4).reverse(), { count: 110, color: 0xff3a2a, size: 3.4, speed: 24, spread: 2 });
      for (const [a, b2] of [[[-2000, 4, 276], [1090, 4, 276]], [[1090, 4, 282], [-2000, 4, 282]], [[738, 4, -200], [738, 4, 2200]], [[1284, 4, 2200], [1284, 4, -280]], [[-900, 4, -206], [1090, 4, -206]]]) traffic(world, [a, b2], { count: 60, color: a[0] < b2[0] || a[2] < b2[2] ? 0xfff2d8 : 0xff3a2a, size: 3, speed: 13, spread: 3 });
      const red = mat(0xc8321e, { rough: 0.5, emissive: 0xff2a10, glow: 0.5 });
      world.add(cyl(3.5, 9, 72, red, 1050, G, -250, 8), cyl(10, 8, 9, mat(0xd9dde0, { emissive: 0xffe0a0, glow: 0.8 }), 1050, G + 72, -250, 12), cyl(0.5, 2, 24, red, 1050, G + 81, -250, 6));
    }

    // ---- trees: pines and broadleaf round the castle and shrine, palms on the beach
    shade(trees(world, greens, 'round', { size: 11, color: [0x2f4a2c, 0x3a5632, 0x44603a, 0x56602c], rand: r })); shade(trees(world, pines, 'conifer', { size: 15, rand: r }));
    trees(world, Array.from({ length: 42 }, (_, i) => [-415 + i * 16, G, -222 + (i % 2) * 5]), 'palm', { size: 11, rand: r });

    // ---- Hakata Bay: ferries with their lights on, the long sandbar of Umi-no-Nakamichi, hills against the afterglow
    const hull = mat(0xe8e8ea, { rough: 0.5 });
    fleet(world, [[mergeGeometries([new THREE.BoxGeometry(14, 6, 70).translate(0, 1.5, 0), new THREE.BoxGeometry(11, 5, 44).translate(0, 7, -4), new THREE.BoxGeometry(4, 5, 6).translate(0, 12, -14)]), hull], [mergeGeometries([new THREE.BoxGeometry(14.3, 1, 60).translate(0, 3.4, 0), new THREE.BoxGeometry(11.3, 1.2, 40).translate(0, 7.4, -4)]), glowMat(0xffe0a0, 1.5)]],
      [[-2400, -1500, 1000, -520], [900, -700, -2600, -1900], [300, -2300, 1150, -420], [-1500, -900, 2600, -1300]], 5, 6, r);
    fleet(world, [[new THREE.BoxGeometry(3, 2, 9).translate(0, 0.5, 0), hull], [new THREE.BoxGeometry(2, 1.2, 3).translate(0, 2, -1), glowMat(0xffd080, 1.6)]], [[-900, -420, 700, -560], [600, -800, -1200, -640], [-300, -1100, 1000, -900]], 9, 3, r);
    {
      const sandM = mat(0xb89a78), bar = [], far = [], hills = [];
      for (let i = 0; i < 9; i++) { const x = -3000 + i * 560, z = -2500 - 220 * Math.sin(i * 0.5); bar.push(new THREE.BoxGeometry(600, 5, 150).rotateY(-0.38 * Math.cos(i * 0.5)).translate(x, 0.5, z)); for (let k = 0; k < 22; k++) far.push([x + r.range(-280, 280), 3, z + r.range(-50, 50), r.range(1, 1.6)]); }
      world.add(mesh(mergeGeometries(bar), sandM, 0, 0, 0, { cast: false })); trees(world, far, 'conifer', { size: 16, rand: r }).traverse((o) => { o.castShadow = false; });
      for (let i = 0; i < 40; i++) { const a = -0.5 + i / 40 * 4.2, d = r.range(3300, 4000); hills.push({ x: Math.cos(a) * d, y: 0, z: Math.sin(a) * d + 400, sx: r.range(500, 900), sy: r.range(160, 420), sz: r.range(500, 900) }); }
      hills.push({ x: -3300, y: 0, z: -2700, sx: 520, sy: 170, sz: 400 }, { x: -1500, y: 0, z: -3600, sx: 700, sy: 200, sz: 500 });
      world.add(instances(new THREE.ConeGeometry(1, 1, 9).translate(0, 0.5, 0), mat(0x2c3048, { rough: 1 }), hills, { cast: false, receive: false }));
    }

    world.scene.traverse((o) => { if (!o.userData.shade) o.castShadow = false; });
    return { world, path, focus, duration: 50 };
  },
};
