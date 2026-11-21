// Washington in cherry-blossom season: in over East Capitol Street to the Capitol dome, down the Mall past the museums to the
// Washington Monument, a look across the Ellipse at the White House, low along the Reflecting Pool to Lincoln, out by the Potomac and across the Tidal Basin to Jefferson.
import { THREE, mergeGeometries, createWorld, rng, mat, facadeMat, mesh, box, cyl, sphere, lathe, instances, buildings, cityGrid, water, trees, clouds, particles, clearance } from '../kit.js';

const V2 = THREE.Vector2, PI = Math.PI;
// a gable end (pediment): w wide, h high, d deep, ridge along Z
const pediment = (w, h, d, m, x, y, z, o) => mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new V2(-w / 2, 0), new V2(w / 2, 0), new V2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), m, x, y, z, o);
// classical columns: one unit column, placed in rows or rings as instances { x, y, z, sx: radius, sy: height, sz: radius }
const COLUMN = () => mergeGeometries([new THREE.CylinderGeometry(0.86, 1, 0.94, 12).translate(0, 0.5, 0), new THREE.BoxGeometry(2.7, 0.04, 2.7).translate(0, 0.98, 0), new THREE.BoxGeometry(2.5, 0.03, 2.5).translate(0, 0.015, 0)]);
const row = (list, x0, z0, x1, z1, n, y, h, r) => { for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0; list.push({ x: x0 + (x1 - x0) * u, y, z: z0 + (z1 - z0) * u, sx: r, sy: h, sz: r }); } };
const ring = (list, cx, cz, rad, n, y, h, r, a0 = 0, a1 = PI * 2) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (a1 - a0 > 6.2 ? i / n : i / (n - 1)); list.push({ x: cx + Math.sin(a) * rad, y, z: cz + Math.cos(a) * rad, sx: r, sy: h, sz: r }); } };
// collects static parts and bakes them into one mesh per material
function bag() {
  const map = new Map();
  return {
    add(...ms) { for (const m of ms.flat()) { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; g.applyMatrix4(m.matrix); if (!map.has(m.material)) map.set(m.material, []); map.get(m.material).push(g); } return this; },
    build(o) { return [...map].map(([m, gs]) => mesh(mergeGeometries(gs), m, 0, 0, 0, o)); },
  };
}
// a landmark: baked parts plus its columns, set down at (x, z) and turned by ry
function landmark(b, cols, colMat, x, z, ry = 0) { const g = new THREE.Group(); g.add(...b.build()); if (cols.length) g.add(instances(COLUMN(), colMat, cols)); g.position.set(x, 0, z); g.rotation.y = ry; return g; }
// a mirror image under the water line, seen through the Reflecting Pool
function reflection(obj) { const m = obj.clone(true); m.scale.y = -1; m.traverse((o) => { o.castShadow = false; }); return m; }
// things that drive or sail along straight lines [x0, z0, x1, z1, y]
function movers(world, geo, material, lines, n, speed, colors, r) {
  const items = Array.from({ length: n }, () => { const l = r.pick(lines); return { l, off: r(), len: Math.hypot(l[2] - l[0], l[3] - l[1]), ry: Math.atan2(l[2] - l[0], l[3] - l[1]), color: r.pick(colors) }; });
  const im = instances(geo, material, items), d = new THREE.Object3D();
  world.onUpdate((t) => {
    items.forEach((it, i) => { const u = (it.off + t * speed / it.len) % 1, l = it.l; d.position.set(l[0] + (l[2] - l[0]) * u, l[4] ?? 0.2, l[1] + (l[3] - l[1]) * u); d.rotation.y = it.ry; d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true;
  });
  world.add(im);
}
// lighter trees for the many: a blob of leaves on a stick, one draw call. pts: [[x, z, scale?]]
function grove(world, pts, colors, size, r, cast) {
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const geo = mergeGeometries([paint(new THREE.IcosahedronGeometry(0.36, 1).scale(1, 0.82, 1).translate(0, 0.68, 0), [1, 1, 1]), paint(new THREE.CylinderGeometry(0.03, 0.045, 0.5, 5, 1, true).translate(0, 0.25, 0).toNonIndexed(), [0.42, 0.26, 0.2])]);
  return world.add(instances(geo, mat(0xffffff, { flat: true, vertexColors: true }), pts.map(([x, z, k]) => ({ x, z, s: size * (k ?? r.range(0.8, 1.25)), ry: r() * 6.28, color: r.pick(colors) })), { cast }));
}
const distSeg = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

export default {
  build() {
    const r = rng(1791);
    const world = createWorld({
      sky: { top: 0x1f62d4, horizon: 0xbfdaf4, bottom: 0x7fb0e6, haze: 0.62 },
      sun: { dir: [0.38, 0.72, 0.58], color: 0xfff3e0, power: 3.0, size: 0.0005 },
      ambient: { sky: 0xc4dcff, ground: 0x8f9a78, power: 0.95 },
      fog: { color: 0xcde1f2, density: 0.00024 }, exposure: 1.0, env: 0.8,
    });
    // x is east, z is south. The Mall runs along z = 0 from the Capitol (east) to the Lincoln Memorial (west).
    const path = [[1610, 50, 0], [1450, 52, 0], [1300, 55, 30], [1172, 60, 96], [1000, 46, 60], [430, 24, 0], [170, 30, -60], [-50, 36, -325], [-240, 30, -245], [-430, 16, -30], [-700, 12, 0], [-950, 16, 14], [-1005, 28, 125], [-960, 34, 330], [-610, 28, 628], [-250, 30, 636]];
    const focus = [[0.05, 1150, 60, 0], [0.14, 1150, 60, 0], [0.25, -50, 95, 0], [0.35, -50, 95, 0], [0.41, -50, 12, -470], [0.46, -50, 12, -470], [0.55, -1060, 16, 0], [0.7, -1060, 16, 0]];
    const clear = clearance(path);
    const CAP = [1150, 0], MON = [-50, 0], LIN = [-1060, 0], WH = [-50, -470], JEF = [-142, 691];

    // ---- the lie of the land: river, Tidal Basin, parks
    const X0 = -1948, X1 = 2148, Z0 = -2048, Z1 = 2048, G = 4096;
    const NEAR = [[-1175, -2048], [-1175, -300], [-1185, 80], [-1150, 230], [-1040, 400], [-880, 560], [-740, 700], [-600, 800], [-380, 850], [-100, 830], [200, 880], [520, 980], [800, 1250], [950, 1600], [1000, 2048]];
    const FAR = [[-700, 2048], [-900, 1500], [-1200, 1000], [-1480, 500], [-1580, 100], [-1600, -400], [-1560, -2048]];
    const RIVER = [...NEAR, ...FAR], VIRGINIA = [...FAR, [X0, Z0], [X0, Z1]];
    const basinW = (a) => 1 + 0.07 * Math.sin(3 * a + 1), basinAt = (a, k = 1) => [-330 + 270 * Math.cos(a) * basinW(a) * k, 500 + 190 * Math.sin(a) * basinW(a) * k];
    const inBasin = (x, z, k = 1) => { const u = (x + 330) / 270, v = (z - 500) / 190; return Math.hypot(u, v) < basinW(Math.atan2(v, u)) * k; };
    const wet = (x, z) => inBasin(x, z) || inPoly(RIVER, x, z);
    const inEll = (x, z, cx, cz, rx, rz) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1;
    const park = (x, z) => (x < 150 && z > -165) || (x < 1000 && Math.abs(z) < 165) || (x > -290 && x < 150 && z > -605 && z <= -165) || (x > -620 && x <= -290 && z > -275 && z <= -165) || inEll(x, z, CAP[0], 0, 345, 310) || (x > 1480 && Math.abs(z) < 55);
    const avenue = (x, z) => distSeg(x, z, 960, -150, 150, -520) < 52 || distSeg(x, z, 960, 150, 300, 560) < 52;

    // ---- the ground is one painted map with holes where the water shows through
    const cv = document.createElement('canvas'); cv.width = cv.height = 3072; const g = cv.getContext('2d'); g.scale(0.75, 0.75); g.translate(G / 2 - 100, G / 2);
    const trace = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); };
    const line = (pts, w, style) => { trace(pts); g.lineWidth = w; g.strokeStyle = style; g.lineJoin = g.lineCap = 'round'; g.stroke(); };
    const fill = (pts, style) => { trace(pts); g.closePath(); g.fillStyle = style; g.fill(); };
    const rect = (x, z, w, d, style) => { g.fillStyle = style; g.fillRect(x, z, w, d); };
    const disc = (x, z, rx, rz, style) => { g.beginPath(); g.ellipse(x, z, rx, rz, 0, 0, 7); g.fillStyle = style; g.fill(); };
    const tile = document.createElement('canvas'); tile.width = tile.height = 512; const tg = tile.getContext('2d');
    tg.fillStyle = '#5f9146'; tg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { tg.fillStyle = r.pick(['rgba(130,180,85,0.12)', 'rgba(60,110,50,0.12)', 'rgba(160,180,95,0.08)']); tg.beginPath(); tg.arc(r.range(0, 512), r.range(0, 512), r.range(6, 40), 0, 7); tg.fill(); }
    const grass = g.createPattern(tile, 'repeat'), ROAD = '#62656a', PAVE = '#cfc9ba', GRAVEL = '#d2c5a2';
    rect(X0, Z0, G, G, '#b4b0a5');
    for (let x = 150 - 110 * 19; x < X1; x += 110) line([[x, Z0], [x, Z1]], 17, ROAD);
    for (let z = -165 - 110 * 17; z < Z1; z += 110) line([[X0, z], [X1, z]], 17, ROAD);
    line([[960, -150], [150, -520]], 34, ROAD); line([[960, 150], [300, 560]], 30, ROAD);
    rect(X0, -156, 141 - X0, Z1 + 156, grass); rect(159, -156, 832, 312, grass); rect(-281, -596, 422, 440, grass); rect(-611, -266, 330, 110, grass); disc(CAP[0], 0, 345, 310, grass); rect(1489, -46, X1 - 1489, 92, grass); fill(VIRGINIA, grass);
    // streets and walks through the parks
    line([[1000, -165], [-1175, -165]], 17, ROAD); line([[991, 165], [-300, 165], [-640, 112], [-960, 108]], 13, ROAD); line([[-290, -605], [-290, 165]], 15, ROAD);
    for (const x of [150, 370, 700, 920]) line([[x, -165], [x, 165]], 15, ROAD);
    line([[1489, 0], [X1, 0]], 13, ROAD); line(NEAR.slice(2, 10).map(([x, z]) => [x + 26, z - 16]), 9, ROAD);
    for (const [a, b] of [[159, 361], [379, 691], [709, 911], [929, 991]]) for (let x = a; x < b; x += 9) rect(x, -42, Math.min(9, b - x), 84, (x - a) % 18 ? 'rgba(175,215,105,0.36)' : 'rgba(150,200,95,0.22)');
    for (const z of [-48, 48, -89, 89]) line([[159, z], [991, z]], 6, GRAVEL);
    disc(MON[0], 0, 47, 47, PAVE); for (const [x, z] of [[150, -110], [150, 110], [-290, -110], [-290, 110]]) line([[MON[0], 0], [x, z]], 5, GRAVEL);
    g.beginPath(); g.ellipse(-50, -290, 125, 92, 0, 0, 7); g.lineWidth = 9; g.strokeStyle = GRAVEL; g.stroke(); disc(-50, -290, 118, 86, 'rgba(165,210,100,0.3)');
    g.beginPath(); g.ellipse(-50, -425, 60, 34, 0, 0, 7); g.lineWidth = 5; g.strokeStyle = GRAVEL; g.stroke(); rect(-281, -596, 422, 18, PAVE);
    rect(-948, -34, 536, 68, PAVE); rect(-1010, -40, 70, 80, PAVE); disc(LIN[0], 0, 104, 104, ROAD); disc(LIN[0], 0, 90, 90, grass); disc(LIN[0], 0, 56, 60, PAVE);
    disc(-360, 0, 50, 66, PAVE); disc(-360, 0, 30, 42, '#5f93b4');
    rect(1195, -150, 62, 300, PAVE); disc(1320, -75, 50, 60, 'rgba(165,210,100,0.3)'); disc(1320, 75, 50, 60, 'rgba(165,210,100,0.3)'); line([[1257, 0], [1489, 0]], 16, PAVE); line([[1090, -70], [960, -30], [820, -30]], 6, GRAVEL); line([[1090, 70], [960, 30], [820, 30]], 6, GRAVEL); rect(850, -95, 100, 190, PAVE);
    disc(JEF[0], JEF[1], 66, 66, PAVE);
    const basin = Array.from({ length: 90 }, (_, i) => basinAt(i / 90 * PI * 2));
    trace(Array.from({ length: 90 }, (_, i) => basinAt(i / 90 * PI * 2, 1.045))); g.closePath(); g.lineWidth = 5; g.strokeStyle = GRAVEL; g.stroke();
    trace(basin); g.closePath(); g.lineWidth = 5; g.strokeStyle = '#e2ddd0'; g.stroke(); line(NEAR, 5, '#d9d4c6'); line(FAR, 4, '#b9b49a');
    g.globalCompositeOperation = 'destination-out'; fill(RIVER, '#000'); fill(basin, '#000'); g.fillRect(-940, -26, 520, 52); g.globalCompositeOperation = 'source-over';
    const gt = new THREE.CanvasTexture(cv); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 8;
    const gm = mat(0xffffff, { rough: 0.95 }); gm.map = gt; gm.alphaTest = 0.5;
    world.add(mesh(new THREE.PlaneGeometry(G, G).rotateX(-PI / 2), gm, 100, 0, 0, { cast: false }));
    const flat = (x0, z0, x1, z1) => new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    world.add(mesh(mergeGeometries([flat(-4600, -4600, 4600, Z0), flat(-4600, Z0, X0, Z1), flat(X1, Z0, 4600, Z1), flat(-4600, Z1, -700, 4600), flat(1000, Z1, 4600, 4600)]), mat(0x8c9a80), 0, 0, 0, { cast: false }));
    const river = { color: 0x4d6f78, rough: 0.2, strength: 0.3 };
    water(world, -0.5, { ...river, size: [848, G], x: -1524, z: 0 }); water(world, -0.5, { ...river, size: [3248, 1848], x: 524, z: 1124 }); water(world, -0.5, { ...river, size: [1700, 2552], x: 150, z: 3324 });
    water(world, 0.2, { size: [84, 176], x: 900, z: 0, color: 0x557d96, ripple: 40, strength: 0.15 });
    // the Reflecting Pool: see-through water over mirror images of the obelisk and the memorial
    const pool = water(world, -0.3, { size: [520, 52], x: -680, z: 0, color: 0x1c3038, ripple: 40, strength: 0.1, rough: 0.04 });
    Object.assign(pool.material, { transparent: true, opacity: 0.3, depthWrite: false });

    // ---- materials
    const marble = mat(0xe4e0d7, { rough: 0.75 }), stone = mat(0xcbc5b7, { rough: 0.9 }), white = mat(0xefede7, { rough: 0.7 }), bronze = mat(0x4b473b, { rough: 0.5, metal: 0.5 }), dark = mat(0x33373d, { rough: 0.5 }), slate = mat(0x5a6068), copper = mat(0x86b09c, { rough: 0.7 });
    const wall = (color, o = {}) => facadeMat({ color, floor: 6.5, bay: 4.2, frame: [0.33, 0.2], glass: 0x2c3846, lit: 0, rough: 0.8, ...o });

    // ---- the Capitol (built with its long side on X and the east front on +Z, then turned to face east)
    {
      const b = bag(), cs = [], W = wall(0xe4e0d7, { floor: 10, bay: 4.4, frame: [0.36, 0.2], glass: 0x4c5764 }), roof = mat(0x9aa39c, { rough: 0.6 });
      b.add(box(246, 3, 100, stone, 0, 0, -4), box(180, 1.5, 26, stone, 0, 0, -64), box(104, 20, 48, W, 0, 3, 0), box(106, 1.3, 50, marble, 0, 23, 0), box(100, 0.5, 44, roof, 0, 24.3, 0));
      for (let i = 0; i < 6; i++) b.add(box(56, 3 - i * 0.5, 4, stone, 0, 0, -56 - i * 4), box(48, 3 - i * 0.5, 3.4, stone, 0, 0, 47.5 + i * 3.4));
      for (const f of [-1, 1]) {
        row(cs, -24.5, f * 37, 24.5, f * 37, 8, 3, 15, 1.05); row(cs, -24.5, f * 30.5, 24.5, f * 30.5, 2, 3, 15, 1.05);
        b.add(box(54, 2.4, 16, marble, 0, 18, f * 31), pediment(54, 7, 16, marble, 0, 20.4, f * 31));
      }
      for (const s of [-1, 1]) {
        b.add(box(26, 17, 30, W, s * 64, 3, 0), box(27, 1, 31, marble, s * 64, 20, 0), box(44, 20, 74, W, s * 97, 3, 0), box(46, 1.3, 76, marble, s * 97, 23, 0), box(40, 0.5, 70, roof, s * 97, 24.3, 0));
        for (const f of [-1, 1]) {
          row(cs, s * 97 - 17.5, f * 42.5, s * 97 + 17.5, f * 42.5, 8, 3, 15, 0.95);
          b.add(box(40, 2.2, 8, marble, s * 97, 18, f * 40.5), pediment(40, 5.5, 8, marble, s * 97, 20.2, f * 40.5));
          for (let i = 0; i < 5; i++) b.add(box(38, 3 - i * 0.6, 2.5, stone, s * 97, 0, f * (46.5 + i * 2.5)));
        }
        row(cs, s * 122.5, -30, s * 122.5, 30, 10, 3, 15, 0.95); b.add(box(7, 2.2, 66, marble, s * 121, 18, 0));
      }
      const cap = landmark(b, cs, marble, CAP[0], CAP[1], PI / 2);
      // the dome: podium, colonnaded drum, attic, ribbed shell, lantern and the Statue of Freedom
      const d = bag(), dc = [], dm = new THREE.Group();
      d.add(lathe([[0, 0], [23, 0], [23, 4.6], [21.6, 5.2], [21.6, 7], [15.5, 7]], marble, 0, 0, 0, 48));
      d.add(lathe([[15.5, 18.5], [20.6, 18.5], [21, 19.8], [21, 20.8], [19.6, 21], [19.6, 22.4], [19.2, 22.4], [19.2, 21.2], [16.6, 21.2]], marble, 0, 0, 0, 48));
      d.add(lathe([[16.6, 30.6], [17.9, 31], [17.9, 32], [16.4, 32.4]], marble, 0, 0, 0, 48));
      d.add(lathe([[5.2, 52.6], [6.2, 53], [6.2, 54.2], [5.2, 54.5], [5.2, 55]], marble, 0, 0, 0, 24), lathe([[5.4, 62], [5.4, 62.9], [4.4, 63.3], [3.9, 65], [2.6, 66.8], [1.7, 67.4], [1.7, 69.2], [1.2, 69.5], [0, 69.5]], marble, 0, 0, 0, 24));
      ring(dc, 0, 0, 19.2, 36, 7, 11.5, 0.72); ring(dc, 0, 0, 4.5, 12, 55, 7, 0.42);
      const prof = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * 1.27; prof.push(new V2(16.2 * Math.pow(Math.cos(a), 0.85), 21.5 * Math.sin(a))); }
      const shell = new THREE.LatheGeometry(prof, 72), sp = shell.attributes.position;
      for (let i = 0; i < sp.count; i++) { const k = Math.floor(i / prof.length) % 2 ? 1.035 : 0.975; sp.setX(i, sp.getX(i) * k); sp.setZ(i, sp.getZ(i) * k); }
      shell.computeVertexNormals();
      dm.add(...d.build(), instances(COLUMN(), marble, dc), mesh(shell, white, 0, 32.4, 0));
      dm.add(cyl(15.5, 15.5, 11.5, wall(0xdedad0, { round: 15.5, bay: 2 * PI * 15.5 / 36, floor: 10.35, frame: [0.3, 0.12] }), 0, 7, 0, 48), cyl(16.6, 16.6, 9.4, wall(0xe4e0d7, { round: 16.6, bay: 2 * PI * 16.6 / 36, floor: 8.46, frame: [0.33, 0.28] }), 0, 21.2, 0, 48));
      dm.add(cyl(3.1, 3.1, 7, dark, 0, 55, 0, 12), lathe([[1.05, 0], [0.95, 1.6], [0.75, 3.2], [0.85, 4.1], [0.5, 4.7], [0.55, 5.3], [0.3, 5.9], [0.05, 6.4]], bronze, 0, 69.5, 0, 10));
      dm.scale.setScalar(0.9); dm.position.y = 24.3; cap.add(dm); world.add(cap);
    }

    // ---- the Washington Monument on its mound, and its reflection
    {
      const [x, z] = MON, lo = mat(0xe2ded4, { flat: true }), hi = mat(0xdad6cd, { flat: true }), ob = new THREE.Group();
      world.add(lathe([[150, 0], [100, 2.6], [52, 5], [0, 5]], mat(0x5f9146, { rough: 0.95 }), x, 0.05, z, 48, { cast: false }), cyl(47, 47, 0.4, stone, x, 5, z, 48));
      ob.add(cyl(10.54, 11.9, 46, lo, x, 5.4, z, 4), cyl(7.4, 10.54, 106, hi, x, 51.4, z, 4), cyl(0, 7.4, 17, hi, x, 157.4, z, 4));
      world.add(ob, reflection(ob));
    }

    // ---- the Lincoln Memorial (front on +Z, then turned to face east down the pool)
    {
      const b = bag(), cs = [], inner = mat(0x6b6459), figure = mat(0xf2efe8, { emissive: 0xfff0d8, glow: 0.3 });
      for (let i = 0; i < 4; i++) b.add(box(76 - i * 4.5, 1.6, 54 - i * 4.5, marble, 0, i * 1.6, 0));
      for (let i = 0; i < 8; i++) b.add(box(32, 6.4 - i * 0.8, 3, marble, 0, 0, 24.5 + i * 3));
      for (const s of [-1, 1]) b.add(box(5, 8, 12, marble, s * 18.5, 0, 31), box(2, 13.4, 28, inner, s * 23, 6.4, 0), box(15, 13.4, 2, marble, s * 16.5, 6.4, 13));
      b.add(box(48, 13.4, 2, inner, 0, 6.4, -13), box(60, 3.2, 39, marble, 0, 19.8, 0), box(61.5, 0.8, 40.5, marble, 0, 22.4, 0), box(50, 5.4, 29, marble, 0, 23.2, 0), box(51.5, 0.7, 30.5, marble, 0, 28.3, 0));
      for (const f of [-1, 1]) { row(cs, -27.5, f * 17, 27.5, f * 17, 12, 6.4, 13.4, 1.15); row(cs, f * 27.5, -12.14, f * 27.5, 12.14, 6, 6.4, 13.4, 1.15); }
      // Lincoln in his chair
      b.add(box(5.6, 3, 5.6, figure, 0, 6.4, -6), box(4.8, 1.8, 4.2, figure, 0, 9.4, -6.4), box(4.8, 5.6, 0.9, figure, 0, 9.4, -8.2), box(2.3, 3, 1.5, figure, 0, 11.2, -6.8), sphere(0.78, figure, 0, 14.9, -6.7));
      for (const s of [-1, 1]) b.add(box(0.9, 2.7, 4.2, figure, s * 2.3, 9.4, -6.4), box(0.9, 0.85, 2.6, figure, s * 0.65, 11.2, -5), box(0.9, 2.2, 0.9, figure, s * 0.65, 9.4, -4), box(0.6, 0.6, 2.6, figure, s * 2.3, 12.1, -6));
      const L = landmark(b, cs, marble, LIN[0], LIN[1], PI / 2); world.add(L, reflection(L));
    }

    // ---- the White House (south front on +Z, facing the Ellipse) between the Treasury and the old Executive Office Building
    {
      const b = bag(), cs = [], W = wall(0xf1efe9, { floor: 5.6, bay: 4.7, frame: [0.34, 0.22] }), [x, z] = WH;
      b.add(box(52, 17, 24, W, 0, 0, 0), box(53.4, 1.2, 25.4, white, 0, 17, 0), box(40, 2.4, 15, mat(0xc9ccd0), 0, 18.2, 0), cyl(11.8, 11.8, 4, white, 0, 0, 12, 24), cyl(11.6, 11.6, 1.6, white, 0, 15.6, 12, 24));
      for (const s of [-1, 1]) b.add(box(2, 3, 2, white, s * 14, 20.6, 0), box(46, 6, 9, W, s * 49, 0, -2), box(14, 3, 5, white, s * 9, 0, 22.5, { ry: s * 0.5 })), row(cs, s * 28, 3.4, s * 70, 3.4, 10, 0, 5.2, 0.32);
      ring(cs, 0, 12, 10.8, 6, 4, 11.6, 0.55, -1.25, 1.25);
      row(cs, -7.5, -21, 7.5, -21, 4, 0, 13.4, 0.62); row(cs, -7.5, -16.5, 7.5, -16.5, 2, 0, 13.4, 0.62);
      b.add(box(18, 1.6, 10.5, white, 0, 13.4, -17), pediment(18, 3.6, 10.5, white, 0, 15, -17));
      const wh = landmark(b, cs, white, x, z);
      wh.add(cyl(8.6, 8.6, 15.6, wall(0xf1efe9, { round: 8.6, floor: 5.6, bay: 4.5, frame: [0.34, 0.22] }), 0, 0, 12, 24)); world.add(wh);
      world.add(cyl(7, 7, 0.5, stone, x, 0, z + 62, 24), cyl(6.2, 6.2, 0.7, mat(0x6fa3c4, { rough: 0.15 }), x, 0, z + 62, 24), cyl(0.2, 0.7, 6, mat(0xffffff, { opacity: 0.7 }), x, 0.6, z + 62, 8));
      const T = wall(0xd9d3c4), E = wall(0xb7b5ae, { floor: 5, bay: 3.4 }), tc = [];
      world.add(box(66, 21, 128, T, x + 145, 0, z - 6), box(70, 24, 122, E, x - 185, 0, z - 6), box(62, 5, 114, slate, x - 185, 24, z - 6));
      row(tc, x + 110, z - 60, x + 110, z + 48, 16, 0, 21, 0.9); world.add(instances(COLUMN(), stone, tc));
    }

    // ---- the Jefferson Memorial on the Tidal Basin (portico on +Z, turned to face the water)
    {
      const b = bag(), cs = [], inner = mat(0xd9d4c8, { side: THREE.DoubleSide });
      b.add(lathe([[0, 0], [46, 0], [46, 1.4], [40, 1.4], [40, 2.8], [34, 2.8], [34, 4.2], [29, 4.2], [29, 5.6], [0, 5.6]], marble, 0, 0, 0, 48));
      b.add(lathe([[19.5, 18.1], [25.6, 18.1], [25.9, 19.6], [25.9, 21.1], [23, 21.3], [23, 24.3], [22.6, 24.3], [22.6, 25.2], [21.8, 25.2], [21.8, 26.1], [20.8, 26.1]], marble, 0, 0, 0, 48));
      b.add(mesh(new THREE.SphereGeometry(21, 40, 10, 0, PI * 2, 0, PI / 2).scale(1, 0.6, 1), white, 0, 25.6, 0));
      for (let k = 0; k < 4; k++) b.add(mesh(new THREE.CylinderGeometry(19.5, 19.5, 12.5, 10, 1, true, PI / 4 + k * PI / 2 - 0.5, 1), inner, 0, 11.85, 0));
      ring(cs, 0, 0, 24, 26, 5.6, 12.5, 0.95);
      row(cs, -13.5, 34, 13.5, 34, 8, 5.6, 12.5, 0.95); for (const s of [-1, 1]) row(cs, s * 13.5, 30.2, s * 13.5, 26.4, 2, 5.6, 12.5, 0.95);
      b.add(box(30, 5.6, 13, marble, 0, 0, 29), box(30, 3, 12, marble, 0, 18.1, 29.5), pediment(30, 5.6, 12, marble, 0, 21.1, 29.5));
      for (let i = 0; i < 7; i++) b.add(box(30 + i * 2, 5.6 - i * 0.8, 3, marble, 0, 0, 37 + i * 3));
      b.add(cyl(1.8, 2, 2, mat(0x6a6258), 0, 5.6, 0, 12), lathe([[1.1, 0], [1, 2.2], [0.85, 4], [1, 5], [0.5, 5.8], [0.6, 6.4], [0.1, 7.2]], bronze, 0, 7.6, 0, 10));
      const J = landmark(b, cs, marble, JEF[0], JEF[1], -2.36); J.scale.setScalar(1.15); world.add(J);
    }

    // ---- the museums along the Mall, the Supreme Court and the Library of Congress behind the Capitol
    {
      const b = bag(), cs = [], W = wall(0xddd7c9), pink = wall(0xe6dcd2, { frame: [0.42, 0.3] }), red = mat(0x8e4b3b, { rough: 0.9 }), redW = wall(0x8e4b3b, { floor: 5, bay: 3.6, frame: [0.36, 0.25] }), glassy = mat(0x4c6478, { rough: 0.15, metal: 0.6 }), tan = mat(0xcbbfa9), corona = mat(0x7d5a3a, { rough: 0.45, metal: 0.55 });
      for (const [x, z, w, d] of [[535, -125, 166, 62], [810, -125, 186, 60], [810, 125, 190, 60], [470, 125, 130, 44], [630, 125, 76, 76], [260, 125, 124, 58], [260, -125, 70, 70]]) rect(x - w / 2, z - d / 2, w, d, PAVE);
      // Natural History: green dome and portico
      b.add(box(150, 20, 54, W, 535, 0, -125), box(46, 24, 60, W, 535, 0, -125), cyl(15, 15, 5, marble, 535, 24, -125, 24), mesh(new THREE.SphereGeometry(14.5, 24, 8, 0, PI * 2, 0, PI / 2), copper, 535, 29, -125), pediment(34, 5, 8, marble, 535, 19, -92));
      row(cs, 521, -90, 549, -90, 6, 0, 19, 1);
      // National Gallery: long pink marble wings, low dome
      b.add(box(170, 20, 48, pink, 810, 0, -125), box(42, 24, 56, pink, 810, 0, -125), lathe([[15, 0], [15, 2], [13, 4.6], [8.5, 6.6], [0, 7.6]], mat(0xbdb9b0), 810, 24, -125, 24), pediment(30, 4.5, 6, marble, 810, 19.5, -95));
      row(cs, 797.5, -94, 822.5, -94, 6, 0, 19.5, 0.95);
      // Air and Space: marble blocks and glass halls
      for (let i = 0; i < 4; i++) b.add(box(33, 23, 54, marble, 741 + i * 46, 0, 125)); for (let i = 0; i < 3; i++) b.add(box(13, 19, 46, glassy, 764 + i * 46, 0, 125));
      // the Smithsonian Castle: red sandstone and pointed towers
      b.add(box(112, 15, 24, redW, 470, 0, 125), pediment(24, 8, 112, red, 470, 15, 125, { ry: PI / 2 }), box(30, 19, 34, redW, 470, 0, 125), pediment(34, 7, 30, red, 470, 19, 125, { ry: PI / 2 }));
      for (const [dx, dz, w, h] of [[-9, -17, 5.5, 38], [9, -17, 4.2, 30], [0, 17, 6.5, 44], [-50, -8, 4.5, 30], [52, 6, 5.5, 26], [30, -12, 3.5, 24]]) b.add(cyl(w, w, h, red, 470 + dx, 0, 125 + dz, 8), cyl(0, w * 1.15, w * 2.1, slate, 470 + dx, h, 125 + dz, 8));
      // Hirshhorn drum, Freer, and the bronze corona of the African American museum
      b.add(cyl(33, 33, 20, tan, 630, 5, 125, 40), cyl(15, 15, 0.4, dark, 630, 25, 125, 24), box(110, 18, 48, W, 260, 0, 125), box(40, 5, 40, glassy, 260, 0, -125));
      for (let i = 0; i < 4; i++) b.add(cyl(3, 3, 5, tan, 630 + Math.cos(i * 1.57 + 0.8) * 26, 0, 125 + Math.sin(i * 1.57 + 0.8) * 26, 8));
      for (let i = 0; i < 3; i++) b.add(cyl(44, 35, 8.4, corona, 260, 5 + i * 8.6, -125, 4));
      // Supreme Court (temple front towards the Capitol), Library of Congress (copper dome), Old Post Office tower
      b.add(box(72, 20, 60, marble, 1525, 0, -112), pediment(60, 9, 76, marble, 1525, 20, -112, { ry: PI / 2 }), box(84, 3, 70, stone, 1522, 0, -112));
      row(cs, 1486, -134, 1486, -90, 8, 3, 17, 1);
      b.add(box(86, 22, 92, wall(0xcfc8b8), 1525, 0, 112), cyl(15, 15, 7, stone, 1525, 22, 112, 16), mesh(new THREE.SphereGeometry(14, 24, 8, 0, PI * 2, 0, PI / 2), copper, 1525, 29, 112), cyl(1.2, 2, 5, mat(0xd9b24a, { metal: 0.8, rough: 0.3 }), 1525, 43, 112, 8));
      b.add(box(60, 30, 70, wall(0xb9b2a6, { floor: 4.5 }), 425, 0, -330), box(20, 74, 20, wall(0xb9b2a6, { floor: 6, bay: 5 }), 425, 0, -362), cyl(0, 15.5, 22, slate, 425, 74, -362, 4));
      world.add(...b.build(), instances(COLUMN(), marble, cs));
    }

    // ---- the World War II Memorial between the Monument and the pool; stone edging round the pool; Arlington Memorial Bridge
    {
      const b = bag(), pillars = [];
      for (let i = 0; i < 56; i++) { const a = (i + 0.5) / 56 * PI * 2; if (Math.abs(Math.sin(a)) > 0.16) pillars.push({ x: -360 + Math.sin(a) * 47, y: 0, z: Math.cos(a) * 63, sx: 1.6, sy: 5.2, sz: 1.6 }); }
      for (const s of [-1, 1]) b.add(box(9, 12, 9, stone, -360, 0, s * 63), cyl(0, 7.5, 3, stone, -360, 12, s * 63, 4), box(524, 0.5, 2, stone, -680, 0, s * 27), box(2, 0.5, 56, stone, -680 + s * 261, 0, 0));
      const span = new THREE.Shape(), LEN = 470, n = 9, w = LEN / n; span.moveTo(-LEN / 2, -2); span.lineTo(-LEN / 2, 8.6); span.lineTo(LEN / 2, 8.6); span.lineTo(LEN / 2, -2);
      for (let i = n - 1; i >= 0; i--) { const cx = -LEN / 2 + w * (i + 0.5); span.lineTo(cx + w * 0.42, -2); span.absellipse(cx, -2, w * 0.42, 8.4, 0, PI, false); }
      b.add(mesh(new THREE.ExtrudeGeometry(span, { depth: 26, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -13), stone, -1378, 0, 170, { ry: -Math.atan2(200, -425) }));
      world.add(...b.build(), instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), stone, pillars));
    }

    // ---- the low stone city around the Mall (nothing in Washington is taller than the Capitol), brick rowhouses on Capitol Hill, towers across the river in Rosslyn
    const dry = (x, z, m = 48) => ![[-m, -m], [m, -m], [-m, m], [m, m], [0, 0]].some(([a, c]) => wet(x + a, z + c));
    const lots = cityGrid({
      rand: r, area: [-1927, -2022, X1, Z1], block: 84, street: 26, jitter: 0.12, split: 0.4, fill: 0.92,
      keep: (x, z) => !park(x, z) && dry(x, z) && !inPoly(VIRGINIA, x, z) && !avenue(x, z) && !(Math.abs(x - 1525) < 10 && Math.abs(z) < 120) && !(Math.abs(x - 425) < 10 && Math.abs(z + 330) < 10),
      height: (x, z) => { const h = Math.min(x > 1480 ? r.range(9, 15) : r.range(20, 40), clear(x, z, 110) - 30); return h > 8 ? h : 0; },
    });
    const stoneTones = [0xc4baa6, 0xb3a892, 0xcfc8b8, 0xa39a88, 0xb9aea0, 0x9a8c78, 0x969fa5, 0xb0947c, 0x8d8a84], brickTones = [0x9a5a48, 0xa66a52, 0x8a4f42, 0xb08a70, 0x7d4a3e];
    lots.forEach((b) => { b.color = r.pick(b.h < 16 ? brickTones : stoneTones); });
    for (const b of [...lots]) if (r.chance(0.7)) lots.push({ x: b.x + r.range(-0.15, 0.15) * b.w, z: b.z + r.range(-0.15, 0.15) * b.d, y: b.h, w: b.w * r.range(0.3, 0.6), d: b.d * r.range(0.3, 0.6), h: b.h < 16 ? 3 : r.range(3, 6), color: b.h < 16 ? 0x5d4a44 : 0x8f8d88 });
    world.add(buildings(lots, facadeMat({ floor: 3.8, bay: 3.6, frame: [0.3, 0.34], glass: 0x26323f, lit: 0 })));
    const rosslyn = cityGrid({ rand: r, area: [-1930, -1300, -1650, -420], block: 46, street: 30, palette: [0x8fa3b5, 0xa9b6c0, 0x7c93a8, 0xc2c6c8], height: () => r.range(45, 120) });
    world.add(buildings(rosslyn, facadeMat({ floor: 4, bay: 2.6, frame: [0.1, 0.16], glass: 0x355068, lit: 0, rough: 0.4, metal: 0.3 })));

    // ---- trees: elms down the Mall and the pool, cherry blossom round the Tidal Basin, the Monument and the river bank
    const T = { round: [], back: [], pool: [], pink: [], blossom: [], far: [] };
    const plant = (kind, x, z, s) => { if (wet(x, z) || clear(x, z, 18) < 32) return; const near = clear(x, z, 150) < 1e9; if (kind === 'blossom') T[near ? 'blossom' : 'far'].push([x, 0, z, s]); else T[kind === 'round' && !near ? 'back' : kind].push([x, z, s]); };
    for (let x = 172; x < 990; x += 17) if (![150, 370, 700, 920].some((s) => Math.abs(x - s) < 14)) for (const z of [-58, -76, 58, 76]) plant('round', x + r.range(-2, 2), z + r.range(-2, 2), r.range(0.9, 1.25));
    for (let x = -930; x < -430; x += 19) for (const z of [-44, -60, 44, 60]) plant('pool', x + r.range(-2, 2), z, r.range(0.9, 1.2));
    for (let i = 0; i < 190; i++) { const a = i / 190 * PI * 2; for (const k of [1.03, 1.075]) { const [x, z] = basinAt(a + r.range(-0.01, 0.01), k + r.range(-0.008, 0.008)); if (Math.hypot(x - JEF[0], z - JEF[1]) > 70) plant('blossom', x, z); } }
    for (let i = 0; i < 70; i++) { const a = r.range(0, 6.28), d = r.range(155, 250); plant('blossom', MON[0] + Math.cos(a) * d, Math.sin(a) * d * 0.55); }
    for (let k = 2; k < 9; k++) for (let i = 0; i < 9; i++) { const u = i / 9; plant('blossom', NEAR[k][0] + (NEAR[k + 1][0] - NEAR[k][0]) * u + 10, NEAR[k][1] + (NEAR[k + 1][1] - NEAR[k][1]) * u - 8); }
    for (let i = 0; i < 170; i++) { const x = r.range(820, 1480), z = r.range(-300, 300); if (inEll(x, z, CAP[0], 0, 335, 300) && !(Math.abs(x - CAP[0]) < 112 && Math.abs(z) < 150) && !(x < CAP[0] && Math.abs(z) < 62) && !(x > CAP[0] && Math.abs(z) < 24)) plant('round', x, z); }
    for (let i = 0; i < 44; i++) { const a = i / 44 * PI * 2; plant('round', -50 + Math.cos(a) * 140, -290 + Math.sin(a) * 106); }
    for (let i = 0; i < 80; i++) { const x = r.range(-270, 130), z = r.range(-585, -395); if (Math.abs(x - WH[0]) > 50 && Math.abs(x - WH[0] + 20) < 130) plant(r.chance(0.3) ? 'blossom' : 'round', x, z); }
    const fly = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    for (let i = 0; i < 900; i++) { const u = r.range(0.72, 0.99), p = fly.getPointAt(u), t = fly.getTangentAt(u), d = r.range(24, 150) * (r.chance(0.5) ? 1 : -1), x = p.x - t.z * d, z = p.z + t.x * d; if (Math.hypot(x - LIN[0], z) > 66 && !inBasin(x, z, 1.1) && Math.hypot(x - JEF[0], z - JEF[1]) > 70) plant(r.chance(0.55) ? 'pink' : 'round', x, z); }
    for (let i = 0; i < 60; i++) plant(r.chance(0.4) ? 'pink' : 'round', r.range(-605, -300), r.range(-260, -180));
    for (let x = 1500; x < X1; x += 22) for (const z of [-30, 30]) plant('round', x, z + r.range(-3, 3));
    for (let i = 0; i < 260; i++) { const x = r.range(X0, -1200), z = r.range(-400, 1900); if (inPoly(VIRGINIA, x - 20, z)) plant('round', x, z, r.range(1, 1.5)); }
    const GREENS = [0x6c9c46, 0x7cab50, 0x5e8e42, 0x8ab55a];
    grove(world, T.round, GREENS, 15, r, true); grove(world, T.back, GREENS, 15, r, false); grove(world, T.pink, [0xf6b7cf, 0xf9c9da, 0xf2a3c2, 0xfbdbe6], 10.5, r, true);
    const poolElms = grove(world, T.pool, GREENS, 15, r, true); world.add(reflection(poolElms));
    trees(world, T.blossom, 'blossom', { size: 10.5, rand: r });
    trees(world, T.far, 'blossom', { size: 10.5, rand: r }).traverse((o) => { o.castShadow = false; });

    // ---- flags: fifty round the Monument, one on the White House, two on the Capitol
    {
      const fc = document.createElement('canvas'); fc.width = 76; fc.height = 40; const f = fc.getContext('2d');
      for (let i = 0; i < 13; i++) { f.fillStyle = i % 2 ? '#ffffff' : '#b22234'; f.fillRect(0, i * 40 / 13, 76, 40 / 13 + 0.5); }
      f.fillStyle = '#3c3b6e'; f.fillRect(0, 0, 30, 21.6); f.fillStyle = '#fff'; for (let i = 0; i < 20; i++) f.fillRect(3 + (i % 5) * 5.4, 2.5 + (i / 5 | 0) * 4.6, 1.6, 1.6);
      const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
      const fm = mat(0xffffff, { side: THREE.DoubleSide, rough: 0.8 }); fm.map = ft;
      const poles = Array.from({ length: 50 }, (_, i) => ({ x: MON[0] + Math.cos(i / 50 * PI * 2) * 43, y: 5.4, z: Math.sin(i / 50 * PI * 2) * 43, s: 1 }));
      poles.push({ x: WH[0], y: 20.6, z: WH[1], s: 1.2 }, { x: CAP[0], y: 24, z: -97, s: 1.4 }, { x: CAP[0], y: 24, z: 97, s: 1.4 });
      const fg = new THREE.PlaneGeometry(3.8, 2.2, 8, 1).translate(1.9, 0, 0), fp = fg.attributes.position;
      world.add(instances(new THREE.CylinderGeometry(0.09, 0.12, 10, 6).translate(0, 5, 0), mat(0xd9dadc, { metal: 0.6, rough: 0.4 }), poles), instances(fg, fm, poles.map((p) => ({ ...p, y: p.y + 8.8 * p.s })), { cast: false }));
      world.onUpdate((t) => { for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setZ(i, Math.sin(x * 1.7 - t * 6) * 0.07 * x); } fp.needsUpdate = true; });
    }

    // ---- traffic on the avenues and the bridge, boats on the Potomac and the Basin, petals on the wind, fair-weather clouds
    const car = mergeGeometries([new THREE.BoxGeometry(2, 1, 4.6).translate(0, 0.7, 0), new THREE.BoxGeometry(1.8, 0.7, 2.4).translate(0, 1.5, -0.2)]);
    const roads = [[-1100, -169, 1000, -169], [1000, -161, -1100, -161], [-300, 169, 991, 169], [991, 161, -300, 161], [154, -600, 154, 800], [146, 800, 146, -600], [-286, -600, -286, 165], [-294, 165, -294, -600], [956, -146, 152, -514], [146, -526, 950, -158], [-1166, 66, -1590, 266, 8.7], [-1586, 274, -1162, 74, 8.7], [374, -165, 374, 165], [696, 165, 696, -165], [1500, 4, 2140, 4], [2140, -4, 1500, -4]];
    movers(world, car, mat(0xffffff, { rough: 0.35, metal: 0.4 }), roads, 110, 13, [0xf2f2f2, 0x22262b, 0x8f1f1f, 0x2a4a7a, 0xb9bcc0, 0x55595e, 0xd9c8a0], r);
    const boat = mergeGeometries([new THREE.BoxGeometry(5, 2, 17).translate(0, 0.6, 0), new THREE.BoxGeometry(3.6, 2, 8).translate(0, 2.6, -1.5)]);
    movers(world, boat, white, [[-1380, -1900, -1390, 200, -0.5], [-1300, 600, -1420, -1500, -0.5], [-1100, 800, -500, 1300, -0.5], [-200, 1500, -900, 950, -0.5]], 6, 5, [0xffffff, 0xe8e2d0], r);
    const pedal = []; for (let i = 0; i < 26; i++) { const x = r.range(-560, -120), z = r.range(360, 640); if (inBasin(x, z, 0.9) && clear(x, z, 40) > 60) pedal.push({ x, y: -0.4, z, ry: r() * 6.28, color: r.pick([0x3f8fd0, 0xffffff, 0xe9d04a]) }); }
    world.add(instances(new THREE.BoxGeometry(2, 1.5, 3), mat(0xffffff, { rough: 0.5 }), pedal));
    particles(world, { count: 1800, color: 0xffc4da, size: 0.7, fall: 1.3, drift: 3, box: 100, opacity: 0.95 });
    clouds(world, { count: 12, y: [900, 1400], size: 190, color: 0xffffff, self: 0.5, rand: rng(4) });

    return { world, path, focus, duration: 50 };
  },
};
