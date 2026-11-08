# r8-threatfast — runtime targets and before/after equivalence verified

The complete default four-worker audit finishes in **186.3 seconds on the quiet Mac** and **585.4 seconds on the isolated cx33 runner**, below the 420/600-second targets. Both completed all **31 stages**, with no stage errors, all original clauses, and all original seeds.

The final Mac receipt is identical to the corrected unoptimized baseline across **31,113 compared values**, ignoring provenance and wall timing. This includes native hashes, passive observations, follower votes, every kiting receipt, and all diagnostic flags. The two platforms also have identical acceptance flags, all **38 rendered acceptance verdicts**, and all ten kiting receipts.

Both audits exit 1 with the same three acceptance findings: **L3-11 competent rate, L5 kiting, and L8 kiting**. Runtime and equivalence targets are met while retaining these findings.

## Full-run kiting rates

These receipts are identical on the final Mac and Linux runs. The floor remains 2 hostile attack starts/minute while kiting.

| Level | Kiting seconds | Input samples | Hostile attack starts | Rate/min | Kiting verdict |
|---|---:|---:|---:|---:|---|
| L1 | 15.78 | 947 | 19 | 72.23 | PASS |
| L2 | 20.00 | 1200 | 1 | 3.00 | PASS |
| L3 | 20.00 | 1200 | 4 | 12.00 | PASS |
| L4 | 20.45 | 1227 | 20 | 58.68 | PASS |
| L5 | 20.00 | 1200 | 0 | 0.00 | FAIL |
| L6 | 20.00 | 1200 | 1 | 3.00 | PASS |
| L7 | 20.00 | 1200 | 2 | 6.00 | PASS |
| L8 | 20.00 | 1200 | 0 | 0.00 | FAIL |
| L9 | 0.00 | 0 | 0 | 0.00 | N/A, driving |
| L10 | 18.00 | 1080 | 72 | 240.00 | PASS |

## Why the old probe produced zeros

**L1:** the fallback divided by zero when its pursuers left the live query, producing NaN aim. L1's input validation aborted that sample after 115 frames. The fallback now aims opposite the saved retreat vector and supplies a finite fallback point. L1 starts on the first pressing threat in its marked phase. Two focused repeats produced the same 947-frame, 19-attack receipt; the full Mac and Linux runs reproduce it.

**L2:** the 12-metre gate selected an approaching chaser before the close encounter. Starting at six metres yields one hostile windup in 20 seconds (3/min) with continuous selected-weapon fire. The final receipt records 1,200 firing frames and 40 courier attacks.

**L5:** the opening attack burst precedes activation of `look`. Its kiting-only gate now includes the `emerged` and `search` encounter phases, without changing the threat observer's phase inventory. The final sample starts at tick 249 and ends at 1448. It records **1,200 firing frames, 40 courier attacks, zero hostile windups**, and 1,133 frames after pursuers leave the live query. The zero is a measured loss of pressure under sustained fire, rather than an absent input sample. The direct focused run and both final full runs agree.

An earlier candidate reduced firing cadence and produced L5 70/min and L2 6/min. That changed the sustained-fire policy and was discarded; those rates and its 204-second timing do not describe the final implementation. The historical r7 focused L5 16.63/min claim has no retained complete raw artifact here. The current receipts expose their input and attack diagnostics instead of assuming that claim is a verified baseline. `tools/playtest/session.ts` does not participate in these sim-runner routes.

## Runtime changes

- Disposable kiting routes end when their **1,200-tick encounter clock** closes. L4 has 1,227 input samples in that clock window because cinematic inputs can repeat without advancing the simulation tick. A 1,200-input cutoff lost part of its receipt; the elapsed-clock cutoff preserves the entire receipt and removes the later route tail.
- L1/L10 can collect fewer active input samples during that clock window. Their probe tails also stop when the clock closes. The separate probe in L3's shared seed route uses the same condition.
- The complete audit defaults to four bounded simulation workers on both platforms. `--maxWorkers` still accepts 1–4. Stage weights use the measured runner costs, including the cheaper follower-only and extra L3 seed observations.
- Each pooled worker uses `--max-semi-space-size=64` for short-lived simulation allocations. The final configuration was measured directly; the unchanged receipts prove that this runtime setting and scheduling preserve the recorded simulation results on the Mac.

Ordinary skilled routes, passive windows (including all 1,200 seconds for L5), seed votes, criteria, and game source are unchanged. The measured game-source baseline is **`7326320f`**; main advanced independently during this lane. The committed `src` and `public` tree hashes match that baseline, as recorded in [validation.json](validation.json).

## Timing and equivalence evidence

| Complete run | Audit seconds | Full budgeted command | Stages | Acceptance flags |
|---|---:|---:|---:|---:|
| Corrected unoptimized Mac baseline | 393.5 | 399.6 s | 31 | 3 |
| Final Mac, quiet admission | 184.1 | **186.3 s / 420 s** | 31 | 3 |
| Final Linux, both runner slots held | 578.0 | **585.4 s / 600 s** | 31 | 3 |

The baseline is commit `f64ef10a` with `tools/qa/threat/stageJobs.ts` and `tools/sim-runner/levels.ts` restored from `7326320f`, removing the runtime optimization while retaining the corrected policy. It was executed with four workers in a temporary worktree. The final measured code is `b73b3282`, using the default worker setting. The baseline timing was taken under shared Mac load; the final Mac target uses the repository's managed quiet admission. These wall times are direct observations, rather than a controlled attribution of each individual speedup.

The final Mac ran through `sh tools/perf/quiet-run.sh npm run qa:threat -- --out …`. Its [admission log](quiet-conditions.jsonl) proves load below 3 and no foreign headless browsers, builds, or local test/typecheck jobs before execution. The Linux command ran through `tools/remote/run.sh` with local fallback disabled and `tools/remote/timing-isolated.sh --all`. Queue, synchronization, and admission waits are outside the measured `qa:threat` command. The existing 600-second wrapper and test-inventory limits were retained.

The exact before/after comparison is reproducible with:

```sh
node docs/reports/r2-threatfast/compare.mjs docs/reports/r8-threatfast/before.json.gz docs/reports/r8-threatfast/after.json.gz /tmp/r8-equivalence.json
```

Result: **31,113 leaves, zero differences**. Typecheck, lint, and `qa:threat --proof` pass. The proof covers finite aim after losing the live target, hostile-only counting, selected-weapon fire, and completion by elapsed encounter time. The direct [L4 clock check](l4-clock-proof.json) also proves that the route stops early with all 1,227 samples and 20 hostile attacks intact.

### Cross-platform comparison scope

All 38 rendered acceptance verdicts, all level gate flags, the three aggregate acceptance flags, and every complete kiting receipt match. The [reproducible acceptance comparator](compare-verdicts.mjs) records those projections in [cross-platform-verdicts.json](cross-platform-verdicts.json):

```sh
node --import tsx/esm docs/reports/r8-threatfast/compare-verdicts.mjs docs/reports/r8-threatfast/after.json.gz docs/reports/r8-threatfast/runner.json.gz /tmp/r8-verdicts.json
```

The full Mac/Linux raw simulation values have 3,263 comparison differences, mostly in L4, plus native route observations in L5/L6/L7/L10. Linux additionally records the nongating native L4 diagnostic `wave/breach-north:WAVE_FIRST_ATTACK_OVER_20_SECONDS`. These are retained in the [raw cross-platform comparison](cross-platform-values.json.gz). Exact performance before/after equivalence is proved within the Mac; cross-platform acceptance verdict and kiting equivalence are proved separately.

## Delivery

Code changes are committed through `b73b3282`. The runner FIFO was released between attempts, and the final quiet reservation released after the Mac audit. Earlier Linux attempts that hit 600 seconds are incomplete runs and are not used as successful timing evidence. The discarded spaced-fire candidate is retained explicitly as historical evidence. No deploy or push was performed.

- [Corrected unoptimized receipt](before.json.gz), [final Mac receipt](after.json.gz), [final Linux receipt](runner.json.gz)
- [Exact before/after comparison](equivalence.json), [cross-platform acceptance comparison](cross-platform-verdicts.json)
- [Before stages](stages-before.json), [Mac stages](stages-after.json), [Linux stages](stages-runner.json)
- [Before budget](budget-before.json), [Mac budget](budget-mac.json), [Linux budget](budget-runner.json)
- [Completion audit](completion-audit.json), [validation and game-source hashes](validation.json), [quiet admission](quiet-conditions.jsonl), [L4 clock proof](l4-clock-proof.json)
- [Original broken probe](pre-correction.json.gz), [discarded spaced-fire candidate](discarded-cadence.json.gz), [incomplete clock-only Linux budget](budget-linux-clock-timeout.json)
