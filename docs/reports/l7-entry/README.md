# L7 entry and checkpoint recovery

Scope: audit A #1 (L6 → L7 composition load) and audit C #1 (production L7 death recovery). Current main was merged before implementation. No collision logic, assets or specifications are edited in this lane.

The handover crash came from `SimWorld.reset()` retaining `trapRescue`: its cached L6 reachable-cell mask was consulted by L7 rocket placement against the new district grid. Reset now unsubscribes and clears this level-owned service before assembling the next composition. A same-world L6→L7 regression reproduces the failure that fresh-world fixtures missed.

L7 now uses the existing mission checkpoint system. Begin captures `night-exit` after campaign application and survivor preparation. Acquiring the real rocket starts the director and captures `rocket`. Entering the evacuation corridor from either the east road or west alley captures `corridor`. The bus keeps ownership of boarding and the departure shot; its completion supplies the ordinary mission/campaign result exactly once, with automatic L8 handover.

Checkpoint seams retain the encounter roster, arrivals, pending director requests, passed flags, and bus identity, passengers, doorway interpolation origins/timers, departure progress and handover flag. Restore rebuilds the waiting bus blocker, player collider and departure input lock. Arsenal capture includes the actual retained pickup and restores campaign ownership/racks alongside the player.

The per-checkpoint regressions use the production level loader, actual rocket interaction, automatic graph checkpoints and lethal player damage. A separate west-alley test serializes the reached production snapshot, resumes a partially boarded bus, and dies again. It never injects a fixture mission or requests a test-only checkpoint. The existing full-input L6 route selects the machine gun with its real ordered key (the obsolete Shift+1 selected Kick), keeps its prior route assertions, and now asserts the L7 checkpoint and exact carried ids after Continue.

## Validation

| Check | Fresh result | Evidence |
| --- | --- | --- |
| Typecheck / lint / production build | PASS | E29 verifier and final static checks |
| Full units after lifecycle fix, Hetzner, ≤4 workers | 1,538 passed / 9 skipped | [summary](evidence/unit-final.json) |
| E29 verifier Node selection, Hetzner | 65 passed | [summary](evidence/E29-node.json) |
| All-level respawn + focused L7 regression selection | 45 passed before the final lifecycle fix; its five checkpoint/handover cases pass again after it | [selection](evidence/focused.json), [five production cases](evidence/handover.json) |
| Seed-1 complete L7, real sim policy | PASS, 8:39.917, zero deaths | [run](evidence/complete.json) |
| Real L6 apron→exit→Continue→L7 pickup and all three checkpoint deaths | 8/8 across WebGL/WebGPU, high/low, zoom 1/0.5; zero console/page/request errors; 29 exact carried ids and exact prior racks | [WebGL](evidence/browser-webgl2.json), [WebGPU](evidence/browser-webgpu.json) |
| Scene Lab final catalog | 48/48, both backends, tiers and zoom 1.5/1/0.5 | [WebGL](evidence/matrix-webgl2.json), [WebGPU](evidence/matrix-webgpu.json), [opened captures/review](review.md) |
| E29 verifier functional browser stage | 38 passed, including smoke/mobile/WebKit selections | [verifier](evidence/verifier-summary.json) |
| E29 native performance | RED: 1 passed / 5 failed; aggregate verifier exit 1 | [native cases](evidence/native-results.json) |
| Full T-E24-17 shelter→exit keyboard/mouse route | FAIL: courier stalls below the raised exit around x=255,z=15; mission remains playing after 3500 iterations | [failure](evidence/L6-full-input-failure.json) |

The focused browser handover begins with a documented L6 apron setup (graph prefix and entity placement); the final exit crossing, Continue click, L7 pickup interaction and death/retry are real production paths. It does not replace the failed complete L6 route or claim its rescue/zero-death/photo acceptance.

Headless browser batches use private ports 34761–34768 and the shared browser locks, one worker in final batches. The initial two-worker queue was released and replaced with one worker. Earlier queued batches were cancelled before rebuilding for the lifecycle fix. The complete E29 verifier has a 20 minute outer process-group limit, which also bounds its quiet reservation; no second quiet batch is chained. No admission wait exceeds 30 minutes. Main and origin/main were synchronized before implementation; local main remains `8718d0fb1` while the separately owned collision registry has not landed there. Collision logic and generated collision assets are unchanged by this lane.

## Remaining gates

The full L6 input route and strict native E18 measurements remain blockers wherever their recorded results are red. No epic status, acceptance criterion, performance budget, test deadline or required assertion has been relaxed. No deployment, push or merge into main was performed.


## Native performance: measured failures retained

The six-case native Metal batch ran for 122.8 s after exclusive quiet admission (load 2.98, zero other headless Chrome/local Vitest). All browser locks were released afterwards. E29 verification exits **1**. No second timing batch was started.

| Fixture / tier | Frame p95 ms / limit | Sim p95 ms / limit | Heap / original limit | Outcome |
| --- | --- | --- | --- | --- |
| District high | 14.2 / 16.7 | 1.8 / 4 | 341.04 / 400 | Existing test passes; observed maximum frame 55.2 ms is retained, not a strict 50 ms hitch signoff. |
| District low | **35.6 / 33.3** | 4.2 / 6 | 233.07 / 250 | FAIL frame p95; observed maximum 143.5 ms. |
| Final horde high | **18.1 / 16.7** | 2.2 / 4 | 84.12 / 400 | FAIL frame p95. |
| Final horde low | 29.2 / 33.3 | **6.8 / 6** | 72.21 / 250 | FAIL simulation p95. |
| Rocket high | 11.0 / 16.7 | 1.2 / 4 | **425.53 / 400** | FAIL retained heap. |
| Rocket low | **34.3 / 33.3** | 4.1 / 6 | **268.25 / 250** | FAIL heap; recorded frame p95 also exceeds its gate. |

Rocket/district retain their original `performance.memory` measurement in MiB; encounter tests retain CDP JS heap in decimal MB. Neither counter nor limit was changed. Geometry, entity and effect caps remain intact; these do not erase the frame/sim/heap failures. Raw metrics and [quiet conditions](evidence/quiet-conditions.jsonl) are committed beside the result summary. Five-cycle resource retention, real-phone measurements and a full E24 aggregate are not claimed.
