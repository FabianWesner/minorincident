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

Pending final gate results.
