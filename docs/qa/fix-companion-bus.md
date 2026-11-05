# Movement P1 fixes — 2026-10-15

Audit: `epics-pipeline/reports/astra-movement-qa/README.md`, findings 1–3. Worktree: `lane/fix-companion-bus`, based on `2db2bde9b`.

## Changes

- L8 installs the existing protected companion system. The L7 result carries the corgi snapshot separately from rescued humans; arrival restores its identity, visibility and ground height. The APC boards and transfers the same dog. L9 restores occupants before supplying a dog for standalone/legacy starts, and L10 unhides the carried dog.
- Authored retained/interaction weapons cannot be fetched. An active fetch rechecks the player leash; ordinary dropped weapons and useful health pickups remain fetchable.
- L4/L7 scripted buses retain four wheel pivots through the existing static hinge batching path. Wheel angle follows signed distance, front steering follows route curvature, interpolation/LOD changes preserve travel, and teleports add no spin. No model or budget was changed.
- The fetch correction exposed a campaign blocker: at the infected cap, fatal bites leave civilian `finished` bodies with positive HP. L7 now follows L6's existing loss rule, records these bodies as dead, cancels their boarding, and excludes them from the transfer. The entities and roster history remain present. Regression tests cover positive-HP bodies and interrupted boarding.

## Visual review

Four new catalog scenes: `movement-l4-bus-wheels`, `movement-l7-bus-wheels`, `movement-l7-rocket-follow`, `movement-l8-corgi-follow`.

All **32 required game-camera sheets** were opened: four scenes × high/low × zoom 0.5/1 × actual WebGL2/WebGPU. Zoom 1.5 adds 16 numerical checks: **48/48 final matrix rows pass**, with backend and quality guards. The eight committed [review montages](../../test-results/fix-companion-bus/review/) show the required sheets; [matrix counters](../../test-results/fix-companion-bus/matrix-summary.json) identify their source rows.

- **L8:** the corgi remains visible behind the walking/running courier, catches up and follows the turn onto grass. No disappearance or visible floating in the sampled on-foot sequence. Maximum running lag: **2.877 m**.
- **L7 rocket:** the authored pickup ring stays at the wreck as the corgi follows the departing courier and the fence-side turn. Maximum running lag: **1.684 m**.
- **L4:** wheels stay attached during the bus turn; front wheels steer and settle straight. Circular wheel faces alone cannot establish spin. The ride test separately samples all four actual rendered wheel angles.
- **L7 bus:** the game camera follows the departing bus past lamps, parked vehicles and foliage. Wheel placement remains stable. The corgi is hidden aboard, with entity identity preserved in sim handover tests. Earlier cinematic/courier-camera pilots are superseded by the final bus-follow captures.

| Scene | WebGL2 montage | WebGPU montage |
| --- | --- | --- |
| Zoo follow | [View](../../test-results/fix-companion-bus/review/movement-l8-corgi-follow-webgl2.jpg) | [View](../../test-results/fix-companion-bus/review/movement-l8-corgi-follow-webgpu.jpg) |
| Rocket follow | [View](../../test-results/fix-companion-bus/review/movement-l7-rocket-follow-webgl2.jpg) | [View](../../test-results/fix-companion-bus/review/movement-l7-rocket-follow-webgpu.jpg) |
| Convoy wheels | [View](../../test-results/fix-companion-bus/review/movement-l4-bus-wheels-webgl2.jpg) | [View](../../test-results/fix-companion-bus/review/movement-l4-bus-wheels-webgpu.jpg) |
| Departure wheels | [View](../../test-results/fix-companion-bus/review/movement-l7-bus-wheels-webgl2.jpg) | [View](../../test-results/fix-companion-bus/review/movement-l7-bus-wheels-webgpu.jpg) |

Seeds: L4 convoy 1, L7 departure 29, rocket/zoo follow 32. Production preview builds, headless Chromium/Chrome, ANGLE Metal. Subsequent transport-restoration and finished-body membership corrections do not alter the sampled on-foot/empty-bus fixture states; their handover/loss cases are exercised by sim tests.

## Validation

- Final full unit run on Hetzner: **246 files / 1,465 tests passed**, one file / seven tests skipped.
- Full unit/sim/levels battery executed on Hetzner; its failed cases were repaired and rerun. The final campaign/loss batch is **24/24 passed**, including continuous **L1→L9** and **L1→L10 credits**. All level files have green coverage after reruns. Corgi **159** survives from the L7 result into the crossing handover; L7 transfers 26 living humans.
- Isolated timing/focused run: **49/49 passed**. Final fetch/handovers/wheel/follower regressions: **25/25 passed**. Latest zoo/photo-spot regressions: **5/5 passed**, including the full 100-infected stress cap.
- Local and remote typecheck/lint/build pass; the latest fixture-only static recheck also passes.
- Browser smoke: **16/16 passed**. Final combined browser batch: **18 passed, one L8 phone stress failure** before correcting the party placement in that fixture.

The complete unit/sim/levels battery ran on Hetzner. Its initial nine failures were retained in `test-results/fix-companion-bus/runner/full-unit-sim-levels.log`: five shared-capacity timing failures, the then-unfixed numeric result type and L8 rescue count, and the two continuous campaigns exposing the finished-body blocker. Isolated timing and focused regressions were rerun after the respective fixes; no limits or test expectations were relaxed to hide a failure.

The general deploy browser gate completed **90 passed, one flaky case passed on its configured retry** (WebGL/high/zoom 1 L4 respawn click target). All **17/17 ride configurations** pass, covering both tiers/backends and 60/120 Hz, uneven 120 Hz, 30 Hz and uneven phone cadence. Maximum jitter: **0.5634 px RMS** against unchanged **0.6 px**; minimum advancement of every wheel: **20.3649 rad**.

The scene matrix peaks at **72 draws / 212,229 triangles high**, and **72 draws / 102,493 triangles low**, within E18's **600/1.5M** and **300/500k** limits. These are deterministic counters, not frame timings.

L7's performance fixture now measures `Runtime.getHeapUsage.usedSize`, matching the existing L8 gate. `performance.memory` includes WASM/buffer backing storage and had reported 504.2 MiB high / 250.23 MiB low. The **400/250 MB limits remain unchanged**; the raw CDP audit is retained with the result. The corrected L7 guard passes at **81.98 MB high / 69.92 MB low**; raw backing storage is **446.43 / 192.49 MB**. L7 frame p95 is **10.7 / 18.3 ms**, sim p95 **1.7 / 4.3 ms**, draws **265 / 103**, triangles **790,787 / 170,352**.

L4 native high/phone-low stress profiles pass: high war/collapse p95 **8.7/10.5 ms**; low median **21.9/23.9 ms**. L8 high/low stress profiles pass (frame p95 **9.4/6.9 ms**, sim **2.8/2.2 ms**). The phone fixture failed twice: initially **33.9 ms frame / 7 ms sim**, then **33.7 / 6.5 ms**, against unchanged **33.3 / 6 ms**.

The stress fixture teleported the courier across the zoo while leaving the newly installed dog at the entrance. It now uses the existing `companion.respawnNear()` after that setup teleport, placing the complete party at the measured photo spot. A new sim regression verifies the same visible dog beside the courier, correct ground height and all **100 infected**. **Phone frame/simulation budgets after this fixture correction remain unmeasured.** After a six-minute fairness break, the single nonblocking all-slot attempt returned **75 (busy) in 0.0 s**. It did not queue or hold a quiet reservation. Further browser measurement stopped under the requested slot-wait limit; the earlier phone failures remain reported, and no performance limit was changed.

Quiet reservations are bounded and released: ride **376 s**; first L4/L7/L8 budget batch **733 s**; final combined smoke/budget batch **442 s including admission** (600 s cap). The first two reservations were separated by the general browser gate; the final batch was queued after a further six-minute break. No baseline worktree or extra build copy was created. Temporary source/fixture files were removed.

Raw sheets, per-config ride JSON, browser reports, runner logs and initial failures remain in `test-results/fix-companion-bus/`. No deployment or merge; no specs, forbidden reference assets, budgets, or `src/assets/staticCollision.ts` changed.
