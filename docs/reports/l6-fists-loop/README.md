# L6 fists and weapons completion

Branch: `lane/l6-weapons-flow`. Final functional tree: `d404c97da`; subsequent commits record evidence. Base: `56d7e7d16`, starting lane tip: `54e86bba2`.

## Real-input acceptance

All three cases below use the same final driver and game code, headless WebGL2 through native Metal, low quality, zoom 1.5, seed 1. Times are wall seconds; result-screen game times exclude loading and UI time.

| Case | Entry | Time | Deaths | Skipped steps | Actual player attacks | Survivors out |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| [Fists, male](final-fists/summary.json) | Real L5 → L6 campaign handover | 349 s | 2 | 0 | 81 fists, 45 kicks | 8/28 |
| [Weapons, male](final-weapons-male/summary.json) | Seeded `L6-default`, menu Continue | 221 s | 0 | 0 | 215 machine gun, 11 axe | 11/29 |
| [Weapons, female](final-weapons-female/summary.json) | Seeded `L6-default`, menu Continue | 219 s | 0 | 0 | 226 machine gun, 10 axe | 12/29 |

The fists prelude completes L5 in 249 s, with zero deaths, zero skips and 38 fist attacks. Its L6 start save preserves the actual handover and its fists/kick racks; those racks also remain at the end. Both weapons saves use the game's Campaign API and the standard preset racks/upgrades. Each final folder contains its start save, complete log, issue list, summary and result screenshot; weapons folders also contain the seed record. The [provenance audit](validation/playthrough-audit.json) checks characters, seed, carried racks, combat events and empty skip lists for all three cases.

`test=poses` enables rendered-body observations while retaining the production clock, UI and prewarming paths. The driver rejects missing render observations and records actual player `combat.attack` events. Inputs use keyboard/mouse, the HUD, rendered bodies, remembered visible positions and the existing navigation helper. The accepted logs contain no `skip-step` callback. Earlier input comparisons are retained in separate folders; the discarded empty-enemy probe supplies no acceptance evidence.

## Cause and fixes

- **`2f25c41f7`: checkpoint guard.** The global `!behind` condition withheld gate 90 even after every injured person crossed it, because someone still lagged behind the later column near gate 150. Death therefore restored the shelter. `a3d61446a` checks the straggler against each particular gate, preserving the healthy-column and living-majority requirements.
- **`d85d22d84`: rejoin bound.** The scripted leader bounded rejoining even when the real column had moved ahead. A returned person followed the courier back into the next fetch. `5b7037e83` uses the actual column head.
- **Driver coverage.** The gun retains its held target click; close crowds use the carried axe through J, or the unarmed kick through K, while moving toward the visible objective. The driver paces the fetched person using rendered bodies and last seen positions. L6 civilians retain civilian factions, so the sensor explicitly includes those visible humans. K returns to the carried right-hand gun at range.

The [bisection and regression record](regression.md) includes the main/last-good/first-bad/starting-tip comparisons, the live gate trace and red/green logs. The [12 level regressions](../../../tests/levels/l6-weapons-flow.test.ts) include a moving fetch/bring reproduction and two death/respawn cycles with injured survivors beyond gate 90. The latter fails with `abandon` before the fix and preserves `gate-90` afterward; the retreat and injury work remain active.

L5 gameplay, horde caps, damage and movement speeds match main. The gate-panel QA staging now places the courier inside the existing interaction zones and initializes guidance after staging the column. Its panel text, viewport bounds, gate-health and timing assertions are retained.

## Validation

All four requested acceptance gates pass. The additional full E24 validation retains seven failures also reproduced on main:

| Gate | Result |
| --- | --- |
| Typecheck, lint, production build | Pass on the final tree; [command records](validation/E24-checks.json) |
| E24 simulation selection | 67 pass, zero failures; other tests are excluded by the existing E24 name filter |
| Mac `tests/e2e/levels/l6-*.spec.ts`, workers 1 | 10/10 pass, 2.9 min; [log](validation/l6-browser.log), [JSON](validation/l6-browser.json) |
| `npm run verify -- E24` | 67 selected sim tests pass; browser 53 pass / 7 fail, exit 1. All seven failures also occur on main; [log](validation/verify-E24.log), [comparison](validation/E24-baseline-comparison.json) |
| Remote `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels --maxWorkers=4` | Exit 0: 414 files / 2,251 tests pass; 3 files / 11 tests retain their existing skips. [Full log](validation/remote-final.log) |
| Native L6 performance and scream checks, workers 1 | 12/12 pass, 2.3 min, run separately after the broad browser failure; [log](validation/performance.log), [JSON](validation/performance.json) |
| New L6 weapons-flow regressions | 12/12 pass on the final remote tree |

The native Mac unit attempt passed 1,828 tests and failed the existing Linux runner cache-GC fixture: it invokes GNU `stat -c`, unavailable on macOS. The required Linux suite includes that fixture. Its native failure is preserved in the validation evidence; its assertions were retained.

The seven additional E24 browser failures are: T-E24-17 remains in `playing`; the two T-E24-15 contrast cases fail the red-eye margin / living-subject checks; and four T-E29-16 L7 entry cases retain checkpoint `rocket` when expecting `corridor`. Running these exact cases on `56d7e7d16` reproduces the same seven assertion failures. Both test files are byte-identical between main and the final tree. [Main log](validation/E24-baseline-seven.log), [main results](validation/E24-baseline-seven.json), [final broad results](validation/E24-browser.json). No assertions or thresholds were changed to bypass these existing failures.

The complete/newbie sims retain main's test bands and tuning: complete 180–300 s, newbie 195–300 s. Coverage is seed 1 and the three recorded real-input outcomes; the playthrough survivor counts are shown above.

| Seed-1 sim | Main `56d7e7d16` | Final tree | Deaths, main/final | Peak infected, main/final |
| --- | --- | --- | --- | --- |
| Complete | 264.50 s, 27/29 out | 283.62 s, 23/29 out | 0/0 | 59/45 |
| Newbie | 257.43 s, 12/29 out | 269.42 s, 18/29 out | 0/0 | 49/50 |

Final records: [complete](../../../test-results/epics/E24/complete-seed-1.json), [newbie](../../../test-results/epics/E24/newbie-seed-1.json). Horde caps remain high 60 / low 30; healthy/injured walking speeds remain 2.2/1.4 m/s. The existing sim assertions are retained.

Commands use `E2E_PORT=4021`, `SCENE_PORT=4022`, `E2E_UNITS=1`, `E2E_ADMISSION_TIMEOUT_SECONDS=3600`; browser workers are 1 and Vitest workers at most 4. All commits remain on the lane branch. The one temporary main-comparison worktree was removed after validation.

## Visual review

All eight final captures were inspected. These staged compositions are visual evidence; real-input completion records are linked above. [Checkpoint/position/error metadata](captures/evidence-webgl2.json) records zero errors in every image. Objective text was read from the images.

| Composition | Zoom 1 | Zoom 1.5 | Observed |
| --- | --- | --- | --- |
| High, held group | [Image](captures/webgl2-high-held-z1.png) | [Image](captures/webgl2-high-held-z1.5.png) | Courier beside the walking head; readable “Cover the retreat through the tunnel · 10 m”. Zoom 1 shows the edge arrow; zoom 1.5 also shows the ring/diamond at the lower right. |
| Low, held group | [Image](captures/webgl2-low-held-z1.png) | [Image](captures/webgl2-low-held-z1.5.png) | Same guidance and group placement; courier and rails remain lit and readable. |
| High, respawn | [Image](captures/webgl2-high-respawn-z1.png) | [Image](captures/webgl2-high-respawn-z1.5.png) | Courier and corgi beside the passed gate, group ahead; readable “29/29 through · E to close the gate · 29 m”. |
| Low, respawn | [Image](captures/webgl2-low-respawn-z1.png) | [Image](captures/webgl2-low-respawn-z1.5.png) | Same safe placement and complete two-line guidance; gate and group remain visible. |

Held: player `(52,15)`, ring `(62.11,15)`, within the 12 m guidance lead from the real head. Respawn: checkpoint `gate-90`, passed flag true, player `(92.4,17.3)`, ring `(121.25,15)`. The images show the gate still available for the ordinary close interaction.
