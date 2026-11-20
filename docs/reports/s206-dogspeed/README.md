# s206 — Zombie dogs 1.5× faster, and the game stays winnable

Date: 2026-11-20  
Branch: `lane/dogspeed`  
PO commit retained: `fff25710` (`dogTuning.runFactor = 1.65`, exactly 1.5× the former 1.1 value)

## Findings and changes

The 1.65 run-factor change is retained. On the original L10 encounter counts, the skilled low-tier route reproduced the reported failure: 29 deaths and a tick-budget stop at `farmstead`. Event capture put the first death at (1189.3, -9.0), with repeated 10 HP hits from sprinters in the shed-field crossing. The next checkpoint deaths clustered around (1217.3, 3.0), where Alpha entity 116 landed 25 HP hits. Entity 116 is the pursuing Mega Alpha; the original capture did not establish that it belonged to the farmhouse encounter. No dog was alive at those death frames, and the captured attack events at the deaths were from sprinters/Alpha, not dogs.

Two focused changes address the route while keeping all infected stats and QA thresholds unchanged:

- `LevelTenBot` now prioritizes an in-view dog during its committed pounce windup. Within 12 m, it selects the carried shotgun and keeps aiming/firing at that dog, giving the visible telegraph a practical counter.
- The L10 shed-field crossing is reduced from 17/12 regular infected (high/low) to 12/7. The crowded crossing plus the earlier farmhouse group overwhelmed the route before it could leave the farms. The corresponding world-systems census assertion is updated from 51/37 to 46/32 non-dog farm members.

A runtime-only comparison changed the in-memory dog definition back to the pre-PO 1.1 speed (no source file change); under the revised policy and encounter, L10 completed with 2 deaths. At the requested 1.65 speed, the focused L10 audit completed through credits with 4 deaths. The PO speed remains the sole dog-stat change.

## Validation

- `npm run qa:threat -- --levels L10`: skilled route completed through credits; the command reports only `PARTIAL_LEVEL_SELECTION` because this is a diagnostic slice. Passive L10 had no flags.
- Full `npm run qa:threat`: all ten skilled routes completed. One unrelated existing gate flag remains: `L8/phase/breached:SLOW_FOLLOWER:363`. Re-running L8 alone reproduced it: follower 363 had a 4.07 m/s median across 366 walking samples versus the 4.42 m/s group median. Its passive route itself has no flags. A separate 30-tick route probe identifies 363 as uninjured `zoo-carried-8`, formation slot 8. Its median resolved speeds during moving-courier samples were 2.67 m/s on the flamingo leg and 2.60 m/s on zebra, versus 4.55–4.72 m/s on the other arena legs. This broader probe does not reproduce the gate’s exact sample filters; the cause of the gap remains undiagnosed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 27 files / 106 tests, within the 240-second budget. The remote full suite reached its 240-second budget without a reported test failure. The specified fallback passed: local full suite and remote `tests/engine/l4-contact.test.ts` (1 test).
- Scene Lab `inf-dog-pack` and `inf-dog-pounce` passed their automated checks at high tier on WebGL. The pack uses game zoom 1; the pounce fixture uses a close camera. Reviewed additional six-frame interval sheets for frames 0–144: the dogs approach and the telegraph rings appear, but the pack is too small in frame to judge paw contact and turning, and the close pounce fixture starts with the dog off-screen. A supplementary close camera following the dog captured frames 0–180 at eight-frame intervals: leg poses change during approach and the ring appears before contact. The render path selects `dog-gallop` above 3 m/s and integrates gait phase from actual distance using a speed-dependent stride; its corgi-gallop cadence is capped at 2.7 cycles/s as stride length grows. This establishes the playback mechanism, not absence of foot slip. Because the camera follows the dog and the approach is straight, these frames do not establish planted-paw slip or turning radius; the pounce arc also remains unverified.

## Open

The L10 route and local suite are green, but the requested completion gate is not fully met: the all-level threat audit has the L8 follower flag above, the remote full suite timed out (the specified fallback passed), and dense Scene Lab motion review remains open. These are recorded without changing thresholds or dog stats.
