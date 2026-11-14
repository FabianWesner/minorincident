# s116 — resumable infected A*

Gameplay revision: `36ed2e4f`; base: `e1901bb7` (s114 + s115).

## Result

Long requests retain their A* frontier across other callers instead of restarting. Native L4 HIGH seed 1 actor 298 requests at tick 3011 and receives its path at 3086: **1.25 s, six calls, 9752 total expansions**. The normal 2000-expansion tick allowance, wide allowance, route-slot limits and retry delays are unchanged.

| Native seed-1 alarm hold | Base HIGH | Final HIGH | Base LOW | Final LOW |
| --- | ---: | ---: | ---: | ---: |
| Requests unresolved at the 10 s deadline | 4 | **0** | 4 | **0** |
| Peak stationary outside plaza (sliding 30 samples) | 2 | **1** | 1 | **1** |
| Alive at first breach | 72 | **72** | 47 | **46** |
| Sustained plaza minimum after 45 s | 40 | **42** | 16 | **17** |

Full all-level threat audit: **zero flags**, 285.3 s. L4-06 HIGH passes its first-breach and sustained-horde requirements. The final source hash is `d19bb9f68121698c414839aa51fe075c436928711f783cbaa889ab2feb0d7a52`.

## Implementation

- `NavGrid.path` saves sparse visited-cell state and the heap under the caller's reused output array. A WeakMap lets abandoned output arrays and their saved searches be collected. Retry restoration requires matching endpoints and grid revision.
- Ordinary infected chasers now receive the cached-waypoint visibility check previously limited to army approaches. This clears the L10 hold's stuck chaser without changing movement speed or combat values.
- Officers recognize an L1 bite hold against the party in the existing committed-attack rescue priority. This preserves the L3 squad acceptance rule after resumed navigation changes horde arrival. Range, visibility, friendly-fire checks, damage and cadence remain unchanged. Extending that correction to other ally roles was rejected because it broke L4 pressure.

No zombie/weapon stats, audit thresholds or policies, living-actor removal/teleportation, corpse behavior, authored specs or protected assets changed. No deployment, push or main-branch movement.

## Verification

- Typecheck and lint: PASS on final gameplay revision.
- Full unchanged remote unit suite: PASS on 46.225.66.90, 27 files, 106 passed / 1 skipped, 230.9 s within 240 s; case budget remains 150/150.
- Focused A* regression: competing requests complete within their supplied budgets; twelve obstacle layouts match uninterrupted A* exactly; changed blockers and destinations invalidate saved frontiers. Coverage is included in the existing test case.
- Full threat audit: PASS, all levels, zero flags.
- Matched base/final native HIGH/LOW observer: four overdue requests per tier on base, zero on final; current final holds independently confirm zero.
- Final vehicle campaign motion renewal: 7/8 pass. L9 LOW lacks required hatch/rail-stall context coverage within the fixed 9000-frame window, with no correction failures or browser errors. The native drive reaches rail stall/restart; sparse progress samples do not establish whether the hatch-open interval was sampled. This remains unresolved; earlier eight-case passes do not validate final gameplay.
- **Browser QA needed.**

## Measurement and evidence

`tools/qa/s116-path-probe.ts` wraps the real path call without advancing navigation itself. It follows pending requests across retries, including cached-goal resets. It records a replacement only on a changed destination, an actual flow call, successful visibility from the actor to its exact scripted destination, exhausted search, or actor leaving navigation. Cancellation after the 600-tick deadline does not erase an overdue request. HIGH actor 330 switches to direct visible steering at tick 3128, before its deadline.

An earlier observer incorrectly treated cached-goal resets as cancellation, masking base starvation. Its zero-starvation claim was withdrawn. The corrected observer detects the known base failures, including actor 298, and reports zero on the final candidate. Historical receipts and rejected variants remain in `evidence.json`; `releaseValidation` and `validatedProviderComparison` identify the accepted measurements.

Native probes for the L3 squad-loss investigation and L10 stuck chaser are retained alongside the L4 probe. The L3 investigation established that resumed searches change arrival histories and expose repeated outbreak grabs; the final officer-priority correction clears the existing two-of-three army-line criterion without changing its threshold.

Unchanged L9 LOW retry through the same serial headless pool reservation and 9000-frame window repeats the coverage failure. Source is stable, correctionsProven=true and errors=[]; final APC pose is (453.17,4.16), stopped in the evacuation bay, with stallAt=5984 and restarted=true but hatch=false. Context coverage remains driving/detour only. This means no required character-contact motion samples were captured during hatch/rail-stall; it does not prove the native hatch failed to open. A matched base case is needed before classifying this as pre-existing or introduced.

Matched base e1901bb7 L9 LOW comparison passes the same 9000-frame case and supplies hatch/rail-stall character-contact coverage, whereas candidate retries do not. Thus missing candidate coverage is introduced by changed native encounter history, not established as a pre-existing harness failure. Candidate receipts still have correctionsProven=true and no errors. The exact task explicitly requires running the vehicle command, but whether this coverage-only failure blocks delivery has been raised for clarification; it is not waived or reported as passing.

Measurement interpretation: LevelNineDriving opens the hatch at the native rail stall. The vehicle gate requires at least one character contact in each context; candidate receipts lack those contacts, not recorded motion-correction failures. Its 300-frame progress snapshots cannot prove absence of a shorter hatch interval. No gameplay or gate threshold/policy change is justified by that observation alone. Delivery clarification remains pending.

## s116b — exact hatch transition trace

Orchestrator clarified that the L9 LOW gate blocks merge and may not be waived or reclassified. Exact candidate LOW browser telemetry shows hatch opens at tick/frame 5984 and closes normally on restart at 7184. Driver ownership stays APC 667, deaths stay zero, and courier HP stays 100 through the complete 1200-tick exposed hold. Thus the hatch opens inside the fixed window; the failure is missing character-contact motion coverage during that hold. This was measured with temporary read-only transition logging, with the original gate restored afterward. Next inspect native infected arrival/targets at the rail stall and compare exact base transitions.

Candidate stall proximity trace: at tick 5984 the nearest leaper (831) is 19.36 m from the APC; at 6000 it is 16.86 m away, then absent by 6300. The candidate settles near (379,-226.7), while base settles near (377.9,-215.4). Runner 836 also retains the pre-braking hull cue (376.7,-234) after the hatch opens. Three isolated encounter variants were tested and discarded because LOW coverage remained missing: release engine cue on exposure; refresh engine cue through exposure; approach a stopped hull when outside leaper range. No failed gameplay variant is retained. Next trace leaper launch/landing events and the moving-hull prediction during braking rather than assume it waits outside range.
