# E15 vision review

Refreshed and reviewed after the E06 merge and telegraph birth-frame fix with the image tool at 1600×900, DPR 1, Chromium SwiftShader WebGL2, seed 1. Photo spots use [15,18,15] → [0,0,0]. Comparison sheets `compare/L4.png` (Sunset Grove reference) and `compare/L6.png` (weather/time reference) were also opened with the image tool; the review assesses combat readability in the isolated probe, not the district art density. `showcase-L4.png` and `showcase-L6.png` are captured after sim tick 1 and 0.12 seconds of the independent render clock. Infected and held weapons use code placeholders while their assets are below integrated status.

The epic's old §7.4 reference did not exist. This review follows specs/90-test-concept.md §7.1, Checklist D, exactly. Every must passes; both should items pass in each lighting tier.

| Check | Result | Visual evidence and reason |
| --- | --- | --- |
| L4-D1 [must] Player identifiable within 1 second | PASS | `showcase-L4.png`: central red torso, teal pack and red shoes separate the survivor from the warm ground. |
| L4-D2 [must] Infected separate; glowing eyes visible | PASS | `showcase-L4.png`: blue infected silhouette to the lower right has two bright red eye dots. |
| L4-D3 [must] Telegraphs visible and distinguishable by shape | PASS | Cyan rectangular charge lane is clear; `telegraph-lunge.png`, `telegraph-charge.png`, `telegraph-splash.png`, `telegraph-bloated.png` show a chevron, lane outline, ring and cross respectively. |
| L4-D4 [should] Pickups/interactables distinguishable from clutter | PASS | Small cyan pickup sparkles and yellow objective sparkles flank the play area; their colors and concentrated particles differ from ash and smoke. |
| L4-D5 [should] VFX do not hide player or tells beyond brief moments | PASS | Smoke/fire and toxic clouds are localized outside the survivor; the charge lane remains unobscured. |
| L6-D1 [must] Player identifiable within 1 second | PASS | `showcase-L6.png`: the red/teal identity and central silhouette remain visible against the purple-blue night ground. |
| L6-D2 [must] Infected separate; glowing eyes visible | PASS | Blue body and saturated eye dots separate the infected from the night surface. |
| L6-D3 [must] Telegraphs visible and distinguishable by shape | PASS | Cyan lane and pink screamer ring retain strong contrast at night; the four telegraph shape captures demonstrate color-independent recognition. |
| L6-D4 [should] Pickups/interactables distinguishable from clutter | PASS | Cyan and yellow sparkle clusters remain visible without requiring a large flash. |
| L6-D5 [should] VFX do not hide player or tells beyond brief moments | PASS | Fire/smoke and toxic clouds sit away from the readable central survivor and lane. |

Additional visual criteria:

- E15-AC03 PASS: `blood-Full.png` has a bright stylized red ground splat; `blood-Off.png` contains no red inside the projected decal footprint. `blood-pixels.json` records the exact hue/saturation/value detector and mask.
- E15-AC04 PASS: all four telegraph captures use different geometry, independent of color; they appear on event dispatch and remain until resolution. Shape-ID speckle was fixed by rounding the interpolated discrete ID. A later review caught holes at nonzero paused birth times: removing an unnecessary negative-age comparison fixed interpolated birth-time rounding. Birth versus settled-frame comparisons now pass for all four types; refreshed charge and cross images are solid.
- E15-AC05 PASS: shockwave rings grow with explosion radius; `ring-2.png`, `ring-4.png`, `ring-6.png` and `shockwave.json` record measured screen radii. E27 owns full seven-beat blast choreography.
- E15-AC08 PASS: the full frame flash is visibly muted in `flash-true-0.png` versus `flash-false-0.png`; `flash-reduction.json` measures every consecutive frame delta.

This is a focused VFX/readability review; empty probe ground is intentionally isolated from district art. Detailed volumetric fire, smoke and blast anatomy belong to E27.
