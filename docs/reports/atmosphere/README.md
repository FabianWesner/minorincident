# Campaign atmosphere

Render-only level profiles improve sky/ground temperature separation, sunset haze, and bloom/vignette balance. Sparse daylight birds, dust and paper reuse AmbientLife; the zoo gets up to 24 tiny insects at six powered lamps on high. Low omits insects and caps daylight fields at 30 triangles each. No new post pass, light, shadow, texture asset or dependency. Campaign weather, simulation, camera controls and gameplay are unchanged.

**WIP; deployment gates are incomplete.** [Research and baseline audit](research.md). Initial profiles are revision `e3b6138e7`; the final foreground tint revision is `68e108f24`. The images below show the **initial profiles**, not the final L5/L9/L10 tints. [Machine-readable evidence status](evidence-status.json).

## Capture coverage and visual review

Real seed-1 campaign starts use the game follow rig with the opening cinematic bypassed and simulation paused. Both tiers were inspected. Each per-level sheet has rows **zoom 0.5 / 1 / 1.5**, columns **high before / high after / low before / low after**.

| Evidence | WebGL2 / Metal | WebGPU |
| --- | --- | --- |
| Baseline `fcf81b4da4` | 60 valid stills: every level, tier and zoom | 60 valid stills: every level, tier and zoom |
| Initial profile `e3b6138e7` | 20 valid stills: every level and tier, **zoom 1 only** | 60 valid stills: every level, tier and zoom |
| Final foreground tint `68e108f24` | Not captured | Not captured |

All ten WebGPU sheets and the two WebGL2 zoom-1 composites ([L1–L5](sheets/webgl2/zoom1-L1-L5.jpg), [L6–L10](sheets/webgl2/zoom1-L6-L10.jpg)) were opened and reviewed. Missing GL after cells are labeled **NOT CAPTURED**. The first capture script changed zoom state without reposing the paused rig; invalid variants were removed, and valid replacement metadata records camera radii 9.5 / 19 / 28.5. A batch overlapping a build was discarded. No missing or invalid capture counts as completed QA.

| Level | Observed initial before → after, high and low; remaining issue | WebGL2 / WebGPU sheet |
| --- | --- | --- |
| L1 | Café shadow softens from strong violet. Warm paving and red/teal courier remain clear; corgi remains distinct. Hard-edged green ground behind the courier remains visible in both. | [GL](sheets/webgl2/L1.jpg) / [GPU](sheets/webgpu/L1.jpg) |
| L2 | Cooler midday ambient, slightly less window bloom. Characters remain clear. Low retains coarse shrub silhouettes also visible before. Sparse dust/birds add motion. | [GL](sheets/webgl2/L2.jpg) / [GPU](sheets/webgpu/L2.jpg) |
| L3 | Warm shafts and long shadows remain. Haze difference is restrained; courier/corgi identity colors stay clear, supported by both passing L3 pixel tests. Paper-colored drift reuses the ambient draw path. | [GL](sheets/webgl2/L3.jpg) / [GPU](sheets/webgpu/L3.jpg) |
| L4 | Shadows are visibly less purple; bus keeps a solid silhouette. At zoom 0.5 the scripted entry bus is cropped in both captures; on-foot coverage comes from fixtures/smoke, not this entry frame. | [GL](sheets/webgl2/L4.jpg) / [GPU](sheets/webgpu/L4.jpg) |
| L5 | Initial haze change is subtle; the scene still reads very red and murky. Cooler rose-violet foreground shadow was authored after this review but remains **uncaptured**. | [GL](sheets/webgl2/L5.jpg) / [GPU](sheets/webgpu/L5.jpg) |
| L6 | Warm hero lamp and dark gray tunnel remain; halo is slightly restrained. Companion remains dark outside the pool as before; this entry cannot establish continuous companion visibility. | [GL](sheets/webgl2/L6.jpg) / [GPU](sheets/webgpu/L6.jpg) |
| L7 | Dark blue ash night remains with restrained glow. Entry cohort overlap and stark moonlit/backlit survivor parts remain visible. L6 exit/L7 intentionally share a preset. | [GL](sheets/webgl2/L7.jpg) / [GPU](sheets/webgpu/L7.jpg) |
| L8 | Teal-blue surroundings separate warm lamp pools from L7's ash night. Red/teal courier and white/teal corgi are visible. Insects are too small to resolve in these sheets; their high-tier geometry/shader path compiles and is bounded. | [GL](sheets/webgl2/L8.jpg) / [GPU](sheets/webgpu/L8.jpg) |
| L9 | Initial top-down image is almost unchanged; pale road rectangle persists, vehicle/corgi remain visible. Slate shadow and steel road sheen revision remains **uncaptured**. | [GL](sheets/webgl2/L9.jpg) / [GPU](sheets/webgpu/L9.jpg) |
| L10 | Initial image is almost unchanged; courier/route stay bright and pale ground rectangle persists. Violet shadow and road sheen revision remains **uncaptured**. | [GL](sheets/webgl2/L10.jpg) / [GPU](sheets/webgpu/L10.jpg) |

## Cost and alternatives

[counters.json](counters.json) records 60 paired initial-profile **WebGPU** counters: every level/tier/zoom. Maximum sampled high: 242 draws / 709,376 triangles; low: 222 / 311,116. All sampled draw/triangle counts meet E18 caps. These are structural counters, **not a native frame-time certification**. Palette, haze and post weights change existing uniforms. L2/L4 add at most three tiny ambient draws (64/44 triangles high, 46/42 low); L3 adds one draw/12 triangles; L1 retains its existing fields. Zoo insects add at most one draw/24 triangles high, zero low. Every other level adds no geometry. The final L9/L10 road tint replaces an existing color uniform; it adds no shader operation. [Linear tint luminance](validation/color-luminance.json) stays within 0.3% for route sheen and 3% for shadow tints; pixel navigation gates remain the acceptance evidence. No CPU particle simulation or per-frame reflection render is introduced.

Rejected: raymarched god rays/volumetric fog (additional passes and sampling), LUT textures/global desaturation (courier/eye color risk and asset sampling), grain (tiny silhouettes/eyes need clean pixels), SSR (deferred roadmap work), forced wetness/rain (contradicts dry campaign weather), extra unoccluded shaft cards (facade spill), duplicate ash emitters (existing weather already supplies them). L6 retains its existing darkness/headlamp treatment rather than adding visible daytime dust underground. Research links and reasoning are in research.md.

## Validation and remaining gates

**This is not a green deploy gate.** Build, typecheck and lint pass for the final renderer. No budgets, contrast floors or test thresholds were loosened. Gameplay, protected reference directories and VFX-lane files were not edited.

| Check | Result and scope |
| --- | --- |
| Initial WebGL2 Scene Lab | **114/114 pass**, both tiers and all three zooms: ten atmosphere fixtures plus nine existing night-navigation fixtures. [Report](matrix/webgl2/index.md). Sampled navigation gates retain typical ≥2.5 / floor ≥2.0. Views with no runner samples do not establish pixel contrast. |
| Final WebGL2 / WebGPU Scene Lab | **0/60 and 0/114 executed**. Browser startup/context failures, not completed assertion runs. [GL](matrix/final-webgl2/index.md), [GPU](matrix/webgpu/index.md). |
| Initial functional browsers | **19/20 pass**: L3 color/contrast, fog player contrast, weather moods/wetness/snow/wind/dither, facade spill, foundation checks. [Results](browser-initial.json), [L3](validation/l3-contrast.json), [fog](validation/fog-contrast.json). |
| Initial smoke | **16/16 pass**: game cameras, transitions, save/controls/driving/crowds and WebGPU canvas checks at both tiers/zoom limits. [Results](validation/smoke.json). |
| Completed Hetzner unit suite | **1,590 passed / 3 failed / 9 pending** of 1,602 before the exact L1 swatch update. [Summary](validation/unit-initial-summary.json). One failure was the old L1 color literal; after correction its single focused case passes locally (3 other cases skipped). The new atmosphere tests and adjacent lighting/look tests passed remotely. |
| Other unit failures | Missing active-epic AC tags and CLI campaign registration (11 actual entries vs 10 expected). Untouched-parent tag evidence: [coverage](validation/baseline-coverage.json). These remain unresolved; the full suite is not green. |
| Full Hetzner unit/sim/levels | **Incomplete, exit 255**, connection lost after ten reconnect attempts; no final JSON retrieved. Partial log includes support/zoo 4 ms cases, production geometry-contract and close-shell kill failures. Assertions/final totals were not retrieved. [Partial evidence](validation/full-remote-incomplete.txt). |
| Focused remote retry | Could not connect: `No user exists for uid 501`. [Log](validation/focused-remote-unavailable.txt). Only the one changed swatch case was then run locally, with one worker, [passing](validation/l1-swatch-focused.txt); no local suite sweep. |

**Threat readability remains red and assigned to the follow-up lane.** E25-AC13 courier contrast passes at **3.159:1**, but brightest infected-eye red margins are **51/55/57**, below the unchanged **60** threshold. [Measurement](validation/night-readability-initial.json). The [bloom sweep](eye-probe/measurements.json) reaches only **54/58/61** with bloom disabled. The [opened probe frame](eye-probe/bloom-0.25.png) also shows visibly fragmented infected bodies. The orchestrator explicitly directed this lane to preserve evidence and leave both paths to a follow-up lane on 2026-10-17. The unchanged-build probe retry failed before capture; [startup log](validation/baseline-eye-probe.txt). No empirical baseline eye comparison was obtained, and neither defect is claimed fixed here.

Final foreground tint QA stopped after browser queues exceeded **30 minutes**, as required by the fairness rule. Eventual attempts failed with Chromium SIGTRAP/closed contexts. Logs: [GL capture](validation/final-capture-webgl2.txt), [GPU capture](validation/final-capture-webgpu.txt), [GL matrix](validation/final-matrix-webgl2.txt), [GPU matrix](validation/final-matrix-webgpu.txt). No quiet-run reservation was held, and no batches were chained under a reservation. Final L5/L9/L10 captures and readability checks must be repeated after browser recovery.

The exact L1 shadow assertion changed from `6b4fc2` to authored `6c56ac`; fog/shadow-bound assertions remain intact. Final tints preserve linear luminance closely but require actual pixel-gate confirmation. Ground rectangles, crowd overlaps, dark companion outside the L6 pool and missing final captures prevent all-level visual approval.

Native E18 frame timing is **unmeasured**: runs began before the permitted 06:00 timing window without orchestrator quiet-window authorization. Scene Lab timing on the shared host is diagnostic only. `npm run verify -- E25` / `E28` include quiet timing commands and are not represented as fully green. Remaining gates: final both-backend/both-tier/three-zoom capture and matrix batches after fresh build; threat/body follow-up verification; completed remote suites; authorized native E18 timing; real-device/manual WebGPU approval.

## Reproduce

After a fresh `npm run build`, use unique ports and ordinary shared browser locks. Keep each batch within the slot/fairness rules; stop/report if the queue exceeds 30 minutes. These commands overwrite the corresponding evidence, so preserve the initial-profile evidence separately first:

```sh
SCENE_PORT=3597 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/capture.ts after webgl2
SCENE_PORT=3598 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/capture.ts after webgpu
SCENE_PORT=3599 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --filter 'atmosphere-*,night-read-*' --out docs/reports/atmosphere/matrix/webgl2
# Repeat catalog with webgpu and a separate port/output.
python3 tools/atmosphere/sheets.py
sh tools/remote/run.sh "$PWD" --pull test-results/atmosphere-vitest.json -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=test-results/atmosphere-vitest.json
```

Baseline source revision: `fcf81b4da4cdea623c1ddd3c0f8620a41a457a46`. Baseline stills are a production build from that revision, constructed in a private temporary source archive with shared read-only public assets and node_modules. Set `ATMOSPHERE_BASELINE_DIST` to that build's dist directory when invoking capture.ts with phase `before`; it starts/stops its own preview on the private port. Building an archive logs `buildCommit=unknown`; the source revision is recorded explicitly in this report.
