// Budapest, real: Google Photorealistic 3D Tiles. Low down the Danube past the Hungarian Parliament, over the Chain Bridge,
// up round Buda Castle and along Castle Hill to the Fisherman's Bastion and Matthias Church, back across the river to
// St Stephen's Basilica, and down over Pest to the Danube by Elisabeth Bridge, under Gellért Hill and the Liberty
// Statue, to the portal.
// The origin is on the Danube, so every `alt` is roughly metres above the river: Castle Hill's top is about 60-70 m up,
// Matthias Church's spire about 140 m, Gellért Hill about 135 m.
export default {
  kind: 'tiles',
  lat: 47.5030, lon: 19.0425,   // the Danube between the Parliament and the Chain Bridge
  duration: 64,
  look: {
    sky: { top: 0x3c66ae, horizon: 0xf4cc9c, bottom: 0xbaa48e, haze: 0.5 },
    sun: { dir: [0.82, 0.22, -0.4], color: 0xffcc90, disc: 0xffe0b4, size: 0.0004 },
    fog: { color: 0xdcc6aa, density: 0.00017 },
    tint: 0xfff0de, exposure: 1,
  },
  path: [
    [47.5160, 19.0450, 60],    // over the Danube by Margaret Bridge
    [47.5115, 19.0432, 50],
    [47.5080, 19.0430, 45],    // the Parliament close on the left
    [47.5055, 19.0428, 45],
    [47.5000, 19.0420, 60],    // over the Chain Bridge
    [47.4975, 19.0412, 80],
    [47.4950, 19.0418, 115],   // up past the river front of Buda Castle
    [47.4945, 19.0372, 160],   // round the south end of Castle Hill
    [47.4985, 19.0365, 160],   // north along Castle Hill
    [47.5025, 19.0368, 150],   // the Fisherman's Bastion and Matthias Church on the left
    [47.5035, 19.0425, 130],   // back across the river
    [47.5024, 19.0490, 125],   // over Pest towards the Basilica
    [47.5005, 19.0518, 125],   // past St Stephen's Basilica on the left
    [47.4950, 19.0510, 120],   // over Pest down to the river
    [47.4905, 19.0485, 90],    // over Elisabeth Bridge, Gellért Hill on the right
    [47.4870, 19.0525, 80],    // the portal, down the Danube towards Liberty Bridge
  ],
  focus: [
    [0.08, 47.50710, 19.04560, 60],    // the Hungarian Parliament
    [0.23, 47.50710, 19.04560, 60],
    [0.29, 47.49890, 19.04360, 30],    // the Chain Bridge
    [0.35, 47.49620, 19.03970, 100],   // Buda Castle
    [0.46, 47.49620, 19.03970, 100],
    [0.51, 47.50200, 19.03450, 100],   // Matthias Church and the Fisherman's Bastion
    [0.61, 47.50200, 19.03450, 100],
    [0.63, 47.50090, 19.05390, 75],    // St Stephen's Basilica
    [0.72, 47.50090, 19.05390, 75],
    [0.78, 47.48650, 19.04700, 150],   // the Liberty Statue on Gellért Hill
  ],
};
