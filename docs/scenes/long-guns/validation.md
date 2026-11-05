# Validation — fix-long-guns

2026-10-11. Browser batches use `tools/e2e-lock.sh`, unique preview ports, headless Chromium/ANGLE Metal and at most two workers. Unit runs use at most two workers. No deployment or merge.

## Passed

- Final `npm run typecheck`, `npm run lint`, `npm run build`.
- Final `npx vitest run tests/unit --maxWorkers=2`: **155 files / 793 tests passed**, including five new actual-rig contact tests. An earlier remote full run passed 790 before the three crowd tests were added.
- Focused existing gun pose + new contact tests: **16 passed**.
- Scene Lab after matrix: **42/42 passed**, both variants × seven guns × two cameras, plus seven ally/prop combinations × two cameras. Maximum sampled player support gap **6.13 mm** (female MG running at f48), grip attachment preserved, one selected attachment, no reported gun/body clipping. Crowd contact is also asserted by actual-palette unit tests.
- E06-AC08 data/asset tests and browser T-E06-08c passed in the E06 verification run.

## Requested epic reruns and baseline findings

`npm run verify -- E06` passed typecheck/lint/build and 90 selected unit/simulation tests; browser result was 25 passed / 7 failed. The four E06 failures also reproduce on untouched `83969f51`:

| Failure | Untouched baseline result |
| --- | --- |
| T-E06-render-perf | Geometry unload expected baseline 1, received 11. |
| T-E06-09-ranged | Idle ranged indicator expected > 0, received 0. |
| T-E06-09-melee | Existing golden image mismatch. |
| T-E06-09-throwable | Existing golden image mismatch. |

The other E06 batch failures were S-11 audio smoke, S-02 controls and the user-identified T-E13-05 save/continue rack mismatch. The independent final browser batch rechecks the first two without concurrent rebuilding of the preview output.

T-E04-wiring's unload assertion also reproduces on untouched HEAD: expected at most two geometries, received eleven. The E04 uneven-120Hz presentation test passed independently on untouched HEAD; its final verification-batch result is recorded below rather than changing its timing or tolerance.

`npm run verify -- E21` passed typecheck/lint/build, then selected tests ended **63 passed / 10 failed**, so the verifier stopped before browsers. T-E21-04 failed because the test expects a 40 HP target, but the current target has 60 HP. An independent `npx vitest run tests/levels/L3.test.ts -t 'T-E21-04 ' --maxWorkers=1` on untouched HEAD reproduces the same assertion at line 81. T-E21-04b passed. Other failures: T-E21-05/07/08/10/11/12/13/14 and ally-defence station-straggler retreat. All production changes in this job are in rendering; simulation and its tests are unchanged. The requested E21 criterion cannot be reported green.

Final `npm run verify -- E04` passed typecheck/lint/build and **64 selected tests**; browsers ended **36 passed / 3 failed**: known T-E13-05, baseline-reproduced T-E04-wiring, and T-E04-present-uneven-120hz (head jitter 0.309 px versus 0.25). The independent final presentation rerun passed the courier head (0.229 px) but failed corgi root jitter (0.415 px). Untouched HEAD passed its independent presentation run. This pacing test remains unresolved; no tolerance was changed, and the corgi presentation code is unchanged.

Independent final browser batch (production build, port 3391, one worker): **11 passed / 5 failed**. S-11 audio, S-02 mouse controls, mobile controls, T-E04-09, T-E06-08c, pickup view and all three T-E21-19 routes plus campaign transition passed. Commerce/blvd/oak routes each reached the army zone with **zero deaths**. The five failures are precisely the baseline-reproduced T-E04-wiring and four E06 failures above.

The requested rerun gates are therefore **not all green**; rendering acceptance is passed and its paired captures are reviewed. The E21-AC04 simulation criterion and broader unrelated checks need their own corrections. Epics' generated tracked output is restored before committing; summarized results here and before/after acceptance captures are retained.
