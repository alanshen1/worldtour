# Cape Town (real, Google Photorealistic 3D Tiles) — replaces Dubai

## Round 1 (1 shot run, also the coverage probe)
- Coverage: YES. Real 3D meshes: V&A Waterfront hotels, warehouses, boats and CBD towers are solid; Table Mountain, Lion's Head and Signal Hill are full terrain meshes (80-240k tris a frame).
- Testing note: tools/shot.mjs only flies cities listed in src/cities/index.js (otherwise it falls back to New York), and index.js is the coordinator's. So shots are taken from a scratch copy of the site with a test-only index entry; the repo's index.js is untouched.
- Route: V&A basins at 85 m -> Bo-Kaap -> city bowl -> up the front of Table Mountain -> over the top edge -> across the plateau, portal at its western end heading west. 6.7 km, lift 0 everywhere. ground=37 m: the origin hit a roof, so moved the origin onto the basin water.
- Frames: 0.03 marina + Table Mountain/Devil's Peak/Lion's Head behind (great); 0.10 V&A basins; 0.20 CBD + Bo-Kaap; 0.30-0.42 Signal Hill, Lion's Head; 0.52-0.72 Table Mountain's front fills the frame, Devil's Peak at 0.62.
- Weak: portal looked WSW at mostly open sea; sky lavender.
- Round 2 changes: start moved onto the basins (path 6.9 km), the climb shifted west so the last leg turns right across the plateau's western end and descends towards Camps Bay; focus re-timed (no key pointing behind the camera); bluer sky.

## Round 2 (1 shot run with --next new-york)
- 6.9 km, 64 s, lift 0 everywhere, exit 0. ground=32 m at the basin water (that is the geoid offset here, so alts are metres above the sea).
- Frames: 0.02 V&A marina with Table Mountain, Devil's Peak, Lion's Head and Signal Hill behind (excellent); 0.28 Signal Hill; 0.37 Lion's Head; 0.46 Table Mountain's whole front; 0.55-0.65 Devil's Peak and the front cliffs; 0.74 the cliff top and Twelve Apostles; portal in open air with New York in the ring.
- Weak: 0.08 marina focus pointed at a motorway; 0.18 looked straight down on Bo-Kaap; the last 15% looked west at open sea.
- Round 3 changes: marina key dropped, Bo-Kaap key moved earlier (0.08-0.15) so it is seen ahead; the portal turned north-west (bearing ~327) so Lion's Head and the Clifton/Camps Bay coast are in the last frames.

## Round 3 (1 shot run with --next new-york; final)
- 6.9 km (6894 m printed), 64 s, lift 0 everywhere, exit 0.
- Frames: 0.04 V&A + city with Table Mountain, Devil's Peak, Lion's Head and Signal Hill; 0.10-0.15 the CBD and Bo-Kaap ahead under Table Mountain; 0.82 over the plateau; 0.93 Camps Bay below right; 0.985 portal in open air, New York in the ring, Lion's Head, Camps Bay/Clifton and Green Point below.
- After the run: sun direction corrected for the tiles axes (+x west, +z north) to a north-west afternoon sun (also fixed in honolulu.js and rio.js); this only moves the sky's sun disc (the photos are unlit).
- Still weak: 0.82-0.88 is mostly sky and plateau rock; the cable car is not singled out.
