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
- `npm run verify -- E29`: typecheck and lint passed; its local unit phase failed the existing L5 fixed-slot assertion in `tests/engine/input.test.ts` (106 passed, 1 failed).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L7`: report contains only `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, which the request says to ignore; no acceptance flags were reported. The command exits 1 because that diagnostic-selection marker is present.
- Local unit suite: attempted within its 240-second budget; two failures remain outside this change (an existing fixed-slot expectation in `tests/engine/input.test.ts`, and the L6 group expectation in `tests/qa/invariants/waves.test.ts`). The focused L7 navigation test passed.
- Remote `npm run test:unit`: ran on mi-runner-1; exceeded the 240 s budget (241.3 s, exit 124). It reported failures in the existing L5 fixed-slot test and the save-progression test before timeout; full diagnostics were not emitted.
- HIGH then LOW headless game-camera captures were attempted with player invulnerability. The opening frames show a dense crowd around the 24-person group, with Alphas visible; the HIGH boarding frame shows a dense horde surrounding nine remaining survivors. The LOW run lost every survivor before reaching the bus, so no LOW boarding frame exists. Its bus approach frame shows the courier followed by infected and the HUD reports 0/0 survivors. The LOW run reported 12 ally-passive observations. Captures are in `test-results/s248-high-immortal/captures` and `test-results/s248-low-immortal/captures`; these are diagnostic playtest runs, not native seed evidence.
- LOW boarding fixture: `REVIEW_LEVELS=L7 REVIEW_TIER=low SCENE_PORT=5304 E2E_PORT=5303 sh tools/e2e-lock.sh node --import tsx/esm tools/scenelab/evac-bus.ts` passed for 1, 6, 12 and 24 passengers. The inspected `test-results/r4-bus/roster-24-webgl2-low/l7-boarded6-z1.5.png` shows passengers through the bus windows and the remaining group approaching. This isolated fixture moves the roster to the queue and clears infected, so it does not establish the appearance of boarding under horde pressure. A LOW boarding capture under live pressure and a passing remote unit suite remain open.

- Baseline review: the L5 slot table and failing expectation are both unchanged from parent `48a14ae4`, so that failure predates s248. A second LOW boarding fixture retained infected and used the follow camera, but the 0.5 zoom frame failed the passenger pixel check and showed no horde; it does not satisfy the live-pressure visual review.
