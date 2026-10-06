# E03 · Input and Control Schemes

## Goal
Turn every device into one pure `InputFrame` per sim tick, `{ move: Vec2, aim: Vec2|null, aimSource, mouseAttack?, attackInPlace?, selectorActive?, moveTarget?, attackTarget?, left: Button, right: Button, selector: Edge, interact: Edge, pause: Edge }`, so the sim stays device-agnostic. Ship all control schemes from `00-game-concept.md` §5.3: **mouse-only, mouse+keyboard, keyboard-only, mobile touch**. Gamepad is **not in v1**.

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
| E03-AC02 | LMB produces `left` edges for the active mouse attack; RMB produces one carried-action `selector` pulse per press and no `right` attack edges; the context menu never opens on canvas | e2e (real input) |
| E03-AC03 | Wheel up/down zoom smoothly within 0.85–1.35× default camera distance and produce no `selector` edge; two-finger pinch zooms on touch | e2e |
| E03-AC04 | WASD is camera-relative: with the default camera (azimuth π/4), `W` moves the player toward screen-up (the projected motion angle is within 5° of the screen's up vector) | e2e |
| E03-AC05 | Keyboard: camera-relative WASD; J/K attack LEFT/RIGHT with facing aim assist; Q cycles the last-used side in keyboard-only mode (carried actions with mouse), 1/2/3 select carried actions with a mouse (LEFT rack slots in keyboard-only mode), Shift+1/2/3 select RIGHT; HUD clicks and touch swipes retain their side selection; optional arrows and Space remain | e2e (real input) |
| E03-AC06 | Touch (mobile emulation): dragging the left half creates a floating stick; a 60 px drag gives magnitude 1; releasing gives 0 within one tick | e2e (touch) |
| E03-AC07 | Touch: LEFT and RIGHT taps attack with `aimSource='assist'`; press–drag–release aims and fires on release; a quick upward swipe (<250 ms, ≥40 px vertical >1.5× horizontal) cycles that button's side without attacking; a longer upward press–drag still aims | e2e (touch) |
| E03-AC08 | Last device selects mouse-only, mouse-keyboard, keyboard or touch; mouse hints describe ground click/hold movement, LMB attack, Shift+LMB in place and RMB cycle; keyboard/touch hints retain their respective controls | e2e (real input) |
| E03-AC09 | Rebinding persists in `localStorage` across reloads; conflicting binds are rejected with a message | e2e |
| E03-AC10 | A recorded input session replays into an identical sim state hash (`Recorder` round trip) | sim |
| E03-AC11 | Input latency: a key press is reflected in the `InputFrame` of the next sim tick (≤ 1 tick) | unit |
| E03-AC12 | Middle-click, `F`, and `E` each produce the same `interact` edge; mouse `mousedown` and `auxclick` prevent autoscroll. Near a car door they enter immediately; while driving they exit; stand-to-interact remains available | e2e |
| E03-AC13 | Focus loss: with W, LMB, and the touch stick held, a window `blur` or tab hide emits `up` for every held input and the next `InputFrame` has zero move and no pressed actions; on return nothing is held until pressed again | e2e |
| E03-AC14 | Clicking ground shows a ground marker and walks to within 0.15 m then stops; a new click retargets; holding LMB on ground continuously updates the destination; releasing preserves the final destination; WASD or an attack cancels it | e2e (real mouse) |
| E03-AC15 | LMB on a visible infected approaches into active weapon range then attacks; held LMB keeps attacking that same target even when cursor moves away; dead/hidden targets cancel; target-free attacks never move the survivor | e2e (real input) |
| E03-AC16 | Shift+LMB attacks in place toward the cursor, cancels pending movement/target commands, suppresses WASD for that swing and always plays even without a target; RMB only cycles carried actions (unarmed → found weapons) | e2e (real input) |
| E03-AC17 | RMB and mouse-mode Q cycle unique carried actions across racks, with fists/kicks one unarmed entry; ground LMB does not change active action; mouse-mode 1/2/3 directly select the same unarmed-first carried list; keyboard-only numbers and HUD clicks explicitly select rack slots; touch upward swipes still cycle their side | e2e (real input) |
| E03-AC18 | Mobile HUD has exactly three gameplay buttons labelled LEFT, RIGHT, ACTION; ACTION is enabled only near an eligible interactable or while driving (exit). Pause stays separate; portrait HUD coverage ≤25%, no controls overlap, and touch targets ≥44 px (E14 retains ≥56 px) | e2e (touch/layout) |
| E03-AC19 | Shift melee swing through a living adult causes a short stagger backward, “Hey!” bark and brief annoyed state; health stays unchanged, no kill or infection. Children and pets pass through untouched; item drop is optional | e2e (real mouse + Shift) |
| E03-AC20 | Unarmed chains jab, cross, front kick, roundhouse kick, uppercut, knee and occasional spinning backfist; no consecutive repeated move including after a pause; equal damage for each, slight kick knockback; reproducible Blender clips have anticipation, 50–100 ms strike and follow-through with hips/chest/limb sequencing | unit + e2e + visual frame review |
| E03-AC21 | Mouse HUD displays active action and next carried action; L1 hints describe LMB attack, Shift+LMB in place and RMB switching; touch retains LEFT/RIGHT/ACTION | e2e |

## Verification recipe
`npm run verify -- E03`. The e2e tests use real Playwright mouse, keyboard, and touch events (not `__SS__.input.set`) so the device adapters are exercised.

## Notes / risks
RMB is a cycle pulse, never an attack. The two racks remain for keyboard/touch compatibility; mouse uses the active carried action. M1-05 orchestrator decision: wheel/pinch control camera zoom; number keys, Q, HUD clicks and upward action-button swipes select weapons. Trackpad deltas retain a threshold and debounce.
