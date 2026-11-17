# s154 — LOW exits and escape guidance

## Status

Accepted on product commit `fa4d4e16`: native LOW/HIGH normal walk and skilled routes complete within the escape/exit death limits; LOW WebGPU real input completes both levels; HIGH WebGPU rechecks also complete within the limits. Full threat audit: **0 fail flags**.

Native seed-1 full routes on the fixed build:

| Policy | L4 LOW escape | L4 HIGH escape | L6 LOW exit | L6 HIGH exit |
| --- | ---: | ---: | ---: | ---: |
| Normal walk | 0 | 2 | 0 | 0 |
| Skilled | 1 | 0 | 0 | 0 |

All eight runs complete. Normal walk uses the shared complete bot's route, combat, holds and interactions with only `walk: true` applied to its ordinary input. It is not an independent straight-line policy. L6 walking runs have three retreat deaths per tier; skilled L6 has none. L4 defense deaths are excluded from the escape column and retained in JSON.

LOW WebGPU visible-input L4 completes in **374 wall seconds, two escape deaths**, six defense deaths, no skips, no issues and no manual correction. Standard real-input LOW WebGPU L6 completes in **223 wall seconds, one exit death**, no skips; its only warning is the opening shelter rest reported as navigation delay. HIGH WebGPU visible-input L4 completes in **389 seconds with two escape deaths**, eight defense deaths, no skips/issues and no manual correction. The final standard-input HIGH L6 recheck completes in **240 seconds with zero exit deaths**, two retreat deaths and no skips. It uses one recorded physical stair alignment described below. All browser runs use zoom 1.5, headless Metal/WebGPU, one browser at a time through the pool/e2e lock, ten-minute reservations and ports 5045/5046.

## Confirmed cause and product change

At the first L4 street corner, the baseline visible-input player stopped at approximately (-3.3777, 40.9899), while the displayed ring was (-3.375, 41.125): only 14 cm away. The navigation grid requires a 12 cm arrival to advance that corner. A player following the displayed ring could therefore stop inside it without advancing the hint. A disposable native checkpoint probe reproduces that exact marker. The existing contact test now includes the recorded position and requires an onward marker outside its 1.4 m radius with a clear physical approach.

`LevelFourWar.cellarApproach` now extends a very near intermediate hint 1.5 m along its existing bearing **only when the same navigation collision sweep confirms that continuation is clear**. It keeps the original path search/grid, route and safety checks. No actor moves automatically. At the recorded position the new hint is approximately (-3.3477, 42.4896), rather than under the courier. A trial using a coarser grid failed the clear-approach assertion and was discarded.

The baseline LOW visible-input L4 completed only after a one-second physical KeyS correction, in 530 seconds with six escape deaths. It had waited at the corner long enough for additional pressure to arrive. On the fix, the same driver crosses that corner without intervention, reaches the next street near x=46 at tick 15,870, and completes 156 seconds sooner with two escape deaths. No tools/playtest source was edited.

## Tier diagnosis and L6 driver evidence

The evidence does **not** establish a universal LOW combat penalty. L4 still has half-size authored collapse groups on LOW, fewer allied soldiers and a lower population cap; the live admission/battlefield differs with those budgets. Neither infected stats nor corpse lifetime depends on this fix. LOW's normal-walk escape is easier than HIGH in the native receipts. Both L6 native tiers produce the same walking completion/death counts, and skilled L6 completes with zero deaths on both.

The baseline L6 browser driver's failure is confounded by navigation. A visible-only LOW diagnostic capped at 541 seconds near x=241.7 before crossing the stairs, after seventeen retreat deaths. Standard LOW real input completes with one exit death. A HIGH standard follow-up reached the old failure coordinate x≈249.4, z≈11.2 at ground height, beside the stairs; it eventually completed in 311 seconds with six exit deaths after recorded physical correction attempts. That run is retained as diagnostic evidence, not a ≤5 pass.

The native route approaches the stair centre at approximately (250,15), rather than directly bearing toward (273,15) from beside the stair. The final HIGH retry applies that correction before becoming pinned: at tick13280, x244.34/z12.63, a 527 ms physical KeyA+KeyS input aligns the approach toward z15. The existing driver then crosses the stairs and completes without an exit death. The control is consumed at tick13303 and captured in the log. A driver correction should return to the approach west of x246, align near z15, then climb the marked runs. It should not keep pressing east against the side of the stairs or retreat into the crowd. This report does not claim that sparse browser proximity identifies every killing blow.

## Evidence and reproduction

Raw receipts remain under `test-results/s154-lowexits/`. `qa.json` retains full native run summaries, death positions, nearby bodies and same-tick combat receipts. It distinguishes `combat.hit`/`combat.kill` receipts for the same attack ID from separate attackers. Native escape death sources are hazmat ID172 (skilled LOW), hazmat ID262 and armored ID267 (walking HIGH). Browser death samples retain recent damage sources where observed; gaps remain explicitly indirect.

Run native normal walk with `node --import tsx tools/qa/s154-walk.mts`; add `S154_SKILLED=1` for the skilled comparison. The task-specific HIGH wrapper `tools/qa/s154-high-recheck.mts` boots the unrelated title backdrop at LOW, then lets the unchanged driver select HIGH through title settings before entering the requested level. Its first configuration read supplies only the initial URL; subsequent reads and the driver's level-entry tier verification use HIGH. For HIGH L6 the wrapper is invoked with `L6` and without `PLAYTEST_VISIBLE_ONLY`; its physical alignment is submitted through the existing control-file interface. Cold HIGH title startup consumed roughly five minutes of earlier reservations, which expired before full L4 completion. Those incomplete attempts are retained and are not acceptance passes.

Reviewed one small [approach sheet](approach-review.jpg). It shows LOW L4 beyond the fixed corner and inside the cellar, plus the final HIGH L6 stair alignment and actual completion panel. The gameplay logs, rather than the sheet alone, prove the route and death counts.

## Validation and invariants

- Existing L4 contact test passes with the additional recorded-corner regression assertions: 82.67 s.
- Typecheck, lint and QA build pass.
- Prescribed unchanged `sh tools/remote/run.sh "$PWD" -- npm test` passes on 46.225.66.90: 176.6 s within 240 s. Budget inventory remains 150/150; Vitest reports 105 passed and one pre-existing skipped test. No trimming or timeout increase.
- `npm run verify -- E22` and `-- E24` both pass their per-change gates.
- Full sharded threat audit on `fa4d4e16` passes with **0 fail flags**, 528.6 s; all ten levels are included.

Zombie stats, encounter/horde sizes, corpse persistence, specs and protected references are unchanged. No deployment, push, main movement or tools/playtest edit occurred.
