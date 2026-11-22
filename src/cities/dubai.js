// Dubai as the afternoon gold turns to dusk: in over the Palm Jumeirah to the Burj Al Arab, down the canyon of Sheikh Zayed Road
// past the Museum of the Future, over the Dubai Fountain and up in a climbing spiral round the Burj Khalifa, out towards the setting sun.
import { THREE, mergeGeometries, createWorld, rng, fbm, smooth, mat, facadeMat, mesh, box, cyl, dome, prism, tube, beam, instances, buildings, cityGrid, terrain, water, trees, lights, traffic, clearance } from '../kit.js';

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
  const im = instances(geo, material, Array.from({ length: n }, (_, i) => ({ y: -50, color: colors?.[i % colors.length] })), { cast: false }), d = new THREE.Object3D();
  world.onUpdate((t) => { for (let i = 0; i < n; i++) { const [x, y, z, ry] = at(i, t); d.position.set(x, y, z); d.rotation.y = ry; d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; });
  world.add(im); return im;
}
/** Flat-shaded geometry from a list of triangles' corner points. */
function facets(pts) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return g; }
/** The Museum of the Future's skin: brushed silver cut through with flowing calligraphy-like windows. Returns [colour map, glow map]. */
function scriptTextures() {
  const r = rng(71), mk = (bg) => { const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 1024, 256); x.lineCap = 'round'; x.lineJoin = 'round'; return [c, x]; };
  const [a, xa] = mk('#c9ced6'), [b, xb] = mk('#000000');
  for (let row = 0; row < 3; row++) for (let px = -20; px < 1040;) {
    const y = 48 + row * 80 + r.range(-8, 8), w = r.range(40, 110), kind = r.int(0, 3);
    for (const [x, ink] of [[xa, '#1a2836'], [xb, '#ffe9c0']]) {
      x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 9; x.beginPath();
      if (kind === 0) { x.moveTo(px, y - 26); x.bezierCurveTo(px + w * 0.2, y + 30, px + w * 0.8, y + 30, px + w, y - 8); }
      else if (kind === 1) { x.moveTo(px + w, y - 30); x.bezierCurveTo(px + w * 0.9, y + 26, px + w * 0.3, y + 22, px, y + 4); x.bezierCurveTo(px + w * 0.2, y - 16, px + w * 0.5, y - 12, px + w * 0.55, y + 6); }
      else if (kind === 2) { x.moveTo(px + w * 0.2, y - 34); x.lineTo(px + w * 0.26, y + 12); x.bezierCurveTo(px + w * 0.4, y + 30, px + w * 0.8, y + 24, px + w, y - 4); }
      else { x.moveTo(px, y + 14); x.bezierCurveTo(px + w * 0.3, y - 30, px + w * 0.6, y + 34, px + w, y - 20); }
      x.stroke(); x.beginPath(); x.arc(px + w * 0.5, y - 30 + (kind % 2) * 62, 5.5, 0, 7); x.fill();
    }
    px += w + r.range(6, 22);
  }
  return [a, b].map((c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); t.anisotropy = 4; return t; });
}

export default {
  build() {
    const r = rng(2010);
    const world = createWorld({
      sky: { top: 0x6a80b6, horizon: 0xffc27c, bottom: 0xc09a70, haze: 0.46 },
      sun: { dir: [-0.72, 0.13, 0.68], color: 0xffb468, power: 3.7, disc: 0xa85a20, size: 0.0005 },
      ambient: { sky: 0xc4b6bc, ground: 0xa88458, power: 0.9 },
      fog: { color: 0xf2c38e, density: 0.00023 }, exposure: 1.05, env: 0.9,
    });
    const BK = [650, 100], BAA = [-1080, 1490], PALM = [-1760, 1900], MOF = [-250, 775], FRAME = [1200, -150], RZ = 640, HW = 46, COAST = 1250;   // RZ: Sheikh Zayed Road's centre line, HW: half the canyon's width
    const ring = (deg, rad, y) => [BK[0] + rad * Math.cos(deg * Math.PI / 180), y, BK[1] + rad * Math.sin(deg * Math.PI / 180)];
    const path = [[-2090, 251, 2040], [-1760, 205, 1900], [-1290, 125, 1650], [-930, 90, 1250], [-720, 62, 900], [-450, 56, RZ + 6], [-100, 60, RZ], [230, 80, 560],
      ring(130, 300, 90), ring(70, 250, 150), ring(10, 250, 225), ring(-50, 230, 300), ring(-110, 215, 375), ring(-170, 200, 440), [424, 465, 232], [395, 482, 400]];
    const focus = [[0.09, BAA[0], 150, BAA[1]], [0.24, BAA[0], 170, BAA[1]], [0.33, MOF[0], 70, MOF[1]], [0.42, MOF[0], 75, MOF[1]], [0.5, BK[0], 190, BK[1]], [0.58, BK[0], 260, BK[1]], [0.68, BK[0], 400, BK[1]], [0.8, BK[0], 560, BK[1]]];
    const clear = clearance(path);

    // ---- the Gulf, the flat city ground, and the dunes that begin where the city stops
    water(world, 0, { color: 0x2f6a80, rough: 0.14, ripple: 90, strength: 0.3, env: 1.3 });
    const sandTone = 0xe2c69c, sand = mat(sandTone), asphalt = mat(0x4a4744);
    world.add(box(9000, 6, 5750, sand, 0, -4, COAST - 2875, { cast: false }));
    const duneAt = (x, z) => { const k = smooth(-850, -1700, z) + smooth(2400, 3600, Math.abs(x)) * smooth(-600, -1400, z); return k ? Math.min(1, k) * (10 + 95 * Math.pow(Math.abs(Math.sin(x / 260 + 2.2 * fbm(x / 900, z / 900, 3) + z / 700)), 1.6) * (0.5 + fbm(x / 1500 + 5, z / 1500, 2))) : 0; };
    world.add(terrain({ size: [9000, 3800], center: [0, -2650], seg: 100, height: (x, z) => duneAt(x, z) + 1.5, color: (x, y, z, slope) => (slope > 0.1 ? 0xb9783e : y > 40 ? 0xe2a25c : 0xd89a58) }));

    // ---- the Burj Khalifa: three wings round a core, each stepping back in turn so the setbacks spiral up to the spire
    const silver = facadeMat({ color: 0xc4d0dc, floor: 3.9, bay: 1.7, frame: [0.07, 0.2], glass: 0x6f8aa4, lit: 0.12, litColor: 0xffe6c0, night: 0.9, rough: 0.22, metal: 0.65 });
    const steel = mat(0xd4dce4, { metal: 0.8, rough: 0.25 }), bk = [], fins = [];
    for (let k = 0; k < 3; k++) for (let n = 0; n < 8; n++) {
      const a = k * Math.PI * 2 / 3 + 0.5, d = 13 + n * 9.6, rad = 11.5 - n * 0.55, h = 92 + ((7 - n) * 3 + k) * 21.4;
      bk.push(new THREE.CylinderGeometry(rad, rad, h, 14).scale(1.25, 1, 1).rotateY(-a).translate(Math.cos(a) * d, h / 2, Math.sin(a) * d));
      fins.push(cyl(rad * 0.9, rad * 0.9, 1.2, steel, Math.cos(a) * d, h, Math.sin(a) * d, 12, { scale: [1.25, 1, 1], ry: -a }));
    }
    [[13, 0, 606], [9.5, 606, 60], [6.5, 666, 48], [3.6, 714, 44]].forEach(([rad, y, h]) => bk.push(new THREE.CylinderGeometry(rad * 0.86, rad, h, 16).translate(0, y + h / 2, 0)));
    world.add(mesh(mergeGeometries(bk), silver, BK[0], 2, BK[1]));
    fins.push(cyl(0.5, 2.6, 70, steel, 0, 758, 0, 8), box(150, 14, 130, mat(0xcfc2aa), 0, -1, 0, { ry: 0.5 }));
    const bkTop = bake(fins); bkTop.position.set(BK[0], 2, BK[1]); world.add(bkTop);
    lights(world, [[BK[0], 831, BK[1]], [BK[0], 716, BK[1]]], { color: 0xff4030, size: 12, power: 1.5 });

    // ---- the Dubai Fountain on its lake: lines and rings of jets rising and falling in waves
    const lakeO = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; lakeO.push([BK[0] + 30 + Math.cos(a) * (215 + 40 * Math.sin(a * 3)), BK[1] + 255 + Math.sin(a) * (95 + 18 * Math.cos(a * 2))]); }
    world.add(prism(lakeO, 0.5, mat(0x1f6f84, { rough: 0.08, metal: 0.5 }), 0, 2, 0, { cast: false }));
    const jets = []; for (let i = 0; i < 46; i++) { const a = i / 45 * Math.PI - Math.PI / 2; jets.push([BK[0] + 30 + Math.sin(a) * 150, BK[1] + 235 + Math.cos(a) * 36, i * 0.22, 55]); }
    for (const cx of [-70, 30, 130]) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; jets.push([BK[0] + cx + Math.cos(a) * 20, BK[1] + 300 + Math.sin(a) * 20, cx * 0.02 + 2, 26]); }
    const NJ = 9, spray = new Float32Array(jets.length * NJ * 3), mist = lights(world, spray, { color: 0xfff0d8, size: 5, power: 0.8 });
    world.onUpdate((t) => {
      jets.forEach(([x, z, ph, top], j) => { const h = top * Math.pow(Math.max(0, Math.sin(t * 0.9 - ph)), 0.6) * (0.75 + 0.25 * Math.sin(t * 0.37 + ph * 3)); for (let k = 0; k < NJ; k++) { const i = (j * NJ + k) * 3, u = (k + ((t * 1.5 + j * 0.37) % 1)) / NJ; spray[i] = x + Math.sin(j * 7 + k) * u * 1.5; spray[i + 1] = 3 + h * u * (1.15 - 0.15 * u); spray[i + 2] = z + Math.cos(j * 5 + k) * u * 1.5; } });
      mist.geometry.attributes.position.needsUpdate = true;
    });

    // ---- the Burj Al Arab: a sail of white and blue glass on its own island, helipad cantilevered near the top
    const H = 285, N = 16, sailP = [], wingP = [], wAt = (y) => 86 * Math.pow(1 - Math.pow(y / H, 1.7), 0.9) + 1, dAt = (y) => 74 * Math.pow(1 - Math.pow(y / H, 2), 0.62) * (0.62 + 0.38 * Math.sin(Math.min(1, y / H + 0.25) * Math.PI)) + 1;
    const lvl = (i) => { const y = H * i / N; return [[-wAt(y) / 2, y, 0], [wAt(y) / 2, y, 0], [0, y, dAt(y)]]; };
    for (let i = 0; i < N; i++) { const [a, b, c] = lvl(i), [a1, b1, c1] = lvl(i + 1); sailP.push(a, b, b1, a, b1, a1); wingP.push(b, c, c1, b, c1, b1, c, a, a1, c, a1, c1); }
    const ba = new THREE.Group(), white = mat(0xf4f4f0, { rough: 0.5, side: THREE.DoubleSide, emissive: 0xfff0dc, glow: 0.16 }), baGlass = facadeMat({ color: 0x9fc4dc, floor: 7.6, bay: 5, frame: [0.05, 0.1], glass: 0x4f86b0, lit: 0.2, litColor: 0xffe2b0, night: 0.9, rough: 0.2, metal: 0.5 }); baGlass.side = THREE.DoubleSide;
    ba.add(mesh(facets(sailP), white), mesh(facets(wingP), baGlass));
    const edge = (f) => Array.from({ length: N + 1 }, (_, i) => lvl(i)[f]);
    for (const f of [0, 1, 2]) ba.add(tube(edge(f), f === 2 ? 2.2 : 1.6, white, { seg: 40, radial: 6 }));
    for (let i = 2; i < N; i += 2) { const [a, b, c] = lvl(i), [a1, b1] = lvl(Math.min(N, i + 2)); ba.add(beam(a, c, 1.1, white), beam(b, c, 1.1, white)); if (i % 4 === 2 && i + 2 <= N) ba.add(beam(c, a1, 1.2, white), beam(c, b1, 1.2, white)); }
    ba.add(cyl(0.5, 1.6, 44, white, 0, H - 6, 2, 8), cyl(13, 13, 1.4, white, -6, 208, -22, 24), cyl(11.6, 11.6, 0.2, mat(0x3a7a4a), -6, 209.5, -22, 24), beam([-6, 208, -22], [-22, 190, 0], 1.4, white), beam([-6, 208, -22], [12, 190, 0], 1.4, white));
    ba.add(box(40, 6, 10, white, 0, 198, dAt(198) + 2), cyl(96, 100, 6, mat(0xd8c8a8), 0, -4, 30, 40));
    ba.position.set(BAA[0], 2, BAA[1]); ba.rotation.y = 0.95; world.add(bake(ba), box(14, 3, 190, mat(0xcfc4b0), BAA[0] - 20, 1, (BAA[1] + COAST) / 2 - 30, { ry: 0.08 }));

    // ---- the Palm Jumeirah: trunk, sixteen fronds lined with villas, and the crescent breakwater round them
    const palm = new THREE.Group(), villas = [], vroofs = [], fronds = [], PT = PALM[1] - (COAST - 40);
    palm.add(box(96, 5, PT, sand, 0, -2.5, -PT / 2), cyl(60, 62, 5, sand, 0, -2.5, 30, 24));
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
      const z0 = -PT * 0.52 + i * PT * 0.075, len = 230 + 90 * Math.sin((i + 0.5) / 8 * Math.PI), a = s * (0.55 + i * 0.105), dx = Math.sin(a), dz = Math.cos(a) * 0.9 + 0.1;
      const f = box(30, 5, len, sand, s * 40 + dx * len / 2, -2.5, z0 + dz * len / 2, { ry: Math.atan2(dx, dz) }); palm.add(f);
      for (let d = 30; d < len - 8; d += 21) for (const e of [-1, 1]) {
        const k = Math.hypot(dx, dz), px = PALM[0] + s * 40 + dx * d + e * dz / k * 9, pz = PALM[1] + z0 + dz * d - e * dx / k * 9;
        villas.push({ x: px, y: 2, z: pz, w: 11, d: 13, h: 6.5, ry: Math.atan2(dx, dz), color: r.pick([0xf2e8d4, 0xe8d8bc, 0xf6f0e4]) }); if (d % 42 < 21 && e > 0) fronds.push([px - e * dz / k * 9, 2.2, pz + e * dx / k * 9]);
      }
    }
    const cres = []; for (let i = 0; i <= 40; i++) { const a = -0.42 + i / 40 * (Math.PI + 0.84); cres.push([Math.cos(a) * 480, 30 + Math.sin(a) * 450 - PT * 0.42]); } for (let i = 40; i >= 0; i--) { const a = -0.42 + i / 40 * (Math.PI + 0.84); cres.push([Math.cos(a) * 440, 30 + Math.sin(a) * 412 - PT * 0.42]); }
    palm.add(prism(cres, 5, sand, 0, -2.5, 0));
    const pink = facadeMat({ color: 0xe6b8a4, floor: 3.8, bay: 3, frame: [0.2, 0.25], glass: 0x4a5a6a, lit: 0.25, night: 0.9 }), atz = 30 + 431 - PT * 0.42;   // Atlantis at the crown of the crescent
    for (const s of [-1, 1]) palm.add(box(70, 78, 26, pink, s * 62, 0, atz), box(40, 52, 26, pink, s * 118, 0, atz), cyl(0, 9, 20, mat(0x6a8a9a), s * 62, 78, atz, 4));
    palm.add(box(56, 22, 24, pink, 0, 56, atz), box(170, 12, 30, pink, 0, 0, atz + 6));
    palm.position.set(PALM[0], 2, PALM[1]); world.add(bake(palm));

    // ---- the Museum of the Future: a silver ring of calligraphy standing on a green mound
    const [scriptMap, scriptGlow] = scriptTextures(), skin = mat(0xffffff, { metal: 0.45, rough: 0.35, emissive: 0xffffff, glow: 0.9 }); skin.map = scriptMap; skin.emissiveMap = scriptGlow;
    world.add(mesh(new THREE.TorusGeometry(31, 14.5, 20, 64).scale(1.32, 1, 1), skin, MOF[0], 71, MOF[1], { ry: 0.8, rz: 0.12 }), dome(1, mat(0x5f9a4a), MOF[0], 2, MOF[1], { scale: [62, 27, 50], ry: 0.8 }));

    // ---- the Dubai Frame: two gold towers and the bridge between them, in its park
    const gold = facadeMat({ color: 0xe0b450, floor: 6, bay: 6, frame: [0.3, 0.3], glass: 0xb88a30, lit: 0, rough: 0.3, metal: 0.8 }), fr = new THREE.Group();
    for (const s of [-1, 1]) fr.add(box(20, 150, 16, gold, s * 46.5, 0, 0)); fr.add(box(113, 16, 16, gold, 0, 134, 0), box(113, 5, 22, gold, 0, 0, 0), cyl(150, 150, 0.6, mat(0x6f9a50), 0, 0, 0, 32));
    fr.position.set(FRAME[0], 2, FRAME[1]); fr.rotation.y = 0.9; world.add(bake(fr));

    // ---- Sheikh Zayed Road: a canyon of towers either side of twelve lanes and the metro viaduct
    const glassy = [], stone = [], tops = [], cap = mat(0xd8cab0, { rough: 0.6 });
    const tones = [0xb8c8d4, 0xa4b8c8, 0xd0c4a8, 0x9ab0c0, 0xc8d0d4, 0xbfae90, 0x8fa8b8], stoneTones = [0xf0e2c6, 0xe6d6b6, 0xf4ead6, 0xdcc8a4, 0xf8f0e0];
    for (const s of [-1, 1]) for (let x = -1150; x < 500;) {
      const w = r.range(34, 52), d = r.range(34, 50), z = RZ + s * (HW + d / 2); x += w / 2;
      if (!(s > 0 && Math.abs(x - MOF[0]) < 84 + w / 2)) {
        const h = Math.min(r.range(130, 350), clear(x, RZ + s * (HW + 16), 34) - 30, Math.hypot(x - 300, z - 520) < 150 ? 60 : 999), c = r.pick(tones), style = r.int(0, 3);
        if (h > 25) {
          glassy.push({ x, z, w: w - 4, d, h, color: c });
          if (style === 0) { glassy.push({ x, z, y: h, w: (w - 4) * 0.66, d: d * 0.66, h: h * 0.16, color: c }); tops.push(cyl(0.3, 1.4, h * 0.2, steel, x, 2 + h * 1.16, z, 6)); }
          else if (style === 1) tops.push(cyl(0, (w - 4) * 0.71, h * 0.16, steel, x, 2 + h, z, 4, { ry: Math.PI / 4 }), cyl(0.3, 1, h * 0.12, steel, x, 2 + h * 1.15, z, 6));
          else if (style === 2) tops.push(mesh(facets([[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0.5, 0.5], [-0.5, 0, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0.5], [-0.5, 0, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0, -0.5], [-0.5, 0.5, 0.5], [-0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [0.5, 0.5, 0.5]]), steel, x, 2 + h, z, { scale: [w - 4, h * 0.3, d] }));
        }
      }
      x += w / 2 + r.range(3, 14);
    }
    const sz = new THREE.Group(), rail = mat(0xcfc8bc);
    tops.forEach((m) => { if (m.geometry.type !== 'CylinderGeometry' || m.geometry.parameters.radiusBottom > 2) m.material = cap; });
    sz.add(box(2700, 0.4, HW * 2 - 14, asphalt, -400, 2, RZ, { cast: false }), box(2700, 1.6, 9, rail, -400, 13, RZ + HW - 10), box(60, 9, 22, mat(0xd8b860, { metal: 0.6, rough: 0.35 }), -620, 13.5, RZ + HW - 10));
    for (let x = -1740; x < 950; x += 38) sz.add(box(2.4, 11, 2.4, rail, x, 2, RZ + HW - 10));
    world.add(bake(sz, tops));
    fleet(world, new THREE.BoxGeometry(84, 3.6, 3).translate(0, 16.6, 0), facadeMat({ color: 0xe8ecf0, floor: 3.6, bay: 2.2, frame: [0.12, 0.3], glass: 0x1c2a38, lit: 1, litColor: 0xfff0d0, night: 1.2 }), 3, (i, t) => [((i * 900 + t * 22) % 2700) - 1750, 0, RZ + HW - 10, 0]);
    for (let l = 0; l < 6; l++) {
      const dz = 5 + l * 5.2, n = 46;
      traffic(world, [[-1750, 3.4, RZ - dz], [950, 3.4, RZ - dz]], { count: n, color: 0xfff2d8, size: 3.6, speed: 20 + l * 2 });
      traffic(world, [[950, 3.4, RZ + dz - 1], [-1750, 3.4, RZ + dz - 1]], { count: n, color: 0xff3020, size: 3.6, speed: 20 + l * 2 });
    }
    fleet(world, new THREE.BoxGeometry(4.5, 1.5, 1.9).translate(0, 0.95, 0), mat(0xffffff, { rough: 0.35, metal: 0.4 }), 150, (i, t) => { const dir = i % 2 ? 1 : -1, x = ((((i * 53.3 + dir * t * (20 + (i % 6) * 2)) % 2700) + 2700) % 2700) - 1750; return [x, 2.3, RZ - dir * (5 + (i % 6) * 5.2), 0]; }, [0xf4f4f2, 0xf4f4f2, 0x22242a, 0x9aa0a6, 0xd8c8a0, 0xb8262a, 0xf4f4f2]);

    // ---- the rest of the city: Downtown round the Burj, the Marina's towers far down the coast, sand-coloured low-rise everywhere else
    const spots = [[BK[0], BK[1], 120], [BK[0] + 30, BK[1] + 255, 250], [MOF[0], MOF[1], 90], [FRAME[0], FRAME[1], 170], [BAA[0] - 60, BAA[1] - 190, 150]];
    const hub = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (s * s));
    const lots = cityGrid({
      rand: r, area: [-4300, -900, 4300, COAST - 30], block: 50, street: 22, jitter: 0.3, split: 0.25,
      keep: (x, z) => !(Math.abs(z - RZ) < HW + 62 && x > -1200 && x < 530) && Math.abs(z - RZ) > HW - 6 && !spots.some(([a, b, c]) => Math.hypot(x - a, z - b) < c) && r.chance(z < -400 ? 0.45 : 0.86),
      height: (x, z) => Math.min(r.range(7, 20) + (r.chance(0.55) ? 1 : 0.12) * (250 * hub(x, z, BK[0], BK[1] - 60, 430) + 300 * hub(x, z, -3300, 950, 420) + 190 * hub(x, z, 1500, 500, 360) + 110 * hub(x, z, -900, RZ, 700) * Math.exp(-(((z - RZ) / 220) ** 2))) * r.range(0.45, 1), clear(x, z, 90) - 32),
    });
    for (const b of lots) { if (!(b.h > 4)) continue; if (b.h > 60) { b.color = r.pick(tones); glassy.push(b); if (b.h > 170 && r.chance(0.5)) glassy.push({ x: b.x, z: b.z, y: b.h, w: b.w * 0.6, d: b.d * 0.6, h: b.h * 0.14, color: b.color }); } else { b.color = r.pick(stoneTones); stone.push(b); } }
    for (const b of [...glassy, ...stone]) b.y = (b.y ?? 0) + 2;
    world.add(buildings(glassy, facadeMat({ floor: 4, bay: 2.2, frame: [0.07, 0.13], glass: 0x7f98ac, lit: 0.16, litColor: 0xffe2b0, night: 0.9, rough: 0.2, metal: 0.55 })));
    world.add(buildings([...stone, ...villas], facadeMat({ floor: 3.4, bay: 3.2, frame: [0.26, 0.3], glass: 0x3a4650, lit: 0.14, litColor: 0xffd9a0, night: 0.9, rough: 0.9 }), { cast: false }));
    world.add(bake(box(190, 26, 150, mat(0xe2d4b8), BK[0] + 250, 2, BK[1] - 40), box(120, 30, 90, mat(0xd8c8a8), BK[0] + 240, 2, BK[1] + 90)));   // the Dubai Mall

    // ---- green and gold: date palms on the Palm, round the lake and along the beach; street lights coming on
    const pts = [...fronds], lampPts = [];
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; pts.push([BK[0] + 30 + Math.cos(a) * (236 + 40 * Math.sin(a * 3)), 2, BK[1] + 255 + Math.sin(a) * (112 + 18 * Math.cos(a * 2))]); }
    for (let x = -3000; x < 2600; x += 26) if (Math.abs(x - PALM[0]) > 60) pts.push([x + r.range(-6, 6), 2, COAST - r.range(8, 26)]);
    for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = r.range(40, 145); pts.push([FRAME[0] + Math.cos(a) * d, 2.4, FRAME[1] + Math.sin(a) * d]); }
    trees(world, pts, 'palm', { size: 13, rand: r });
    for (let x = -1740; x < 950; x += 30) lampPts.push([x, 12, RZ - HW + 8], [x, 12, RZ + HW - 3]);
    for (const b of stone) if (r.chance(0.3)) lampPts.push([b.x + 34, 9, b.z]);
    lights(world, lampPts, { color: [0xffc878, 0xffe0b0], size: 5, power: 0.8 });

    // ---- on the water: yachts off the beach, an abra or two
    const yachts = Array.from({ length: 26 }, () => [r.range(-3200, 2800), r.range(COAST + 120, COAST + 1500), r.chance(0.5) ? 1 : -1, r.range(1.5, 5)]).filter(([x, z]) => Math.hypot(x - PALM[0], z - PALM[1] + 150) > 560 && Math.hypot(x - BAA[0], z - BAA[1]) > 160);
    fleet(world, mergeGeometries([new THREE.BoxGeometry(22, 3, 6).translate(0, 1.2, 0), new THREE.BoxGeometry(12, 2.4, 5).translate(-2, 3.9, 0), new THREE.BoxGeometry(6, 2, 4).translate(-3, 6, 0)]), mat(0xf6f6f2, { rough: 0.4 }), yachts.length, (i, t) => { const [x, z, dir, v] = yachts[i]; return [x + dir * v * t, 0, z, dir > 0 ? 0 : Math.PI]; });

    return { world, path, focus, duration: 50 };
  },
};
