# Final visual review, L1–L10 (main b98aaa604 = QA site) vs PROD batch 41 (536cadc04)

**Verdict: no new P1, and no regression vs PROD.** The q212 infected-graph reuse changes nothing visible. 80/80 A/B stops are measured and every changed frame is sim drift. All the glitches below are already on PROD. None of them is a player-vehicle clipping or an ugly player figure. The list is short, and most of it is P2 polish:
- crowd/companion clumping in a few scripted spots;
- a body lying on the L4 tank;
- one hat model that reads as a gnome cone;
- a hard white see-through ellipse in the L6 shelter;
- the heroine's crumpled gear vest;
- flat, empty ground in the night levels (L6 exit, L7, L10), which is the main "stunning" gap.

Build note: minor-incident.com and the QA site ship without the test hooks, so `qa:ab` cannot drive them. The baseline was therefore a local `build:qa` of 536cadc04 (detached worktree, removed afterwards), served on 4583. The candidate was this worktree's `build:qa` of b98aaa604. Both summaries record the commits read from the served bundles.

## What I ran (all headless, browser pool, one job at a time)
| Check | Settings | Result |
|---|---|---|
| `qa:ab` tour L1–L10, 41 stops × zoom 1.5 and 1 | WebGPU, low, seed 1, debug-campaign (progressed) saves | **80/80 measured, 0 errors**. Above 2 %: L4 tank-enter z1.5 (36.8 %), L4 tank-hold z1 (31.3 %) / z1.5 (3.2 %), L5 finale z1 (23.5 %), L7 start z1 (3.6 %), L8 finale z1 (3.2 %). All are infected/corpse/survivor positions and poses from sim timing, not the look. Infected bodies, faces and materials are identical on both sides in every stop (no q212 visual change). |
| Scene Lab catalog, 51 figure/movement/vehicle scenes | WebGPU low and WebGPU high | low 49/51, high 48/51. Fails: `courier-locomotion-m` footSlideMaxCm 29.1 > 6 (both tiers), `courier-gear-tier4-swing-male` courierAttachmentGapMaxCm 2.1 > 2 (both), `corgi-behaviour` footSlideMaxCm 11 > 8 (high, reproduced twice). **All three fail identically on PROD 41**, so they are pre-existing, not regressions. |
| Close-ups (`gear-close`) | heroine + male courier, tiers 0–4, torso/idle/run/swing, low | captures 07, 08 |
| Hi-res figure shots, 10 lineups | low, 1280×720 | captures 09–11 |
| Atmosphere scenes L1–L10 | WebGPU high; WebGL2 low on L1/L4/L10 | captures 12, 13. WebGL2 matches WebGPU: no missing figures, same shadows, eyes visible. |
| Real input, fresh save | L1, female, low, z1.5 | finished in 156 s, 0 skips, 0 issues. The only frame > 200 ms (250 ms) was under the loading card. |
| Real input, debug entry | L4, male courier, high, z1 | finished in 289 s, 0 skips, 0 issues. Frames > 200 ms (up to 917 ms) occurred only under the briefing/loading card; none in gameplay. The tank, the wall and the corpse carpet read correctly. The "Controls / Sound" strip at the top of these captures is the QA-only `?debug` panel, not a PROD element. |

**Not done (time box):**
- No real-input pass of L2, L3 or L5–L10. Their glitch hunt rests on the A/B tour stops (progressed saves) and the isolated scenes.
- No movement close-ups of survivors boarding or riding.
- No new cold-load measurements; they need a quiet window.

## Load (seconds, worst of 5 fresh profiles; from q212 on this same runtime, not re-measured by me)
| | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 |
|---|---|---|---|---|---|---|---|---|---|---|
| WebGPU high | 2.08 | 4.16 | 3.09 | 5.98 | 5.26 | 3.81 | 3.08 | 5.09 | 5.33 | 4.93 |
| WebGPU low | 2.19 | 3.61 | 2.93 | 4.31 | 4.56 | 2.93 | 2.93 | 4.61 | 5.48 | 5.19 |

All are under the 6 s budget. L4 high has the thinnest margin (24.6 ms).

## Glitch list, P1 → P3
No P1 found.

**P2**
1. **L4 west breach: a body lies on top of the tank turret** while the tank holds beside the barrier (01; same on PROD). The tank itself stays on the plaza side of the wall in every tank stop at both zooms and in `alphas-at-the-tank` / `collision-tank-admission` (gates pass).
2. **L3 army checkpoint pull-back: about 12 soldiers stand packed in a tight grid at the top of the ramp,** interpenetrating and partly over the white van's front (02; same on PROD). It reads as one dark lump, not a squad.
3. **L6 shelter start/handover: the see-through cut draws a hard white ellipse over the courier,** with her head inside a dark hole and the headlamp pickup ring in it (03; same on PROD). It looks like debug UI. Fix: soften or remove the outline, or keep the head above the cut.
4. **L5 Metro finale at zoom 1: a ruined building in the foreground fills half the frame and hides most of the stairs and ring** (04, right half). At zoom 1.5 the ring shows, but the shot is still crowded by roof slabs.
5. **L8 APC boarding wait: the survivors pile into one line glued to the APC flank, some drawn semi-transparent** (05). The two HUD lines also disagree ("1/13 aboard · 12 missing" over a stale "0/13 · 13 missing" toast).
6. **Crowd hat: one civilian hat is a tall purple dome on a brown brim and reads as a gnome or wizard cone** (06; `ped-hats-glasses-close`, identical on PROD). The green cap next to it is fine, and so are the hats in the L1/L2 tours.
7. **Heroine gear tiers 2–4: the vest surface is crumpled and noisy, with a dark shard at the left hem at t2** (07). The male courier's vest at the same tiers is clean and quilted (08), so the heroine is now the weaker of the two player figures here. Any visible defect on the player is P1 by the playbook. I rate it P2 because it is texture noise at zoom 1.5 rather than a broken mesh, and it is unchanged from PROD. The PO may want to raise it.
8. **Male courier walk: one 29 cm foot slide at frame 651 (a turn) in `courier-locomotion-m`.** The p95 is 3.5 cm and the heroine's maximum is 0.4 cm. It is identical on PROD. The close stills at frames 560 and 680 show a normal gait, so the slide is a single event at the turn.

**P3**
9. **L7 start/handover, L6 exit and L10 open road: the ground is a large, flat, unlit plane** (purple in L7, blue-grey in L10) with nothing on it outside the lamp pools (17, 18, 20). This is the biggest "stunning" gap, not a bug.
10. **L10: up to ten overlapping HP bars over a melee cluster** hide the figures at zoom 1.5 (20).
11. **Male courier tier 0–1 shirt:** orange paint blotches on the white shirt front (08).
12. **`corgi-behaviour` foot slide 11 cm at high only** (same on PROD). I saw no corgi skating in the tours or the L1 play.

**Checked and fine:**
- the depot clerk walks back and the door closes;
- the lab technician signs;
- bench sitters sit on benches;
- the L3 ramps show no deck gaps or seams;
- the L4 alarm crowd and bus;
- the L9 APC (whole on the bridge, no floating wheels, no arrow);
- the corgi beside the APC, not inside it;
- Alpha/Mega lineups (no boot slabs);
- corpses read as bodies;
- zoo animals and infected dogs;
- the dog legs are attached (gate);
- the rocket launcher hold;
- the heroine's ponytail and gloves at all tiers;
- weapon hold during the swing on both couriers.

## Per level: glitches / stunning
| Level | Glitches | Stunning | What's missing |
|---|---|---|---|
| L1 | none | 8/10 | Warm, dense, readable; the reference level (14, 15). |
| L2 | none at the ride start | 7/10 | Fire station crew and truck read well. |
| L3 | #2 checkpoint clump | 6/10 | The corridor deck is clean but bare; the haze flattens it. |
| L4 | #1 body on the tank | 7/10 | Busy plaza; the tank and wall read correctly (16). |
| L5 | #4 finale framing | 6/10 | Strong ruin dressing, but the foreground building eats the finale. |
| L6 | #3 cut ellipse | 6/10 | The shelter is lit well; the exit night is an empty floor (17). |
| L7 | #9 ground void | 5/10 | The group and the truck are lit; everything around is flat purple (18). |
| L8 | #5 boarding clump | 6/10 | Zoo crowd good; the APC wait is dark and the line is merged. |
| L9 | none | 7/10 | APC, bridge collapse and crawl read well; night lighting good (19). |
| L10 | #9, #10 | 5/10 | Long, flat blue-grey road; fights become HP-bar soup (20). |

## Reproduce
```sh
# baseline: QA build of PROD 41 served on 4583 (detached worktree of 536cadc04, npm run build:qa, vite preview)
E2E_PORT=4581 SCENE_PORT=4582 sh tools/qa/ab.sh --baseline http://127.0.0.1:4583 --candidate dist --levels L1-L2 --out test-results/qa-ab/final-visual-L1-L2   # and L3-L4, L5-L6, L7-L8, L9, L10 (10-min pool cap)
SCENE_SERVER=preview sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --jobs 1 --tier low --backend webgpu --filter 'courier-gear-tier*,courier-locomotion-*,...'
SCENE_SERVER=preview sh tools/e2e-lock.sh npx tsx tools/scenelab/gear-close.ts --backend webgpu --tier low --views torso,idle,run,swing
E2E_PORT=4588 npx tsx tools/playtest/play.ts --levels L1 --quality low --zoom 1.5
```
Raw outputs are under `test-results/qa-ab/final-visual-*`, `test-results/fv-*` and `test-results/playtest/fv-*` (git-ignored).
