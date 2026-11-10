# r32-animalmoves: L8 animal signature moves (2026-11-10)

PO (2026-11-10 UAT, verbatim): "When the flamingos attacking, then they just slide in... So this is a movement bug" /
"AND also we discussed that each animal has a signature attack, but this red arrow and then coming fast is the same that any
alpha is doing. Super lame" / lion: "It's not only night fill, the entire movement is creepy" and "Also no special attacks and
no lion-like movements." / elephant during the lion arena: "This guy is not doing anything....".

Spec: docs/design/boss-and-alpha-moves.md (L8 table). The sim timings already matched the spec (flamingo dive 0.6 s,
zebra stampede 1 s, lion pounce 0.6 s, gorilla roar 1 s, elephant charge 0.9 s); no HP or damage number changed.

## What changed

Presentation (render only, never read by the sim):
- `src/render/characters/AnimalMoves.ts` (new): per-species pose layer, applied by `CrowdLocomotion.animalLayer`
  (hip crouch/pitch, torso roll, neck/head, jaw, trunk, fore/hind legs, gorilla arms, elephant foreleg stamp, flamingo
  wings). Airborne poses skip paw planting so the legs follow the leap/flight instead of being pinned to the floor.
- `src/render/CrowdView.ts`: samples AnimalMoves, adds the render height (flight / monkey leap and cling), a ground
  contact shadow under airborne animals, flamingo flight loop phase, zebra herd gallop + pawing telegraph on the authored
  `zebra-stampede` clip, a short recoil on every boss hit, the clinging monkey pulled onto the courier's flank.
- `src/render/vfx/Vfx.ts` + `FxPool.ts`: the shared red lane/arrow is gone for the animals. New warning shapes:
  11 = shadow line (flamingo dive, dark soft band darkening as the dive nears), 12 = churned dust lane (zebra stampede,
  elephant charge). Amber landing ring for the lion pounce/flank and the monkey leap. Time-based cues from the fixed-tick
  special: zebra pawing dust + rumble shake (1 s), elephant two foreleg stamps (ground thump ring + dust + shake), lion eye
  glint (two gold sparks at the eyes, start of crouch and just before the leap), dust trails behind charging zebras and
  the elephant, gorilla pound / lion landing shock ring + dust. Colourblind mode keeps the white warning colour.

| Animal | Telegraph (new) | Move / body (new) |
|---|---|---|
| Lion / lioness | low growl subtitle (existing), crouch + butt wiggle, eye glint, amber landing ring | low stalk (crouch, head low, shoulder roll), slower stalk speed 4 -> 3.2 m/s while hunting, leap arc 0.8 m (sim y in the arena, as the shared pounce already had) with forelegs reaching / hind legs stretched, landing dust ring, rear-up pin with snapping jaw, head-up roar, hit recoil |
| Flamingo flock | dark shadow line on the ground | real flight: cruise 2.4 m with wing beats (faster beats in the telegraph, climb +0.9 m), swoop down the lane to ~0.4 m and back up, legs tucked, ground shadow; dead birds fall |
| Zebra herd | pawing (authored stampede clip, weight back) + dust clouds + rumble 1 s, dust lane | herd gallop on the authored stampede loop whenever a zebra runs > 4.5 m/s, dust trail; rear-kick (existing authored clip) |
| Monkey pack | small crouch, amber landing ring | leap arc 1.1 m, visible cling on the courier's flank (lifted 0.75 m, limbs wrapped, body shaking, jaw), debris throw (existing throw pose) |
| Gorilla | chest-beat (existing layer) | pound: both arms high and rearing in the windup, full-body slam with ground shock ring + dust + shake |
| Elephant | trunk + head up (trumpet), two left-foreleg stamps with thump rings, dust lane | head down, trunk tucked while charging, dust trail; trunk swipe (existing) |

Sim (deterministic):
- `CharacterSeparation.ts`: long-bodied animals (lion .55, lioness .5, zebra .75, elephant .95, gorilla .25 m half-spine
  beyond the round body) measure contact from the closest point of their spine to the person, so the muzzle stops at
  contact instead of the courier standing inside the head or flank (P1-D).
- `L8BossArenas.ts`: the arena lion pounce/flank stops at muzzle contact (as the shared pounce does), hits at that contact,
  flies a 0.8 m arc and lands back on the ground; stalking (non-flank hunt) walks at 3.2 m/s.
- Elephant (PO "This guy is not doing anything"): `storyProtection.l8AnimalDormant` keeps the old elephant a living zoo
  animal until the gorilla arena is cleared: stray infected neither perceive/hunt (Perception, HumanTargets) nor bite him.
  His finale turn stays the arena carrier's scripted bite. Safety net for old saves where he already turned: he paces
  his fence line and rams it every 3.5 s instead of standing idle, and `HealthBars.barEligible` hides his bar until his
  fight engages.

## Verification

Scene Lab fixtures: `specs/scenes/r32-animalmoves/<animal>.json` (game camera following the animal at zoom 0.45 = close)
and `<animal>-game.json` (zoom 1.5), night `L8-zoo` light, generator `tools/qa/r32/gen_specs.py`. The in-run `--sheet`
closes the pooled browser context, so sheets were cut from the videos with `tools/qa/r32/sheet.sh` / ffmpeg tile.
Captures (not in git) under `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r32-animalmoves/`:
- before (base 4e93aff0 build, preview): `before/lion-game.jpg`, `before/lion-pounce.jpg`, videos `before/r32-lion*/video.webm`,
  `before/r32-flamingo-game/video.webm`.
- after: `after1/lion-game.jpg` (zoom 1.5), `after2/lion-pounce-crop.jpg` (side), `after3/<animal>-overview.jpg` and
  `after3/r32-<animal>/video.webm` for lion, flamingo, monkey, zebra, gorilla, elephant (close game camera).

What the captures show:
- Lion before (`before/lion-game.jpg`, zoom 1.5): red chevron lanes on every pounce, the lion ends overlapping the courier.
  After (`after1/lion-game.jpg`): no red lane; amber landing ring; dust ring at the landing; the lion stands beside her.
  Close (`after3/lion-overview.jpg`): walk-in, eye glint sparks over the crouching head (cell 4), landing next to her with the
  dust ring (cell 5), then standing at her side (not inside), head-up roar with open jaw (cell 7), recoil under MG fire.
  Side view (`after2/lion-pounce-crop.jpg`): forelegs reaching / hind legs stretched in the leap, crouched landing.
- Flamingo (`after3/flamingo-overview.jpg`): the flock flies above the courier with ground shadows; a shot bird falls to the
  ground. The Scene Lab path is the shared (non-arena) flock dive, whose sim already lifts the birds; the arena shadow line
  is not exercised by this fixture.
- Zebra (`after3/zebra-overview.jpg`): pawing dust before the stampede, dust trail while the herd gallops, rear-kick with the
  hind legs up; the herd surrounds the courier at contact distance.
- Elephant (`after3/elephant-overview.jpg`): tan dust lane and the stamp thump ring with dust puffs, dust trail on the charge;
  afterwards he stands beside the courier, not over her.
- Monkey (`after3/monkey-overview.jpg`): monkeys hang on the courier's flank (lifted, shaking) instead of a frozen idle pose
  standing in her.
- Gorilla (`after3/gorilla-overview.jpg`): from the close top camera the pound reads poorly (mostly a dark blob); the end
  frames still show the gorilla's arm overlapping the courier (spine .25 m is not enough for its reach) - open item.

Foot slide (Scene Lab metric, close fixture): lion slide p95 62.8 cm / max 330 cm in the first after run (`after3/r32-lion/metrics.json`;
worst frame 136, the approach run). That run used the gallop atlas slot for runs > 5 m/s, which the paw solver plants
with the trot stride; I reverted the gallop switch afterwards (commit 0bd2a158), but did not get a browser slot to
re-measure. r31 measured the lion at 14.8 cm p95 on the trot. **Slide is not verified under 3 cm.** Flamingo/monkey metrics: `after3/r32-flamingo|monkey/metrics.json`.

L8 real play (`tools/qa/r28-vqa-fixture-play.ts`, build:qa + preview 4905, god courier, army MG, high, zoom 1.5, WebGPU
default): `l8-elephant-apc-yard-engaged`, 75 s, sheet `play-elephant-sheet.jpg`, shots `play-elephant/`. The engaged elephant
charges with the dust trail around him (shot s003) and a tan dust lane on the ground (s011); no red lane. `l8-before-lion`
(150 s, low) never left Nadia's guided walk ("Follow Nadia to the central plaza"), so it shows no fight; shots in `play-lion/`.
Only WebGPU/zoom 1.5 were exercised in real play; low+high and WebGL2 for every animal are left to the QA lane.

Native checks:
- `tools/qa/r32/elephant-idle-probe.ts l8-before-lion|l8-before-gorilla`: the elephant (id 399) stays `animal.elephant`,
  calm, not infected, no arena boss, for the whole run.
- `sh tools/qa/diag/l8idle-all.sh` (local, the remote queue did not dispatch): L8 skilled bot ends on seeds 1-6
  (540 / 555 / 507 / 492 / 579 / 561 s; worst idle 5.0 / 1.1 / 16.5 / 1.5 / 6.0 / 2.4 s); l8carrier ends on seeds 1-6
  (540 / 555 / 507 / 516 / 519 / 580 s).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L8` (local): L8 skilled complete, passive tick-budget, 0 passive
  flags; the only flag is PARTIAL_LEVEL_SELECTION (single-level diagnostic run).
- `npm run test:gate` (local, 59.6 s): 106/107 after the fixes in dc287742. The remaining failure
  `tests/engine/vehicles.test.ts > zooParkedBoarding` expects the L8 breach at `startedAt + 3599`; since r31-nadia
  (6dc10856, on main) the breach waits for Nadia's guided walk (`calmTicks()`), so it most likely fails on main too (inferred from the code, not run on main); this lane does not touch the breach or the guide.
- tsc clean; eslint clean on all touched files.

## Browser QA needed (follow-up QA lane)
- L8 real play through all six arenas at zoom 1.5 and 0.5, low and high, WebGL2 and WebGPU: arena flamingo dive (shadow line
  + swoop, birds never slide on the ground), zebra stampede (dust lane + herd gallop, second stampede from the other side),
  monkey roof jump + cling, lion stalk -> glint -> leap -> pin, lioness flank in phase 2, gorilla pound/roar/throw,
  elephant trumpet + stamps + charge into wall/truck. Fixture `l8-before-lion` now resumes in Nadia's sanctuary walk (after
  r31-nadia), so the lion arena is not reached within 150 s of fixture play.
- Elephant before his finale: living, no red eyes, no bar while the earlier arenas run.
- Re-measure lion/zebra/elephant foot slide after the gallop revert.
