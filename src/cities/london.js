// London, real (Google Photorealistic 3D Tiles), a soft late afternoon: up the Thames from Lambeth Bridge past the
// Palace of Westminster and Big Ben, by the London Eye, round the bend under the Embankment, past St Paul's dome,
// the Shard on the south bank and the City towers with the Gherkin, to the portal in front of Tower Bridge.
// The flight keeps over the river, so it can stay low; the file format is explained in new-york.js.
export default {
  kind: 'tiles',
  lat: 51.5087, lon: -0.1100,   // the Thames between Waterloo and Blackfriars bridges
  duration: 62,
  look: {
    sky: { top: 0x5a7fb8, horizon: 0xe9d8c4, bottom: 0xb8ab9c, haze: 0.4 },
    sun: { dir: [-0.7, 0.3, 0.65], color: 0xffdcb0, disc: 0xffe6c4, size: 0.0004 },
    fog: { color: 0xd6cbbd, density: 0.00022 },
    tint: 0xfff3e6, exposure: 1,
  },
  path: [
    [51.4912, -0.1243, 65],    // over the river by Lambeth Palace, heading downstream
    [51.4926, -0.1240, 66],
    [51.4950, -0.1233, 70],    // Lambeth Bridge below
    [51.4985, -0.1225, 78],    // beside the Palace of Westminster
    [51.5006, -0.1215, 85],    // over Westminster Bridge, Big Ben to the left
    [51.5032, -0.1222, 105],   // the London Eye to the right
    [51.5062, -0.1205, 110],   // by Hungerford Bridge, the river turns east
    [51.5087, -0.1145, 100],   // Waterloo Bridge, Somerset House
    [51.5094, -0.1060, 110],   // towards Blackfriars
    [51.5097, -0.0985, 125],   // the Millennium Bridge: St Paul's to the left, Tate Modern to the right
    [51.5085, -0.0920, 120],
    [51.5077, -0.0868, 110],   // London Bridge: the Shard to the right, the City towers to the left
    [51.5071, -0.0822, 100],   // HMS Belfast below
    [51.5071, -0.0795, 90],    // the portal by the Tower of London, Tower Bridge ahead-right beside the ring
  ],
  focus: [
    [0.08, 51.50073, -0.12463, 75],   // Big Ben, the Elizabeth Tower
    [0.24, 51.50073, -0.12463, 75],
    [0.30, 51.50330, -0.11955, 70],   // the London Eye
    [0.36, 51.50330, -0.11955, 70],
    [0.54, 51.51381, -0.09840, 85],   // St Paul's dome
    [0.67, 51.51381, -0.09840, 85],
    [0.74, 51.50450, -0.08650, 170],  // the Shard (the Gherkin and the City towers stand ahead-left all the while)
    [0.78, 51.50550, -0.07536, 45],   // Tower Bridge
  ],
};
