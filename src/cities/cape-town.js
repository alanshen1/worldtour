// Cape Town, real: Google Photorealistic 3D Tiles. In off Table Bay over the V&A Waterfront and its harbour, up across
// Bo-Kaap and the city bowl with Signal Hill and Lion's Head to the right and Devil's Peak to the left, up the front
// of Table Mountain and over its flat top, turning right across its western end to the portal above Camps Bay.
// See new-york.js for what each field means.
// The origin is on the Waterfront at sea level, so every alt is about metres above the sea: Table Mountain's top is
// ~1070 m, Devil's Peak ~1000 m, Lion's Head ~670 m and Signal Hill ~350 m.
export default {
  kind: 'tiles',
  lat: -33.9035, lon: 18.4225,   // the water of the V&A Waterfront
  duration: 64,
  look: {
    sky: { top: 0x3a7fd0, horizon: 0xf0e2c8, bottom: 0xb8c0c0, haze: 0.42 },
    sun: { dir: [0.62, 0.42, 0.66], color: 0xffd8a8, disc: 0xffe6c4, size: 0.0004 },
    fog: { color: 0xd6d8d4, density: 0.00015 },
    tint: 0xfff1e2, exposure: 1,
  },
  path: [
    [-33.9065, 18.4202, 90],     // over the Waterfront's basins, heading in
    [-33.9095, 18.4188, 105],
    [-33.9130, 18.4172, 140],
    [-33.9190, 18.4148, 210],    // over Bo-Kaap, Signal Hill to the right
    [-33.9260, 18.4105, 300],
    [-33.9330, 18.4055, 430],    // the city bowl below, Table Mountain ahead
    [-33.9400, 18.4010, 620],
    [-33.9460, 18.3975, 850],    // up the front of Table Mountain
    [-33.9510, 18.3955, 1050],
    [-33.9545, 18.3950, 1140],   // over the top edge, turning right
    [-33.9550, 18.3900, 1125],   // across the western end of the flat top
    [-33.9518, 18.3875, 1060],   // the portal, turning north-west: Lion's Head ahead right, Camps Bay below left
  ],
  focus: [
    [0.08, -33.9200, 18.4140, 40],     // Bo-Kaap's coloured houses, ahead
    [0.15, -33.9200, 18.4140, 40],
    [0.28, -33.9196, 18.4000, 300],    // Signal Hill, to the right
    [0.37, -33.9353, 18.3893, 600],    // Lion's Head
    [0.46, -33.9540, 18.4050, 1000],   // Table Mountain's front cliffs
    [0.55, -33.9536, 18.4384, 950],    // Devil's Peak, to the left
    [0.61, -33.9536, 18.4384, 950],
    [0.70, -33.9555, 18.3970, 1060],   // the cliff top ahead
    [0.78, -33.9555, 18.3970, 1060],
  ],
};
