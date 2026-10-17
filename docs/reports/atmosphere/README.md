# Campaign atmosphere

Render-only level profiles improve sky/ground temperature separation, sunset haze, and bloom/vignette balance. Sparse daylight birds, dust and paper reuse AmbientLife; the zoo gets up to 24 tiny insects at six powered lamps on high. Low omits insects and caps daylight fields at 30 triangles each. No new post pass, light, shadow, texture asset or dependency. Campaign weather, simulation, camera controls and gameplay are unchanged.

[Research and baseline audit](research.md). Before/after evidence uses real seed-1 campaign starts, high/low, zoom 0.5/1/1.5, WebGL2/Metal and WebGPU. Each sheet has rows for the three zooms and columns **high before / high after / low before / low after**. Full camera stills and metadata remain under `before/` and `after/`. The initial capture tool changed the zoom state without reposing the paused rig; those captures were replaced with actual camera updates, verified by radius/position in metadata. One initial batch that overlapped a build was discarded and replaced against an immutable build.

## Per-level review

| Level | Before → after; high and low | WebGL2 / WebGPU sheet |
| --- | --- | --- |
| L1 | Strong violet café shade → softer violet with warm paving/cool ambient. Courier/corgi remain distinct; the change is restrained. Existing petals/dust/birds remain. | [GL](sheets/webgl2/L1.jpg) / [GPU](sheets/webgpu/L1.jpg) |
| L2 | Morning-like ambient → cooler midday skylight and neutral ground bounce, less window bloom. Sparse dust/birds provide normal street life. Low keeps the same temperature split with simpler foliage. | [GL](sheets/webgl2/L2.jpg) / [GPU](sheets/webgpu/L2.jpg) |
| L3 | Tan-on-tan smoky approach → warm sun against lavender-gray smoke, sparse paper-colored drift. Long shadows/shafts stay readable; courier red/teal and corgi colors remain. | [GL](sheets/webgl2/L3.jpg) / [GPU](sheets/webgpu/L3.jpg) |
| L4 | Purple-shadowed warm convoy → clearer blue ambient/neutral violet shade and warm bounce. Bus silhouette remains legible; on-foot courier review uses the Scene Lab fixtures. | [GL](sheets/webgl2/L4.jpg) / [GPU](sheets/webgpu/L4.jpg) |
| L5 | Saturated red wash → muted rose haze and cooler rose-violet shadows against the orange sun; less uniform red across the ruined shell. Ash still drifts, orange sun remains, glow is restrained. | [GL](sheets/webgl2/L5.jpg) / [GPU](sheets/webgpu/L5.jpg) |
| L6 | Gray tunnel with very bright lamp accents → restrained halo and less edge vignette. Existing warm headlamp, sparse colored accents and gray darkness remain the focal language. | [GL](sheets/webgl2/L6.jpg) / [GPU](sheets/webgpu/L6.jpg) |
| L7 | Blue-violet ash night → ash-gray distance against dark blue air, restrained fire bloom. Same Northgate profile as the L6 exit; existing crowd overlaps remain visible in the audit. | [GL](sheets/webgl2/L7.jpg) / [GPU](sheets/webgpu/L7.jpg) |
| L8 | Same purple night as L7 → teal-blue moonlight around warm powered lamps. High adds tiny lamp insects; low has none. Courier/corgi identity colors remain visible in the entry pool. | [GL](sheets/webgl2/L8.jpg) / [GPU](sheets/webgpu/L8.jpg) |
| L9 | Blue night with pale navigation band → steel-gray road sheen/slate shade and steel-blue air, retaining road lift strength and 150 m sight lines. Baseline pale ground rectangles remain an outstanding terrain finding. | [GL](sheets/webgl2/L9.jpg) / [GPU](sheets/webgpu/L9.jpg) |
| L10 | L9-like night → violet road sheen/shade and distant air, restrained bloom. Courier and road cue remain bright. Baseline pale rectangular ground patch remains visible. | [GL](sheets/webgl2/L10.jpg) / [GPU](sheets/webgpu/L10.jpg) |

## Cost and alternatives

[counters.json](counters.json) records paired draw/triangle counters at every level/tier/zoom/backend. These are structural counters, **not a native frame-time certification**. Palette, haze and post weights change existing uniforms. L2/L4 add at most three tiny ambient draws (64/44 triangles high, 46/42 low); L3 adds one draw/12 triangles; L1 retains its existing fields. Zoo insects add at most one draw/24 triangles high, zero low. Every other level adds no geometry. The final L9/L10 road tint replaces an existing color uniform; it adds no shader operation. [Linear tint luminance](validation/color-luminance.json) stays within 0.3% for route sheen and 3% for night shade; pixel navigation gates remain the acceptance evidence. No CPU particle simulation or per-frame reflection render is introduced.

Rejected: raymarched god rays/volumetric fog (additional passes and sampling), LUT textures/global desaturation (courier/eye color risk and asset sampling), grain (tiny silhouettes/eyes need clean pixels), SSR (deferred roadmap work), forced wetness/rain (contradicts dry campaign weather), extra unoccluded shaft cards (facade spill), duplicate ash emitters (existing weather already supplies them). L6 retains its existing darkness/headlamp treatment rather than adding visible daytime dust underground. Research links and reasoning are in research.md.

## Validation and remaining gates

Typecheck, lint and production build pass. The first functional browser batch passes 19/20 checks: both L3 character color/contrast checks, fog player contrast, precipitation dither, weather moods, wetness, snow coverage, wind smoke, facade spill and the foundation checks pass. [Browser results](browser-initial.json), [L3 measurements](validation/l3-contrast.json), [fog measurements](validation/fog-contrast.json).

**Readability gate still red:** E25-AC13 courier contrast passes at **3.159:1**, but the brightest infected eye pixels have red margins **51/55/57**, below the unchanged **60** threshold. [Measurement](validation/night-readability-initial.json). The [bloom sweep](eye-probe/measurements.json) reaches only **54/58/61** with bloom completely disabled, so changing bloom alone cannot close the eye gate. The [opened probe frame](eye-probe/bloom-0.25.png) also shows visibly fragmented infected bodies. The orchestrator explicitly assigned these to a follow-up lane on 2026-10-17; no global exposure/color workaround or test relaxation was applied. An unchanged-build comparison is recorded separately after it completes.

Baseline world findings also remain visible: the hard-edged green patch behind the L1 courier, the L9/L10 pale rectangular ground patches, and entry cohort overlap at L7/L8. These frames cannot support a clean all-level vision/deploy approval. They are preserved rather than hidden by a different camera.

Initial WebGL2 matrix: **114/114 pass**, both quality tiers, all three zooms, profile fixtures and all nine night navigation fixtures. [Initial matrix](matrix/webgl2/index.md). The L5/L9/L10 foreground tint revision is being checked separately against the same gates. The full Hetzner unit/simulation/level run, remaining final captures, smoke and final Scene Lab results are recorded below when complete. No budgets, contrast floors, test thresholds, gameplay files or VFX-lane files were loosened or edited.

Native E18 timing is **unmeasured**: the run began before the permitted 06:00 timing window, without orchestrator quiet-window authorization. No quiet-run reservation was held. Scene Lab timing on the shared host is diagnostic only. `npm run verify -- E25` / `E28` include quiet timing commands and cannot be represented as fully green without that window. Real-device and manual WebGPU approval are also not supplied by headless captures.

## Reproduce

After `npm run build`, use unique ports and ordinary shared browser locks:

```sh
SCENE_PORT=3597 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/capture.ts after webgl2
SCENE_PORT=3598 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/capture.ts after webgpu
SCENE_PORT=3599 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --filter 'atmosphere-*,night-read-*' --out docs/reports/atmosphere/matrix/webgl2
# Repeat catalog with webgpu and a separate port/output.
python3 tools/atmosphere/sheets.py
sh tools/remote/run.sh "$PWD" --pull test-results/atmosphere-vitest.json -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=test-results/atmosphere-vitest.json
```

Baseline source revision: `fcf81b4da4cdea623c1ddd3c0f8620a41a457a46`. Baseline stills are a production build from that revision, constructed in a private temporary source archive with shared read-only public assets and node_modules. Set `ATMOSPHERE_BASELINE_DIST` to that build's dist directory when invoking capture.ts with phase `before`; it starts/stops its own preview on the private port. Building an archive logs `buildCommit=unknown`; the source revision is recorded explicitly in this report.
