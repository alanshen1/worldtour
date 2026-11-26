// Singapore, real: Google Photorealistic 3D Tiles. Across Marina Bay to the Merlion under the CBD's towers, round past
// the Esplanade and the ArtScience Museum's lotus, down the face of Marina Bay Sands' three towers below the SkyPark,
// past the Supertrees and the glass domes of Gardens by the Bay, across the water and round the Singapore Flyer,
// with the Esplanade and the CBD ahead at the portal.
// The origin is on the water of Marina Bay, so every `alt` is roughly metres above the bay.
export default {
  kind: 'tiles',
  lat: 1.2850, lon: 103.8570,   // Marina Bay
  duration: 58,
  look: {
    sky: { top: 0x2a3f7c, horizon: 0xf4a27a, bottom: 0x9c8a8c, haze: 0.55 },
    sun: { dir: [0.9, 0.16, -0.12], color: 0xffb080, disc: 0xffd0a8, size: 0.0004 },
    fog: { color: 0xdcb8a8, density: 0.00024 },
    tint: 0xf6e6e0, exposure: 1,
  },
  path: [
    [1.2826, 103.8572, 70],    // over the bay, the CBD ahead
    [1.2850, 103.8560, 62],
    [1.2868, 103.8554, 55],    // the Merlion close on the left
    [1.2884, 103.8562, 60],
    [1.2893, 103.8580, 70],    // the Esplanade's spiky domes on the left
    [1.2884, 103.8598, 75],    // by the Helix Bridge
    [1.2870, 103.8584, 75],    // round the ArtScience Museum
    [1.2852, 103.8574, 110],
    [1.2834, 103.8576, 140],   // down the face of Marina Bay Sands
    [1.2814, 103.8586, 130],
    [1.2800, 103.8614, 100],
    [1.2808, 103.8650, 90],    // past the Supertree Grove
    [1.2836, 103.8668, 105],   // past the domes
    [1.2870, 103.8670, 120],   // across the water
    [1.2902, 103.8646, 130],   // round the Singapore Flyer
    [1.2902, 103.8617, 128],
    [1.2887, 103.8594, 112],   // the portal, the Esplanade and the CBD ahead
  ],
  focus: [
    [0.08, 1.28680, 103.85445, 15],    // the Merlion, the CBD towers behind it
    [0.14, 1.28680, 103.85445, 15],
    [0.19, 1.28980, 103.85550, 25],    // the Esplanade
    [0.23, 1.28980, 103.85550, 25],
    [0.28, 1.28630, 103.85930, 30],    // the ArtScience Museum
    [0.35, 1.28630, 103.85930, 30],
    [0.41, 1.28360, 103.86060, 140],   // Marina Bay Sands
    [0.49, 1.28300, 103.86060, 130],
    [0.56, 1.28160, 103.86370, 35],    // the Supertrees
    [0.63, 1.28160, 103.86370, 35],
    [0.69, 1.28400, 103.86480, 25],    // the domes
    [0.78, 1.28930, 103.86310, 80],    // the Singapore Flyer
  ],
};
