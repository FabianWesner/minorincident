# S159 — L10 farm encounter qualification

## LOW retained-profile follow-up

A second LOW physical-input run retained its profile and resumed after a 480-second reservation. The first segment passed the farms with three deaths. The temporary observer recorded all four groups: corn release sample tick 3240, 8 slot keys, closest 1.1 m; farmhouse tick 5340, 10 keys, 1.1 m; shed tick 7980, 12 keys, 1.2 m; depot tick 14400, 8 keys, 1.0 m. Release positions and raw samples are in `/tmp/s159-low-resume-observer.jsonl`; captures are in `test-results/playtest/s159-observed-low-resume/`. Last samples with living members were ticks 7860, 9420, 12540 and 21360 respectively; these are not proven clear times because checkpoint restores and actor reuse need examination. The prior LOW sample remains evidence of a ten-death retry loop. Per-encounter damage, peak capture inspection, fairness and threat-free travel remain open.

## Attributed real-input follow-up

A temporary read-only browser-context observer attached at tick 0 in each fresh WebGPU session, with physical-input driver, zoom 1.5 and five-second capture cadence. Its one-second samples record encounter slot keys, actor positions/health, nearest living infected, damage and pickup events. Raw traces are `/tmp/s159-high-observer.jsonl` and `/tmp/s159-low-observer.jsonl`; captures are in `test-results/playtest/s159-observed-high/` and `s159-observed-low/`. These are sample bounds, not exact admission ticks. Checkpoint rewinds can reuse keys and actors.

| Group | HIGH first release sample / distinct slot keys / closest sampled distance | LOW first release sample / distinct slot keys / closest sampled distance |
| --- | --- | --- |
| Corn horde | 3299 / 15 / 1.5 m | 3239 / 8 / 1.1 m |
| Farmhouse | 5579 / 12 / 1.1 m | 5459 / 10 / 0.3 m |
| Shed crossing | 8099 / 17 / 0.3 m | 28200 / 12 / 23.4 m |
| Depot Alpha | 17399 / 10 / 1.4 m | Not released by tick 28620 |

HIGH first observed corn admission at tick 4559, after release; other groups had admitted slots in the first release sample. HIGH recorded three deaths and one medkit at tick 19148 near (1516.32,-55.55). LOW recorded ten deaths and no medkit transaction; repeated machete pickups show checkpoint retries. LOW ended at (1039.36,-10.94), after the shed group released but before it reached the sampled player. This sample does not qualify LOW shed or depot. The per-second distance does not prove contact or visibility at spawn; clear times, encounter-specific damage, escape and threat-free travel still require analysis. No product severity is asserted from the death count alone because input policy and retry behavior are confounded.

## Validation and attribution follow-up

The required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90: 27 files, 105 tests passed and one skipped, 170.5 s within the 240 s budget. Typecheck and lint passed in the initial attempt.

Source inspection shows each group is released within 120 m on the X axis and individual admitted actors are recorded in `l10Encounters.state.spawned`; cap, placement, residency and safety can defer individual slots. The existing session logs do not retain those group-to-actor mappings, so source census and proximity cannot establish the observed fights. A subsequent real-input observer must record these mappings and checkpoint rewinds while sampling threat distance and captures.

## Inspected encounter sample sheet

[HIGH sheet](sample-sheet.jpg) was opened. Each panel is the available five-second capture nearest the highest one-second sample of living group members within 15 m: corn tick 4960 (sample peak 4919: 7), farmhouse 6817 (6899: 5), shed 11463 (11459: 9), depot 18302 (18299: 5). The corn panel shows threats in crop rows; the shed panel shows the courier dead amid a crowd; the depot panel shows several close attackers near containers. The farmhouse image precedes its peak by 82 ticks and shows little of that fight. This sheet does not prove admission visibility or a continuous fairness assessment.

LOW maximum sampled group members within 15 m: corn 2 at tick 4140, farmhouse 3 at 6660, shed 5 at 9060, depot 3 at 18120. No interval longer than 45 seconds without a living infected within 15 m appeared in the one-second samples of either observed run. This is sampled proximity, with transient threats and sampling gaps limiting precision; it does not prove absence of every longer quiet interval.

P2 provisional: the HIGH shed frame `test-results/playtest/s159-observed-high/captures/campaign-L10-t11463.jpg` shows death among a crowd, and the other LOW sample had ten deaths while repeatedly returning to the farmhouse. Driver behavior and overlapping groups prevent assigning a definitive balance cause. Visual distinction is supported by crops, shed clearing and containers, but fairness, spawn-in-view and stuck checks remain unqualified.

## Follow-up: incomplete real-input samples

The environment restrictions below were lifted. HIGH then LOW standard physical-input WebGPU sessions ran at zoom 1.5 on candidate `9dced069`, each for 480 seconds. HIGH recorded eight deaths and reached x≈1694; LOW recorded five deaths and reached the restricted zone at tick 25165. Neither completed the level in its sample. Raw logs and periodic captures: `test-results/playtest/s159-l10farms-high/` and `test-results/playtest/s159-l10farms-low/`. The initial renderer receipts say `webgpu`.

P3 driver gap: periodic samples cannot attribute infected to individual encounters or establish trigger, peak, clear time, damage, pickup transactions, spawn visibility, or continuous threat-free travel. No peak sheet has been produced. Four-fight fairness and distinctness remain unqualified. LOW navigation warning at tick 19434 near x1497 recovered to x1723 by tick 22742, where another warning occurred; HIGH warning at tick 26440 near x1694. These are progress-observer warnings, not established geometry defects.

The following records the earlier failed attempt; its blocked status is superseded by the runs above.

# S159 — L10 farm encounter qualification

## Outcome: blocked before gameplay

This worktree is at `9dced069` (PROD batch 117). The requested HIGH-then-LOW real-input qualification did not start, so none of the four farm encounters is qualified by this report. No gameplay frame, browser receipt, or fight log was produced. The required inspected four-panel sheet is therefore not included; generating one from old captures or a schematic would misstate the evidence.

The work remains report-only. No source, playtest tool, spec, protected reference, or gameplay data was changed.

## Attempt and evidence

- QA build: `MI_BUILD_CACHE=off E2E_PORT=5055 npm run build:qa` passed. The cache override was needed because the default shared cache path is outside this worktree's writable area.
- Standard playtest wrapper failed when `tsx` could not bind its IPC socket (`EPERM`). Retried the unchanged driver through Node's loader: `E2E_PORT=5055 node --import tsx tools/playtest/play.ts --levels L10 --mode campaign --quality high --zoom 1.5 --session-seconds 480 --level-minutes 150 --out test-results/playtest/s159-l10farms-high`.
- The retry could not start the preview on port 5055 (`listen EPERM`); the browser pool log at `/private/tmp/mi-browser-pool.log` also records repeated `listen EPERM` on `127.0.0.1:4329`. No HIGH session began. The waiting driver was stopped after confirming the infrastructure failure. LOW was not attempted, preserving the required HIGH-before-LOW ordering.
- `test-results/playtest/s159-l10farms-high/` contains no session evidence.

## Encounter census from source (not gameplay evidence)

| Encounter | Authored identity | HIGH / LOW regulars | Other authored infected |
| --- | --- | ---: | --- |
| Farmhouse defense | `barn-defense`, `farmhouse-defense` | 11 / 9 | 1 dog, Screamer role |
| Corn horde | `field-horde`, `corn-field-horde` | 14 / 7 | 1 dog |
| Shed crossing | `field-horde`, `shed-field-crossing` | 17 / 12 | none |
| Depot Alpha | `alpha-ambush`, `depot-alpha` | 9 / 7 | 1 Alpha |

These counts come from `src/levels/L10/encounters.ts`; they do not establish trigger ticks/positions, spawn origins, reach, clear times, damage, deaths, pickups, fairness, or visual distinctness in real input.

## Findings and open acceptance

**P3 — Driver/environment gap; no encounter qualification.** HIGH browser admission is blocked by sandbox `EPERM` binding the preview and local browser-pool ports. Capture path/tick: none. HIGH and LOW trigger census, peak captures, infected approach/reach, clear time, player damage/deaths, nearby medkits, spawn-in-view/stuck checks, and threat-free travel intervals are all unmeasured. Consequently, the four fights' fairness and mechanical distinction remain unproven. No P1/P2 product finding is asserted from absent gameplay evidence.

The prior batch-116 report's open pacing concern remains relevant but is not remeasured here: “The repeated long open travel is the clearest pacing concern”. The S153 native route measurements and earlier sparse browser frames are historical context only, not substitutes for this requested run.

## Driver gaps

- Browser pool and preview server cannot bind local ports in this execution environment; real-input capture requires a run environment where `tools/e2e-lock.sh` and the pool can start.
- Per-encounter peak capture and fight-event accounting remain unobserved; no tool edits were made to add instrumentation.
- No sheet was created or inspected because there are no S159 encounter frames to place in it.

## Status

Incomplete. Required deliverables still missing for acceptance: the HIGH and LOW real-input runs, four encounter capture/review, threat-free travel timing, and the inspected four-panel sheet. This report records the failed attempt; it does not qualify or approve the farm encounters.
