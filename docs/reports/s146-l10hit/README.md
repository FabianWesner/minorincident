# s146-l10hit · L10 farm melee damage

## Finding

The B113 L10 warning is **not reproduced as a product hit failure**. A native L10 reproduction at the authored farm shed position (x=1170, z=-26) placed a real `infected.runner` 1.1 m from the courier on the same support level. With the fire axe selected, a held eight-second attack produced a target-selection query and a `combat.hit` event for that runner on the first swing; the runner went from 60 HP to 0. The same controlled contact probe registered a courier melee hit in L5, L6, and L8.

The original driver warning remains unqualified. B113 has a still frame showing the drawn arc over a nearby body, but no per-attack target query or hit event. The playtest detector in `tools/playtest/session.ts` classifies unchanged HP after its observation window; that alone cannot distinguish a true in-arc miss from aim, cover, or an attack input that did not resolve. I did not edit the playtest driver. The driver-side follow-up is to record each melee `combat.attack` by attack ID, the target selected when its active frame resolves, the hit IDs and damage, and a concrete miss reason before emitting `enemy-unhittable`.

No shared product root cause was demonstrated, so no product change was made. The B113 warning is not evidence that every visually overlapping body is inside the XZ melee query or unobstructed. The exact historical #134 input/position trace is unavailable; this report does not claim that the driver-only cause of that individual warning is proven.

## Native evidence

- [evidence.json](evidence.json) records the native attack trace: tick, weapon, facing, selected target, attack ID, hit IDs, target damage events, and HP. The L10 record uses the authored farm shed coordinates and a constructed tick-13892 mission-resume fixture.
- [s146-l10-farm-melee-contact.json.gz](../../../tests/fixtures/saves/qa/s146-l10-farm-melee-contact.json.gz) is the replayable fixture. It is constructed evidence, not a recovered B113 save.
- [b113-l10-capture.jpg](b113-l10-capture.jpg) is the one reviewed frame from the B113 report. It shows the character, drawn axe arc, nearby runner, and roof edge; it does not expose world-space height, query result, or attack event.
- The controlled L5/L6/L8/L10 probes use a QA-only 9 s stun after fixture capture to hold the live runner still through the axe windup. It changes no health or infected stats. L7's start probe is explicitly intercepted: three nearby soldiers deal 25 + 25 + 10 damage at tick 2, before the courier's first axe active tick (tick 7). L9 starts in the APC during its driving phase and has no on-foot melee window before the forced crash. Those rows do not count as courier melee misses.

## Validation

- Focused combat test: `npx vitest run tests/engine/combat.test.ts -t 'guns: held fire cadence' --maxWorkers=4 --configLoader runner` — passed.
- Native fixture loader: `node --import tsx/esm tools/qa/check-fixtures.ts` — passed, including the new L10 farm fixture.
- `npm run typecheck` and `npm run lint` — passed.
- Full local `npm test` — passed, 27 files / 106 tests in 139 s; the test budget reported 150/150 inventory cases.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test` could not start because no Hetzner runner was healthy. `sh tools/remote/scale.sh add` also could not reach the provider because outbound DNS is blocked. The local full run is supplemental and is not reported as a remote pass.

No zombie stat tuning, corpse removal, driver edits, browser run, deploy, push, or main movement.

## Remote follow-up

After filesystem/network access was restored, the report and regression were committed as `e656951d`. The prescribed full remote command then ran twice unchanged on 94.130.181.173. Both runs passed the combat battery but failed the existing L4 contact case at its 150-second timeout (104 passed, one skipped, one failed; total budget times 207.8 s and 216.6 s). The original infrastructure-unavailable result above is historical. No test was trimmed or timeout increased. Root-cause attribution and HIGH/LOW browser confirmation remain open; this commit does not close the requested goal.
