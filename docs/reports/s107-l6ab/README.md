# s107 — L6 courier target priority A/B

**Verdict: B is worse on player deaths in this sample, while saved survivors are unchanged.** Every trial saved 1/29. Deaths averaged 8.0 on A versus 9.75 on B: **+1.75 deaths/run** (+1.0 on HIGH, +2.5 on LOW). Both variants have equally poor protection outcomes under this physical driver, so the survivor losses cannot be attributed to the 6 m preference. With only two repeats per tier and adaptive physical inputs, the mortality difference is an observation, not a robust causal estimate. No tuning is proposed.

The loss phases explain the unchanged saved result: HIGH A lost 23/19 in the opening breach and 5/9 during retreat; HIGH B lost 21/20 then 7/8. All LOW trials lost 20 in breach and 8 during retreat. Across all trials A had 26 retreat and 6 exit player deaths; B had 29 retreat and 10 exit deaths. The extra seven B deaths were therefore three in retreat and four at exit, after most survivors were already lost. On LOW specifically, retreat deaths were equal (15 each); B's five extra deaths occurred at exit. These are checkpoint-inclusive driver outcomes; exact death ticks and phase attribution are retained in JSON.

## Method

Main revision `fdae23f3` (gameplay revision `8491f579`). A temporarily replaces the L6 `playerPriorityM` expression with `this.playerBiasM`; B is main. The exact A-only delta is [build-a-revert.patch](build-a-revert.patch). No tuning was made. The source and temporary QA-tool edits were restored before commit.

Eight standalone debug-entry L6 trials, seed 1, ordinary 29-survivor roster, female courier, 1280×720, zoom 1. Order: A HIGH×2, B HIGH×2, A LOW×2, B LOW×2. Same driver revision and passive telemetry for every counted run; same physical stair approach via `(248,15)` before the exit marker. Inputs are adaptive physical WASD/mouse, not a deterministic keystroke replay; timing and combat divergence remain sources of variation. No god mode, teleport, simulation stepping, objective skips, or gameplay-stat changes. Every counted run used `--no-skip` and the same nine-minute cap.

Production QA builds with cache disabled; headless Chromium Metal WebGL2; one browser at a time through `tools/e2e-lock.sh` and the shared browser pool; reservations 600 s; ports 4971/4972. All HIGH trials preceded LOW.

## Per-run outcomes

| Build / tier / run | Complete | Saved / 29 | Deaths | First losses by mission phase | Largest post-closure player-start gap |
|---|---|---:|---:|---|---:|
| A / HIGH / 1 | Yes | 1 | 7 | first: 23, retreat: 5 | 15.48 s |
| A / HIGH / 2 | Yes | 1 | 7 | first: 19, retreat: 9 | 15.88 s |
| B / HIGH / 1 | Yes | 1 | 6 | first: 21, retreat: 7 | 12.05 s |
| B / HIGH / 2 | Yes | 1 | 10 | first: 20, retreat: 8 | 15.35 s |
| A / LOW / 1 | Yes | 1 | 7 | first: 20, retreat: 8 | 47.63 s |
| A / LOW / 2 | Yes | 1 | 11 | first: 20, retreat: 8 | 13.82 s |
| B / LOW / 1 | Yes | 1 | 10 | first: 20, retreat: 8 | 12.83 s |
| B / LOW / 2 | Yes | 1 | 13 | first: 20, retreat: 8 | 18.40 s |

`first` is the shelter breach phase; `retreat` is the column withdrawal. Losses count each survivor identity at its first dead/turned transition; raw transitions and final rosters remain in JSON. Checkpoint deaths remain part of the player-death totals.

## Player-target attack starts per 30 seconds

These are infected windup starts against the courier, including interrupted attacks, rather than player-fired attacks or resolved hits. Windows begin at simulation tick 0; the final window is partial. Gaps are bounded by the first gate closure and the recorded L6 done tick, excluding subsequent result/cinematic sampling. Exact gap bounds and sampled steps are in JSON.

- A-high-1-valid: 0, 13, 30, 36, 17, 24, 20, 15, 25, 58, 64, 49, 13
- A-high-2-valid: 0, 1, 46, 85, 38, 28, 24, 29, 32, 29, 5
- B-high-1-valid: 0, 1, 42, 29, 20, 21, 22, 19, 60, 48
- B-high-2-valid: 0, 1, 47, 43, 40, 60, 40, 23, 19, 31, 40, 24, 21, 47, 18
- A-low-1-valid: 0, 0, 22, 32, 22, 35, 29, 20, 28, 87, 24, 0
- A-low-2-valid: 0, 0, 51, 16, 23, 12, 23, 25, 29, 24, 75, 41, 8
- B-low-1-valid: 0, 0, 15, 44, 25, 20, 62, 35, 72, 56, 123, 31, 9
- B-low-2-valid: 0, 7, 56, 78, 24, 16, 16, 15, 27, 19, 14, 29, 19, 13, 96, 10

## Native reference

`tools/qa/l6-pressure.ts`, HIGH seeds 1–3, typical+complete, on both variants. All 12 runs completed; both batches reported zero balance failures.

| Build | Typical saved / 29, seeds 1–3 | Complete saved / 29, seeds 1–3 | Typical deaths | Complete deaths |
|---|---|---|---|---|
| A | 10, 7, 11 | 22, 27, 21 | 0, 0, 2 | 0, 0, 0 |
| B | 19, 12, 18 | 22, 24, 26 | 1, 1, 1 | 0, 0, 0 |

Typical mean saved share improves from 32.2% to 56.3% (+24.1 percentage points); complete-policy mean is 80.5% versus 82.8%. These native bot results differ from the physical driver and should not be substituted for its outcomes.

## Evidence and validation

[Evidence JSON](evidence.json) retains all counted run metrics, exact attack timestamps, survivor status/loss events, native receipts, source hashes, and the temporary driver patch. Raw browser ledgers/logs remain under ignored `test-results/s107-l6ab/`. No sheet is included.

Early sandbox-denied launches collected no gameplay. An initial B attempt without `--no-skip` reached its cap and invoked a debug objective cheat; it was stopped and excluded. A preceding startup attempt was stopped before the passive timestamp logger was installed. Neither contributes to the eight-run matrix.

Full unchanged remote unit suite passed on A and B: collection 150/150; runtime 106 passed / 1 skipped across 27 files; A 217.9 s, B 220.8 s, both within 240 s and exit 0. Final typecheck and lint results are recorded in JSON. No deploy, push, or main movement was performed.
