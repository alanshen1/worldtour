// landmarks.js: Option 2 hero landmark system.
// Places crisp, high-detail PBR landmarks on exact real-world WGS84 coordinates, cleanly excluding overlapping
// OSM vector footprints. Supports drop-in external .glb models via assets/landmarks/manifest.json, with built-in
// high-craft procedural PBR architectural landmarks for flagship cities.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mat, glowMat, box, cyl, dome, lathe, prism, tube, instances, suspensionBridge } from './kit.js';

let manifestPromise = null;
function loadManifest() {
  return (manifestPromise ??= fetch(new URL('../assets/landmarks/manifest.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : { models: {} }))
    .catch(() => ({ models: {} })));
}

let gltfLoader = null;
function getGltfLoader() {
  if (gltfLoader) return gltfLoader;
  const draco = new DRACOLoader().setDecoderPath(new URL('../vendor/three/addons/libs/draco/gltf/', import.meta.url).href);
  gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(draco);
  return gltfLoader;
}

function addCastReceive(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return obj;
}

// ============================================================================
// Flagship Procedural PBR Architectural Landmarks (Option 2)
// ============================================================================

function buildStatueOfLiberty(night) {
  const g = new THREE.Group();
  const granite = mat(0x9a9186, { rough: 0.85, metal: 0.05 });
  const stone = mat(0xb8aea0, { rough: 0.78 });
  const copper = mat(0x63a38c, { rough: 0.42, metal: 0.38 });
  const gold = mat(0xf6c945, { rough: 0.22, metal: 0.85, emissive: 0xffb84d, glow: 0.4 + night * 2.2 });

  // Star-shaped Fort Wood base (11-point star approximation via two overlapping prisms + stepped plinth)
  const starPts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, r = i % 2 === 0 ? 32 : 21;
    starPts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  g.add(prism(starPts, 14, granite, 0, 0, 0));
  g.add(box(24, 6, 24, stone, 0, 14, 0));
  g.add(box(19, 20, 19, stone, 0, 20, 0));
  g.add(box(21, 3, 21, granite, 0, 40, 0));
  g.add(box(15, 4, 15, stone, 0, 43, 0));

  // Statue body (46m from base of feet at y=47 to torch at y=93)
  const body = lathe([
    [5.8, 0], [5.4, 8], [4.6, 17], [4.1, 24], [4.5, 29], [3.6, 33], [1.8, 35], [2.4, 38], [2.2, 41], [0.8, 43],
  ], copper, 0, 47, 0, 18);
  g.add(body);
  // Crown rays
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * 1.8;
    const spike = cyl(0.08, 0.28, 3.2, copper, Math.sin(a) * 2.1, 88, Math.cos(a) * 2.1, 6);
    spike.rotation.z = -a * 0.7; spike.rotation.x = 0.25;
    g.add(spike);
  }
  // Raised right arm & glowing torch
  const arm = cyl(0.95, 1.35, 14, copper, -3.2, 76, 1.0, 10);
  arm.rotation.z = 0.22; arm.rotation.x = 0.1;
  g.add(arm);
  g.add(cyl(1.4, 0.9, 2.2, copper, -6.0, 89, 2.3, 10));
  g.add(cyl(0.2, 1.15, 3.4, gold, -6.0, 91.2, 2.3, 10));
  // Tablet in left arm
  const tab = box(1.2, 6.2, 4.2, copper, 4.2, 71, 2.4);
  tab.rotation.z = -0.25; tab.rotation.y = 0.3;
  g.add(tab);
  return addCastReceive(g);
}

function buildOneWTC(night) {
  const g = new THREE.Group();
  const baseMat = mat(0x283546, { rough: 0.32, metal: 0.62 });
  const glass = mat(0x6e9bc2, { rough: 0.08, metal: 0.82, env: 1.4, emissive: 0x2a4564, glow: night * 0.35 });
  const glassAlt = mat(0x88b4d8, { rough: 0.07, metal: 0.85, env: 1.5, emissive: 0x3b5c80, glow: night * 0.42 });
  const steel = mat(0xcfd8e3, { rough: 0.25, metal: 0.9 });
  const beacon = glowMat(0xe8f6ff, 2.5 + night * 3, { toneMapped: false });

  // Podium cube (60m x 60m x 58m) with vertical glass fins
  g.add(box(61, 58, 61, baseMat, 0, 0, 0));
  // Iconic chamfered-triangle shaft (58m -> 417m): 4 upward-pointing & 4 downward-pointing isosceles triangular facets
  // Represented cleanly by an octagonal prism rotated smoothly from square base to 45°-rotated square roof!
  const y0 = 58, y1 = 417, b = 30.5, t = 21.5;
  const pos = [], uvs = [];
  const pushTri = (a, b3, c) => {
    pos.push(a[0], a[1], a[2], b3[0], b3[1], b3[2], c[0], c[1], c[2]);
    uvs.push(0, 0, 1, 0, 0.5, 1);
  };
  const sq = [[b, y0, b], [-b, y0, b], [-b, y0, -b], [b, y0, -b]];
  const rot = [[0, y1, t * 1.414], [-t * 1.414, y1, 0], [0, y1, -t * 1.414], [t * 1.414, y1, 0]];
  for (let i = 0; i < 4; i++) {
    const n = (i + 1) % 4;
    // Upward-pointing triangle on side i
    pushTri(sq[i], sq[n], rot[i]);
    // Downward-pointing triangle between corners
    pushTri(rot[i], sq[n], rot[n]);
  }
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shaftGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shaftGeo.computeVertexNormals();
  g.add(new THREE.Mesh(shaftGeo, glass));

  // Subtle horizontal structural mullions & glowing observation band at 380-405m
  const ringPts = [];
  for (let y = 78; y <= 408; y += 22) {
    const f = (y - y0) / (y1 - y0), r = THREE.MathUtils.lerp(30.6, 21.8, f);
    ringPts.push({ x: 0, y, z: 0, sx: r * 2, sy: 0.7, sz: r * 2, ry: f * Math.PI * 0.25 });
  }
  g.add(instances(new THREE.CylinderGeometry(0.72, 0.72, 1, 8), steel, ringPts, { cast: false }));
  // Parapet crown & communication ring + 124m spire (to 541m)
  g.add(cyl(18, 22, 12, glassAlt, 0, 417, 0, 8));
  g.add(cyl(14, 15, 7, steel, 0, 429, 0, 16));
  g.add(cyl(2.6, 5.2, 42, steel, 0, 436, 0, 12));
  g.add(cyl(0.55, 2.2, 63, steel, 0, 478, 0, 10));
  g.add(cyl(1.4, 1.4, 4.5, beacon, 0, 536, 0, 12, { cast: false }));
  return addCastReceive(g);
}

function buildEmpireState(night) {
  const g = new THREE.Group();
  const limestone = mat(0xc7bfb2, { rough: 0.72, metal: 0.08 });
  const steel = mat(0x7c8692, { rough: 0.35, metal: 0.65 });
  const crownGlow = glowMat(0xffe0a8, 1.4 + night * 2.2);
  g.add(box(120, 26, 60, limestone, 0, 0, 0));
  g.add(box(92, 64, 52, limestone, 0, 26, 0));
  g.add(box(64, 175, 42, limestone, 0, 90, 0));
  g.add(box(48, 65, 34, limestone, 0, 265, 0));
  g.add(box(34, 48, 26, limestone, 0, 330, 0));
  g.add(box(24, 16, 20, steel, 0, 378, 0));
  g.add(cyl(5.5, 8.5, 34, steel, 0, 394, 0, 16));
  g.add(cyl(5.8, 5.8, 5, crownGlow, 0, 423, 0, 16, { cast: false }));
  g.add(cyl(0.4, 2.2, 58, steel, 0, 428, 0, 10));
  return addCastReceive(g);
}

function buildBrooklynBridge() {
  const g = new THREE.Group();
  const stone = mat(0xb5a998, { rough: 0.82 });
  const steel = mat(0x5d6872, { rough: 0.5, metal: 0.55 });
  const deck = mat(0x454a50, { rough: 0.85 });
  const L = 980, Y = 41, W = 26, H = 84;
  g.add(box(L, 3.8, W, deck, 0, Y - 3.8, 0));
  // Iconic twin limestone Gothic-arch towers at ±243m
  for (const tx of [-243, 243]) {
    for (const tz of [-13, 0, 13]) g.add(box(14, H, 5.5, stone, tx, 0, tz));
    g.add(box(14.5, 14, 33, stone, tx, 0, 0));
    g.add(box(15, 12, 33, stone, tx, H - 14, 0));
    g.add(box(16, 3.5, 34.5, stone, tx, H - 2, 0));
  }
  // 4 suspension cables + hangers
  const hangers = [];
  for (const cz of [-12.5, -4, 4, 12.5]) {
    const pts = [], stops = [-L / 2, -243, 243, L / 2];
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1], mid = k === 1;
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, x = THREE.MathUtils.lerp(a, b, u);
        const y = mid ? Y + 5 + (H - Y - 5) * Math.pow(2 * u - 1, 2)
          : (k === 0 ? THREE.MathUtils.lerp(Y + 4, H - 2, u * u) : THREE.MathUtils.lerp(H - 2, Y + 4, 1 - (1 - u) * (1 - u)));
        if (i > 0 || k === 0) pts.push([x, y, cz]);
        if (i > 0 && i < 14 && y - Y > 2 && Math.abs(cz) > 8) hangers.push({ x, y: Y, z: cz, sx: 0.25, sy: y - Y, sz: 0.25 });
      }
    }
    g.add(tube(pts, 0.55, steel, { seg: 90, tension: 0.1 }));
  }
  g.add(instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), steel, hangers, { cast: false }));
  return addCastReceive(g);
}

function buildTaipei101(night) {
  const g = new THREE.Group();
  const jadeGlass = mat(0x4b8786, { rough: 0.1, metal: 0.78, env: 1.4, emissive: 0x1a4245, glow: night * 0.45 });
  const jadeDark = mat(0x2d585a, { rough: 0.18, metal: 0.72, env: 1.2 });
  const trim = mat(0xc2d5d1, { rough: 0.3, metal: 0.8 });
  const accent = glowMat(0x9ff2e0, 1.2 + night * 2.2);

  // Sloped base plinth (0 -> 110m)
  g.add(cyl(27, 36, 110, jadeDark, 0, 0, 0, 4));
  // 8 iconic stacked outward-flaring bamboo pagoda modules (110m -> 398m, 36m each)
  for (let i = 0; i < 8; i++) {
    const y = 110 + i * 36;
    g.add(cyl(31.5, 25.5, 33.5, jadeGlass, 0, y, 0, 4));
    // Flared cornice lip & corner ruyi accent
    g.add(cyl(32.5, 31.5, 2.5, trim, 0, y + 33.5, 0, 4));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(4.2, 4.2, 4.2, trim, sx * 21.5, y + 32, sz * 21.5));
    }
    if (night > 0.15) g.add(cyl(31.8, 31.6, 0.8, accent, 0, y + 35.6, 0, 4, { cast: false }));
  }
  // Upper observation tiers & stepped spire (398m -> 508m)
  g.add(cyl(20, 23, 24, jadeGlass, 0, 398, 0, 4));
  g.add(cyl(13, 16, 22, jadeDark, 0, 422, 0, 4));
  g.add(cyl(7, 9, 16, trim, 0, 444, 0, 4));
  g.add(cyl(0.8, 3.8, 48, trim, 0, 460, 0, 8));
  return addCastReceive(g);
}

function buildCKSMemorial() {
  const g = new THREE.Group();
  const marble = mat(0xedeae2, { rough: 0.45, metal: 0.05 });
  const plaza = mat(0xd8d3c8, { rough: 0.8 });
  const blueTile = mat(0x1b3a73, { rough: 0.25, metal: 0.28, env: 1.1 });
  const gold = mat(0xd8a838, { rough: 0.25, metal: 0.85 });

  // Stepped white marble plinth & front stairs
  g.add(box(104, 5, 104, plaza, 0, 0, 0));
  g.add(box(86, 7, 86, marble, 0, 5, 0));
  g.add(box(68, 8, 68, marble, 0, 12, 0));
  // Grand staircase extending west (+X in ENU)
  for (let i = 0; i < 6; i++) g.add(box(30 - i * 3.5, 3, 30, marble, 42 - i * 2, i * 3, 0));
  // Iconic white main hall body
  g.add(box(52, 24, 52, marble, 0, 20, 0));
  // Corner monumental piers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(12, 26, 12, marble, sx * 24, 20, sz * 24));
  }
  // Iconic double-eaved cobalt-blue glazed octagonal hip roof (44m -> 70m)
  g.add(cyl(24, 41, 11, blueTile, 0, 43, 0, 8));
  g.add(cyl(18, 25, 4, marble, 0, 53, 0, 8));
  g.add(cyl(1.5, 29, 14, blueTile, 0, 56, 0, 8));
  g.add(cyl(0.4, 1.8, 4.5, gold, 0, 70, 0, 10));
  return addCastReceive(g);
}

function buildTokyoTower(night) {
  const g = new THREE.Group();
  const orange = mat(0xe64522, { rough: 0.38, metal: 0.55 });
  const white = mat(0xf4f4f2, { rough: 0.35, metal: 0.45 });
  const deckGlass = mat(0x2d435a, { rough: 0.12, metal: 0.8, emissive: 0xffd08a, glow: 0.25 + night * 1.4 });
  const lightDot = glowMat(0xffd288, 1.8 + night * 2.5);

  // Base FootTown building
  g.add(box(52, 18, 52, white, 0, 0, 0));
  // 4 sweeping tapered steel legs in alternating international-orange & white bands (0 -> 250m)
  const bands = [
    [0, 50, orange], [50, 95, white], [95, 145, orange], [145, 170, white],
    [170, 205, orange], [205, 238, white], [238, 262, orange], [262, 298, white], [298, 333, orange],
  ];
  const radiusAt = (y) => y < 150 ? 34 * Math.pow(1 - y / 215, 1.55) : Math.max(1.2, 8.8 * Math.pow(1 - (y - 150) / 195, 1.25));
  for (const [y0, y1, m] of bands) {
    const r0 = radiusAt(y0), r1 = radiusAt(y1);
    if (y0 < 250) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const A = new THREE.Vector3(sx * r0, y0, sz * r0), B = new THREE.Vector3(sx * r1, y1, sz * r1);
        const len = A.distanceTo(B), thick = y0 < 150 ? 2.8 : 1.5;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), m);
        leg.position.copy(A).lerp(B, 0.5); leg.lookAt(B);
        g.add(leg);
      }
      // Cross-bracing rings
      const ym = (y0 + y1) * 0.5, rm = radiusAt(ym);
      g.add(box(rm * 2, 1.4, 1.4, m, 0, ym, rm));
      g.add(box(rm * 2, 1.4, 1.4, m, 0, ym, -rm));
      g.add(box(1.4, 1.4, rm * 2, m, rm, ym, 0));
      g.add(box(1.4, 1.4, rm * 2, m, -rm, ym, 0));
    } else {
      g.add(cyl(Math.max(0.35, r1 * 0.55), Math.max(0.6, r0 * 0.55), y1 - y0, m, 0, y0, 0, 8));
    }
  }
  // Main Deck (150m) & Top Deck (250m)
  g.add(box(27, 13, 27, white, 0, 144, 0));
  g.add(box(27.8, 6, 27.8, deckGlass, 0, 147.5, 0));
  g.add(box(14, 9, 14, white, 0, 246, 0));
  g.add(box(14.6, 4.5, 14.6, deckGlass, 0, 248.5, 0));
  if (night > 0.1) g.add(box(28.4, 1.2, 28.4, lightDot, 0, 144.2, 0, { cast: false }));
  return addCastReceive(g);
}

function buildRainbowBridge() {
  const g = suspensionBridge({
    length: 800, towerH: 126, deckY: 52, width: 28,
    color: 0xe6e9ee, towerColor: 0xf0f2f5, cableColor: 0xd0d6de,
    towers: [-285, 285], cable: 0.75, deckThick: 4.5,
  });
  return addCastReceive(g);
}

function buildEiffelTower(night) {
  const g = new THREE.Group();
  const iron = mat(0x6d5849, { rough: 0.45, metal: 0.72, env: 1.0 });
  const warmLight = glowMat(0xffd796, 1.6 + night * 2.5);
  const beacon = glowMat(0xfff6dc, 2.5 + night * 3.5, { toneMapped: false });

  // Curved iron legs sweeping up from 62m square footprint to 276m summit
  const radiusAt = (y) => {
    if (y <= 57) return THREE.MathUtils.lerp(56, 32, y / 57);
    if (y <= 115) return THREE.MathUtils.lerp(32, 17, (y - 57) / 58);
    return Math.max(4.5, 17 * Math.pow(1 - (y - 115) / 180, 1.45));
  };
  const steps = [0, 22, 42, 57, 86, 115, 155, 200, 245, 276];
  for (let i = 0; i < steps.length - 1; i++) {
    const y0 = steps[i], y1 = steps[i + 1], r0 = radiusAt(y0), r1 = radiusAt(y1);
    const thick = y0 < 57 ? 5.2 : y0 < 115 ? 3.6 : 2.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const A = new THREE.Vector3(sx * r0, y0, sz * r0), B = new THREE.Vector3(sx * r1, y1, sz * r1);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, A.distanceTo(B)), iron);
      leg.position.copy(A).lerp(B, 0.5); leg.lookAt(B);
      g.add(leg);
    }
    if (y0 >= 57) {
      const ym = (y0 + y1) * 0.5, rm = radiusAt(ym);
      g.add(box(rm * 2, 1.6, 1.6, iron, 0, ym, rm));
      g.add(box(rm * 2, 1.6, 1.6, iron, 0, ym, -rm));
      g.add(box(1.6, 1.6, rm * 2, iron, rm, ym, 0));
      g.add(box(1.6, 1.6, rm * 2, iron, -rm, ym, 0));
    }
  }
  // Decorative 4 ground arches
  for (let side = 0; side < 4; side++) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12, t = (u - 0.5) * 76, y = 14 + Math.sin(u * Math.PI) * 32;
      pts.push([t, y, 42]);
    }
    const arch = tube(pts, 1.6, iron, { seg: 20 });
    arch.rotation.y = side * Math.PI / 2;
    g.add(arch);
  }
  // 1st deck (57m), 2nd deck (115m), Summit (276m) & spire (330m)
  g.add(box(68, 7.5, 68, iron, 0, 54, 0));
  g.add(box(38, 6.5, 38, iron, 0, 112, 0));
  g.add(box(16, 12, 16, iron, 0, 272, 0));
  g.add(cyl(5.5, 7.5, 16, iron, 0, 284, 0, 12));
  g.add(cyl(0.4, 2.2, 30, iron, 0, 300, 0, 8));
  if (night > 0.1) {
    g.add(box(69, 1.2, 69, warmLight, 0, 56, 0, { cast: false }));
    g.add(box(39, 1.1, 39, warmLight, 0, 114, 0, { cast: false }));
    g.add(cyl(2.2, 2.2, 3.2, beacon, 0, 297, 0, 12, { cast: false }));
  }
  return addCastReceive(g);
}

function buildLouvrePyramid(night) {
  const g = new THREE.Group();
  const glass = mat(0x9fc4dc, { rough: 0.06, metal: 0.85, env: 1.6, opacity: 0.78 });
  const frame = mat(0x46525e, { rough: 0.3, metal: 0.85 });
  const glow = glowMat(0xffe1a6, 0.9 + night * 2.0, { opacity: 0.45 });
  const pool = mat(0x285068, { rough: 0.06, metal: 0.55, env: 1.5 });
  // Reflecting basins around the pyramid
  g.add(box(62, 0.6, 62, pool, 0, 0, 0, { cast: false }));
  // Iconic 21.6m tall, 35.4m wide glass pyramid
  const pyr = cyl(0.01, 25, 21.6, glass, 0, 0.5, 0, 4);
  g.add(pyr);
  // Subtle interior warm museum core
  g.add(cyl(0.01, 14, 12, glow, 0, 0.6, 0, 4, { cast: false }));
  // 4 corner steel ribs
  const c = 17.7;
  for (const [x, z] of [[c, c], [-c, c], [-c, -c], [c, -c]]) {
    const A = new THREE.Vector3(x, 0.5, z), B = new THREE.Vector3(0, 22.1, 0);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, A.distanceTo(B)), frame);
    rib.position.copy(A).lerp(B, 0.5); rib.lookAt(B);
    g.add(rib);
  }
  return addCastReceive(g);
}

function buildSydneyOperaHouse(night) {
  const g = new THREE.Group();
  const podium = mat(0xc7b9a6, { rough: 0.78 });
  const tile = mat(0xf6f3ec, { rough: 0.22, metal: 0.12, env: 1.1 });
  const bronzeGlass = mat(0x523f2c, { rough: 0.1, metal: 0.82, env: 1.3, emissive: 0xffc670, glow: 0.15 + night * 1.1 });

  // Stepped granite podium jutting onto Bennelong Point
  g.add(box(122, 10, 170, podium, 0, 0, 0));
  g.add(box(108, 4, 152, podium, 0, 10, 0));

  // Sculpted spherical-segment sail vault helper
  function sailCluster(cx, cz, scale, ry, count = 4) {
    const cg = new THREE.Group();
    cg.position.set(cx, 13, cz); cg.rotation.y = ry;
    const specs = [
      { z: -26, sx: 1.0, sy: 1.25, sz: 1.3, rx: 0.18 },
      { z: -6,  sx: 1.15, sy: 1.55, sz: 1.45, rx: 0.15 },
      { z: 16,  sx: 0.95, sy: 1.2, sz: 1.2, rx: -0.18 },
      { z: 32,  sx: 0.7, sy: 0.85, sz: 0.95, rx: -0.22 },
    ];
    for (let i = 0; i < Math.min(count, specs.length); i++) {
      const sp = specs[i];
      const shellGeo = new THREE.SphereGeometry(18 * scale, 20, 14, 0, Math.PI, 0, Math.PI * 0.56);
      const shell = new THREE.Mesh(shellGeo, tile);
      shell.scale.set(sp.sx * 0.82, sp.sy, sp.sz);
      shell.position.set(0, 0, sp.z * scale);
      shell.rotation.x = sp.rx;
      shell.material.side = THREE.DoubleSide;
      cg.add(shell);
      // Warm bronze glass mouth inside each major shell
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(14 * scale * sp.sx * 0.72, 16, 0, Math.PI), bronzeGlass);
      mouth.position.set(0, 1, (sp.z + (sp.rx > 0 ? 11 : -11)) * scale);
      if (sp.rx < 0) mouth.rotation.y = Math.PI;
      cg.add(mouth);
    }
    return cg;
  }
  // Concert Hall (east), Joan Sutherland Theatre (west), Bennelong Restaurant (south-west)
  g.add(sailCluster(-22, -8, 1.15, 0.08, 4));
  g.add(sailCluster(24, 2, 0.95, -0.06, 4));
  g.add(sailCluster(32, 54, 0.58, 0.25, 2));
  return addCastReceive(g);
}

function buildSydneyHarbourBridge() {
  const g = new THREE.Group();
  const steel = mat(0x6d757c, { rough: 0.45, metal: 0.65 });
  const deck = mat(0x4b5158, { rough: 0.85 });
  const granite = mat(0xb8aea0, { rough: 0.82 });
  const span = 503, deckY = 49, W = 48, archH = 134;

  // Roadway deck + approaches
  g.add(box(760, 4.5, W, deck, 0, deckY - 4.5, 0));
  // 4 monumental granite art-deco approach pylons (89m tall)
  for (const px of [-265, 265]) {
    for (const pz of [-24, 24]) {
      g.add(box(20, 89, 14, granite, px, 0, pz));
      g.add(box(22, 4, 16, granite, px, 86, pz));
    }
  }
  // Lower & upper parabolic steel through-arch chords on both sides of deck
  const hangers = [];
  for (const sz of [-22, 22]) {
    const lowPts = [], hiPts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, x = (u - 0.5) * span, p = 1 - Math.pow(2 * u - 1, 2);
      const yLow = 14 + p * (archH - 32), yHi = 46 + p * (archH - 46);
      lowPts.push([x, yLow, sz]);
      hiPts.push([x, yHi, sz]);
      if (i > 2 && i < 22 && yLow > deckY + 2) {
        hangers.push({ x, y: deckY, z: sz, sx: 0.8, sy: yLow - deckY, sz: 0.8 });
      }
      if (i > 0 && i < 24) {
        hangers.push({ x, y: yLow, z: sz, sx: 1.1, sy: Math.max(2, yHi - yLow), sz: 1.1 });
      }
    }
    g.add(tube(lowPts, 1.8, steel, { seg: 48, tension: 0.1 }));
    g.add(tube(hiPts, 1.8, steel, { seg: 48, tension: 0.1 }));
  }
  // Lateral arch cross-braces
  for (let i = 3; i <= 21; i += 2) {
    const u = i / 24, x = (u - 0.5) * span, p = 1 - Math.pow(2 * u - 1, 2);
    const yHi = 46 + p * (archH - 46);
    g.add(box(1.4, 1.4, 44, steel, x, yHi, 0));
  }
  g.add(instances(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), steel, hangers, { cast: false }));
  return addCastReceive(g);
}

// ============================================================================
// Landmark Registry per City
// ============================================================================
// rotationY: in a real city the axes are +x west, +y up, +z north (see HANDOFF.md), so a model whose local X axis
// should lie along compass bearing B (degrees clockwise from north) needs rotationY = (90 - B) in radians.
// A bridge along X that really runs north-west to south-east (B = 138) therefore gets a NEGATIVE angle.
export const HERO_LANDMARKS = {
  'new-york': [
    { id: 'statue-of-liberty', lat: 40.68925, lon: -74.04450, rotationY: 0.65, excludeRadius: 55, build: buildStatueOfLiberty },
    { id: 'one-wtc',           lat: 40.71274, lon: -74.01338, rotationY: -0.51, excludeRadius: 58, build: buildOneWTC },      // street grid, B = 119
    { id: 'brooklyn-bridge',   lat: 40.70609, lon: -73.99686, rotationY: -0.84, excludeRadius: 45, altOffset: 0, onWater: true, build: buildBrooklynBridge },   // B = 138
    { id: 'empire-state',      lat: 40.74844, lon: -73.98566, rotationY: -0.51, excludeRadius: 72, build: buildEmpireState },   // long side on 34th St, B = 119
  ],
  'taipei': [
    { id: 'taipei-101',   lat: 25.03396, lon: 121.56447, rotationY: 0.02, excludeRadius: 56, build: buildTaipei101 },
    { id: 'cks-memorial', lat: 25.03470, lon: 121.52180, rotationY: 0.0,  excludeRadius: 78, build: buildCKSMemorial },
  ],
  'tokyo': [
    { id: 'tokyo-tower',    lat: 35.65858, lon: 139.74543, rotationY: 0.25, excludeRadius: 55, build: buildTokyoTower },
    { id: 'rainbow-bridge', lat: 35.63655, lon: 139.76340, rotationY: -0.61, excludeRadius: 40, onWater: true, build: buildRainbowBridge },   // B = 125
  ],
  'paris': [
    { id: 'eiffel-tower',   lat: 48.85837, lon: 2.29448, rotationY: 0.78, excludeRadius: 82, build: buildEiffelTower },
    { id: 'louvre-pyramid', lat: 48.86102, lon: 2.33585, rotationY: -0.47, excludeRadius: 38, build: buildLouvrePyramid },   // square to the Louvre's axis, B = 117
  ],
  'sydney': [
    { id: 'sydney-opera-house',    lat: -33.85680, lon: 151.21530, rotationY: -0.18, excludeRadius: 110, onWater: true, build: buildSydneyOperaHouse },
    { id: 'sydney-harbour-bridge', lat: -33.85230, lon: 151.21075, rotationY: 1.32,  excludeRadius: 50,  onWater: true, build: buildSydneyHarbourBridge },
  ],
};

/**
 * Returns local ENU exclusion footprints [{ x, z, r }] for a city's hero landmarks,
 * and asynchronously builds/loads either external .glb overrides or built-in procedural PBR models.
 */
export function getLandmarkExclusions(cityId, toLocal) {
  const specs = HERO_LANDMARKS[cityId] ?? [];
  return specs.map((spec) => {
    const p = toLocal(spec.lat, spec.lon, 0);
    return { x: p.x, z: p.z, r: spec.excludeRadius ?? 50 };
  });
}

export async function placeHeroLandmarks(cityId, world, { toLocal, groundAt, groundM, night = 0.25, signal } = {}) {
  const specs = HERO_LANDMARKS[cityId] ?? [];
  if (!specs.length) return [];
  const manifest = await loadManifest();
  const models = manifest?.models ?? {};
  const placed = [];

  for (const spec of specs) {
    if (signal?.aborted) break;
    const p = toLocal(spec.lat, spec.lon, 0);
    const custom = models[spec.id];
    const hitY = spec.onWater ? groundM : groundAt?.(p.x, p.z);
    const yOffset = (spec.altOffset ?? 0) + (custom?.yOffset ?? 0);
    const y = (hitY ?? groundM) + yOffset;
    let obj = null;

    if (custom?.file) {
      try {
        const url = new URL(`../assets/landmarks/${custom.file}`, import.meta.url).href;
        const gltf = await getGltfLoader().loadAsync(url);
        if (signal?.aborted) {
          gltf.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
          break;
        }
        obj = addCastReceive(gltf.scene);
        if (custom.scale) obj.scale.setScalar(custom.scale);
      } catch (e) {
        console.warn(`Hero GLB "${custom.file}" failed to load, using procedural fallback:`, e);
      }
    }

    if (!obj) {
      obj = spec.build(night);
      if (spec.scale) obj.scale.setScalar(spec.scale);
    }

    obj.position.set(p.x, y, p.z);
    obj.rotation.y = (custom?.rotationY ?? spec.rotationY ?? 0);
    obj.userData.yOffset = yOffset;
    obj.userData.grounded = spec.onWater || hitY !== null;
    world.add(obj);
    placed.push(obj);
  }
  return placed;
}
