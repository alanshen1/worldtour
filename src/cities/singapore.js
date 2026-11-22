// Singapore at blue hour: up Marina Bay past the Merlion and the Esplanade's durians, along the Helix bridge by the Flyer and the lotus museum,
// between the towers of Marina Bay Sands under the SkyPark, and down into the glowing Supertree Grove.
import { THREE, mergeGeometries, createWorld, rng, clamp, lerp, mat, glowMat, facadeMat, mesh, box, cyl, sphere, lathe, prism, tube, beam, instances, buildings, cityGrid, water, trees, lights, traffic, clearance } from '../kit.js';

const PI = Math.PI, UNIT = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
// a canvas texture drawn by `draw(ctx, w, h)`
function paint(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
// skins a stack of same-sized outlines [{ y, pts: [[x, z], ...] }] into flat-faced walls with a lid
function loft(secs) {
  const pos = [], n = secs[0].pts.length, P = (s, i) => [s.pts[i][0], s.y, s.pts[i][1]];
  for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = secs[k], b = secs[k + 1]; pos.push(...P(a, i), ...P(b, j), ...P(a, j), ...P(a, i), ...P(b, i), ...P(b, j)); }
  const top = secs[secs.length - 1]; for (let i = 1; i < n - 1; i++) pos.push(...P(top, 0), ...P(top, i), ...P(top, i + 1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
// boats: parts [geometry, material] that sail together along straight lines [x0, z0, x1, z1]
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
    const r = rng(1965);
    const world = createWorld({
      sky: { top: 0x0a1846, horizon: 0x4a66b4, bottom: 0x060a1c, haze: 0.4 },
      sun: { dir: [-0.9, 0.04, 0.35], color: 0x9fb4ff, power: 0.6, disc: 0xff8a50, size: 0.0012 },
      ambient: { sky: 0x5a72d0, ground: 0x2c2a3c, power: 1.15 },
      fog: { color: 0x2c3c74, density: 0.00042 }, stars: 160, exposure: 1.15, env: 0.7,
    });
    // x is east, z is south. Marina Bay is the water in the middle; land stands 3 m above it.
    const path = [[-380, 34, 700], [-410, 30, 520], [-462, 22, 200], [-390, 36, -190], [-200, 48, -400], [60, 54, -430], [300, 62, -420], [350, 105, -250], [390, 150, -100], [560, 150, -70], [760, 100, -30], [960, 48, 40]];
    const MERLION = [-520, 80], ESPL = [-300, -520], FLYER = [190, -710], ART = [468, -325], MBS = [560, 0], GROVE = [960, 40], G = 3;
    const focus = [[0.08, MERLION[0], 12, MERLION[1]], [0.19, MERLION[0], 12, MERLION[1]], [0.3, ESPL[0], 14, ESPL[1]], [0.38, ESPL[0] + 40, 14, ESPL[1]], [0.46, FLYER[0], 90, FLYER[1]], [0.52, ART[0], 30, ART[1]], [0.6, MBS[0], 170, 0], [0.76, MBS[0], 185, 0]];
    const clear = clearance(path), mirrored = new THREE.Group();

    // ---- bay and land: see-through water over a mirror image of the skyline, dark ground with glowing streets
    const bay = water(world, 0, { color: 0x081428, rough: 0.12, strength: 0.4, ripple: 70 });
    Object.assign(bay.material, { transparent: true, opacity: 0.6, depthWrite: false });
    const WEST = [[-2800, -360], [-600, -360], [-560, -100], [-548, 44], [-500, 60], [-500, 104], [-550, 122], [-560, 400], [-520, 980], [-2800, 980]];
    const NORTH = [[-2800, -430], [-330, -430], [-150, -470], [120, -520], [205, -600], [330, -900], [330, -2800], [-2800, -2800]];
    const EAST = [[480, -2800], [480, -520], [452, -420], [432, -250], [440, 250], [480, 420], [700, 520], [1250, 560], [1250, -2800]];
    const SOUTH = [[-2800, 980], [-500, 980], [-150, 800], [380, 760], [640, 640], [1250, 680], [1250, 2800], [-2800, 2800]];
    const P = 64, streets = paint(128, 128, (g) => { const w = 18 * 128 / P / 2; g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#3a2c18'; g.fillRect(0, 0, 128, w); g.fillRect(0, 128 - w, 128, w); g.fillRect(0, 0, w, 128); g.fillRect(128 - w, 0, w, 128); }, [1 / P, 1 / P]);
    const landMat = mat(0x1c2026, { rough: 0.9, emissive: 0xffffff, glow: 1 }); landMat.emissiveMap = streets;
    for (const o of [WEST, NORTH, SOUTH]) world.add(prism(o, 5, landMat, 0, -2, 0, { cast: false }));
    world.add(prism(EAST, 5, mat(0x284a34, { rough: 0.95, emissive: 0x0c3a2a, glow: 0.5 }), 0, -2, 0, { cast: false }));

    // ---- Marina Bay Sands: three splayed towers, the SkyPark laid across them like a ship
    {
      const [x] = MBS, tower = facadeMat({ color: 0x8fa0b4, floor: 3.6, bay: 2.8, frame: [0.1, 0.16], glass: 0x14202e, lit: 0.55, litColor: 0xffe0b0, night: 1.5, rough: 0.35, metal: 0.4 }); tower.side = THREE.DoubleSide;
      const g = new THREE.Group(), secs = []; for (let k = 0; k <= 10; k++) { const t = k / 10, a = -30 + 19 * (1 - (1 - t) ** 2.2), b = 27 - 14 * (1 - (1 - t) ** 2.2); secs.push({ y: t * 192, pts: [[a, -38], [b, -38], [b, 38], [a, 38]] }); }
      const tg = loft(secs); for (const z of [-140, 0, 140]) g.add(mesh(tg, tower, 0, 0, z, { cast: false }), box(1, 150, 60, glowMat(0x9fd0ff, 0.5), 3, 4, z, { cast: false }));
      // the SkyPark: a 450 m deck with pointed ends, hanging 70 m beyond the north tower
      const hull = []; for (let i = 0; i <= 40; i++) { const t = i / 20 - 1 + (i > 20 ? 0 : 0), s = i <= 20 ? -1 + i / 20 * 2 : 1 - (i - 20) / 20 * 2, side = i <= 20 ? 1 : -1, w = 21 * Math.pow(1 - Math.abs(s) ** 2.6, 0.6); hull.push([side * w + 9 * s * s - 2, s * 228 - 38]); }
      g.add(prism(hull, 9, mat(0xc8ccd2, { rough: 0.5, metal: 0.3, emissive: 0x6a7ab0, glow: 0.3 }), 0, 192, 0, { cast: false }), prism(hull.map(([a, b]) => [a * 0.82 - 0.4, b * 0.97]), 1.2, mat(0x2a4a3a, { emissive: 0x1a6aa0, glow: 0.35 }), 0, 201, 0, { cast: false }));
      g.add(box(7, 0.5, 150, glowMat(0x40c8ff, 1.6), -12, 201.2, 20, { cast: false }), tube(hull.slice(0, 21).map(([a, b]) => [a + 0.6, 196, b]), 0.5, glowMat(0xfff0d0, 2, { toneMapped: false }), { seg: 60, radial: 4 }), tube(hull.slice(20).map(([a, b]) => [a - 0.6, 196, b]), 0.5, glowMat(0xfff0d0, 2, { toneMapped: false }), { seg: 60, radial: 4 }));
      // the Shoppes on the waterfront in front of the towers
      for (const z of [-150, 0, 150]) g.add(mesh(new THREE.CylinderGeometry(34, 34, 130, 20, 1, false, 0, PI).rotateX(PI / 2).rotateY(PI / 2).scale(1, 0.55, 1), mat(0x9aa6b4, { rough: 0.3, metal: 0.5, emissive: 0xffc890, glow: 0.3 }), -75, 0, z, { cast: false }));
      g.position.set(x, G, 0); mirrored.add(g);
      const palms = []; for (let i = 0; i < 26; i++) palms.push([x - 4 + r.range(-8, 8), G + 201.5, -230 + i * 17]); trees(world, palms, 'palm', { size: 7, rand: r });
      // the evening laser show from the SkyPark
      const lasers = [0x40ff90, 0x40c0ff, 0xb060ff, 0x40ff90, 0xff60c0].map((c, i) => { const m = mesh(new THREE.BoxGeometry(0.7, 0.7, 900).translate(0, 0, -450), glowMat(c, 1, { additive: true, opacity: 0.5 }), x - 14, G + 203, -140 + i * 70, { cast: false, receive: false }); world.add(m); return m; });
      world.onUpdate((t) => lasers.forEach((m, i) => { m.rotation.set(0.12 + 0.1 * Math.sin(t * 0.5 + i), PI / 2 + 0.5 * Math.sin(t * 0.3 + i * 1.3), 0, 'YXZ'); }));
    }

    // ---- ArtScience Museum: a white lotus of ten fingers on the shore
    {
      const [x, z] = ART, g = new THREE.Group(), white = mat(0xe8ecf2, { rough: 0.5, emissive: 0x9ab0ff, glow: 0.32, side: THREE.DoubleSide });
      for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2, len = 34 + 22 * (0.5 + 0.5 * Math.sin(k * 2.3 + 1)), petal = loft([{ y: 0, pts: [[-7, -5], [7, -5], [7, 5], [-7, 5]] }, { y: len * 0.55, pts: [[-10, -6], [10, -6], [10, 6], [-10, 6]] }, { y: len, pts: [[-8, -1], [8, -1], [8, 6], [-8, 6]] }]); const m = mesh(petal, white, Math.sin(a) * 9, 5, Math.cos(a) * 9, { cast: false }); m.rotation.set(0.72, a, 0, 'YXZ'); g.add(m); }
      g.add(lathe([[0, 0], [22, 0], [20, 5], [9, 9], [0, 9]], white, 0, 0, 0, 24, { cast: false }), cyl(44, 44, 0.4, mat(0x18304a, { rough: 0.1, metal: 0.4 }), 0, 0.1, 0, 32, { cast: false }));
      g.position.set(x, G, z); mirrored.add(g);
    }

    // ---- the Merlion on its point, spouting into the bay
    {
      const [x, z] = MERLION, g = new THREE.Group(), white = mat(0xf0f0ec, { rough: 0.6, emissive: 0xffe8c0, glow: 0.45 });
      g.add(cyl(7, 9, 4, mat(0x9aa0a8, { emissive: 0x4060a0, glow: 0.3 }), 0, 0, 0, 16), tube([[0, 4, 0], [-2.2, 7, 0], [-1.6, 10.5, 0], [1, 13, 0], [1.6, 15.5, 0]], 2.6, white, { radial: 10, seg: 24 }), tube([[-1, 4.5, 0], [-5, 5.5, 1], [-6.5, 8.5, 0]], 1.3, white, { radial: 8 }));
      g.add(sphere(3.3, white, 2.2, 17.2, 0, { scale: [1.15, 1, 1] }), mesh(new THREE.ConeGeometry(3.9, 5, 9).rotateZ(PI / 2 + 0.5), white, 0, 17.4, 0), sphere(1.2, white, 5.2, 16.6, 0));
      g.position.set(x, G, z); g.scale.setScalar(1.7); world.add(g);
      const n = 90, sp = new Float32Array(n * 3), spout = lights(world, sp, { color: 0xdff0ff, size: 2.2, power: 0.7 });
      world.onUpdate((t) => { for (let i = 0; i < n; i++) { const u = (i / n + t * 0.55) % 1, w = (i * 7 % 5 - 2) * 0.25 * u; sp[i * 3] = x + 9.5 + u * 34; sp[i * 3 + 1] = G + 27.5 + u * 10 - u * u * 40 + w; sp[i * 3 + 2] = z + w; } spout.geometry.attributes.position.needsUpdate = true; });
      lights(world, [[x + 12, G + 2, z + 10], [x + 12, G + 2, z - 10], [x - 4, G + 2, z + 12]], { color: 0xffe0b0, size: 14, power: 0.9 });
      // the Fullerton Hotel behind: grey stone, columns of light
      const stone = facadeMat({ color: 0xb8ae9c, floor: 5, bay: 3.6, frame: [0.3, 0.16], glass: 0x1a1612, lit: 0.5, litColor: 0xffd9a0, night: 1.3 }); stone.emissive.set(0xffb060); stone.emissiveIntensity = 0.3;
      mirrored.add(box(110, 34, 80, stone, -640, G, -60, { cast: false }), box(120, 9, 36, stone, -590, G, 250, { cast: false }));
    }

    // ---- the Esplanade: two spiky durian shells
    {
      const [x, z] = ESPL, shell = new THREE.SphereGeometry(1, 44, 14, 0, PI * 2, 0, PI / 2).toNonIndexed(), p = shell.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 3) { const k = (i / 3) % 2 ? 2 : 0; v.fromBufferAttribute(p, i + k); p.setXYZ(i + k, v.x * 1.13, v.y * 1.13 + 0.01, v.z * 1.13); }
      shell.computeVertexNormals();
      const skin = mat(0xc9ccd0, { rough: 0.3, metal: 0.7, flat: true, emissive: 0xffd9a0, glow: 0.1 });
      mirrored.add(mesh(shell, skin, x, G, z, { cast: false, scale: [62, 30, 42], ry: 0.3 }), mesh(shell, skin, x + 120, G, z - 50, { cast: false, scale: [54, 26, 38], ry: -0.25 }), box(210, 8, 90, mat(0x3a3e46, { emissive: 0xffc890, glow: 0.25 }), x + 55, G, z - 28, { cast: false }));
    }

    // ---- the Helix bridge: two steel spirals round a curved deck, and the Singapore Flyer turning beyond it
    {
      const axis = new THREE.CatmullRomCurve3([[205, 9, -600], [270, 9, -530], [350, 9, -470], [440, 9, -425], [470, 9, -410]].map((q) => new THREE.Vector3(...q))), L = axis.getLength(), up = new THREE.Vector3(0, 1, 0), dots = [];
      const helix = (ph) => Array.from({ length: 241 }, (_, i) => { const u = i / 240, c = axis.getPointAt(u), t = axis.getTangentAt(u), side = new THREE.Vector3().crossVectors(t, up).normalize(), a = u * L / 11 * PI * 2 + ph; return [c.x + side.x * Math.cos(a) * 5.5, c.y + 2.5 + Math.sin(a) * 5.5, c.z + side.z * Math.cos(a) * 5.5]; });
      const steel = mat(0xd0d8e4, { metal: 0.7, rough: 0.3, emissive: 0xa070ff, glow: 0.8 });
      world.add(tube(helix(0), 0.32, steel, { seg: 480, radial: 4 }), tube(helix(PI), 0.32, steel, { seg: 480, radial: 4 }), tube(axis.getSpacedPoints(30).map((q) => [q.x, q.y - 1.2, q.z]), 2.6, mat(0x3a3e48, { emissive: 0xffd9a0, glow: 0.25 }), { radial: 4, seg: 40 }));
      for (let i = 0; i <= 60; i++) { const c = axis.getPointAt(i / 60); dots.push([c.x, 9.4, c.z]); } lights(world, dots, { color: 0xfff0d0, size: 2.6, power: 1.2 });
      const [x, z] = FLYER, wheel = new THREE.Group(), R = 75, rim = glowMat(0xbfe0ff, 1.8, { toneMapped: false }), spokes = [];
      for (let i = 0; i < 56; i++) { const a = i / 56 * PI * 2; spokes.push(0, 0, i % 2 ? 2 : -2, Math.cos(a) * R, Math.sin(a) * R, 0); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3));
      wheel.add(mesh(new THREE.TorusGeometry(R, 1.1, 6, 96), rim, 0, 0, 0, { cast: false }), mesh(new THREE.TorusGeometry(R - 5, 0.5, 5, 96), mat(0xc8d0dc, { metal: 0.6 }), 0, 0, 0, { cast: false }), new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x8fa8d0 })));
      wheel.add(instances(new THREE.CapsuleGeometry(1.9, 4, 3, 8).rotateZ(PI / 2), mat(0xdfe8f4, { emissive: 0xcfe4ff, glow: 0.9 }), Array.from({ length: 28 }, (_, i) => ({ x: Math.cos(i / 28 * PI * 2) * (R + 3.4), y: Math.sin(i / 28 * PI * 2) * (R + 3.4) })), { cast: false }), cyl(4, 4, 9, mat(0xc8d0dc), 0, 0, 0, 12, { rx: PI / 2, cast: false }));
      wheel.position.set(x, G + 90, z); world.onUpdate((t) => { wheel.rotation.z = t * 0.03; });
      const legs = new THREE.Group(); for (const s of [-1, 1]) for (const e of [-1, 1]) legs.add(beam([s * 26, 0, e * 22], [0, 90, e * 5], 2.4, mat(0xc8d0dc, { metal: 0.5, emissive: 0x6080c0, glow: 0.3 })));
      legs.add(box(90, 14, 60, mat(0x3a4250, { emissive: 0xffc890, glow: 0.3 }), 0, 0, 0)); legs.position.set(x, G, z);
      mirrored.add(wheel, legs);
    }

    // ---- Gardens by the Bay: the Supertree Grove glowing purple and pink, the skywalk between the tall ones, the two glass domes
    {
      const [gx, gz] = GROVE, trunkP = [[3.4, 0], [2.4, 0.2], [1.9, 0.5], [2.2, 0.72], [4.2, 0.86], [9, 0.96], [12, 1]].map(([a, b]) => new THREE.Vector2(a / 12, b)), trunks = [], crowns = [], tops = [], spots = [];
      const sites = []; for (let i = 0; i < 11; i++) { const a = i / 11 * PI * 2 + 0.3; sites.push([gx + Math.cos(a) * (i % 2 ? 105 : 82), gz + Math.sin(a) * (i % 2 ? 105 : 82), i % 2 ? r.range(38, 48) : r.range(56, 70)]); }
      for (const [a, b] of [[-210, -150], [-170, 120], [-270, 30], [140, -170], [170, 150], [-60, 230], [-330, -110], [-120, -210], [40, -240], [230, -20], [-250, 200]]) sites.push([gx + a, gz + b, r.range(30, 44)]);
      for (const [x, z, h] of sites) {
        if (clear(x, z, 40) < h + 26) continue; const c = r.pick([0xff40d0, 0xb050ff, 0xff60a0, 0x8a5cff, 0xff30b0]), rad = h * 0.36;
        trunks.push({ x, y: G, z, sx: rad, sy: h, sz: rad, color: c }); crowns.push({ x, y: G, z, sx: rad * 1.02, sy: h, sz: rad * 1.02, color: c }); tops.push([x, G + h + 1, z]);
        for (let k = 0; k < 10; k++) spots.push([x + Math.cos(k * 0.63) * rad, G + h + 0.5, z + Math.sin(k * 0.63) * rad]);
      }
      const funnel = new THREE.LatheGeometry(trunkP, 14), bark = mat(0x4a2a5a, { rough: 0.7, emissive: 0xffffff, glow: 0.55 }); bark.emissiveMap = paint(8, 64, (c) => { const gr = c.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#888'); gr.addColorStop(1, '#333'); c.fillStyle = gr; c.fillRect(0, 0, 8, 64); });
      const st = instances(funnel, bark, trunks, { cast: false }), wire = new THREE.MeshBasicMaterial({ wireframe: true, toneMapped: false }), cr = instances(new THREE.LatheGeometry(trunkP.slice(2), 22), wire, crowns, { cast: false });
      world.add(st, cr); lights(world, spots, { color: [0xff60e0, 0xc080ff, 0xffa0d0], size: 3, power: 1.3 }); lights(world, tops, { color: 0xff70e0, size: 26, power: 0.5 });
      // the colours breathe between purple and pink
      const base = crowns.map((c) => new THREE.Color(c.color)), tmp = new THREE.Color();
      world.onUpdate((t) => { base.forEach((c, i) => { tmp.copy(c).offsetHSL(0.05 * Math.sin(t * 0.6 + i), 0, 0.12 * Math.sin(t * 1.1 + i * 2)).multiplyScalar(1.5); cr.setColorAt(i, tmp); }); cr.instanceColor.needsUpdate = true; });
      const tall = sites.filter((s, i) => i < 11 && i % 2 === 0).map(([x, z]) => [x, G + 24, z]); if (tall.length > 2) world.add(tube([...tall, tall[0]].slice(0, 5).map(([a, , c]) => [a, G + 30, c]), 1.1, mat(0xd0a030, { emissive: 0xffc040, glow: 0.9 }), { seg: 60, radial: 5, tension: 0.6 }));
      // Flower Dome and Cloud Forest: ribbed glass shells lit from inside
      const glassy = mat(0x8fb0c8, { rough: 0.15, metal: 0.5, emissive: 0xffd9a0, glow: 0.35 }), ribs = new THREE.MeshBasicMaterial({ color: 0xdfeaff, wireframe: true });
      for (const [x, z, sx, sy, sz, ry] of [[720, 330, 95, 40, 60, 0.2], [930, 400, 62, 58, 52, -0.3]]) { const sg = new THREE.SphereGeometry(1, 20, 6, 0, PI * 2, 0, PI / 2); world.add(mesh(sg, glassy, x, G, z, { scale: [sx, sy, sz], ry, cast: false }), mesh(sg, ribs, x, G, z, { scale: [sx * 1.005, sy * 1.005, sz * 1.005], ry, cast: false })); }
      const green = []; for (let i = 0; i < 260; i++) { const x = r.range(640, 1230), z = r.range(-420, 520); if (clear(x, z, 30) > 80 && sites.every(([a, b]) => Math.hypot(x - a, z - b) > 16) && !(Math.abs(x - 720) < 100 && Math.abs(z - 330) < 66) && !(Math.abs(x - 930) < 66 && Math.abs(z - 400) < 56)) green.push([x, G, z]); }
      trees(world, green, 'round', { size: 10, color: [0x2e6a44, 0x3a7a4c, 0x286040, 0x4a8a50], rand: r }).traverse((o) => { o.castShadow = false; });
      const walk = []; for (let i = 0; i < 500; i++) { const a = r.range(0, 6.28), d = r.range(20, 330), x = gx + Math.cos(a) * d * 1.1 - 60, z = gz + Math.sin(a) * d; if (x > 640 && x < 1240 && z < 540) walk.push([x, G + 1.2, z]); }
      lights(world, walk, { color: [0xffd9a0, 0x80ffb0, 0xff80e0, 0x9fd0ff], size: 3.2, power: 1.1 });
    }

    // ---- the city round the bay: the CBD's towers to the south-west, hotels at Marina Centre, low blocks behind
    const cbd = (x, z) => Math.exp(-((x + 760) ** 2 + (z - 380) ** 2) / 330 ** 2) + 0.8 * Math.exp(-((x + 250) ** 2 + (z - 1080) ** 2) / 260 ** 2) + 0.55 * Math.exp(-((x + 40) ** 2 + (z + 800) ** 2) / 300 ** 2);
    const inLand = (x, z, m = 30) => [WEST, NORTH, SOUTH].some((o) => inPoly(o, x - m, z - m) && inPoly(o, x + m, z + m) && inPoly(o, x - m, z + m) && inPoly(o, x + m, z - m));
    const lots = cityGrid({
      rand: r, area: [-2400 + 9, -2400 + 9, 1200, 2400], block: 46, street: 18, jitter: 0.3, split: 0.25, palette: [0x44546a, 0x56687e, 0x3a4a60, 0x687888, 0x7a8492, 0x4a5058],
      keep: (x, z) => inLand(x, z) && !(Math.abs(x + 640) < 80 && Math.abs(z + 60) < 66) && Math.hypot(x - ESPL[0] - 55, z - ESPL[1] + 28) > 130 && Math.hypot(x - FLYER[0], z - FLYER[1]) > 70,
      height: (x, z) => { const h = Math.min(14 + r.range(0.25, 1) * (30 + 250 * cbd(x, z)), clear(x, z, 100) - 40); return h > 10 ? h : 0; },
    });
    const glassM = facadeMat({ floor: 4, bay: 2.6, frame: [0.1, 0.16], glass: 0x121c2c, lit: 0.42, litColor: 0xdfe8ff, night: 1.5, rough: 0.4, metal: 0.3 });
    const near = lots.filter((b) => Math.hypot(b.x, b.z) < 1500), farLots = lots.filter((b) => Math.hypot(b.x, b.z) >= 1500);
    lots.forEach((b) => { b.y = G; }); mirrored.add(buildings(near, glassM, { cast: false })); world.add(buildings(farLots, glassM, { cast: false }));
    const crownsL = near.filter((b) => b.h > 150).map((b) => ({ x: b.x, y: G + b.h, z: b.z, sx: b.w + 0.6, sy: 3, sz: b.d + 0.6, color: r.pick([0x40c8ff, 0xff4080, 0xffc040, 0xffffff, 0x60ff90]) }));
    mirrored.add(instances(UNIT(), glowMat(0xffffff, 1.4, { toneMapped: false }), crownsL, { cast: false }));

    // ---- lights and movement: promenade lamps, expressway traffic over the Benjamin Sheares bridge, boats on the bay, ships waiting out at sea
    const lamps = [], edge = (o, i0, i1, step) => { for (let i = i0; i < i1; i++) { const [ax, az] = o[i], [bx, bz] = o[i + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step)); for (let k = 0; k < n; k++) lamps.push([ax + (bx - ax) * k / n, G + 5, az + (bz - az) * k / n]); } };
    edge(WEST, 1, 8, 14); edge(NORTH, 1, 5, 14); edge(EAST, 1, 6, 14); edge(SOUTH, 1, 5, 14);
    mirrored.add(lights(world, lamps, { color: 0xffd9a0, size: 4, power: 1.2 }));
    const ECP = [[-2400, 1500], [-600, 1230], [200, 1020], [760, 760], [1000, 300], [1080, -400], [900, -1100], [700, -2400]].map(([x, z]) => [x, 26, z]);
    world.add(tube(ECP, 7, mat(0x3a3e46), { radial: 4, seg: 120, tension: 0.4 }));
    traffic(world, ECP.map(([x, y, z]) => [x, y + 7.6, z]), { count: 120, color: 0xfff2d8, size: 4.5, speed: 24, spread: 3 }); traffic(world, ECP.map(([x, y, z]) => [x, y + 7.6, z]).reverse(), { count: 120, color: 0xff3a2a, size: 4.5, speed: 24, spread: 3 });
    for (const [a, b] of [[[-2300, G + 1, -395], [-360, G + 1, -395]], [[-580, G + 1, 960], [-580, G + 1, -340]], [[-1200, G + 1, 110], [-590, G + 1, 110]]]) traffic(world, [a, b], { count: 60, color: 0xfff2d8, size: 3.6, speed: 13, spread: 5 });
    const dark = mat(0x18202c, { rough: 0.6 });
    fleet(world, [[new THREE.BoxGeometry(5, 2.4, 16).translate(0, 0.6, 0), dark], [mergeGeometries([new THREE.BoxGeometry(4.4, 1.6, 10).translate(0, 2.6, -1), new THREE.BoxGeometry(5.3, 0.4, 16.3).translate(0, 1.9, 0)]), glowMat(0xffffff, 1.5, { toneMapped: false })]],
      [[-300, 760, -420, -330], [-150, -420, 250, 600], [380, 300, -480, 200], [-480, -250, 400, -300], [100, 650, 380, -200]], 14, 5, [0xff5a40, 0xffc850, 0x40d8ff, 0xff60c0, 0x60ff9a], r);
    const ships = [], shipLights = []; for (let i = 0; i < 26; i++) { const x = r.range(1500, 3400), z = r.range(-1800, 2200), ry = r.range(-0.4, 0.4); ships.push({ x, y: 0, z, ry, sx: r.range(0.8, 1.6), sy: 1, sz: r.range(0.8, 1.5) }); shipLights.push([x, 16, z], [x + 20, 9, z + 60], [x - 10, 9, z - 60]); }
    world.add(instances(mergeGeometries([new THREE.BoxGeometry(26, 9, 150).translate(0, 3, 0), new THREE.BoxGeometry(20, 16, 18).translate(0, 14, -58)]), dark, ships, { cast: false })); lights(world, shipLights, { color: [0xffe0b0, 0xffffff, 0xff5040], size: 3, power: 1.2, fixed: true });
    const sparkle = []; while (sparkle.length < 2600) { const x = r.range(-2400, 440), z = r.range(-2400, 2400); if (inLand(x, z, 10)) sparkle.push([x, G + r.range(4, 50), z]); }
    lights(world, sparkle, { color: [0xffc27a, 0xffe0b0, 0xdfeaff], size: 2.4, power: 0.9, fixed: true });

    world.add(mirrored); const mirror = mirrored.clone(true); mirror.scale.y = -1; world.add(mirror);
    world.scene.traverse((o) => { o.castShadow = false; });
    return { world, path, focus, duration: 46 };
  },
};
