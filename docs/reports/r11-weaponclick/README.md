# r11-weaponclick

PO: "Let me select a weapon by clicking with my mouse (in addition to numbers)".

## Change
- `src/ui/Hud.ts`: rack slots are now `<button type=button>` (aria-label "bat · 2", title unchanged). Click calls `InputSystem.selectWeaponKey(key)`. Slots without a number key are `disabled`. `mousedown` is default-prevented so focus stays on the canvas (Space/Enter never re-click a slot).
- `src/input/InputSystem.ts`: `selectWeaponKey(key)` sets the same `selectedWeaponKey` that `Digit1-9` sets, so the InputFrame, telemetry codec (`c[21]`), replays and `Loadout.input` are unchanged. Returns false (ignored) while driving or on a mounted gun, exactly where number keys are ignored.
- `src/ui/ui.css`: slots get `pointer-events:auto`, pointer cursor, hover and pressed states, text selection stays off (`user-select:none`).
- No shot / move / aim: the canvas Pointer listens for `mousedown` on the canvas only; the HUD is a sibling DOM layer, so slot presses never reach it.
- Touch: the rack is hidden under the touch scheme (touch has its own round weapon slots), so there is nothing to tap there; `click` works on touch-capable devices that show the rack.

## Checks
- `tests/engine/input.test.ts` (folded into the "weapon selection" test, no new case): click path equals key path, nothing else in the frame, one-shot, rejects 0/10, ignored while driving.
- `tsc --noEmit` clean, `npm run lint` clean.
- Default Vitest project: 104 pass, 3 fail in `tests/tools/gate-tools.test.ts` (scene gate child processes). Cause is the slim worktree's empty `node_modules` (children exit 1), not this change. `npm test` itself cannot start in this worktree for the same reason, so vitest was run from the main checkout's `node_modules`.

## Browser verification: PENDING
Not done: the perf12 window was not released (no orchestrator message) and it is before 17:30. Still needed: real-mouse click on slots 2/3 (browser pool, max 2 workers), confirm weapon switches, no shot, courier position unchanged, before/after capture in `test-results/`.
