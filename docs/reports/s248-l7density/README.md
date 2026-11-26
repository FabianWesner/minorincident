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
- `npm run verify -- E29`: could not start; TSX was denied permission to create its IPC pipe (`EPERM`).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L7`: report contains only `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, which the request says to ignore; no acceptance flags were reported. The command exits 1 because that diagnostic-selection marker is present.
- Local unit suite: attempted within its 240-second budget; two failures remain outside this change (an existing fixed-slot expectation in `tests/engine/input.test.ts`, and the L6 group expectation in `tests/qa/invariants/waves.test.ts`). The focused L7 navigation test passed.
- Remote unit suite: not run; `tools/remote/run.sh` returned 69 because no healthy Hetzner runner is running or provisioned.
- HIGH then LOW headless game-camera captures were attempted with player invulnerability. The opening frames show a dense crowd around the 24-person group, with Alphas visible; the HIGH boarding frame shows a dense horde surrounding nine remaining survivors. The LOW run lost every survivor before reaching the bus, so no LOW boarding frame exists. Its bus approach frame shows the courier followed by infected and the HUD reports 0/0 survivors. The LOW run reported 12 ally-passive observations. Captures are in `test-results/s248-high-immortal/captures` and `test-results/s248-low-immortal/captures`; these are diagnostic playtest runs, not native seed evidence.
- The remote unit request was retried after access changed, but remained queued for several minutes without starting; it was stopped. LOW boarding capture and the remote suite remain open.
