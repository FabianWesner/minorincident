# E03 · Input and Control Schemes

## Goal
Turn every device into one pure `InputFrame` per sim tick, `{ move: Vec2, aim: Vec2|null, aimSource, left: Button, right: Button, selector: Edge, interact: Edge, pause: Edge }`, so the sim stays device-agnostic. Ship all control schemes from `00-game-concept.md` §5.3: **mouse-only, mouse+keyboard, keyboard-only, mobile touch**. Gamepad is **not in v1**.

## Depends on / Enables
E01 / E04, E05, E09, E14.

## Scope
**In:** device adapters (pointer incl. middle button, wheel, keyboard, touch), the cursor → ground-plane raycast, the mouse-only dead-zone steering, camera-relative WASD, keyboard aim rotation and snap, the touch floating stick and the drag-to-aim action buttons, scheme auto-detection and switching (the last device used wins), rebinding with persistence, preventing the context menu on RMB and browser autoscroll on middle-click, input recording and playback (for tests and bug repro), and **releasing all held inputs on window blur / tab hidden** (Bruno `Keyboard.js`), so no key stays stuck when the player comes back.
**Out:** HUD art for the touch controls (E14 styles them; E03 provides functional DOM). Gamepad (post-v1).

## Deliverables
`src/input/{InputSystem,devices/*,InputFrame,Bindings,Recorder}.ts` and `src/data/bindings.ts`.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Inputs/Inputs.js`](../folio-2025/sources/Game/Inputs/Inputs.js): action map + modes
- [`Inputs/Keyboard.js`](../folio-2025/sources/Game/Inputs/Keyboard.js): keyboard
- [`Inputs/Pointer.js`](../folio-2025/sources/Game/Inputs/Pointer.js): mouse (+ middle button)
- [`Inputs/Wheel.js`](../folio-2025/sources/Game/Inputs/Wheel.js): wheel normalization
- [`Inputs/Nipple.js`](../folio-2025/sources/Game/Inputs/Nipple.js): touch joystick (port)
- [`Inputs/InteractiveButtons.js`](../folio-2025/sources/Game/Inputs/InteractiveButtons.js): touch buttons
- [`RayCursor.js`](../folio-2025/sources/Game/RayCursor.js): cursor raycast

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E03-AC01 | Mouse-only: with the cursor 3 m to the player's +X ground side, `move` points to +X with magnitude 0.643 (±0.05) (linear between 1.2 m and 4 m); inside the 1.2 m ring `move` = 0 and `aim` points to the cursor | e2e (Playwright mouse) |
| E03-AC02 | LMB and RMB map to `left` and `right` (`down`, `held`, `up` edges); the context menu never opens on the canvas | e2e |
| E03-AC03 | Wheel up and down produce one `selector` edge per notch, with a 120 ms debounce for trackpads | e2e |
| E03-AC04 | WASD is camera-relative: with the default camera (azimuth π/4), `W` moves the player toward screen-up (the projected motion angle is within 5° of the screen's up vector) | e2e |
| E03-AC05 | Keyboard-only: arrow keys rotate the aim at 360°/s, and a tap shorter than 150 ms snaps to the 8-way direction; `J`/`K` and `Space`/`Shift` fire left and right | e2e |
| E03-AC06 | Touch (mobile emulation): dragging the left half creates a floating stick; a 60 px drag gives magnitude 1; releasing gives 0 within one tick | e2e (touch) |
| E03-AC07 | Touch: press–drag–release on the RIGHT action button sets the aim to the drag direction and fires on release; a tap fires with `aimSource='assist'` | e2e (touch) |
| E03-AC08 | Scheme switching: the last used device sets `getState().input.scheme` (`mouse-only`, `mouse-keyboard`, `keyboard`, `touch`); the HUD hint follows | e2e |
| E03-AC09 | Rebinding persists in `localStorage` across reloads; conflicting binds are rejected with a message | e2e |
| E03-AC10 | A recorded input session replays into an identical sim state hash (`Recorder` round trip) | sim |
| E03-AC11 | Input latency: a key press is reflected in the `InputFrame` of the next sim tick (≤ 1 tick) | unit |
| E03-AC12 | Middle-click (wheel click, button 1) produces an `interact` edge; the browser's autoscroll never activates (`preventDefault` on `mousedown` and `auxclick`); `E` produces the same edge; on mice without a middle button, stand-to-interact still works (no dependency) | e2e |
| E03-AC13 | Focus loss: with W, LMB, and the touch stick held, a window `blur` or tab hide emits `up` for every held input and the next `InputFrame` has zero move and no pressed actions; on return nothing is held until pressed again | e2e |

## Verification recipe
`npm run verify -- E03`. The e2e tests use real Playwright mouse, keyboard, and touch events (not `__SS__.input.set`) so the device adapters are exercised.

## Notes / risks
On a weak mouse, holding RMB for long periods is tiring; holding a key mirrors it. Trackpad wheel deltas vary, which the debounce and threshold handle.
