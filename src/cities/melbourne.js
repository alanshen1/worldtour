// Melbourne, real: Google Photorealistic 3D Tiles. In up the Yarra past Birrarung Marr with Federation Square and
// Flinders Street Station on the right, over Princes Bridge, along Southbank under the Eureka Tower, then up over the
// CBD grid, east over Parliament and the Fitzroy Gardens, round the MCG and out with the skyline ahead.
// The format is described in src/cities/new-york.js (the kit-built version lives on in git history).
export default {
  kind: 'tiles',
  lat: -37.8203, lon: 144.9700,   // the Yarra beside Federation Square, so every alt is metres above the river
  duration: 62,
  look: {
    // a cool, soft Melbourne morning: pale sky, a little haze, the sun low in the north-east
    sky: { top: 0x5f82ad, horizon: 0xdfe4ea, bottom: 0xb4bcc6, haze: 0.5 },
    sun: { dir: [0.62, 0.42, -0.66], color: 0xfff2e2, disc: 0xfff6ea, size: 0.00035 },
    fog: { color: 0xcdd5de, density: 0.0002 },
    tint: 0xeef2fc, exposure: 1,
  },
  path: [
    [-37.8222, 144.9775, 60],   // over the Yarra by Birrarung Marr, heading upstream
    [-37.8213, 144.9745, 55],
    [-37.8206, 144.9715, 50],   // Federation Square on the right
    [-37.8199, 144.9685, 50],   // over Princes Bridge, Flinders Street Station ahead right
    [-37.8196, 144.9655, 55],   // over the river, Southbank on the left, the Eureka Tower above it
    [-37.8201, 144.9627, 65],
    [-37.8195, 144.9603, 90],   // turning north at Queens Bridge
    [-37.8175, 144.9615, 160],  // climbing over the CBD grid
    [-37.8150, 144.9640, 220],
    [-37.8135, 144.9675, 230],  // over Swanston Street
    [-37.8130, 144.9715, 235],
    [-37.8138, 144.9752, 210],  // Parliament on the left
    [-37.8158, 144.9788, 160],  // over the Fitzroy Gardens
    [-37.8172, 144.9822, 120],  // Yarra Park, the MCG ahead
    [-37.8182, 144.9862, 110],  // round the MCG's east side
    [-37.8208, 144.9880, 105],
    [-37.8230, 144.9862, 100],
    [-37.8238, 144.9832, 95],   // south of the MCG, heading west
    [-37.8240, 144.9800, 95],   // the portal, the CBD skyline ahead
  ],
  focus: [
    [0.06, -37.8180, 144.9690, 30],   // Federation Square
    [0.10, -37.8180, 144.9690, 30],
    [0.15, -37.8183, 144.9671, 30],   // Flinders Street Station's dome and clock
    [0.18, -37.8183, 144.9671, 30],
    [0.23, -37.8219, 144.9644, 110],  // the Eureka Tower
    [0.28, -37.8219, 144.9644, 130],
    [0.37, -37.8140, 144.9655, 60],   // down into the CBD grid
    [0.50, -37.8128, 144.9720, 60],
    [0.62, -37.8200, 144.9834, 30],   // the MCG
    [0.78, -37.8200, 144.9834, 30],
  ],
};
