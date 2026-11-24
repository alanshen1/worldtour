// Fukuoka, real: Google Photorealistic 3D Tiles. In over Hakata Bay to Marizon and the beach at Momochi, round the
// mirror-glass Fukuoka Tower, over the PayPay Dome, Ohori Park and the castle ruins, across Tenjin, then low down the
// Naka River between Tenjin and Nakasu towards the bay. The airport keeps Fukuoka's towers low, so the flight can stay low too.
// (The kit-built dusk version lives on in git history.) File format: see src/cities/new-york.js.
export default {
  kind: 'tiles',
  lat: 33.6000, lon: 130.3560,   // Hakata Bay off Momochi beach (water, so the ground is sea level)
  duration: 64,
  look: {
    sky: { top: 0x4a6fa8, horizon: 0xf6c49a, bottom: 0xc0a48e, haze: 0.45 },
    sun: { dir: [-0.85, 0.2, 0.48], color: 0xffcb98, disc: 0xffe2bd, size: 0.00035 },
    fog: { color: 0xdec3aa, density: 0.00017 },
    tint: 0xfff0e0, exposure: 1,
  },
  path: [
    [33.6008, 130.3482, 50],   // over Hakata Bay, Marizon and Fukuoka Tower ahead
    [33.5997, 130.3489, 55],
    [33.5982, 130.3497, 70],   // past Marizon's pier
    [33.5962, 130.3500, 110],  // over the beach, round the tower's west side
    [33.5935, 130.3492, 140],
    [33.5915, 130.3512, 150],  // south of the tower
    [33.5930, 130.3560, 150],  // turning east, the Dome ahead
    [33.5950, 130.3622, 140],  // over the PayPay Dome
    [33.5915, 130.3700, 130],
    [33.5878, 130.3765, 110],  // over the pond of Ohori Park
    [33.5872, 130.3850, 120],  // the castle ruins on the right
    [33.5888, 130.3950, 125],  // over Tenjin
    [33.5903, 130.3998, 120],
    [33.5925, 130.4013, 105],  // over the Naka River, Nakasu on the right
    [33.5950, 130.4011, 65],   // down low over the water
    [33.5978, 130.4003, 60],   // the portal over the river, Hakata Port Tower ahead
  ],
  focus: [
    [0.08, 33.5975, 130.3528, 20],     // Marizon
    [0.11, 33.59327, 130.35153, 150],  // Fukuoka Tower
    [0.21, 33.59327, 130.35153, 150],
    [0.27, 33.5954, 130.3620, 40],     // the PayPay Dome
    [0.32, 33.5954, 130.3620, 40],
    [0.42, 33.5860, 130.3765, 0],      // Ohori Park's pond
    [0.52, 33.5860, 130.3765, 0],
    [0.62, 33.5845, 130.3830, 20],     // Fukuoka Castle ruins
    [0.74, 33.5940, 130.4045, 30],     // Nakasu
    [0.78, 33.6040, 130.4040, 60],     // Hakata Port Tower, at the river mouth
  ],
};
