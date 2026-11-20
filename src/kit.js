// kit.js: the shared building blocks every city is made from.
// Everything is generated in the browser: no models, no image files.
// Units are metres, +Y is up. A city file imports what it needs from here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries };

let renderer = null, pmrem = null;
export function setRenderer(r) { renderer = r; pmrem = new THREE.PMREMGenerator(r); }

// ---------------------------------------------------------------- numbers
/** Seeded random source. r() in [0,1), r.range(a,b), r.int(a,b) inclusive, r.pick(array), r.chance(p). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
/** Smooth value noise in [0,1]. */
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise in [0,1]. */
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x, y); n += a; x *= 2.03; y *= 2.03; a *= 0.5; } return s / n; }
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const col = (c) => new THREE.Color(c);

// ---------------------------------------------------------------- materials
/** A standard lit material. o: { rough, metal, emissive, glow (emissive intensity), flat, side, opacity, env } */
export function mat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, flatShading: !!o.flat });
  if (o.emissive !== undefined) { m.emissive = col(o.emissive); m.emissiveIntensity = o.glow ?? 1; }
  if (o.side) m.side = o.side;
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.env !== undefined) m.envMapIntensity = o.env;
  if (o.vertexColors) m.vertexColors = true;
  return m;
}
/** An unlit, self-coloured material that ignores fog only if asked. Use for lamps, neon, the sun's disc. `power` above 1 over-brightens. */
export function glowMat(color, power = 1, o = {}) {
  const m = new THREE.MeshBasicMaterial({ color: col(color).multiplyScalar(power), fog: o.fog ?? true, toneMapped: o.toneMapped ?? true });
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  if (o.additive) { m.blending = THREE.AdditiveBlending; m.transparent = true; m.depthWrite = false; }
  if (o.side) m.side = o.side;
  if (o.map) m.map = o.map;
  return m;
}

/**
 * A building-wall material that draws its own windows, so a plain box becomes a tower.
 * Works on single meshes and on instanced boxes of any size (window size stays constant in metres).
 * o: { color, floor (storey height, m), bay (window spacing, m), frame [x,y] (0..0.5, the solid part of each cell),
 *      glass (window colour), lit (0..1 share of lit windows), litColor, night (0..1, how brightly lit windows glow),
 *      rough, metal, round (radius in m for cylinders, else 0), ground (m of windowless base) }
 */
export function facadeMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? 0xffffff, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0 });
  const U = {
    uCell: { value: new THREE.Vector2(o.bay ?? 3, o.floor ?? 3.6) },
    uFrame: { value: new THREE.Vector2(...(o.frame ?? [0.22, 0.28])) },
    uGlass: { value: col(o.glass ?? 0x1b2a3a) },
    uLit: { value: o.lit ?? 0.35 },
    uLitColor: { value: col(o.litColor ?? 0xffd9a0) },
    uNight: { value: o.night ?? 0 },
    uRound: { value: o.round ?? 0 },
    uGround: { value: o.ground ?? 0 },
  };
  m.userData.uniforms = U;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec4 vFac; uniform float uRound;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        mat4 fm = modelMatrix;
        #ifdef USE_INSTANCING
          fm = modelMatrix * instanceMatrix;
        #endif
        vec3 fs = vec3(length(fm[0].xyz), length(fm[1].xyz), length(fm[2].xyz));
        vec3 fp = position * fs;
        float fx = abs(normal.x) > abs(normal.z) ? fp.z : fp.x;
        if (uRound > 0.0) fx = atan(position.z, position.x) * uRound;
        vFac = vec4(fx, fp.y, 1.0 - step(0.6, abs(normal.y)), fract(fm[3].x * 0.137 + fm[3].z * 0.291) * 61.0);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
        varying vec4 vFac; uniform vec2 uCell; uniform vec2 uFrame; uniform vec3 uGlass; uniform float uLit; uniform vec3 uLitColor; uniform float uNight; uniform float uGround;
        float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 fc = vFac.xy / uCell; vec2 fid = floor(fc); vec2 ff = fract(fc);
        float faa = clamp(1.0 - max(fwidth(fc.x), fwidth(fc.y)) * 1.1, 0.0, 1.0);
        float fmask = vFac.z * step(uGround, vFac.y);
        float fraw = step(uFrame.x, ff.x) * step(ff.x, 1.0 - uFrame.x) * step(uFrame.y, ff.y) * step(ff.y, 1.0 - uFrame.y);
        float farea = (1.0 - 2.0 * uFrame.x) * (1.0 - 2.0 * uFrame.y);
        float fwin = mix(farea, fraw, faa) * fmask;
        float fr = fHash(fid + vFac.w); float fr2 = fHash(fid.yx * 1.7 + vFac.w + 3.1);
        float fshare = clamp(uLit * (0.55 + 0.9 * fract(vFac.w * 0.618)), 0.0, 1.0);
        float flit = mix(fshare * farea * 0.85, step(1.0 - fshare, fr) * fraw * (0.45 + 1.1 * fr2), faa) * fmask;
        diffuseColor.rgb = mix(diffuseColor.rgb, uGlass * (0.7 + 0.6 * fr2), fwin);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, fwin);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.55, fwin);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLitColor * flit * uNight;');
  };
  m.customProgramCacheKey = () => 'facade';
  return m;
}

// ---------------------------------------------------------------- shapes
/** A mesh at a position. Casts and receives shadows unless told otherwise. */
export function mesh(geo, material, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
  if (o.scale) Array.isArray(o.scale) ? m.scale.set(...o.scale) : m.scale.setScalar(o.scale);
  return m;
}
/** Box whose base sits at y (so y=0 stands on the ground). */
export const box = (w, h, d, material, x = 0, y = 0, z = 0, o) => mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), material, x, y, z, o);
/** Cylinder or cone frustum standing on y. rTop=0 makes a cone; seg=4 makes a square tower (already turned so its faces are axis-aligned). */
export function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 24, o) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, o?.open ?? false).translate(0, h / 2, 0);
  if (seg === 4) g.rotateY(Math.PI / 4);
  return mesh(g, material, x, y, z, o);
}
export const sphere = (r, material, x = 0, y = 0, z = 0, o) => mesh(new THREE.SphereGeometry(r, o?.seg ?? 24, o?.rows ?? 16), material, x, y, z, o);
/** Top half of a sphere (a dome) sitting on y. */
export const dome = (r, material, x = 0, y = 0, z = 0, o) => mesh(new THREE.SphereGeometry(r, o?.seg ?? 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), material, x, y, z, o);
/** Solid of revolution from a profile [[radius, height], ...] listed bottom to top. */
export const lathe = (profile, material, x = 0, y = 0, z = 0, seg = 32, o) => mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001), h)), seg), material, x, y, z, o);
/** Flat outline [[x,z],...] pushed up by `h` from y. o.bevel adds a small bevel. */
export function prism(outline, h, material, x = 0, y = 0, z = 0, o = {}) {
  const s = new THREE.Shape(outline.map(([a, b]) => new THREE.Vector2(a, -b)));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: !!o.bevel, bevelSize: o.bevel, bevelThickness: o.bevel, bevelSegments: 1 }).rotateX(-Math.PI / 2);
  return mesh(g, material, x, y, z, o);
}
/** A tube along 3D points (cables, rails, arches). */
export function tube(points, radius, material, o = {}) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => Array.isArray(p) ? new THREE.Vector3(...p) : p), !!o.closed, 'catmullrom', o.tension ?? 0.5);
  return mesh(new THREE.TubeGeometry(c, o.seg ?? points.length * 6, radius, o.radial ?? 6, !!o.closed), material);
}
/** A straight beam between two points, square in section. */
export function beam(a, b, thick, material) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = mesh(new THREE.BoxGeometry(thick, thick, len), material);
  m.position.copy(A).lerp(B, 0.5); m.lookAt(B); return m;
}
/**
 * A sweeping East-Asian hip roof (curved eaves, raised corners), base at y. w along X, d along Z.
 * o: { ridge (0..0.9, ridge length as share of w), curve (1 = straight, 2 = deep sweep), lift (corner upturn, m), overhang }
 */
export function hipRoof(w, d, h, material, x = 0, y = 0, z = 0, o = {}) {
  const ridge = o.ridge ?? 0.5, curve = o.curve ?? 1.7, lift = o.lift ?? h * 0.22, N = 16;
  const g = new THREE.PlaneGeometry(w, d, N, N).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), v = p.getZ(i) / (d / 2);
    const m = Math.max(Math.abs(v), (Math.abs(u) - ridge) / (1 - ridge));
    p.setY(i, h * Math.pow(1 - clamp(m), curve) + lift * Math.pow(Math.abs(u * v), 2.5));
  }
  g.computeVertexNormals();
  const r = mesh(g, material, x, y, z, o); r.material.side = THREE.DoubleSide; return r;
}
/** Many copies of one geometry in a single draw call. items: [{ x,y,z, sx,sy,sz (or s), ry, rx, rz, color }] */
export function instances(geo, material, items, o = {}) {
  const im = new THREE.InstancedMesh(geo, material, items.length), d = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    d.position.set(it.x ?? 0, it.y ?? 0, it.z ?? 0); d.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
    d.scale.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    if (it.color !== undefined) im.setColorAt(i, c.set(it.color));
  });
  im.castShadow = o.cast ?? true; im.receiveShadow = o.receive ?? true; im.frustumCulled = false;
  return im;
}
const UNIT_BOX = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
/** Many box buildings in one draw call. list: [{ x, z, w, d, h, y?, ry?, color? }]; material is usually facadeMat(). */
export const buildings = (list, material, o) => instances(UNIT_BOX(), material, list.map((b) => ({ x: b.x, y: b.y ?? 0, z: b.z, sx: b.w, sy: b.h, sz: b.d, ry: b.ry, color: b.color })), o);
/**
 * Lays out a street grid of box buildings and returns the list (pass it to buildings()).
 * o: { rand, area [x0,z0,x1,z1], block (lot size, m), street (gap, m), height(x,z) -> metres (0 or less leaves the lot empty),
 *      keep(x,z) -> false to leave a lot empty, palette [colours], jitter (0..1), fill (0.6..1 share of the lot built on), split (chance a lot holds two buildings) }
 */
export function cityGrid(o) {
  const r = o.rand ?? rng(7), [x0, z0, x1, z1] = o.area, B = o.block ?? 40, S = o.street ?? 14, out = [];
  for (let x = x0 + B / 2; x < x1; x += B + S) for (let z = z0 + B / 2; z < z1; z += B + S) {
    if (o.keep && !o.keep(x, z)) continue;
    const h = o.height(x, z); if (!(h > 0)) continue;
    const fill = o.fill ?? 0.9, j = o.jitter ?? 0.25, n = r.chance(o.split ?? 0.3) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const w = B * fill * (n === 2 ? 0.48 : r.range(0.7, 1)), d = B * fill * r.range(0.7, 1);
      out.push({ x: x + (n === 2 ? (k - 0.5) * B * 0.5 : 0), z, w, d, h: h * (1 + r.range(-j, j)), color: o.palette ? r.pick(o.palette) : undefined });
    }
  }
  return out;
}

// ---------------------------------------------------------------- nature
/**
 * A ground mesh shaped by a height function, coloured per vertex.
 * o: { size (or [sx,sz]), seg, center [x,z], height(x,z) -> y, color(x,y,z,slope) -> colour (hex or THREE.Color), flat, rough }
 * Returns the mesh; mesh.userData.heightAt(x,z) gives the same height function.
 */
export function terrain(o) {
  const [sx, sz] = Array.isArray(o.size) ? o.size : [o.size, o.size], seg = o.seg ?? 128, [cx, cz] = o.center ?? [0, 0];
  const g = new THREE.PlaneGeometry(sx, sz, seg, Math.round(seg * sz / sx)).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, o.height(p.getX(i) + cx, p.getZ(i) + cz));
  g.computeVertexNormals();
  if (o.color) {
    const n = g.attributes.normal, c = new Float32Array(p.count * 3), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const v = o.color(p.getX(i) + cx, p.getY(i), p.getZ(i) + cz, 1 - n.getY(i)); (v.isColor ? t.copy(v) : t.set(v)).toArray(c, i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const m = mesh(g, mat(0xffffff, { rough: o.rough ?? 0.95, flat: o.flat, vertexColors: !!o.color }), cx, 0, cz, { cast: false });
  m.userData.heightAt = o.height; return m;
}
/** A big flat ground plane at height y. */
export const ground = (size, color, y = 0, o = {}) => mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat(color, { rough: o.rough ?? 0.95 }), o.x ?? 0, y, o.z ?? 0, { cast: false });

let waveTex = null;
function waveNormals() {
  if (waveTex) return waveTex;
  const N = 256, d = new Uint8Array(N * N * 4), W = [];
  const r = rng(11); for (let i = 0; i < 26; i++) W.push([r.int(-13, 13), r.int(-13, 13), r.range(0, 6.28), r.range(0.4, 1)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0; const u = x / N * 6.2832, v = y / N * 6.2832;
    for (const [kx, ky, ph, a] of W) { const c = Math.cos(kx * u + ky * v + ph) * a / (1 + Math.hypot(kx, ky) * 0.35); dx += c * kx; dy += c * ky; }
    const i = (y * N + x) * 4, s = 0.09, l = Math.hypot(dx * s, dy * s, 1);
    d[i] = (-dx * s / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy * s / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  waveTex = new THREE.DataTexture(d, N, N); waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.generateMipmaps = true;
  waveTex.minFilter = THREE.LinearMipmapLinearFilter; waveTex.magFilter = THREE.LinearFilter; waveTex.anisotropy = 4; waveTex.needsUpdate = true; waveTex.userData.shared = true;
  return waveTex;
}
/**
 * Rippling, reflective water at height y. Add the result to the world and it animates itself.
 * o: { size (or [sx,sz]), x, z, color, rough, ripple (m per texture repeat), strength (normal strength), speed }
 */
export function water(world, y = 0, o = {}) {
  const [sx, sz] = Array.isArray(o.size) ? o.size : [o.size ?? 8000, o.size ?? 8000];
  const tex = waveNormals().clone(); tex.needsUpdate = true; tex.repeat.set(sx / (o.ripple ?? 90), sz / (o.ripple ?? 90));
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? 0x1c4a66, roughness: o.rough ?? 0.1, metalness: o.metal ?? 0.35, normalMap: tex, normalScale: new THREE.Vector2(o.strength ?? 0.35, o.strength ?? 0.35) });
  m.envMapIntensity = o.env ?? 1.2;
  const w = mesh(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), m, o.x ?? 0, y, o.z ?? 0, { cast: false });
  const sp = o.speed ?? 1; world.onUpdate((t) => { tex.offset.set(t * 0.012 * sp, t * 0.007 * sp); });
  world.add(w); return w;
}
/**
 * Plants many trees in one or two draw calls. points: [[x,y,z, scale?], ...]
 * kind: 'round' (broadleaf), 'conifer', 'palm', 'blossom' (pink canopy), 'cypress', 'autumn'. o: { color, trunk, size (height in m), rand }
 */
export function trees(world, points, kind = 'round', o = {}) {
  const r = o.rand ?? rng(points.length + 3), H = o.size ?? (kind === 'palm' ? 11 : kind === 'conifer' ? 14 : 8);
  let trunkG, leafG, leafColors;
  if (kind === 'palm') {
    trunkG = new THREE.CylinderGeometry(0.018, 0.03, 1, 6).translate(0, 0.5, 0);
    const fr = []; for (let i = 0; i < 9; i++) { const f = new THREE.ConeGeometry(0.035, 0.42, 4).rotateZ(-Math.PI / 2).translate(0.2, 0, 0); f.scale(1, 0.35, 1); f.rotateZ(-0.35 - (i % 3) * 0.18); f.rotateY(i / 9 * 6.283); f.translate(0, 1, 0); fr.push(f); }
    leafG = mergeGeometries(fr); leafColors = [0x3f7d3a, 0x4a8a3c, 0x356e36];
  } else if (kind === 'conifer') {
    trunkG = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6).translate(0, 0.15, 0);
    leafG = mergeGeometries([new THREE.ConeGeometry(0.2, 0.5, 7).translate(0, 0.45, 0), new THREE.ConeGeometry(0.15, 0.42, 7).translate(0, 0.7, 0), new THREE.ConeGeometry(0.09, 0.3, 7).translate(0, 0.88, 0)]);
    leafColors = [0x1f4a34, 0x25543a, 0x1a4230];
  } else if (kind === 'cypress') {
    trunkG = new THREE.CylinderGeometry(0.015, 0.02, 0.15, 5).translate(0, 0.075, 0);
    leafG = new THREE.ConeGeometry(0.09, 0.95, 7).translate(0, 0.55, 0); leafColors = [0x23452f, 0x2a4f33];
  } else {
    trunkG = new THREE.CylinderGeometry(0.025, 0.04, 0.5, 6).translate(0, 0.25, 0);
    leafG = mergeGeometries([new THREE.IcosahedronGeometry(0.3, 1).translate(0, 0.68, 0), new THREE.IcosahedronGeometry(0.2, 1).translate(0.16, 0.56, 0.08), new THREE.IcosahedronGeometry(0.2, 1).translate(-0.14, 0.58, -0.1)]);
    leafColors = kind === 'blossom' ? [0xf6b7cf, 0xf9c9da, 0xf2a3c2, 0xfbdbe6] : kind === 'autumn' ? [0xd9762b, 0xc9412a, 0xe2a63a, 0xb5532a] : [0x3e7a3a, 0x4c8a42, 0x35693a, 0x5a9448];
  }
  if (o.color) leafColors = Array.isArray(o.color) ? o.color : [o.color];
  const items = points.map((p) => { const s = H * (p[3] ?? r.range(0.75, 1.25)); return { x: p[0], y: p[1], z: p[2], s, ry: r() * 6.28, rz: kind === 'palm' ? r.range(-0.12, 0.12) : 0, color: r.pick(leafColors) }; });
  const g = new THREE.Group();
  g.add(instances(trunkG, mat(o.trunk ?? (kind === 'palm' ? 0x8a7458 : 0x5b4533)), items.map((i) => ({ ...i, color: undefined }))));
  g.add(instances(leafG, mat(0xffffff, { rough: 0.9, flat: kind !== 'palm' }), items));
  world.add(g); return g;
}
/** Soft cloud banks. o: { count, area [x0,z0,x1,z1], y [lo,hi], size, color, rand, opacity } */
export function clouds(world, o = {}) {
  const r = o.rand ?? rng(5), [x0, z0, x1, z1] = o.area ?? [-3000, -3000, 3000, 3000], [y0, y1] = o.y ?? [500, 800], S = o.size ?? 160, items = [];
  for (let i = 0; i < (o.count ?? 30); i++) {
    const cx = r.range(x0, x1), cy = r.range(y0, y1), cz = r.range(z0, z1), n = r.int(7, 13), s = S * r.range(0.6, 1.5);
    for (let k = 0; k < n; k++) { const e = r.range(-1, 1), q = 1 - e * e * 0.6; items.push({ x: cx + e * 2.2 * s, y: cy + r.range(0, 0.16) * s * q, z: cz + r.range(-0.7, 0.7) * s, sx: s * r.range(0.7, 1.3) * q, sy: s * r.range(0.1, 0.2) * q, sz: s * r.range(0.3, 0.6) * q }); }
  }
  const m = new THREE.MeshLambertMaterial({ color: o.color ?? 0xffffff, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1 });
  m.emissive = col(o.color ?? 0xffffff).multiplyScalar(o.self ?? 0.25);
  const c = instances(new THREE.IcosahedronGeometry(1, 2), m, items, { cast: false, receive: false }); world.add(c); return c;
}

// ---------------------------------------------------------------- lights and signs
let dotTex = null;
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c); dotTex.userData.shared = true; return dotTex;
}
/**
 * Glowing dots (street lamps, harbour lights, lanterns, fireflies). points: [[x,y,z], ...] or a flat Float32Array.
 * o: { color (one colour or an array picked per point), size (m), power, rand, fixed (size in pixels instead of metres) }
 */
export function lights(world, points, o = {}) {
  const n = points.length / (Array.isArray(points[0]) ? 1 : 3), pos = Array.isArray(points[0]) ? new Float32Array(points.flat()) : points;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ size: o.size ?? 3, map: softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: !o.fixed, toneMapped: false });
  if (Array.isArray(o.color)) {
    const r = o.rand ?? rng(n), c = new Float32Array(n * 3), t = new THREE.Color();
    for (let i = 0; i < n; i++) t.set(r.pick(o.color)).multiplyScalar(o.power ?? 1).toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); m.vertexColors = true;
  } else m.color = col(o.color ?? 0xffd9a0).multiplyScalar(o.power ?? 1);
  const p = new THREE.Points(g, m); p.frustumCulled = false; world.add(p); return p;
}
/**
 * Lights that drive along a line (cars at night, boats, trains). line: [[x,y,z], ...]
 * o: { count, color, size, speed (m/s), spread (lane offset, m), loop }
 */
export function traffic(world, line, o = {}) {
  const curve = new THREE.CatmullRomCurve3(line.map((p) => new THREE.Vector3(...p)), !!o.loop, 'catmullrom', 0.2), len = curve.getLength(), n = o.count ?? 40, r = rng(n + line.length);
  const pos = new Float32Array(n * 3), off = Array.from({ length: n }, () => r()), lane = Array.from({ length: n }, () => r.range(-1, 1) * (o.spread ?? 0));
  const pts = lights(world, pos, o), v = new THREE.Vector3(), tg = new THREE.Vector3(), sp = (o.speed ?? 14) / len;
  world.onUpdate((t) => {
    for (let i = 0; i < n; i++) { const u = (((off[i] + t * sp) % 1) + 1) % 1; curve.getPointAt(u, v); curve.getTangentAt(u, tg); pos[i * 3] = v.x - tg.z * lane[i]; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z + tg.x * lane[i]; }
    pts.geometry.attributes.position.needsUpdate = true;
  });
  return pts;
}
/** Falling snow, drifting petals or rain around the camera. o: { count, color, size, fall (m/s), drift, box (m) } */
export function particles(world, o = {}) {
  const n = o.count ?? 1500, B = o.box ?? 120, r = rng(n), base = new Float32Array(n * 3), pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) base[i] = r() * B;
  const pts = lights(world, pos, { color: o.color ?? 0xffffff, size: o.size ?? 0.5, power: o.power ?? 0.9 });
  pts.material.blending = THREE.NormalBlending; pts.material.opacity = o.opacity ?? 0.85; pts.material.toneMapped = true;
  const fall = o.fall ?? 3, drift = o.drift ?? 1.5, wrap = (v) => ((v % B) + B) % B - B / 2;
  world.onUpdate((t, dt, cam) => {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      pos[j] = cam.position.x + wrap(base[j] + Math.sin(t * 0.6 + i) * drift + t * drift * 0.4 - cam.position.x);
      pos[j + 1] = cam.position.y + wrap(base[j + 1] - t * fall - cam.position.y);
      pos[j + 2] = cam.position.z + wrap(base[j + 2] + Math.cos(t * 0.5 + i * 1.3) * drift - cam.position.z);
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });
  return pts;
}
/**
 * Words on a flat panel (neon signs, banners, station names). Returns a mesh `height` metres tall, facing +Z.
 * o: { color, bg (css colour or null for see-through), font, weight, glow (over-brighten, for night), vertical, pad }
 */
export function sign(text, height = 4, o = {}) {
  const fs = 96, c = document.createElement('canvas'), x = c.getContext('2d'), font = `${o.weight ?? 700} ${fs}px ${o.font ?? '"Noto Sans CJK SC","PingFang SC","Microsoft YaHei","Hiragino Sans",sans-serif'}`;
  x.font = font; const chars = [...text], pad = (o.pad ?? 0.25) * fs;
  const tw = o.vertical ? fs : x.measureText(text).width, th = o.vertical ? fs * chars.length * 1.05 : fs * 1.15;
  c.width = Math.ceil(tw + pad * 2); c.height = Math.ceil(th + pad * 2);
  if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, c.width, c.height); }
  x.font = font; x.fillStyle = o.color ?? '#fff'; x.textBaseline = 'middle'; x.textAlign = 'center';
  if (o.vertical) chars.forEach((ch, i) => x.fillText(ch, c.width / 2, pad + fs * 1.05 * (i + 0.5))); else x.fillText(text, c.width / 2, c.height / 2 + fs * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: !o.bg, side: THREE.DoubleSide, color: col(0xffffff).multiplyScalar(o.glow ?? 1), toneMapped: !(o.glow > 1) });
  const scale = o.vertical ? height / c.height : height / c.height;
  return mesh(new THREE.PlaneGeometry(c.width * scale, c.height * scale), m, 0, 0, 0, { cast: false, receive: false });
}
/**
 * A suspension bridge along the X axis, centred on the origin; put it in place with .position and .rotation.y.
 * o: { length, towerH, deckY, width, color, towerColor, cableColor, towers (x positions), deckThick }
 */
export function suspensionBridge(o = {}) {
  const L = o.length ?? 800, H = o.towerH ?? 150, Y = o.deckY ?? 45, W = o.width ?? 26, g = new THREE.Group();
  const cm = mat(o.color ?? 0xb23a26, { rough: 0.6 }), tm = o.towerColor !== undefined ? mat(o.towerColor, { rough: 0.7 }) : cm, km = mat(o.cableColor ?? o.color ?? 0xb23a26, { rough: 0.5 });
  const tx = o.towers ?? [-L * 0.25, L * 0.25];
  g.add(box(L, o.deckThick ?? 3.5, W, cm, 0, Y - (o.deckThick ?? 3.5), 0));
  for (const x of tx) for (const s of [-1, 1]) {
    g.add(box(H * 0.05, H, H * 0.045, tm, x, 0, s * W * 0.5));
    for (const f of [0.45, 0.7, 0.96]) if (s === 1) g.add(box(H * 0.035, H * 0.04, W, tm, x, H * f, 0));
  }
  const hang = [];
  for (const s of [-1, 1]) {
    const pts = [], stops = [-L / 2, ...tx, L / 2];
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1], mid = k > 0 && k < stops.length - 2;
      for (let i = 0; i <= 12; i++) {
        const u = i / 12, x = lerp(a, b, u);
        const y = mid ? Y + 4 + (H - Y - 4) * Math.pow(2 * u - 1, 2) : (k === 0 ? lerp(Y, H, u * u) : lerp(H, Y, 1 - (1 - u) * (1 - u)));
        if (i > 0 || k === 0) pts.push([x, y, s * W * 0.5]);
        if (i > 0 && i < 12 && y - Y > 2) hang.push({ x, y: Y, z: s * W * 0.5, sx: 0.35, sy: y - Y, sz: 0.35 });
      }
    }
    g.add(tube(pts, o.cable ?? 0.9, km, { seg: 96, tension: 0.1 }));
  }
  g.add(instances(UNIT_BOX(), km, hang, { cast: false }));
  return g;
}

// ---------------------------------------------------------------- the world itself
const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }';
const SKY_FRAG = `varying vec3 vDir; uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor; uniform float uSunSize, uHaze;
void main(){ vec3 d = normalize(vDir); float h = d.y;
  vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(h, uHaze)) : mix(uHorizon, uBottom, pow(min(-h * 5.0, 1.0), 0.7));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunColor * (smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, s) * 6.0 + pow(s, 90.0) * 0.5 + pow(s, 8.0) * 0.18);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
/**
 * Starts a city: makes the scene, its sky, sun, ambient light, fog and reflections.
 * o: {
 *   sky: { top, horizon, bottom, haze (0.3 hazy .. 1 crisp) },
 *   sun: { dir [x,y,z] (pointing towards the sun), color, power (light strength), disc (colour of the visible disc), size (disc size, about 0.0004 sun .. 0.002 big low sun) },
 *   ambient: { sky, ground, power },   fog: { color, density } (density about 0.0003 clear .. 0.002 misty),
 *   stars (count, for night), exposure (tone-mapping exposure, default 1), env (strength of sky reflections, default 0.7) }
 * Returns a world: world.add(obj...), world.onUpdate((t, dt, camera) => {}), world.scene, world.sun.
 */
export function createWorld(o = {}) {
  const scene = new THREE.Scene(), sky = o.sky ?? {}, sun = o.sun ?? {}, amb = o.ambient ?? {}, updaters = [];
  const sunDir = new THREE.Vector3(...(sun.dir ?? [0.4, 0.7, 0.3])).normalize();
  const sm = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: col(sky.top ?? 0x3f7fd0) }, uHorizon: { value: col(sky.horizon ?? 0xbcd6ee) }, uBottom: { value: col(sky.bottom ?? sky.horizon ?? 0x9fb4c4) }, uSunDir: { value: sunDir }, uSunColor: { value: col(sun.disc ?? sun.color ?? 0xfff2d8) }, uSunSize: { value: sun.size ?? 0.0006 }, uHaze: { value: sky.haze ?? 0.55 } },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 16), sm); dome.renderOrder = -1000; dome.frustumCulled = false;
  const skyRoot = new THREE.Group(); skyRoot.add(dome);
  if (o.stars) {
    const r = rng(99), n = o.stars, p = new Float32Array(n * 3), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.set(r.range(-1, 1), r.range(0.02, 1), r.range(-1, 1)).normalize().multiplyScalar(4200); v.toArray(p, i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const st = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
    st.renderOrder = -999; st.frustumCulled = false; skyRoot.add(st);
  }
  if (pmrem) {
    const tmp = new THREE.Scene(); tmp.add(dome); const rt = pmrem.fromScene(tmp, 0.02, 1, 6000);
    scene.environment = rt.texture; scene.environmentIntensity = o.env ?? 0.7; scene.userData.envRT = rt; skyRoot.add(dome);
  }
  scene.add(skyRoot);
  const fog = o.fog ?? {}; scene.fog = new THREE.FogExp2(col(fog.color ?? sky.horizon ?? 0xbcd6ee), fog.density ?? 0.0006);
  scene.add(new THREE.HemisphereLight(col(amb.sky ?? sky.top ?? 0x9fc4ff), col(amb.ground ?? 0x4a4338), amb.power ?? 0.9));
  const light = new THREE.DirectionalLight(col(sun.color ?? 0xfff2d8), sun.power ?? 3);
  light.castShadow = true; light.shadow.mapSize.set(2048, 2048); light.shadow.bias = -0.0004; light.shadow.normalBias = 0.6;
  const sc = light.shadow.camera; sc.left = sc.bottom = -260; sc.right = sc.top = 260; sc.near = 10; sc.far = 1600;
  scene.add(light, light.target);
  const world = {
    scene, sun: light, sunDir, skyRoot, exposure: o.exposure ?? 1,
    add(...objs) { for (const ob of objs.flat()) if (ob) scene.add(ob); return objs[0]; },
    onUpdate(fn) { updaters.push(fn); },
    update(t, dt, cam) { for (const f of updaters) f(t, dt, cam); },
    /** Engine calls this before drawing: keeps the sky and the shadow box centred on the camera. */
    follow(cam, fwd) {
      skyRoot.position.copy(cam.position);
      light.target.position.copy(cam.position).addScaledVector(fwd, 120); light.target.position.y = Math.max(0, cam.position.y - 60);
      light.position.copy(light.target.position).addScaledVector(sunDir, 800); light.target.updateMatrixWorld();
    },
    dispose() {
      scene.traverse((ob) => {
        if (ob.geometry) ob.geometry.dispose();
        for (const m of [].concat(ob.material ?? [])) { for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.userData.shared) v.dispose(); } m.dispose(); }
        if (ob.isInstancedMesh) ob.dispose();
      });
      scene.userData.envRT?.dispose();
    },
  };
  return world;
}

/**
 * Keeps buildings out of the camera's way. Give it the city's flight path; it returns clear(x, z, radius = 60),
 * the lowest height the camera flies at within `radius` metres of (x,z), or Infinity if the path never comes near.
 * Typical use inside a height function: h = Math.min(h, clear(x, z, 70) - 25).
 */
export function clearance(path) {
  const c = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const pts = c.getSpacedPoints(Math.max(50, Math.round(c.getLength() / 12)));
  return (x, z, radius = 60) => { let lo = Infinity; const r2 = radius * radius; for (const p of pts) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < r2 && p.y < lo) lo = p.y; } return lo; };
}
