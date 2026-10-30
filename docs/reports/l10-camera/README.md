# l10-camera (Opus, 2026-10-30)

PO decision 10-30: "Wider L10 camera". Base: main `ecac09f80`.

## Change
- `src/levels/L10/cameraFraming.ts`: L10 road framing = follow radius × **1.3**, FOV unchanged (25°), polar unchanged (0.30π).
  Weight 1 on the R1–R5 road, easing to 0 over the R5 → R6 approach (x 2860 → 2925). The corridor (R6), the complex (R7: console,
  Mega arrival), the finale (`cure-installed` or epilogue) and close interactions keep the normal framing. Close interactions are the three weapon
  checkpoints and the lab terminal/canister: normal within 5 m, wide again from 16 m (smoothstep).
- `src/render/View.ts`: `framing` provider + `regionScale`, eased per tick (`1 - exp(-2 s)`, about 1.5 s) and applied instantly on
  re-poses and teleports (`seconds === 0`, the >20 m snap). The camera therefore still has the right framing on frame 0. Player zoom multiplies on top, so
  0.5 / 1 / 1.5 scale from the new base. Wheel zoom is not locked, and the change is not a story shot (guidance stays visible). The sim camera gets the same radius,
  so in-browser off-screen spawns respect the wider frame. Headless sims are unchanged.
- QA builds accept `?l10cam=<scale>,<fovDeg>`; `tools/qa/l10-look.ts` passes it via `L10CAM=…`.

## Options tried (WebGPU high, `options-z1.jpg`)
| option | result |
| --- | --- |
| A radius × 1.3 | chosen: the verges, field strips, sandbags/flares and pole lines enter the frame; the courier stays at about 85 px at zoom 1 (111 px before) |
| B FOV 31° | about the same coverage as A, with a stronger perspective stretch at the frame edges; fog/haze follow the radius, not the FOV |
| C radius × 1.45 | most context, but at zoom 1.5 the effective radius is 2.18 × base, beyond the tested rocket-view maximum (2.0); the courier gets small |
A higher pitch (smaller polar) was not tried: with the 45° azimuth it shortens the ground depth on screen, so it would show less across the road, not more.

## Evidence
- `ba-z1.jpg`, `ba-z1.5.jpg`: ten stations R1–R7 before | after, WebGPU high and low. `ba-webgl-z1.jpg`: five stations, WebGL2 high.
  r6-supply and r7-console are identical before/after, as intended. r5-terminal is only slightly wider (7 m from the terminal).
- Draws/triangles max over all stations and zooms: high 113/169k → 119/193k, low 98/94k → 101/99k, WebGL2 106/169k → 112/193k (budget 300/500k). 0 console errors.
- AC16 night read at the new framing (follow rig, zoom 1.3 = new zoom 1): navContrast R1 3.0, R2 3.0, R3 3.25, R4 3.26, R5 3.0
  (gate 2.5; floor passes); playerContrast 4.4–7.5 (gate 3). R6 is unchanged.
- Finale calibration `tools/qa/l10-arrival-check.ts`: high 143.15 s, low 143.22 s, released, 0 deaths (identical to main).

## Honest look score
Before ~5/10, after ~5.5–6/10. At zoom 1 the frame now spans about ±7.8 m across the road instead of ±6 m. The verge dressing, field edges,
evac flares and parked trucks now sit inside the frame, but the 6 m road is still the largest surface. The camps and burning cars 11 m or more out
appear at zoom 1.5 (now 1.95 × the old base). Getting to "stunning" still needs a denser or lit belt within 10 m of the road, not more camera.
