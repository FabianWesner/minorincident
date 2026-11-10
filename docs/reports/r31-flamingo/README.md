# r31-flamingo: L8 animal bosses scaled to the L8 weapons, flock engage timing, night figure fill

Lane r31-flamingo (base main 934225f0). PO 2026-11-10 UAT: "Flamingos are too strong, even a missile hit costs them only a fraction of their health", "same for this guy, after 5 hits with a rocket, still healthy", and the lion/gorilla read as a flat pale-blue blob at night. The orchestrator then re-aimed the targets: no rocket in L8; weapons are fire axe, handgun, shotgun, army MG (+ bat/fists).

## Changes
- `src/data/l8Bosses.ts`: HP per animal (flamingo count 7 -> 8, in the design's 6-8).
- `src/sim/combat/Damage.ts`: arena bosses take x0.2 from allies (soldiers, group); the courier owns the fight. The x0.6 / x1.8 exposed-window multipliers are unchanged.
- `src/sim/missions/L8BossArenas.ts`: flamingo flock stays home (orbits its arena) while the courier is more than radius + 12 m away, so it no longer chases her to the plaza; in phase 2 up to three more flights of 6 birds land when 2 or fewer are alive (the fight lasts through numbers and dives, not sponge HP). A flight called on the tick the last bird dies does not clear the arena.
- `src/sim/world/SolidRegistry.ts`: dead infected flamingos are no longer solid large corpses (26 solid bird corpses walled the courier in on seeds 4/5: the bot stood still for 1000 s).
- `src/render/CrowdView.ts`: the L8 infected animal bosses (lion, lioness, gorilla, elephant, zebra, flamingo, monkey) use the Alpha night figure fill (0.25 instead of 1), like the r31-megafight Mega.
- Tests/tools: `tests/helpers/l8BossShoot.ts` (inside the existing boss damage check in `tests/engine/vehicles.test.ts`, no new test): per-shot damage asserts one shotgun blast kills a flamingo/monkey, 6 MG bullets and 4 handgun hits kill one, 2 shotgun blasts kill a zebra, 30 MG rounds kill a lion, 60 kill the gorilla, and a full magazine stays below half the elephant. The probe now uses a 1e6 HP pool per shot (a killing probe changed arena gates/phases for the next boss). `tools/qa/diag/l8flock.ts` (new flock timeline), `l8carrier.ts`, `l8trace.ts` (seed argument).

## Hits to kill (per hit: handgun 12, MG bullet 8.4, axe 35-47, shotgun blast 108-144; x0.6 outside the exposed window, x1.8 inside)
Measured natively, one probe shot at 8 m (axe at 1.6 m), `boss HP`: before -> after. Hits-to-kill = ceil(HP / damage per hit). Rocket column is information only (rocket is not in L8).

| Boss (HP before -> after) | Handgun | Axe | Shotgun | MG bullets (mag = 30) | Rocket (info) |
|---|---|---|---|---|---|
| Flamingo (780 -> 36) | 65 -> 3 | ~17 -> 1 | 8 -> 1 | 93 -> 5 | 8 -> 1 (blast kills every bird in it) |
| Monkey (840 -> 36, leader 72) | 70 -> 3 | ~18 -> 1 | 6 -> 1 | 101 -> 5 | 9 -> 1 |
| Zebra (1250 -> 150) | 105 -> 13 | ~27 -> 4 | 9 -> 2 | 149 -> 18 | 13 -> 2 |
| Lion / lioness (3200 -> 250) | 267 -> 21 | ~68 -> 6 | 28 -> 3 | 381 -> 30 (one magazine) | 41 -> 4 |
| Gorilla (6000 -> 500) | 500 -> 42 | ~128 -> 11 | 42 -> 4 | 715 -> 60 (two magazines) | 59 -> 5 |
| Elephant (5000 -> 1200) | 417 -> 100 | ~106 -> 26 | 35 -> 9 | 596 -> 143 (a magazine = 21 %) | 51 -> 12 |

Exposed window (gorilla chest-beat, lion roar): x1.8 / x0.6 = x3, so the gorilla takes about 20 MG bullets and the lion about 10 inside it. The elephant's third wall impact still ends the fight (unchanged, `arena.elephant.wall`).
Flamingo/monkey axe and rocket rows were capped by the probe's 1-HP floor; the true damage is 47 (axe) and about 100 (rocket), both well above 36.

## Flock fight and engage timing (L8 skilled bot, `tools/qa/diag/l8flock.ts`, seeds 1-6)
The "Defeat Flamingo flock" title replaces "Protect the group!" when the 30 s window ends. Bot runs already engaged on the first turn (t 81-86 s) and the title showed 32-51 s on PROD data; the PO's short title came from a real player at the plaza: the flock chased her there and the soldiers killed it. Fixes: leash, allies x0.2, flights.

| | before (HP 780 x 7) | after (HP 36 x 8, +3 flights of 6) |
|---|---|---|
| flock fight duration, seeds 1-6 | 41-55 s | 32-39 s |
| title visible (protect end to cleared) | 32-51 s | 27-34 s (min 26.7) |
| flock not dead at protect end | 5-7 of 7 | 5-7 of 8 (+ flights to come) |
| courier HP loss in the fight | 30-78 | 0-52 |
| time to engage after first turn | 0 s | 0 s |

Intermediate stages: HP only gave 10-18 s fights; one extra flight 12-18 s title; two flights 17-25 s. The real-player case (courier staying at the plaza) is covered by the leash and ally damage rule but was not played here (no browser lane): see Browser QA.

## Bot and threat
- Skilled L8 bot (`tools/qa/diag/l8carrier.ts` complete bot), seeds 1-6: all complete, end 371, 304, 309, 295, 310, 308 s (before: 599, 527, 499, ...).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L8`: skilled complete (371.55 s), flags only the Mega-Mac baseline `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` (`SLOW_FOLLOWER` 354/363 did not appear). 
- `tests/engine/vehicles.test.ts`: pass (including the new asserts; red on the old HP when run against HEAD data). tsc and eslint clean on the touched files.

## Night figure fill (PO: "This is the lion....")
Cause: `CrowdView.figureFill` was 1 for every non-Alpha figure, so the moonlit rim fill (floor 0.12 x pale rim colour) swamped the dark animal coats and flattened lion and gorilla into a pale-blue blob, the same cause as the Mega. Fix: 0.25 for the L8 infected animals. The animals have no atlas fill (that 0.04 path is only for human figures), so only the figure fill value applies.
Capture: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/fl/night-bosses-low-after.jpg` (not committed, raw captures stay out of git; spec `specs/scenes/qa-l8-boss-night.json`, Scene Lab, low tier, WebGL2, zoom 1.5, night). Opened: lion with a brown mane and red eyes, gorilla with its dark fur and red wound, zebra stripes and the flamingo's pink body with a red wound all read as separate textured figures with legible legs. The before capture (HEAD CrowdView) never ran: it waited behind other lanes on the browser lock and I stopped it, so the before/after comparison and the high tier are still open (below).

## Browser QA needed
- Scene `specs/scenes/qa-l8-boss-night.json` on HEAD vs this branch, low and high, WebGL2 and WebGPU, zoom 1.5 and 1.0: lion/gorilla/zebra/flamingo at night must not be a flat pale blob; healthy zoo animals (figureFill 1) unchanged.
- L8 flock at real input: stay at the plaza during "Protect the group!" (30 s) and confirm the birds stay in the pond arena, the title "Defeat Flamingo flock" shows at least 20 s while most of the flock is alive, and the second/third flights land from ring points 10 m from the arena centre without popping in view (they spawn as healthy animals and turn within about 2 s).
- Boss hit feedback at the new HP: the existing flash/squash on each hit, a health bar that visibly drains (lion after 10 MG bullets, gorilla after 20), dead flamingo piles at close zoom (corpses are not solid any more: confirm no visible clipping with the courier).
- Dive telegraph readability with 8 + 6 birds (shadow line 0.6 s).

## Not done / notes
- No rocket in L8 (handed in at the sanctuary gate, other lane): the rocket HP rows are information only.
- Real-player check of the plaza-flock case needs the browser lane.
- Probe note: the boss damage probe kills a boss on a lethal shot and that opens the arena gates; keep the 1e6 HP pool in `l8BossShoot.ts`.
