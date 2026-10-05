# E09 — Vehicles

## Built

Seven validated SI-unit vehicle definitions; Bruno PhysicsVehicle raycast wheels, force taper, lowered centre of mass and fixed-step stuck recovery; 0.6-second driver-door dwell, collision-checked exits and forced explosion ejection; mouse, local WASD and touch driving with horn/boost and separate brake/exit; speed-based run-over damage and brute retaliation; five breakable and three heavy obstacle types with a fixed 24-body debris pool; smoke/fire thresholds and a 180-tick splash fuse; infected attachments and shake-off; registry-backed models, animated wheel pivots, HDR brake/siren lamps, door rings and a 15% driving camera zoom.

`drive-course` is a 600-metre sine chicane with 46 cones. The pure-pursuit Driver emits ordinary InputFrames and shares player stuck/reverse recovery. It never teleports or uses cheats. Vehicle ownership is unloaded before the Rapier world; view-owned resources are disposed separately from registry prototypes.

## API/data contract

`VehicleDef` is documented in src/data/vehicles.ts. EntitySnapshot.vehicle contains speed, forwardSpeed, steer, braking, boosting, driver, attached IDs, damage state, explodeAt, stuck and recoveringUntil. EntitySnapshot.hidden hides the seated survivor; attachedTo records a visible clinging infected. Combat kills caused by ramming carry cause=vehicle. The API is version 1.5.0: spawn accepts vehicle.* IDs, bot.start('driver') operates in drive-course, and camera.preset('vehicle') provides the fixed emergency-car photo spot. InputFrame.drive contains local throttle/steer axes; brake is independent of RIGHT exit. screenshotReady also waits for dynamic vehicle models.

## Acceptance evidence

Each row below has a passing tagged test in the required layer. `acceptance-results.json` indexes actual final verifier results from `vitest.json` and `verify-playwright.json`; all 11 criteria pass.

| Criterion | Result | Tagged test / evidence |
| --- | --- | --- |
| E09-AC01 | PASS | `tests/unit/vehicles.test.ts`; native fire-engine spawn/unload in `tests/e2e/driving.spec.ts`, `fire-engine.png`. |
| E09-AC02 | PASS | `tests/sim/vehicles/interaction.test.ts`: 36-tick dwell, input ownership, full capsule exit, dwell reset and moving-car exit. |
| E09-AC03 | PASS | `tests/sim/vehicles/handling.test.ts`, `handling-metrics.json`. |
| E09-AC04 | PASS | `tests/sim/vehicles/consequences.test.ts`: runner kill cause, brute knockback and exact HP retaliation. |
| E09-AC05 | PASS | Consequences suite exercises all five light/three heavy types, low-speed refusal and bounded/recycled debris. |
| E09-AC06 | PASS | Consequences suite checks strict thresholds, exact 180-tick fuse, splash, ordinary/boxed ejection and manual fuse exit. |
| E09-AC07 | PASS | Consequences suite checks max-four attachments, speed/hard-steering release and destruction cleanup. |
| E09-AC08 | PASS | `tests/e2e/driving.spec.ts`: real mouse ahead-left/dead-ring input plus camera zoom. |
| E09-AC09 | PASS | Consequences suite, `course-metrics.json`: pure-pursuit course and separate blocked/reverse recovery fixture. |
| E09-AC10 | PASS | `tests/visual/vehicles.spec.ts`, three vehicle goldens, lamp/spoke screenshot pair, `visual-metrics.json`, `review.md`, `compare/police.png`. |
| E09-AC11 | PASS | Handling suite compares x/y/z/yaw after 1,800 ticks in three independent Rapier worlds at tolerance 1e-4. |

## Deviations

No acceptance criteria changed. Per the explicit art-status rule, the sedan, pickup, SUV, police, ambulance and bus use contract-complete code placeholders while their manifest status is below integrated. The integrated fire engine loads its production GLB and all required wheel/light/ladder nodes. Merged main contained tracked sources without registration/optimized outputs for thr.flashbang, npc.helicopter-pilot and veh.box-truck. Their existing pipeline exports and measured metadata were registered to restore unit reproducibility; all retained reference status. The pilot uses the same uniform 1.8-m adult-height conformance as the existing E17 catalog. No source artwork or other-epic gameplay behavior changed. The later explicit orchestrator instructions froze the current base and delegated full cross-epic browser regression to main; both overrides were followed.

## Performance

Measured from the final verifier artifacts: sedan speed at four seconds **14.52219 m/s** (required ≥14.4), full-lock radius **9.98950 m** at mean **10.48763 m/s** (required 8–14 m), maximum flat-slalom roll **0.73796°** (required <60°). The driver reaches x=**600.45465 m** in **40.33333 s** (required ≤90) with **300/300 HP**, no recovery events and Node sim P95 **0.06858 ms** (budget <4 ms).

The paused two-car/cone photo fixture renders **49 draw calls / 651 triangles**, below the 600/1,500,000 budgets. `render-perf.json` is a paused render-counter sample, not a sustained FPS benchmark. Lamp probes measure **672 vs 0** brake-on/off red pixels and **625 changed pixels** at each alternating siren. See `handling-metrics.json`, `course-metrics.json`, `visual-metrics.json` and `render-perf.json`.

## Validation

Frozen base: main **b5dcd1c**, merged before final checks. Final tested code **b90bc08** includes the recorder/API integration repairs and held touch boost; approved goldens are from **d3f1389**, with vehicle-port attribution in **a5ccb07**. The orchestrator explicitly froze this base; no subsequent main changes were merged or registered.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | exit 0 | `logs/typecheck.log`, `final-gates.json` |
| `npm run lint` | exit 0 | `logs/lint.log`, `final-gates.json` |
| `npm run build` | exit 0, no warnings | `logs/build.log`, `final-gates.json` |
| `npm run test:unit` | 67 passed, 28 files; exit 0 | `logs/unit.log` |
| `npm run test:sim` | 121 passed, 11 files; exit 0 | `logs/sim.log` |
| `npm run test:smoke` | 3 Node + 13 browser passed; exit 0 | `logs/smoke.log`, `smoke-playwright.json` |
| `npm run verify -- E09` | 19 Node + 20 browser passed; exit 0 | `checks.json`, `vitest.json`, `verify-playwright.json`, `logs/verify.log` |
| Cross-epic browser/native regression | delegated to orchestrator on merged main | Explicit final lane instruction; interrupted-run evidence retained below. |

Browser runs use E2E_PORT=3323, the machine-wide lock and two workers; Vitest uses at most four workers. The orchestrator superseded lane-wide browser regression with own-epic verify plus smoke, and owns the full regression on merged main. The already-running broad Chromium suite was interrupted accordingly (70 passed, 2 integration failures, 2 interrupted, 17 not run); no native WebGPU check was started. Its two genuine failures were corrected: idle driving throttle is canonical zero across JSON recordings, and the API harness now validates implemented bot stop/status rather than expecting stubs. Both checks are tagged @E09 and pass in the final 20-test browser verifier. The final review also added held touch boost, which the real-touch test proves. Static/unit/sim/smoke/epic checks were rerun for these fixes; no second broad browser run was started. See `cross-regression-interrupted-playwright.json`, `cross-regression-interrupted-checks.json` and `logs/cross-regression-interrupted.log`. Browser command wall times include shared-lock waits. No dependency was added; no deployment or push ran. No criterion was changed.

## Known issues

No known E09 gameplay defects. Six catalog models remain code placeholders and smoke/fire use minimal placeholder effects under the explicit asset-status rule; final art/VFX fidelity is not claimed by this epic. Human driving feel remains part of the milestone playtest protocol, not an automated acceptance gate.
