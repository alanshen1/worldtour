// Barcelona, real (Google Photorealistic 3D Tiles), a warm Mediterranean afternoon: a close arc round the spires of
// the Sagrada Família, east over the chamfered blocks of the Eixample to Torre Glòries, south over Poblenou to the
// sea by the Port Olímpic twin towers, and along the beach to the portal off Barceloneta. The file format is explained
// in new-york.js. The ground falls about 35 m from the Sagrada Família to the sea; every alt is above the origin's
// ground at Glòries, so the Sagrada Família's own ground is near +35 and the beach near -13.
export default {
  kind: 'tiles',
  lat: 41.4030, lon: 2.1868,   // the park at Glòries
  duration: 62,
  look: {
    sky: { top: 0x3f78c8, horizon: 0xf4dcb4, bottom: 0xd2bc9c, haze: 0.5 },
    sun: { dir: [-0.62, 0.36, 0.7], color: 0xffd8a8, disc: 0xffe6c0, size: 0.00038 },
    fog: { color: 0xe8d4b8, density: 0.00015 },
    tint: 0xfff0dc, exposure: 1.02,
  },
  path: [
    [41.39985, 2.16658, 130],   // over the Eixample, the Sagrada Família ahead-right
    [41.40003, 2.16837, 128],
    [41.40120, 2.17161, 122],   // south-west of the basilica
    [41.40138, 2.17508, 120],   // south of it, by the Passion façade
    [41.40264, 2.17747, 120],   // south-east
    [41.40462, 2.17759, 125],   // east, the Nativity façade
    [41.40588, 2.18107, 135],   // away east over the Eixample
    [41.40500, 2.18600, 135],
    [41.40560, 2.18980, 145],   // beside Torre Glòries
    [41.40100, 2.19350, 120],   // turning south over Poblenou
    [41.39600, 2.19650, 110],
    [41.39150, 2.19950, 100],
    [41.38850, 2.20250, 85],    // the coast, the twin towers to the right
    [41.38550, 2.20100, 70],    // over the sea off the Port Olímpic
    [41.38280, 2.19750, 60],    // off the beach
    [41.38100, 2.19550, 60],    // the portal, Barceloneta beach and Montjuïc ahead
  ],
  focus: [
    [0.08, 41.40363, 2.17436, 115],   // the Sagrada Família
    [0.27, 41.40363, 2.17436, 115],
    [0.38, 41.40340, 2.18970, 100],   // Torre Glòries
    [0.50, 41.40340, 2.18970, 100],
    [0.62, 41.38740, 2.19720, 90],    // the Port Olímpic twin towers
    [0.76, 41.38740, 2.19720, 90],
    [0.78, 41.37800, 2.19300, 0],     // Barceloneta beach
  ],
};
