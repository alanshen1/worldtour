// Sydney, real: Google Photorealistic 3D Tiles. In across the harbour past Fort Denison, a close arc round the
// Opera House sails on Bennelong Point, into Sydney Cove with Circular Quay and the CBD towers ahead, up past the
// south pylons and along the top of the Harbour Bridge arch, then over Kirribilli and out over the harbour.
// The format is described in src/cities/new-york.js (the kit-built version lives on in git history).
export default {
  kind: 'tiles',
  lat: -33.8585, lon: 151.2110,   // the water of Sydney Cove, so every alt is metres above the harbour
  duration: 60,
  look: {
    // a clear, bright harbour afternoon; the sun stands in the north-west (southern hemisphere)
    sky: { top: 0x2f6fc8, horizon: 0xd8e6f2, bottom: 0xa9bfd0, haze: 0.4 },
    sun: { dir: [-0.55, 0.5, -0.67], color: 0xfff0d8, disc: 0xfff4e0, size: 0.0004 },
    fog: { color: 0xcfdbe6, density: 0.00014 },
    tint: 0xfff8ee, exposure: 1,
  },
  path: [
    [-33.8528, 151.2290, 65],   // mid-harbour, east of Fort Denison, heading west: skyline, sails and arch ahead
    [-33.8536, 151.2250, 60],   // north of Fort Denison
    [-33.8546, 151.2208, 52],
    [-33.8552, 151.2176, 46],   // the Opera House sails ahead on the left
    [-33.8552, 151.2152, 44],   // round the northern tip of Bennelong Point
    [-33.8561, 151.2132, 45],
    [-33.8580, 151.2120, 50],   // into Sydney Cove, mid-cove, the sails on the left
    [-33.8600, 151.2112, 65],   // Circular Quay and the CBD towers ahead
    [-33.8597, 151.2090, 90],   // turning over Campbells Cove
    [-33.8572, 151.2092, 120],  // past the south pylons at Dawes Point
    [-33.8545, 151.2101, 155],  // up along the arch
    [-33.8523, 151.2110, 165],  // over the crest of the arch
    [-33.8503, 151.2112, 150],  // down the northern half
    [-33.8490, 151.2092, 130],  // turning west over Milsons Point
    [-33.8498, 151.2066, 110],  // over Lavender Bay, Luna Park below
    [-33.8516, 151.2045, 95],
    [-33.8535, 151.2035, 85],
    [-33.8554, 151.2028, 80],   // the portal, over the harbour, Barangaroo and Crown Sydney ahead
  ],
  focus: [
    [0.10, -33.8568, 151.2153, 35],   // the Opera House
    [0.38, -33.8568, 151.2153, 35],
    [0.47, -33.8655, 151.2100, 110],  // Circular Quay and the CBD towers behind it
    [0.51, -33.8655, 151.2100, 110],
    [0.58, -33.8523, 151.2106, 125],  // the crest of the arch
    [0.64, -33.8523, 151.2106, 125],
    [0.70, -33.8494, 151.2118, 60],   // along the arch: its northern half and the north pylons below ahead
    [0.78, -33.8614, 151.2017, 180],  // Crown Sydney at Barangaroo
  ],
};
