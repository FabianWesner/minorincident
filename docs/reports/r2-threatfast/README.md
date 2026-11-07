# r2-threatfast — 480-second goal not achieved

The latest completed default `npm run qa:threat` audit ran on the isolated Hetzner cx33 in **589.6 seconds**, with **0 flags**. The original driver took **1,144.1 seconds** on the same runner. Every recorded game value and per-level verdict is identical. The existing 600-second budget passes, but the requested **480-second target is missed by 109.6 seconds**. The goal is not complete.

| Run | Audit time | Full budgeted command | Flags |
| --- | ---: | ---: | ---: |
| Original driver, same runner/game snapshot | 1,144.1 s | Diagnostic run outside the known-failing 600 s wrapper | 0 |
| Runner `d471f170` | 589.5 s | 597.2 / 600 s | 0 |
| Runner `c72a78b7` | 585.7 s | 593.4 / 600 s | 0 |
| Latest runner `56cb8500`, four workers | 581.4 s | **589.6 / 600 s** | 0 |
| Latest local `56cb8500`, two workers | 404.8 s | **407.6 / 600 s** | 0 |

The full two-worker runner comparison timed out after **601.1 seconds**, with only **six of 31 stages complete**. It produced no complete audit receipt. Four workers remains the fastest verified runner configuration. [Two-worker timing](two-worker-runner-budget.json), [completed stage timings](two-worker-runner-stages.json). No deploy or push was performed. The original 2.5-hour work period ended with the report at `45532cb6`; subsequent work under the active goal added selective observers, census reuse, and runtime configuration controls.

## Changes

- A fixed pool executes 31 independent native routes, passive routes, census runs, and seed votes. Linux uses four simulation workers; the shared Mac defaults to two. Persistent workers reuse loaded modules and dispatch the longest stages first.
- L3 shares one native complete route per seed between threat, army-line, and survival receipts. The original 600-second survival limit remains: a route exceeding it falls back to the original survival fixture.
- L4's independent barrier census grids receive coalesced live blocker updates instead of repeated district rebakes. Native blocker calls are forwarded unchanged; unknown grid revisions invalidate the cache.
- Extra L3 seeds collect the army count and checkpoint attack rate they report. Extra L5/L7 seeds collect the follower pace samples they report. Unused observation work is omitted; every native simulation tick, final state hash, simulated duration, and reported sample remains.
- The main observer combines duplicate infected scans, avoids repeating distance queries after an identity has entered a phase's near set, and reuses entity membership arrays until `EntityStore.revision` changes. These arrays contain live records, so component and state changes remain visible.
- Per-stage timings are recorded in `stages.json`. All seeds, full passive windows, clauses, thresholds, game source, and verdict rules are preserved. No dependency or compiler flag was added.

## Equivalence and validation

The latest runner comparison checks **31,220 values**, including phase durations, counts, rates, collision receipts, state hashes, seed votes, and every per-level verdict: **zero differences**, including zero float differences. Only root provenance, worker count, total wall time, and per-level wall time are excluded. [Runner comparison](equivalence.json).

The latest local comparison checks **31,218 values**, also with zero differences. [Local comparison](local-equivalence.json).

Focused native controls independently verify all eight L5/L7 extra-seed receipts, including hashes and simulated times; L3's smaller observer matches the full observer for all three seeds. The census controls match the complete L4 skilled run, observation, and hash, plus the complete L5 passive run and observation. [Follower controls](follower-selective-equivalence.json), [L3 controls](l3-selective-equivalence.json), [census controls](census2-focused-equivalence.json).

`npm run typecheck` and `npm run lint` pass. After the census changes, the full unit suite passed **107/107 tests in 27 files**. The comparator's negative controls detected a deliberately changed nested phase duration and an empty-array/object type mismatch. Test budgets remain 150 cases, 45 files, and 600 seconds for `qa:threat`. The current census records 150 cases and 43 files. [Validation, timing receipts, and identical game source tree hashes](validation.json).

Runner measurements used `mi-runner-1` (cx33, four vCPUs, Node v26.0.0), with local fallback disabled and both runner slots held for the entire command. Queue and synchronization delays are outside the measured command. The original driver archive only adds timing logs to `08e7cbd`; its diagnostic execution bypasses the wrapper so the complete slow baseline can be collected. Candidates use the unchanged budget wrapper.

## Remaining performance gap

The latest 31 stages total **2,303.3 worker-seconds**, with maximum concurrency four. At these measured stage costs, perfect scheduling has a **575.8-second lower bound**, close to the 581.4-second audit. Reordering these jobs alone cannot reach 480 seconds. The two-worker experiment did not reduce individual stage costs enough to compensate for halving concurrency, and failed the existing 600-second budget.

The native simulation dominates the sampled L5 passive and L4 skilled stages. A precompilation experiment preserved values but showed no wall-time improvement and was discarded. Local compiler experiments were confounded by changing Mac load; an isolated runner control found no improvement:

| Complete L4 route, four simultaneous controls | Wall time | CPU time |
| --- | ---: | ---: |
| Default V8 settings | 266.3 s | 259.6 s |
| No Maglev | 266.0 s | 272.8 s |
| Larger inlining budget | 267.2 s | 271.0 s |
| Turbolev | 298.8 s | 286.3 s |

All four complete receipts are exactly equal. Production compiler settings remain unchanged. [Runtime configuration controls](runtime-configuration-probe.json), [probe source](runtime-probe.ts.gz), [four-worker harness](runtime-probe.mjs.gz).

The brief prohibits game-source changes. A scope decision has been requested before any native simulation optimization; no such changes have been made or authorized.

## Evidence

- [Runner before](before-runner.json.gz), [runner after](after-runner.json.gz), [original driver](baseline-driver.ts.gz), [reproducible comparator](compare.mjs).
- [Runner stages before](stages-before-runner.json), [runner stages after](stages-after-runner.json), [local stages](stages-local.json).
- [Local before](before-local.json.gz), [local after](after-local.json.gz).
- Selective-observer candidate `c72a78b7`: [runner receipt](selective-runner.json.gz), [runner equivalence](selective-runner-equivalence.json), [runner budget](selective-runner-budget.json), [local equivalence](selective-local-equivalence.json).
- CPU profiles: [L5 passive](cpu-profile.json), [L4 skilled](cpu-profile-l4.json), [L3 shared seed](cpu-profile-l3.json). Raw logs and profiles remain under `test-results/r2-threatfast-*`.

## Implementation commits

- `03951830`: share L3 routes and parallelize L5 votes.
- `6ab7378a`: fixed stage pool and per-stage profiling.
- `d471f170`: incremental barrier census bakes and measured stage ordering.
- `c72a78b7`: omit unused extra-seed observation work.
- `56cb8500`: reuse entity census work without changing samples.
