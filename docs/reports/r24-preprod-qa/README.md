# r24 pre-prod QA (batch-60 candidate, main @c60cd87b)

QA lane model: claude-haiku-5-5 (Haiku 5.5). Local `npm run build` and `npm run build:qa`, preview on 4881 via the playtest driver, headless, one GPU browser at a time through the browser pool. Time-boxed to 2 h. Most of the requested matrix was NOT run; see "Unchecked".

## Runs
| Run | Level | Quality | Zoom | Backend | Result |
| --- | --- | --- | --- | --- | --- |
| l8-low-z15 | L8 | low | 1.5 | WebGL2 | stopped by orchestrator; 0/1 finished, P2 x2 |
| l8-high-z1 | L8 | high | 1 | WebGL2 | 480 s bounded; 0/1 finished, P2 x4 |
| l10-low-z15 | L10 | low | 1.5 | WebGL2 | 240 s bounded; 0/1 finished, P2 x2 |
| l3-low-z15 | L3 | low | 1.5 | WebGL2 | 240 s bounded; 0/1 finished, P2 x1 |
| l7-low-z15 | L7 | low | 1.5 | WebGL2 | finished; 0 issues |

Raw captures and logs stay in the QA scratchpad (not in git).

## Findings
- **P2, L8 sanctuary clarity:** the objective reads "Follow Nadia to the central plaza · 0 m" while the courier stands on the ring. Completion waits on a hidden breach timer (about 60 s) and no cue is shown. Last capture: `continue-L8-L8-2220-stuck-at-ring.jpg` (run l8-low-z15).
- **P2, L8 escape step:** HUD reads "Protect the group!" with no marker and no enemies in view for about 20 s (driver: stuck-navigating). The APC armour bar is already visible during the flamingo fight. The brief expected it only in escape/depart, and escape spans the whole zoo, so this needs a PO decision.
- **P2, L8 flamingo arena stall (low, zoom 1.5):** the bot stayed in the flamingo arena for more than 6 minutes of game time at 26 HP, with the flamingo flock at 614/780 HP at its last check. Last capture: `continue-L8-L8-t16240.jpg` (run l8-low-z15). Flamingo health bars were visible. The bot may be at fault, but the fight did not converge.
- **P2, L8 high zoom 1 (driver flags):** "enemy-unhittable" for flamingos #406 and #407 (780 HP) and for #451 (45 HP): no damage from 8 s of attacks. Possibly the bot's aim; unverified.
- **P2, L10:** "enemy-unhittable" infected #111 (3000 HP) took no damage from 8 s of attacks, and "enemy-frozen" for ~5 s. The bounded run never reached the sunset-grove; it stayed on "Find a way through the farms" (110+ m).
- **P2, L3:** "enemy-frozen" infected #32 at 6.2 m for ~5 s.
- L3 police: teal health bars visible on officers (`campaign-L3-t8135.jpg`, low, zoom 1.5). On-ramp rails not confirmed.
- L7: 24/24 survivor group with bars, explosions and the corridor objective (`campaign-L7-t5435.jpg`, low, zoom 1.5). Rifle soldiers, medkit and alpha-worker looks NOT inspected.

## Verdicts (per level)
- **L8:** NO-GO. Flamingo arena stall, unclear sanctuary/escape clarity, and no-damage infected need triage. Lion, gorilla and elephant arenas were not reached.
- **L10:** NO-GO on evidence, not on a confirmed bug. The sunset-grove hitch, the prop check and the epilogue were not reached. The frozen/unhittable infected needs a bot-vs-game check.
- **L7:** no issues in the low/1.5 run only. Items listed below remain open.
- **L3:** NO-GO pending evidence. Police bars present; ramp rails and high quality not checked.

## Unchecked
- L8: lion, gorilla and elephant (APC) arenas; zebra and monkey arenas; WebGPU arena; zoom 1 at low.
- L10: sunset-grove prop hit and the epilogue cure dust/people; high quality; zoom 1; WebGPU.
- L7: rifle soldiers, medkit pickup, alpha-worker LOD swaps; high quality; zoom 1.
- L3: on-ramp rails; high quality; zoom 1; WebGPU.
