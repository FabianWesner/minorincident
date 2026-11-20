# s206 — Zombie dogs 1.5× faster, and the game stays winnable

Date: 2026-11-20  
Branch: `lane/dogspeed`  
PO commit retained: `fff25710` (`dogTuning.runFactor = 1.65`, exactly 1.5× the former 1.1 value)

## Findings and changes

The 1.65 run-factor change is retained. On the original L10 encounter counts, the skilled low-tier route reproduced the reported failure: 29 deaths and a tick-budget stop at `farmstead`. Event capture put the first death at (1189.3, -9.0), with repeated 10 HP hits from sprinters in the shed-field crossing. The next checkpoint deaths clustered around (1217.3, 3.0), where Alpha entity 116 landed 25 HP hits. Entity 116 is the pursuing Mega Alpha; the original capture did not establish that it belonged to the farmhouse encounter. A full 29-death replay ledger is in `deaths.json`: each row gives tick, position, and up to eight damage applications attempted in the preceding 180 ticks (including invulnerable or blocked attempts, not a guaranteed list of damaging hits). No dog appears in those recorded attempts; the first death involved sprinters and armor, and subsequent attempts involved sprinters and Mega Alpha 116.

The following changes address the route and the full threat gate while keeping all infected stats and QA thresholds unchanged:

- `LevelTenBot` now prioritizes an in-view dog during its committed pounce windup. Within 12 m, it selects the carried shotgun and keeps aiming/firing at that dog, giving the visible telegraph a practical counter.
- Dog pounce render lift increases from 0.12 m to 0.35 m, making the spring readable without changing simulation or combat stats.
- L8 arena formations now clamp the formation origin with space for its rows before clamping individual targets. This reduces overlapping target positions at enclosure boundaries.
- The L10 shed-field crossing is reduced from 17/12 regular infected (high/low) to 12/7. The crowded crossing plus the earlier farmhouse group overwhelmed the route before it could leave the farms. The corresponding world-systems census assertion is updated from 51/37 to 46/32 non-dog farm members.

A runtime-only comparison changed the in-memory dog definition back to the pre-PO 1.1 speed (no source file change); under the revised policy and encounter, L10 completed with 2 deaths. At the requested 1.65 speed, the focused L10 audit completed through credits with 4 deaths. The PO speed remains the sole dog-stat change.

## Validation

- `npm run qa:threat -- --levels L10`: skilled route completed through credits; the command reports only `PARTIAL_LEVEL_SELECTION` because this is a diagnostic slice. Passive L10 had no flags.
- Full `npm run qa:threat`: passed with zero flags and all ten skilled routes complete after the L8 formation adjustment. The gate’s L8 skilled observation still reports diagnostic `UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS` and `SLOW_FOLLOWER:423` phase flags; these are not promoted into the top-level gate flags. Before the adjustment, L8 follower 363 measured 4.07 m/s against a 4.42 m/s group median; a diagnostic slot swap implicated formation placement.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 27 files / 106 tests, within the 240-second budget. Remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on code revision `8fe28a4c`: 27 files, 105 tests passed and 1 skipped, 190.9 seconds.
- Scene Lab `inf-dog-pack` and `inf-dog-pounce` passed automated checks at high tier on WebGL. The pack was reviewed at game zoom 1; a copy of the pounce fixture with game zoom 1 also passed and was reviewed, alongside a closer side view. The zoom-1 samples show the approach, turn toward a moving courier, telegraph and lunge; the side view shows the revised 0.35 m airborne arc and landing.
- The gait phase integrates actual distance with speed-dependent stride (gallop cadence capped at 2.7 cycles/s). The close gait fixture reported 17 contacts, 0.2 cm maximum slide, 0.1 cm p95 and zero sink. The zoom-1 moving-courier fixture reported 14 contacts, zero measured slide and sink, and 0.1° maximum yaw drift. These are scoped samples, not a measurement of every surface or minimum turning radius.

## Open

The full threat audit ran before the later render-only pounce lift; the remote suite and dog Scene Lab checks include that lift. L8 skilled diagnostic phase flags remain visible in the detailed receipt even though the full gate has zero top-level flags. No minimum turning radius or all-surface gait claim is made.
