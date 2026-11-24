// Auckland, real: Google Photorealistic 3D Tiles. In low over the Waitematā Harbour and across the Harbour Bridge,
// past the Westhaven marina and over the Wynyard Quarter and the Viaduct, up into a close arc round the Sky Tower's
// pod, then down over Britomart and the port and out across the harbour towards Devonport, North Head and Rangitoto.
// The format is described in src/cities/new-york.js (the kit-built version lives on in git history).
export default {
  kind: 'tiles',
  lat: -36.8430, lon: 174.7597,   // the water of Viaduct Harbour, so every alt is metres above the sea
  duration: 64,
  look: {
    // a fresh, breezy sea-light morning: clean blue sky, light sea haze, the sun in the north-east
    sky: { top: 0x3c78c4, horizon: 0xd6e8ef, bottom: 0xa4c2cc, haze: 0.45 },
    sun: { dir: [0.55, 0.48, -0.68], color: 0xfff4e4, disc: 0xfff8ec, size: 0.00035 },
    fog: { color: 0xc8dce4, density: 0.00011 },
    tint: 0xf4f8ff, exposure: 1,
  },
  path: [
    [-36.8268, 174.7412, 75],   // over the harbour just west of the bridge, heading for the city
    [-36.8282, 174.7448, 82],   // over the bridge, close to its main span
    [-36.8310, 174.7492, 75],
    [-36.8350, 174.7532, 70],   // past the Westhaven marina
    [-36.8382, 174.7563, 70],   // Wynyard Point
    [-36.8407, 174.7578, 75],   // over the Wynyard Quarter
    [-36.8430, 174.7592, 95],   // over the Viaduct
    [-36.8452, 174.7598, 150],  // climbing towards the Sky Tower
    [-36.8471, 174.7600, 215],
    [-36.8487, 174.7601, 238],  // round the pod: west
    [-36.8502, 174.7612, 242],  // south-west
    [-36.8501, 174.7634, 240],  // south-east
    [-36.8484, 174.7645, 232],  // east
    [-36.8462, 174.7668, 215],
    [-36.8438, 174.7705, 180],  // over Britomart and the Ferry Building
    [-36.8412, 174.7760, 120],  // over the port, out to sea
    [-36.8385, 174.7820, 80],
    [-36.8362, 174.7875, 75],   // the portal, mid-harbour, Devonport, North Head and Rangitoto ahead
  ],
  focus: [
    [0.14, -36.84846, 174.76218, 230], // the Sky Tower over the CBD
    [0.46, -36.84846, 174.76218, 230],
    [0.52, -36.84846, 174.76218, 225], // the pod, close
    [0.62, -36.84846, 174.76218, 225],
    [0.70, -36.7870, 174.8600, 150],   // Rangitoto across the harbour
    [0.78, -36.7870, 174.8600, 150],
  ],
};
