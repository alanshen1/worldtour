// Chicago, real: Google Photorealistic 3D Tiles. In off Lake Michigan beside Navy Pier, low up the Chicago River
// between the towers and over its bascule bridges, past Trump Tower and the corn cobs of Marina City,
// down the South Branch to the Willis Tower and up over the Loop, with Grant Park and the lake ahead of the portal.
// File format and rules: see new-york.js.
export default {
  kind: 'tiles',
  lat: 41.8887, lon: -87.6225,   // on the river between the Columbus and Michigan bridges: every alt is above the water
  duration: 62,
  look: {
    sky: { top: 0x2f68b8, horizon: 0xd8e4ee, bottom: 0xa8b8c4, haze: 0.4 },
    sun: { dir: [-0.35, 0.85, 0.3], color: 0xfff2dc, disc: 0xfff8ea, size: 0.00035 },
    fog: { color: 0xc8d6e2, density: 0.00016 },
    tint: 0xf2f7ff, exposure: 1,
  },
  path: [
    [41.8890, -87.5990, 60],   // over the lake by the end of Navy Pier, heading west
    [41.8888, -87.6060, 50],   // along Navy Pier
    [41.8886, -87.6110, 40],   // through the harbour lock into the river
    [41.8885, -87.6200, 35],   // between the towers
    [41.8888, -87.6243, 35],   // the Michigan Avenue bridge
    [41.8878, -87.6276, 35],   // Trump Tower to the right
    [41.8872, -87.6305, 35],   // Marina City
    [41.8870, -87.6335, 38],
    [41.8870, -87.6365, 42],   // Wolf Point
    [41.8845, -87.6380, 50],   // down the South Branch
    [41.8810, -87.6383, 68],
    [41.8780, -87.6384, 105],   // the Willis Tower to the left
    [41.8758, -87.6378, 175],  // turning east along Congress Parkway
    [41.8755, -87.6340, 195],
    [41.8755, -87.6300, 215],
    [41.8755, -87.6262, 225],  // the portal, Grant Park and the lake ahead
  ],
  focus: [
    [0.08, 41.8917, -87.6095, 40],    // the Navy Pier wheel
    [0.2, 41.8917, -87.6095, 40],
    [0.32, 41.8889, -87.6264, 200],   // Trump Tower
    [0.38, 41.8889, -87.6264, 150],
    [0.42, 41.8884, -87.6289, 90],    // Marina City
    [0.46, 41.8870, -87.6400, 40],    // on down the river
    [0.54, 41.8870, -87.6400, 40],
    [0.6, 41.8789, -87.6359, 230],    // the Willis Tower
    [0.7, 41.8789, -87.6359, 260],
    [0.78, 41.8756, -87.6190, 0],     // Grant Park and Buckingham Fountain
  ],
};
