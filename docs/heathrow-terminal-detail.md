# Heathrow terminal presentation

The fixed airport-ground capture exposed large unarticulated terminal volumes.
`airportArchitecture()` in `src/terrain/london.js` adds glazing, structural
mullions, fascia, curved roof ribs, skylights, rooftop plant, paved aprons,
concrete joints and stand lead-in markings. These are original architectural
interpretations within the existing terminal layout, not surveyed Heathrow
terminal elevations or certified aircraft stand geometry.

All skin detail is one vertex-coloured mesh and all apron detail is a second
mesh. No per-window objects, new textures, external models, PBR passes or shadow
maps are introduced. Original runway endpoints, lengths, headings, navigation
records and flight equations are unchanged. Rooftop plant remains below the
existing conservative terminal collision ceiling; fine facade relief is visual.

The real-r128 geometry test first failed on the missing architecture, then passed
after implementation. It checks finite geometry, three material categories,
bounded height/triangle counts and at most 17 airport draw objects. The complete
suite passes 90 Node tests and 23 configuration/Android-evidence self-tests.
Actual GPU and physical-device performance require separate measurement.

The terminal comparison is `screenshots/london-v0.3/after/02-airport-ground.png`;
the same fixed camera shows the preceding plain terminal in the earlier PR
capture at commit `e0046849a36f4023011028c3ca0303fd8dbe9118`.
