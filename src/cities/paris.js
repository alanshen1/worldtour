// Paris, real (Google Photorealistic 3D Tiles), a rosy early evening: a close arc round the Eiffel Tower from
// the south-west over the Champ de Mars, then up the Seine past the Pont de l'Alma, the Grand Palais and the Pont
// Alexandre III, the Place de la Concorde, the Musée d'Orsay and the Louvre with its pyramid, over the Pont Neuf
// into the south arm, where the portal opens facing Notre-Dame. The file format is explained in new-york.js.
export default {
  kind: 'tiles',
  lat: 48.8636, lon: 2.3165,   // the Seine between the Pont Alexandre III and the Pont de la Concorde
  duration: 64,
  look: {
    sky: { top: 0x6a7fb8, horizon: 0xf3d2c0, bottom: 0xc7b0a4, haze: 0.42 },
    sun: { dir: [-0.85, 0.22, 0.45], color: 0xffcfa8, disc: 0xffdcc0, size: 0.0004 },
    fog: { color: 0xe2c9bc, density: 0.0002 },
    tint: 0xffefe4, exposure: 1,
  },
  path: [
    [48.8540, 2.2873, 125],    // over the 15th arrondissement, the tower ahead-left
    [48.8546, 2.2893, 127],
    [48.8550, 2.2925, 135],    // veering right, south-west of the tower
    [48.8553, 2.2965, 150],    // south of it, over the Champ de Mars
    [48.8575, 2.3003, 150],    // east of it
    [48.8604, 2.2988, 130],    // north-east, the tower now behind-left
    [48.8630, 2.3010, 110],    // the Seine at the Pont de l'Alma
    [48.8642, 2.3085, 90],     // the Pont des Invalides
    [48.8639, 2.3150, 85],     // over the Pont Alexandre III, the Grand Palais to the left
    [48.8627, 2.3232, 85],     // the Place de la Concorde to the left
    [48.8603, 2.3290, 90],     // the Musée d'Orsay to the right, the Tuileries to the left
    [48.8588, 2.3355, 95],     // the Pont des Arts, the Louvre and its pyramid to the left
    [48.8566, 2.3400, 95],     // over the Pont Neuf by the tip of the Île de la Cité
    [48.8552, 2.3418, 92],     // into the south arm
    [48.8544, 2.3432, 90],
    [48.8537, 2.3455, 90],     // the portal, Notre-Dame straight ahead
  ],
  focus: [
    [0.08, 48.85837, 2.29448, 170],   // the Eiffel Tower
    [0.26, 48.85837, 2.29448, 170],
    [0.38, 48.86610, 2.31250, 40],    // the Grand Palais, the Pont Alexandre III below it
    [0.46, 48.86610, 2.31250, 40],
    [0.64, 48.86110, 2.33580, 15],    // the Louvre pyramid
    [0.76, 48.86110, 2.33580, 15],
    [0.78, 48.85300, 2.34990, 50],    // Notre-Dame
  ],
};
