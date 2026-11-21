// Moscow on a snowy winter afternoon: in over the Historical Museum, down Red Square between GUM and the Kremlin wall,
// close around St Basil's Cathedral, then out along the frozen Moskva towards one of Stalin's Seven Sisters.
import { THREE, mergeGeometries, createWorld, rng, mat, glowMat, facadeMat, box, mesh, instances, buildings, cityGrid, water, trees, lights, traffic, particles, clouds, clearance } from '../kit.js';

const TAU = Math.PI * 2;
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
/** Cylinder or frustum standing on y=0, turned so a face (not an edge) looks along each axis. */
const C = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0).rotateY(Math.PI / seg);
/** An upright half-disc facing +Z: a kokoshnik gable. */
const gable = (r, t = 0.5) => new THREE.CylinderGeometry(r, r, t, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
/** Collects static pieces that share a material and merges them into one mesh. */
function pile(material) {
  const list = [];
  return {
    add(g, x = 0, y = 0, z = 0, ry = 0) { g = g.index ? g.toNonIndexed() : g; if (ry) g.rotateY(ry); list.push(g.translate(x, y, z)); return this; },
    ring(make, n, R, x, y, z, phase = 0) { for (let i = 0; i < n; i++) { const a = phase + i / n * TAU; this.add(make(), x + Math.sin(a) * R, y, z + Math.cos(a) * R, a); } return this; },
    mesh(o) { return mesh(mergeGeometries(list), material, 0, 0, 0, o); },
  };
}
const ONION = [[0.6, 0], [0.9, 0.2], [1, 0.48], [0.9, 0.78], [0.66, 1.05], [0.4, 1.3], [0.2, 1.55], [0.07, 1.8], [0, 2]];
/** An onion dome of radius r (2r tall), base at y=0. */
function onionGeo(r, seg = 20, rows = 18) {
  const pts = new THREE.SplineCurve(ONION.map(([a, b]) => new THREE.Vector2(a * r, b * r))).getPoints(rows);
  for (const p of pts) p.x = Math.max(p.x, 0.001);
  return new THREE.LatheGeometry(pts, seg);
}
/** A painted, sculpted onion dome: kind 'swirl' | 'rib' | 'zig' | 'stud', two colours, n repeats around, k turns or rows. */
function onion(r, kind, a, b, n = 8, k = 2) {
  const fr = (v) => v - Math.floor(v);
  const f = (x, y) => {   // -> [which colour 0..1, relief 0..1, shade]
    if (kind === 'stud') { const row = Math.floor(k * y), d = Math.abs(fr(x + 0.5 * (row % 2)) - 0.5) + Math.abs(fr(k * y) - 0.5); return [d < 0.42 ? 0 : 1, Math.max(0, 1 - d * 2.4), d < 0.42 ? 1.15 - d : 0.9]; }
    const s = fr(x + (kind === 'zig' ? 0.5 * Math.abs(fr(k * y) * 2 - 1) : kind === 'rib' ? 0 : k * y)), c = Math.cos(TAU * (s - 0.25));
    return [s < 0.5 ? 0 : 1, c * 0.5 + 0.5, 0.82 + 0.18 * Math.abs(c)];
  };
  const W = 64, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), rgb = [a, b].map((h) => [h >> 16 & 255, h >> 8 & 255, h & 255]);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const [m, , sh] = f(px / W, 1 - py / H), i = (py * W + px) * 4;
    for (let q = 0; q < 3; q++) img.data[i + q] = Math.min(255, rgb[m][q] * sh); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(n, 1); tex.anisotropy = 4;
  const g = onionGeo(r, n * 6, 30), p = g.attributes.position, uv = g.attributes.uv, amp = kind === 'stud' ? 0.09 : 0.06;
  for (let i = 0; i < p.count; i++) { const s = 1 + amp * f(fr(uv.getX(i) * n), uv.getY(i))[1]; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
  g.computeVertexNormals();
  return mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
}
function starGeo(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; s[i ? 'lineTo' : 'moveTo'](Math.sin(a) * q, Math.cos(a) * q); }
  return new THREE.ExtrudeGeometry(s, { depth: r * 0.3, bevelEnabled: false }).translate(0, 0, -r * 0.15);
}

export default {
  build() {
    const r = rng(1147);
    const world = createWorld({
      sky: { top: 0x2a66d6, horizon: 0xffc2b6, bottom: 0xd6c4d6, haze: 0.42 },
      sun: { dir: [-0.8, 0.2, -0.42], color: 0xffc4b0, power: 2.5, disc: 0xffc8b0, size: 0.0007 },
      ambient: { sky: 0xbcc6ea, ground: 0xdccbd2, power: 1.0 },
      fog: { color: 0xefc4c8, density: 0.00055 }, exposure: 1.0, env: 0.8,
    });
    const path = [[30, 96, -1010], [24, 91, -840], [12, 80, -580], [0, 68, -330], [-5, 38, -150], [-12, 32, 20], [-44, 34, 135], [-70, 38, 235], [-24, 42, 328], [80, 42, 352], [230, 36, 420], [460, 30, 480], [700, 30, 490], [930, 38, 452], [1150, 50, 378]];
    const focus = [[0.14, 10, 36, 235], [0.42, 10, 36, 235], [0.5, 10, 40, 235], [0.6, 10, 40, 235], [0.7, 1440, 100, 270], [0.8, 1440, 100, 270]];
    const clear = clearance(path);

    // materials and the piles of static detail that share them
    const brickM = mat(0x9c3b2d, { rough: 0.9 }), whiteM = mat(0xf1ede6, { rough: 0.8 }), greenM = mat(0x2f6b55, { rough: 0.6 }), goldM = mat(0xe2a52a, { metal: 0.9, rough: 0.28, env: 1.6 });
    const darkM = mat(0x1d1a1c, { rough: 0.6 }), snowM = mat(0xf4f6fb, { rough: 0.95 }), stoneM = mat(0x8d8f98, { rough: 0.9 });
    const brick = pile(brickM), white = pile(whiteM), green = pile(greenM), gold = pile(goldM), dark = pile(darkM), snow = pile(snowM), stone = pile(stoneM), stars = pile(glowMat(0xff1c2c, 2.2, { toneMapped: false }));
    const glows = [], lamps = [];
    const crossOn = (g) => (x, y, z, s = 1) => g.add(B(0.3 * s, 4.4 * s, 0.3 * s), x, y, z).add(B(2 * s, 0.3 * s, 0.3 * s), x, y + 2.9 * s, z).add(B(1.1 * s, 0.25 * s, 0.3 * s), x, y + 3.6 * s, z), cross = crossOn(gold);
    const star = (x, y, z, s = 2.3) => { stars.add(starGeo(s), x, y, z).add(starGeo(s).rotateY(Math.PI / 2), x, y, z); gold.add(C(0.25, 0.4, 3, 6), x, y - s - 2.4, z); glows.push([x, y, z]); };

    // ---- snow-covered land, the frozen river with drifts of snow on the ice
    water(world, -4, { color: 0xc4d8ea, rough: 0.32, metal: 0.1, strength: 0.12, speed: 0, ripple: 240 });
    world.add(box(6000, 6, 3000, snowM, 0, -6, -1080, { cast: false }), box(6000, 6, 3000, snowM, 0, -6, 2060, { cast: false }));
    world.add(box(6000, 5.4, 6, stoneM, 0, -5, 421), box(6000, 5.4, 6, stoneM, 0, -5, 559));
    const drifts = []; for (let i = 0; i < 150; i++) { const x = r.range(-2200, 2400), z = r.range(430, 550); drifts.push({ x, y: -3.9, z, sx: r.range(15, 60), sz: r.range(5, 16), ry: r.range(-0.3, 0.3) }); }
    world.add(instances(new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2), snowM, drifts, { cast: false }));
    // Red Square's cobbles under a dusting of snow, and the cleared embankment roads
    const paveM = mat(0xc6c2c8, { rough: 0.9 }), roadM = mat(0xa29c9e, { rough: 0.85 });
    world.add(box(176, 0.3, 560, paveM, -6, 0, -40, { cast: false }), box(4200, 0.3, 16, roadM, 0, 0, 398, { cast: false }), box(4200, 0.3, 16, roadM, 0, 0, 582, { cast: false }), box(24, 0.3, 1940, roadM, 22, 0, -1342, { cast: false }));

    // ---- St Basil's Cathedral: nine painted onion domes on brick towers around a tented spire (built a quarter over life size, as the eye remembers it)
    const basils = new THREE.Group(); basils.position.set(10, 0, 235); basils.scale.setScalar(1.25);
    {
      const brick = pile(brickM), white = pile(whiteM), green = pile(greenM), gold = pile(goldM), dark = pile(darkM), cross = crossOn(gold);
      brick.add(B(54, 6.5, 54)).add(B(50, 4.5, 50), 0, 6.5, 0); white.add(B(55, 0.7, 55), 0, 6.5, 0).add(B(50.6, 0.6, 50.6), 0, 10.6, 0); green.add(C(30, 36.5, 2.4, 4), 0, 11, 0);
      for (let i = -3; i <= 3; i++) for (const [dx, dz, ry] of [[i * 7, 27.2, 0], [i * 7, -27.2, 0], [27.2, i * 7, 1.571], [-27.2, i * 7, 1.571]]) { white.add(gable(2.6, 0.5), dx, 6.9, dz, ry); dark.add(gable(1.9, 0.7), dx, 6.9, dz, ry); dark.add(B(1.6, 3.4, 0.6), dx, 1.2, dz, ry); }
      const chapel = (x, z, R, y1, hd, rd, dome) => {
        const yd = y1 + R * 0.75, hs = y1 - 11;
        brick.add(C(R, R, hs, 8), x, 11, z).add(C(R * 0.74, R, R * 0.75, 8), x, y1, z).add(C(R * 0.7, R * 0.7, hd, 12), x, yd, z);
        white.add(C(R + 0.3, R + 0.3, 0.6, 8), x, 11 + hs * 0.5, z).add(C(R + 0.35, R + 0.35, 0.7, 8), x, y1 - 0.7, z).add(C(R * 0.78, R * 0.78, 0.6, 12), x, yd + hd - 0.6, z).add(C(R * 0.76, R * 0.76, 0.4, 12), x, yd, z);
        white.ring(() => B(0.5, hs, 0.5), 8, R * 1.01, x, 11, z, Math.PI / 8).ring(() => gable(R * 0.4, 0.5), 8, R * 0.94, x, y1, z).ring(() => gable(R * 0.33, 0.5), 8, R * 0.8, x, y1 + R * 0.36, z, Math.PI / 8);
        brick.ring(() => gable(R * 0.27, 0.7), 8, R * 0.94, x, y1, z).ring(() => gable(R * 0.2, 0.7), 8, R * 0.8, x, y1 + R * 0.36, z, Math.PI / 8);
        dark.ring(() => B(R * 0.2, hd * 0.55, 0.4), 6, R * 0.68, x, yd + hd * 0.22, z).ring(() => B(R * 0.22, hs * 0.22, 0.4), 8, R * 0.9, x, 11 + hs * 0.62, z).ring(() => B(R * 0.22, hs * 0.2, 0.4), 8, R * 0.9, x, 11 + hs * 0.16, z);
        dome.position.set(x, yd + hd, z); basils.add(dome); cross(x, yd + hd + rd * 1.95, z, rd / 5);
      };
      chapel(0, -17.5, 4.8, 27, 6, 5.2, onion(5.2, 'swirl', 0x2b5fb4, 0xf2efe6, 8, 2));     // north: blue and white spiral
      chapel(-17.5, 0, 4.8, 25, 6, 5.2, onion(5.2, 'zig', 0xd8a31e, 0x2c7a45, 8, 3));       // west: green and yellow chevrons
      chapel(0, 17.5, 4.8, 24, 5, 5.2, onion(5.2, 'stud', 0xc73828, 0x2c7446, 10, 7));      // south: red studs on green
      chapel(17.5, 0, 4.8, 25, 5, 5.2, onion(5.2, 'swirl', 0xc93a2a, 0xf2efe6, 8, -2));     // east: red and white spiral
      chapel(-12, -12, 3.3, 18.5, 4, 3.7, onion(3.7, 'rib', 0x2f8a52, 0xe8c63a, 10));       // the four lower chapels on the diagonals
      chapel(12, -12, 3.3, 18.5, 4, 3.7, onion(3.7, 'stud', 0xe0b22a, 0x2a61a8, 8, 6));
      chapel(-12, 12, 3.3, 18, 4, 3.7, onion(3.7, 'swirl', 0xd0582a, 0x2f7d4c, 8, 3));
      chapel(12, 12, 3.3, 18, 4, 3.7, onion(3.7, 'rib', 0x3565b8, 0xf2efe6, 12));
      // the central church: octagon, tiers of kokoshniki, the tall tent and its small gold dome
      brick.add(C(7, 7, 23, 8), 0, 11, 0).add(C(5.4, 7, 6, 8), 0, 34, 0).add(C(5.2, 5.2, 4, 8), 0, 40, 0).add(C(1.5, 5.6, 17, 8), 0, 44, 0).add(C(1.4, 1.4, 3, 8), 0, 61, 0);
      white.add(C(7.4, 7.4, 0.8, 8), 0, 33.2, 0).add(C(5.7, 5.7, 0.7, 8), 0, 43.6, 0).add(C(1.8, 1.8, 0.5, 8), 0, 60.8, 0).ring(() => B(0.6, 22, 0.6), 8, 7.05, 0, 11, 0, Math.PI / 8);
      for (let t = 0; t < 3; t++) { white.ring(() => gable(2.3 - t * 0.4, 0.5), 8, 6.6 - t * 0.65, 0, 34 + t * 2, 0, t * Math.PI / 8); brick.ring(() => gable(1.6 - t * 0.3, 0.7), 8, 6.6 - t * 0.65, 0, 34 + t * 2, 0, t * Math.PI / 8); }
      for (let i = 0; i < 8; i++) white.add(new THREE.BoxGeometry(0.45, 17.5, 0.45).rotateX(-0.237).translate(0, 52.5, 3.6).rotateY((i + 0.5) / 8 * TAU));
      for (const y of [48, 52, 56]) { const q = 5.6 - 4.1 * (y - 44) / 17; green.add(C(q * 0.94, q * 0.98, 0.9, 8), 0, y, 0); }
      dark.ring(() => B(1.3, 3, 0.4), 8, 4.75, 0, 40.5, 0).ring(() => B(1.6, 6, 0.4), 8, 6.42, 0, 22, 0);
      gold.add(onionGeo(2.1), 0, 64, 0); cross(0, 68, 0, 0.9);
      // bell tower, the low chapel of Basil the Blessed and the tented porches
      brick.add(C(4.4, 4.8, 22, 8), 31, 0, 20).add(C(4.4, 4.4, 1.5, 8), 31, 28, 20); dark.add(C(4, 4, 6, 8), 31, 22, 20); white.ring(() => B(0.9, 6, 0.9), 8, 4.2, 31, 22, 20, Math.PI / 8).add(C(4.9, 4.9, 0.6, 8), 31, 21.4, 20);
      green.add(C(0.5, 4.8, 11, 8), 31, 29.5, 20); gold.add(onionGeo(1.1, 12, 10), 31, 40.3, 20); cross(31, 42.3, 20, 0.5);
      brick.add(B(12, 11, 12), 24, 0, -24).add(C(2, 2, 4, 10), 24, 11, -24); white.add(B(12.6, 0.6, 12.6), 24, 11, -24);
      const basil = onion(2.6, 'stud', 0x2f8a52, 0xd9b12e, 8, 5); basil.position.set(24, 15, -24); basils.add(basil); cross(24, 20, -24, 0.5);
      for (const s of [-1, 1]) { brick.add(B(8, 11, 8), -30, 0, s * 15); white.add(B(8.6, 0.6, 8.6), -30, 11, s * 15); dark.add(B(0.5, 5, 3.4), -34, 0, s * 15); green.add(C(0.4, 5.9, 11, 4), -30, 11.6, s * 15); gold.add(onionGeo(0.8, 10, 8), -30, 22.4, s * 15); }
      basils.add(brick.mesh(), white.mesh(), green.mesh(), gold.mesh(), dark.mesh());
    }
    world.add(basils);

    // ---- the Kremlin: brick walls with swallow-tail battlements, towers with green tents and ruby stars
    const K = [[-100, -330], [-100, -150], [-100, -20], [-100, 120], [-92, 250], [-88, 372], [-240, 378], [-400, 380], [-640, 352], [-570, 90], [-430, -150], [-260, -245]];
    const merlons = [];
    K.forEach(([x0, z0], i) => {
      const [x1, z1] = K[(i + 1) % K.length], len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(z0 - z1, x1 - x0);
      brick.add(new THREE.BoxGeometry(len, 12, 4.4).translate(0, 6, 0), (x0 + x1) / 2, 0, (z0 + z1) / 2, ry); snow.add(new THREE.BoxGeometry(len, 0.4, 3), (x0 + x1) / 2, 12.1, (z0 + z1) / 2, ry);
      for (let d = 9; d < len - 8; d += 3.5) merlons.push({ x: x0 + (x1 - x0) * d / len, y: 12, z: z0 + (z1 - z0) * d / len, ry });
    });
    const tail = new THREE.Shape([[-1.1, 0], [1.1, 0], [1.1, 3.1], [0.55, 2.3], [0, 2.3], [-0.55, 2.3], [-1.1, 3.1]].map(([a, b]) => new THREE.Vector2(a, b)));
    world.add(instances(new THREE.ExtrudeGeometry(tail, { depth: 4.6, bevelEnabled: false }).translate(0, 0, -2.3), brickM, merlons));
    const tower = (x, z, w, h, withStar) => {
      const h1 = h * 0.52, w2 = w * 0.62, h2 = h * 0.2;
      brick.add(B(w, h1, w), x, 0, z).add(B(w + 1.8, 2.6, w + 1.8), x, h1, z).add(B(w2, h2, w2), x, h1 + 2.6, z); white.add(B(w + 2.2, 0.6, w + 2.2), x, h1 - 0.6, z).add(B(w2 + 0.6, 0.5, w2 + 0.6), x, h1 + 2.6 + h2, z);
      snow.add(B(w + 1.8, 0.4, w + 1.8), x, h1 + 2.6, z); dark.ring(() => B(w2 * 0.3, h2 * 0.5, 0.4), 4, w2 / 2, x, h1 + 2.6 + h2 * 0.25, z);
      green.add(C(0.4, w2 * 0.76, h - h1 - h2 - 2.6, 4), x, h1 + 2.6 + h2 + 0.5, z);
      if (withStar) star(x, h + 4.6, z);
    };
    [[0, 15, 60, 1], [1, 15, 68, 1], [2, 11, 38, 0], [4, 9, 30, 0], [5, 14, 48, 0], [6, 11, 40, 0], [7, 12, 44, 0], [8, 14, 60, 1], [9, 13, 56, 1], [10, 15, 78, 1], [11, 11, 40, 0]].forEach(([i, w, h, s]) => tower(K[i][0], K[i][1], w, h, s));
    // the Spasskaya tower: stone lace, four clock faces, belfry, tent and star
    const TX = -100, TZ = 120;
    brick.add(B(17, 31, 17), TX, 0, TZ).add(B(12, 15, 12), TX, 33.5, TZ).add(C(5.2, 5.2, 8, 8), TX, 48.5, TZ); white.add(B(18.6, 2.5, 18.6), TX, 31, TZ).add(B(13, 0.8, 13), TX, 48.2, TZ).add(C(5.7, 5.7, 0.7, 8), TX, 56.5, TZ);
    white.ring(() => C(0.2, 0.9, 5, 4), 12, 9.6, TX, 33.5, TZ, Math.PI / 12).ring(() => B(0.8, 7, 0.8), 8, 5, TX, 49, TZ, Math.PI / 8); dark.add(C(4.7, 4.7, 6.5, 8), TX, 49.5, TZ).ring(() => B(5, 9, 0.5), 4, 8.3, TX, 0, TZ);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      dark.add(new THREE.CircleGeometry(4, 28).translate(0, 41, 6.1), TX, 0, TZ, a); gold.add(new THREE.RingGeometry(3.7, 4.2, 28).translate(0, 41, 6.2), TX, 0, TZ, a);
      gold.add(new THREE.BoxGeometry(0.4, 3.7, 0.1).translate(0, 1.6, 0).rotateZ(-0.9).translate(0, 41, 6.25), TX, 0, TZ, a).add(new THREE.BoxGeometry(0.5, 2.6, 0.1).translate(0, 1.1, 0).rotateZ(1.2).translate(0, 41, 6.25), TX, 0, TZ, a);
      for (let k = 0; k < 12; k++) gold.add(new THREE.BoxGeometry(0.3, 0.8, 0.1).translate(0, 3.1, 0).rotateZ(k * Math.PI / 6).translate(0, 41, 6.25), TX, 0, TZ, a);
    }
    green.add(C(0.5, 5.6, 13.5, 8), TX, 57.2, TZ); star(TX, 75.5, TZ, 2.7);
    // inside the walls: Ivan the Great's bell tower, three white cathedrals under gold domes, the yellow palaces
    const IX = -330, IZ = 170;
    white.add(C(7.4, 8, 36, 8), IX, 0, IZ).add(C(5.8, 6.2, 18, 8), IX, 36, IZ).add(C(4.4, 4.6, 12, 8), IX, 54, IZ).add(C(3.5, 3.5, 7, 16), IX, 66, IZ); dark.ring(() => B(2.2, 5, 0.5), 8, 7.1, IX, 27, IZ).ring(() => B(1.8, 4.5, 0.5), 8, 5.5, IX, 46, IZ);
    gold.add(C(3.8, 3.8, 2, 16), IX, 71, IZ).add(onionGeo(4.5), IX, 73, IZ); cross(IX, 82, IZ, 1.2);
    const church = (x, z, w, h, n) => {
      white.add(B(w, h, w), x, 0, z); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { white.add(gable(w / 6, 0.6), x + (i - 1) * w / 3, h, z + s * (w / 2 - 0.3)); white.add(gable(w / 6, 0.6), x + s * (w / 2 - 0.3), h, z + (i - 1) * w / 3, Math.PI / 2); }
      dark.ring(() => B(1.4, h * 0.3, 0.5), 4, w / 2, x, h * 0.5, z);
      const drum = (dx, dz, q) => { white.add(C(q, q, q * 2.6, 12), x + dx, h, z + dz); gold.add(onionGeo(q * 1.3, 16, 12), x + dx, h + q * 2.6, z + dz); cross(x + dx, h + q * 5, z + dz, q * 0.3); };
      drum(0, 0, w * 0.15); if (n > 1) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) drum(a * w * 0.3, b * w * 0.3, w * 0.09);
    };
    church(-382, 128, 30, 26, 5); church(-350, 222, 26, 22, 5); church(-420, 200, 22, 18, 5); church(-296, 205, 14, 14, 1);
    const kremlinM = facadeMat({ color: 0xe6cf8c, floor: 5.5, bay: 4.2, frame: [0.3, 0.22], glass: 0x2a2c36, lit: 0.5, litColor: 0xffd9a0, night: 0.9 });
    const halls = [{ x: -470, z: 292, w: 130, d: 30, h: 38 }, { x: -200, z: -40, w: 100, d: 90, h: 26 }, { x: -205, z: 60, w: 70, d: 40, h: 22 }, { x: -340, z: -150, w: 150, d: 24, h: 24, ry: 0.5 }, { x: -400, z: -20, w: 110, d: 60, h: 28, color: 0xf2f0ea }, { x: -520, z: 180, w: 40, d: 90, h: 24 }];
    world.add(buildings(halls, kremlinM)); halls.forEach((b) => green.add(new THREE.BoxGeometry(b.w + 2, 2.4, b.d + 2), b.x, b.h + 1.2, b.z, b.ry ?? 0));
    green.add(new THREE.SphereGeometry(13, 20, 10, 0, TAU, 0, Math.PI / 2), -165, 28, -40); gold.add(C(0.15, 0.2, 14, 6), -165, 41, -40); stars.add(B(5, 3, 0.2), -162.5, 51.5, -40);
    // Lenin's Mausoleum against the wall, with its row of blue spruces
    const granite = pile(mat(0x6a2a2a, { rough: 0.45 }));
    granite.add(B(22, 3.5, 26), -84, 0, -30).add(B(17, 3, 20), -85, 3.5, -30).add(B(13, 2.6, 15), -86, 6.5, -30).add(B(11, 0.8, 13), -86, 12.3, -30); dark.add(B(18, 0.8, 21), -85, 3.2, -30).add(B(9, 3.2, 11), -86, 9.1, -30);

    // ---- GUM: the long arcade along the east side of the square, outlined in strings of bulbs
    const gumM = facadeMat({ color: 0xdccfb6, floor: 7.4, bay: 5.2, frame: [0.2, 0.16], glass: 0x40382c, lit: 0.92, litColor: 0xffcf8c, night: 1.5, rough: 0.8 });
    const GX = 88, GZ = -95, bulbs = [];
    world.add(buildings([{ x: GX + 45, z: GZ, w: 90, d: 260, h: 22.2 }, { x: GX - 3, z: GZ, w: 12, d: 46, h: 29.6 }, { x: GX - 2, z: GZ - 118, w: 9, d: 26, h: 27 }, { x: GX - 2, z: GZ + 118, w: 9, d: 26, h: 27 },
      { x: GX - 4, z: GZ - 17, w: 10, d: 10, h: 37 }, { x: GX - 4, z: GZ + 17, w: 10, d: 10, h: 37 }], gumM));
    for (const s of [-1, 1]) { stone.add(C(0.4, 7.6, 13, 4), GX - 4, 37, GZ + s * 17).add(C(2, 8.5, 7, 4).scale(1, 1, 2.4), GX - 2, 27, GZ + s * 118); }
    stone.add(C(4, 8.5, 6, 4).scale(1, 1, 3.4), GX - 3, 29.6, GZ); snow.add(B(90, 0.5, 260), GX + 45, 22.2, GZ);
    const vault = new THREE.CylinderGeometry(9.5, 9.5, 250, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
    for (const dx of [22, 45, 68]) world.add(mesh(vault, mat(0xbfd8dc, { rough: 0.25, metal: 0.3, emissive: 0xffd9a0, glow: 0.45 }), GX + dx, 22.4, GZ, { cast: false }));
    for (let z = GZ - 130; z <= GZ + 130; z += 1.3) { const cen = Math.abs(z - GZ) < 23, end = Math.abs(Math.abs(z - GZ) - 118) < 13; bulbs.push([GX - (cen ? 9.3 : end ? 6.8 : 0.3), cen ? 29.8 : end ? 27.2 : 22.4, z]); if (!cen && !end) bulbs.push([GX - 0.3, 14.9, z], [GX - 0.3, 7.5, z]); }
    for (let z = GZ - 104; z <= GZ + 104; z += 10.4) for (let y = 1; y < 22; y += 1.4) if (Math.abs(z - GZ) > 24) bulbs.push([GX - 0.3, y, z]);
    for (const s of [-1, 1]) {
      for (const e of [-5, 5]) for (let y = 1; y < 37; y += 1.3) bulbs.push([GX - 9.3, y, GZ + s * 17 + e]);
      for (let t = 0; t <= 1; t += 0.08) for (const e of [-1, 1]) bulbs.push([GX - 9.3 + t * 5.3, 37 + t * 13, GZ + s * 17 + e * 5 * (1 - t)]);
      for (let a = 0; a <= Math.PI; a += 0.12) bulbs.push([GX - 9.3, 3 + Math.sin(a) * 9, GZ + s * 6 + Math.cos(a) * 4.5]);
    }
    lights(world, bulbs, { color: 0xffd08a, size: 1.5, power: 1.25 });
    // the winter fair in front of it: skating rink, wooden huts and the New Year tree
    world.add(box(34, 0.5, 64, mat(0xcfe9f6, { rough: 0.2, metal: 0.2, emissive: 0x7fc8ff, glow: 0.25 }), 52, 0, GZ - 20, { cast: false }));
    const huts = [], hutRoofs = [];
    for (let i = 0; i < 16; i++) { const x = 31 + (i % 2) * 42, z = GZ - 50 + (i >> 1) * 9; huts.push({ x, z, w: 4, d: 6, h: 3.2, color: r.pick([0x8a5a36, 0x9a6a40]) }); hutRoofs.push({ x, y: 3.2, z, sx: 4, sy: 2, sz: 7 }); lamps.push([x + (i % 2 ? -2.4 : 2.4), 2.6, z]); }
    world.add(buildings(huts, mat(0xffffff)), instances(C(0.05, 0.75, 1, 4), mat(0xb5332b), hutRoofs));
    green.add(new THREE.ConeGeometry(8, 22, 14).translate(0, 14, 0), 48, 0, GZ + 60).add(new THREE.ConeGeometry(5.4, 12, 14).translate(0, 24, 0), 48, 0, GZ + 60); star(48, 33, GZ + 60, 1.6);
    const baubles = []; for (let i = 0; i < 260; i++) { const y = r.range(3.5, 29), q = Math.max(0.3, (y < 18 ? 8 * (25 - y) / 22 : 5.4 * (30 - y) / 12)) + 0.3, a = r() * TAU; baubles.push([48 + Math.cos(a) * q, y, GZ + 60 + Math.sin(a) * q]); }
    lights(world, baubles, { color: [0xffd070, 0xff5040, 0x70c8ff, 0xfff2d0], size: 1.5, power: 1.4 });
    for (let z = GZ - 52; z <= GZ + 12; z += 4) lamps.push([34.5, 1.2, z], [69.5, 1.2, z]);

    // ---- the State Historical Museum closing the north end, the Kazan Cathedral and the Resurrection Gate
    const museumM = facadeMat({ color: 0x8e3028, floor: 6.5, bay: 4.4, frame: [0.3, 0.22], glass: 0x2a1c1c, lit: 0.5, litColor: 0xffc890, night: 1.0, rough: 0.9 }), halls2 = [{ x: 0, z: -292, w: 62, d: 40, h: 26 }, { x: 0, z: -292, w: 30, d: 30, h: 8, y: 26 }];
    snow.add(C(6, 44, 5, 4).scale(1, 1, 0.66), 0, 26, -292).add(C(0.4, 14, 12, 4), 0, 34, -292);
    for (const [dx, dz, w, h] of [[-24, 22, 9, 36], [24, 22, 9, 36], [-31, -20, 7, 30], [31, -20, 7, 30], [-9, 22, 5, 30], [9, 22, 5, 30], [-31, 22, 4, 27], [31, 22, 4, 27], [0, -22, 8, 32]]) {
      halls2.push({ x: dx, z: -292 + dz, w, d: w, h }); snow.add(C(0.3, w * 0.8, w * 1.25, 4), dx, h + 0.6, -292 + dz); white.add(B(w + 0.8, 0.6, w + 0.8), dx, h, -292 + dz).add(B(w + 0.5, 0.5, w + 0.5), dx, h * 0.7, -292 + dz);
    }
    world.add(buildings(halls2, museumM));
    brick.add(B(22, 15, 22), 62, 0, -246).add(C(4, 4, 7, 12), 62, 15, -246); white.ring(() => gable(3.4, 0.6), 4, 11, 62, 15, -246); gold.add(onionGeo(5, 16, 12), 62, 22, -246); cross(62, 31, -246, 0.8);
    for (const s of [-1, 1]) tower(44 + s * 6.5, -300, 9, 34, 0);

    // ---- one of the Seven Sisters: a tiered Stalinist tower with wings, turrets, pinnacles and a starred spire
    const sisM = facadeMat({ color: 0xcdb999, floor: 3.6, bay: 3.2, frame: [0.3, 0.22], glass: 0x2a2630, lit: 0.55, litColor: 0xffd08a, night: 1.15, rough: 0.85 });
    const QX = 1440, QZ = 270, sis = [], pin = pile(mat(0xd9c7a6, { rough: 0.8 }));
    const tier = (dx, dz, w, d, y, h, spikes = 0) => {
      sis.push({ x: QX + dx, z: QZ + dz, w, d, y, h }); pin.add(B(w + 1.5, 1.2, d + 1.5), QX + dx, y + h, QZ + dz);
      if (spikes) for (const a of [-1, 1]) for (const b of [-1, 1]) pin.add(B(3, spikes * 0.4, 3), QX + dx + a * (w / 2 - 1.5), y + h, QZ + dz + b * (d / 2 - 1.5)).add(C(0.2, 1.8, spikes * 0.6, 4), QX + dx + a * (w / 2 - 1.5), y + h + spikes * 0.4, QZ + dz + b * (d / 2 - 1.5));
    };
    tier(0, 0, 60, 60, 0, 66, 14); tier(0, 0, 44, 44, 66, 40, 12); tier(0, 0, 30, 30, 106, 28, 10); tier(0, 0, 20, 20, 134, 12, 6);
    for (const s of [-1, 1]) { tier(-4, s * 58, 46, 56, 0, 52, 0); tier(-4, s * 108, 40, 46, 0, 40, 0); tier(-4, s * 108, 18, 18, 40, 20, 8); tier(-4, s * 58, 20, 20, 52, 16, 7); pin.add(C(0.3, 5, 16, 8), QX - 4, 61.2, QZ + s * 108).add(C(0.3, 5, 14, 8), QX - 4, 69.2, QZ + s * 58); }
    pin.add(C(7, 9, 10, 8), QX, 147.2, QZ).add(C(0.5, 6, 34, 8), QX, 157.2, QZ); world.add(buildings(sis, sisM), pin.mesh()); star(QX, 196, QZ, 3.6);

    // ---- the Cathedral of Christ the Saviour, far up the river
    const VX = -1010, VZ = 300;
    white.add(B(62, 44, 62), VX, 0, VZ).add(B(84, 34, 30), VX, 0, VZ).add(B(30, 34, 84), VX, 0, VZ).add(C(15, 15, 20, 16), VX, 44, VZ); gold.add(onionGeo(17, 24, 16), VX, 64, VZ); cross(VX, 97, VZ, 2);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { white.add(C(6, 6, 16, 8), VX + a * 23, 44, VZ + b * 23); gold.add(onionGeo(6.6, 16, 12), VX + a * 23, 60, VZ + b * 23); }

    // ---- bridges over the ice
    const arch = new THREE.Shape(); arch.moveTo(-135, 11); arch.lineTo(135, 11); arch.lineTo(135, -6); arch.lineTo(72, -6); arch.quadraticCurveTo(0, 14, -72, -6); arch.lineTo(-135, -6);
    const archG = new THREE.ExtrudeGeometry(arch, { depth: 30, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -15).rotateY(Math.PI / 2);
    for (const x of [190, 780, -720]) {
      stone.add(archG.clone(), x, 0, 490);
      for (let z = 360; z <= 620; z += 20) lamps.push([x - 14, 18, z], [x + 14, 18, z]);
      traffic(world, [[x - 5, 12.4, 350], [x - 5, 12.4, 640]], { count: 14, color: 0xfff0d0, size: 3, speed: 12, spread: 3 });
      traffic(world, [[x + 5, 12.4, 640], [x + 5, 12.4, 350]], { count: 14, color: 0xff4030, size: 3, speed: 12, spread: 3 });
    }
    world.add(box(30, 1.2, 4200, roadM, 190, 0, 2710, { cast: false }));

    // ---- the ordinary city: pastel blocks of flats and offices under snowy roofs
    const tones = [0xe8d9a8, 0xe3c9b4, 0xd8dcc8, 0xe6e1d6, 0xcfc0b0, 0xd9b7a2, 0xc9d3dc, 0xead2a0];
    const cityM = facadeMat({ floor: 3.5, bay: 3, frame: [0.28, 0.25], glass: 0x2c2f3c, lit: 0.42, litColor: 0xffd08a, night: 1.0, rough: 0.9 });
    const inKremlin = (x, z) => x > -700 && x < -70 && z > -360 && z < 400;
    const lots = [];
    for (const [area, lo, hi, seed] of [[[-2300, -2300, 2300, -372], 16, 34, 1], [[196, -360, 2300, 372], 14, 30, 2], [[-2300, -360, -716, 372], 16, 34, 3], [[-2300, 606, 2300, 2300], 12, 28, 4]]) {
      const q = rng(seed);
      lots.push(...cityGrid({ rand: q, area, block: 62, street: 20, palette: tones, jitter: 0.3, split: 0.3,
        keep: (x, z) => !inKremlin(x, z) && !(Math.abs(x - 22) < 44 && z < -372) && Math.hypot(x - QX, z - QZ) > 190 && Math.hypot(x - VX, z - VZ) > 110 && Math.abs(x - 190) > 40 && Math.abs(x - 780) > 40 && Math.abs(x + 720) > 40 && !(x > 190 && x < 620 && z > 150),
        height: (x, z) => Math.min(lo + (hi - lo) * q() + (q.chance(0.04) ? 40 : 0), clear(x, z, 95) - 28) }));
    }
    world.add(buildings(lots, cityM), buildings(lots.map((b) => ({ x: b.x, z: b.z, y: b.h, w: b.w + 1, d: b.d + 1, h: 0.9, color: r.pick([0xf4f6fb, 0xf4f6fb, 0xeef1f8, 0xb7c6bd, 0xc9aca6, 0xd3d6de]) })), mat(0xffffff, { rough: 0.95 }), { cast: false }));

    // ---- people out on the square, small against it all
    const folk = []; for (let i = 0; i < 520; i++) { const x = r.range(-74, 76), z = r.range(-235, 330); if (!(x > 28 && x < 76 && z > GZ - 56 && z < GZ + 16) && Math.hypot(x - 10, z - 235) > 52) folk.push({ x, y: 0.3, z, sx: 0.55, sy: r.range(1.5, 1.85), sz: 0.4, ry: r() * 3, color: r.pick([0x2a2c34, 0x3a2e2c, 0x5a2a2a, 0x24384e, 0x4a4a52, 0x7a6a50]) }); }
    world.add(instances(B(1, 1, 1), mat(0xffffff), folk, { receive: false }));

    // ---- trees heavy with snow, spruces by the wall, lamps, traffic and falling snow
    const bare = [], spruce = [];
    for (let z = -310; z < 100; z += 9) if (Math.abs(z + 30) > 22 && Math.abs(z + 150) > 14) spruce.push([-91, 0, z]);
    for (let i = 0; i < 300; i++) {
      const x = r.range(-680, -110), z = r.range(-320, 370);
      const ok = halls.every((b) => Math.abs(x - b.x) > b.w / 2 + 8 || Math.abs(z - b.z) > b.d / 2 + 8) && Math.hypot(x - IX, z - IZ) > 16 && !(x < -280 && x > -440 && z > 100 && z < 240) && z > -330 - (x + 100) * -0.3;
      if (ok) (r.chance(0.3) ? spruce : bare).push([x, 0, z]);
    }
    for (let i = 0; i < 150; i++) bare.push([r.range(230, 610), 0, r.range(160, 372)]);
    for (let i = 0; i < 40; i++) bare.push([r.range(60, 150), 0, r.range(300, 372)]);
    for (let x = -1500; x < 1700; x += 30) if (Math.abs(x - 190) > 30 && Math.abs(x - 780) > 30) bare.push([x, 0, 410], [x + 15, 0, 570]);
    trees(world, bare, 'round', { size: 10, color: [0xf2f4f8, 0xe2e8f0, 0xd3dbe6, 0xc9cfd8], trunk: 0x3a3230 });
    trees(world, spruce, 'conifer', { size: 13, color: [0x2f5148, 0x3d6258, 0xcfdcda] });
    for (let z = -230; z <= 200; z += 16) lamps.push([-80, 7, z], [78, 7, z]);
    for (let x = -1500; x <= 1700; x += 28) lamps.push([x, 7, 408], [x, 7, 572]);
    lights(world, lamps, { color: 0xffb060, size: 2.6, power: 1.2 });
    lights(world, glows, { color: 0xff3040, size: 16, power: 0.9 });
    traffic(world, [[-1800, 1.2, 395], [1900, 1.2, 395]], { count: 60, color: 0xfff0d0, size: 3, speed: 13, spread: 2 });
    traffic(world, [[1900, 1.2, 401], [-1800, 1.2, 401]], { count: 60, color: 0xff4030, size: 3, speed: 13, spread: 2 });
    traffic(world, [[16, 1.2, -2200], [16, 1.2, -380]], { count: 40, color: 0xfff0d0, size: 3, speed: 12, spread: 3 });
    traffic(world, [[28, 1.2, -380], [28, 1.2, -2200]], { count: 40, color: 0xff4030, size: 3, speed: 12, spread: 3 });
    traffic(world, [[-1800, 1.2, 582], [1900, 1.2, 582]], { count: 50, color: [0xfff0d0, 0xff4030], size: 3, speed: 12, spread: 4 });
    world.add(brick.mesh(), white.mesh(), green.mesh(), gold.mesh(), dark.mesh(), snow.mesh(), stone.mesh(), granite.mesh(), stars.mesh({ cast: false }));
    particles(world, { count: 2600, size: 0.55, fall: 2.4, drift: 2.2, box: 150 });
    clouds(world, { count: 22, y: [1300, 1800], size: 230, color: 0xf3c3cc, self: 0.3, rand: rng(4) });

    return { world, path, focus, duration: 46 };
  },
};
