Round 4 (korea.js = Seoul, considered done): roof overhangs trimmed, east-section halls sit on the terrain.
Flight: hanok roofs -> low past Gyeongbokgung throne hall and pond pavilion -> over Gwanghwamun -> Sejong-daero + Hangul sign street -> up Namsan round N Seoul Tower -> Han bridges -> Lotte World Tower behind the portal.
Stats: 63-145 calls, ~680k tris, build ~1.5-2.3 s (varies run to run), path 4333 m, duration 50 s. Portal framing checked.
Weak: palace small in frame and plain; sky pale; Bugaksan granite only a pale cap; max path slope 25 deg on the Namsan climb.
Next: rio.js, then vancouver.js.

Round 5 (2026-11-24, real-city coverage probe): NO usable Google 3D coverage. Kit-built seoul.js kept unchanged as the fallback.
Probe: origin Gwanghwamun (37.5759, 126.9769), camera 300 m up flying north from Seoul Station toward Gyeongbokgung, 1 shot run.
Only 3D terrain loads (Bugaksan/Bukhansan relief is real); the city is a flat photo, no buildings stand. Many detail tiles answer 404, which leaves a big flat grey slab across the city centre in the frame; ground measured 0 m (the ray hit nothing). shot.mjs exits 2 because of those 404 page errors.
