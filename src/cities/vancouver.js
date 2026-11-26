// Vancouver, real: Google Photorealistic 3D Tiles. A crisp morning after rain: in over English Bay with the West End
// towers and the North Shore mountains ahead, across the forest of Stanley Park to Prospect Point and over the Lions
// Gate Bridge, back along the First Narrows round Brockton Point, and across Coal Harbour to the white sails of Canada Place.
// (The kit-built version lives on in git history; see new-york.js for the shape of a real city.)
export default {
  kind: 'tiles',
  lat: 49.2905, lon: -123.1205,   // Harbour Green Park on Coal Harbour, just above the water
  duration: 62,
  look: {
    // world axes here: +x west, +y up, +z north. A low morning sun in the south-east, washed air, cool light
    sky: { top: 0x3d6fae, horizon: 0xd8e2ec, bottom: 0xa9b8c4, haze: 0.5 },
    sun: { dir: [-0.7, 0.35, -0.55], color: 0xfff0dc, disc: 0xfff4e4, size: 0.00035 },
    fog: { color: 0xc9d4de, density: 0.00016 },
    tint: 0xeef2ff, exposure: 1,
  },
  path: [
    [49.2952, -123.1615, 100],  // over English Bay off Third Beach, Stanley Park and the mountains ahead
    [49.2975, -123.1585, 110],
    [49.3010, -123.1545, 140],  // into the park
    [49.3058, -123.1490, 150],  // above the forest
    [49.3088, -123.1452, 145],
    [49.3120, -123.1432, 125],  // Prospect Point, the bridge's south end to the right
    [49.3142, -123.1416, 110],  // beside the Lions Gate Bridge, between its towers
    [49.3153, -123.1355, 105],  // across the bridge at mid-span
    [49.3112, -123.1288, 100],  // down the First Narrows
    [49.3062, -123.1210, 90],
    [49.3030, -123.1140, 82],   // round Brockton Point
    [49.2975, -123.1135, 85],
    [49.2935, -123.1140, 95],   // across the mouth of Coal Harbour
    [49.2908, -123.1136, 110],  // the portal beside Canada Place's sails, downtown ahead
  ],
  focus: [
    [0.08, 49.28580, -123.12500, 150],  // the West End and downtown towers, across the park
    [0.16, 49.28580, -123.12500, 150],
    [0.26, 49.31310, -123.13970, 90],   // the Lions Gate Bridge, south tower
    [0.38, 49.31700, -123.13750, 90],   // north tower
    [0.60, 49.30100, -123.11700, 20],   // Brockton Point and its lighthouse
    [0.68, 49.30100, -123.11700, 20],
    [0.74, 49.28880, -123.11110, 25],   // Canada Place's sails
    [0.78, 49.28880, -123.11110, 25],
  ],
};
