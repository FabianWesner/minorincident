# Controls v2

Product owner decision: replace continuous cursor steering with classic ARPG controls from `specs/00-game-concept.md` §5.3. Work stayed in the assigned `controls-v2` worktree; main was not merged again. Assets and manifests were not changed.

## Specification corrections

- E03-AC01 now requires an explicit movement command; moving the pointer alone only aims.
- E03-AC05 documents WASD, J/K with facing aim assist, and Q. Existing optional arrow aiming and Space/Shift alternatives remain compatible.
- E03-AC07 documents tap/drag attacks and upward weapon swipes. AC08 gives the new user-facing descriptions while keeping the existing scheme IDs (`mouse-only`, `mouse-keyboard`, `keyboard`, `touch`) compatible with the test API and scheme-dependent consumers.
- E03-AC12 adds F alongside E and middle-click, including immediate car entry and exit.
- New E03-AC14–18 cover click/hold movement and its ground marker, target approach/attacks, stationary ground RMB, switching the last-used side, and the three mobile buttons with proximity-enabled ACTION and layout constraints.
- E09 controls and AC08 now require held LMB to drive and release to brake; middle-click/F/E/ACTION exits. Updated the old zero-HP-car RIGHT-exit test to ACTION.
- S-02 now checks actual L1 click movement and stationary ground RMB after the menu flow. E03 traceability counts increased by five.
- Corrected E14's touch scope line (three gameplay buttons and separate pause) to avoid contradicting the product decision; retained its stricter 56 px target criterion.

## Implementation

The device adapters emit explicit `moveTarget`, `attackTarget`, cancellation, and side-selection commands through `InputFrame`. `ControlIntent` resolves them against live sim positions and the selected weapon's range, using the existing survivor collision controller. Click commands survive button release; target attacks approach, stop in range, attack once, and repeat while held. Manual movement, another attack, focus loss, death, scenario reload, and checkpoint restore cancel pending commands. A target command completes only when combat actually starts its action, so a weapon swap cannot consume it prematurely. Recorded commands are validated and included in deterministic state hashing. The sim preserves raw device frames for input inspection and recordings, and consumes a separate resolved frame for movement/combat.

Ground LMB selects movement rather than a LEFT attack. The mouse adapter uses independent mousedown/mouseup edges so RMB can cancel walking while LMB remains held; pointer movement and cancellation retain their existing device filtering ([pointer-event button behavior](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event)). A real-input regression for playtest-1’s P1 verifies LMB down → RMB down → LMB up → RMB up: both buttons release independently and remain idle. Pointer events retain subpixel coordinates so the button-edge change does not round click destinations.

RMB ground cancels a destination and uses RIGHT in place; its clicked point is latched even if the pointer moves before the next tick. The marker renders visibly above road surfaces. Keyboard-only and touch taps aim at the nearest visible infected in front; pointer/drag aiming remains explicit. F/E/MMB use the existing interaction edge. Mouse driving requires held LMB without also activating boost/horn; keyboard/touch retain LEFT horn/boost. Touch release brakes, and ACTION exits. The existing Bruno-derived floating radial stick remains the movement adapter.

E09 verification exposed a pre-existing crowd shader overflow on WebGL2 (19 vertex attribute slots versus 16 available). Packed clip frame, detached leg, gore mask, and flash into one vec4 attribute, preserving the values and reducing the count to 16. No asset files changed. The old vehicle visual fixture now supplies held LMB explicitly.

Mobile shows LEFT, RIGHT, ACTION; quick upward swipes (<250 ms, ≥40 px) cycle their own side without firing. Holding longer preserves upward drag aiming. ACTION enables near an interactable or while driving. Pause is a separate control. HUD, tutorial, and Settings text describe the new controls.

## Validation

All requested gates passed with browser runs serialized through `tools/e2e-lock.sh`, `E2E_PORT=3336`, headless Chromium using `--use-angle=metal --enable-gpu`, at most two Playwright workers and four Vitest workers.

| Gate | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed |
| `npm run test:unit` | 101 passed (42 files) |
| `npm run test:smoke` | 3 sim/unit + 21 browser passed |
| `npm run verify -- E03` | 12 sim/unit + 119 browser passed |
| `npm run verify -- E04` | 14 sim/unit + 25 browser passed |
| `npm run verify -- E05` | 27 sim/unit + 23 browser passed |
| `npm run verify -- E09` | 22 sim/unit + 29 browser passed |
| `npm run verify -- E14` | 5 sim/unit + 79 browser passed |
| Mixed crowd rendering regression (200 infected and mixed archetypes) | 1 browser passed |
| E02 palette material audit | 1 browser passed |

Real device tests cover destination/hold/retarget/arrival, stationary RMB and latched aim, LEFT/RIGHT approach and attacks (including a moving infected), held repeats and target death, wheel/Q side selection, MMB/F car entry/exit, WASD/J/K aim assist, touch stick/buttons/swipes/proximity, focus loss, and recording/replay. The exact reported P1 mouse chord sequence passes; both buttons remain idle after release. Pointer events retain subpixel click positions while mouse events track independent button edges. No visual goldens were changed.

All 30 mobile layout checks passed: maximum portrait coverage 22.62%, landscape 19.75%, minimum button target 56 px, no overlaps. Proof JSONs and logs remain locally under ignored `test-results/controls-v2/validation/`.

## L1 play and visual review

Played the actual title → character → L1 briefing → mission path with real mouse and touch events in headless Chromium (ANGLE Metal and GPU enabled). The final desktop run stopped 0.075 m from its clicked destination; idle cursor and ground RMB caused no horizontal travel. Touch moved 1.909 m in 30 ticks, and LEFT/RIGHT taps after stopping caused no horizontal travel. Inspected desktop and portrait screenshots. The first review caught a marker hidden under the road; its rendering was fixed. The touch labels and separate pause were readable and spaced correctly.

The portrait scene's existing distant camera and heavy fog make the survivor very small; this was surfaced to the coordinating session and left outside input scope. Reviewed all four refreshed L1 PNGs (desktop marker/arrival and touch stick/actions), recorded the final measurements, then deleted those screenshots as requested.
