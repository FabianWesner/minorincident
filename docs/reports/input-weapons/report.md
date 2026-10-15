# PO 10-15 input/weapons (#9, #14)

Input regressions pass. Full release QA has the failures and missing measurements listed below.

Space uses the selected carried action instead of forcing the LEFT rack. Its device latch preserves taps between simulation ticks, holds, releases and blur/reset behavior; J/K and touch retain explicit side attacks. Guns therefore keep their selected rack and fire normally. Magazine test weapons respect their reload lockout; the campaign handgun and army MG remain bottomless.

`src/data/weaponOrder.ts` is the selection-order source for all catalog actions and the mounted minigun's reserved position. Active Q/RMB cycling and active numbers use its global ordering; keyboard side numbers, touch swipes and HUD side cycling use the same ordering within the requested rack. The diagnostic loadout display uses the ordered, deduplicated carried list. Stored rack order, checkpoint indices and slot timers remain intact. Telemetry preserves both new flags, with existing flag positions unchanged.

## Regression evidence

- #9: reversing the intent routing in an isolated remote snapshot fails the new simulation regression (the old path attacks with the bat). The corrected regression exercises every catalog action on the selected RIGHT rack, checks actual ranged damage, and checks that an empty/reloading SMG does not fire or silently select the bat.
- #14: the new L4 acquisition-order simulation fails before the change: axe appears before bat and corgi lure before handgun. It checks ordered active cycling, number selection, side cycling, checkpoint reconstruction, retained pickups and complete table coverage.
- Real keyboard/mouse-event browser regressions cover Space with a selected RIGHT handgun and mixed number/Q/RMB/HUD selection with the PO's unordered loadout.

## Courier visual issue (P1 report)

The [original PO capture](po-shins.webp) clearly shows large black cubes around both shins and a pale rectangular plate below the shoes, together with long ragged shadows. These are real visible artifacts in that capture. `src/render/characters/CharacterView.ts` creates tier-2 shin pads as plain `BoxGeometry(0.14, 0.12, 0.14)` attached to both shin nodes, plus box arm pads and a box holster. This explains the shin cubes; the sole plate and smeared shadow need visual asset/ground-contact review. The input fix does not modify those meshes. `tests/scenes/catalog/input-weapons-handgun.json` adds a reproducible tier-2 female courier fixture with the handgun selected, for both renderers and the quality/zoom matrix.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- Final focused remote command: `npx vitest run tests/sim/selected-weapon.test.ts tests/sim/weapon-order.test.ts tests/unit/input tests/unit/combat tests/unit/telemetry --maxWorkers=4`: **65/65 tests, 17/17 files pass**.
- Remote full unit/sim/level sweep: **2,799 pass, 17 fail, 9 skip** across 432 files (412 pass / 17 fail / 3 skip), 61.6 minutes test runtime. The 17 failures are **15 sim p95 overruns and two timeouts** (L10 arrival at 120 s, production asset validation at 300 s). Both L6 policies, the full L10 route and the continuous L1→L10 campaign pass. [Exact failures and assertions](remote-failures.txt). This was a shared runner (initial load 8.77); no limits were loosened. An isolated horde/weapon measurement could not obtain both runner slots during about 30 minutes of attempts across runners and was cancelled. The shared-run timing failures remain unresolved; E18 is not claimed fully green.
- Fresh-build mouse/keyboard: **22/22 pass**, Chromium, one worker, no retries needed. The added order test initially used a HUD-less fixture and timed out; corrected to the existing `hudStart` fixture before the green rerun. Pixel 7 touch: **10/10 pass**.
- Final same-tick number+Q guard: typecheck/lint/build pass; the existing order sim regression now checks that only the newly selected rack cycles. Final focused remote rerun: **65/65 pass** (17 files), including the same-tick guard. The full sweep snapshot predates this final guard; the later targeted rerun validates the guard.
- Scene Lab WebGL2 matrix: **unmeasured**; cancelled after 30 minutes queued without admission, per the binding fairness rule. No fresh WebGL2 visual review is claimed. WebGPU matrix was also cancelled after 30 minutes queued without admission. Both fresh renderer matrices (high/low quality; zoom 1.0/0.5, plus 1.5) are unmeasured. The original PO image above was inspected; no fresh game-camera captures or fresh-renderer visual review are claimed. The fixture is ready to rerun when browser slots are available.
- Quiet-run performance batch: 3 pass, 5 fail, 1 intentionally skipped. High/low horde counters pass; native Metal WebGL2 desktop p50 **5.3 ms**, p95 **7.8 ms** (16.7 ms budget). [Native timing proof](desktop-gpu.json), [high horde](horde-high.json), [low horde](horde-low.json).
- Four L5/L6 counter fixtures fail loading with `Infected concurrency cap reached`, before a budget can be measured. The weapon render/unload case stays within draw/triangle budgets but fails geometry disposal equality (11 vs baseline 1); [proof](weapon-render-perf.json). No limits or assertions changed. These failures are outside the changed input/order paths; no baseline comparison has yet established whether they predate this branch.

## Commits

- `d361b6a30`: Space uses the selected weapon.
- `b3d4b1996`: central weapon order and device selection.
- `bd85009a5`: actual firing/reload regression, HUD test fixture and tier-2 courier Scene Lab fixture.
- `d730addad`: same-tick number/Q rack guard, validated by the final 65-test focused rerun.
