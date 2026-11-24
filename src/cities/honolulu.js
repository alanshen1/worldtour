// Honolulu, real: Google Photorealistic 3D Tiles. In low over the surf off Waikiki Beach, past its hotels and the pink
// Royal Hawaiian, along Kapiʻolani Park, then up onto Diamond Head: across the crater and round its rim, and out over
// the sea off the lighthouse and back along the shore with the Waikiki skyline ahead. See new-york.js for what each field means.
// Diamond Head's rim stands up to ~230 m above the sea: the origin is on the beach, so heights there are about that.
export default {
  kind: 'tiles',
  lat: 21.2700, lon: -157.8220,   // the beach at Kapiʻolani Park
  duration: 60,
  look: {
    sky: { top: 0x2f78d0, horizon: 0xd6ecf6, bottom: 0x9cc7dc, haze: 0.45 },
    sun: { dir: [0.45, 0.72, -0.35], color: 0xfff2d8, disc: 0xfff8e8, size: 0.0004 },
    fog: { color: 0xcfe4ef, density: 0.00013 },
    tint: 0xfff6ea, exposure: 1,
  },
  path: [
    [21.2760, -157.8375, 50],   // over the surf off Waikiki Beach, heading east
    [21.2751, -157.8345, 55],
    [21.2742, -157.8305, 60],   // off the Royal Hawaiian
    [21.2730, -157.8258, 65],   // off the Moana Surfrider and Kuhio Beach
    [21.2703, -157.8238, 80],
    [21.2665, -157.8218, 110],  // off Kapiʻolani Park, Diamond Head ahead
    [21.2640, -157.8165, 190],
    [21.2628, -157.8112, 280],  // up over the western rim, by the Lēʻahi summit
    [21.2648, -157.8050, 300],  // across the crater
    [21.2612, -157.7998, 285],  // over the eastern rim
    [21.2550, -157.8030, 260],  // out over the sea off the lighthouse, turning west
    [21.2549, -157.8085, 250],
    [21.2568, -157.8128, 240],  // turning north-west along the shore
    [21.2595, -157.8158, 230],  // the portal, Waikiki's skyline ahead
  ],
  focus: [
    [0.08, 21.2777, -157.8293, 25],    // the Royal Hawaiian
    [0.17, 21.2777, -157.8293, 25],
    [0.27, 21.2614, -157.8085, 180],   // Diamond Head, Lēʻahi summit
    [0.42, 21.2614, -157.8085, 180],
    [0.52, 21.2650, -157.8040, 60],    // down into the crater
    [0.64, 21.2650, -157.8040, 60],
    [0.72, 21.2780, -157.8280, 40],    // back along Waikiki
    [0.78, 21.2780, -157.8280, 40],
  ],
};
