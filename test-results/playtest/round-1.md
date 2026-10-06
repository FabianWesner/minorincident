# Playtest round 1 — 2026-10-06

Base: `62e7fe6`, isolated `playtest-1` worktree. Headless Chromium/WebGL2, ANGLE Metal with GPU enabled, shared e2e lock, port 3334, at most two workers. No merges from main. No input mapping, HUD layout CSS, asset registry/manifest, reference assets or specifications changed.

## Scope correction

The orchestrator explicitly removed the kick fix from this lane. The reported motion originates in the old cursor-steering scheme: a pointer outside the 1.2 m ring continuously produces movement, including when attacking; mouse activity also changes released WASD back to that scheme. The combat kick does not apply locomotion or a lunge. `controls-v2` owns the product owner's click-to-move replacement. The initial input patch and kick tests were removed completely.

## Protocol and evidence

`tests/e2e/playtest-round1.spec.ts` is an opt-in reproducible exploration. Every session starts at the actual title screen, selects the female survivor, chooses L1 Stop the Outbreak and accepts the briefing. Desktop uses mouse and keyboard; mobile uses real touch/CDP multitouch events. Physical input drives all movement, attacks, NEXT and menus; no logical input injection or player teleport is used. The test API pauses between fixed-step batches and reads state. It supplies catalog weapons, a nearby door/pickup and supplemental horde-arena infected because the early campaign does not supply those encounters. No god mode or infinite charges is enabled. Audio is muted, so audio mix and sound quality are not evaluated.

Initial exploration:

| Viewport | Simulated seconds | Evidence |
| --- | ---: | --- |
| Desktop 1600×900 | 303.00 | `baseline/desktop.json` |
| Touch portrait 412×915 | 300.02 | `baseline/portrait.json` |
| Touch landscape 915×412 | 303.02 | `baseline/landscape.json` |
| Total | 906.03 (15.10 minutes) | Real input, fixed-step accounting |

Both touch sessions reached Joe's Diner and the hardware store and completed breakfast, escape and melee objectives through walking/standing. Desktop reached breakfast but did not complete the hardware route. All viewports used fists/pistol/grenade on LEFT and kick/shotgun/molotov on RIGHT, cycled racks, fought in the live-AI arena, took damage, and paused/resumed. Touch pickups collected the supplied bat into RIGHT and the supplied door opened by standing nearby. Desktop also opened the supplied door with E. Landscape arena evidence records 31 damage events, two deaths and two automatic respawns; portrait records 13 damage events, one death and one respawn. UI health and objective text updated, and pause held the sim tick constant.

Initial exploration finished all three sessions but its console guard failed on the existing crowd shader error described below. This is a product failure, not a passing playtest. Start, diner, hardware, combat and final screenshots were inspected visually before deletion.

Extended exploration with both fixes:

| Viewport | L1 seconds | Total seconds (including arena) | Evidence |
| --- | ---: | ---: | --- |
| Desktop 1600×900 | 300.33 | 403.33 | `desktop.json` |
| Touch portrait 412×915 | 300.52 | 400.02 | `portrait.json` |
| Touch landscape 915×412 | 300.02 | 403.02 | `landscape.json` |
| Total | 900.87 (15.01 minutes) | 1206.37 (20.11 minutes) | |

Together the two runs cover 35.21 simulated minutes. Final arena records contain 19/16/14 player damage events, 2/1/1 deaths and matching respawns for desktop/portrait/landscape, and four infected kills in each viewport. L1 itself records 2/1/1 deaths through the recovery lifecycle, with mission restoration using the existing checkpoint rules. The desktop route again reached breakfast; both touch routes again completed breakfast, escape and melee. State evidence confirms actual `combat.attack` events for LEFT fists/bat/pistol/grenade and RIGHT kick/shotgun/molotov in every viewport. The final exploration finishes all duration and pause assertions but fails all three console guards solely on the same infected shader error; no error suppression was added. This uses accelerated simulation, so it does not certify real-time performance or the visual timing/audio mix of effects.

## Fixed

1. **P0: leaving the finite floor causes an endless fall.** Desktop L1 reached y = −151.69 m with full health and no recovery; portrait also fell below −86 m. `Player` now treats y < −5 m as a death through the existing damage/death/checkpoint lifecycle, preserving equipment, inventory and mission/checkpoint handling. `tests/e2e/survivor-recovery.spec.ts` holds the real D key beyond the interaction-yard floor, releases it and verifies death, respawn, grounded height, full health, checkpoint position, retained key and retained bat. The corrected regression fails against an explicit original-Player build: y = −11.04 m, full HP, not grounded, zero deaths/respawns. With the fix: y = 0.703 m, grounded, full HP, one death and one respawn; inventory and equipment checks pass (`fall-baseline.json`, `fall-fixed.json`). The recovery screenshot was inspected.
2. **P2: portrait fog obscures the local play area.** Portrait aspect adaptation moves the camera back to retain the specified 12 m circle, but the fixed 65–170 m L1 fog range fogs the survivor and nearby objects heavily. `Lighting.update` offsets both shader and scene fog ranges by the camera's additional distance beyond the normal 35 m radius. The atmospheric span stays unchanged and landscape returns to its original range. `tests/e2e/portrait-fog.spec.ts` starts real L1, resizes to 412×915, taps RIGHT, checks that near fog remains beyond the nearby action, then rotates to landscape and checks the original range.

## Open / handoffs

| Severity | Bug | Reproduction and cause | Owner / boundary |
| --- | --- | --- | --- |
| P1 | Infected bodies are invisible in WebGL2 | Load horde-arena and spawn a runner; fight using either attack side. Shadows, telegraphs and damage occur, but the body is absent. Shader compile reports attribute locations 16–18 out of range. CrowdView duplicates matrix attributes and exceeds the WebGL vertex-attribute budget. Occurred on all three viewports. | Flagged to art-integration; no overlapping crowd or asset edits. |
| P1 | L1 outbreak encounter is absent | Start female L1, walk to Joe's Diner; breakfast completes and escape activates, but no outbreak combat appears. All L1 snapshots lack `ai`. `loadComposition` loads the non-AI survivor scene and `loadLevel` attaches only Combat; campaign-spawned infected take the dummy path. | Campaign encounter integration / E19. Supplementary live-AI combat is explicitly separate. |
| P1 | “Pick up a melee weapon” awards no weapon | In touch L1, walk from Joe's Diner to the hardware display and stand still. Breakfast, escape and melee complete, but LEFT remains fists and RIGHT remains kick. The mission grants the `melee` token only, with no weapon pickup/equipment handoff. | Campaign reward integration / E19. |
| P1 | Mouse button chord leaves LEFT stuck | LMB down → RMB down → release LMB → release RMB. RIGHT never becomes held and LEFT remains held after both releases. Pause/resume clears it. Confirmed in desktop `both-buttons-held/released` samples. Pointer button-edge ownership misses intermediate buttons in a chord. | Reported to controls-v2; input mapping untouched as instructed. |

## Test harness correction

The first E03 verification passed 63 browser tests but timed out in two timing tests: both froze the browser clock before awaiting game startup. Move clock installation/pause after `boot` in `input-keyboard.spec.ts` and `input-mouse.spec.ts`, preserving all assertions and mappings. This matches the independent controls-v2 setup correction.

## Validation

All requested gates pass on the final code:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run test:unit` | 101 tests in 42 files pass |
| Real-input fall and portrait regressions | 2 pass |
| `npm run test:smoke` | 3 Node + 20 browser tests pass |
| `npm run verify -- E03` | All five checks pass; 10 unit + 65 browser tests pass |
| `npm run verify -- E04` | All five checks pass; 14 unit + 25 browser tests pass |
| `npm run verify -- E05` | All five checks pass; 27 unit + 22 browser tests pass |

Validation logs/check JSON are retained locally under `validation/`. The fixed fall and portrait regression screenshots, plus final desktop/portrait/landscape level and combat captures, were opened and reviewed. Generated screenshots, videos and traces were removed after review; preexisting tracked test artifacts were restored. Raw state/event JSON remains local evidence. No visual goldens are changed.

Implementation and regression commit: `109d7bc` (`Fix off-map survivor recovery and portrait fog`).
