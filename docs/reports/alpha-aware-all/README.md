# Alpha proximity awareness — PO 2026-10-16

PO: "Alpha awareness: needs to be level independent". Original PO #25: "The alpha needs to be aware when someone is so close (even when not in view)".

Alphas acquire nearby huntable humans in every level, including companions and allied fighters, through cover and behind their facing. Outside L5, still/cowering humans have a 4 m radius, walking 6 m, running 9 m, and gunfire 12 m for one second. Detection turns the Alpha during a 0.6 s roar notice. Already chasing Alphas also acquire nearby humans. Mega gives the local cue and resumes its E32 global courier pursuit. Its local notice timer is serialized/rebased and cleared when a pooled brain is reused.

Ordinary infected retain their per-level perception. L5 uses its previous six-metre floor and courier-only movement/shot expansion; PO #29's balance pin and data hash are unchanged. No collision source, weapon damage, L5 data, test bands or budgets were edited. E07's Alpha section and AC06 now include the verbatim decision and observable radii/cue contract.

## Validation

Typecheck, lint and a fresh production build pass. The final focused suite passes all 135 tests (35 new Alpha controls, 99 existing hearing controls and the unchanged L5 pin). Both L10 arrival tiers and the seed-32 full-route contract pass after preserving continuous pursuit of an already known courier. Raw evidence lives in `test-results/alpha-aware-all/`.

The latest 36 Scene Lab combinations pass, with actual WebGL and WebGPU backends, both tiers and zooms 0.5/1/1.5; see [matrix](qa-matrix.json). Native E18 checks pass 4/4 under one 40-second quiet reservation. High/low frame p95 is 6.3/4.6 ms, sim p95 1.0/0.8 ms, peak draws 68/50, peak triangles 1,178,346/220,942 and retained heap 110.3/75.6 MB on ANGLE Metal / Apple M4. See [performance](perf.json).

Commands: local `npm run typecheck`, `npm run lint`, fresh `npm run build`; remote `npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4` through `tools/remote/timing-isolated.sh` and `tools/remote/run.sh`; focused awareness/hearing/L5 pin remote run; complete/newbie seed-1 bot telemetry with the existing sim runner, plus explicit `runLevel('L7', policy, 1)` because the CLI's registered mission list omits graphless L7. Full level tests include the L6/L9/L10 campaign tests.

Browser commands use `tools/e2e-lock.sh`, headless Chromium, private ports 34671–34675; catalog/native timing use one browser and the final deploy gate uses two workers. The deploy-gate filters plus smoke and the new browser awareness test select 104 tests. Native timing uses `tools/perf/quiet-run.sh`, bounded to 20 minutes including queue/preflight; its process-group timeout releases reservations. The Scene Lab catalog contains `alpha-awareness-{courier,companion,mega}` and the default matrix includes them.

`npm run verify -- E07` was not used: its remote-sim path still explicitly launches local Vitest timing files; this lane requires all heavy sim/unit work on Hetzner. The full remote suites and explicit Mac browser/performance checks provide their underlying coverage.

## Before/after bots

Times are simulation seconds, seed 1, standalone progression. Both policies use the existing level runner; L7's existing runner uses the same route for both policies. The table records measured changes without modifying bands. L5's PO #29 pin additionally checks its exact original outcome/deaths/data hash.

All twenty after-runs complete with zero deaths, matching all twenty before-run death counts. No band expectation needed adjustment. L5 timings are exactly unchanged. L7 uses the existing identical route policy for both labels; its CLI omission was handled by explicit runs. Full precision is retained in [bot telemetry](bots.json).

| Level | Complete seconds before → after | Newbie seconds before → after | Deaths before → after (both policies) |
| --- | ---: | ---: | ---: |
| L1 | 167.72 → 167.72 | 111.07 → 111.07 | 0 → 0 |
| L2 | 145.68 → 145.68 | 140.52 → 140.52 | 0 → 0 |
| L3 | 349.22 → 349.22 | 279.60 → 279.60 | 0 → 0 |
| L4 | 355.68 → 355.80 | 367.27 → 368.27 | 0 → 0 |
| L5 | 159.03 → 159.03 | 261.23 → 261.23 | 0 → 0 |
| L6 | 259.20 → 259.20 | 261.80 → 261.80 | 0 → 0 |
| L7 | 519.92 → 503.78 | 519.92 → 503.78 | 0 → 0 |
| L8 | 132.13 → 132.20 | 132.13 → 132.20 | 0 → 0 |
| L9 | 126.83 → 126.83 | 126.83 → 126.83 | 0 → 0 |
| L10 | 1570.72 → 1570.72 | 1572.18 → 1572.18 | 0 → 0 |

## Game-camera review

All 36 latest contact sheets were opened for WebGL **and** WebGPU, high/low and zoom 0.5/1/1.5. The regular Alpha pivots in place toward the courier/nearby human during frames 0–36. The companion case retains the nearby human while the courier stays outside hearing range. Both tiers retain glowing torso/eyes and a clear heavy silhouette against the asphalt; the later physical-attack ring is legible. Initial fixture framing cropped upper bodies at close zoom; the final fixture targets sit at body height, with the upper body and turn visible. The fixture camera changed; the runtime camera did not.

The final Mega fixture places the courier 16 m away and a human 3.8 m behind Mega. Its head/torso turn toward that human during the notice pause, then movement resumes toward the distant courier. Low quality retains Mega's glowing broad torso, large silhouette and health bar. It neither attacks nor walks into the nearby human during the notice pause. The two backends show the same sequence.

| Fixture | WebGL review sheet | WebGPU review sheet |
| --- | --- | --- |
| Courier behind Alpha | [sheet](webgl2-courier.jpg) | [sheet](webgpu-courier.jpg) |
| Human companion behind Alpha | [sheet](webgl2-companion.jpg) | [sheet](webgpu-companion.jpg) |
| Human near Mega; distant courier | [sheet](webgl2-mega.jpg) | [sheet](webgpu-mega.jpg) |

## Limitations / regressions

The final Mac browser gate finishes **103 passed / 1 failed**, no skips or flaky passes. `T-E22-18` (L4 real-input playthrough) fails both attempts in its travel helper toward `(-79.3, -45.2801)`, after 10 deaths, with HP 67 and five nearby enemies. The player's last position is approximately `(-0.70, 42.64)`. The standalone complete/newbie bots and continuous campaigns still finish L4. Its helper iteration budget and assertions were not changed. QA remains red on this gate.

A final focused rerun confirms `T-E22-11` tank spectacle also fails: one simulated shot gap is **12.8166667 s** versus the unchanged **12.8 s** limit. Pre-change AI passes this same seed/test. This is a non-band regression; the lane does not change tank scheduling or relax its assertion to hide it.

The initial full remote sweep found weather/residency/physical/zoo timing, Mega pursuit/arrival and generic telegraph failures. After keeping already-known courier pursuit continuous, the final six-file regression rerun passes **44/44**, the generic telegraph rerun passes, and final campaign/arrival/route/Alpha physical checks pass **9/9**. All 135 focused awareness/hearing/L5 tests pass. The initial combined sweep ran for **3,134 s** on Hetzner, then was interrupted on its obsolete L6 campaign copy after **470/471 file summaries**. That same L6 file completed on final code in the separate campaign rerun (both policies passed). No complete bulk JSON was emitted on cancellation; [bulk-summary.json](bulk-summary.json) is explicitly parsed from the saved console log, not represented as a normal Vitest JSON report.

| Initial bulk group | Files reported | Passed assertions | Failed | Existing skips |
| --- | ---: | ---: | ---: | ---: |
| Unit | 268 | 1,537 | 0 | 9 |
| Sim | 146 | 1,106 | 7 | 0 |
| Levels (remaining L6 file covered by final campaign run) | 56 | 315 | 1 | 2 |

All seven initial sim failures were covered by final reruns and pass; the one level failure is the still-red tank cadence assertion described above. The final campaign run also covers both L6 policies. This is combined coverage from an initial bulk run plus final targeted reruns, **not a clean final all-suite run**.

No gates, test expectations or budgets have been relaxed. No level-band changes were needed.
