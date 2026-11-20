// Shanghai by night: down the neon canyon of Nanjing Road, out onto the floodlit Bund, across the Huangpu to the Oriental Pearl,
// then up between Jin Mao and the "bottle opener" and round the twisting Shanghai Tower.
import { THREE, mergeGeometries, createWorld, rng, lerp, clamp, mat, glowMat, facadeMat, mesh, box, cyl, sphere, prism, tube, beam, hipRoof, instances, buildings, cityGrid, water, lights, traffic, sign, clearance } from '../kit.js';

const PI = Math.PI, UNIT = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const COLUMN = () => mergeGeometries([new THREE.CylinderGeometry(0.86, 1, 0.94, 10).translate(0, 0.5, 0), new THREE.BoxGeometry(2.7, 0.04, 2.7).translate(0, 0.98, 0)]);
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const distLine = (P, x, z) => { let best = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; };
// collects static parts (optionally moved by the matrix `M`) and bakes them into one mesh per material
function bag() {
  const map = new Map();
  return {
    M: null,
    add(...ms) { for (const m of ms.flat()) { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; g.applyMatrix4(m.matrix); if (this.M) g.applyMatrix4(this.M); if (!map.has(m.material)) map.set(m.material, []); map.get(m.material).push(g); } return this; },
    build() { return [...map].map(([m, gs]) => mesh(mergeGeometries(gs), m, 0, 0, 0, { cast: false })); },
  };
}
// a mirror image under the water line, seen through the river
function reflection(obj) { const m = obj.clone(true); m.scale.y = -1; return m; }
// skins a stack of same-sized outlines [{ y, pts: [[x, z], ...] }] into flat-faced walls with a lid
function loft(secs) {
  const pos = [], n = secs[0].pts.length, P = (s, i) => [s.pts[i][0], s.y, s.pts[i][1]];
  for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = secs[k], b = secs[k + 1]; pos.push(...P(a, i), ...P(b, j), ...P(a, j), ...P(a, i), ...P(b, i), ...P(b, j)); }
  const top = secs[secs.length - 1]; for (let i = 1; i < n - 1; i++) pos.push(...P(top, 0), ...P(top, i), ...P(top, i + 1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
// a canvas texture drawn by `draw(ctx, w, h)`
function paint(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
// boats: several parts [geometry, material] that sail together along straight lines [x0, z0, x1, z1]
function fleet(world, parts, lines, n, speed, colors, r) {
  const items = Array.from({ length: n }, (_, i) => { const l = lines[i % lines.length]; return { l, off: r(), len: Math.hypot(l[2] - l[0], l[3] - l[1]), ry: Math.atan2(l[2] - l[0], l[3] - l[1]), color: r.pick(colors) }; });
  const ims = parts.map(([g, m]) => world.add(instances(g, m, items, { cast: false }))), d = new THREE.Object3D();
  world.onUpdate((t) => {
    items.forEach((it, i) => { const u = (it.off + t * speed / it.len) % 1, l = it.l; d.position.set(l[0] + (l[2] - l[0]) * u, 0, l[1] + (l[3] - l[1]) * u); d.rotation.y = it.ry; d.updateMatrix(); for (const im of ims) im.setMatrixAt(i, d.matrix); });
    for (const im of ims) im.instanceMatrix.needsUpdate = true;
  });
}

export default {
  build() {
    const r = rng(1843);
    const world = createWorld({
      sky: { top: 0x040716, horizon: 0x2c2248, bottom: 0x04050b, haze: 0.42 },
      sun: { dir: [-0.5, 0.55, -0.6], color: 0x8ea4ff, power: 0.4, disc: 0xe6ecff, size: 0.0005 },
      ambient: { sky: 0x30365f, ground: 0x261c24, power: 0.6 },
      fog: { color: 0x1a1733, density: 0.00042 }, stars: 260, exposure: 1.15, env: 0.5,
    });
    // x is east, z is south. The Huangpu flows north between the Bund (west bank) and Lujiazui (east bank).
    const path = [[-1040, 24, -300], [-400, 24, -300], [-275, 26, -245], [-250, 26, -120], [-246, 26, 60], [-170, 36, 230], [70, 58, 250], [400, 100, 65], [560, 130, 140], [690, 205, 215], [830, 290, 330], [915, 360, 480], [930, 430, 630], [830, 470, 740], [640, 478, 600], [570, 474, 410]];
    const NJ = -300, PEARL = [430, -40], JIN = [720, 320], WFC = [940, 340], TOWER = [830, 540];
    const xf = (z) => -345 + 0.00022 * z * z, xb = (z) => -250 + 0.00022 * clamp(z, -600, 600) ** 2;
    const focus = [[0.2, xf(27) - 8, 66, 27], [0.3, xf(27) - 8, 66, 27], [0.38, PEARL[0], 150, PEARL[1]], [0.5, PEARL[0], 170, PEARL[1]], [0.58, JIN[0], 330, JIN[1]], [0.66, WFC[0], 440, WFC[1]], [0.73, TOWER[0], 520, TOWER[1]], [0.8, TOWER[0], 560, TOWER[1]]];
    const clear = clearance(path), mirrored = new THREE.Group();

    // ---- river and land: dark ground whose streets glow, see-through water over a mirror image of the far bank
    const river = water(world, 0, { color: 0x070d18, rough: 0.14, strength: 0.5, ripple: 70 });
    Object.assign(river.material, { transparent: true, opacity: 0.62, depthWrite: false });
    const PUXI = [], PUDONG = [[230, 1700], [230, -330], [270, -470], [380, -560], [560, -600], [2600, -620], [2600, 1700]], NORTH = [[-2600, -600], [-330, -600], [-240, -700], [-40, -900], [300, -1010], [800, -1050], [2600, -1080], [2600, -2600], [-2600, -2600]];
    for (let z = 1700; z >= -540; z -= 56) PUXI.push([xb(z), z]); PUXI.push([-2600, -540], [-2600, 1700]);
    const streets = (P, S, glow) => paint(128, 128, (g) => { const w = S * 128 / P / 2; g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = glow; g.fillRect(0, 0, 128, w); g.fillRect(0, 128 - w, 128, w); g.fillRect(0, 0, w, 128); g.fillRect(128 - w, 0, w, 128); }, [1 / P, 1 / P]);
    const land = (outline, P, S, glow) => { const m = mat(0x15161c, { rough: 0.9, emissive: 0xffffff, glow: 1 }); m.emissiveMap = streets(P, S, glow); world.add(prism(outline, 5, m, 0, -2, 0, { cast: false })); };
    land(PUXI, 80, 22, '#3a2613'); land(PUDONG, 90, 26, '#2a2a30'); land(NORTH, 80, 22, '#33230f');

    // ---- ordinary city: old Puxi behind the Bund, glass Pudong, Hongkou across the creek
    const warm = facadeMat({ floor: 3.4, bay: 3.2, frame: [0.3, 0.3], glass: 0x14161c, lit: 0.5, litColor: 0xffc27a, night: 1.5, rough: 0.9 });
    const glass = facadeMat({ floor: 4, bay: 2.4, frame: [0.08, 0.14], glass: 0x121c2c, lit: 0.45, litColor: 0xcfe4ff, night: 1.5, rough: 0.4, metal: 0.3 });
    const oldTones = [0x6a5a50, 0x7a6658, 0x5a5048, 0x84705c, 0x4e4a4c, 0x6f6460], glassTones = [0x44546a, 0x56687e, 0x3a4a60, 0x687888, 0x2f4058];
    const puxi = cityGrid({ rand: r, area: [-2389, -549, -300, 1700], block: 58, street: 22, jitter: 0.3, split: 0.4, palette: oldTones, keep: (x, z) => x + 34 < xf(z) - 62 && Math.abs(z - NJ) > 106, height: () => (r.chance(0.08) ? r.range(90, 190) : r.range(16, 52)) });
    const north = cityGrid({ rand: r, area: [-2389, -2389, 2400, -600], block: 58, street: 22, jitter: 0.3, palette: oldTones, keep: (x, z) => inPoly(NORTH, x - 40, z + 44) && inPoly(NORTH, x + 40, z + 44), height: (x, z) => (r.chance(0.12) ? r.range(80, 170) : r.range(16, 60)) });
    const FLY2 = [[1700, 1700], [1250, 1100], [1130, 600], [1100, 100], [1060, -300], [900, -520]];
    const features = [[310, 300, 60, 40, 170], [300, -250, 50, 40, 150]];
    const core = (x, z) => Math.exp(-((x - 780) ** 2 + (z - 300) ** 2) / 420 ** 2);
    const pudong = cityGrid({
      rand: r, area: [283, -617, 2400, 1700], block: 64, street: 26, jitter: 0.3, split: 0.25, palette: glassTones,
      keep: (x, z) => inPoly(PUDONG, x - 44, z - 44) && inPoly(PUDONG, x - 44, z + 44) && Math.hypot(x - PEARL[0], z - PEARL[1]) > 125 && [JIN, WFC, TOWER].every(([a, b]) => Math.hypot(x - a, z - b) > 80) && distLine(FLY2, x, z) > 50 && Math.hypot(x - 600, z + 30) > 80 && features.every(([a, b]) => Math.hypot(x - a, z - b) > 70),
      height: (x, z) => { const h = Math.min(30 + r.range(0.2, 1) * (70 + 230 * core(x, z)), clear(x, z, 95) - 45); return h > 14 ? h : 0; },
    });
    for (const [x, z, w, d, h] of features) pudong.push({ x, z, w, d, h, color: 0x2f4058 });
    world.add(buildings([...puxi, ...north], warm, { cast: false })); mirrored.add(buildings(pudong, glass, { cast: false }));
    // LED light shows running up the taller towers
    const led = paint(8, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); for (const [s, c] of [[0, '#000'], [0.12, '#fff'], [0.2, '#000'], [0.5, '#222'], [0.62, '#fff'], [0.66, '#000'], [0.8, '#555'], [1, '#000']]) gr.addColorStop(s, c); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); }, [1, 1]);
    const show = glowMat(0xffffff, 1, { additive: true, opacity: 0.5, map: led });
    mirrored.add(instances(UNIT(), show, pudong.filter((b) => b.h > 120).map((b) => ({ x: b.x, z: b.z, sx: b.w + 1, sy: b.h + 0.5, sz: b.d + 1, color: r.pick([0x18c8ff, 0xff2fa0, 0xffc040, 0x3060ff, 0x30ff90, 0xb060ff]) })), { cast: false }));
    world.onUpdate((t) => { led.offset.y = -t * 0.22; });

    // ---- the Oriental Pearl: concrete columns and struts, pink spheres, the spire
    {
      const [x, z] = PEARL, g = new THREE.Group(), b = bag(), shaft = mat(0xcbbfd4, { rough: 0.7, emissive: 0x9a3a9a, glow: 0.55 });
      const skin = paint(256, 128, (c) => {
        const gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ff5cc0'); gr.addColorStop(0.5, '#ff2f9e'); gr.addColorStop(1, '#b0148a'); c.fillStyle = gr; c.fillRect(0, 0, 256, 128);
        c.strokeStyle = 'rgba(255,215,245,0.75)'; c.lineWidth = 1.2; for (let i = -8; i < 40; i++) { c.beginPath(); c.moveTo(i * 8, 0); c.lineTo(i * 8 + 64, 128); c.moveTo(i * 8 + 64, 0); c.lineTo(i * 8, 128); c.stroke(); }
        c.fillStyle = '#fff0fa'; c.fillRect(0, 58, 256, 7); c.fillStyle = 'rgba(40,0,40,0.55)'; c.fillRect(0, 65, 256, 3);
      });
      const ball = mat(0x5a1444, { rough: 0.35, metal: 0.2, emissive: 0xffffff, glow: 1.25 }); ball.emissiveMap = skin;
      for (let k = 0; k < 3; k++) { const a = k * PI * 2 / 3 + 0.5, c = Math.cos(a), s = Math.sin(a); b.add(cyl(4.5, 4.5, 285, shaft, c * 10, 0, s * 10, 12), beam([c * 64, 0, s * 64], [c * 13, 80, s * 13], 6.5, shaft)); traffic(world, [[x + c * 15, 12, z + s * 15], [x + c * 15, 280, z + s * 15]], { count: 12, color: k ? 0xff60d0 : 0x60e0ff, size: 9, speed: 55 }); }
      b.add(cyl(58, 62, 10, mat(0x1a1626, { rough: 0.4, emissive: 0x7a2a8a, glow: 0.5 }), 0, 0, 0, 40), cyl(5.5, 7, 66, shaft, 0, 282, 0, 12), cyl(0.4, 2.6, 112, shaft, 0, 356, 0, 8));
      g.add(...b.build(), sphere(25, ball, 0, 93, 0, { seg: 40, rows: 24 }), sphere(22.5, ball, 0, 263, 0, { seg: 40, rows: 24 }), sphere(8, ball, 0, 350, 0));
      g.add(instances(new THREE.SphereGeometry(6.5, 20, 14), ball, [140, 160, 180, 200, 220].map((y) => ({ y }))), sphere(1.6, glowMat(0xff3020, 4, { toneMapped: false }), 0, 469, 0));
      for (const [y, rr] of [[93, 25.5], [263, 23]]) g.add(mesh(new THREE.TorusGeometry(rr, 0.7, 6, 48).rotateX(PI / 2), glowMat(0xffe0f4, 2.2, { toneMapped: false }), 0, y - 1, 0));
      g.position.set(x, 3, z); mirrored.add(g);
      world.onUpdate((t) => { ball.emissive.setHSL(0.9 + 0.07 * Math.sin(t * 0.45), 0.55, 0.72); });
      const ringLights = []; for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2; ringLights.push([x + Math.cos(a) * 60, 14, z + Math.sin(a) * 60]); }
      lights(world, ringLights, { color: 0xff70d0, size: 6, power: 1.3 });
    }

    // ---- Jin Mao: thirteen shortening tiers with glowing eaves, like a steel pagoda
    {
      const [x, z] = JIN, tiers = [], eaves = []; let y = 3;
      [64, 56, 48, 42, 36, 30, 26, 22, 18, 14, 12, 10, 8].forEach((h, i) => { const w = 54 - i * 1.3 - Math.max(0, i - 8) * 3.2; tiers.push({ x, z, y, w, d: w, h }); eaves.push({ x, y: y + h - 1.6, z, sx: w + 4, sy: 1.6, sz: w + 4 }, { x, y: y + h * 0.5, z, sx: w + 1.6, sy: 0.8, sz: w + 1.6 }); y += h; });
      for (const [w, h] of [[20, 9], [14, 8], [8, 7]]) { eaves.push({ x, y, z, sx: w, sy: h, sz: w }); y += h; }
      mirrored.add(buildings(tiers, facadeMat({ color: 0x8e96a0, floor: 3.9, bay: 2.2, frame: [0.16, 0.12], glass: 0x1a2230, lit: 0.55, litColor: 0xffe2b0, night: 1.6, rough: 0.35, metal: 0.5 }), { cast: false }));
      mirrored.add(instances(UNIT(), mat(0xd9d2c0, { rough: 0.4, metal: 0.5, emissive: 0xffd9a0, glow: 1.3 }), eaves, { cast: false }), cyl(0.3, 2.2, 26, mat(0xe0e0e0, { emissive: 0xfff0d0, glow: 1.5 }), x, y, z, 8));
      for (const [dx, dz] of [[1, 1], [-1, -1]]) traffic(world, [[x + dx * 29, 6, z + dz * 29], [x + dx * 20, 380, z + dz * 20]], { count: 10, color: 0xffe0a0, size: 9, speed: 70 });
    }

    // ---- the World Financial Center: a square that thins to a blade, with the trapezoid opening at the top
    {
      const [x, z] = WFC, A = 41, H = 492, half = (yy) => Math.max(2.6, A * (1 - Math.pow(yy / H, 1.8))), win = (yy) => lerp(15, 24, (yy - 402) / 66);
      const body = [], legs = [[], []], lid = [];
      for (let k = 0; k <= 16; k++) { const yy = k / 16 * 402, b = half(yy); body.push({ y: yy, pts: [[0, -A], [b, 0], [0, A], [-b, 0]] }); }
      for (let k = 0; k <= 4; k++) { const yy = 402 + k / 4 * 66, b = half(yy), w = win(yy), e = b * (1 - w / A); legs.forEach((l, i) => { const s = i ? 1 : -1; l.push({ y: yy, pts: [[-e, s * w], [e, s * w], [0.8, s * A], [-0.8, s * A]] }); }); }
      for (const yy of [468, 492]) lid.push({ y: yy, pts: [[0, -A], [half(yy), 0], [0, A], [-half(yy), 0]] });
      const m = facadeMat({ color: 0x6f8296, floor: 4.2, bay: 2.4, frame: [0.07, 0.12], glass: 0x142030, lit: 0.5, litColor: 0xd6e8ff, night: 1.5, rough: 0.3, metal: 0.5 }); m.side = THREE.DoubleSide;
      const g = new THREE.Group(), edge = glowMat(0xbfe2ff, 2.4, { toneMapped: false });
      g.add(mesh(mergeGeometries([loft(body), loft(legs[0]), loft(legs[1]), loft(lid)]), m, 0, 0, 0, { cast: false }));
      for (const s of [-3.4, 3.4]) g.add(beam([s, 402, -15], [s, 402, 15], 0.9, edge), beam([s * 0.8, 468, -24], [s * 0.8, 468, 24], 0.9, edge), beam([s, 402, -15], [s * 0.8, 468, -24], 0.9, edge), beam([s, 402, 15], [s * 0.8, 468, 24], 0.9, edge));
      g.add(beam([0, 0, -A], [0, 492, -A], 0.8, edge), beam([0, 0, A], [0, 492, A], 0.8, edge), beam([0, 492.5, -A], [0, 492.5, A], 1, edge));
      g.position.set(x, 3, z); mirrored.add(g);
    }

    // ---- Shanghai Tower: a rounded triangle that twists a third of a turn and tapers as it climbs, with the notch spiralling up
    {
      const [x, z] = TOWER, H = 629, N = 72, K = 90, pos = [], uv = [], idx = [], notch = PI / 3;
      for (let k = 0; k <= K; k++) for (let i = 0; i <= N; i++) {
        const t = k / K, a = i / N * PI * 2, th = a + t * PI * 2 / 3, da = Math.atan2(Math.sin(a - notch), Math.cos(a - notch));
        const rr = lerp(43, 23, Math.pow(t, 1.25)) * (1 + 0.13 * Math.cos(3 * a)) * (1 - 0.24 * Math.exp(-da * da / 0.014));
        pos.push(Math.cos(th) * rr, t * (H - 52 * (0.5 - 0.5 * Math.cos(da))), Math.sin(th) * rr); uv.push(i / N, t);
        if (k < K && i < N) { const p = k * (N + 1) + i; idx.push(p, p + N + 1, p + 1, p + 1, p + N + 1, p + N + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const lit = paint(512, 1024, (c) => {
        c.fillStyle = '#03080f'; c.fillRect(0, 0, 512, 1024);
        for (let f = 0; f < 128; f++) { const zone = f % 14 === 13; for (let i = 0; i < 64; i++) if (zone || r.chance(0.5)) { c.fillStyle = zone ? '#eaf6ff' : r.pick(['#5d89b8', '#86b4dc', '#3f6a98', '#b8d8f2']); c.fillRect(i * 8 + 1, 1024 - f * 8 - 6, 6, zone ? 7 : 4); } }
        c.fillStyle = '#ffffff'; c.fillRect(512 / 6 - 5, 0, 3, 1024); c.fillRect(512 / 6 + 3, 0, 3, 1024); c.fillStyle = '#dff2ff'; c.fillRect(0, 0, 512, 26);
      });
      const skin = mat(0x16263c, { rough: 0.25, metal: 0.6, emissive: 0xffffff, glow: 1.15, side: THREE.DoubleSide }); skin.emissiveMap = lit;
      const glow = glowMat(0x60c8ff, 1, { additive: true, opacity: 0.4, map: led, side: THREE.DoubleSide }), tw = new THREE.Group();
      tw.add(mesh(g, skin, 0, 0, 0, { cast: false }), mesh(g, glow, 0, 0, 0, { cast: false, scale: [1.012, 1, 1.012] }), cyl(26, 26, 1, mat(0x05070c), 0, 560, 0, 24), sphere(1.8, glowMat(0xff3020, 4, { toneMapped: false }), 0, 632, 0));
      tw.position.set(x, 3, z); mirrored.add(tw);
    }

    // ---- the Bund: a curving row of floodlit stone banks and hotels, the Customs House clock tower in the middle
    const stone = facadeMat({ color: 0xbfa27c, floor: 4.6, bay: 3.6, frame: [0.3, 0.14], glass: 0x1a1410, lit: 0.4, litColor: 0xffd08a, night: 1.3, rough: 0.9 }); stone.emissive.set(0xff9438); stone.emissiveIntensity = 0.38;
    const trim = mat(0xe2c79a, { rough: 0.8, emissive: 0xffa848, glow: 0.62 }), plinth = mat(0x8a7558, { rough: 0.9, emissive: 0xff8a30, glow: 0.3 }), slate = mat(0x2a2c33, { rough: 0.7 }), verdigris = mat(0x4f9a84, { rough: 0.6, emissive: 0x30c090, glow: 0.7 }), tile = mat(0x3a6a78, { rough: 0.6, emissive: 0x2a8090, glow: 0.45 });
    const bund = bag(), bcols = [], clockFaces = [];
    const row = [[-1, 48, 46, 'pyramid'], [-1, 46, 60, 'boc'], [-1, 44, 30, 'cupola'], [-1, 52, 28, 'columns'], [-1, 50, 32, 'plain'], [1, 40, 30, 'turrets'], [1, 44, 36, 'plain'], [1, 50, 28, 'cupola'], [1, 42, 34, 'columns'], [1, 48, 30, 'plain'], [1, 56, 34, 'clock'], [1, 86, 30, 'dome'], [1, 44, 34, 'turrets'], [1, 58, 26, 'columns'], [1, 40, 32, 'plain'], [1, 46, 28, 'cupola'], [1, 52, 34, 'plain']];
    const edge = { '-1': NJ - 27, 1: NJ + 27 };
    for (const [s, w, h, kind] of row) {
      const zc = edge[s] + s * w / 2, d = 44; edge[s] += s * (w + 6);
      const M = new THREE.Matrix4().makeRotationY(Math.atan2(1, -0.00044 * zc)).setPosition(xf(zc) - d / 2, 3, zc), col = (lx, ly, lz, rad, ch) => { const p = new THREE.Vector3(lx, ly, lz).applyMatrix4(M); bcols.push({ x: p.x, y: p.y, z: p.z, sx: rad, sy: ch, sz: rad, ry: PI / 2 }); };
      bund.M = M;
      bund.add(box(w, h, d, stone), box(w + 0.8, 5, d + 0.8, plinth), box(w + 1.8, 1.3, d + 1.8, trim, 0, h, 0), box(w - 5, 4, d - 5, stone, 0, h + 1.3, 0), box(w - 4, 0.6, d - 4, slate, 0, h + 5.3, 0));
      if (kind === 'cupola') bund.add(cyl(4.5, 4.5, 6, trim, 0, h + 5.3, d / 2 - 9, 12), mesh(new THREE.SphereGeometry(4.6, 16, 8, 0, PI * 2, 0, PI / 2), verdigris, 0, h + 11.3, d / 2 - 9), cyl(0.2, 0.5, 6, trim, 0, h + 15.5, d / 2 - 9, 6));
      if (kind === 'turrets') for (const e of [-1, 1]) bund.add(cyl(3.4, 3.4, 9, trim, e * (w / 2 - 4), h + 1.3, d / 2 - 4, 8), cyl(0, 4, 7, slate, e * (w / 2 - 4), h + 10.3, d / 2 - 4, 8));
      if (kind === 'columns' || kind === 'dome') { const n = kind === 'dome' ? 8 : 6, cw = n * 4.2; for (let i = 0; i < n; i++) col(-cw / 2 + 2.1 + i * 4.2, 5, d / 2 + 1.6, 0.85, h - 9); bund.add(box(cw + 2, 4, 4, trim, 0, h - 4, d / 2 + 1)); }
      if (kind === 'dome') bund.add(box(34, h + 9, d, stone), box(36, 1.2, d + 1, trim, 0, h + 9, 0), cyl(11.5, 11.5, 7, trim, 0, h + 10, 4, 20), mesh(new THREE.SphereGeometry(11, 24, 10, 0, PI * 2, 0, PI / 2), trim, 0, h + 17, 4), cyl(1.6, 2, 4, trim, 0, h + 27.6, 4, 8));
      if (kind === 'clock') {
        bund.add(box(17, 40, 17, stone, 0, h, d / 2 - 10), box(19, 1.2, 19, trim, 0, h + 40, d / 2 - 10), box(13, 9, 13, stone, 0, h + 41, d / 2 - 10), cyl(0, 9.5, 9, slate, 0, h + 50, d / 2 - 10, 4), cyl(0.15, 0.3, 9, trim, 0, h + 59, d / 2 - 10, 6));
        for (let k = 0; k < 4; k++) { const a = k * PI / 2, p = new THREE.Vector3(Math.sin(a) * 8.7, h + 31, d / 2 - 10 + Math.cos(a) * 8.7).applyMatrix4(M); clockFaces.push({ x: p.x, y: p.y, z: p.z, ry: a + Math.atan2(1, -0.00044 * zc) }); }
      }
      if (kind === 'pyramid') bund.add(box(19, 12, 19, stone, 0, h + 5, d / 2 - 11), box(20.5, 1, 20.5, trim, 0, h + 17, d / 2 - 11), cyl(0, 13.5, 24, verdigris, 0, h + 18, d / 2 - 11, 4));
      if (kind === 'boc') bund.add(box(w - 10, 10, d - 10, stone, 0, h + 5, 0), hipRoof(w - 2, d - 2, 9, tile, 0, h + 15, 0, { ridge: 0.45, curve: 1.5, lift: 2.4 }));
    }
    world.add(...bund.build(), instances(COLUMN(), trim, bcols, { cast: false }));
    const dial = paint(128, 128, (c) => { c.fillStyle = '#fff2c4'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.strokeStyle = '#2a2018'; c.lineWidth = 5; for (let i = 0; i < 12; i++) { const a = i * PI / 6; c.beginPath(); c.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); c.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); c.stroke(); } c.lineWidth = 6; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 26, 64 - 16); c.moveTo(64, 64); c.lineTo(64 - 10, 64 - 44); c.stroke(); });
    world.add(instances(new THREE.CircleGeometry(5.6, 32), glowMat(0xffffff, 1.6, { map: dial, toneMapped: false, side: THREE.DoubleSide }), clockFaces, { cast: false }));

    // ---- neon: Nanjing Road's blade signs, roof signs over the Bund, the LED walls on the Pudong shore
    const NEON = ['#ff3b6b', '#ffd23b', '#37e0ff', '#7dff6b', '#ff7a2b', '#e07bff', '#ffffff'], shops = ['老凤祥', '永安百货', '沈大成', '亨达利钟表', '第一食品', '茶庄', '上海书城', '吴良材眼镜', '张小泉', '宝大祥', '蔡同德堂', '邵万生', '泰康食品', '真老大房', '新世界', '丝绸', '小笼包', '火锅', '大酒家', '珠宝', '百货', '大光明', '南京路', '步行街', '朵云轩', '培罗蒙', '恒源祥', '王开照相', '功德林', '德大西菜', '美伦大楼', '东亚饭店'];
    const mall = [], shopGlow = [], mallLights = [], puxiTall = [];
    let si = 0;
    for (let x = -1100; x < -370; x += 46) for (const s of [-1, 1]) {
      const back = x < -960 ? 50 : 26, h = r.range(30, 58); mall.push({ x: x + 20, z: NJ + s * (back + 21), w: 42, d: 42, h, y: 3, color: r.pick(oldTones) });
      shopGlow.push({ x: x + 20, y: 3.2, z: NJ + s * (back - 0.3), sx: 40, sy: 5.5, sz: 0.6, color: r.pick([0xffc880, 0xffe0b0, 0xffb060, 0xbfe0ff]) });
      const txt = shops[si++ % shops.length], c = r.pick(NEON), inv = r.chance(0.4), sg = sign(txt, txt.length * 4.4 + 2, { vertical: true, color: inv ? '#fff' : c, bg: inv ? (c === '#ffffff' ? '#c01030' : c) : '#14060c', glow: 2.1, pad: 0.2 });
      sg.position.set(x + 20 + r.range(-12, 12), 3 + r.range(15, Math.min(34, h - 10)), NJ + s * (back - 3.2)); sg.rotation.y = -PI / 2; world.add(sg);
      for (let k = 0; k < 4; k++) mallLights.push([x + k * 11.5, 9.5, NJ + s * (back - 5)]);
    }
    world.add(buildings(mall, warm, { cast: false }), instances(UNIT(), glowMat(0xffffff, 1.5, { toneMapped: false }), shopGlow, { cast: false }));
    lights(world, mallLights, { color: [0xffd9a0, 0xfff0d0, 0xff8ad0, 0x8ae0ff], size: 3.4, power: 1.2 });
    world.add(box(760, 0.3, 50, mat(0x2a2422, { rough: 0.6, emissive: 0xff9a50, glow: 0.12 }), -720, 3, NJ, { cast: false }));
    [[400, '浦发银行'], [300, '上海'], [205, '外滩'], [60, '中国银行'], [-50, '和平饭店'], [-160, '大世界'], [-410, '东方明珠'], [-500, '海鸥饭店']].forEach(([z, txt], i) => {
      const h = r.range(56, 84), x = xf(z) - 100; puxiTall.push({ x, z, w: 44, d: 40, h, y: 3, color: 0x54504e });
      const sg = sign(txt, 15, { color: NEON[i % 6], bg: null, glow: 2.4 }); sg.position.set(x + 21, 3 + h + 9, z); sg.rotation.y = PI / 2; world.add(sg, box(txt.length * 13, 1, 1, slate, x + 20.5, 3 + h, z, { ry: PI / 2, cast: false }));
    });
    world.add(buildings(puxiTall, warm, { cast: false }));
    for (const [x, z, w, d, h, txt, c] of [[310, 300, 60, 40, 170, '我♥上海', '#ff4466'], [300, -250, 50, 40, 150, '浦东', '#40d0ff']]) { const sg = sign(txt, txt.length > 2 ? 15 : 22, { color: c, bg: '#12040c', glow: 2.3, pad: 0.5 }); sg.position.set(x - w / 2 - 0.6, h * 0.62, z); sg.rotation.y = -PI / 2; mirrored.add(sg); }

    // ---- elevated roads edged in blue neon, with streams of head- and tail-lights
    const FLY1 = [[-2400, 520], [-1200, 520], [-700, 500], [-470, 472], [-375, 570], [-330, 760], [-300, 1100], [-285, 1700]];
    const piers = [], side = (P, d) => P.map(([x, z], i) => { const [ax, az] = P[Math.max(0, i - 1)], [bx, bz] = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(bx - ax, bz - az); return [x - (bz - az) / l * d, z + (bx - ax) / l * d]; });
    for (const [P, y] of [[FLY1, 19], [FLY2, 21]]) {
      const c = new THREE.CatmullRomCurve3(P.map(([x, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.3), n = Math.round(c.getLength() / 14), pts = c.getSpacedPoints(n), pos = [], idx = [];
      pts.forEach((p, i) => { const t = c.getTangentAt(i / n); pos.push(p.x - t.z * 11, y, p.z + t.x * 11, p.x + t.z * 11, y, p.z - t.x * 11); if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); if (i % 3 === 0) piers.push({ x: p.x, y: 3, z: p.z, sx: 3, sy: y - 3.6, sz: 3 }); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      world.add(mesh(g, mat(0x22242a, { side: THREE.DoubleSide }), 0, 0, 0, { cast: false }));
      for (const d of [-11.4, 11.4]) world.add(tube(side(P, d).map(([x, z]) => [x, y - 0.5, z]), 0.55, glowMat(0x2f6bff, 2.6, { toneMapped: false }), { seg: n, radial: 4, tension: 0.3 }));
      traffic(world, side(P, 5).map(([x, z]) => [x, y + 1, z]), { count: 90, color: 0xfff2d8, size: 4.5, speed: 22, spread: 3 });
      traffic(world, side(P, -5).reverse().map(([x, z]) => [x, y + 1, z]), { count: 90, color: 0xff3a2a, size: 4.5, speed: 22, spread: 3 });
    }
    world.add(instances(UNIT(), mat(0x3a3c42), piers, { cast: false }));
    world.add(mesh(new THREE.TorusGeometry(58, 3.2, 4, 48).rotateX(PI / 2).scale(1, 0.25, 1), mat(0x2a2c34, { emissive: 0x9fd0ff, glow: 0.5 }), 600, 11, -30, { cast: false }), mesh(new THREE.TorusGeometry(61.4, 0.5, 4, 48).rotateX(PI / 2), glowMat(0xcfe8ff, 2.2, { toneMapped: false }), 600, 12, -30));

    // ---- street life: the road along the Bund, avenues, lamps, warning lights on the tall towers
    const bundRoad = []; for (let z = 520; z >= -520; z -= 40) bundRoad.push([xf(z) + 38, 4.2, z]);
    traffic(world, bundRoad, { count: 70, color: 0xfff2d8, size: 3.6, speed: 12, spread: 5 }); traffic(world, bundRoad.map(([x, y, z]) => [x + 12, y, z]).reverse(), { count: 60, color: 0xff3a2a, size: 3.6, speed: 12, spread: 5 });
    for (const [a, b] of [[[540, 4.2, -160], [2300, 4.2, 1200]], [[2300, 4.2, 1212], [540, 4.2, -148]], [[-2300, 4.2, 0], [-420, 4.2, 0]], [[-420, 4.2, 240], [-2300, 4.2, 240]], [[765, 4.2, -560], [765, 4.2, 1650]], [[1305, 4.2, 1650], [1305, 4.2, -560]]]) traffic(world, [a, b], { count: 70, color: a[0] < b[0] || a[2] < b[2] ? 0xfff2d8 : 0xff3a2a, size: 3.6, speed: 14, spread: 4 });
    const lamps = [], cool = [], red = [];
    for (let z = 520; z >= -520; z -= 13) lamps.push([xb(z) - 8, 10, z], [xf(z) + 52, 10, z]);
    for (let x = -2320; x < -420; x += 80) for (let z = -480; z < 1700; z += 80) lamps.push([x, 11, z]);
    for (let x = -2320; x < 2400; x += 80) for (let z = -2320; z < -1100; z += 80) lamps.push([x, 11, z]);
    for (let x = 270; x < 2400; x += 90) for (let z = -540; z < 1700; z += 90) cool.push([x, 12, z]);
    for (let z = -300; z < 1700; z += 16) cool.push([236, 9, z]);
    for (const b of [...pudong, ...puxi, ...north]) if (b.h > 110) red.push([b.x, b.h + 5, b.z]);
    lights(world, lamps, { color: 0xffb060, size: 4.5, power: 1 }); mirrored.add(lights(world, cool, { color: 0xdfeaff, size: 4.5, power: 0.9 }), lights(world, red, { color: 0xff3828, size: 7, power: 1.4 }));

    // ---- on the water: cruise boats strung with coloured light, slow dark barges
    const hull = mat(0x10141c, { rough: 0.6 });
    fleet(world, [[new THREE.BoxGeometry(9, 4, 46).translate(0, 1.2, 0), hull], [mergeGeometries([new THREE.BoxGeometry(7.6, 3, 34).translate(0, 4.6, -2), new THREE.BoxGeometry(6.4, 2.6, 24).translate(0, 7.4, -4), new THREE.BoxGeometry(9.4, 0.5, 46.4).translate(0, 3.2, 0)]), glowMat(0xffffff, 1.5, { toneMapped: false })]],
      [[-70, 1650, -70, -420], [80, -430, 80, 1650], [-150, 1500, -140, -300], [150, -350, 150, 1500]], 9, 6, [0xff4fb0, 0x40d8ff, 0xffc850, 0x8a6bff, 0x50ff9a, 0xff7040], r);
    fleet(world, [[mergeGeometries([new THREE.BoxGeometry(12, 3, 74).translate(0, 0.6, 0), new THREE.BoxGeometry(8, 5, 9).translate(0, 4, -30)]), hull], [new THREE.BoxGeometry(8.2, 1.2, 9.2).translate(0, 5, -30), glowMat(0xffd9a0, 1.2)]], [[10, 1650, 10, -430], [-10, -430, -10, 1650]], 5, 3, [0xffffff], r);

    world.add(mirrored, reflection(mirrored));
    world.scene.traverse((o) => { o.castShadow = false; });
    return { world, path, focus, duration: 46 };
  },
};
