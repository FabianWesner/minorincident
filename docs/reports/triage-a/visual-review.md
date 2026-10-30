# Current visual and campaign review

## What ran

Native headless browsers through the shared pool, private ports 4381–4383. Real-input tour: `E2E_PORT=4381 npm run playtest -- --levels L1-L5 --mode continue --quality low --zoom 1.5 --level-minutes 8 --no-skip --out docs/reports/triage-a/playtest`. L1 starts a new game; L2–L5 use the actual Continue save after the preceding completion. No objective skips, god mode or position recovery in this tour. The one counted L2 assist is a preplanned route driven by physical WASD, explicitly logged as no objective/world writes. Navigation planning also uses the driver's existing nav-follow observations.

| Level | Finished / wall seconds | Deaths | Review |
|---|---|---|---|
| L1 | yes / 143 | 1 | Delivery → outbreak → bat → fire-station shelter. Courier, corgi, doors and destination HUD remain identifiable; actual retry reaches the station. |
| L2 | yes / 154 | 1 | Axe, crew ride, market release, separated street escape encounters and bridge handover. Actual route contains the Q-168 population. Fire truck, street props and crowd remain distinct. |
| L3 | yes / 212 | 0 | Handgun and police defence lead into the retreat and army checkpoint. Ramp/deck joins and route arrow remain visible; the low parapet quality concern stays #92. |
| L4 | yes / 268 | 0 | Convoy → quartermaster → announced breaches → line collapse → cellar. Mixed live figures and complete bodies remain legible in the plaza; the courier escapes the actual route. Tent reveal is not certified by this tour (Q-229). |
| L5 | yes / 182 | 3 | Hours-later cellar, all five discoveries and Metro shutter lead into L6. Four survivors are rescued (Dale, Rosa, Mr. Okafor, Sam); losses are allowed. The starting set still exposes bare ground (#35); Metro crowding/shaft art remains Q-145. |

Reviewed all five retained `playtest/contact-L*.jpg` sheets (every periodic/result capture), with additional full-size L1, L4, targeted street and ending views. Per-level completion JSON retains completed mandatory steps, carried racks and results; five run JSON files retain deaths and assists. Load cards occur at handovers rather than a blank stuck game; this tour is not a quiet-window cold-load benchmark. Existing load tickets are classified from their measured historical receipts, not these contended frame timings.

The raw driver emits one P2, `enemy-unhittable` in L5 at tick 3840. Its own nearby observations select `ability.corgi-lure`, a zero-damage ability. The same selection carried from the L4 exit. This is a driver diagnostic false positive, not evidence of an invulnerable infected. The raw issue and capture are retained. Three L5 deaths and retry progress are also retained; no difficulty change was made to improve this run.

## Story continuity

The displayed briefings and event progression are coherent through this lane's boundary: a cold-chain delivery reaches the Medical Annex; the outbreak drives the courier into Fire Station 3; the rescue fails at the market; police and then the Fairhaven military line fail; the cellar bridges the time jump into the ruined city; searching for people leads to the Metro and the L6 extraction plan. Current Continue uses each preceding save and preserves carried weapons. This is an L1–L5 continuity review, not an L6–L10 story acceptance claim.

## Figures, movement and surfaces

- Viewed `review-figures-webgl2-low` gear walk/run/180-degree turn and swing sheets, with full-size frames 220 and 330. Backpack, gloves, goggles and ponytail stay attached in these samples; all four diagnostic scene checks pass. The dog trot sheet retains attached legs and grounded paws. The 3 m zebra kick remains an extreme cropped topology inspection, not proof that every previously reported sliver is repaired (Q-175 stays open).
- The gate covers both backends and tiers, including crowd walking/sitting/turning, dog motion, courier weapons, corpse bodies and occlusion. Representative reviewed sheets include low close corpses, high Alpha corpse, courier turns and tier-4 gear. Numerical 48/48 success is separate from artistic approval; open look issues remain in the ledger.
- Viewed both exact-location supermarket/pharmacy cuts in `review-environment-webgl2-low`: roofs have a surface rather than the old black token and the vertical foot band is removed. Both existing gates pass. The current Metro sheet still crowds the survivors and exposes its bare red shaft. The post-emergence cellar-return street is dressed; the actual L5 starting-set image is a different shot and remains open.
- Viewed `review-corpses-webgl2-low/L4.png` and `L8-zoo.png`. The diagnostic copies the full healthy appearance onto infected controls before setting explicit dead states. Clothes and bodies persist, with infected skin/eye cues distinct; lower-body separation remains weak at night. These synthetic controls do not establish the real kill-path appearance for every figure. Q-247 retains that follow-up.
- Reviewed every fix's linked before/after or focused capture: vehicle lesson, boarding HUD, L2 route, EVAC letters, phone Home and both square-gore presets. The gore root cause was full-bright red box gibs, reproduced by real launcher damage. Shaded faceted clots fix that shape; the independent blood alpha diagnostic already showed irregular ground splats.
- Viewed `tank/shot-0180.png` from the existing production tank fixture: hull/track remain on the road side of the military wall, with zero overlap/error checks. This fixture advances the route to its firing post before sampling; the retained route guard supplies the path check, not a claim that this still shows the whole drive.
- The shotgun sheet and per-frame trace reproduce #54: sim x changes 0→1.8 m at frame 7, then death-back plays at that endpoint. A shared swept-path presentation fix is proposed in the ledger; no combat or collision semantics were changed here.

## Limits retained for follow-up

The ledger deliberately leaves #35, #54, #92, Q-145, Q-153, Q-174, Q-175, Q-229, Q-231, Q-241 and Q-247 open, with evidence, the known or suspected cause, and the next fix. They need authored asset/layout work, coupled collision/animation/identity review, or an intermittent reproduction. This triage does not claim the game is free of visual defects. L5 balance, production camera framing values and corpse persistence are unchanged; no test files or test cases were added.
