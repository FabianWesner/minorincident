# s127 playtest driver

Implemented in tools/playtest only, with assertions added to existing QA tests. No gameplay or asset changes.

| Capability | Evidence |
| --- | --- |
| L9 seated hatch shooting / rendered APC boarders | LOW rail-stall fixture run: Hold the hatch at tick 1314, 30 shotgun attacks, damage progress while seated, engine restart; zero deaths/assists/issues. |
| Zoom capture 1 and 1.5 | `--capture-zooms 1,1.5`: acceptance photos at tick 668 report actual and target zoom exactly 1 and 1.5, actual quality LOW. Existing capture defaults preserved. |
| Quality after load | Rail-stall save loaded; actual LOW tier asserted and logged at tick 66. |
| Mission scream/roar binding | Real L9 scream captures including ticks 2480/2507. Existing QA test invokes the page observer across L6/L7/L9/L10 mission replacements and checks roar/scream receipts and no duplicate binding. This is observer regression evidence, not a full gameplay sweep of every mission. |
| Immortal route mode | `--immortal` produces `IMMORTAL / ROUTE ONLY` in session log and summary and disables combat. A 60-second fixture run exercised it; one P2 enemy-frozen diagnostic near the hatch is disclosed. |

## Reproduce

```sh
PLAYTEST_FIXTURE=tests/fixtures/saves/qa/l9-before-rail-stall.json.gz \
E2E_PORT=4991 SCENE_PORT=4992 node --import tsx tools/playtest/play.ts \
  --levels L9 --entry debug --session-seconds 60 --level-minutes 1 \
  --quality low --zoom 1 --scream-captures --out test-results/s127-stall
```

For the zoom/immortal proof add `--capture-zooms 1,1.5 --immortal` and set `PLAYTEST_ACCEPTANCE_CAPTURES=1 PLAYTEST_ACCEPTANCE_CAPTURE_TIERS=single`.

All browser runs used the pool, headless WebGL2/Metal, one browser, ports 4991/4992. Ignored raw logs/captures are in `test-results/s127-stall/`, `test-results/s127-immortal/`, `test-results/s127-hatch/` (180-second route sample reached evac-point), and `test-results/s127-proof/` (60-second route sample).

Typecheck, lint and focused QA tests pass. Full remote `sh tools/remote/run.sh "$PWD" -- npm test` passed before the observer extraction (105 passed, one platform skip, 128.3 seconds). Final remote rerun after the observer extraction passed: 105 passed, one platform skip, 131.2 seconds; budget collection remained 150/150 cases across 45 files. Initial sandbox failures were resolved before these proof runs and commits.
