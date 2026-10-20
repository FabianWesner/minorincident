# Aggro tuning — PO 2026-10-20

Code commits: `f83754940` + `ddf17f389`. Baseline: main `60c51a67a`. This worktree started from main `82604a125` and first merged `lane/small-fixes-w9` (then `624680ae3`) as `bacd9ddfd`.

## Chosen rule

A surviving infected damaged by the courier or companion reacts even when the shooter is outside its sight cone. The shared vision brain receives one `rush()` to the shooter’s position when the hit landed. Its investigation lasts 12 seconds and further hits refresh it when it is not already chasing or biting. Ordinary perception owns reacquisition; hits add no shooter preference. The old re-press every 20 ticks is removed.

Active director attack orders retain ownership, as do scripted walkers and Mega global pursuit. Archetype brains retain their 12-second pursuit after the last positive hit, including the Alpha sight-gate and territory override. Recycled slots clear both provocation and timed director focus, so a fresh actor cannot inherit another actor’s hit memory or ownership exception.

The existing rush commotion behavior is retained. Plain movement orders and narrower perception shortcuts missed the original L6 pins. The measured alternatives are recorded in [experiments.json](experiments.json). No threshold, level exception, weapon/damage rule, bot policy, dependency, or specification changed.

## Authored pins

All six requested test IDs pass unchanged. Their authored seed is 1 except L4, which uses seed 3.

| Pin | Seed | Unchanged limit | Main 60c51a67a | Branch ddf17f389 |
| --- | ---: | --- | ---: | ---: |
| T-E24-03 L6 newbie rescue share | 1 | ≥ 40% | 14/29 (48.3%) | 16/29 (55.2%) |
| T-E24-02 L6 complete time | 1 | ≤ 270 s | 269.95 s | 264.73 s |
| T-E21-05 L3 handgun knockdown median | 1 | ≥ 5 m | 6.52 m | 6.67 m |
| T-E21-09 L3 officers’ S1 share | 1 | ≥ 60% | 63.9% | 66.7% |
| T-E22-02 L4 complete time | 3 | ≥ 260 s | 307.60 s | 302.47 s |
| T-E29-02 L7 boarded / starting | 1 | ≥ 60%, complete, 0 deaths | 23/24, complete, 0 deaths | 24/24, complete, 0 deaths |

Exact values and limits: [pins.json](pins.json). Other assertions in those tests also pass, including their full time bands, casualty and actor caps, straggler rejoining, handgun/melee sample sizes, squad proximity, and no-cheat checks.

## Seeds 1–3

These are expanded diagnostics using the existing bots and their ordinary inputs/presets. L3 uses `loadL3/runL3` (`complete`, 600 s), L4 `loadL4/runL4` (`complete`, 700 s), L6 `loadL6/runL6` (`complete` and `newbie`, 600 s), L7 `runLevel` (`complete`, 1,200 s). Gun medians use the existing upper-middle convention; officers’ share is officers / (officers + player) in S1.

| Metric | Seed | Main | Branch |
| --- | ---: | ---: | ---: |
| L6 newbie rescue share | 1 | 48.3% | 55.2% |
| L6 newbie rescue share | 2 | 62.1% | 58.6% |
| L6 newbie rescue share | 3 | 27.6% | 62.1% |
| L6 complete time | 1 | 269.95 s | 264.73 s |
| L6 complete time | 2 | 282.62 s | 273.88 s |
| L6 complete time | 3 | 275.12 s | 266.28 s |
| L3 handgun median | 1 | 6.52 m | 6.67 m |
| L3 handgun median | 2 | 6.63 m | 6.54 m |
| L3 handgun median | 3 | 6.59 m | 6.44 m |
| L3 officers’ S1 share | 1 | 63.9% | 66.7% |
| L3 officers’ S1 share | 2 | 64.8% | 63.9% |
| L3 officers’ S1 share | 3 | 64.2% | 45.8% |
| L4 complete time | 1 | 311.77 s | 250.27 s |
| L4 complete time | 2 | 308.17 s | 303.73 s |
| L4 complete time | 3 | 307.60 s | 302.47 s |
| L7 boarding share | 1 | 95.8% | 100.0% |
| L7 boarding share | 2 | 95.8% | 100.0% |
| L7 boarding share | 3 | 100.0% | 83.3% |

The expanded battery is **not uniformly green**. Main already misses the L6 complete time cap on seeds 2 and 3 and the L6 newbie rescue floor on seed 3. The branch repairs both seed-3 L6 misses; seed-2 complete time improves but remains over 270 s. Two new diagnostic outliers remain: L3 officers’ share on seed 3 (45.8%) and L4 complete time on seed 1 (250.27 s). L7 completes without deaths on all three seeds and boards 24, 24 and 20 of 24 followers.

The authored single-seed criteria remain the gates, following the repository’s PO 10-09 policy. The expanded measurements are retained explicitly as tradeoffs, with their original limits: [main.json](main.json), [branch.json](branch.json).

## Regression found by the full run

The first committed candidate caused an extra L4 low-tier finale regression: its escape took 30.27 s and occupied only 2 of 3 action buckets, below the unchanged 70% requirement. Main passes this test. Preserving active director orders fixes it: the final low-tier run takes 81.33 s, occupies all 6 buckets and has zero deaths. High tier also passes (5 of 6 occupied buckets, zero deaths). Pool focus is cleared on reuse so the ownership exception cannot attach to a new actor.

Both quality tiers pass on the final code. Exact before/after measurements: [finale-regression.json](finale-regression.json).

## Validation

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- One full invocation on `f83754940`: **2,288 passed, 1 failed, 11 skipped**, across 400 files including the temporary diagnostic harness. The sole failure was the L4 finale regression above, fixed in `ddf17f389`.
- Final focused run on the exact `ddf17f389` source: **154 passed**, with one L7 wall-clock timeout under concurrent load. The same unchanged L7 test passes alone with one worker in **141.4 s**, inside its original 300 s timeout. Thus all six authored pins and the repaired L4 finale pass. The focused run also covers 134 nearby hearing/Alpha-awareness tests and all 9 aggro unit tests.
- Primary level/campaign validation on `ddf17f389`: **117 passed, 0 failed across 9 files**, in 1,158.3 s. This includes every primary L1–L6 file, L8, and continuous campaign handovers from L1 through L9 and from L1 through L10.
- New regression coverage: actual L5 Alpha sight gate and territory override; fixed remembered position after an unseen shooter moves; refreshed memory on another hit; no added shooter target preference; active director order ownership; clean archetype/vision brain reuse, including old director focus.
- `aggro-alpha-shot-from-behind`: pass, 300 frames, zero console errors, max 28 draw calls / 77,954 triangles. The sheet shows the Alpha facing away before the shot, turning, closing and attacking. Trace: Alpha x=0 at frame 20, x=-6.75 at frame 120, x=-11.621 at frame 180; courier x=-12.901 after knockback, leaving about 1.28 m separation. Artifacts: `test-results/aggro-tune/final/scene/`.

The full suite was invoked once, as requested; the follow-up uses focused tests and primary level files. Exact counts and the recovered timeout are recorded in [validation.json](validation.json).

CPU suites use `tools/remote/run.sh`, at most four Vitest workers. Browser checks use `tools/e2e-lock.sh`, headless WebGL2 through Metal, one browser, `E2E_PORT=3871`, `SCENE_PORT=3872`, and a 1,800-second admission cap. No port 3300 server, deployment, push, or merge into main was performed.

## Reproduction

The temporary seeds 1–3 harness is archived in [diagnostics.patch](diagnostics.patch). Apply it, then run:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/aggro-tune -- npx vitest run tests/levels/aggro-diagnostic --maxWorkers=4
```

The harness is removed from the normal test tree after recording the results. Final branch diagnostics were written separately under `test-results/aggro-tune/final/` to keep them distinct from the first full-run candidate.
