// Washington, D.C., real: Google Photorealistic 3D Tiles. A soft spring morning in cherry-blossom season: a close arc
// round the Capitol dome, then west down the National Mall to the Washington Monument with the White House off to the
// right, low along the Reflecting Pool to the Lincoln Memorial, and round over West Potomac Park to the Tidal Basin and
// the Jefferson Memorial. (The kit-built version lives on in git history; see new-york.js for the shape of a real city.)
export default {
  kind: 'tiles',
  lat: 38.8890, lon: -77.0250,   // the middle of the Mall, between the museums
  duration: 60,
  look: {
    // world axes here: +x west, +y up, +z north. Morning sun in the south-east behind the flight, blossom-pink haze
    sky: { top: 0x5a86c4, horizon: 0xf1dcd6, bottom: 0xcdbfbd, haze: 0.5 },
    sun: { dir: [-0.72, 0.42, -0.55], color: 0xfff0e2, disc: 0xfff4ea, size: 0.00035 },
    fog: { color: 0xe4d6d4, density: 0.00017 },
    tint: 0xfff3f0, exposure: 1,
  },
  path: [
    [38.8948, -77.0040, 140],   // over Capitol Hill, north-east of the dome
    [38.8936, -77.0062, 140],
    [38.8925, -77.0092, 140],   // the close arc: north of the dome
    [38.8911, -77.0122, 135],
    [38.8895, -77.0142, 125],   // the West Front, the Mall ahead
    [38.8892, -77.0200, 110],
    [38.8893, -77.0270, 110],   // down the Mall between the museums
    [38.8906, -77.0322, 118],
    [38.8932, -77.0360, 110],   // past the Washington Monument over the Ellipse, the White House to the right
    [38.8916, -77.0405, 85],
    [38.8897, -77.0442, 64],    // low along the Reflecting Pool
    [38.8889, -77.0476, 64],    // the Lincoln Memorial ahead
    [38.8869, -77.0488, 68],    // round its south side
    [38.8850, -77.0463, 72],    // over West Potomac Park
    [38.8838, -77.0422, 75],
    [38.8826, -77.0382, 78],    // the portal over the Tidal Basin, the Jefferson Memorial ahead
  ],
  focus: [
    [0.06, 38.88990, -77.00910, 85],    // the Capitol dome
    [0.18, 38.88990, -77.00910, 85],
    [0.30, 38.88950, -77.03530, 120],   // the Washington Monument
    [0.46, 38.88950, -77.03530, 110],
    [0.53, 38.89770, -77.03650, 15],    // the White House
    [0.58, 38.89770, -77.03650, 15],
    [0.66, 38.88930, -77.05020, 18],    // the Lincoln Memorial
    [0.76, 38.88930, -77.05020, 18],
  ],
};
