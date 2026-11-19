# L10 rifle torch — work in progress

[Capture sheet](capture-sheet.jpg): HIGH and LOW at zoom 1 and 1.5, plus HIGH firing. Headless WebGL2 Scene Lab, L10 night preset, 960×640; asphalt fixture with the scenario set to L10. The firing frame uses the Scene Lab attack command and shows a tracer. The four walking frames use the walk command toward +X.

Review: the beam is visible on the ground. The lamp appears as a small white point on the gun in the enlarged HIGH 1.5 frame, but its housing is not readily distinguishable at the full frame size. These captures do not establish readability at both zooms and tiers; the firing frame also needs close inspection. Beam origin, gating, other poses and WebGPU remain to be verified. This fixture is not an authored L10 district scene.

Validation after merging main: typecheck and lint passed; remote `npm test` passed (105 passed, 1 skipped, 239.2 s). Scene gate remains outstanding.

Update: the housing and lens were enlarged, the original scenario gate restored, and the head-origin fallback removed when the held model is unavailable. The sheet was refreshed for that change. HIGH and LOW at zoom 1.5 show the ground pool; the lamp is still too small in the full frame to judge its housing confidently. Ten selected courier/L10 scene gate rows passed, including WebGL2 and WebGPU rows; this is not the complete set of player-visible gate rows. Typecheck and lint passed after the change.
