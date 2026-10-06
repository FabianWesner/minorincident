# E03 · Input and Control Schemes

## Goal
Turn every device into one pure `InputFrame` per sim tick, `{ move: Vec2, aim: Vec2|null, aimSource, moveTarget?, attackTarget?, left: Button, right: Button, selector: Edge, interact: Edge, pause: Edge }`, so the sim stays device-agnostic. Ship all control schemes from `00-game-concept.md` §5.3: **mouse-only, mouse+keyboard, keyboard-only, mobile touch**. Gamepad is **not in v1**.

## Depends on / Enables
E01 / E04, E05, E09, E14.

## Scope
**In:** device adapters (pointer incl. middle button, wheel, keyboard, touch), the cursor → ground-plane raycast, explicit click-to-move and target attack commands, camera-relative WASD, keyboard facing aim assist (optional arrow aiming remains available), the touch floating stick and the drag-to-aim action buttons, scheme auto-detection and switching (the last device used wins), rebinding with persistence, preventing the context menu on RMB and browser autoscroll on middle-click, input recording and playback (for tests and bug repro), and **releasing all held inputs on window blur / tab hidden** (Bruno `Keyboard.js`), so no key stays stuck when the player comes back.
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
| E03-AC01 | Mouse-only: moving the cursor anywhere aims toward it and produces zero `move`; movement requires an explicit ground click or held ground LMB | e2e (Playwright mouse) |
| E03-AC02 | LMB and RMB map to `left` and `right` (`down`, `held`, `up` edges); the context menu never opens on the canvas | e2e |
| E03-AC03 | Wheel up and down produce one `selector` edge per notch, with a 120 ms debounce for trackpads | e2e |
| E03-AC04 | WASD is camera-relative: with the default camera (azimuth π/4), `W` moves the player toward screen-up (the projected motion angle is within 5° of the screen's up vector) | e2e |
| E03-AC05 | Keyboard: WASD moves camera-relative; `J` / `K` attack LEFT / RIGHT with the nearest visible infected in the facing half-plane as aim assist; `Q` cycles the last-used side; optional arrow aiming and Space/Shift mirrors remain available | e2e |
| E03-AC06 | Touch (mobile emulation): dragging the left half creates a floating stick; a 60 px drag gives magnitude 1; releasing gives 0 within one tick | e2e (touch) |
| E03-AC07 | Touch: LEFT and RIGHT taps attack with `aimSource='assist'`; press–drag–release aims and fires on release; a quick upward swipe (<250 ms, ≥40 px vertical >1.5× horizontal) cycles that button's side without attacking; a longer upward press–drag still aims | e2e (touch) |
| E03-AC08 | Scheme switching: last device selects mouse (`mouse-only`), keyboard with cursor (`mouse-keyboard`), keyboard (`keyboard`), or mobile (`touch`); hints describe click-to-move, J/K aim assist, or LEFT/RIGHT/ACTION respectively | e2e |
| E03-AC09 | Rebinding persists in `localStorage` across reloads; conflicting binds are rejected with a message | e2e |
| E03-AC10 | A recorded input session replays into an identical sim state hash (`Recorder` round trip) | sim |
| E03-AC11 | Input latency: a key press is reflected in the `InputFrame` of the next sim tick (≤ 1 tick) | unit |
| E03-AC12 | Middle-click, `F`, and `E` each produce the same `interact` edge; mouse `mousedown` and `auxclick` prevent autoscroll. Near a car door they enter immediately; while driving they exit; stand-to-interact remains available | e2e |
| E03-AC13 | Focus loss: with W, LMB, and the touch stick held, a window `blur` or tab hide emits `up` for every held input and the next `InputFrame` has zero move and no pressed actions; on return nothing is held until pressed again | e2e |
| E03-AC14 | Clicking ground shows a ground marker and walks to within 0.15 m then stops; a new click retargets; holding LMB on ground continuously updates the destination; releasing preserves the final destination; WASD or an attack cancels it | e2e (real mouse) |
| E03-AC15 | LMB/RMB on a visible infected issues a LEFT/RIGHT attack: approach when outside that action's range, stop in range, then attack; held LMB repeats; dead/hidden targets cancel the command; an attack without a target never causes movement except an explicitly configured melee lunge | e2e (real mouse) |
| E03-AC16 | RMB on ground attacks toward that point with RIGHT and cancels any pending destination; with a distant cursor and no movement input the survivor stays stationary | e2e (real mouse) |
| E03-AC17 | Wheel cycles only the last-used attack side, including after an RMB target/ground click; ground LMB does not select LEFT; Q mirrors this; upward LEFT/RIGHT swipes explicitly select and cycle that side | e2e |
| E03-AC18 | Mobile HUD has exactly three gameplay buttons labelled LEFT, RIGHT, ACTION; ACTION is enabled only near an eligible interactable or while driving (exit). Pause stays separate; portrait HUD coverage ≤25%, no controls overlap, and touch targets ≥44 px (E14 retains ≥56 px) | e2e (touch/layout) |

## Verification recipe
`npm run verify -- E03`. The e2e tests use real Playwright mouse, keyboard, and touch events (not `__SS__.input.set`) so the device adapters are exercised.

## Notes / risks
On a weak mouse, holding RMB for long periods is tiring; holding a key mirrors it. Trackpad wheel deltas vary, which the debounce and threshold handle.
