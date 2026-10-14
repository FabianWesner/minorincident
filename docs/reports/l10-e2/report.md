# L10-E2 encounters and cure

Scope: E32-AC05/06/09 (R5/R6), AC07 (R5/R6 dog placements), AC15 (recording interaction), AC16 (unique mission item/backpack), AC27 (approach checkpoint inventory). Campus/corridor geometry and rocket checkpoint were already present; this lane wires the recording and pickup into the shipped mission graph and adds their late-region encounters. Finale activation/release and full-level pacing remain owned by the later lanes.

R5 has 66/42 regular infected, four dogs and two stock Alphas (72/48 total high/low, before the persistent Mega). R6 has 96/60 regular infected, five dogs and three stock Alphas (104/68). Both are within the authored depth targets. The global director cap and existing chunk snapshots own spawn admission and sleep/wake; inventory never triggers spawning. R5 approach and R6 group spacing fit the low-tier three-by-three chunk window so local peaks can meet the curve, rather than only meeting a region-wide sum. Two existing medkit anchors now participate in the same once-only pickup ledger.

The terminal's ordinary interaction emits `L10.research`, so the existing processed recording and subtitle panel deliver all five story facts. The separate canister interaction grants `cure-canister` once and sets `cure-carried`. Delivery wording continues through the laboratory exit, rocket checkpoint and complex approach. The item uses mission snapshots, never a weapon slot or physical droppable entity. The existing rocket transaction captures entitlement with its checkpoint. Installation clears carried state through the existing mission action.

Presentation loads the existing canister only for L10, preserves its baked colors, aligns its authored back socket to the character's backpack socket and follows the animated bag for both variants. The canister pedestal includes the terminal copy in one static mesh; it disappears when collected and returns on a pre-pickup restore. The carried mesh disappears after installation. No asset files, collision bake, dependencies or specs were changed.

## Functional evidence

- Typecheck, lint and production build pass.
- Remote E32 + smoke selection: 28 files / 93 tests pass.
- Full remote unit suite: 219 files / 1,401 tests pass; one file / seven tests skipped.
- Focused remote sim: nine existing progression tests, four encounter/cure tests and two walking-route tests pass. Seed 32 high/low walking runs from the R4 military checkpoint reach R7 without a death, carrying exactly one cure with rocket entitlement (31,482/31,631 ticks; sim p95 about 1.285/0.639 ms). Spatial fixtures verify the resident depth peaks; spawn slot IDs remain unique across checkpoint restoration and streaming revisits.
- Death fixtures explicitly expire the shared two-second grace and assert zero HP before waiting for respawn. All R1–R7 approach checkpoints and the installed ready checkpoint restore expected item/weapon state. A separate two-attempt death-before-exit fixture returns the cure to the terminal. JSON save validation and reload preserve one mission item. At least ten stock rocket launches after reacquisition preserve that same single item.

## Browser, visual and performance evidence

The completed courier-centered catalog captures pass numeric gates 24/24 on WebGL2 and 24/24 on WebGPU. The two threat fixtures subsequently gained an Alpha-centered camera target; those follow-up matrices still require a run. Every row records the actual requested quality tier. Catalog scenes: `l10-e2-terminal`, `l10-e2-backpack`, `l10-e2-quarantine`, `l10-e2-rockets`; production graph/inventory and encounter data, game camera, both quality tiers, zoom 1.0/0.5 (plus catalog default 1.5), WebGL2/WebGPU, CPU throttle 4. The real-input browser test exercises terminal/pickup/rocket input and death retry. The R5/R6 E18 probe now advances beyond the one-minute encounter gate before measuring, so its resident crowd is exercised.

Validation infrastructure: the first additional sim/verify sync selected a runner cache with a stale hardlinked Git index lock. No Git update process was active; the stale lock was removed only from this worktree's cache. The first perf attempt lacked a pause before deterministic stepping, stopped during fixture setup and was corrected. Broader sims exposed the old D3 noncombat walker dying to the new threats; it now uses acquired weapons, existing nav steering and pointer aim while moving, with its route/collision/timing assertions retained and a zero-deaths assertion added. No test or performance thresholds were changed.


### Capture review

See [WebGL2 matrix](webgl2/index.md) and [WebGPU matrix](webgpu/index.md). The game-camera terminal sheets show the illuminated terminal and a readable recording subtitle containing the airborne-agent, healthy-human/animal safety, infected lethality, no-reversal and dispersal-complex facts. Backpack sheets show one teal/white cylinder attached behind the orange-shirt courier; the separate pedestal is absent after pickup. Close zoom makes the frame/window distinction readable, and the cylinder follows the animated bag across sampled frames. The dark pavement, crowd spacing and cyan attack footprint remain readable in the R5/R6 sheets.

Visual gate is **not closed**: true-low quarantine/rocket sheets show the regular Alpha as jagged black/white triangles rather than a clean human silhouette. Compare [E2 low quarantine](webgpu/l10-e2-quarantine@low-z1/sheet.jpg) with the pre-existing [Alpha asset after capture](../alpha-asset/after/qa-alpha-asset-lod2/shot-0030.png), which also shows a spiky outline. High-tier authored encounter specials are mostly outside these courier-centered frames. Centered follow-up matrices and a full-size probe require a run; no speculative shared renderer change is retained. This defect was surfaced to the orchestrator.

The Scene Lab harness previously let full UI override a requested low URL tier with auto/high. This lane pins the requested tier in settings before loading and asserts the actual render tier afterward. Both matrices were rerun after that correction; their low captures are actual low, not the invalid earlier run. HUD-enabled scenes now retain mission subtitles so the recording can be reviewed.

Final real-input browser, final eight-way resident-density/carried-item E18 probe, centered threat matrices, and the verifier browser/perf stages never received browser admission. Their E2-only process trees were stopped at 09:44 CEST to keep the lane within its three-hour budget; other lanes’ processes and shared locks were left alone. These gates remain open. Earlier eight-way R5/R6 performance measurements passed all unchanged E18 caps, but predated the tighter low-residency spacing and carried-item fixture and therefore do not close the final performance gate. No deploy or merge is authorized by this lane.


### Remaining commands

After a fresh production build, run the following with unique free ports and the shared wrappers:

- `E2E_PORT=34870 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/l10-cure.spec.ts --project=chromium --workers=1`
- `E2E_PORT=34871 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l10-campus-corridor-budgets.spec.ts --project=chromium --workers=1`
- `SCENE_PORT=34873 SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --matrix --filter 'l10-e2-quarantine,l10-e2-rockets' --backend webgl2 --jobs 1 --throttle 4 --query ui=1`
- Repeat the preceding matrix with another unique port and `--backend webgpu`; inspect the centered Alpha/dog captures before closing the visual gate.
- `MI_VERIFY_REMOTE_SIM=1 E2E_PORT=34867 npm run verify -- E32` (remote sim phase has already passed; final browser/perf phases are outstanding).
