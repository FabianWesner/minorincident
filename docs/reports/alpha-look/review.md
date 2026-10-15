# Alpha revision after orchestrator review — 2026-10-15

Regular Alpha retains the revised posture, broad shoulders and grasping hands. The pale bare chest is replaced by dark torn clothing, bruised purple skin, raised red wounds, larger glowing eyes and red chest veins. Mega matches its height and stays inside the PO's 1.3× footprint limit; dark muscle/skin, shoulder armour, spine spikes and glowing veins carry the stronger appearance. Existing palette tokens carry the bruised colors into the runtime; changing GLB RGB alone is insufficient because the renderer resolves named palette colors. No gameplay counts, speed, damage or HP changed.

## Packed dimensions and budgets

Dimensions exclude hidden stump caps and use the rest pose. Both assets face +X, so width is the Z extent, height Y and depth X. Reproduce with `npx tsx docs/reports/alpha-look/measure.ts`; [raw measurements](dimensions.json).

| Tier | Alpha width / height / depth (m) | Mega width / height / depth (m) | Mega/Alpha width / depth |
| --- | --- | --- | --- |
| LOD0 | 2.414 / 2.580 / 1.395 | 2.955 / 2.585 / 1.693 | 1.225 / 1.213 |
| LOD1 | 2.364 / 2.584 / 1.381 | 2.930 / 2.586 / 1.694 | 1.239 / 1.226 |
| LOD2 | 2.364 / 2.585 / 1.355 | 2.833 / 2.574 / 1.634 | 1.198 / 1.206 |

Regular Alpha LOD0 is 1.433× the 1.8 m worker. Packed triangle counts including caps are **7,777 / 2,794 / 872** for Alpha and **15,587 / 5,648 / 1,908** for Mega. Four/six materials respectively, no textures; existing budgets unchanged. [Asset validation](asset-validation.json) passes every tier for both IDs. Alpha's reduced source exports have zero boundary/non-manifold edges: [topology](lod-topology.json).

## Relative visibility gate

The previous absolute `megaVisibleShareMin: 0.015` encouraged widening Mega to occupy a fixed viewport area, contradicting the PO's size requirement. The three isolated Mega close-contact/arrival/speed fixtures now require `megaAlphaVisibleRatioMin: 0.9`. At each sampled contact frame (≤6 m), the probe renders a regular Alpha in the Mega's exact position, orientation and animation pose, with the same camera and lighting. Each asset keeps its normal materials, including the Mega's courier cutout. Simulation does not advance. Each model has its own hidden-crowd background render, so the animated head's different health-bar position cannot inflate the body pixel count. A synthetic PNG regression covers this. The Mega model is restored in `finally`. Missing contact/reference samples fail. `courierVisibleShareMin: 0.6` is unchanged. The compact boss uses a 0.1 cutout strength instead of 0.2: diagnostic images showed the old partial hole dithering much of the smaller body even beside the courier. This is a presentation adjustment; the same courier visibility gate still measures the result.

The packed asset tests enforce ≤1.3× width and depth at all tiers as well as the existing same-height and rig/clip contracts. The catalog test records why the gate changed and protects both thresholds. Manifest dimensions now describe the smaller exported Mega; no budget limits or specs changed.

## Comparison sheets and visual review

The new BEFORE is the reviewed candidate **fd0a31963**; AFTER is this revision. Both Alpha and Mega baseline GLBs are served only to the before browser. Same camera, lighting and lineup: courier, worker, Alpha, Mega. Both backends are checked against fallback. New night lineup `alpha-look-night-lineup` adds the dark L10 ground to the catalog.

| Renderer / quality | Zoom 0.5 | Zoom 1 | Zoom 1.5 |
| --- | --- | --- | --- |
| WebGL high | [sheet](comparisons/webgl2-high-z0.5.jpg) | [sheet](comparisons/webgl2-high-z1.jpg) | [sheet](comparisons/webgl2-high-z1.5.jpg) |
| WebGL low | [sheet](comparisons/webgl2-low-z0.5.jpg) | [sheet](comparisons/webgl2-low-z1.jpg) | [sheet](comparisons/webgl2-low-z1.5.jpg) |
| WebGPU high | [sheet](comparisons/webgpu-high-z0.5.jpg) | [sheet](comparisons/webgpu-high-z1.jpg) | [sheet](comparisons/webgpu-high-z1.5.jpg) |
| WebGPU low | [sheet](comparisons/webgpu-low-z0.5.jpg) | [sheet](comparisons/webgpu-low-z1.jpg) | [sheet](comparisons/webgpu-low-z1.5.jpg) |

I opened all 12 final lineup sheets and both LOD sheets. At zoom 1.5, Alpha’s eyes and red chest accents remain visible above the dark clothing; purple shoulder/hand highlights preserve its hunched outline. Mega now occupies a comparable footprint while its ivory armour rims, spikes and brighter red veins identify it immediately. The low tier simplifies fingers and wounds into solid shapes; the front/back sheets show continuous surfaces without torn LOD edges. WebGL and WebGPU retain the same color hierarchy. I also opened the night lineup and moving close-contact/speed sheets: red facial accents and armour edges remain distinct on the blue L10 floor, with the courier visible beside the compact boss.

All authored LODs, front/back: [WebGL](comparisons/lods-webgl2.png), [WebGPU](comparisons/lods-webgpu.png).

Reproduce lineup with `SCENE_PORT=3521 E2E_PORT=3522 sh tools/e2e-lock.sh npx tsx docs/reports/alpha-look/capture.ts fd0a31963`. LOD captures use `capture-lods.ts <out> inf.alpha inf.mega-alpha --backend webgl2|webgpu`, with `ALPHA_BASELINE=fd0a31963` for before; run `package-sheets.py` after both sets.

## Revision validation

- Asset validation, typecheck, lint and fresh production build pass. [Logs](revision-checks.log.gz).
- Hetzner: **162/162 focused tests pass** (asset contracts, static-bake parity, catalog thresholds and health-bar/pixel regression). [Log](revision-assets.log.gz). No local Vitest run.
- Full Hetzner unit suite: **1,497 passed / 2 failed / 7 skipped** (262.83 s), 255 passing / 2 failing / 1 skipped files. [Log](revision-units.log.gz). The failures are `character-loading.test.ts` (female direct loader called twice) and `occluder-footprint.test.ts` (mock missing `cutPlacements`).
- Both failures reproduce against **fd0a31963**: every changed tracked production/test/tool/asset file was restored from `git archive` inside the remote runner's private job, then only those two files ran (**4 passed / 2 failed**). Local files were not reverted. [Baseline log](revision-baseline.log.gz), [restored paths and command](baseline-restoration.json).
- **25/25 browser tests pass** (10.1 min): shared Alpha rendering/LODs, physical attacks, support moves, health bars and four E18 stress tests. [Log](revision-browser.log.gz). All 64 full-count L10/L5 budget samples pass across both qualities, both backends and zoom 0.5/1. These are draw/triangle counters; no fresh frame-time benchmark is claimed.

| Budget tier | Maximum draws | Maximum triangles | Limits | Evidence (16 samples each) |
| --- | ---: | ---: | --- | --- |
| High, both backends | 187 | 424,639 | 600 draws / 1,500,000 triangles | [WebGL](budgets/webgl-high.json), [WebGPU](budgets/webgpu-high.json) |
| Low, both backends | 181 | 208,149 | 300 draws / 500,000 triangles | [WebGL](budgets/webgl-low.json), [WebGPU](budgets/webgpu-low.json) |

- Full scene matrix: **504/504 pass** (252 per backend), high/low × zoom 0.5/1/1.5. [Aggregate results](matrix-results.json), [WebGL sheets](revision/webgl2/index.md), [WebGPU sheets](revision/webgpu/index.md), logs: [WebGL](revision-webgl2.log.gz) / [WebGPU](revision-webgpu.log.gz). Includes every `l10-q1-*`, all three isolated Mega fixtures, Alpha/L5/appearance fixtures and day/night lineups. Detailed metrics are losslessly compressed as `metrics.json.gz`.
- Across all measured variants, minimum courier visible share is **0.662** (required 0.6) and minimum Mega/Alpha visible-pixel ratio is **1.0028** (required 0.9). The aggregate results identify the corresponding scene/backend.

No aggregate `verify -- E07` or fresh sim/level sweep was run for this visual-only revision.

The [initial report](initial-review.md) preserves the first candidate's broad regression results, including nine failures and the unverified baseline reproduction. Those historical timing/regression results are not claimed as fresh revision measurements.
