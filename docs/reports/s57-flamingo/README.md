# S57 — flamingo gait and motion QA

**Goal met and verified.** Flamingos walk/run with planted feet, living arena flocks remain separated, and the persistent motion gate passes. Historical investigations and superseded results are preserved in [history.md](history.md).

## Changes

Ordinary flamingo pursuit now uses the grounded stepping solver. Previously chase incorrectly enabled cruise flight at 2.4 m, releasing planted feet. Flight is reserved for the authored flock dive. Height and pitch now ease continuously through takeoff, dive activation and landing; the original transition jumped 1.69 m in one frame.

Living L8 flamingos receive evenly distributed orbit targets based on the current living flock, rather than reused reinforcement slots. The native arena observer covers four reinforcement flights at both quality levels: up to eight living birds, minimum horizontal separation **0.776 m**, no pairs within 0.5 m. Existing landing-ring placement remains intact. The observer's fight-duration bar fails because the fight finishes in 20.93 s (minimum 45 s); the spacing measurement itself passes and no stats were changed. See [native-arena-spacing.json](native-arena-spacing.json).

The shared paw solver retains world sole orientation during support and follows heading during swing, including LOD handoff. Distant human steps gain clearance before rotating their soles. Prone crawler solvers retain authored neutral foot positions. These are shared contact corrections; no lion-specific motion, models, stats or corpse lifecycle changed. Lion and lioness are included as gate controls.

## Before/after measurements

The matched matrix holds simulation trajectories and current measurement tooling identical while substituting original renderer source (`a842fdd1`) versus corrected source (`89028850`). All eight trajectories match exactly. The final flight-only easing change does not affect these grounded phases.

| Fixture | Before p95 | After p95 |
| --- | ---: | ---: |
| Flamingo walk, all 8 backend × tier × day/night combinations | 0 cm | **0 cm** |
| Flamingo run, all 8 combinations | Undefined: no grounded contacts | **0 cm** |
| Zebra, shared contact fixture | 15.6 cm | 0.4 cm |
| Gorilla, shared contact fixture | 4.5 cm | 0.3 cm |
| Elephant, shared contact fixture | 22.8 cm | 0 cm |
| Distant runner | 3.5 cm | 2.4 cm |
| Prone crawler | 10.3 cm | 0.1 cm |

Original flamingo run is not reported as zero: automatic flight gave **0/121 grounded frames**. Current run has 51/121 (low) or 53/121 (high), with repeated alternating contacts. Phase checks independently require actual walking at 2–3 m/s and running at 4–5.5 m/s, at least six contacts per window, and p95 ≤3 cm. The stationary-walk negative control fails these checks. The 360-frame dense capture records 32 contacts and native pelvis bob of **3.55 cm walking / 6.64 cm running**. See [matched-original-current.json](matched-original-current.json), [real-walk-run-matrix.json](real-walk-run-matrix.json), and [stationary-walk-negative-control.json](stationary-walk-negative-control.json).

Opened and reviewed [real-stride-review.png](real-stride-review.png): four walk frames above four run frames show attached legs, alternating lifted/supporting feet, and pelvis height changes. The crop prioritizes feet and pelvis and clips some head detail. Opened [flight-smooth-review.jpg](flight-smooth-review.jpg): the flight contact sheet keeps all four birds visible through climb, dive and recovery. Pink screen triangles are the authored feather-hit DOM veil, proven by identical paused-frame hide-only comparison; they are not stretched wing geometry ([veil-isolation.json](veil-isolation.json)).

## Persistent gate

The 87-row Scene Lab gate includes named contact checks for all 23 infected definitions: 13 ordinary human classes and 10 animal classes (dog, cat, crow, lion, lioness, gorilla, elephant, zebra, flamingo, monkey), plus the existing healthy dog trot/flee controls. Every named grounded actor must provide measured contacts and p95 ≤3 cm. Missing probes and absent actors fail. Crow's twenty submitted birds provide all 40 feet on every frame: no-contact acceptance requires complete finite aerial tracks, clearance above the unchanged 1.2 cm contact band, and at least 2 m travel per foot. Static or incomplete traces fail. [coverage.json](coverage.json) maps every definition to its named gate rows. Native retired cat/sprinter assets use the existing explicit rigid-asset audit exemption, not a contact exemption.

The four-bird dive row also requires zero living torso-proxy overlap and a real dive activation. Its new complete-track vertical-transition check limits every sole's consecutive-frame height step to 30 cm; the measured corrected maximum is **21.7 cm**, versus **168.6 cm** before smoothing ([flight-transition.json](flight-transition.json)). This is a render transition guard, separate from grounded foot slide. Centre separation and torso proxies cannot prove that wings never overlap in screen projection.

Existing scene criteria were extended to correct missing foot-slide acceptance requirements. No source specifications were otherwise changed. Courier/companion finite-clip assertions remain in the existing render-contract test group, with no test-count increase.

## Validation

- Typecheck: passed.
- Render-contract tests: 14/14 passed, including contact, incomplete aerial/transition traces and finite clip controls.
- Remote `sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh --whole-run npm test`: **passed**, exit 0, 106 passed / 1 skipped, **181.9 s / 240 s**, collected **150/150** cases. The documented wrapper reserves both runner slots for timing; plain concurrent runs previously timed out. No budgets or test limits changed.
- `SCENE_PORT=4958 npm run scene:gate`: **87/87 passed**, exit 0, zero known failures or missing rows, **14.0 min** after flight smoothing. [Full result](final-scene-gate.md); [motion values and assertions](final-motion-gate.json).
- Lint: passed. Runtime source validated: `7a78c10d`; subsequent commits contain report artifacts only. [Remote test receipt](final-unit.txt).

All browser captures use the headless lock/pool on port 4958. No push, deployment or merge performed.
