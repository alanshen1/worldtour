Dubai — round 4 (final)
- Flight: in over the Palm Jumeirah fronds -> past the Burj Al Arab side-on -> inland down the Sheikh Zayed Road canyon (traffic, metro) past the Museum of the Future -> over the Dubai Fountain -> 1.3 turns of climbing spiral round the Burj Khalifa -> out at ~480 m facing the low sun over the Gulf, Burj Al Arab and Palm below.
- Round 3/4: stars removed, smaller orange sun, museum ring turned to face the approach, BAA restaurant in white, dune mesh lighter (build 2.3 s -> ~1.8 s), path start pulled in (5028 -> 4874 m).
- Stats (tools/shot.mjs, --next none): 47-63 calls, 153-160k tris, build 1744-1822 ms, path 4874 m, exit 0. With New York in the portal: up to 164 calls / 512k tris.
- Still weak: Dubai Frame is built but never framed by the camera; low-rise between coast and SZR is plain boxes; Museum of the Future is seen only obliquely and small; fountain is point sprites; at u~0.75 the Burj is alone against empty sky.

## 2026-11-24 real-city attempt (Google Photorealistic 3D Tiles)
- Round 1 (1 shot run): wrote a real route (Sheikh Zayed Road at 400 m -> Dubai Mall -> fountain lake -> climbing spiral round the Burj Khalifa -> out WNW at 650 m, 6.4 km). Result: Google serves NO 3D mesh for Dubai, only flat imagery draped on the terrain (buildings are painted shadows, ~10k triangles a frame), and the Burj Khalifa is simply not there (frames aimed at it show empty sky). ground=-29 m.
- Decision: kept the kit-built dubai.js (reverted), as HANDOFF says for cities without 3D coverage.
