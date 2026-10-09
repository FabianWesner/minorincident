# E28 weather vision review

**AC12: FAIL.** Automated scene loading is green, but it does not constitute vision approval.
Reference inspected: `initial-drafts/weather-and-time-of-day-moods.png` (S25). I opened all nine final game-camera catalog sheets (frames 0, 60, 120), plus full-size fog-player, snow-tracks, wet-reflections and scripted-strike blackout frames.

## Checklist G

| Priority | Item | Result and observed evidence |
|---|---|---|
| must | Source glow and visible spill | PASS — warm windows and the street lamp glow and cast orange pools in fog, snow and storm. |
| must | Geometry and shadow occlusion | FAIL — character/prop shadows are visible, but these isolated street captures do not establish that light pools stop at walls; a wall-facing lighting capture is required. |
| must | Colored, appropriate shadows | PASS — blue/purple shadows remain colored, long in golden haze and softer under overcast; no black shadows were observed. |
| must | Night player/threat readability | PASS — courier and infected remain visible in fog, snow and storm; measured isolated fog contrast is 3.175:1. |
| should | Beams, lit haze and glints | FAIL — practical haze adds atmosphere, but the golden-hour reference's volumetric shafts are absent and the fog readability fill makes the courier pale. |
| should | Appropriate reflections | PASS — wet ground shows lit streaks and dry ground does not; the stripes are conspicuously regular and need art refinement. |
| should | Script mood | PASS — warm haze, cold snow/fog, dark rainy storm, clear and dimmer overcast are distinguishable in the corrected sheets. |

Three of four must items and two of three should items pass; the required every-must and >=70% should gate fails.

## Weather mood observations

| Capture | Result / what I saw |
|---|---|
| weather-clear/sheet.jpg | PASS readable crisp colored shadows and saturated car/courier; brighter than corrected overcast. |
| weather-overcast/sheet.jpg | PASS lower sun intensity and softer shadows, although the change is restrained. |
| weather-haze/sheet.jpg | PARTIAL warm amber ground and long purple shadows read late afternoon; reference sun shafts are missing. |
| weather-thunderstorm/sheet.jpg | PASS thin blue rain, dark blue street and orange practical pools; separate strike frame shows the flash. |
| weather-fog/sheet.jpg | PASS blue height haze and warm lights with a visible courier; hero fill is aesthetically too pale. |
| weather-snow/sheet.jpg | PASS cold night/warm window contrast, white roof/car tops and flakes; dark footprint stamps are coarse. |
| weather-ash/sheet.jpg | PASS muted violet dusk, lower-density gray flakes and surface accumulation. |
| weather-rain/sheet.jpg | PASS thin readable rain; puddle/reflection pattern remains stylized. |
| weather-wind/sheet.jpg | PASS restrained pale streaks and wind-directed smoke; vegetation bend needs a separate populated capture. |

Catalog gates: 9/9 passed, zero console errors; 47–52 draw calls and 201,568–281,568 triangles. These isolated scenes do not replace the missing L5 pair-plaza perf fixture.

## Required follow-up

1. Capture and review light-pool wall occlusion with the integrated E25 lighting scene.
2. Add/review atmospheric golden-hour shafts without washing out courier visibility.
3. Refine regular wet reflection stripes, pale fog fill and footprint stamps during the lighting/art pass.
