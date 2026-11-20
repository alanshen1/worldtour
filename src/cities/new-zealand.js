// New Zealand's Southern Alps on a brilliant day: low up a turquoise glacial lake past the stone church among the lupins, the lakeside town and its steamer,
// over sheep country to the foot of the great peak and its glacier, up a tussock valley, over the pass and down into a fjord of waterfalls.
import { THREE, mergeGeometries, createWorld, rng, mat, mesh, box, cyl, instances, terrain, water, trees, lights, clearance, noise2, fbm, smooth, clamp, lerp } from '../kit.js';

// merges meshes that share a material into one mesh each
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
const gable = (w, h, d) => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
// a polyline on the map; line.near(x, z) gives the distance to it and sets line.t (0..1 along its length)
function line(pts) {
  const segs = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az, len = Math.hypot(dx, dz); segs.push([ax, az, dx, dz, len, total]); total += len; }
  const L = { t: 0, near(x, z) {
    let best = Infinity;
    for (const [ax, az, dx, dz, len, l0] of segs) { const u = clamp(((x - ax) * dx + (z - az) * dz) / (len * len)), d = Math.hypot(x - ax - dx * u, z - az - dz * u); if (d < best) { best = d; L.t = (l0 + u * len) / total; } }
    return best;
  } };
  return L;
}
// makes a material keep only what lies above (side = 1) or below (side = -1) the water level y = 0
function keepSide(material, side) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWy = (modelMatrix * vec4(position, 1.0)).y;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (vWy * ${side}.0 < 0.0) discard;`);
  };
  material.customProgramCacheKey = () => 'side' + side; return material;
}
// a small repeating grain texture: gives the vertex-coloured land close-up texture and relief
function grain(seed) {
  const N = 256, r = rng(seed), d = new Uint8Array(N * N * 4), f = new Float32Array(N * N);
  for (const [cells, amp] of [[6, 0.42], [14, 0.26], [32, 0.18], [72, 0.14]]) {
    const g = Float32Array.from({ length: cells * cells }, () => r());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * cells, fy = y / N * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      f[y * N + x] += amp * lerp(lerp(g[y0 * cells + x0], g[y0 * cells + x1], su), lerp(g[y1 * cells + x0], g[y1 * cells + x1], su), sv);
    }
  }
  for (let i = 0; i < N * N; i++) { const v = 165 + 82 * clamp(f[i] * 2 - 0.5) + r.range(-7, 7); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

export default {
  build() {
    const r = rng(1840), sunDir = [-0.35, 0.62, 0.7];
    const world = createWorld({
      sky: { top: 0x1d5fc9, horizon: 0xb5dbf5, bottom: 0x6fd0dc, haze: 0.75 },
      sun: { dir: sunDir, color: 0xfff6e6, power: 3.5, disc: 0xffffff, size: 0.0004 },
      ambient: { sky: 0xc4deff, ground: 0x8a8c90, power: 1.15 },
      fog: { color: 0xc3def2, density: 0.00015 }, exposure: 1.0, env: 0.75,
    });
    // north is -Z. The lake runs north to the foot of the great peak; a valley climbs north-west to a pass, and the fjord lies beyond it.
    const path = [[130, 22, 1050], [175, 17, 800], [178, 16, 620], [40, 20, 420], [-130, 26, 200], [0, 24, -10], [300, 54, -230], [150, 46, -480], [-80, 110, -700], [-380, 264, -900], [-700, 190, -1060], [-1080, 92, -1190], [-1500, 62, -1240], [-1850, 68, -1255]];
    const focus = [[0.08, 232, 6, 620], [0.125, 232, 6, 620], [0.17, -300, 12, 260], [0.24, -230, 6, 300], [0.3, 350, 600, -1500], [0.37, 320, 12, -270], [0.45, 350, 520, -1500], [0.53, -380, 250, -900], [0.62, -900, 190, -1130], [0.72, -1500, 150, -1245], [0.8, -3150, 450, -1330]];
    const clear = clearance(path), flight = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)), false, 'centripetal').getSpacedPoints(340);

    // ---- the shape of the land
    const lake = line([[60, 1250], [40, 900], [0, 400], [20, 0], [110, -380]]), valley = line([[110, -380], [60, -560], [-100, -720], [-380, -900], [-700, -1060]]);
    const glacier = line([[110, -380], [190, -700], [300, -1050], [340, -1300]]), fjord = line([[-760, -1090], [-1080, -1200], [-1500, -1245], [-1900, -1200], [-2550, -1215], [-2900, -900], [-3600, -600], [-7000, -400]]);
    const CH = [232, 620], TOWN = [-300, 260];
    const ridge = (x, z) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { const v = 1 - Math.abs(2 * noise2(x * f + i * 17.3, z * f - i * 9.1) - 1); s += a * v * v; a *= 0.5; f *= 2.1; } return s / 0.94; };
    const horn = (x, z, cx, cz, H, R, k, ph, e) => { const dx = x - cx, dz = z - cz; return H * Math.pow(Math.max(0, 1 - Math.hypot(dx, dz) / (R * (1 + 0.36 * Math.cos(k * Math.atan2(dz, dx) + ph)))), e); };
    const shore = (x, z) => { const d = lake.near(x, z); return d - lerp(220, 100, smooth(0.78, 1, lake.t)) + 60 * Math.exp(-((x - CH[0]) ** 2 + (z - CH[1]) ** 2) / 3000); };   // metres inland from the lake's edge
    const raw = (x, z) => {
      const wx = x + 90 * (fbm(x / 400, z / 400, 2) - 0.5), wz = z + 90 * (fbm(x / 400 + 9, z / 400, 2) - 0.5), fd = fjord.near(x, z), fs = fd - lerp(50, 150, smooth(0, 0.07, fjord.t));
      let m = 110 + 560 * ridge(wx / 820, wz / 820) * (0.55 + 0.7 * fbm(x / 2600, z / 2600, 2)) + 260 * Math.exp(-((fd / 650) ** 2)) + 26 * fbm(x / 110, z / 110, 3);
      const big = horn(wx, wz, 350, -1500, 1150, 1200, 3, 0.6, 1.45) + horn(wx, wz, 820, -1250, 620, 800, 4, 1, 1.4); if (big > 0) m += big * (0.78 + 0.4 * ridge(x / 300, z / 300));
      const s = shore(x, z), dv = valley.near(x, z), vt = valley.t, dg = glacier.near(x, z);
      if (s < 800) {
        const hills = s < 0 ? 0 : (28 * fbm(x / 170, z / 170, 3) ** 1.5 + 45 * smooth(60, 260, s) * Math.exp(-((x - 380) ** 2 + (z + 240) ** 2) / 60000) * fbm(x / 120 + 3, z / 120, 2)) * (1 - 0.9 * Math.exp(-((x - TOWN[0]) ** 2 + (z - TOWN[1]) ** 2) / 22000));
        m = smin(m, s < 0 ? -Math.min(40, -s * 0.6) : 0.09 * s + hills * smooth(15, 150, s) + 0.0035 * Math.max(0, s - 210) ** 2, 50);
      }
      if (dv < 700) m = smin(m, (vt < 0.675 ? 3 + 202 * smooth(0.08, 0.675, vt) : 205 - 150 * smooth(0.675, 1, vt)) + 6 * fbm(x / 60, z / 60, 2) + 1.25 * Math.max(0, dv - 90) ** 1.08, 40);
      if (dg < 800) m = smin(m, 3 + 330 * smooth(0.05, 1, glacier.t) ** 1.3 + 16 * fbm(x / 45, z / 45, 2) * smooth(0.3, 0.5, glacier.t) + 0.9 * Math.max(0, dg - 110) ** 1.1, 40);
      if (fs < 450) m = smin(m, fs < 0 ? -Math.min(60, -fs * 0.8) : 2.7 * fs ** 0.97 * (0.6 + 0.45 * fbm(x / 210, z / 210, 3) + 0.5 * ridge(x / 300, z / 300)), 30);
      const mitre = fs > 0 ? horn(wx, wz, -3150, -1330, 820, 600, 4, 0.3, 1.25) : 0;
      return mitre > 0 ? m + smooth(0, 70, fs) * mitre * (0.85 + 0.3 * ridge(x / 200, z / 200)) : m;
    };
    // the same with a clear corridor carved along the flight, worked out once on the terrain's own grid and looked up from there
    const inner = [-1100, -400], size = [5000, 3800], NX = 300, NZ = Math.round(NX * size[1] / size[0]), X0 = inner[0] - size[0] / 2, Z0 = inner[1] - size[1] / 2, grid = new Float32Array((NX + 1) * (NZ + 1));
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = X0 + i * size[0] / NX, z = Z0 + j * size[1] / NZ; let cap = Infinity;
      for (const p of flight) { const dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz; if (d2 < 40000) { const c = p.y - 15 + 2 * Math.max(0, Math.sqrt(d2) - 22); if (c < cap) cap = c; } }
      grid[j * (NX + 1) + i] = Math.min(raw(x, z), cap);
    }
    const land = (x, z) => {
      const fx = (x - X0) / size[0] * NX, fz = (z - Z0) / size[1] * NZ; if (fx < 0 || fz < 0 || fx >= NX || fz >= NZ) return raw(x, z);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * (NX + 1) + i;
      return lerp(lerp(grid[k], grid[k + 1], u), lerp(grid[k + NX + 1], grid[k + NX + 2], u), v);
    };
    const C = (h) => new THREE.Color(h), tmp = new THREE.Color();
    const cGrass = C(0x6f9a3c), cPasture = C(0x8db548), cGold = C(0xcaa84f), cOlive = C(0x8f8a4a), cBush = C(0x2c5a33), cFern = C(0x4f7d3c), cRock = C(0x8a837b), cDark = C(0x5a5552), cScree = C(0xa39c92), cSnow = C(0xf6f9ff), cIce = C(0xdcedf5), cBlue = C(0x86bcd6), cMoraine = C(0x8f8d88), cSilt = C(0xb9b5aa), cLupinA = C(0xc94fa6), cLupinB = C(0x7a55c4);
    const lupinZone = (x, z, s) => smooth(8, 22, s) * smooth(190, 120, s) * (z > 380 ? 1 : 0) * smooth(0.42, 0.56, fbm(x / 55, z / 55, 2));
    const tint = (x, y, z, slope) => {
      const n = fbm(x / 45, z / 45, 3), n2 = fbm(x / 330 + 5, z / 330, 2), n3 = noise2(x / 19, z / 19), s = shore(x, z), wet = x < -560 ? 1 : 0, dg = glacier.near(x, z), gt = glacier.t;
      tmp.copy(cPasture).lerp(cGrass, smooth(0.3, 0.7, n)).lerp(cGold, smooth(30, 150, y + 90 * (n2 - 0.5) - 60 * smooth(100, 300, s) * Math.exp(-((x - 380) ** 2 + (z + 240) ** 2) / 90000)) * (1 - wet * 0.6)).lerp(cOlive, smooth(0.45, 0.8, n3) * smooth(40, 120, y) * 0.6);
      tmp.lerp(n3 > 0.5 ? cBush : cFern, smooth(0.07, 0.2, slope + (n - 0.5) * 0.12) * smooth(wet ? 380 : 250, wet ? 250 : 120, y + 80 * (n - 0.5)) * (wet ? 1 : 0.8));
      if (s > 0 && s < 200 && z > 380) { const lz = lupinZone(x, z, s); tmp.lerp(cLupinA, lz * 0.75).lerp(cLupinB, lz * smooth(0.45, 0.6, n) * 0.6); }
      tmp.lerp(cScree, smooth(260, 420, y + 120 * (n2 - 0.5)) * 0.8).lerp(cRock, smooth(0.3, 0.52, slope + (n - 0.5) * 0.2) * (wet ? smooth(120, 400, y + 150 * (n - 0.5)) : 1)).lerp(cDark, smooth(0.5, 0.75, n3) * smooth(0.36, 0.6, slope) * 0.7);
      if (y < 2.4) tmp.lerp(cSilt, smooth(2.4, 0.8, y));
      tmp.lerp(cMoraine, smooth(170, 90, dg) * smooth(0.04, 0.15, gt) * 0.85).lerp(cIce, smooth(120, 70, dg) * smooth(0.36, 0.46, gt)).lerp(cBlue, smooth(120, 70, dg) * smooth(0.4, 0.5, gt) * Math.pow(Math.abs(Math.sin(gt * 95 + n * 5)), 6) * 0.8);
      return tmp.lerp(cSnow, smooth(-50, 50, y - (wet ? 520 : 430) - 130 * (n2 - 0.5) - 60 * (n - 0.5)) * (1 - 0.8 * smooth(0.36, 0.62, slope + (n3 - 0.5) * 0.15)));
    };
    const ground = terrain({ size, center: inner, seg: NX, height: land, color: tint, rough: 0.95 }); keepSide(ground.material, 1);
    const tex = grain(5); tex.repeat.set(size[0] / 64, size[1] / 64); ground.material.map = tex; ground.material.color.setScalar(1.4);
    const inside = (x, z) => Math.min(size[0] / 2 - Math.abs(x - inner[0]), size[1] / 2 - Math.abs(z - inner[1]));
    const far = terrain({ size: 17000, center: inner, seg: 136, height: (x, z) => land(x, z) - 2500 * smooth(0, 260, inside(x, z)), color: tint }); keepSide(far.material, 1);
    world.add(ground, far);

    // ---- the lake and the fjord, each with the mountains mirrored in it (a second, coarser copy of the land, lit once and turned upside down under see-through water)
    const refl = terrain({ size, center: inner, seg: 150, height: land, color: tint }), rg = refl.geometry, rc = rg.attributes.color, rn = rg.attributes.normal, sun = new THREE.Vector3(...sunDir).normalize();
    for (let i = 0; i < rc.count; i++) { const l = 0.95 * Math.max(0, rn.getX(i) * sun.x + rn.getY(i) * sun.y + rn.getZ(i) * sun.z); rc.setXYZ(i, rc.getX(i) * (0.42 + l), rc.getY(i) * (0.47 + l), rc.getZ(i) * (0.56 + l * 0.95)); }
    refl.material = keepSide(new THREE.MeshBasicMaterial({ vertexColors: true }), -1); refl.scale.y = -1; refl.receiveShadow = false; world.add(refl);
    const lakeW = water(world, 0, { size: [1500, 2300], x: 40, z: 480, color: 0x1aaad0, rough: 0.07, metal: 0.25, ripple: 70, strength: 0.22, env: 1.1 });
    const fjordW = water(world, 0, { size: [9000, 3400], x: -5150, z: -1300, color: 0x0f4f5c, rough: 0.07, metal: 0.4, ripple: 80, strength: 0.25, env: 1.2 });
    for (const [w, o] of [[lakeW, 0.52], [fjordW, 0.84]]) { w.material.transparent = true; w.material.opacity = o; }

    // ---- the Church of the Good Shepherd on its point: rough stone, steep slate roof, porch, belfry and the big lake window
    const stone = mat(0xc9bda4, { flat: true }), stoneD = mat(0x9d927e, { flat: true }), slate = mat(0x3c4046, { rough: 0.7 }), glassM = mat(0x23333c, { rough: 0.2, metal: 0.5 }), timber = mat(0x4a3423);
    stone.map = stoneD.map = grain(9); stone.map.repeat.set(2, 2);
    const ch = [box(11, 5.4, 18, stone, 0, 0, 0), mesh(gable(11, 6.6, 18), stone, 0, 5.4, 0), box(6, 3.6, 5, stone, 0, 0, 11), mesh(gable(6, 3.4, 5), stone, 0, 3.6, 11), box(5.6, 4, 4.6, stone, -7.6, 0, -4), mesh(gable(4.6, 2.6, 5.6).rotateY(Math.PI / 2), stone, -7.6, 4, -4)];
    for (const s of [-1, 1]) {
      ch.push(mesh(G(8.2, 0.4, 19.4), slate, s * 3.1, 8.9, 0, { rz: -s * 0.876 }), mesh(G(4.6, 0.35, 5.8), slate, s * 1.7, 5.4, 11, { rz: -s * 0.85 }));
      for (let i = 0; i < 4; i++) ch.push(box(1.1, 4.2, 1.4, stoneD, s * 5.9, 0, -6.6 + i * 4.4), box(0.3, 2.4, 1.3, glassM, s * 5.56, 1.8, -4.4 + i * 4.4));
    }
    ch.push(box(5.4, 3.4, 0.4, glassM, 0, 1.6, -9.05), box(6.2, 0.4, 0.6, stoneD, 0, 5, -9.1), box(6.2, 0.4, 0.6, stoneD, 0, 1.2, -9.1), box(0.25, 3.4, 0.5, stoneD, -0.9, 1.6, -9.1), box(0.25, 3.4, 0.5, stoneD, 0.9, 1.6, -9.1), box(1.6, 2.5, 0.3, timber, 0, 0, 13.6), box(1.6, 2.6, 1.6, stone, 0, 11.4, 8.4), mesh(gable(1.9, 1.6, 2), slate, 0, 14, 8.4), box(0.22, 2.4, 0.22, timber, 0, 15.4, 8.4), box(1.3, 0.22, 0.22, timber, 0, 16.9, 8.4));
    for (let i = 0; i < 96; i++) { const a = i / 96 * 6.283, q = 23 + 2 * Math.sin(a * 3); if (Math.abs(a - 1.57) > 0.2) ch.push(box(1.9, r.range(0.9, 1.4), 0.9, stoneD, Math.cos(a) * q, -0.5, Math.sin(a) * q * 1.2, { ry: -a + 1.57 })); }
    world.add(...bake(ch, [CH[0], land(...CH) - 0.3, CH[1]], 1.25));

    // ---- lupins: spikes of pink, purple and blue by the thousand along the shore
    const lup = [], lupTones = [0xe05ab4, 0xb04fd0, 0x7a5fe0, 0xf08ac8, 0xd0409c, 0xf6b8dc, 0x9440c0, 0xe66aa8];
    for (let i = 0; i < 90000 && lup.length < 13000; i++) {
      const x = r.range(60, 420), z = r.range(390, 1080), s = shore(x, z);
      if (s < 6 || s > 200 || Math.hypot(x - CH[0], z - CH[1]) < 13 || r() > lupinZone(x, z, s) + 0.04) continue;
      lup.push({ x, y: land(x, z) - 0.1, z, s: r.range(0.6, 1.25), ry: r() * 6, color: r.pick(lupTones) });
    }
    world.add(instances(new THREE.ConeGeometry(0.2, 1.5, 4, 1, true).translate(0, 0.95, 0), mat(0xffffff, { rough: 0.8 }), lup, { cast: false }));

    // ---- sheep: a few hundred on the green hills east of the lake
    const sheepG = fuse([[new THREE.IcosahedronGeometry(0.62, 0).scale(1.45, 0.95, 0.95).translate(0, 1.05, 0), 0xf3efe2], [G(0.5, 0.45, 0.42, 1.05, 1.25, 0), 0x2c2622], [G(0.16, 0.7, 0.16, 0.5, 0.35, 0.25), 0x2c2622], [G(0.16, 0.7, 0.16, 0.5, 0.35, -0.25), 0x2c2622], [G(0.16, 0.7, 0.16, -0.5, 0.35, 0.25), 0x2c2622], [G(0.16, 0.7, 0.16, -0.5, 0.35, -0.25), 0x2c2622]]);
    const flock = [];
    for (let i = 0; i < 40000 && flock.length < 420; i++) {
      const x = r.range(150, 620), z = r.range(-470, 60), s = shore(x, z);
      if (s < 12 || s > 330 || fbm(x / 60, z / 60, 2) < 0.47) continue;
      flock.push({ x, y: land(x, z) - 0.05, z, ry: r() * 6.28, s: r.range(1.1, 1.5) });
    }
    world.add(instances(sheepG, mat(0xffffff, { vertexColors: true, rough: 0.95 }), flock));

    // ---- the lakeside town: bright roofs, a white church, a jetty, and the steamer under way
    const walls = [], roofs = [], wallTones = [0xf2ede0, 0xe8dcc0, 0xd9e2e4, 0xf4e9d2, 0xc9d6c4, 0xe6c9b0], roofTones = [0xb5402f, 0x3f6a4a, 0x4f5a66, 0x8a3a2c, 0x5f7f9a, 0x9a4a34, 0x6a6f74];
    for (let i = 0; i < 4000 && walls.length < 95; i++) {
      const x = TOWN[0] + r.range(-170, 150), z = TOWN[1] + r.range(-230, 230), s = shore(x, z);
      if (s < 18 || s > 230 || walls.some((w) => Math.hypot(w.x - x, w.z - z) < 17)) continue;
      const w = r.range(8, 13), d = r.range(7, 9.5), h = r.range(3.6, 6), ry = Math.round(r() * 2) * 1.57 + r.range(-0.15, 0.15), y = land(x, z) - 0.6;
      walls.push({ x, y, z, w, d, h: h + 0.6, ry, color: r.pick(wallTones) }); roofs.push({ x, y: y + h + 0.6, z, sx: w * 1.12, sy: r.range(2.4, 3.6), sz: d * 1.12, ry, color: r.pick(roofTones) });
    }
    world.add(instances(G(1, 1, 1, 0, 0.5, 0), mat(0xffffff, { rough: 0.9 }), walls.map((b) => ({ x: b.x, y: b.y, z: b.z, sx: b.w, sy: b.h, sz: b.d, ry: b.ry, color: b.color }))), instances(gable(1, 1, 1), mat(0xffffff, { rough: 0.6, metal: 0.15 }), roofs));
    const white = mat(0xf6f3ea), red = mat(0xb5332a), dark = mat(0x23262a), tc = [-262, 322], ty = land(...tc);
    world.add(...bake([box(8, 6, 14, white, 0, 0, 0), mesh(gable(8, 5, 14), red, 0, 6, 0), box(4, 13, 4, white, 0, 0, 8.6), cyl(0, 3, 8, red, 0, 13, 8.6, 4)], [tc[0], ty - 0.4, tc[1]], 0.5));
    world.add(...bake([box(46, 0.5, 4, timber, 0, 1.4, 0), ...Array.from({ length: 8 }, (_, i) => cyl(0.3, 0.3, 5, timber, -20 + i * 5.8, -3, 1.6, 6)), ...Array.from({ length: 8 }, (_, i) => cyl(0.3, 0.3, 5, timber, -20 + i * 5.8, -3, -1.6, 6))], [-197, 0, 300]));
    const ship = new THREE.Group(), hullG = new THREE.CylinderGeometry(4, 3.4, 4.4, 14, 1).scale(1, 1, 6.2);
    ship.add(...bake([mesh(hullG, dark, 0, 1, 0), mesh(new THREE.CylinderGeometry(4.05, 4.05, 0.5, 14).scale(1, 1, 6.2), red, 0, -0.9, 0), box(6.4, 2.6, 30, white, 0, 3.2, -1), box(7.4, 0.3, 34, white, 0, 5.8, -1), box(4.4, 2.3, 12, white, 0, 6.1, 4), box(5, 0.25, 14, white, 0, 8.4, 4),
      cyl(1.15, 1.25, 6.5, red, 0, 8.4, -1, 14), cyl(1.2, 1.2, 1.4, dark, 0, 14.4, -1, 14), cyl(0.12, 0.18, 13, timber, 0, 5.8, 15, 6), cyl(0.12, 0.18, 11, timber, 0, 5.8, -17, 6)]));
    const puffs = instances(new THREE.IcosahedronGeometry(1, 2), mat(0x8a8a8c, { opacity: 0.4 }), Array.from({ length: 10 }, () => ({})), { cast: false, receive: false }), dummy = new THREE.Object3D();
    world.add(ship, puffs);
    world.onUpdate((t) => {
      const z = 235 + ((t * 3) % 300); ship.position.set(-186, 0.2, z); ship.rotation.z = Math.sin(t * 0.8) * 0.01;
      for (let i = 0; i < 10; i++) { const a = (t * 0.25 + i / 10) % 1; dummy.position.set(-186 + a * 14 + Math.sin(i * 7) * a * 4, 17 + a * 22, z - 1 - a * 36); dummy.scale.setScalar(1.2 + a * 3.2); dummy.updateMatrix(); puffs.setMatrixAt(i, dummy.matrix); }
      puffs.instanceMatrix.needsUpdate = true;
    });

    // ---- trees: pines round the town and the church, beech forest on the lower slopes near the flight
    const pines = [], bush = [];
    for (let i = 0; i < 1500 && pines.length < 150; i++) { const x = r.range(-520, 420), z = r.range(-100, 1050), s = shore(x, z); if (s > 14 && s < 260 && clear(x, z, 34) > 1e9 && Math.hypot(x - CH[0], z - CH[1]) > 34 && !lupinZone(x, z, s) && fbm(x / 90, z / 90, 2) > 0.52 && !walls.some((w) => Math.hypot(w.x - x, w.z - z) < 9)) pines.push([x, land(x, z) - 0.3, z]); }
    for (let i = 0; i < 90000 && bush.length < 2300; i++) {
      const x = r.range(-2300, 700), z = r.range(-1700, 100), y = land(x, z), wet = x < -560;
      if (y < 3 || y > (wet ? 300 : 190) || fbm(x / 80, z / 80, 2) < (wet ? 0.42 : 0.5) || clear(x, z, wet ? 330 : 420) > 1e9 || clear(x, z, 34) < 1e9) continue;
      const slope = Math.abs(land(x + 6, z) - y) + Math.abs(land(x, z + 6) - y); if (slope < 1.5 || slope > 20) continue;
      bush.push([x, y - 0.5, z]);
    }
    trees(world, pines, 'conifer', { size: 15 });
    trees(world, bush, 'conifer', { size: 13, color: [0x244a2e, 0x2f5a34, 0x1f4230, 0x3a6338] }).children.forEach((m) => { m.castShadow = false; });

    const rocks = [];
    for (let i = 0; i < 9000 && rocks.length < 520; i++) { const x = r.range(-1000, 420), z = r.range(-1250, 1050), y = land(x, z); if (y > 1 && (y > 60 || shore(x, z) < 14 || valley.near(x, z) < 110) && clear(x, z, 200) < 1e9 && !lupinZone(x, z, shore(x, z))) rocks.push({ x, y: y - 0.3, z, sx: r.range(0.8, 4.5), sy: r.range(0.6, 2.6), sz: r.range(0.8, 4), ry: r() * 6, rx: r() * 0.6 }); }
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0x8d8983, { flat: true }), rocks));

    // ---- waterfalls down the fjord walls: ribbons that follow the fall line, with streaks sliding down them and spray at the foot
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(255,255,255,0.22)'; cx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 700; i++) { cx.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.7)})`; cx.fillRect(r() * 64, r() * 256, r.range(1, 3), r.range(20, 120)); }
    const fade = cx.createLinearGradient(0, 0, 64, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.35, '#000'); fade.addColorStop(0.65, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)'); cx.globalCompositeOperation = 'destination-in'; cx.fillStyle = fade; cx.fillRect(0, 0, 64, 256);
    const streaks = new THREE.CanvasTexture(cv); streaks.wrapS = streaks.wrapT = THREE.RepeatWrapping;
    const falls = [], spray = [];
    for (const [x0, z0, w] of [[-1215, -930, 9], [-1330, -1520, 8], [-1600, -955, 10], [-1700, -1520, 9], [-1930, -945, 9], [-1000, -1440, 7], [-2000, -1490, 8], [-2300, -960, 9]]) {
      let x = x0, z = z0, v = 0; const pos = [], uv = [], idx = [];
      for (let k = 0; k < 140; k++) {
        const y = land(x, z), wk = w * (0.35 + 0.02 * k + 1.2 * noise2(k / 7, x0)), gx = land(x + 4, z) - land(x - 4, z), gz = land(x, z + 4) - land(x, z - 4), gl = Math.hypot(gx, gz) || 1, dx = -gx / gl, dz = -gz / gl;
        pos.push(x - dz * wk / 2, y + 2.6, z + dx * wk / 2, x + dz * wk / 2, y + 2.6, z - dx * wk / 2); uv.push(0, v, 1, v); if (k) idx.push(k * 2 - 2, k * 2 - 1, k * 2, k * 2 - 1, k * 2 + 1, k * 2);
        if (y < 0.5) { spray.push([x, 3, z], [x + 5, 6, z + 3], [x - 4, 5, z - 3]); break; }
        const step = 6; x += dx * step; z += dz * step; v += Math.hypot(step, land(x, z) - y) / 46;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); falls.push(g);
    }
    world.add(mesh(mergeGeometries(falls), new THREE.MeshBasicMaterial({ map: streaks, color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0, { cast: false, receive: false }));
    world.onUpdate((t) => { streaks.offset.y = t * 0.55; });
    const mist = lights(world, spray, { color: 0xffffff, size: 26, power: 0.5 }); mist.material.blending = THREE.NormalBlending; mist.material.opacity = 0.4; mist.material.toneMapped = true;

    return { world, path, focus, duration: 50 };
  },
};
