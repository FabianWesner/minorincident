# S159 — L10 farm encounter qualification

## Inspected sample sheet

[HIGH sample sheet](sample-sheet.jpg) was opened. Tick 8123 shows a crowd and red attack rings in the corn; tick 5421 shows sparse action partly obscured by a roof; tick 10828 shows sparse action in an open clearing; tick 18944 shows pursuit near containers. These periodic captures are not identified encounter peaks and do not establish cohort membership or fairness. At the nearest logged observations, player positions were approximately (904,-5), (877,-2), (1078,-16), and (1479,-41), respectively. The requested four encounter peak frames remain open.

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
