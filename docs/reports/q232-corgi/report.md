# Q-232 — L5 Metro companion timing

## Verdict

No gameplay or tuning change is retained. On the requested five real-input L5 runs, the shutter began lowering **0–1.45 s after the last living survivor crossed**, with **zero extra companion-wait ticks in 5/5**. The reported 7.4 s corgi hold was not reproduced. The measured residual delay is the existing resident-view/closing beat, not a scripted corgi moment.

The baseline gameplay is `57bf8664c`. Every run used the existing Playtest driver, the real debug level menu, headless pooled Chromium with ANGLE Metal/WebGL2, low quality, seed 1 and zoom 1.5, from the cellar door to the L6 handover. There were no objective skips, god mode, logical input injection, teleports, courier deaths or console errors. The driver's optional assists read route information and still send real mouse/keyboard events. Human losses during ordinary combat were retained; difficulty was not adjusted.

## Timings and companion state

All numbers below are simulation ticks (60/s). “Last in” uses the production human sheltering predicate: the station box and more than 1 m past the leaf. “Closed” is the first tick the production shutter gate becomes closed, rather than the start of its animation.

| Run | Living humans rescued | Courier arrival | Last in | Lowering starts | Fully closed | Shelter done | `level.completed` | Extra corgi wait |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 8482 | 8575 | 8662 | 8782 | 8842 | 8842 | 0 |
| 2 | 3 | 7326 | 7481 | 7506 | 7626 | 7686 | 7686 | 0 |
| 3 | 2 | 8420 | 8726 | 8726 | 8846 | 8906 | 8906 | 0 |
| 4 | 3 | 8235 | 8584 | 8584 | 8704 | 8764 | 9064 | 0 |
| 5 | 3 | 7563 | 7863 | 7863 | 7983 | 8043 | 8043 | 0 |

[Retained per-tick receipts](full-runs.json) include the corgi's position, heading, state, following flag, hidden transition, path goal/index and gate state from last human entry through physical shutter closure. It stays in `follow`, `following=false`; the existing safe-admission helper uses its 12-tick hidden transition where needed. It succeeds on the very first eligible closure tick in every run.

The closure eligibility tick is `max(lastHumanIn, metroAt + 180)`. Subtracting it from `shutterAt` gives **0, 0, 0, 0, 0**. The first two runs' 87/25 ticks of apparent waiting are the unexpired resident-view minimum. The final three start lowering on the same tick as last entry. Physical closure then takes exactly 120 ticks in all five; shelter completion takes exactly 180 ticks from lowering. Run 4's later level handover is the existing 300-tick engaged-combat run-out in `Mission.runOut()`, after shelter completion, not a corgi wait.

### Full five-person queue

Because the full playthroughs lost some humans in combat, a separate **5/5 real-input replay of the existing recorded five-survivor ingress fixture** checks the full queue. No actor poses were changed: `l5-po-metro-ingress.json`, low, follow camera zoom 1.5, one real ground click at the courier's current pose, then normal real-time simulation; no scripted stepping or state mutation during ingress.

Every replay has arrival **306**, all five inside **346**, lowering **486**, fully closed **606**, shelter done **666**, no console errors, and **zero additional corgi wait**. The 140 ticks (2.33 s) from last entry to lowering are exactly the remaining portion of the authored 180-tick view minimum. [Per-tick receipts](five-survivor-runs.json) retain the companion state through closure. This fixture isolates the queue and is supplementary evidence, not a claim of five-survivor full-level survival.

## Authored beat and frozen behavior

- `src/data/l5.ts`: `occupantViewS: 3`, `waitS: 10`; the ten seconds is a regroup grace, not a mandatory corgi timer.
- `LevelFiveAftermath.metro()`: humans must actually be sheltered and the three-second view minimum must expire. `shutter()` then calls the existing collision-safe `insideBeforeClosing()` admission helper.
- `LevelFiveAftermath.update()`: the leaf closes at `shutterAt + 120`; the shelter finishes at `shutterAt + 180`.
- `Mission.runOut()`: recent/engaged combat can add five seconds before the level handover; it does not hold the shutter open.
- E23-AC15 requires visible station occupants and admission of all living followers and the companion; E08-AC04 permits the existing 12-tick safe companion transition.

The original quote starts its second clock at **4/5**, before the final human has boarded. It therefore cannot establish a corgi-only delay from last-survivor entry. The logs above distinguish the last human, the resident-view floor, the shutter animation, and the level handover. They do not establish the cause of the historical 7.4 s sample without that sample's tick trace.

An exploratory click back toward the ring from the recorded deep stair pose stalled the human queue while the corgi was already inside. A provisional companion-route change did not resolve it, and was removed. That is not evidence of a corgi waiting outside or a reason to alter frozen L5 tuning. The unchanged standing-pose fixture and all five full runs remain completable; the return-to-ring contact case is a separate observation, not an unverified fix claimed here.

## Reproduce

```sh
npm run build:qa
E2E_PORT=4232 PLAYTEST_METRO_AUDIT=1 npx tsx tools/playtest/play.ts \
  --levels L5 --mode continue --entry debug --quality low --zoom 1.5 \
  --no-skip --level-minutes 9 --out test-results/q232-corgi/repeat
SCENE_PORT=4234 sh tools/e2e-lock.sh npx tsx tools/playtest/probe-q232.ts \
  test-results/q232-corgi/five-person-repeat 5
```

`PLAYTEST_METRO_AUDIT=1` adds read-only per-tick observations to the existing optional Metro audit; no new test cases are added. Full raw session logs/screenshots are under `test-results/q232-corgi/before-{1..5}` and `hold-confirmation`; the compact committed receipts above preserve the timing evidence.

## Checks

**Passed:** `npm test` (104 tests / 24 files), `npm run test:smoke` (6 QA + 1 public test, 137 s), `npm run scene:gate` (48/48, zero known/unrun), and `npm run verify -- E23` (typecheck, lint, 104 tests). No test cases were added. Final check receipts are recorded in [checks.json](checks.json). Gameplay, level data, difficulty values, and arrival/shutter/completion code remain byte-identical to the starting revision.
