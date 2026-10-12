# L8-D1 district review

Scope: geometry portions of E30-AC05, E30-AC06 and E30-AC12. L8-D2 owns healthy animal/staff/APC variants and occluded maintenance outlets; encounter/escape lanes own population, calm timer, conversion, boarding and campaign handover. These district fixtures do not claim those later criteria.

The before image shows the old road-cross scaffold at night. The after path sheets use the game's isometric camera/FOV at a wider review distance, visiting gorilla, lion, elephant, zebra, flamingo pond, ticket pavilions, staff/service yard and the southeast masonry corner. Warm working lamps contrast with cool moonlight. The paths and intact facilities have no pre-dressed corpses, blood or wrecks at W0. The habitat interiors are deliberately awaiting the normal population/variants lane.

The walk sheets use the ordinary game framing. The courier stays visible, faces west while moving west and follows the clear public path; her shoes and nearby lamps/fences stay grounded. No actor/prop piercing or hard static clipping remains after moving the staff lodge off the fence. No visible motion jitter or invisible-but-active courier was observed. This lane has no attack telegraph; readability of animal specials belongs to their move fixtures.

The perimeter has substantial masonry courses, plinth, coping and capped piers, with continuous four-metre collision and sight boxes on all four faces. The southeast corner visibly joins without a hole. Tests flood from four exterior positions and reject all interior arrival/animal/vehicle destinations, and the production combat/perception query rejects sight through each wall.

Five enclosure zones expose animal centres and two six-metre fence openings each. Five-metre public paths form connected loops, with a separate staff/service strip and eight-metre arrival/vehicle approaches. Tests sample every path at its centre and ±1.25 m, including the capsule margin in baked navigation, and remove every individual public edge to check alternate escape connections. W0 geometry is shared by high/low quality; L8 outbreak damage must remain live at W0.

Review evidence is the retained before/after set linked from report.md. Full E30 vision scoring, normal/infected continuity, breach visibility, crowded sanctuary and armored departure remain with the named later lanes; no whole-epic completion claim is made here.

## Handover

Keep L8 at W0 through the outbreak and apply damage live. The old E10 W1–W5 wreck/light probes remain available for district regression; they are not L8's outbreak dressing. `L8-zoo` reuses L6's cool moonlight and powered E25 practical weights, with no mandatory blackout.

Use `arrival` / `player-start` at [0,70] and `exit` (armored vehicle point) at [96,74]. Public paths have five-metre lanes; arrival/vehicle approaches have eight-metre lanes. Each species has `enclosure-<species>` (zone), `animal-<species>` (walkable default spawn) and `<species>-gate-north/south` (two six-metre openings). Flamingo's default spawn is the walkable shore [-10,-32], leaving the pond excluded from foot navigation. Maintenance anchors are `maintenance--104`, `maintenance-104`, `maintenance-0`, at [-97,-32], [111,-32], [7,48]; D2 must author their connected occluded outlet interiors. Pair targets are `pair-zoo-gate`, `pair-zoo-lion`, `pair-zoo-gorilla`, `pair-zoo-service-yard`; `l8-safe-paths` is the central public junction.

The renderer now culls 24-metre masonry batches using ordinary mesh bounds, preserving all courses, coping and piers. The Scene Lab crop retains authored masonry collision and pond exclusions, and ignores compound colliders belonging to filtered-out placements. Its shoe-depth calibration uses character-local height, avoiding a paused spawn/floor offset entering the asset measurement. Native timing explicitly uses the existing E18 Chrome/no-vsync method; normal Scene Lab captures retain their usual launch settings.

Full unit 854/854, focused checks 19/19 and both district perf tiers pass. Broader browser verification has four failures in L1 controls, save racks and L1 crowd/WebGPU smoke; the controls timeout also occurs on the untouched starting commit. Full E30/whole-campaign verification remains incomplete; D1 does not alter those systems or weaken their gates.
