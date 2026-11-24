# Paris (real tiles) — progress notes

Round 1 (shot run 1): arc round the Eiffel Tower (Bir-Hakeim → SW → Champ de Mars → E → NE), then up the Seine:
Alma → Invalides → Pont Alexandre III / Grand Palais → Concorde → Orsay / Tuileries → Louvre → Pont Neuf → south arm,
portal facing Notre-Dame. Origin on the Seine (ground=72 m). Path 5237 m, 64 s, 16 points. lift = 0 everywhere.
Good: 0.02, 0.14, 0.20, 0.30 Eiffel Tower big in frame; 0.42 Grand Palais; 0.72 Louvre (Pavillon de Flore + courtyard);
0.98 Notre-Dame ahead (with its crane) in the portal view.
Weak: 0.08 too close to the tower (base fills frame, top cut); 0.50 camera looked straight down at the river (focus on the
Pont Alexandre III while directly above it); Champ de Mars tiles are smeared in Google's data (cannot fix, keep high);
blurry blob bottom-left of 0.98.
Changed: arc pushed out (~320 m min) and up to 150 m; Alexandre III key replaced by a second Grand Palais key (0.46);
portal stretch raised to 90–92 m.

Round 2 (shot run 2, --next new-york): path 5400 m, lift = 0. Eiffel Tower big at 0.08 / 0.12 / 0.20, Grand Palais 0.42,
Petit Palais 0.50, Tuileries + Orsay 0.62, Louvre courtyard 0.75, portal 0.985 in open air with Notre-Dame just below the
ring and New York inside. Weak: at 0.04 the tower was out of frame (focus not yet weighted in) and at 0.08 cut at the left
edge; Google's Champ de Mars tiles are smeared (visible as green/white blur in tower frames) — data, not fixable;
a blurry water patch bottom-centre of the portal frame.
Changed: start moved south-west (48.8540, 2.2873) so the first stretch heads towards the tower (it is ahead-left from the
first frame), then veers right into the arc (min distance ~350 m).

Round 3 (shot run 3, t 0.01–0.24 + overview): path 5385 m, lift = 0. Tower in frame from the first frame (0.01) and big
through 0.09 / 0.13 / 0.17 / 0.24, full height, never cut except briefly at the left edge at 0.05. Accepted.
Still weak: smeared Champ de Mars tiles in Google's data; Notre-Dame only appears at the portal (below the ring).
