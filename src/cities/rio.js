// Rio de Janeiro, real: Google Photorealistic 3D Tiles. In high on Corcovado, straight at Christ the Redeemer and close
// round him, then down off the mountain with the lagoon and Copacabana off to the right, over Botafogo and out across
// Botafogo bay to the portal, with Sugarloaf Mountain and its cable car ahead. See new-york.js for what each field means.
// The origin is on Botafogo beach, at sea level, so every alt here is about metres above the sea: Corcovado's summit is
// ~710 m and the statue's head ~745 m; Sugarloaf's summit is ~396 m and Urca hill's ~220 m.
export default {
  kind: 'tiles',
  lat: -22.9455, lon: -43.1810,   // Botafogo beach
  duration: 60,
  look: {
    sky: { top: 0x3a7fd0, horizon: 0xf0e2c8, bottom: 0xb9c4c0, haze: 0.45 },
    sun: { dir: [-0.7, 0.42, -0.2], color: 0xffdcae, disc: 0xffe8c8, size: 0.0004 },
    fog: { color: 0xd8d6cc, density: 0.00016 },
    tint: 0xfff2e2, exposure: 1,
  },
  path: [
    [-22.9545, -43.2052, 770],   // east of Corcovado, high, flying at the statue's face
    [-22.9538, -43.2066, 765],
    [-22.9527, -43.2082, 755],
    [-22.9513, -43.2094, 748],   // close round its north side, ~130 m out
    [-22.9507, -43.2105, 746],
    [-22.9513, -43.2116, 746],   // behind it
    [-22.9525, -43.2116, 746],
    [-22.9531, -43.2105, 744],   // its south side, the lagoon below
    [-22.9536, -43.2082, 730],
    [-22.9545, -43.2050, 700],   // off the mountain, heading east
    [-22.9525, -43.1950, 560],
    [-22.9490, -43.1855, 420],   // over Botafogo
    [-22.9455, -43.1760, 330],   // Botafogo bay
    [-22.9440, -43.1690, 310],
    [-22.9443, -43.1650, 300],   // the portal, Sugarloaf and the cable car ahead to the right
  ],
  focus: [
    [0.08, -22.9519, -43.2105, 735],   // Christ the Redeemer, close round him
    [0.18, -22.9519, -43.2105, 735],
    [0.30, -22.9700, -43.1850, 20],    // Copacabana, beyond the hills to the right
    [0.44, -22.9700, -43.1850, 20],
    [0.56, -22.9440, -43.1720, 0],     // Botafogo bay
    [0.66, -22.9492, -43.1546, 330],   // Sugarloaf
    [0.78, -22.9492, -43.1546, 330],
  ],
};
