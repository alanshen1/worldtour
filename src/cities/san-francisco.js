// San Francisco, real: Google Photorealistic 3D Tiles. In from the Pacific through the Golden Gate, across the bridge
// between its towers just above the deck, then round past the south tower and east along Crissy Field to the Palace of
// Fine Arts and the Marina, with Alcatraz out on the bay and downtown and the Transamerica Pyramid ahead.
// (The kit-built version lives on in git history; see new-york.js for the shape of a real city.)
export default {
  kind: 'tiles',
  lat: 37.8045, lon: -122.4600,   // Crissy Field, flat open ground by the bay
  duration: 62,
  look: {
    // a clear late afternoon with sea haze rolling in through the Gate
    sky: { top: 0x4f7fc0, horizon: 0xf0d6b8, bottom: 0xc8c0b6, haze: 0.5 },
    sun: { dir: [0.88, 0.3, -0.12], color: 0xffd6a8, disc: 0xffe6c4, size: 0.0004 },
    fog: { color: 0xd9d2c8, density: 0.00018 },
    tint: 0xfff2e4, exposure: 1,
  },
  path: [
    [37.8152, -122.4875, 90],   // over the strait, outside the Gate, the bridge ahead
    [37.8175, -122.4820, 105],
    [37.8188, -122.4785, 115],  // across the bridge at mid-span, between the towers
    [37.8192, -122.4745, 110],  // out over the bay side
    [37.8150, -122.4720, 100],  // round past the south tower, off its east side
    [37.8105, -122.4690, 85],
    [37.8075, -122.4620, 75],   // along Crissy Field, just off the shore
    [37.8058, -122.4545, 72],
    [37.8041, -122.4488, 65],   // low past the Palace of Fine Arts rotunda, across its lagoon
    [37.8058, -122.4420, 75],
    [37.8070, -122.4360, 85],   // Marina Green
    [37.8080, -122.4300, 95],   // off Fort Mason
    [37.8078, -122.4250, 108],
    [37.8070, -122.4205, 118],  // the portal over Aquatic Park, Russian and Telegraph Hills and downtown ahead
  ],
  focus: [
    [0.08, 37.82560, -122.47910, 190],  // the north tower, across the span
    [0.16, 37.82560, -122.47910, 190],
    [0.30, 37.81070, -122.47710, 190],  // the south tower
    [0.38, 37.81070, -122.47710, 170],
    [0.52, 37.80290, -122.44840, 30],   // the Palace of Fine Arts rotunda
    [0.62, 37.80290, -122.44840, 30],
    [0.70, 37.79520, -122.40280, 220],  // the Transamerica Pyramid
    [0.78, 37.79520, -122.40280, 220],
  ],
};
