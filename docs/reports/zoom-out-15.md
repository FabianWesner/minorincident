# Zoom 1.5 campaign audit — 2026-10-13

## Scope and reproduction

All L1–L8, both fixed quality tiers, actual WebGL2 and WebGPU, three campaign positions each: 96 PNG captures and 32 contact sheets. I opened all 32 sheets (start / fight / finale columns) and reopened L4 and L7–L8 after retakes. The game runs with the normal HUD, no developer wireframes, seed 2, 1600×900 CSS, DPR 1. Scripted objective completion advances real mission controllers; encounters use normal AI. God mode prevents audit interruption. L4 starts at the first playable convoy arrival; its fight is the mature 120-second plaza war. L7 walks into an existing Alpha encounter; L8 approaches existing infected animals from outside their bodies. L3's surge approach supplements the separately tested locked finale camera.

```sh
npm run build
SCENE_PORT=3471 PERF_CONDITIONS_LOG=/tmp/zoom-out-15-perf-conditions.jsonl sh tools/perf/quiet-run.sh npx tsx tools/qa/zoom-out.ts --timing
SCENE_PORT=3468 E2E_UNITS=2 npm run scene:matrix -- --jobs 2 --out test-results/zoom-out-15/matrix-final
```

The timing probe resumes simulation and measures eight seconds per position, discarding the first two. It requires at least 240 simulation ticks and 100 presented frames. It checks frame p95, maximum submitted draws and triangles against the existing E18 tier limits. Automatic quality is disabled. Pixel coverage also rejects a missing scenery image even when submission counters report draws. The PNGs, per-position mission/camera state, timing samples, matrix metrics and GPU trace are retained in `test-results/zoom-out-15/`.

## Source findings and fixes

- L4 low's mature war submitted 618,501 triangles on both backends, above the existing 500,000 limit. Settled civilian corpses now use the shipped LOD2 silhouette, retaining every body and identity. Native retakes peak at 429,487 triangles, 259 draws, 7.1 ms p95. High retains LOD1 corpses.
- At zoom 1.5, the scene matrix revealed a newly visible infected actor sliding its first planted foot 14 cm (limit 8 cm). Keep the existing capped footwork solver active inside the 12 m action range, and apply its first ground solve immediately. The focused high WebGPU scene now passes at 3.8 cm, with zero sink and no missing visible frames.
- WebGPU L7 finale and L8 fight rendered only HUD / health bars over a blank background. Three's fullscreen output uses a single-sample canvas; the subsequent health bar pass resolved a separate stale MSAA attachment over it. The overlay now explicitly uses zero MSAA samples while the world retains its original settings. A regression checks the sample count and restoration after success and failure. Earlier GPU buffer destruction errors were also observed; the later labeled trace reproduced blank scenery without validation errors, identifying the overlay path independently.
- Existing culling uses the actual camera frustum; the director already receives `View.simCamera` before simulation ticks. Max-zoom ground corners fit inside low's 45 m cull radius and light field even in portrait. Tests preserve this fact and verify that a spawn newly revealed at 1.5 remains queued until it is outside the frustum. No distance increase was warranted by these samples. Existing shadow fitting and fog coverage remain adequate; no fog walls or zoom-cap reduction were introduced.
- The held-click browser fixture clicked the ground at a teleported enemy's sim origin. The new planted-foot solve can put its displayed feet beside that point, so the input became a ground-move command (confirmed by `attackTarget` absent and `moveTarget` at x=8). Rendering alone did not fix that incorrect test click; allowing foot catch-up did. The final fixture refreshes the displayed body and clicks the torso, explicitly asserting the selected enemy before killing it. The original target-death stop threshold remains unchanged.
- The old mouse unit assertion assumed the first eased zoom step must already hit the former radius 19 cap. It now checks easing toward `19 * zoomLimits[1]`, retaining clamp, follow and minimum checks.

## Visual review

The following observations apply to both tiers and both backends unless a failure is explicitly named. Low reduces geometric detail; the scene composition and HUD remain consistent.

| Level | Start / fight / finale observations |
| --- | --- |
| L1 | Café corner and adjacent street remain continuous. Garage chase street includes fences, vehicles and pedestrians. Fire-station cutaway exposes the courier and goal ring; minimap/objective distance remains readable. |
| L2 | Fire crew and truck at the bay, market encounter, and police bridge barricades remain complete at the edges. Police lighting, buildings and destination markers remain legible. |
| L3 | Armory approach, active yard gunfight and exit bridge have continuous ground and backdrop. Army/corpse silhouettes remain visible at both tiers. Dotted white tracers remain visible in battle; the separate tracers work lane owns that known defect. |
| L4 | Bus arrival, full plaza war with corpses and advancing infected, and hardware cellar approach are complete. Low's corpse simplification preserves the visible carpet while fixing its triangle budget. Dotted white tracers are the same separately owned defect. |
| L5 | Basement cutaway intentionally shows the room surrounded by dark earth; ruined plaza/crater and metro approach have complete debris and streets. Ash lighting and destination arrow remain readable. |
| L6 | Shelter lamp pools, maintenance breach/flashlight, and exit platform stairs retain complete corridor geometry. Wall cutaways preserve the courier; practical light boundaries are coherent. |
| L7 | Bus/ash crowd and the walked Alpha encounter remain visible. WebGL evacuation finale includes the bus, smoke, bodies and crowd. Initial WebGPU finale failed with blank scenery; repaired high and low retakes show the complete evacuation scene. |
| L8 | Arrival bus/crowd, live infected animal encounter, and APC goal remain complete on WebGL. Charge telegraphs and special health bars are readable. Initial WebGPU animal fight failed with blank scenery; repaired high and low retakes show the courier, animals, charge arrows and light pool. |

Still images cannot prove the absence of every temporal edge pop. Moving scene probes, real resumed timing windows, frustum regression and the finale/mouse browser tests complement them. Native timing is at DPR 1 on this Mac; it does not establish identical performance at every device resolution.

## Validation

- Typecheck, lint, production build: passed after the overlay fix.
- Full unit suite on Hetzner: 1,315 passed, seven skipped after all source fixes; the overlay regression also passes locally in one worker.
- Mouse input + L3 finale browser regressions: 16/16 passed after the fixture correction, including desktop and phone finale cameras. Earlier final runs were 15/16 until the ground-click fixture was corrected.
- Smoke: six Vitest smoke tests passed on Hetzner; final headless Mac browser smoke after all renderer fixes passed 27/27 including Chromium, WebKit and mobile. The combined remote command had SwiftShader timeouts/unsupported WebGPU, so this is a split-environment validation, not a claim that that remote command exited green.
- E18 verify: typecheck, lint, build and 304 functional tests passed; eight shared-runner timing assertions failed. The same timing files rerun while holding both remote slots passed 15/15. The original full verify command did not exit green.
- Initial scene matrix: 144/146 passed, with only the two zoom-1.5 foot-slide failures. Final full matrix: 146/146 passed in 246 seconds, two headless browsers. Its admission waited approximately 26 minutes for two shared browser slots.
- Numeric native frame/draw/triangle budgets pass across all 96 retained rows after critical-scene retakes. Corrected WebGPU captures were opened and checked. High worst p95 is 11.7 ms, draws 294, triangles 1,184,444; low worst p95 is 7.8 ms, draws 259, triangles 471,144. These extrema can occur at different positions. L1–L6 measurements preceded the final overlay/footwork change; L4 was remeasured after its corpse fix and L7–L8 after every source fix. The full matrix exercises the remaining footwork scenes.

Final gates completed at 20:07 CEST. Shared browser admission waits pushed completion beyond the requested 2.5-hour window. No deployment or merge was performed. Captures and timing use DPR 1; the separately owned L3/L4 tracer defect remains a visual finding for integration.

## Captures and measurements

Each link opens the three reviewed campaign positions. Metrics are maxima across their resumed production timing windows; PNGs can also come from a subsequent paused capture retake of the same authored spots.

| Level | Tier | Backend | Reviewed captures | Frame p95 ms | Draws | Triangles |
| --- | --- | --- | --- | ---: | ---: | ---: |

| L1 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L1-high-webgl2-sheet.jpg) | 9.3 | 215 | 802,548 |
| L1 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L1-high-webgpu-sheet.jpg) | 6.4 | 215 | 802,548 |
| L1 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L1-low-webgl2-sheet.jpg) | 5.3 | 185 | 381,027 |
| L1 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L1-low-webgpu-sheet.jpg) | 4.5 | 185 | 381,027 |
| L2 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L2-high-webgl2-sheet.jpg) | 11.1 | 294 | 895,601 |
| L2 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L2-high-webgpu-sheet.jpg) | 7.8 | 294 | 895,601 |
| L2 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L2-low-webgl2-sheet.jpg) | 7.8 | 256 | 471,144 |
| L2 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L2-low-webgpu-sheet.jpg) | 6.1 | 256 | 471,144 |
| L3 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L3-high-webgl2-sheet.jpg) | 8.8 | 189 | 654,777 |
| L3 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L3-high-webgpu-sheet.jpg) | 6.0 | 189 | 654,777 |
| L3 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L3-low-webgl2-sheet.jpg) | 6.1 | 163 | 343,750 |
| L3 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L3-low-webgpu-sheet.jpg) | 5.1 | 163 | 343,750 |
| L4 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L4-high-webgl2-sheet.jpg) | 9.6 | 288 | 1,184,444 |
| L4 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L4-high-webgpu-sheet.jpg) | 9.4 | 288 | 1,184,444 |
| L4 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L4-low-webgl2-sheet.jpg) | 7.1 | 259 | 429,487 |
| L4 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L4-low-webgpu-sheet.jpg) | 6.6 | 259 | 429,487 |
| L5 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L5-high-webgl2-sheet.jpg) | 6.1 | 227 | 552,205 |
| L5 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L5-high-webgpu-sheet.jpg) | 5.0 | 227 | 552,205 |
| L5 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L5-low-webgl2-sheet.jpg) | 5.2 | 206 | 309,642 |
| L5 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L5-low-webgpu-sheet.jpg) | 5.4 | 206 | 309,642 |
| L6 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L6-high-webgl2-sheet.jpg) | 5.2 | 196 | 285,206 |
| L6 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L6-high-webgpu-sheet.jpg) | 4.0 | 196 | 285,206 |
| L6 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L6-low-webgl2-sheet.jpg) | 4.9 | 175 | 203,654 |
| L6 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L6-low-webgpu-sheet.jpg) | 3.5 | 175 | 203,654 |
| L7 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L7-high-webgl2-sheet.jpg) | 11.7 | 198 | 956,997 |
| L7 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L7-high-webgpu-sheet.jpg) | 11.2 | 198 | 961,789 |
| L7 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L7-low-webgl2-sheet.jpg) | 6.8 | 123 | 185,000 |
| L7 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L7-low-webgpu-sheet.jpg) | 5.9 | 123 | 185,000 |
| L8 | high | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L8-high-webgl2-sheet.jpg) | 7.5 | 208 | 334,993 |
| L8 | high | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L8-high-webgpu-sheet.jpg) | 6.2 | 208 | 334,993 |
| L8 | low | webgl2 | [start / fight / finale](../../test-results/zoom-out-15/L8-low-webgl2-sheet.jpg) | 6.2 | 190 | 117,795 |
| L8 | low | webgpu | [start / fight / finale](../../test-results/zoom-out-15/L8-low-webgpu-sheet.jpg) | 4.7 | 190 | 117,795 |
