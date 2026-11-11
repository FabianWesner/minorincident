# r42-l9pin: L9 APC pinned at the bay (P1) and survivors lost at the bay (P2) (2026-11-11, Opus)

Branch `worktree-agent-a633c66472cbd6cce` (from main ea5773f8). Raw probe output and captures are in the scratchpad (`r42/`) and are not in git.

## What was wrong
| Finding (r41-vqa) | Root cause found |
|---|---|
| P1-1: APC frozen at (443.1, 6.3) for 330 s, break-free never fired | The r41 log shows the APC at (436.9, 7.6, yaw 0.38) west of the shut gate, then at (443.09, 6.25, yaw **0.0000**). That is a `breakFree` placement (yaw 0 is its first candidate, 6 m ahead). `fits()` only checked the lane **ahead of the hull centre**, so the rear half was put inside the shut gate wall (x 440). Later recoveries never counted: they need the 3 s stuck window, and a held brake, an impact stall or the handbrake keeps clearing or pausing that window. From then on nothing could move the hull. The exact frozen state (identical coordinates to 1e-10 for 270 s) did not reproduce natively. The closed-gate overlap at that pose, a 50-infected pile and the courier dying at the hatch during the hold all drove free natively. So the watchdog below is aimed at the symptom (gas held, no movement), whatever the trigger. The handbrake hypothesis (`Vehicles.ts:182`) is only partly right: the reverse ran with Space held, but with the rear wheels locked. |
| P2-4: 0/4 saved at the bay | (a) **The four guard soldiers were never deployed.** Natively they stood unhidden at the level start (-550, 0), still marked as truck passengers. The deploy loop needed `hidden`, so it skipped them and the bay had no guard line. (b) The chase pack that follows the APC into the bay turned every survivor 2 to 7 s after stepping out (probe: 12 of 12 losses at t = 2-7 s, all from the pack, none from waves). (c) Side finding: an APC parked in the truck lane covered Mia's truck spot and its fallback, so she had no route and the evacuation never finished (soft-lock, seed 1, before). |

## Changes (commits 6bc91196, 71c2af97)
- `LevelNineDriving.breakFree`:
  - **Pin watchdog.** The gas input is held (W, stick, or LMB in mouse-only) and the hull has not left a 5 m circle for 11 s (`l9Course.pin`) → relocate. This does not depend on the stuck/recovery count. The 3-recoveries path stays.
  - **Whole-hull fit.** The candidate pose must have the whole hull (rear bumper to nose) plus the 8 m lane clear of static nav and solids.
  - **Pass order.** First clear of bodies and reachable in a straight line without crossing a static solid; then reachable through a pile; last resort (a fully closed pocket) any clear pose.
  - Relocating also clears the impact stall and wakes the body.
- `Vehicles.prePhysics`: the recovery reverse drops the handbrake.
- Guard soldiers deploy when they are a truck passenger with a post, whatever their `hidden` flag.
- **Evacuation timing (level design only; no infected stat changes, nobody removed):**
  - Survivors stay seated while a live infected is within 8 m of the passenger door or on the hull. They step out anyway after 45 s (`waitMaxTicks`), so fail-forward stays.
  - No reinforcement waves while they wait inside.
  - An unreachable truck spot rotates to the next open spot (both sides of all three trucks).
- **HUD:**
  - While they wait: `Clear the door · N infected at the APC · shoot from the hatch · x/y at the trucks`.
  - For 4 s after a loss: `<Name> was bitten · shoot from the hatch · x/y at the trucks`, plus the signal `l9.survivor-lost`.
- Tests (budget unchanged, 150/150): `checkL9ApcPocket` (tests/helpers/r39Markers.ts, run by tests/engine/missions.test.ts) now runs three variants. The pocket with W held, W plus handbrake taps (24 of every 90 ticks), and a hull held by a permanent impact stall must each free within **15 s** (was 30 s, W only), and the new pose must be clear of walls along the whole hull. Before the fix the frozen variant cannot free: a held stall never sets `stuck`.

## Evidence
**Native pin probe** (`tools/qa/r42/l9-pin-probe.ts`): at-bridge fixture, APC at (443.1, 6.3, yaw 0), gate shut, 50 infected piled on the left side and rear. Results:
- No pocket: freed in 1.7 s (Space taps) and 1.4 s (W only).
- Walled pocket: freed in 12.6 s (Space taps) and 9.9 s (W only).
- With the final code, `tools/qa/r42/pocket-check.ts`: all three variants pass, and the watchdog frees the r39 pocket at 11.0 s (was 15.1 s).

**Native bay matrix** (`tools/qa/r42/l9-bay-matrix.sh`, `l9-bay-probe.ts`, seeds 1-5, no god, no hatch shooting; `before.txt` and `after.txt` here):

| Case | Before: saved/4 per seed (seeds with >= 2) | After |
|---|---|---|
| intended (production bot on the road, HUD driver from x 420) | 4 0 4 0 4 (3/5) | 4 1 4 1 4 (3/5) |
| marker-hud (W to the marker plus Space taps from the level start, as r41) | 0 0 0 0 0 (0/5) | 4 2 1 0 0 (2/5) |
| marker-w (W only) | 0 4 2 0 0 (2/5) | 0 1 4 1 0 (1/5) |
| west-edge (APC set at the r41 pose, gate shut) | 3 4 3 3 3 (5/5) | 4 4 4 4 4 (5/5) |
| pile50 (50 extra infected after the evacuation) | 4 3 4 0 4 | 4 3 4 1 4 |

Totals: 49 → 56 of 100 survivors saved. Longest post-evacuation pin in every after-run: 0.5 s.

**The target (">= 2 of 4 most of the time without shooting") is NOT met.** After the changes, 15 of 19 losses happen at t = 46-58 s: the 45 s fallback walks the survivors into a pack that the guards never cleared. The four guards are deployed and at their posts (447-459, -7), but 3 to 19 infected stay on the hull or at the door the whole wait. The waves fix (71c2af97) did not change seeds 1-4.

**Real-input browser run** (L9 level start, low, WebGL2, zoom 1.5, no god, follow-marker plus Space taps, 540 s, dist built from 6bc91196, so before the waves change):
- Hatch stall and gate passed; the APC stopped in the bay at (449, 13.5).
- "Clear the door · 10 → 19 infected at the APC" for 45 s, then "Dale was bitten", "Rosa was bitten", "A survivor was bitten": **0/4**.
- "Drive onto the bridge" at tick 14311. The APC drove off at 14538 (~4 s, **no pin**), collapse, then crawl 20 → 0 m. Level finished at tick 15517.
- Captures looked at: `r42/l9-start-low-z15-gl/s057-t12479.jpg` (APC at the north bay barriers with ~15 infected around it, the door line on the HUD, courier 20/100) and `s062-t14299.jpg` ("A survivor was bitten · shoot from the hatch · 0/1"). The guards are off-frame to the south.

**Checks:**
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: L9 skilled and passive complete, **0 L9 flags**. The only flag is `PARTIAL_LEVEL_SELECTION` (diagnostic single-level run).
- `sh tools/remote/run.sh $PWD -- npm test`: 27 files, 106 passed, 1 skipped, 150/150 cases, 174.6 s. A first attempt hit the 240 s budget on a slow runner (navigation A* timed out) and passed on rerun.
- `npx tsc --noEmit` and eslint on the changed files: clean.

## Not done / open
- **P2 target.** Survivors are not reliably saved when nobody clears the door. Next lever (orchestrator call):
  - Look into why the deployed guards (range 35, 20 dmg / 0.7 s) do not thin a pack at the APC 10-20 m from their posts (line of sight past the hull? target choice?).
  - Alternatively, let the evacuees step out on the side away from the pack.
  - Or let the 45 s fallback move them only when <= 2 infected are at the door, plus a longer cap.
- Browser runs not done: the `l9-*` fixtures (l9-before-rail-stall), high quality, WebGPU, and a browser run of the final commit 71c2af97 (waves change).
- The exact browser freeze was not reproduced natively. The fix covers it through the input-based watchdog and the stall-proof test.

## Browser QA needed
- **L9 level start, low and high, zoom 1.5, no god, W plus Space taps, no hatch shooting.** At the bay:
  - the four guards stand at (447-459, -7);
  - the HUD shows "Clear the door · N infected at the APC" while survivors wait;
  - a "<Name> was bitten" callout appears on each loss.
- **After "Drive onto the bridge" with the gas held:** the APC never stands > 12 s.
- **Any break-free jump** lands with the whole hull clear of the gate, fences and barriers.
