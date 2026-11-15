# s121 · Courier readability in dense hordes

## Current verdict: incomplete

The implementation reduces ordinary infected bar clutter and strengthens the courier's existing warm gold foreground contour. Isolated crowd probes demonstrate courier body visibility, but production dense-contact readability and temporal artifact clearance are not yet established. **Performance pending:** the orchestrator must measure L4 LOW against the 11 ms p95 budget.

## Implementation

- `HealthBars`: retain the six closest healthy ordinary attackers inside six metres. Player-damaged infected and mandatory shield/Alpha/Mega/engaged-boss bars retain their existing eligibility. Followers retain their existing bar/pip policy.
- `PaletteMaterial`: raise the existing non-vehicle foreground gold edge gain from .25 to .55. The distant vehicle x-ray gain remains .14. The foreground uniform gates the contour; no new render pass is added.
- Simulation behavior, stats, crowd density, and corpse persistence are unchanged.

The courier already uses a foreground depth slice in close crowds. Its palette output has a separate contour calculation; changing the standard emissiveNode gain had no visible courier effect and that trial was reverted. `contact.jpg` is one small cropped L4 HIGH WebGL2 zoom-1 before/after pair for the palette contour. It is an isolated fixture, **not the required complete production contact sheet**.

## Checks and evidence

Typecheck, lint and the focused existing L4 render contract pass. The unchanged full remote unit command passed after the contour and tooling changes on 46.225.66.90: 106 passed, 1 skipped, 28 executed files; passive manifest 150/150 cases and 45/45 files; 229.4 seconds within the 240-second budget, exit 0.

Committed reproduction:

```sh
SCENE_PORT=4980 E2E_PORT=4979 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-readability.ts webgl2
# repeat with webgpu
```

The two committed `courier-read-{l4,l6}-dense.json` fixtures place 48 ordinary infected around the courier on D-FAIR/D-SUBWAY. The runner prepares 30 HP with the existing QA damage API, checks actual health/backend/quality and zero console errors, then measures body visibility against the courier's unobstructed ID mask. This measures occlusion, not visual recognition speed. WebGL2 HIGH/LOW zoom-1/1.5 passed all eight cases, minimum share 0.99961. WebGPU passed the same eight 30-HP cases, minimum share 0.999029, with explicit courier-follow camera targeting. Reviewed WebGPU L4 HIGH zoom-1 frame shows 30/100 HP and a warm courier edge. Earlier full-health stationary probes passed both backends/tiers; moving zoom-1.5 probes passed LOW WebGL2 and HIGH WebGPU at frame 60. Their actor-intersection metrics remain unresolved, so no artifact-free claim is made.

HIGH WebGL2 production L1-start and open-street controls kept foreground mode off and reported no console errors. The native title-menu capture passed its console/draw/triangle gates and looked intact. These are single-pose controls, not transition or pixel-equivalence tests.

Production fixture runs use the real L4 convoy/quartermaster/alarm and L6 shelter/stop/retreat controllers. L4 fixture setup overrides actor placement; post-setup moveTo commands successfully reach the plaza and west breach. Reviewed 30/60/90-second HIGH WebGL2 west-hold captures show a readable courier and HUD but do not surround her with 40+ infected. Large overlapping Alpha bodies near the barrier require baseline comparison. These captures cannot close dense-horde acceptance. The early L6 retreat fixture similarly leaves the courier far ahead of the group and does not provide dense contact.

## Evidence locations

Raw images, fixtures, clipping pairs and metrics remain under `test-results/s121-courierread/`; `report.json` records selected measurements and exact paths. Important subdirectories: `repro-webgl2`, `repro-webgpu`, `final-*`, `motion-low`, `controls`, `menu-control`, `production`, `production-contact`, `west-contact`, `west-hold`. The first browser/commit attempts failed under a sandbox; access was later restored. A later apparent capture stall was pool admission behind another job's active exclusive lease, not a renderer hang.

## Remaining acceptance

- Production L4 alarm hold and L6 retreat with dense contact, HIGH/LOW and zoom 1/1.5; low-HP recognition review.
- Complete revised-contour motion/backend matrix and baseline attribution of visible intersections/Alpha appearance; no courier artifacts.
- Open-street transition/popping check and remaining backend/tier controls.
- One complete small before/after contact sheet covering required production views.
- L4 LOW performance measurement: **perf pending**; no measured frame-time claim.

No deployment, push, or main movement was performed.
