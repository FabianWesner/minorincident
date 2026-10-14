# L10-D3 — research campus and destroyed corridor

Scope: the L10-D3 row of E32, extending the existing D-CURE district/streamer. Covers the R5/R6 geometry and data portions of AC03/05/06/15/16/27/28/30/31. Terminal recording, unique backpack controller and encounter spawning remain with E2; R7 assembly remains with D4. Specs and reference assets are unchanged.

R5 has a 500×400 m envelope and 550 m route; R6 has an 800×300 m envelope and 1,000 m route. R4/R5 share (2467,-5), R5/R6 share (2917,-5), and R6 hands over to D4 at (3697,-25). Region timing remains 6/8 minutes. These are travel geometry checks, not a claim of the final 45–50 minute combat/story calibration.

| Anchor | Position (x,z) | Purpose |
| --- | --- | --- |
| cure-research-entry | 2467,-5 | Campus entry checkpoint |
| cure-terminal | 2707,41 | Terminal operator position beside the low lab |
| cure-canister | 2713,41 | Reachable canister pedestal pickup position |
| cure-research | 2807,45 | Lab exit checkpoint after carrying |
| cure-corridor / rocket-pickup | 2937,-5 | Rocket supply checkpoint before denser corridor |
| cure-complex | 3697,-25 | D4 service-platform entry seam |

The campus uses the existing lab-main/annex, isolation tent, generator and quarantine fence modules, ambulances, device console and canister pedestal. Its quarantine fence has an open route gap. The corridor uses existing wrecks, military supply truck, drum stacks, barricades and jersey barriers. A continuous rubble line blocks the abandoned straight road; the authored northern breach remains clear. All structures remain low-rise.

`routes.json.threatDepth` records the seven regional distance intervals and high/low resident density ranges, with dogs/regular Alphas and group sizes where specified. R5 targets 55–85/35–55, 2–4 dogs and 1–2 Alphas; R6 targets 80–130/50–75, 3–5 dogs, 2–3 Alphas and groups of 20–35. Counts include mixed threats. `cureThreatAtDepth` selects data without consulting loadout or spawning entities; encounter owners enforce the existing shared 200/100 cap.

The generated 198 terrain cells use the existing 100 m chunk contract and bounded 25/9 residency. The base GLB is retained only as authoring output; runtime continues to load local cells and the coarse horizon. Cell seam bounds remain within 2 cm. See [validation.json](validation.json) for triangle caps, route sim p95 and unit totals.

Final focused remote validation: 38/38 pass, including both-tier R5/R6 input-driven traversal, rocket checkpoint transaction, carried-state restoration at complex, all-district support seams and all-level respawn regression. The fixture starts at research entry after establishing the earlier arsenal prerequisites; it sets E2-owned terminal/carry flags at their reached anchors. It does not claim to test an unimplemented terminal/backpack controller. Final full unit: 1,390 pass, 7 skipped (one remote worker). Typecheck/lint and fresh production build pass.

Scene catalog fixtures: `l10-d3-*` cover research entry/terminal/pickup/exit, rocket supply, corridor breach and both new region seams. Final matrix: **108/108 pass**, WebGL2 and actual WebGPU × high/low × zoom 1.5/1.0/0.5, nine scenes per configuration. The binding 1.0/0.5 pairs are included. Captures and the review are preserved in [review.md](review.md); all four backend/tier overview sheets were opened and inspected. The lab forecourt, reachable terminal front, canister glow and rocket fixture are readable; the seam ground is flat and feet remain supported.

Native Metal performance: **8/8 pass**, WebGL and actual WebGPU × high/low × zoom 1.0/0.5, one headless Chrome worker under `tools/perf/quiet-run.sh`, after a fresh build. Each config sweeps seven entry/story/breach/seam positions. The preflight records all four browser locks held, no other headless Chrome/local Vitest, and load 2.95. See [perf](perf/) and the compact validation table.

| Quality | Max frame p95 | Max sim p95 | Draws | Triangles | Heap MB | Detailed cells |
| --- | --- | --- | --- | --- | --- | --- |
| High | 5.9 ms | 0.60 ms | 102 | 86,201 | 194.58 | 25 |
| Low | 5.8 ms | 0.50 ms | 91 | 26,337 | 157.84 | 9 |

These are greybox measurements on the Mac. They do not claim final mixed-crowd assault/mist, five complete-region memory cycles, mobile-device FPS or full-level timing. Those remain with E2/D4/Q6. No budget or test threshold was changed.

Broad sim + tests/levels diagnostic: **1,204 pass / 20 fail / 2 skip**. [Failure details](sim-levels-summary.json). This snapshot predates the terminal-facing correction; the final focused layout/route/support/respawn rerun has **38/38 pass**, including the added operator-socket check. The broad failures concern unchanged L1/L2/L3/L5/L6/continuity and 200-actor Alpha/Mega/zoo timing fixtures. No baseline comparison was run in this lane. They remain failures, and this report does not claim a green campaign/whole-E32 gate.

The first full unit rerun after the terminal-facing correction timed out only in the unchanged 300 s production asset validator (1,389 pass / 1 timeout / 7 skip). It passed alone in 228 s. A subsequent complete **one-worker** run is green: **1,390 pass / 7 skip**, with the same tests and limits.

`npm run verify -- E32`: **green** on the final source, with remote tagged unit/sim checks, **31/31** headless browser tests (including smoke), and **8/8** native R1–R4/seam budget configurations. The separate D3 R5/R6 native sweep also passes **8/8**. See [verify.json](verify.json). The broad diagnostic remains red as recorded above; serializing the selected E32/smoke checks preserves every limit and passes the tagged Mega timing fixture.
