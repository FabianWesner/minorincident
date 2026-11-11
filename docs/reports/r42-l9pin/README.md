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

## Follow-up (orchestrator decision: options 1 + 3; commits 424e69cb, 2d92bb9e)
### Why the guards did not thin the pack
1. **Dead before the APC arrived.** The guards took their posts as soon as the camp streamed in (tick ~6890). In slow arrivals the ambient pack killed all four before the APC reached the bay: seed 2 intended, civilian state `finished` at ticks 19504-20560, APC at 24082. The probe then showed `guardShots 0`.
   - Fix: they take post only when the APC is within 60 m west of the gate (`l9Course.guardDeployM`).
2. **Wrong place.** The posts are fixed at (447-459, -7). The APC stops anywhere in the bay, so the pack at its door was 10-25 m away and mostly behind the hull: 36-57 hits in 90 s from four rifles.
   - Fix: `LevelNineDriving.coverDoor()`. During the evacuation each guard's post moves to a fan 7 m out from the passenger door, 3 m apart, on clear nav cells (`guardOutM`). With hold set, the ally walks there between targets.
   - Result: seed 2 went from 57 shots / 36 hits to 467 shots / 267 hits.
3. **Not found as a cause:** range (35 m), target choice, facing or shot visibility. The probe saw `shotVisible` and nav visibility true from every guard to the door infected.

### Release rule (option 3)
- After the 45 s wait, survivors step out once at most 2 infected are within the 8 m door radius.
- At 90 s (`capTicks`) they step out regardless (fail-forward).
- A courier at or below half health at the open hatch ends the wait at once (`releaseCourierHp`). This was added after the W-only probe looped 12 courier deaths. It did not stop that loop (see open).
- No reinforcement waves while survivors wait (as before). HUD callouts are unchanged.

### Marker to the side fence
With the gate shut, the marker ran straight into the gate. The marker driver sat against it for 400 s (native seed 2), with break-free sending it back west each time. While the gate is shut, the evacuation has not started and the APC is up to 60 m west of the gate, the ring is now the side-fence gap nearest the hull (`markerAnchor`).

### Tried and dropped
`doorClearM` 12 instead of 8 made the marker drivers worse (marker-hud 1/5 seeds with >= 2 saved). Reverted.

### Results, final commit 2d92bb9e
Five seeds, no hatch shooting (`after.txt`; before = `before.txt`). Columns are survivors saved out of 4 per seed.

| Driver | Before | After 1st pass (71c2af97) | Final | Target | Met |
|---|---|---|---|---|---|
| intended bot | 4 0 4 0 4 (3/5) | 4 1 4 1 4 (3/5) | **4 1 4 3 4 (4/5)** | >= 4/5 | yes |
| marker-hud | 0 0 0 0 0 (0/5) | 4 2 1 0 0 (2/5) | 0 1 1 1 4 (1/5) | >= 3/5 | **no** |
| marker-w | 0 4 2 0 0 (2/5) | 0 1 4 1 0 (1/5) | x 2 0 0 0 (1/5) | >= 3/5 | **no** |
| west-edge | 3 4 3 3 3 | 4 4 4 4 4 | 4 4 4 4 4 | | |
| pile50 | 4 3 4 0 4 | 4 3 4 1 4 | 4 3 0 1 4 | | |

The intermediate state 424e69cb (before the courier-health release) measured marker-hud 4 2 1 0 0 (2/5) and marker-w x x 0 0 0 (0/5); the difference is within seed noise.

**Why the marker drivers still lose survivors.** They drive the straight marker line with durability 0 and drag the whole road horde into the bay: 15-28 infected at the door. Screamers keep it topped up, and four rifles cannot clear it in 90 s. Losses are at the 90 s cap or 3-12 s after a brief clear spell.

**Courier-death loop.** In marker-w seed 1 the APC stops at (457.3, -1.7) and the passive courier at the open hatch dies about every 23 s. Each death reloads `evac-point` and restarts the 30 s hold, so the run times out (12 deaths, 480 s). The half-health release did not break this loop: she dies while the crew is outside too.

**Browser run of the final commit** (L9 level start, low, WebGL2, zoom 1.5, no god, follow-marker with Space taps, 560 s):
- Evacuation at (467, -2) from tick 9881. No door wait needed: 0 → 1 → 2 → 3 → **4/4** by tick 11352.
- "Drive onto the bridge" at 11685; the APC left at 11875 (no pin); the level finished.
- Captures looked at: `r42/final2-l9-start-low-z15-gl/s051-t10658.jpg` (bay almost empty, survivors crossing, "Cover the survivors · 2/4 at the trucks") and `s054-t11750.jpg` (APC through the open bridge gate, "Drive onto the bridge · 20 m").
- Intermediate run on 424e69cb (`r42/final-l9-start-low-z15-gl`):
  - **1/4 saved.** Rosa and Dale were bitten 4-5 s after a brief clear spell. Then "Clear the door · 16 infected" for about 85 s, then one more loss.
  - `s055-t11423.jpg`: APC against the bridge-gate barrier with about 16 infected on its west side.

**Checks on 2d92bb9e:**
- Remote `npm test`: 27 files, 106 passed, 1 skipped, 150/150 cases, 153.2 s.
- `threat-audit --levels L9`: L9 skilled and passive complete, 0 L9 flags. The only flag is `PARTIAL_LEVEL_SELECTION`.
- `tools/qa/r42/pocket-check.ts`: passed.
- `tsc` and eslint: clean.

### Open (orchestrator decision)
- **Marker-driver target not met.** Possible levers:
  - Thin the chase pack before the bay: the gate countdown or shut gate could hold the road horde outside the camp; the shut gate is a wall, but the side fence is open.
  - A short covering-fire volley from the trucks when survivors step out.
  - Accept that a passive marker-follower with a wrecked APC loses most survivors (fail-forward works).
- **Courier-death loop at evac-point (passive hatch).** A fail-forward rule is needed, e.g. after 2 deaths at `evac-point` the hold timer keeps its progress across the reload, or the hatch stays shut while nobody shoots.
