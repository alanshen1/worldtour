// Oslo, real: Google Photorealistic 3D Tiles. In over the Oslofjord past Aker Brygge into Pipervika, with City Hall's
// twin towers ahead, over Akershus Fortress and down to the water, low across Bjørvika to the Opera House and up its
// white roof where it slopes into the fjord, along the Barcode towers, and round past the Munch museum to the portal.
// The origin is on the water of Bjørvika, so every `alt` is roughly metres above the fjord.
export default {
  kind: 'tiles',
  lat: 59.9050, lon: 10.7495,   // Bjørvika, off the Opera House
  duration: 56,
  look: {
    sky: { top: 0x2f4580, horizon: 0xf0b49a, bottom: 0x8c8ea4, haze: 0.55 },
    sun: { dir: [0.75, 0.1, -0.65], color: 0xffb890, disc: 0xffd2b8, size: 0.0004 },
    fog: { color: 0xc4bccc, density: 0.0002 },
    tint: 0xe8e4f0, exposure: 1,
  },
  path: [
    [59.9022, 10.7238, 45],    // the Oslofjord, Tjuvholmen ahead on the left
    [59.9045, 10.7264, 45],
    [59.9072, 10.7298, 50],    // into Pipervika, City Hall ahead
    [59.9094, 10.7335, 70],    // turning before the City Hall square
    [59.9084, 10.7375, 90],    // over Akershus Fortress
    [59.9068, 10.7420, 80],
    [59.9060, 10.7455, 45],    // down over the quay to the water
    [59.9061, 10.7480, 20],    // low across Bjørvika towards the Opera
    [59.9065, 10.7503, 26],    // where the marble roof slopes into the fjord
    [59.9076, 10.7524, 70],    // up the roof
    [59.9083, 10.7553, 95],    // past the stage tower
    [59.9079, 10.7595, 105],   // along the Barcode towers
    [59.9073, 10.7630, 100],
    [59.9058, 10.7605, 95],    // round to the south
    [59.9044, 10.7552, 75],    // past the Munch museum
    [59.9024, 10.7503, 60],    // out over the harbour
    [59.9006, 10.7462, 55],    // the portal, the fjord islands ahead
  ],
  focus: [
    [0.08, 59.91190, 10.73360, 55],   // City Hall's twin towers
    [0.25, 59.91190, 10.73360, 55],
    [0.31, 59.90700, 10.73650, 35],   // Akershus Fortress
    [0.40, 59.90700, 10.73650, 35],
    [0.46, 59.90740, 10.75280, 25],   // the Opera House
    [0.54, 59.90740, 10.75300, 30],
    [0.60, 59.90800, 10.76000, 85],   // the Barcode
    [0.69, 59.90800, 10.76300, 85],
    [0.75, 59.90560, 10.75520, 40],   // the Munch museum
    [0.78, 59.90560, 10.75520, 40],
  ],
};
