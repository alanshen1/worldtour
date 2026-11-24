// Kyoto, real: Google Photorealistic 3D Tiles. In from the west past Kyoto Tower, across the Kamo river, up the
// wooded slopes of Higashiyama to the great wooden stage of Kiyomizu-dera, then north over the old lanes of
// Sannenzaka past the Yasaka Pagoda, with Gion and the city ahead of the portal. File format and rules: see new-york.js.
export default {
  kind: 'tiles',
  lat: 34.9930, lon: 135.7698,   // on the Kamo river: every alt is above the water
  duration: 60,
  look: {
    sky: { top: 0x5a7fb8, horizon: 0xf0d8c0, bottom: 0xc4b0a0, haze: 0.5 },
    sun: { dir: [0.75, 0.3, -0.4], color: 0xffd6a8, disc: 0xffe6c4, size: 0.0004 },
    fog: { color: 0xdcccc4, density: 0.00022 },
    tint: 0xfff2e6, exposure: 1,
  },
  path: [
    [34.9893, 135.7545, 105],   // west of the station, heading east
    [34.9893, 135.7563, 105],   // Kyoto Tower ahead to the right
    [34.9896, 135.7625, 95],
    [34.9902, 135.7690, 80],    // over the Kamo river
    [34.9912, 135.7745, 90],
    [34.9926, 135.7790, 105],   // up towards Higashiyama
    [34.9938, 135.7818, 115],   // Kiyomizu-dera's stage ahead
    [34.9950, 135.7830, 120],   // turning north beside it
    [34.9966, 135.7822, 115],
    [34.9978, 135.7805, 105],   // over Sannenzaka
    [34.9986, 135.7782, 100],   // the Yasaka Pagoda to the right
    [35.0005, 135.7770, 105],
    [35.0025, 135.7760, 112],   // past Yasaka Shrine
    [35.0045, 135.7744, 118],
    [35.0063, 135.7726, 125],   // the portal, Gion and the Kamo ahead
  ],
  focus: [
    [0.08, 34.9875, 135.7593, 100],   // Kyoto Tower
    [0.14, 34.9875, 135.7593, 100],
    [0.26, 34.9930, 135.7703, 5],     // the Kamo river
    [0.48, 34.99485, 135.78504, 70],  // Kiyomizu-dera's main hall
    [0.6, 34.99485, 135.78504, 70],
    [0.66, 34.9995, 135.7815, 70],    // on along the slope
    [0.72, 34.9986, 135.7793, 55],    // the Yasaka Pagoda
    [0.78, 34.9986, 135.7793, 55],
  ],
};
