// New York, real: Google Photorealistic 3D Tiles. In past the Statue of Liberty, along the tip of Manhattan,
// over the Brooklyn Bridge, up the East River to the Empire State Building, across Midtown's towers to Central Park.
// This file is the pattern for every real city (the kit-built version lives on in git history):
//   lat/lon      the origin, in degrees; the engine measures the ground there, and every `alt` is metres above it
//   path         [lat, lon, alt] points the camera flies through; it enters at the first, the portal stands at the last
//   focus        [u, lat, lon, alt]: what the camera turns to look at, and when (u = 0..1 along the flight, keep it in 0.08..0.78)
//   look         sky, sun and fog (as for kit createWorld) and a tint for the photographs: a warm tint reads as late afternoon
// Real buildings are tall and their heights are not known in advance: fly above them (the engine lifts the camera
// when a roof comes within 28 m, and tools/shot.mjs prints that lift — a lift means the path is too low there).
export default {
  kind: 'tiles',
  lat: 40.7033, lon: -74.0170,   // Battery Park
  duration: 50,
  look: {
    sky: { top: 0x3f6fb5, horizon: 0xf2cfa6, bottom: 0xc9b5a0, haze: 0.45 },
    sun: { dir: [-0.82, 0.24, 0.3], color: 0xffd2a0, disc: 0xffe0b8, size: 0.0011 },
    fog: { color: 0xdcc6b0, density: 0.00016 },
    tint: 0xfff1e2, exposure: 1,
  },
  path: [
    [40.6720, -74.0610, 70],   // over the Upper Bay, south-west of Liberty Island
    [40.6772, -74.0545, 75],
    [40.6858, -74.0420, 95],   // past the statue, off its south-east side
    [40.6950, -74.0290, 130],
    [40.7005, -74.0160, 170],  // off the Battery, the Financial District ahead
    [40.7030, -74.0020, 160],  // over the East River, towards the Brooklyn Bridge
    [40.7085, -73.9940, 175],  // across the bridge
    [40.7190, -73.9760, 210],  // up the East River
    [40.7330, -73.9710, 260],
    [40.7440, -73.9790, 340],  // Murray Hill, the Empire State Building on the left
    [40.7540, -73.9790, 420],  // Midtown
    [40.7640, -73.9740, 480],  // over the Plaza district, between the supertall towers
    [40.7720, -73.9720, 380],  // over Central Park
    [40.7775, -73.9690, 330],
    [40.7815, -73.9667, 320],  // the portal, the Reservoir beyond
  ],
  focus: [
    [0.08, 40.68925, -74.04450, 55],   // the Statue of Liberty
    [0.2, 40.68925, -74.04450, 55],
    [0.28, 40.71270, -74.01340, 300],  // One World Trade Center
    [0.38, 40.70610, -73.99690, 60],   // Brooklyn Bridge
    [0.46, 40.71500, -73.98000, 80],   // the river ahead
    [0.56, 40.74840, -73.98570, 330],  // the Empire State Building
    [0.66, 40.74840, -73.98570, 330],
    [0.74, 40.77300, -73.97100, 60],   // Central Park
  ],
};
