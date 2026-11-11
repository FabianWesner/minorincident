# r39-markers: L9 bridge marker/trigger, L9 APC stuck recovery, L8 arena markers, L8 gorilla chase (2026-11-11, Sonnet)

Source findings: `docs/reports/r38-vqa/README.md` (P2-1..P2-4, P3-5, P3-6). Zombies untouched (no stat tuning); no corpse removal.

## Changes
| # | Finding | Root cause | Fix |
|---|---|---|---|
| 1 | L9 "Drive onto the bridge" never completes, HUD arrow points back west with the APC on the deck | The ring was the static `crash-approach` anchor (x 470, the bridge-gate wall); the collapse needed the APC on the deck (x 482-508) *and* > 1 m/s east | `markerAnchor` (`src/sim/missions/markerAnchor.ts`): while L9 drives, the ring is the evacuation bay until the survivors are aboard, then the middle of the deck (x 495). `LevelNineCrash.update`: the deck alone starts the collapse (any speed/heading); a slow or held hull gets a scripted run-up east at >= 8 m/s, yaw snapped east. |
| 2 | L9 APC stood 53 s, nose on a jersey barrier, bus behind, 2 leapers on the hull | The reverse recovery needs room behind; with a bus/pile behind it just repeats | `LevelNineDriving.breakFree` (new): third stuck recovery within 20 s with the hull still < 1.5 m/s sets the APC on the nearest clear pose (6-18 m, behind/sides, clear 8 m lane, bias east), boarders ride along. |
| 3 | L8 markers end 4 m outside each entry gate | `l8Route` last nodes were 4 m short of gate and zone | Last node of lion/monkey/zebra/gorilla moved 4-5 m inside the gate and zone (`src/data/l8Bosses.ts`); flamingo and elephant already were. |
| 4 | L8 gorilla parked 4.3 m away in `chase` for 3 min | `approach` branch walked to striking range; the group blocked the walk, nothing ever fired | `L8BossArenas`: if the gorilla has not moved for 1.5 s while approaching, it strikes from where it stands when the area reaches her (radius + 2 m body reach), else throws a prop over the group, else pounds regardless. |
| 5a | L4 cellar prompt flips | `interactStepInRange` toggles on the ring edge every frame | `Hud`: the in-ring prompt lingers 0.75 s after the ring is left. |
| 5b | Gorilla fight readout is not the distance to the gorilla | During a fight the L8 marker was the arena centre | `LevelEightZoo`: the marker follows the nearest live animal of the arena (ring, arrow, minimap, readout). |

## Evidence
- `tests/engine/r39-markers.test.ts` (3 tests, pass local and on the Hetzner runner): L8 last nodes inside zones (all six); L9 at-bridge fixture, marker on the deck and an APC set on the deck with zero velocity starts the collapse; APC pinned in a pocket (front/rear barriers + side rails) with W held leaves it.
- A/B native probes (`tools/qa/r39/`):
  - `gorilla-corner-probe.ts`: courier in the NE corner (80.6, -12.7) with her group packed between. Before: 2 attacks in 60 s, parked at 5.4 m in `chase`. After: 8 attacks in 60 s (roar 3, grab-throw 3, pound 2).
  - `l9-stuck-probe.ts`: tight pocket, W held. Before (breakFree off): speed 0.02 m/s, never leaves in 40 s. After: freed at tick ~905 (15 s) and drives on.
  - `l9-probe.ts`: marker of the rail-stall fixture.
- Real-input fixture play (`r28-vqa-fixture-play.ts`, low, zoom 1, WebGL/WebGPU per default, `--god --follow-marker`):
  - `l8-before-monkey`: following the marker the tracker counted 18 m -> 1 m, the monkey fight engaged at the gate ("Defeat Monkey pack ... Phase 1 - N m", distance to the pack now), cleared, then the zebra leg started ("Cross the visitor field to the zebra paddock"). Before: 60 s / 3.5 min standing in the ring with nothing happening.
  - `l9-before-rail-stall` (god, follow-marker, low z1, ~8300 ticks): hatch defence, gate, bay ("Stop in the evacuation bay" now counts to the bay ring), evacuation, then "Drive onto the bridge" counted 14 m -> 9 m and the collapse fired (checkpoint `outskirts-approach`, crawl at x 527). Capture of the cracked deck with the Mega on the hull: `s012-t8054.jpg` (looked at; raw captures not in git). Before: 296 s on that objective.
- Gates run: `npx tsc --noEmit`, eslint on the changed files, vitest `tests/engine/missions.test.ts`, `vehicles.test.ts`, `infected-ai.test.ts`, `world-systems.test.ts`, `tests/qa/invariants/contract.test.ts`, `vehicle-scenes.test.ts` (remote).

## Not covered / open
- Gorilla real-input fight (browser) and the other arena legs (lion, zebra, gorilla) only verified by data + native probe; the lion/zebra fixtures were not replayed in the browser.
- L9 `breakFree` is a last-resort pose change (the hull jumps up to 18 m); a player may see a visible jump after ~15 s of being pinned. Not tested in the browser.
- No ramp jump or perf measurement here.
