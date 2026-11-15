# s121 · Courier readability in dense hordes

## Current verdict: incomplete

The implementation reduces ordinary infected bar clutter and strengthens the courier's existing warm gold foreground contour. Isolated crowd probes demonstrate courier body visibility, but production dense-contact readability and temporal artifact clearance are not yet established. **Performance pending:** the orchestrator must measure L4 LOW against the 11 ms p95 budget.

## Implementation

- `HealthBars`: suppress ordinary infected bars crossing the courier silhouette instead of relocating them into a shared row above her head. Special enemies and followers retain relocation. Also retain the six closest healthy ordinary attackers inside six metres. Player-damaged infected and mandatory shield/Alpha/Mega/engaged-boss bars retain their existing eligibility. Followers retain their existing bar/pip policy.
- `PaletteMaterial`: raise the existing non-vehicle foreground gold edge gain from .25 to .55. The distant vehicle x-ray gain remains .14. The foreground uniform gates the contour; no new render pass is added.
- Simulation behavior, stats, crowd density, and corpse persistence are unchanged.

The courier already uses a foreground depth slice in close crowds. Its palette output has a separate contour calculation; changing the standard emissiveNode gain had no visible courier effect and that trial was reverted. `contact.jpg` contains four labeled before/after rows: L4 HIGH z1, LOW z1, HIGH z1.5, and L6 HIGH z1, all at 30 HP. Baseline uses the prior .25 palette contour, candidate uses .55; the bar cap is present in both. These are isolated stationary fixtures, **not production alarm/retreat acceptance**. At sheet scale the contour improvement is subtle. Baseline/candidate raw files are under contour-before-webgl2 and contour-after-webgl2; the candidate source was restored after baseline capture.

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

## Reproducible 30-HP motion sampling

Runner now accepts --motion (infected chase the stationary courier) and --high-only for bounded batches. HIGH WebGL2 L4/L6 zoom-1/1.5 passed all 12 samples at frames 1/30/60, confirmed 30 HP, minimum body share 0.99961. Clipping reports are saved separately and are not treated as passing artifact gates. Reviewed L4 frame 60 shows attacking poses and a visible gold courier edge, but retained enemy bars overlap above her; the body-share pass does not settle the clutter/readability criterion. Existing Scene Lab courier fixtures default to god mode, retaining health during this presentation-only probe. Typecheck/lint pass.

## Courier bar protection follow-up

The moving L4 probe exposed a row of overlapping ordinary bars above the courier. Ordinary bars that cross her bounds now disappear instead of moving into that row; mandatory special-enemy bars and followers still move above her. The existing L4 test now asserts suppression and mandatory Alpha preservation. Focused test/typecheck/lint pass. Reviewed HIGH WebGL2 zoom-1.5 frame 60 under bar-protection shows one retained bar rather than a broad overlapping row; console/body-visibility gates pass. This source edit postdates the last full remote suite and requires that suite and visual matrix rerun. Existing contact sheet predates bar protection.

## Bar-protection motion matrix

After ordinary-bar suppression, the committed runner completed all 48 samples: both backends, HIGH/LOW, L4/L6, zoom 1/1.5, frames 1/30/60. Every sample retained 30 HP and passed the >=90% body-share/zero-console gates. Detailed clipping reports show zero courier-versus-prop records, zero gun/body hits, and zero held-prop hits in all 16 cases. The previously reported actor warnings concern infected-versus-scenery intersections; they do not establish a courier defect. These short isolated probes still do not prove artifact-free production play or transition stability. Raw files: repro-{webgl2,webgpu}-motion. Full remote suite after bar suppression and production acceptance remain open; perf pending.

## Close west-breach contact

A later move toward (-40,8) reaches (-34.9,8) at frame 3600, with real production attackers beside the courier. HIGH WebGL2 run reports zero console errors. Reviewed production-surround/shot-3600.png shows a gold-outlined but substantially darker courier among overlapping bodies at the barrier. This is a visual concern requiring active x-ray/hull-mode inspection, not artifact clearance. The frame still does not establish 40+ infected surrounding her. Native L4 LOW p95 measurement was requested from the orchestrator via scheduler note; perf remains pending.

## Close-contact mode diagnosis

Replayed the production breach pose at (-34.900,8.000), frame 3600, and read the actual Vite courierDepth module uniforms: foreground=1, courierXray=0. Normal and forced-xray-off screenshots are pixel identical. Thus the vehicle-hull dark-silhouette policy does not cause the dark courier in this frame. Next investigate the palette lighting/shadow contribution. Raw state and paired images: test-results/s121-courierread/mode-probe. No runtime code change was made for this diagnostic.

## Rejected foreground light-floor trial

A temporary .28 surface-color floor inside the existing foreground contour branch changed courier pixels but did not visibly resolve the dark close-contact appearance in the matched frame-3600 production replay. Typecheck/lint passed during the trial. The trial was reverted; no runtime change remains. Next compare the same pose with crowd geometry/shadows hidden to isolate the cause before adding another material adjustment. The latest mode-probe images contain this rejected trial; the earlier production-surround capture remains the accepted-source reference.

## Same-pose crowd visibility probe

Production frame 3600 records bloodCoverage=0, foreground=1, xray=0. Hiding crowd geometry leaves the courier dark. This does not isolate cached shadow contribution, so it neither proves nor rules out crowd shadows. The manual foreground-off capture is not causal evidence because a redraw can restore policy uniforms. Raw state/images and diagnostic script: test-results/s121-courierread/crowd-light-probe. No runtime changes remain. Next isolate received-shadow/shadow-intensity contribution using a supported persistent presentation override.

## Location shadow control

A short isolated courier-only capture at (-34.9,8) shows the same location inside a building shadow; her clothing is shaded even without the production encounter. A five-infected control at that pose with supported look.set shadowIntensity=0 restores lit clothing. This establishes a lighting contribution, not an additional geometry defect or full production clearance. Raw images/specs under breach-light-control and shadow-control. No runtime adjustment retained.

## Moving-courier retreat probe

The runner --escape option sends the courier 12 m east and samples frames 1/30/60/180. HIGH WebGL2 L4/L6 at both zooms passed 16 low-HP/visibility samples, but foreground remained active in all of them. Reviewed L4 frame 180 shows pursuing attackers close behind: the ordinary AI detects and follows her even though fixture actors start idle. Thus this is retreat footage, not a successful crowd-exit or popping check. The runner needs an explicit clear-space criterion before an exit verdict can be asserted. Typecheck/lint pass.
