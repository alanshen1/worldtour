// Tokyo, real: Google Photorealistic 3D Tiles. In low over the harbour and across the Rainbow Bridge, over Shibaura
// to Tokyo Tower, round it close by, past the Azabudai Hills tower and on towards Roppongi with Shinjuku's towers far ahead.
// The photographs are daytime: a warm dusk sky and tint are as near as a real Tokyo gets to the old night flight.
// (The kit-built night version lives on in git history.) File format: see src/cities/new-york.js.
export default {
  kind: 'tiles',
  lat: 35.6400, lon: 139.7640,   // the harbour inside the Rainbow Bridge (water, so the ground is sea level)
  duration: 62,
  look: {
    sky: { top: 0x34507f, horizon: 0xf3b98c, bottom: 0xb59a8c, haze: 0.5 },
    sun: { dir: [0.78, 0.18, -0.6], color: 0xffc38e, disc: 0xffd9b0, size: 0.0004 },
    fog: { color: 0xd8b9a4, density: 0.0002 },
    tint: 0xffe8d6, exposure: 1,
  },
  path: [
    [35.6262, 139.7668, 55],   // over the water off Odaiba, the Rainbow Bridge ahead
    [35.6290, 139.7662, 60],
    [35.6330, 139.7650, 80],
    [35.6365, 139.7634, 100],  // over the middle of the bridge, between its towers
    [35.6405, 139.7608, 130],  // the inner harbour, Shibaura ahead
    [35.6450, 139.7560, 180],
    [35.6500, 139.7515, 220],  // over Shiba, Tokyo Tower ahead
    [35.6545, 139.7493, 230],
    [35.6572, 139.7480, 230],  // round the tower's east side, above Zojo-ji
    [35.6605, 139.7468, 240],  // and its north side
    [35.6638, 139.7420, 270],  // past the Azabudai Hills tower
    [35.6658, 139.7378, 310],
    [35.6673, 139.7342, 330],  // the portal, Roppongi below, Shinjuku's towers far ahead
  ],
  focus: [
    [0.08, 35.6365, 139.7634, 60],    // the Rainbow Bridge
    [0.18, 35.6365, 139.7634, 60],
    [0.30, 35.65858, 139.74543, 200], // Tokyo Tower
    [0.62, 35.65858, 139.74543, 200],
    [0.70, 35.6604, 139.7400, 250],   // Azabudai Hills Mori JP Tower
    [0.78, 35.6900, 139.6920, 200],   // Shinjuku
  ],
};
