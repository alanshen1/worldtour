// Taipei, real: Google Photorealistic 3D Tiles. In over the arch of Liberty Square, past the white Chiang Kai-shek
// Memorial Hall under its blue roof, over Daan Forest Park and east along Xinyi Road, climbing towards Taipei 101 with
// the green hills of the basin behind it. The portal hangs in front of the tower. (The government quarter round the
// Presidential Office is only coarse, flat tiles, so the flight stays away from it.)
// File format and rules: see new-york.js.
export default {
  kind: 'tiles',
  lat: 25.0352, lon: 121.5203,   // the open paving of Liberty Square
  duration: 56,
  look: {
    sky: { top: 0x4f82c0, horizon: 0xe6ebe2, bottom: 0xb8c4b8, haze: 0.5 },
    sun: { dir: [0.55, 0.42, -0.5], color: 0xfff1d8, disc: 0xfff6e4, size: 0.00035 },
    fog: { color: 0xd2dcd6, density: 0.00022 },
    tint: 0xf4fbf8, exposure: 1,
  },
  path: [
    [25.0358, 121.5170, 90],    // over the arch of Liberty Square, heading east
    [25.0359, 121.5186, 90],
    [25.0361, 121.5222, 95],    // beside Chiang Kai-shek Memorial Hall
    [25.0357, 121.5270, 110],
    [25.0345, 121.5340, 130],   // Daan Forest Park to the right
    [25.0337, 121.5420, 150],   // east along Xinyi Road
    [25.0330, 121.5490, 175],
    [25.0326, 121.5540, 205],
    [25.0326, 121.5572, 240],   // climbing towards Taipei 101
    [25.0331, 121.5592, 270],
    [25.0336, 121.5612, 290],   // the portal, Taipei 101 filling the view ahead
  ],
  focus: [
    [0.08, 25.0347, 121.5218, 45],    // Chiang Kai-shek Memorial Hall
    [0.16, 25.0347, 121.5218, 45],
    [0.3, 25.0300, 121.5355, 20],     // Daan Forest Park
    [0.42, 25.0300, 121.5355, 20],
    [0.56, 25.03396, 121.56447, 250], // Taipei 101, climbing its height
    [0.68, 25.03396, 121.56447, 350],
    [0.78, 25.03396, 121.56447, 430],
  ],
};
