# Integration vision review — E28 AC12 PASS


Opened all eleven newly generated contact sheets at `test-results/integrate-e26-e28/catalog/`, plus full-size fog-player, golden-haze and wall-facing captures. Scene Lab: **11/11 pass**, zero console errors. The isolated fixtures deliberately expose lighting and actors without campaign dressing.

| Capture | Observation |
| --- | --- |
| Clear | Bright neutral ground, crisp purple shadows, saturated red car and visible courier/infected. |
| Overcast | Lower light and muted ground; softer shadows distinguish it from clear. |
| Golden haze | Warm amber ground, long purple shadows and three soft diagonal sun shafts. The shafts cross the street without hiding actor silhouettes. |
| Thunderstorm | Dark blue street, dense cool rain, warm window/lamp pools and wet highlights; the courier and threat remain identifiable. Separate lightning/blackout checks pass. |
| Fog | Blue ground haze and warm practical light; courier teal cap, tan clothing and gray shoes retain color. Measured player/ring contrast **3.077:1**, 7,585 player pixels. |
| Snow | Cold blue surroundings, dense light flakes, pale upward-facing surface accumulation and visible tracks; warm windows and the lamp separate it from the dark ground. Roof/car mask coverage and track-growth assertions pass. |
| Ash | Violet dusk, sparser gray flakes, subdued car/ground colors and warm practicals distinguish ash from snow. |
| Rain | Fine streaks over dim neutral ground and wet surface highlights; actors remain unobscured. |
| Wind | Sparse pale streaks, clear daytime actors; the separately captured smoke column bends along the weather wind. |
| Barricade W0 | Coverage and brace-progress bars are distinct; 95% coverage, completed plank overlay, damage and released bench are visible in sequence. |
| Barricade W5 | The same controls and plank states remain readable against purple darkness, with long colored shadows. |

Full-size evidence is in `test-results/integrate-e26-e28/visual/`. The wall-facing capture shows warm window spill outside the visible facade and a dark, colored building shadow beyond its left corner; the final E25 hero-shadow capture shows a purple shadow, measured 74.6% darker than adjacent lit ground (hue 277°), with one shadow map. The night street courier retains clothing colors at 3.140:1 ring contrast, and all three threats remain in frame with bright red/pink eyes. Wet highlights remain stylized, and snow tracks are intentionally coarse at this game-camera scale.


### E28 AC12 / vision checklist G

Integration review supersedes the lane's failed lighting review. Compared against `initial-drafts/weather-and-time-of-day-moods.png`; `assets/_keyframes/lighting/` does not exist in either this worktree or current main, so no inspection of those missing keyframes is claimed.

| Priority | Item | Result and observed evidence |
| --- | --- | --- |
| Must | Source glow and visible spill | PASS: windows and street lamp glow, with warm outward pools in fog, snow and sustained storm. |
| Must | Geometry and shadow occlusion | PASS: the added wall-facing capture shows exterior window spill bounded by the facade and a dark colored building shadow; the E25 hero shadow interrupts a practical pool, with its unchanged numeric check passing. |
| Must | Colored, appropriate shadows | PASS: purple daytime shadows lengthen in haze, soften under overcast, and remain colored at night (hero-shadow hue 277°). |
| Must | Night player/threat readability | PASS: courier and infected silhouettes read in storm/fog/snow; fog contrast is 3.077:1 and campaign night contrast 3.140:1, with all three sampled heads inside the viewport. |
| Should | Beams, lit haze and glints | PASS: three soft warm haze shafts cross the street; practical pools light fog while the courier retains clothing colors. |
| Should | Appropriate reflections | PASS: wet ground has broken lit streaks and dry ground lacks them; reflections are intentionally stylized rather than mirror images. |
| Should | Script mood | PASS: amber haze, blue fog/snow, dark rainy storm, neutral clear and muted overcast are distinct in the game-camera captures. |

Every Must (4/4) and every Should (3/3) passes. Snow footprints remain coarse, and the overcast change is restrained; neither obscures actors or the intended weather state. L5/L6 campaign fixtures remain explicitly deferred to E23/E24, while L1–L4 performance and the existing E26/E28 Scene Lab fixtures are covered here.
