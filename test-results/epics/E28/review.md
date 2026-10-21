# E28 weather vision review

**Current AC12: MET (2026-10-22).** Final-source Checklist G below supersedes the historical failure; AC10 remains partial, as recorded in `report.md`.

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

## Final-source Checklist G review — 2026-10-22

This review supersedes the earlier AC12 failure above. I opened the fresh **24 six-mood frames** (WebGL2/WebGPU × high/low), the full-size storm and facade frames, and the settled hero-shadow frame. Retained matrix: `docs/reports/ac-close-shared/g-moods.jpg`. References opened: `initial-drafts/weather-and-time-of-day-moods.png` and `initial-drafts/explosions-fire-smoke-and-lighting-fx.png`; `06` §7 permits these interim references while dedicated lighting keyframes are absent.

| Priority | G item | Observed result |
| --- | --- | --- |
| must | Emissive glow and visible pools/spill | PASS — yellow windows, headlamps and streetlamp bloom; orange pools brighten nearby pavement and facade. |
| must | Geometry / hero shadows | PASS — wall-facing window spill remains on the outside pavement; settled lamp casts separate courier, infected and prop shadows. The unchanged hero probe measures 85.88% darkening after promotion blend reaches 1. |
| must | Colored, appropriate shadows | PASS — blue/purple shadows, long and crisp in haze, broader and subdued under overcast; hero shadow hue 254.7°, no black cutout. |
| must | Night readability | PASS — courier cap, orange clothing and limbs remain distinct; gray/green infected silhouette and limbs separate from the dark blue street in storm, fog and snow. Dense-fog player contrast is 3.0349:1 over the unchanged 7,585-pixel mask. |
| should | Beams / haze / glints | PASS — amber shafts cross the haze scene and window spill lights the storm haze; fog softens the distance without hiding the courier. The lightning frame is bright but characters and house remain legible. |
| should | Reflections | PASS — storm pavement carries irregular, broken warm highlights under windows and lamp, with dark gaps; car paint/glass retain specular separation. Dry clear/overcast pavement has no wet streaks. |
| should | Script mood | PASS — clear is cool and crisp; overcast softer/dimmer; haze amber with long purple shadows; storm dark blue with rain/warm practicals; fog blue with softened distance; snow cold night with flakes and gray coated upper surfaces. |

**AC12 met: 4/4 must and 3/3 should.** All six moods are checked against the authorized reference, across both tiers/backends. These fixed scene reviews do not substitute for native storm/L5 performance evidence. Final E28 verifier passes all 28 selected Node, 71 functional browser and six quiet performance tests. The original heap-counter discrepancy remains partial under AC10.
