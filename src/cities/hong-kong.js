// Hong Kong, real: Google Photorealistic 3D Tiles. Low west along Victoria Harbour between Kowloon and the island,
// past the convention centre and Central Plaza to the IFC, round the Bank of China Tower close by, then up over the
// Mid-Levels towards Victoria Peak and round to look back over the harbour.
// The photographs are daytime: a dusky sky and tint stand in for the harbour at evening.
// (The kit-built night version lives on in git history.) File format: see src/cities/new-york.js.
// The island rises steeply: every alt is metres above the harbour, not above the slope below.
export default {
  kind: 'tiles',
  lat: 22.2895, lon: 114.1680,   // the middle of Victoria Harbour (water, so the ground is sea level)
  duration: 62,
  look: {
    sky: { top: 0x3a5a8c, horizon: 0xf0b48e, bottom: 0xd4b4a2, haze: 0.5 },
    sun: { dir: [0.8, 0.2, -0.55], color: 0xffc08a, disc: 0xffd8ae, size: 0.0004 },
    fog: { color: 0xd4b4a2, density: 0.0002 },
    tint: 0xffe9da, exposure: 1,
  },
  path: [
    [22.2902, 114.1880, 50],   // over the harbour off Causeway Bay, heading west
    [22.2898, 114.1850, 50],
    [22.2885, 114.1790, 50],   // Kowloon on the right, Wan Chai on the left
    [22.2868, 114.1735, 55],   // past the wing roof of the convention centre
    [22.2870, 114.1680, 70],
    [22.2872, 114.1640, 120],  // Central ahead, the IFC towering on the right
    [22.2860, 114.1617, 200],  // past the IFC's east side, over the ferry piers
    [22.2830, 114.1626, 260],  // over City Hall, the Bank of China Tower ahead
    [22.2800, 114.1634, 290],  // round its east side
    [22.2777, 114.1625, 320],  // and its south side, over Hong Kong Park
    [22.2760, 114.1590, 380],  // up the Mid-Levels beside the Peak Tram
    [22.2748, 114.1552, 440],  // the Peak Tower ahead
    [22.2757, 114.1518, 470],  // turn right along the slope
    [22.2780, 114.1497, 470],
    [22.2806, 114.1490, 460],  // the portal, high over the Mid-Levels, the harbour and Kowloon ahead
  ],
  focus: [
    [0.08, 22.2802, 114.1736, 220],   // Central Plaza
    [0.18, 22.3033, 114.1600, 300],   // ICC across the harbour
    [0.28, 22.2853, 114.1588, 300],   // the IFC
    [0.45, 22.2853, 114.1588, 300],
    [0.53, 22.2793, 114.1615, 280],   // the Bank of China Tower
    [0.65, 22.2793, 114.1615, 280],
    [0.72, 22.2714, 114.1500, 420],   // the Peak Tower
    [0.78, 22.3033, 114.1600, 300],   // ICC across the harbour
  ],
};
