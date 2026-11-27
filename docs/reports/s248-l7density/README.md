# s248 · L7 encounter density

## Design

The PO's 2026-11-26 request is to make L7 harder than the unlimited rocket launcher currently makes it. The encounter plan authors 560 high-tier / 280 low-tier regulars over the level, about 2.8× the earlier 200 / 100 plan, while keeping concurrent caps at 200 / 100. It authors exactly 14 Alphas on both tiers; all retain L7's existing 450 HP. No infected stats changed.

Authored regular distribution, high / low: opening 28 / 28; three street packs 65 / 57 each; rear pack 70 / 21; three high-tier trailing packs 49 each; final blocker 120 / 60. The final blocker stays at its E29-AC12 minimum so the boarding lane remains traversable. Alpha distribution, high: opening 3, streets 2/1/2, trailing 1/1/1, final 3; low: opening 3, streets 2/1/2, final 6. Final Alphas are spread across the corridor approaches.

The bus departure had an unbounded clearance wait when a dense crowd kept one body inside the swept hull after the fallback push. It now waits at most 30 ticks (0.5 s), then advances while cleanup continues clearing the lane. L7 party movement is 6.5 m/s on both tiers to match the departure's observed crowd pace.

## Native skilled policy, seeds 1–5

| Seed | Outcome | Time (s) | Deaths | Survivors saved | Max deaths at one checkpoint in any 60 s |
|---:|---|---:|---:|---:|---:|
| 1 | complete | 154.0 | 2 | 22 / 24 | 1 |
| 2 | complete | 133.7 | 1 | 22 / 24 | 1 |
| 3 | complete | 135.3 | 1 | 24 / 24 | 1 |
| 4 | complete | 142.9 | 1 | 24 / 24 | 1 |
| 5 | complete | 147.7 | 1 | 24 / 24 | 1 |

All five native runs completed, with no checkpoint reaching the three-deaths-in-60-seconds respawn-loop threshold. Seed 1 saved 22, above the 12-survivor minimum. Death windows were counted from `player.died` events grouped by the checkpoint active at death.

## Validation and open evidence

- `npm run typecheck`: PASS.
- `npm run lint`: PASS after removing an unused local in `tools/qa/diag/l8-protect-arrival.ts`.
- `npm run verify -- E29`: PASS after correcting the stale L5/L6 fixed-slot expectations to match the PO 11-26 survivor-only rifle rule; typecheck, lint and all 107 local unit tests passed in 116.6 s.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L7`: report contains only `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, which the request says to ignore; no acceptance flags were reported. The command exits 1 because that diagnostic-selection marker is present.
- Local unit suite: attempted within its 240-second budget; two failures remain outside this change (an existing fixed-slot expectation in `tests/engine/input.test.ts`, and the L6 group expectation in `tests/qa/invariants/waves.test.ts`). The focused L7 navigation test passed.
- Remote `npm run test:unit`: latest run exceeded the 240 s budget (241.2 s, exit 124). The corrected input test passed; the save-progression test failed after 31.98 s, consistent with its individual timeout, and full diagnostics were not emitted before the suite timeout. The same save-progression test passed locally in 8.7 s.
- HIGH then LOW headless game-camera captures were attempted with player invulnerability. The opening frames show a dense crowd around the 24-person group, with Alphas visible; the HIGH boarding frame shows a dense horde surrounding nine remaining survivors. The LOW run lost every survivor before reaching the bus, so no LOW boarding frame exists. Its bus approach frame shows the courier followed by infected and the HUD reports 0/0 survivors. The LOW run reported 12 ally-passive observations. Captures are in `test-results/s248-high-immortal/captures` and `test-results/s248-low-immortal/captures`; these are diagnostic playtest runs, not native seed evidence.
- LOW boarding fixture: `REVIEW_LEVELS=L7 REVIEW_TIER=low SCENE_PORT=5304 E2E_PORT=5303 sh tools/e2e-lock.sh node --import tsx/esm tools/scenelab/evac-bus.ts` passed for 1, 6, 12 and 24 passengers. The inspected `test-results/r4-bus/roster-24-webgl2-low/l7-boarded6-z1.5.png` shows passengers through the bus windows and the remaining group approaching. This isolated fixture moves the roster to the queue and clears infected, so it does not establish the appearance of boarding under horde pressure. A passing remote unit suite remains open.

- Baseline review: the L5 slot table and failing expectation are both unchanged from parent `48a14ae4`, so that failure predates s248. A second LOW boarding fixture retained infected and used the follow camera, but the 0.5 zoom frame failed the passenger pixel check and showed no horde; it does not satisfy the live-pressure visual review.

- Follow-up LOW live-pressure capture: the game follow camera shows 22 boarded, a survivor approaching, and infected engaging guards at the edge of frame (12 living infected within 30 m). This controlled fixture moved the 24-person roster to the queue, requested the authored final wave and stepped 400 ticks with player invulnerability; it is not a native completion run. The four reviewed frames are collected in [captures.jpg](captures.jpg).

- Remote isolation follow-up: `timing-isolated.sh --whole-run npm run test:unit` remained in the FIFO queue for over 14 minutes while the runner slots were occupied; the request was cancelled before execution. The prior remote timeout and the passing local full gate remain the latest suite results.
