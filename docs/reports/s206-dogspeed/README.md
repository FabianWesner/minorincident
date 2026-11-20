# s206 — Zombie dogs 1.5× faster, and the game stays winnable

Date: 2026-11-20  
Branch: `lane/dogspeed`  
PO commit retained: `fff25710` (`dogTuning.runFactor = 1.65`, exactly 1.5× the former 1.1 value)

## Findings and changes

The 1.65 run-factor change is retained. On the original L10 encounter counts, the skilled low-tier route reproduced the reported failure: 29 deaths and a tick-budget stop at `farmstead`. Event capture put the first death at (1189.3, -9.0), with repeated 10 HP hits from sprinters in the shed-field crossing. The next checkpoint deaths clustered around (1217.3, 3.0), where the farmhouse Alpha landed 25 HP hits. No dog was alive at those death frames, and the captured attack events at the deaths were from sprinters/Alpha, not dogs.

Two focused changes address the route while keeping all infected stats and QA thresholds unchanged:

- `LevelTenBot` now prioritizes an in-view dog during its committed pounce windup. Within 12 m, it selects the carried shotgun and keeps aiming/firing at that dog, giving the visible telegraph a practical counter.
- The L10 shed-field crossing is reduced from 17/12 regular infected (high/low) to 12/7. The crowded crossing plus the earlier farmhouse group overwhelmed the route before it could leave the farms. The corresponding world-systems census assertion is updated from 51/37 to 46/32 non-dog farm members.

A runtime-only comparison changed the in-memory dog definition back to the pre-PO 1.1 speed (no source file change); under the revised policy and encounter, L10 completed with 2 deaths. At the requested 1.65 speed, the focused L10 audit completed through credits with 4 deaths. The PO speed remains the sole dog-stat change.

## Validation

- `npm run qa:threat -- --levels L10`: skilled route completed through credits; the command reports only `PARTIAL_LEVEL_SELECTION` because this is a diagnostic slice. Passive L10 had no flags.
- Full `npm run qa:threat`: all ten skilled routes completed. One unrelated existing gate flag remains: `L8/phase/breached:SLOW_FOLLOWER:363`. Re-running L8 alone reproduced it; its passive route itself has no flags.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 27 files / 106 tests, within the 240-second budget. The remote full suite reached its 240-second budget without a reported test failure. The specified fallback passed: local full suite and remote `tests/engine/l4-contact.test.ts` (1 test).
- Scene Lab `inf-dog-pack` and `inf-dog-pounce` passed their automated checks at high tier on WebGL. The pack uses game zoom 1; the pounce fixture uses a close camera. Reviewed sparse contact sheets show approach and telegraphs, but do not establish foot sliding, turning radius, or pounce arc; dense motion review remains open.

## Open

The L10 route and local suite are green, but the requested completion gate is not fully met: the all-level threat audit has the L8 follower flag above, the remote full suite timed out (the specified fallback passed), and dense Scene Lab motion review remains open. These are recorded without changing thresholds or dog stats.
