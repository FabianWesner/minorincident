# Fixed weapon number keys

PO 2026-10-21; branch `lane/weapon-keys`, base `93e1fbea8`.

`src/data/weaponKeys.ts` defines the fixed campaign shortcuts: **1** unarmed (fists/kick), **2** baseball bat, **3** fire axe, **4** handgun (also legacy pistol), **5** army MG, **6** shotgun, **7** rocket launcher, **8** molotov, **9** pipe bomb. Other actions have no number. Selection searches carried weapons across both racks, including retained pickups beyond three slots. An unavailable key does nothing, including preserving pending attacks. Existing swap timers, Shift+1/2/3 RIGHT slots, RMB/Q cycling and wheel zoom retain their paths. Fixed keys are inert while driving/manning a gun. All nine digits are reserved against rebinding, including saved maps. Telemetry records/replays the new choice and still reads older MIR1 logs.

The HUD adds a compact carried-weapon strip at bottom left. Each icon has its fixed number; the active weapon has a gold border. The strip hides in the touch scheme. Input hints and pause/help controls describe 1–9. The older positional wording in E03-AC05 is superseded by the supplied PO decision; no specs were edited.

## Captures and visual review

L2, 1600×900, headless Chromium with ANGLE Metal, all nine campaign shortcuts carried. Existing icon assets are reused. Numbers use opaque dark badges with light 12 px text and remain the same screen size at both render quality tiers and all camera ratios. Reviewed each capture: all nine numbers are legible, the axe highlight is distinct, badges fit within their icons, and the strip clears the health, minimap, story subtitle and interaction prompts. Low quality changes world geometry/shadows; HUD text stays sharp. No touch badges are shown (asserted through real touch events).

| Camera ratio | High | Low |
| --- | --- | --- |
| 0.5 | [Capture](hud-high-zoom-0.5.png) | [Capture](hud-low-zoom-0.5.png) |
| 1 | [Capture](hud-high-zoom-1.png) | [Capture](hud-low-zoom-1.png) |
| 1.5 | [Capture](hud-high-zoom-1.5.png) | [Capture](hud-low-zoom-1.5.png) |

Exact captured camera values are recorded in [captures.json](captures.json).

## Validation

- `npm run typecheck`, `npm run lint`, production build: passed.
- Focused remote mapping/buffer/replay tests: 15 passed (7 new weapon-key tests plus 8 codec tests).
- Focused real-input browser spec: 2 passed (L2 selection/HUD/touch and mounted-gun/vehicle locks); the updated legacy selection fixture passed too.
- E03 simulation/smoke selection: **39 passed, 0 failed**. The browser phase was resumed after a session interruption with `--workers=1` and manual WebGPU cases excluded.
- Full remote unit/level suite: **2,152 passed, 9 skipped** across 391 passing files (3 skipped), exit 0.
- E03 browser/smoke selection: **140 passed, 5 failed**. All five failures are the same existing landscape HUD coverage assertion (27.2615% versus a 27% limit), across the five Chromium device projects. An isolated build of base `93e1fbea8` reproduces the **identical** 0.2726152425609449 coverage and failure. New rack/badge nodes are hidden and absent from the measured boxes. This pre-existing limit keeps the broad E03 gate red; no criterion was weakened. See [validation.json](validation.json).

Browser commands use `E2E_PORT=3981 SCENE_PORT=3982 sh tools/e2e-lock.sh`, headless ANGLE Metal, one worker. Remote checks use `tools/remote/run.sh`; the full suite caps Vitest at four workers. No deployment, push or merge.
