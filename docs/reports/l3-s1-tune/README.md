# L3 S1 returning-infected tuning — 2026-10-14

Base: `94601b3693` (main already includes `lane/l10-e3b` and `lane/l10-s8`).
`git merge main` reported already up to date. The completed retirement-guard
bisect in `../l3-getup-balance/README.md` was not repeated.

## Change

- L3 data now sets S1 arrival occupancy to 40 high / 20 low. The existing
  director count includes downed infected with a future recovery tick, so a
  returning body occupies the same arrival slot as a standing infected.
- The limit begins at the corridor entrance, leaving the station fight's
  original live cap intact. Unfinished station waves and queued S1 residents
  retain their S1 arrival limit after the courier advances. S2/S3 arrivals use
  the existing 200/100 E18 cap. Queued residents are retained, not deleted.
- Initial S1 residents are 12 high / 6 low (previously 10/5). This preserves
  the unchanged station performance fixture's 30/15 infected precondition.
- Ordinary L3 humans, including the rare one-in-twenty sprinter, get up after
  18–20 seconds. This remains inside the epic's 10–20 second recovery window.
  Animals and specials retain their existing recovery timing.
- Scene Lab's L3 layout uses the L3 scenario, so the new catalog recovery row
  exercises that production timing. The existing mission capture helper accepts
  an output directory and S1 capture position. E21 native timing uses quiet-run.

The recovery and retirement guards, whole-level corpse retention, police damage
at 50%, bot policy, authored approach groups, tests, assertions and budgets are
unchanged. No static-collision changes or source assets are included.

## Measurements

The final focused Hetzner run passes unchanged T-E21-02/03/09/10/12 (5/5).
`tuning-measurements.json` records the earlier data candidates and final choice.
The complete bot finishes in 333.97 seconds, takes **0 S1 damage**, and has three
later deaths. The novice finishes in 310 seconds with two deaths and 0 S1 damage.
Officers make 39 of 57 S1 knockdowns (68.4%). Squad counts are 9 at fallback,
9/8/3 at segment ends, and 0 at the army; all recorded losses are natural bites.
The complete route uses Oak and Boulevard. Planned populations remain
250/600/1030, near-courier infected rise 11 → 37 → 52, and concurrency stays at 200.

The final whole `tests/levels/L3.test.ts` run is **green: 21/21 unchanged tests**
on Hetzner, exit 0, 1,056.59 seconds. This includes the five failures reported on
main (02/03/09/11/17), 10/12, police idle collapse and checkpoint restore.
`L3-final.json` retains every criterion verdict.

The final full `tests/levels` run is **green: 276 pass, 2 existing skips, 0
failures across 43 files**, exit 0 on Hetzner (1,632 seconds including runner
overhead). The whole L3 file and all six L4 battlefield lifecycle cases pass in
that sweep as well. `levels-final.json` records every file verdict.

Aggregate `verify E21`: typecheck, lint, build and the remote simulation selection
pass (101 selected criteria). Broad Playwright discovery then fails before tests
with `manifest.json needs an import attribute of type: json`. The explicit
selection of every tagged E21/smoke file completes separately, as reported below.
`verify-final-checks.json` and `verify-final-sim.json` retain the aggregate results.

Full unit/simulation functional project: 2,291 pass, 7 existing skips, no failures
(1,449 unit / 842 sim). Sequential isolated timing project: 192/193 pass; the
unchanged zoo-S2 200-infected fixture measures 4.129 ms against 4 ms. The unit
timing fixture passes. The separate isolated rerun passes both zoo-S2 cases
(2/2, exit 0);
`zoo-s2-rerun.json` retains that verdict. The first full timing sweep still has
the recorded 4.129 ms miss. These results are retained in `unit-sim-functional-final.json` and `unit-sim-timing-final.json`.

A private 30/15 arrival-budget trial also passes the five focused criteria, but
its complete bot takes 373.3 seconds with the same three deaths; the novice takes
283.2 seconds with the same two deaths. It is not selected: the 40/20 candidate
has the whole-file and full-levels evidence. No browser/full-levels verdict is
claimed for 30. Earlier `*-budget40.json` files describe the initial candidate
with default recovery and a limit applied in the yard; that candidate failed
three level criteria and was rejected. They are historical measurements, not
the final build.

## Game-camera visual review

After a fresh production build: headless Mac Chrome, actual WebGL and WebGPU
backends. Scene Lab uses its existing Vite server for fixtures and production
mission captures; Playwright and native timing gates use the production preview.
The catalog matrix passes 12/12 cases: high/low × zoom 1.5/1/0.5 × both backends.
All eight required high/low × zoom 1/0.5 catalog sheets and all eight production
S1 captures were viewed. The production captures use ordinary complete-bot
inputs, without god mode, on Oak Avenue at approximately x=-87.

In the recovery sheets, both downed figures remain visible on the ground through
18 seconds, visibly start rising around 19–20 seconds, then approach the courier
by 22 seconds. The courier and infected silhouettes remain clear at both tiers.
The close camera crops outer police while keeping the immediate returning bodies
in view. WebGL and WebGPU show matching poses and framing.

In production, the courier and pistol read clearly against the sidewalk, fence
and house; the dog and squad follow through the narrow alley behind her. High
quality shows a clear visible road at this capture instant. Low zoom 1 shows a
retained prone figure in the roadway and another at the foreground edge. At zoom
0.5 the outer crowd is cropped, while the courier and immediate path stay clear.
Some existing squad overlap remains in the alley. Warm afternoon lighting and
shadows agree across backends; low quality retains the street and actor shapes.
The existing army HUD waypoint is already active in S1.

| Tier | Zoom | Draw calls | Triangles | Backend agreement |
| --- | ---: | ---: | ---: | --- |
| high | 1 | 190 | 784,420 | WebGL / WebGPU identical counters |
| high | 0.5 | 166 | 659,615 | WebGL / WebGPU identical counters |
| low | 1 | 157 | 355,803 | WebGL / WebGPU identical counters |
| low | 0.5 | 145 | 279,661 | WebGL / WebGPU identical counters |

Console errors: zero. `s1-capture-metrics.json` records the actual renderer,
quality, settled camera and counters. `getup-*.jpg` and the production PNGs are
the reviewed final-source images. Capture counters do not substitute for timing.

| Backend / tier | Production zoom 1 / 0.5 | Recovery sheet zoom 1 / 0.5 |
| --- | --- | --- |
| WebGL / high | [1](webgl2-high-z1.png) / [0.5](webgl2-high-z0.5.png) | [1](getup-webgl2-high-z1.jpg) / [0.5](getup-webgl2-high-z0.5.jpg) |
| WebGL / low | [1](webgl2-low-z1.png) / [0.5](webgl2-low-z0.5.png) | [1](getup-webgl2-low-z1.jpg) / [0.5](getup-webgl2-low-z0.5.jpg) |
| WebGPU / high | [1](webgpu-high-z1.png) / [0.5](webgpu-high-z0.5.png) | [1](getup-webgpu-high-z1.jpg) / [0.5](getup-webgpu-high-z0.5.jpg) |
| WebGPU / low | [1](webgpu-low-z1.png) / [0.5](webgpu-low-z0.5.png) | [1](getup-webgpu-low-z1.jpg) / [0.5](getup-webgpu-low-z0.5.jpg) |

## Browser criteria

Final explicit E21 + smoke selection: 41/43 pass in 10.2 minutes, two workers.
The selected files cover every E21/smoke-tagged browser file (native performance
is measured separately). The phone alarm capture now passes. Remaining failures:
forced Boulevard real-input route has 18 deaths against the unchanged limit of
5; the occupied-boom real-click finale test times out waiting for the L4 briefing.
Commerce finishes with two deaths; Oak finishes with 16 (that test has no death
assertion). These results do not establish a green aggregate browser gate.
`browser-final.json` retains the failure messages and verdicts.

## Native performance

Quiet-run batch: 3.8 minutes, one headless native Metal Chrome worker, released
after the batch. High and low pass T-E21-21. High peaks at 10.1 ms frame p95,
2.5 ms simulation p95, 228 draws and 1,442,241 triangles. Low peaks at 13.6 ms,
1.6 ms, 195 draws and 489,667 triangles. Caps remain 200/100.

The throttled phone profile fails the unchanged 33.33 ms frame-p95 limit:
defence 34.9 ms, horde 33.8 ms, rescue 33.8 ms. Its simulation p95 remains at
most 5.9 ms, draws at most 196, triangles at most 428,791 and infected at most
100. This is a failed timing gate, not an all-budgets-green result.
`perf-final.json`, `perf-final-playwright.json` and `perf-final-conditions.jsonl`
retain the measurements and quiet-run conditions. A separate phone-only quiet
run repeats the miss: defence 35 ms, horde 33.6 ms, rescue 34.8 ms. Its simulation
p95 reaches 6 ms (the unchanged low limit); geometry and population pass.
`perf-phone-alone.json` and its conditions file retain that repeat. Each quiet
reservation was released between batches; the retry followed a full functional
browser batch rather than another timing batch.

## Rejected low-quality recovery trials

Both trials retain the validated high-quality timing and change only the low
regular-human delay. Both pass desktop high/low native budgets, both two-backend
catalog matrices (12/12), and all production S1 capture counter checks. The
reviewed close sheets show retained bodies getting up at the longer delay.
Neither produces an all-phone-budgets pass:

| Low recovery | Phone defence p95 | Horde p95 | Rescue p95 | Verdict |
| --- | ---: | ---: | ---: | --- |
| 18–20 s, selected | 34.9 ms (35 ms solo retry) | 33.8 ms | 33.8 ms | frame budget fails |
| 19–20 s, rejected | 33.2 ms | 33.6 ms | 34.9 ms | horde/rescue fail |
| 20 s, rejected | 34.7 ms | 33.3 ms | 33.9 ms | defence/rescue fail |

The selected source is restored to 18–20 seconds at both tiers. Trial measurements
are retained in `perf-low19-trial.json` / `perf-low20-trial.json` and their quiet
conditions files. The 20-second trial's duplicate full-regression jobs were
interrupted after its native failure; no full-suite verdict is claimed for that
trial. All quiet batches stayed below 20 minutes, released locks, and were
separated by functional browser/Scene Lab work.

The requested level-balance gate is achieved. The complete deploy gate remains
red because of the phone frame budget, forced Boulevard route and occupied-boom
browser failures, plus broad Playwright discovery. No deployment or merge was
performed.

Final restored-source typecheck, lint and fresh production build all pass. The
restored build again emits `index-CZtdEsGT.js`, matching the validated candidate.

## Validation commands

- `npm run typecheck`, `npm run lint`, `npm run build` on the Mac.
- `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/levels --maxWorkers=4`.
- Whole L3 file separately on Hetzner with one worker.
- Full `tests/unit tests/sim`: timing project isolated on Hetzner with one worker,
  then functional project with four workers; projects run sequentially.
- Scene Lab catalog matrix through `tools/e2e-lock.sh`, distinct SCENE_PORT values.
- Production S1 capture helper through `tools/e2e-lock.sh`, both backends.
- Native L3 performance through `tools/perf/quiet-run.sh`, one worker.
- `MI_VERIFY_REMOTE_SIM=1 npm run verify -- E21` with a unique E2E_PORT.

All browser automation is headless. Heavy simulation runs are offloaded. No
assertion or budget was changed to turn a failure into a pass.
