// New York at dusk: in past the Statue of Liberty, over the Brooklyn Bridge, up through Midtown past the Empire State Building, out over Central Park.
// This file is also the pattern for every other city: build() makes a world with the kit and returns { world, path, focus, duration }.
import { THREE, createWorld, rng, mat, glowMat, facadeMat, box, cyl, sphere, mesh, buildings, cityGrid, water, trees, lights, traffic, suspensionBridge, clouds, clearance } from '../kit.js';

export default {
  build() {
    const r = rng(2026);
    const world = createWorld({
      sky: { top: 0x1a2c63, horizon: 0xf0a070, bottom: 0x2b2a3a, haze: 0.3 },
      sun: { dir: [-0.86, 0.13, -0.22], color: 0xffb27a, power: 2.6, disc: 0xffc890, size: 0.0016 },
      ambient: { sky: 0x6f86c9, ground: 0x3a2f2c, power: 0.75 },
      fog: { color: 0xc98a72, density: 0.00042 }, stars: 500, exposure: 1.05, env: 0.9,
    });
    // the flight: [x, y, z] points the camera passes through. It enters at the first point and the portal stands at the last.
    const path = [[-240, 34, 1950], [-400, 50, 1540], [-200, 62, 1130], [330, 72, 840], [700, 66, 560], [430, 96, 250], [90, 130, 20], [-150, 215, -230], [-135, 300, -520], [40, 262, -900], [10, 180, -1320], [0, 135, -1740]];
    // what the camera turns to look at, and when: [flight position 0..1, x, y, z]
    const focus = [[0.09, -520, 62, 1360], [0.2, -520, 62, 1360], [0.31, 850, 62, 450], [0.4, 600, 60, 450], [0.5, 0, 230, -350], [0.64, 0, 330, -350]];
    const clear = clearance(path);

    // ---- water and land
    water(world, 0, { color: 0x2a3d52, rough: 0.16 });
    const street = mat(0x2c2e33, { rough: 0.9 });
    world.add(box(900, 4, 3500, street, 0, -1, -850));               // Manhattan
    world.add(box(1600, 4, 4200, mat(0x33352f), 2050, -1, -600));    // Brooklyn and Queens
    world.add(box(1500, 4, 4200, mat(0x33352f), -2000, -1, -900));   // New Jersey
    world.add(cyl(70, 78, 5, mat(0x4a5a44), -520, -1, 1360, 11));    // Liberty Island

    // ---- the street grid: prewar brick and glass towers, lit for the evening
    const downtown = (x, z) => Math.exp(-((z - 650) ** 2) / 160000 - (x * x) / 200000);
    const midtown = (x, z) => Math.exp(-((z + 400) ** 2) / 220000 - (x * x) / 260000);
    const lots = cityGrid({
      rand: r, area: [-420, -1080, 420, 880], block: 58, street: 22, jitter: 0.35, split: 0.35,
      keep: (x, z) => Math.hypot(x, z + 350) > 75 && Math.hypot(x + 150, z - 600) > 80 && Math.hypot(x - 230, z + 420) > 60,
      height: (x, z) => Math.min(30 + 250 * downtown(x, z) * r.range(0.5, 1.1) + 290 * midtown(x, z) * r.range(0.45, 1.1), clear(x, z, 85) - 30),
    });
    const brickTones = [0x8c5a44, 0x9a6b4f, 0x7a4c3c, 0xa48466, 0x6f5548, 0xb19a80], glassTones = [0x7f93a8, 0x93a4b3, 0x6c8196, 0xa9b4bd, 0x58708a];
    const brick = facadeMat({ floor: 3.6, bay: 3.2, frame: [0.3, 0.3], glass: 0x1a1d24, lit: 0.45, litColor: 0xffc27a, night: 1.6, rough: 0.9 });
    const glass = facadeMat({ floor: 4, bay: 2.4, frame: [0.08, 0.14], glass: 0x1c2c40, lit: 0.4, litColor: 0xffe1b0, night: 1.5, rough: 0.5, metal: 0.2 });
    const A = [], B = [];
    for (const b of lots) (b.h > 110 && r.chance(0.6) ? B : A).push(b);
    A.forEach((b) => { b.color = r.pick(brickTones); }); B.forEach((b) => { b.color = r.pick(glassTones); });
    // setback crowns on the taller prewar blocks
    for (const b of [...A]) if (b.h > 90) A.push({ x: b.x, z: b.z, y: b.h, w: b.w * 0.6, d: b.d * 0.6, h: b.h * 0.18, color: b.color });
    world.add(buildings(A, brick), buildings(B, glass));
    // low city on the far shores
    const far = facadeMat({ floor: 3.6, bay: 3.4, frame: [0.3, 0.3], glass: 0x1a1d24, lit: 0.35, litColor: 0xffc27a, night: 1.3 });
    const shore = (x0, x1, seed) => cityGrid({ rand: rng(seed), area: [x0, -2300, x1, 1300], block: 70, street: 26, palette: brickTones, height: (x, z) => Math.min(14 + 60 * r() * r(), clear(x, z, 90) - 30) });
    world.add(buildings([...shore(1290, 2600, 3), ...shore(-2600, -1290, 4)], far));

    // ---- One World Trade Center
    const wtc = facadeMat({ color: 0x8fa6bd, floor: 4, bay: 2.2, frame: [0.05, 0.1], glass: 0x20344c, lit: 0.3, night: 1.2, rough: 0.3, metal: 0.4 });
    world.add(box(62, 55, 62, wtc, -150, 0, 600), cyl(32, 44, 362, wtc, -150, 55, 600, 4), cyl(1.2, 3.5, 124, mat(0xc9d2da, { metal: 0.6, rough: 0.4 }), -150, 417, 600, 8));
    world.add(sphere(2.4, glowMat(0xff5040, 3, { toneMapped: false }), -150, 541, 600));

    // ---- the Empire State Building
    const lime = facadeMat({ color: 0xb9ad98, floor: 3.7, bay: 2.6, frame: [0.3, 0.16], glass: 0x1d2026, lit: 0.5, litColor: 0xffcf8a, night: 1.6, rough: 0.85 });
    const E = [0, 0, -350];
    for (const [w, d, y, h] of [[130, 60, 0, 24], [96, 56, 24, 60], [70, 48, 84, 180], [56, 40, 264, 46], [42, 32, 310, 30], [30, 24, 340, 20]]) world.add(box(w, h, d, lime, E[0], y, E[2]));
    world.add(cyl(7, 11, 28, mat(0xd9d2c2, { emissive: 0xffe6b0, glow: 1.4 }), 0, 360, -350, 12), cyl(0.6, 3, 62, mat(0xcfd3d6, { metal: 0.7, rough: 0.35 }), 0, 388, -350, 8));
    for (const s of [-1, 1]) world.add(box(4, 46, 30, mat(0xd9d2c2, { emissive: 0xffd9a0, glow: 0.9 }), s * 16, 310, -350));

    // ---- the Chrysler Building
    const C = [230, 0, -420], steel = mat(0xc4ccd3, { metal: 0.85, rough: 0.28 });
    world.add(box(54, 200, 54, facadeMat({ color: 0xa9a59c, floor: 3.6, bay: 2.6, frame: [0.3, 0.2], glass: 0x1d2026, lit: 0.45, night: 1.5 }), C[0], 0, C[2]), box(40, 46, 40, steel, C[0], 200, C[2]));
    for (let i = 0; i < 6; i++) world.add(cyl(17 - i * 2.6, 20 - i * 2.6, 9, steel, C[0], 246 + i * 9, C[2], 16));
    world.add(cyl(0.3, 4, 40, steel, C[0], 300, C[2], 8));
    world.add(lights(world, Array.from({ length: 24 }, (_, i) => [C[0] + Math.cos(i * 1.57) * (16 - (i >> 2) * 2.4), 250 + (i >> 2) * 9, C[2] + Math.sin(i * 1.57) * (16 - (i >> 2) * 2.4)]), { color: 0xfff2c8, size: 7, power: 1.5 }));

    // ---- the Statue of Liberty
    const S = new THREE.Group(), stone = mat(0x9c8f7c), copper = mat(0x69b39a, { rough: 0.7 });
    S.add(box(40, 12, 40, stone, 0, 4, 0, { ry: Math.PI / 4 }), box(40, 12, 40, stone, 0, 4, 0), cyl(9, 13, 34, stone, 0, 16, 0, 4));
    S.add(cyl(3.2, 7.5, 30, copper, 0, 50, 0, 14), cyl(3.4, 3.2, 8, copper, 0, 80, 0, 12), sphere(2.6, copper, 0, 90.5, 0));
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.42; S.add(mesh(new THREE.ConeGeometry(0.35, 4, 5).translate(0, 2, 0), copper, Math.sin(a) * 2.2, 91.5 + Math.cos(a) * 1.6, 0, { rz: -a })); }
    S.add(cyl(0.9, 1.1, 15, copper, 3.4, 84, 0, 8, { rz: -0.22 }), cyl(1.4, 0.7, 2, copper, 6.6, 98.5, 0, 10), sphere(1.5, glowMat(0xffd070, 4, { toneMapped: false }), 6.8, 101.5, 0));
    S.add(box(3.4, 5, 1, copper, -3.4, 76, 1.6, { rz: 0.2 }));
    S.position.set(-520, 0, 1360); S.rotation.y = 2.2; world.add(S);
    lights(world, [[-513.2, 101.5, 1360], [-520, 30, 1380], [-500, 30, 1345], [-540, 30, 1350]], { color: 0xffd9a0, size: 22, power: 1.2 });

    // ---- the Brooklyn Bridge, and a plainer second bridge upriver
    const bb = suspensionBridge({ length: 900, towerH: 86, deckY: 40, width: 26, color: 0x4a4038, towerColor: 0x8d7c68, cableColor: 0x2a2826, towers: [-240, 240], cable: 0.7 });
    bb.position.set(870, 0, 450); world.add(bb);
    const mb = suspensionBridge({ length: 900, towerH: 100, deckY: 42, width: 30, color: 0x49606e, towers: [-230, 230], cable: 0.7 });
    mb.position.set(870, 0, 60); world.add(mb);
    traffic(world, [[420, 41.5, 450], [1320, 41.5, 450]], { count: 50, color: 0xffe8c0, size: 4, speed: 16, spread: 9 });
    traffic(world, [[1320, 41.5, 446], [420, 41.5, 446]], { count: 40, color: 0xff4030, size: 4, speed: 16, spread: 9 });

    // ---- Central Park
    world.add(box(330, 1.2, 1150, mat(0x2f4a2c), 0, 2.6, -1720));
    world.add(box(120, 0.4, 200, mat(0x2a4658, { rough: 0.15, metal: 0.3 }), 20, 3.8, -1650));
    const tp = []; for (let i = 0; i < 520; i++) { const x = r.range(-160, 160), z = r.range(-2280, -1160); if (Math.abs(x - 20) < 66 && Math.abs(z + 1650) < 106) continue; tp.push([x, 3.6, z]); }
    trees(world, tp, 'round', { size: 13, color: [0x3a5f33, 0x4b6d38, 0x6a7a3a, 0x8a6a30] });
    const upper = cityGrid({ rand: r, area: [-420, -2300, 420, -1130], block: 58, street: 22, keep: (x) => Math.abs(x) > 190, height: () => r.range(45, 110) });
    upper.forEach((b) => { b.color = r.pick(brickTones); }); world.add(buildings(upper, brick));

    // ---- avenue traffic, harbour lights, a few clouds catching the last sun
    for (const x of [-281, -121, 39, 199, 359]) {
      traffic(world, [[x, 2.6, 880], [x, 2.6, -1100]], { count: 70, color: 0xfff0d0, size: 3.2, speed: 13, spread: 5 });
      traffic(world, [[x + 6, 2.6, -1100], [x + 6, 2.6, 880]], { count: 60, color: 0xff3a2a, size: 3.2, speed: 13, spread: 5 });
    }
    const lamps = []; for (let x = -441; x <= 440; x += 80) for (let z = -1090; z <= 880; z += 40) lamps.push([x, 8, z]);
    lights(world, lamps, { color: 0xffb060, size: 5, power: 0.9 });
    traffic(world, [[-900, 3, 1700], [-300, 3, 1250], [200, 3, 1400], [900, 3, 1800]], { count: 6, color: 0xfff6e0, size: 9, speed: 7 });
    clouds(world, { count: 22, y: [1100, 1600], size: 170, color: 0xe7a184, self: 0.35, rand: rng(8) });

    return { world, path, focus, duration: 48 };
  },
};
