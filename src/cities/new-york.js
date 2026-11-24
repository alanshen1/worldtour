// New York, real: Google Photorealistic 3D Tiles. In past the Statue of Liberty, round the tip of Manhattan,
// over the Brooklyn and Manhattan bridges, out up the East River with Midtown's towers ahead.
// Real landmarks are far apart: keep a flight to about 4-7 km and give it 55-65 s, or it races past everything.
// This file is the pattern for every real city (the kit-built version lives on in git history):
//   lat/lon      the origin, in degrees; the engine measures the ground there, and every `alt` is metres above it
//   path         [lat, lon, alt] points the camera flies through; it enters at the first, the portal stands at the last
//   focus        [u, lat, lon, alt]: what the camera turns to look at, and when (u = 0..1 along the flight, keep it in 0.08..0.78)
//   look         sky, sun and fog (as for kit createWorld) and a tint for the photographs: a warm tint reads as late afternoon
//                In a real city the axes are +x west, +y up, +z north: a western sun has dir x > 0.
// Real buildings are tall and their heights are not known in advance: fly above them (the engine lifts the camera
// when a roof comes within 28 m, and tools/shot.mjs prints that lift — a lift means the path is too low there).
export default {
  kind: 'tiles',
  lat: 40.7033, lon: -74.0170,   // Battery Park
  duration: 60,
  look: {
    sky: { top: 0x3f6fb5, horizon: 0xf2cfa6, bottom: 0xc9b5a0, haze: 0.45 },
    sun: { dir: [0.82, 0.24, -0.3], color: 0xffd2a0, disc: 0xffe0b8, size: 0.00035 },
    fog: { color: 0xdcc6b0, density: 0.00016 },
    tint: 0xfff1e2, exposure: 1,
  },
  path: [
    [40.6830, -74.0475, 60],   // the Upper Bay, just south-east of Liberty Island
    [40.6858, -74.0440, 65],
    [40.6905, -74.0385, 85],   // past the statue, off its east side
    [40.6960, -74.0290, 110],
    [40.7000, -74.0170, 140],  // the tip of Manhattan ahead
    [40.7012, -74.0090, 150],  // round the tip, over the water
    [40.7040, -74.0030, 150],  // up the East River beside the Financial District
    [40.7068, -73.9975, 150],  // over the Brooklyn Bridge
    [40.7105, -73.9910, 170],  // over the Manhattan Bridge
    [40.7140, -73.9850, 190],
    [40.7175, -73.9795, 200],  // the portal, Midtown's towers ahead
  ],
  focus: [
    [0.08, 40.68925, -74.04450, 55],   // the Statue of Liberty
    [0.24, 40.68925, -74.04450, 55],
    [0.36, 40.71270, -74.01340, 300],  // One World Trade Center
    [0.46, 40.71270, -74.01340, 300],
    [0.56, 40.70580, -73.99780, 60],   // a Brooklyn Bridge tower
    [0.66, 40.74840, -73.98570, 300],  // the Empire State Building, far up the river
    [0.78, 40.74840, -73.98570, 300],
  ],
};
