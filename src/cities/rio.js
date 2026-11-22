// Rio de Janeiro on a bright afternoon: in across Guanabara Bay past Sugarloaf and its cable car, low along the curve of Copacabana,
// then up over the lagoon and the forest to circle Christ the Redeemer on Corcovado, and out north over the city towards the Maracanã.
import { THREE, mergeGeometries, createWorld, rng, fbm, clamp, lerp, smooth, mat, glowMat, facadeMat, box, cyl, mesh, lathe, tube, instances, buildings, cityGrid, terrain, water, trees, lights, traffic, clouds, clearance } from '../kit.js';

const TAU = Math.PI * 2;
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
/** Collects static pieces that share a material and merges them into one mesh. */
function pile(material) {
  const list = [];
  return {
    add(g, x = 0, y = 0, z = 0, ry = 0) { g = g.index ? g.toNonIndexed() : g; if (ry) g.rotateY(ry); list.push(g.translate(x, y, z)); return this; },
    mesh(o) { return mesh(mergeGeometries(list), material, 0, 0, 0, o); },
  };
}
/** A ribbon of n quads; f(i) gives its [left, right] points at step i. */
function strip(n, f) {
  const p = [], uv = [];
  for (let i = 0; i < n; i++) { const a = f(i), b = f(i + 1); p.push(...a[0], ...a[1], ...b[1], ...a[0], ...b[1], ...b[0]); uv.push(0, i / n, 1, i / n, 1, (i + 1) / n, 0, i / n, 1, (i + 1) / n, 0, (i + 1) / n); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}

export default {
  build() {
    const r = rng(1565);
    const world = createWorld({
      sky: { top: 0x1c6fd6, horizon: 0xbfe4f6, bottom: 0x8fc0d8, haze: 0.5 },
      sun: { dir: [0.5, 0.62, -0.42], color: 0xfff1d6, power: 3.2, disc: 0xfff6e2, size: 0.0006 },
      ambient: { sky: 0xa8d0ff, ground: 0x6a8a58, power: 0.95 },
      fog: { color: 0xc9e6f4, density: 0.00019 }, exposure: 1.0, env: 0.9,
    });
    const path = [[1900, 140, -330], [1620, 150, -290], [1380, 165, -230], [1100, 165, -60], [860, 110, 300], [960, 34, 790], [700, 24, 765], [430, 50, 820], [280, 150, 640], [210, 255, 400], [150, 345, 150], [110, 395, -20], [-10, 400, -120], [-200, 380, -260], [-520, 335, -560], [-1000, 270, -1000]];
    const focus = [[0.08, 1350, 220, 150], [0.18, 1200, 180, 140], [0.28, 1000, 20, 700], [0.38, 560, 20, 640], [0.45, 0, 360, 0], [0.56, 0, 372, 0], [0.76, 0, 378, 0]];
    const clear = clearance(path);

    // ---- the land: granite domes and forested ridges wrapped round the flat city, the ocean to the south, the bay to the east
    const dome = (x, z, cx, cz, rx, rz, h, p) => { const d = Math.hypot((x - cx) / rx, (z - cz) / rz); return d < 1 ? h * (1 - d ** p) : 0; };
    const bump = (x, z, cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);
    const beach = (x) => 830 - 90 * Math.sin(Math.PI * clamp((x - 350) / 800)) + 70 * smooth(350, -500, x) * Math.sin((x - 350) / 160);
    const rocks = (x, z) => Math.max(dome(x, z, 1350, 150, 128, 116, 300, 2.8), dome(x, z, 1020, 120, 190, 150, 132, 2.2), dome(x, z, 1255, 610, 120, 150, 120, 2.2), dome(x, z, -420, 930, 120, 120, 215, 2.4), dome(x, z, -610, 900, 130, 120, 170, 2.4));
    const H = (x, z) => {
      const east = 880 + 300 * smooth(420, 560, z) + 180 * smooth(-150, -420, z) - 60 * Math.exp(-(((z - 250) / 140) ** 2)), d = Math.min(beach(x) - z, east - x);
      const needle = 340 * Math.exp(-((Math.hypot(x * (x > 0 ? 1.5 : 0.8), z * (z > 0 ? 1.5 : 0.8)) / 150) ** 1.2)), n = fbm(x / 260, z / 260, 3);
      const hills = needle + bump(x, z, -330, 40, 520, 300, 205) + bump(x, z, -1100, 250, 650, 520, 300) + bump(x, z, 560, 420, 150, 135, 135) + bump(x, z, 330, -560, 190, 150, 85) + bump(x, z, -1500, -300, 500, 500, 240) + bump(x, z, 3900, 400, 700, 900, 180);
      const lagoon = 1 - smooth(150, 200, Math.hypot((x - 60) / 1.25, z - 600));
      const land = (3 + hills * (0.75 + 0.5 * n * smooth(15, 80, hills))) * smooth(-10, 8, x > 3200 ? 3600 - x + 1e3 : d) - 14 * (1 - smooth(-30, 0, x > 3200 ? 1 : d)) - 10 * lagoon * smooth(60, 20, hills);
      const far = x > 3100 ? bump(x, z, 3900, 400, 600, 900, 190) + 17 * smooth(3150, 3250, x) - 14 : -14, h = Math.max(land, rocks(x, z) > 0.5 ? rocks(x, z) : -14, far);
      return h > 8 ? Math.min(h, clear(x, z, 80) - 28) : h;
    };
    const steep = (x, z) => Math.hypot(H(x + 5, z) - H(x - 5, z), H(x, z + 5) - H(x, z - 5)) / 10;
    const fine = (x, z, x0, x1, z0, z1) => smooth(x0, x0 + 40, x) * smooth(x1, x1 - 40, x) * smooth(z0, z0 + 40, z) * smooth(z1, z1 - 40, z);
    const c1 = new THREE.Color(), c2 = new THREE.Color();
    const paint = (x, y, z, slope) => {
      const n = fbm(x / 80, z / 80, 3), streak = fbm(x / 14, y / 60, 2);
      if (y < 2.4) return rocks(x, z) > 1 ? 0x6a655c : 0xeadcb0;
      if (y < 9) return c1.set(0x9a9a8c).lerp(c2.set(0x6f9a52), n * 0.5);
      const bare = Math.max(smooth(0.26, 0.42, slope), smooth(20, 70, rocks(x, z)) * smooth(0.06, 0.2, slope));
      return c1.set(0x2f6f30).lerp(c2.set(0x58983e), smooth(0.3, 0.75, n)).lerp(c2.set(0x9a9080).lerp(c1.clone().set(0x5f5a54), streak), bare);
    };
    world.add(terrain({ size: [7400, 5600], center: [600, -300], seg: 190, color: paint, height: (x, z) => H(x, z) - 7 * Math.max(fine(x, z, 760, 1600, -110, 830), fine(x, z, -330, 370, -330, 370)) }));
    world.add(terrain({ size: [760, 860], center: [1180, 360], seg: 110, color: paint, height: (x, z) => H(x, z) + 0.5 }), terrain({ size: [620, 620], center: [20, 20], seg: 100, color: paint, height: (x, z) => H(x, z) + 0.5 }));
    water(world, 0, { color: 0x1f7a9a, rough: 0.1, strength: 0.3, ripple: 70 });

    // ---- Christ the Redeemer: arms outstretched over the city, on his pedestal on the summit
    const soap = pile(mat(0xe9e5d8, { rough: 0.75 })), plinth = pile(mat(0x8f8a7c, { rough: 0.9 })), christ = new THREE.Group(), CY = H(0, 0);
    soap.add(new THREE.LatheGeometry([[2.7, 0], [2.5, 5], [2.15, 12], [2.0, 16], [2.5, 19.2], [2.1, 20.6], [0.8, 21.4]].map(([a, b]) => new THREE.Vector2(a, b)), 16).scale(0.72, 1, 1), 0, 8, 0);
    soap.add(new THREE.SphereGeometry(1.25, 14, 10).scale(1, 1.3, 1), 0.2, 31, 0).add(new THREE.CylinderGeometry(0.7, 0.9, 1.6, 8), 0, 29.4, 0).add(new THREE.SphereGeometry(1.4, 10, 8).scale(0.9, 1.25, 1), -0.25, 31.1, 0);
    const sleeve = new THREE.Shape([[1.6, 20], [12.6, 20], [12.6, 18.6], [1.6, 13.5]].map(([a, b]) => new THREE.Vector2(a, b)));
    for (const s of [-1, 1]) {
      soap.add(new THREE.ExtrudeGeometry(sleeve, { depth: 1.5, bevelEnabled: false }).translate(0, 0, -0.75).rotateY(-s * Math.PI / 2), 0, 7.6, 0).add(B(1.1, 1.3, 2.4), 0, 26.2, s * 13.6).add(B(0.5, 1.5, 1.6), 0.1, 26.1, s * 15.2);
      for (let k = 0; k < 5; k++) soap.add(B(0.25, 9 + k, 0.25).rotateX(s * (0.06 + k * 0.015)), 1.5 - k * 0.04, 8.5, s * (0.3 + k * 0.42));
    }
    plinth.add(B(5.4, 8, 5.4)).add(B(7.4, 1.2, 7.4)).add(B(4.6, 0.6, 4.6), 0, 8, 0).add(new THREE.CylinderGeometry(15, 17, 5, 20).translate(-4, -2.6, 0)).add(B(26, 4, 9), -22, -4, 0);
    christ.add(soap.mesh(), plinth.mesh()); christ.position.set(0, CY, 0); christ.scale.setScalar(1.8); world.add(christ);
    world.add(instances(B(1, 1, 1), mat(0xffffff, { rough: 0.8 }), Array.from({ length: 70 }, () => { const a = r() * TAU, q = r.range(7, 22); return { x: -6 + Math.cos(a) * q, y: CY - 0.2, z: Math.sin(a) * q, sx: 0.55, sy: 1.7, sz: 0.45, color: r.pick([0xd8402a, 0x2f6fd0, 0xf2d24a, 0xf4f0e6, 0x2a2a30, 0x3aa86a]) }; }), { cast: false }));

    // ---- Sugarloaf and Morro da Urca, with the cable car running between the summits
    const SA = [1020, H(1020, 120) + 4, 120], SB = [1350, H(1350, 150) + 4, 150], SC = [820, 8, 200], white = pile(mat(0xf2efe8, { rough: 0.6 })), dark = pile(mat(0x2a2c30, { rough: 0.5 }));
    for (const [p, w] of [[SA, 26], [SB, 22], [SC, 20]]) { white.add(B(w, 7, 14), p[0], p[1] - 5, p[2]).add(B(w + 3, 0.8, 16), p[0], p[1] + 2, p[2]); dark.add(B(w * 0.8, 3, 14.4), p[0], p[1] - 2.4, p[2]); }
    const sag = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - 26 * Math.sin(Math.PI * u) * (a === SA ? 1 : 0.5), lerp(a[2], b[2], u)];
    for (const [a, b] of [[SA, SB], [SC, SA]]) for (const o of [-2.5, 2.5]) world.add(tube(Array.from({ length: 13 }, (_, i) => { const q = sag(a, b, i / 12); return [q[0], q[1] + 3, q[2] + o]; }), 0.22, mat(0x2a2a2e), { seg: 24, radial: 4 }));
    const carG = mergeGeometries([new THREE.SphereGeometry(1, 12, 8).scale(4.2, 2.6, 2.6).translate(0, -3, 0), new THREE.BoxGeometry(0.3, 3.4, 0.3).translate(0, 0.6, 0), new THREE.BoxGeometry(3, 0.5, 0.6).translate(0, 2.6, 0)]);
    const carM = mat(0xdfe6ea, { rough: 0.2, metal: 0.6 }), gondolas = [0, 1, 2, 3].map(() => world.add(mesh(carG, carM)));
    world.onUpdate((t) => gondolas.forEach((m, i) => { const u = (Math.sin(t * 0.14 + (i % 2) * Math.PI) + 1) / 2, q = i < 2 ? sag(SA, SB, u) : sag(SC, SA, u); m.position.set(q[0], q[1] + 0.4, q[2] + (i % 2 ? 2.5 : -2.5)); m.rotation.y = i < 2 ? -0.09 : 0.38; }));

    // ---- Copacabana: surf, sand, the black-and-white wave promenade, the avenue, a wall of white hotels and flats
    const wc = document.createElement('canvas'), wx = wc.getContext('2d'); wc.width = wc.height = 64; const wd = wx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = Math.floor((x + 7 * Math.sin(y * TAU / 64) + 64) / 10.67) % 2 ? 235 : 28, i = (y * 64 + x) * 4; wd.data[i] = wd.data[i + 1] = wd.data[i + 2] = v; wd.data[i + 3] = 255; }
    wx.putImageData(wd, 0, 0); const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(1, 130); wt.anisotropy = 8; wt.colorSpace = THREE.SRGBColorSpace;
    const N = 130, bx = (i) => -200 + i * 10.4, band = (z0, z1, y, m) => world.add(mesh(strip(N, (i) => [[bx(i), y, beach(bx(i)) - z0], [bx(i), y, beach(bx(i)) - z1]]), m, 0, 0, 0, { cast: false }));
    band(-4, 52, 2.5, mat(0xf0e2b8, { rough: 0.95, side: THREE.DoubleSide })); band(52, 62, 2.9, new THREE.MeshStandardMaterial({ map: wt, roughness: 0.8, side: THREE.DoubleSide })); band(62, 84, 2.8, mat(0x4a4c52, { rough: 0.9, side: THREE.DoubleSide }));
    const foam = [0, 1, 2].map(() => world.add(mesh(strip(N, (i) => { const w = 2 + 5 * fbm(bx(i) / 40, 3, 2); return [[bx(i), 0.3, beach(bx(i)) + w], [bx(i), 0.3, beach(bx(i)) - w * 0.4]]; }), glowMat(0xffffff, 1, { opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0, { cast: false, receive: false })));
    world.onUpdate((t) => foam.forEach((m, k) => { const p = (k / 3 + t / 14) % 1; m.position.z = lerp(70, -2, p); m.material.opacity = 0.9 * smooth(0, 0.15, p) * (1 - smooth(0.85, 1, p)); }));
    const flatLand = (x, z) => { const y = H(x, z); return y > 2.6 && y < 9; };
    const front = []; for (let x = -180; x < 1140; x += r.range(24, 34)) { const z = beach(x) - 100, h = Math.min(r.range(34, 52), clear(x, z, 90) - 30); if (flatLand(x, z)) front.push({ x, z, w: r.range(20, 28), d: 28, h, color: r.pick([0xf6f2ea, 0xeee6d6, 0xf2e8dc, 0xe4ecec, 0xf0dcc8]) }); }
    const hotelM = facadeMat({ floor: 3.2, bay: 3.6, frame: [0.1, 0.3], glass: 0x3a6078, lit: 0.1, night: 0.5, rough: 0.7, ground: 4 });
    const shades = [], folk = [], palms = [];
    for (let i = 0; i < 520; i++) { const x = r.range(-190, 1140), q = r.range(6, 46); (i % 3 ? shades : folk).push(i % 3 ? { x, y: 2.6, z: beach(x) - q, s: r.range(0.8, 1.2), color: r.pick([0xf04a3a, 0xf2c230, 0x2f8ad0, 0xf4f0e6, 0x2fae8a, 0xf07a2a]) } : { x, y: 2.6, z: beach(x) - q, sx: 0.5, sy: 1.7, sz: 0.4, color: r.pick([0x8a5a3c, 0xc98a5a, 0x6a4028, 0xd8a070]) }); }
    world.add(instances(new THREE.ConeGeometry(1.7, 0.9, 8).translate(0, 1.9, 0), mat(0xffffff, { rough: 0.8 }), shades, { cast: false }), instances(B(1, 1, 1), mat(0xffffff, { rough: 0.8 }), folk, { cast: false }));
    for (let x = -190; x < 1140; x += 9) palms.push([x, 2.8, beach(x) - 50 - (Math.round(x / 9) % 2) * 13]);
    traffic(world, Array.from({ length: 14 }, (_, i) => [-190 + i * 100, 3.8, beach(-190 + i * 100) - 73]), { count: 60, color: [0xffffff, 0xf2c230, 0xd8402a, 0x9aa0a8], size: 2.2, speed: 11, spread: 6 });

    // ---- the city on the flats: white flats in the south zone, the towers of Centro, low red roofs round the Maracanã
    const centro = (x, z) => Math.exp(-(((x - 560) / 330) ** 2) - ((z + 1150) / 330) ** 2);
    const lots = cityGrid({ rand: rng(3), area: [-2600, -2900, 1300, 780], block: 44, street: 16, jitter: 0.35, split: 0.3, palette: [0xf2eee6, 0xe6ddcc, 0xd8d2c6, 0xeadfce, 0xcfd8da, 0xe2c8b0, 0xd9b99a],
      keep: (x, z) => flatLand(x, z) && beach(x) - z > 130 && Math.hypot(x + 1600, z + 1500) > 230, height: (x, z) => Math.min((z > 150 ? r.range(22, 46) : r.range(8, 24)) + 150 * centro(x, z) * r() + (r.chance(0.05) ? 30 : 0), clear(x, z, 90) - 30) });
    const cityM = facadeMat({ floor: 3.3, bay: 3.4, frame: [0.2, 0.28], glass: 0x3a5a70, lit: 0.1, night: 0.5, rough: 0.8 });
    const all = [...lots, ...front]; all.forEach((b) => { b.y = 0; });
    world.add(buildings(all, cityM), buildings(front, hotelM), buildings(all.map((b) => ({ x: b.x, z: b.z, y: b.h, w: b.w, d: b.d, h: 0.8, color: b.h < 20 && r.chance(0.6) ? 0xb5553a : 0xc9c4ba })), mat(0xffffff, { rough: 0.9 }), { cast: false }));
    // the Maracanã: an oval bowl of seats under a white ring of roof
    const MX = -1600, MZ = -1500, oval = (m) => { m.scale.set(1.18, 1, 1); m.castShadow = false; return m; };
    world.add(oval(lathe([[146, 0], [152, 30], [150, 33]], mat(0xe9e6de, { rough: 0.8 }), MX, 2, MZ, 48)), oval(lathe([[152, 33], [96, 39]], mat(0xfaf8f2, { rough: 0.6, side: THREE.DoubleSide }), MX, 2, MZ, 48)), oval(lathe([[66, 1], [100, 14], [104, 16], [146, 30]], mat(0x2f6fc0, { rough: 0.8, side: THREE.DoubleSide }), MX, 2, MZ, 48)), oval(cyl(66, 66, 1, mat(0x3f9a3c, { rough: 0.9 }), MX, 2, MZ, 40)));
    for (let i = 0; i < 48; i++) white.add(B(1.4, 30, 5), MX + Math.cos(i / 48 * TAU) * 152 * 1.18, 2, MZ + Math.sin(i / 48 * TAU) * 152, -i / 48 * TAU);

    // ---- a favela climbing the hillside: hundreds of small bright houses stacked up the slope
    const shacks = [];
    for (let i = 0; i < 3000 && shacks.length < 1150; i++) {
      const x = r.range(360, 760), z = r.range(260, 600), y = H(x, z); if (y < 12 || y > 118 || steep(x, z) > 0.75) continue;
      const w = r.range(5, 8), h = r.range(4, 9);
      shacks.push({ x, z, y: y - 3, w, d: r.range(5, 8), h: h + 3, ry: r.range(-0.4, 0.4), color: r.pick([0xe2553a, 0xf2c64a, 0x4a9ad8, 0xf2ede2, 0x58b87a, 0xe88a3a, 0xd87aa0, 0xb5553a, 0xc9a078, 0x8fc8d0, 0xf2ede2, 0xc0664a]) });
    }
    world.add(buildings(shacks, facadeMat({ floor: 2.9, bay: 2.6, frame: [0.3, 0.32], glass: 0x2a2a30, lit: 0, rough: 0.9 })));

    // ---- forest canopy over the hills, palms along the beaches and round the lagoon
    const crowns = [];
    for (let i = 0; i < 9000 && crowns.length < 5200; i++) {
      const near = i < 5200, x = near ? r.range(-500, 800) : r.range(-2400, 1500), z = near ? r.range(-500, 760) : r.range(-1500, 1100), y = H(x, z);
      if (y > 10 && rocks(x, z) < 1 && steep(x, z) < 0.8 && !(x > 350 && x < 770 && z > 250 && z < 610 && y < 120) && Math.hypot(x, z) > 30) crowns.push({ x, y: y + 2, z, s: r.range(4, 7.5), sy: r.range(3.5, 6), color: r.pick([0x2f7030, 0x3c8236, 0x26602c, 0x4c9440, 0x357a3a]) });
    }
    world.add(instances(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { rough: 0.95, flat: true }), crowns, { cast: false }));
    for (let i = 0; i < 90; i++) { const a = r() * TAU; palms.push([60 + Math.cos(a) * 262, 3, 600 + Math.sin(a) * 210]); }
    trees(world, palms.filter((p) => H(p[0], p[2]) > 2 && H(p[0], p[2]) < 9), 'palm', { size: 13 });

    // ---- the bay: sailing boats, a cruise ship, the long bridge to Niterói
    const boat = mergeGeometries([new THREE.BoxGeometry(2.6, 1.4, 9).translate(0, 0.5, 0), new THREE.ConeGeometry(3.4, 12, 3).scale(0.06, 1, 1).translate(0, 7.4, 0.6)]);
    world.add(instances(boat, mat(0xf6f3ec, { rough: 0.6 }), Array.from({ length: 70 }, () => ({ x: r.range(900, 3000), y: 0, z: r.range(-1500, 1300), ry: r() * TAU, s: r.range(0.9, 1.6) })).filter((b) => H(b.x, b.z) < -8)));
    const ship = new THREE.Group(); ship.add(box(230, 16, 30, mat(0xf6f3ec, { rough: 0.5 }), 0, -4, 0), box(180, 12, 26, facadeMat({ color: 0xf6f3ec, floor: 3, bay: 3, frame: [0.15, 0.3], glass: 0x2a4a60, lit: 0 }), -6, 12, 0), box(9, 9, 12, mat(0x1f4a8a), -30, 24, 0));
    world.add(ship); world.onUpdate((t) => { ship.position.set(1900 - t * 3, 0, -420); });
    const span = pile(mat(0xb9bcc0, { rough: 0.8 })); span.add(new THREE.BoxGeometry(2400, 5, 26).translate(0, 62, 0)); for (let x = -1150; x <= 1150; x += 115) span.add(B(8, 62, 20), x, 0, 0);
    const bridge = span.mesh({ cast: false }); bridge.position.set(2500, 0, -1750); bridge.rotation.y = 0.25; world.add(bridge);
    world.add(white.mesh(), dark.mesh());
    lights(world, [[1350, H(1350, 150) + 14, 150]], { color: 0xff4030, size: 7, power: 1.2 });
    clouds(world, { count: 16, y: [1100, 1600], size: 180, color: 0xffffff, self: 0.3, rand: rng(9), area: [-3500, -3500, 3500, 3500] });

    return { world, path, focus, duration: 50 };
  },
};
