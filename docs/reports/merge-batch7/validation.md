# Batch 7 integration evidence

**Integration remains RED for two Zoo CPU timing gates; fresh native timing is unmeasured.** The requested lanes are integrated in the worktree; nothing is deployed or merged into main. The original test failures and unmeasured checks remain explicit below.

## Source and conflict resolutions

Base: `8718d0fb1`. Group A: collision `1578cd4d4`, then performance `991193653`. Group B: audit A `d220a036f`, B `782f0ae88`, C `7eac591ce`. Integration source head: `e9f81030b`; the buffer correction is `0cf73a31e`.

- Performance fixture: preserve walkable-support exclusion from obstacle walls, campaign AI ownership, original L5 cellar pose, current D-SUBWAY start, and the explicit 200/100 stress caps.
- Matrix: union collision, E18, `qa-l6-audit-cohort` and `qa-late-*` entries; also include audit B's light-lab scene. The two new armed courier cases are covered by `e18-*`.
- L4 smoothness: both incoming versions sample the authored player bus. Keep audit A's additional bus-asset and on-screen-subject assertions with all original jitter, wheel and sample limits.
- Runner: use audit C's shared, sorted `runnerLevels` export including graph-free L7; remove the duplicate local list. L7 audio emissions preserve the collision lane's passenger physics synchronization.

`src/assets/staticCollision.ts` matches the base. No forbidden paths or dependency versions change. The three audit reports and their authorized criterion/status corrections are retained.

## Static and full Node gates

Both groups pass typecheck, lint and a fresh production build. Full unit/sim/levels commands run on Hetzner with `--maxWorkers=4`; no local full Vitest sweep is used. Each job tests a private copy, so integrating Group B does not change the running Group A source.

Group A completes in 56m13s: **3,032 passed / 3 failed / 9 skipped**, across 483 files (477 pass / 3 fail / 3 skip). The failures are Zoo S2 high (**4.185939 ms >4 ms**), L9 0-HP handover (30-second timeout), and L10 R4–R7 route high (**4.788476 ms >4 ms**). Continuous L1→L9 and L1→L10 campaigns, both complete/newbie L1→L6 campaigns, all ten collision-invariant cases, production validation and both courier low-skin rig contracts pass. Group B completes in 60m48s: **3,047 passed / 7 failed / 11 skipped**, across 493 files (483 pass / 7 fail / 3 skip). All seven failures are timing assertions; every executed functional case passes, including both L1→L6 campaigns and the new L7 standalone completion. Two additional skips are unchanged conditional offline weapon-audio loudness checks on the runner without ffmpeg; a focused final-source retry on the reference runner passes **6/6**, including both loudness checks. The audio atlas is present on both; the Group B runner has no ffmpeg executable. The other nine skips are the existing macOS-only lock tests and two L4 probes. Original logs are retained separately from retry outcomes.

## Fresh E18 heap and counters — final Group B build

The unchanged `e18-memory.spec.ts` and `e18-counters.spec.ts` pass **9/9 on final Group B**, including audit A's 24-person low shelter cohort. Corrected Group A also passed 9/9, with +2.96%/+5.33% retained heap ([earlier evidence](e18-group-a/)). The final tests obtained immediate browser admission after independent Node work; the slot-wait allowance was not restarted.

| Five-load retention | High | Low |
| --- | ---: | ---: |
| First / last JS heap, decimal MB | 80.56 / 82.96 | 69.14 / 72.86 |
| Heap growth, limit +10% | +2.98% | +5.38% |
| Geometry count, first / last | 539 / 516 | 551 / 528 |
| Texture count, first / last | 53 / 54 | 41 / 42 |
| Maximum L6 JS heap, decimal MB | 66.18 / 400 budget | 59.60 / 250 budget |

| Stress fixture | Tier | Draw calls | Triangles |
| --- | --- | ---: | ---: |
| Horde | high | 66 | 504,384 |
| Horde | low | 66 | 136,966 |
| L5, female | high | 285 | 906,566 |
| L5, female | low | 242 | 488,127 |
| L5, male | low | 242 | 492,783 |
| L6 | high | 119 | 321,939 |
| L6 | low | 106 | 176,692 |

All actor count/cap, exact counter repeatability, quality, shadow and bloom assertions remain unchanged. [Final compressed raw JSON and captures](e18-final/); the completed final log is retained in evidence.

## WebGPU buffer correction

The initial WebGPU matrix passes all 24 courier rows but fails 18 environment rows. Errors say a WebGPU buffer is used after destruction; some subsequent environment views are blank. [Original failed matrix](group-a-webgpu/index.md).

Three r186 stores an interleaved buffer under `attribute.data`, but its WebGPU disposal deletes the wrapper's cache key. The explicit geometry retirement introduced by the heap fix exposes that stale entry. The correction installed by `Renderer.init` retires the shared data key once, allowing later columns/levels to upload a fresh buffer. It preserves geometry retirement and all budgets. The regression uses Three's actual WebGPU attribute utility and verifies a fresh buffer after retirement; it and the existing shared-geometry retention regression pass **2/2** on Hetzner. Typecheck/lint/build pass. A later immediate-admission rerun on final Group B passes **60/60 WebGPU matrix cases**, including the formerly failing 18 environment rows, both couriers, the 24-person low cohort, L7 departure and audit B's light lab. This confirms the correction in the actual backend without a new queue wait.

## Game-camera captures and review

**Final focused WebGPU: [60/60 pass](final-webgpu/index.md)**, both tiers and zoom 0.5/1/1.5, zero console errors. This supersedes the initial GPU failure for the touched-scene acceptance. **Final focused WebGL2: [60/60 pass](final-webgl/index.md)** on the same final source, tiers and zooms. It obtained immediate one-unit admission after the canonical job released its two units. Both complete current backend matrices are retained; earlier Group A captures remain for comparison.

[WebGL2 matrix](group-a-webgl/index.md): **42/42 pass**. [Initial WebGPU matrix](group-a-webgpu/index.md): **24/42 pass**, all courier rows green, 18 environment rows red as above. Both verify the requested backend and actual quality. Metrics are gzip-compressed next to the contact sheets.

Added `tests/scenes/catalog/e18-courier-armed-{female,male}.json`: tier-2 gear and bat, standing through frame 60, then running and turning at the game follow camera. The full matrix captures both models at high/low and zoom 0.5/1/1.5 on both backends. The first f0 tile precedes camera settling; later tiles carry the authored zoom.

Opened the close and default zoom courier sheets across both models/tiers/backends, plus wide low-tier views. The multicolored cap, female ponytail, teal backpack, pads, pale shoes and bat remain attached and readable through standing, strides and turns. No missing body sections, cubes or detached gear are visible. The low-tier close silhouettes match high; wide zoom retains color blocks but is too small for fine gear judgment. The actual WebGPU backend is confirmed in metrics. Those initial sheets are retained for comparison. Final corrected WebGPU sheets were also opened: both low couriers keep their cap, pack, bat and planted strides; L4 retains the full corpse cluster; L6 shows its populated bed/supply rows; L7 survivors gather and board before the camera pans over the departing bus and fire-lit night street; the light lab retains the trailer beam and pavement cone. High and low show the same choreography. Close L7 framing crops the early approach behind foliage, so the wider view carries route context.

Opened WebGL2 low z1 environment sheets: L4 retains its corpse cluster through f7200; the L5 isolated shop-culling scene shows the courier at the lit wall; L6 shows bedrolls, supplies, stairs, figures and lantern pools, though the figures are dark. Opened the fresh E18 low male L5 and low L6 budget PNGs too: dense red/violet ash obscures much of the ruined L5 plaza, while L6's lit courier cap is overbright against the dark shelter. The original L5 cellar player pose is retained; the plaza overview is not close courier-quality evidence. Counter passes do not establish a full readability sign-off.

## Inherited timing red and load retries

Zoo S2 high fails the initial full run and an unchanged isolated retry: **5.087537 ms p95 > 4 ms**, low passes. The incoming collision report already records **4.097124 ms >4 ms** on its identical simulation ([incoming evidence](../collision-registry/merge-batch6/README.md)). A profile preserves 200 actors and 51 special activations; a query optimization trial did not resolve the miss and was reverted. No warmed/profiled pass replaces acceptance.

Group A also reports the existing 30-second 0-HP L9 handover timeout and the L10 R4–R7 high route p95 miss (4.788476 ms >4 ms). The route was initially misclassified from its duration before the final assertion detail printed; it is a timing failure. Group B's initial timing phase reports seven high-tier budget failures, including unchanged Alpha/zoo runtime. A complete timing-project retry and separate load-file retries reserve both slots on Group A's runner (`94.130.181.173`). The complete isolated timing project finishes **204 passed / 2 failed** across 27 files. Five of the original seven high-tier failures pass; Zoo S1 remains **4.053173 ms >4 ms**, and Zoo S2 remains **4.999419 ms >4 ms**. Both are recorded as current budget misses. Separate isolated L9 handover **3/3** and L10 route **2/2** retries pass with unchanged deadlines/budgets. The first L9 retry queued on Group B's busy runner was cancelled before execution and consolidated into these retries.

## Browser admission and performance limits

At 10:39 UTC cumulative browser admission wait reached approximately 30 minutes across the original and corrected canonical gate attempts. The queued canonical gate and corrected WebGPU matrix were cancelled. The native timing batch acquired slots but never passed quiet preflight; it was released well before 20 minutes without measuring a test. No desktop/phone frame-time pass is claimed.

After Group B's fresh build, immediate two-unit canonical-gate and one-unit focused-matrix admission both returned 75. No further queue wait was added. At that checkpoint the final Group B browser checks were unmeasured. After Group A Node completion, nonblocking checks found capacity: final heap/counters pass 9/9, final focused WebGPU passes 60/60, and the canonical gate starts with immediate two-unit admission on the fresh build. Its smoke gate passes **6 Node smoke cases and 31 browser cases**, with zero browser failures/skips ([browser JSON](evidence/smoke-browser.json)). The full canonical WebGPU matrix passes **960/960** in **46m19s**, at high/low quality and zoom 0.5/1/1.5 ([complete row evidence](evidence/canonical-matrix.json.gz)). The canonical e2e selection passes **120/120**, zero failures/skips/flakes ([complete browser JSON](evidence/canonical-browser.json)). Its regex also selects 12 performance cases (cure mist and finale budgets); their ordinary-gate pass is preserved, while quiet timing acceptance was attempted separately and refused before locks. The final focused WebGL matrix obtained immediate one-unit admission after the canonical reservation released. The final native batch (bus smoothness, E18 desktop/device proxy, L2–L6 budgets and the 12 canonical L10 performance cases) was rejected before locks because another headless browser remained active, at load 2.45. It returned 75 without reserving slots or restarting the exhausted queue allowance. Native frame timing, bus smoothness timing and physical iOS/Android acceptance therefore remain unmeasured. The 12 canonical performance passes are not claimed as quiet timing acceptance ([attempt metadata](evidence/native-attempt.json)). The canonical Group A script printed static/build zeros before its queued smoke/browser phase; that output is not a browser pass.

[Admission cutoff](browser-wait-cutoff.txt) · [command logs](evidence/).


Final collision captures: [12 passing WebGPU rows](collision-final-webgpu/index.md), both tiers and all three zooms. Opened the high z1 and low z0.5 sheets for courier/corgi surrounded from eight directions and Alpha charge at the tank. The courier's cap, hair and pack remain visible as the group closes; the corgi stays beside the player with its own silhouette. In the charge sequence the red directional telegraph precedes the Alpha's approach, the courier is knocked down beside the tank and gets back up by f150. Close framing crops parts of the tank/approaching Alpha. Projected overlap does not establish physical penetration; the registry gates provide that evidence. Unused cells after the last labelled frame are black.


Final WebGL review: opened all six armed low-courier sheets (both models, zoom 0.5/1/1.5), the female high z0.5 comparison, low L6 cohort and L7 departure, and high light-lab views. The cap/hair, pack, bat, shoes and stride/turn poses match WebGPU; no missing body pieces or detached gear are visible. Wide zoom retains the color silhouette, with fine details judged in the close view. L6 keeps populated bed/supply rows; the L7 group boards and its bus moves through the same fire-lit night setting; the trailer's beam remains a lit pavement cone. Both backend contact-sheet indexes and compressed metrics are committed.

No tests, tolerances, population caps or budgets were loosened. The unsuccessful query optimization trial was reverted. Generated tracked `test-results/` churn is restored after exporting the evidence; only the requested report artifacts are added. No deployment or merge into main was performed.
