// Rome, real: Google Photorealistic 3D Tiles. A low arc round the Colosseum, west over the Roman Forum under the
// Palatine, past the white Vittoriano on the Capitol, down to Tiber Island and up the river to Castel Sant'Angelo,
// then along Via della Conciliazione with St Peter's dome ahead of the portal. File format and rules: see new-york.js.
export default {
  kind: 'tiles',
  lat: 41.8860, lon: 12.4853,   // the grass of the Circus Maximus
  duration: 60,
  look: {
    sky: { top: 0x4a78b8, horizon: 0xf5d6a8, bottom: 0xcfb08a, haze: 0.5 },
    sun: { dir: [0.6, 0.4, -0.5], color: 0xffcf96, disc: 0xffe2b4, size: 0.0004 },
    fog: { color: 0xe6caa4, density: 0.0002 },
    tint: 0xfff0dc, exposure: 1.02,
  },
  path: [
    [41.8866, 12.4993, 75],    // over the Celian, south-east of the Colosseum, heading north-west
    [41.8891, 12.4955, 68],    // the low arc round the Colosseum's east side
    [41.8909, 12.4944, 66],
    [41.8921, 12.4924, 66],    // north of the Colosseum
    [41.8916, 12.4895, 66],    // the Temple of Venus and Roma
    [41.8922, 12.4862, 68],    // over the Forum, the Palatine to the left
    [41.8928, 12.4812, 120],   // over the Capitol, the Vittoriano to the right
    [41.8913, 12.4768, 70],    // down to Tiber Island
    [41.8913, 12.4737, 58],    // Ponte Garibaldi
    [41.8923, 12.4707, 58],    // Ponte Sisto
    [41.8948, 12.4678, 60],    // up the Tiber
    [41.8976, 12.4644, 60],
    [41.9000, 12.4640, 62],    // Castel Sant'Angelo ahead to the right
    [41.9016, 12.4636, 72],
    [41.9021, 12.4618, 88],    // into Via della Conciliazione
    [41.9022, 12.4594, 95],    // the portal, St Peter's dome ahead
  ],
  focus: [
    [0.08, 41.8902, 12.4922, 30],   // the Colosseum
    [0.2, 41.8902, 12.4922, 30],
    [0.27, 41.8920, 12.4870, 25],   // the Forum
    [0.33, 41.8947, 12.4832, 60],   // the Vittoriano
    [0.41, 41.8947, 12.4832, 60],
    [0.47, 41.8906, 12.4775, 10],   // Tiber Island
    [0.56, 41.8960, 12.4660, 20],   // up the river
    [0.64, 41.8990, 12.4640, 20],
    [0.72, 41.9031, 12.4663, 40],   // Castel Sant'Angelo
    [0.78, 41.9031, 12.4663, 40],
  ],
};
