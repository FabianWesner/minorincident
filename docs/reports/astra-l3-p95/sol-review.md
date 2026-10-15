# Final game-camera review, 2026-10-15

The committed pose renderer (`cf2ae8b20`; build `9057be96`) passes all 18 Scene Lab rows on WebGL2 and all 18 on WebGPU. The three catalog scenes run at high/low quality and zoom 1.5/1/0.5. Actual backend, actual tier, zero console errors and zero undrawn frames are recorded in each backend's `checks.json`; these are headless Mac captures, not interactive WebGPU or real-device acceptance.

Inspected the full pose sheets at high zoom 1 and low zoom 0.5 on both backends, plus the two inspection overviews containing every required high/low × zoom 1/0.5 combination for all three scenes and both backends. The courier, two police and two infected retain complete silhouettes and expected clothing/skin colours. Both downed figures remain on the street from frame 60 through frame 1080 and rise in the final samples; there is no disappearing or collapsed atlas geometry. Close zoom crops the distant officers consistently between tiers and backends.

All eight comparable WebGL2 weather/camera sheets are byte-identical to `baseline-sheets`. Wrecks, fence lines, cutaway transitions, long warm shadows and the ash/footprint scene retain the baseline composition. WebGL2 versus WebGPU mean absolute RGB error is at most 1.573/255 across these JPEG sheets; visual inspection shows matching figures, poses, ground dressing and fog. Per-sheet comparisons are in `sol-visual-comparison.json`.

The inherited final-frame foreground wall still obscures the courier in the Boulevard camera scene. It is byte-identical to the original baseline, remains an existing camera limitation, and is not claimed fixed. These visual checks establish no frame-time budget; phone timing requires the separate unprofiled quiet-run measurement.

- [WebGL2 matrix](sol-webgl2/index.md)
- [WebGPU matrix](sol-webgpu/index.md)
- [Pose inspection overview](sol-inspection-poses.jpg)
- [Camera/weather inspection overview](sol-inspection-camera-weather.jpg)
