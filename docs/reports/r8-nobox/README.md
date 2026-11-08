# r8-nobox — the courier can cross her friendly column

**Physical repros pass; final native qualification is blocked, so the full goal remains open.** Baseline `ac0a9e26`. Game commits: `6feb5d98` (soft follower contact and bounded displacement) and `bde97d0b` (invalidate the contact cache when a follower starts turning). No deployment or push.

## Change

`SolidRegistry` treats a healthy group member as soft contact with the courier in occupancy, sweep, commit, rollback and audit queries, including the cached transaction path. Eligible members are following evacuees, allies assigned to the courier, mobile firefighters, escorts (including wait orders), and companions. Turning/infected actors and ordinary panicking civilians retain hard contact. Static walls, props, vehicle hulls, and other body pairs retain their existing checks.

`CharacterSeparation` still moves followers away from the courier. It never moves the courier because of a friendly follower, including while boarding. Displacement caused by courier contact is capped at 6 m/s across all three cleanup passes; when a follower has no room to yield, the courier can pass through its capsule. Other follower formation, navigation, pace, and spacing calculations are unchanged. No gameplay option or tuning flag was introduced.

## Reproductions and regression coverage

The existing registered tests contain a 24-person L7 column, an eight-person column in a passage with no spare side lane, stationary-courier protection, waiting-escort/companion eligibility, panic/turning exclusions, and immediate restoration of hard contact when a stationary follower starts turning. The passage test caps complete per-tick follower motion at 0.2 m, including ordinary neighbour spacing, and requires an empty collision-offender list.

The exact recorded pharmacy body positions are preserved in `tests/fixtures/l7-pharmacy-column.json`. On the original source, the confined passage allows only 0.64 m of courier progress and the pharmacy regression fails. Both tests pass after the change.

The standalone recorded-layout probe gives **0.519 → 4.946 m** of northward escape in five seconds. On the final game source, its largest follower step is **0.0848 m**, with zero collision offenders; the regression now also requires every pharmacy follower step ≤0.1 m. The originally recorded eastward input hits static pharmacy geometry even with every follower hidden: **0.0302 m before, after, and with an empty group**. That input is retained as a static-collision control; it is not reported as an escape. See [pharmacy replay receipts](proofs/pharmacy-replay.json).

## Final-source physical runs

Both cases used headless Chromium, physical WASD/mouse input, no objective skips, and the actual WebGPU backend. Each captured identity records game source `bde97d0b`, the full source hash and build identity. The driver's `simSeconds: 0` after automatic handover is stale; the authoritative mission-completion event supplies the times below.

| Case | Setup | Completion | Rescued / deaths | Driver issues / friendly-blocker samples |
| --- | --- | --- | --- | --- |
| Pharmacy coverage configuration | Gear3 male, low WebGPU, zoom1, ordinary damage | 130.483 s; 20 damage taken | 24/24 / 0 | 0 / 0 |
| vqa59 bus coverage configuration | Preset male, low WebGPU, zoom1.5, original courier god mode | 131.250 s | 24/24 / 0 | 0 / 0 |

Maximum no-progress windows were 12.415 s and 8.9 s respectively, including boarding/assembly. These repeat the historical configurations and complete the actual L7 mission; the exact historical bus starting arrangement/input trace was not available, so this is not a byte-for-byte replay of that old jam. The recorded pharmacy layout has its own red/green regression above.

[Physical receipts](proofs/physical.json) retain completion events, requested/actual backend, build/source identity, run summaries, boarding captures and raw-file hashes. [Visual review](proofs/visual-review.json) records the final-source images opened personally: the column beside the truck, the corpse-filled bus approach, boarding at 14/24, and departure. Motion continuity is supported by the per-tick measurements rather than inferred from still images.

## Validation and remaining blocker

- Focused collision/navigation suite: **8/8 pass** on `bde97d0b`; the final pharmacy motion assertion separately passes in the registered navigation case. The global registered-test budget remains 150/150.
- Typecheck and lint: passed on `6feb5d98`; the final cache refinement and test assertion still need the full verification gate.
- Final-source QA build: **passed**.
- `git diff --check`: **passed**.
- `npm run verify -- E08`: **NOT RUN**. Its remote wrapper never reached a runner.
- Before/after `qa:threat` for L1, L2, L4, L5, L6, L7 and L8: **NOT RUN**. Zero new flags and unchanged L4 therefore remain unverified.

The shared machine FIFO was held first by the live `r8-threatfast` wrapper PID9605 for over16 minutes, while a separate `pool.py try` returned free runner `94.130.181.173`. Our native comparison and verification wrappers remained queued throughout. The local fallback was also unavailable because of active browser/quiet reservations or low free RAM. [Queue evidence](proofs/queue-blocker.json) records the exact state. The scheduler/owner needs to restart or release that earlier wrapper; this lane did not alter its process or ticket. Both of our unstarted wrappers were stopped with exit130. No executing audit or test was interrupted, and no checks remain running in this lane.

## Resume qualification

Prepare the isolated remote before/after comparison (the runner job restores final source in `finally`):

```sh
mkdir -p .r8-nobox-inputs
git show ac0a9e26:src/sim/world/SolidRegistry.ts > .r8-nobox-inputs/SolidRegistry.before.ts
git show ac0a9e26:src/sim/ai/CharacterSeparation.ts > .r8-nobox-inputs/CharacterSeparation.before.ts
cp docs/reports/r8-nobox/proofs/native-run.py .r8-nobox-inputs/run.py
sh tools/remote/run.sh "$PWD" --pull test-results/r8-nobox/native -- python3 .r8-nobox-inputs/run.py
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E08 -- npm run verify -- E08
```

The comparison checks every selected level's skilled/passive flags and records L4's state hash, passive result and high-quality hold. A partial-level-selection notice is expected for this scoped comparison; it is not a complete ten-level gate. Inspect all new flags and any L4 difference before marking the goal complete.

[Local logs](proofs/local-checks.json.gz) include the original-source failures, passing focused tests, final build, physical outcomes, queue attempts, and motion-probe source. No specification, reference asset, follower pace/formation controller, infected AI, or acceptance threshold was edited.
