# R16 threat audit: redesigned L8–L10

**L8–L10 pass, and the full audit fits its budget:** `npm run qa:threat` finished in **536.2 / 600 s** on runner `2.31.107.230`, gameplay/tool pin `721d2813`. All ten primary seed-1 skilled routes complete. The global command still exits 1 for the five pre-existing L7 G-13 findings; L1–L6 and L8–L10 have zero gating flags. L7 remains outside this brief's redesigned-level fixes.

## Before and after

All runs use low quality, seed 1, native production inputs and normal skilled-route damage. Passive protection is confined to the existing threat measurement policy. `tick-budget` in the passive column is the intentional observation-window outcome, not a skilled completion result. Isolated selections retain the `PARTIAL_LEVEL_SELECTION` diagnostic marker.

| Level | Skilled before → after | Passive before → after | Gating findings before → after | Classification |
| --- | --- | --- | --- | --- |
| L8 | complete, 176.97 s → complete, 176.78 s; zero deaths | 150 s window → same window | waiting bound 14.56% → 0%; 1 → 0 flags | Outdated bot cover position: it stood by the driver door, too far from the redesigned rear boarding queue. |
| L9 | 1,200 s tick-budget → complete, 217.05 s; zero deaths | complete → complete, 243.20 s | incomplete skilled route → complete; 1 → 0 findings | Real gameplay defect: a displaced camp wreck blocked the first truck's boarding lane. Dale and Mia circled the nearest reachable grid cell. Evacuees now walk around to the clear truck side. |
| L10 | 3,600 s tick-budget → complete, 1,011.28 s; one death | 60 s assault window at 941.05 s → same window | 2 → 0 passive flags; skilled completion restored | Outdated bot recovery and audit applicability/cohort accounting. |

The six raw before/after receipts are linked by [manifest.json](manifest.json), with compressed-file SHA-256 values and their original paths. The baseline gameplay source was `ffdf2646`; those first runner receipts report `manifest-only` because that launch did not pass revision environment variables. Later receipts retain gameplay and observer content hashes.

## Every redesigned-level finding

- L8 passive: `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT`. A diagnostic breakdown attributed every waiting tick to boarding. Covering the actual rear passenger queue resolves the finding without changing the 10% waiting or 95% pace targets.
- L9 skilled: `INCOMPLETE_NATIVE_POLICY:tick-budget`. The old aggregator kept this only in diagnostic skilled flags; completion now also gates the audit. The fixed native driving receipt evacuates all four living civilians, completes Rosa's goodbye, retains Sam and the corgi, and performs the bridge collapse/crash/crawl handover. Collision and admission violations are both zero.
- L10 skilled: `INCOMPLETE_NATIVE_POLICY:tick-budget`. After a normal death, the bot's ground-level stair approach kept walking west whenever it was west of the stair foot; the failed run ultimately stopped 683 m from the console. It now navigates back to the actual stair from a distant position. The runner also performs the same ordinary Retry action used by `l10-pacing.ts`.
- L10 passive: `step/hold:SKILLED_BELOW_ATTACKS_PER_MINUTE_8`. L10-11 explicitly assigns this floor to the stationary ground policy. The competent route uses the protected mounted platform. The stationary floor remains 8/min, with 475.13/min measured and 14/14 reachable infected.
- L10 passive: `wave/dispersal-assault:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS`. The former ledger counted only new admissions despite hunters already pressing the console and occupying its cap. The opening cohort now includes actual living infected within 30 m at announcement, plus later admissions: 13 members, first windup at 0 s, versus two newly admitted members in the old ledger.
- L10 skilled retains the informational `wave/dispersal-assault:WAVE_FIRST_ATTACK_OVER_20_SECONDS` diagnostic (the mounted route clears approaching actors). G-22 continues to gate the passive ground measurement, where the opening contact is immediate.

No acceptance target or specification was changed.

## Runtime and determinism work

The gate uses its existing fixed pool of four isolated Node worker processes. L9's second full drive could never supply the explicitly exempt on-foot kiting sample; it is now omitted. The observed L9 skilled stage fell from 380.33 s to 28.46 s, including the gameplay repair. Default route budgets now match the authored lengths: L9 600 simulation seconds; L10 1,800. Other passive windows, including all L5 1,200-second runs, are retained.

The passivity replay now compares the uninterrupted native route with its native state hash; it previously injected the separate kiting policy into the control run. Gameplay and observer content hashes bind new receipts and replays to the same source, including manifest-only remote jobs.

First full budget attempt: **FAIL**, 601.17 s, exit 124 from the unchanged 600-second watchdog. This attempt does not qualify the full gate.

The complete diagnostic subsequently finished in **542.9 s** on runner `2.31.107.230`, with L1–L6 and L8–L10 clean and only the five known L7 flags. See [stage durations](stage-profile.json). L3 seed 3 took 132.96 s, roughly twice its old scheduling estimate; its priority is corrected. Nearby actors' successful bounded path proofs now supply the same-destination unbounded reachability witness too, avoiding a repeated independent search. All L8–L10 phase receipts are identical to the pre-optimization measurements.

The actual package-wrapper rerun finished in **536.2 s**, including collection; its audit work took 530.09 s. [Budget receipt](final-budget.json), [31 final stages](final-stages.json), and compressed `final-audit.json.gz` in the manifest retain the result. The stage timeline reaches exactly four concurrent jobs. [Receipt comparison](receipt-comparison.json) proves **all ten entire level receipts are identical except `wallSeconds`**, including every native state hash, phase, wave, follower vote and flag. Simulation windows and the 600-second ceiling are unchanged. Runner admission and source synchronization are outside the package's existing clock.

## Verification

- `npm run verify -- M3`: PASS on the final tool/gameplay source (`721d2813`), including E30/E31/E32's shared gate; typecheck 60.67 s, lint 34.63 s, unit suite 106 passed / one existing skip, 106.60 s including its wrapper. Inventory remains 150/150 cases and 43/45 files.
- `qa:threat --proof`: PASS; negative controls still reject zero attacks, missing/late cohorts, sustained disconnection and slow followers.
- The first unit invocation failed only because a Git-dependent gate-tools test encountered the runner's commit-less manifest. The successful verification used a source snapshot commit inside its disposable remote job; repository tests were unchanged.
- [Independent serial replays](passivity.json) match the parallel audit for all three levels: L8 `a9c213b2`, L9 `bada6a06`, L10 `3d1aaf13`. The full selected audit with its source/policy hashes is archived as `replay.json.gz` in the manifest.
- Actual `npm run qa:threat`: runtime PASS, 536.2/600 s; redesigned levels PASS; global acceptance still FAIL for the known L7 findings below.

## Remaining known L7 findings

The full run and separate L7 diagnostic reproduce exactly:

- `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` (11.97%).
- `step/corridor:SLOW_FOLLOWER:71`.
- `phase/encounters:FOLLOWER_PACE_UNOBSERVED:63`.
- `phase/encounters:SLOW_FOLLOWER:71`.
- `phase/encounters:FOLLOWER_PACE_UNOBSERVED:60`.

These are retained in `known-L7.json.gz` and the final full receipt. No L7 source or acceptance target was changed.

No browser was opened. No deploy or push was performed.
