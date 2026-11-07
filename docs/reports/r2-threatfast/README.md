# r2-threatfast — 480-second goal not achieved

The final ordinary `npm run qa:threat` completed on the isolated Hetzner cx33 in **597.2 seconds**, with **0 flags**. The original driver took **1,144.1 seconds** on the same runner. Every recorded game value and per-level verdict is identical. The existing 600-second budget passes in this run, but the requested **480-second target is missed by 117.2 seconds**. The goal is not complete.

| Run | Audit time | Full budgeted command | Flags |
| --- | ---: | ---: | ---: |
| Original driver, same runner/game snapshot | 1,144.1 s | Diagnostic run outside the known-failing 600 s wrapper | 0 |
| Final runner candidate `d471f170` | 589.5 s | **597.2 / 600 s** | 0 |
| Final local candidate `d471f170` | 466.5 s | **474.5 / 600 s** | 0 |

The brief's 2.5-hour work period was exhausted while the last check was active. That check was allowed to finish, as required by the brief. No further optimization changes were made afterward. No deploy or push was performed.

## Changes

- A fixed pool executes 31 independent native routes, passive routes, census runs, and seed votes. Linux uses four simulation workers; the shared Mac defaults to two. Persistent workers reuse loaded modules and dispatch the longest stages first.
- L3 shares one native complete route per seed between threat, army-line, and survival receipts. The original 600-second survival limit remains: a route exceeding it falls back to the original survival fixture.
- L4's independent barrier census grids receive coalesced live blocker updates instead of repeated district rebakes. Native blocker calls are forwarded unchanged; unknown grid revisions still invalidate the cache.
- Per-stage timings are recorded in `stages.json`. All seeds, full passive windows, clauses, thresholds, game source, and verdict rules are preserved.

## Equivalence and validation

The runner comparison checks **31,220 values**, including phase durations, counts, rates, collision receipts, state hashes, seed votes, and every per-level verdict: **zero differences**, including zero float differences. Only root provenance, worker count, total wall time, and per-level wall time are excluded. [Runner comparison](equivalence.json).

The local comparison checks **31,218 values**, also with zero differences. The latest focused L4 comparison checks **5,314 values**. [Local comparison](local-equivalence.json), [L4 comparison](l4-census-equivalence.json).

`npm run typecheck` and `npm run lint` pass. The full unit suite passed **107/107 tests in 27 files**; after the final census change the two relevant tool files passed **11/11 tests**. The comparator's negative control detected a deliberately changed nested phase duration. Test budgets remain 150 cases, 45 files, and 600 seconds for `qa:threat`. [Validation, timing receipts, and identical game source tree hashes](validation.json).

Both runner measurements used `mi-runner-1` (cx33, four vCPUs, Node v26.0.0), with local fallback disabled and both runner slots held for the entire command. The original driver archive only adds timing logs to `08e7cbd`; its diagnostic execution bypasses the wrapper so the complete slow baseline can be collected. The final candidate uses the unchanged budget wrapper.

## Remaining performance gap

The final 31 stages total **2,332.1 worker-seconds**, with maximum concurrency four. At these measured stage costs, perfect scheduling alone has a **583.0-second lower bound**, close to the 589.5-second audit. Further progress must reduce work inside the stages; additional queue ordering cannot recover the remaining 117.2 seconds.

The native simulation dominates the sampled L5 passive and L4 skilled stages. A precompilation experiment preserved values but showed no wall-time improvement (61.3 s bundled versus 60.5 s through `tsx`) and was discarded. No compiler dependency or runtime change from that experiment is included.

## Evidence

- [Runner before](before-runner.json.gz), [runner after](after-runner.json.gz), [original driver](baseline-driver.ts.gz), [reproducible comparator](compare.mjs).
- [Runner stages before](stages-before-runner.json), [runner stages after](stages-after-runner.json), [local stages](stages-local.json).
- [Local before](before-local.json.gz), [local after](after-local.json.gz).
- CPU profiles: [L5 passive](cpu-profile.json), [L4 skilled](cpu-profile-l4.json), [L3 shared seed](cpu-profile-l3.json). Raw logs and profiles remain under `test-results/r2-threatfast-*`.

## Commits

- `03951830`: share L3 routes and parallelize L5 votes.
- `6ab7378a`: fixed stage pool and per-stage profiling.
- `d471f170`: incremental barrier census bakes and measured stage ordering.
