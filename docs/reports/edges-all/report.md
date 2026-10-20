# Campaign height-step readability

Branch: `lane/edges-all`. Prerequisites merged in order: `lane/l7-readability`, then `lane/l6-tunnel`. The Game.ts merge retains the current azimuth-aware input constructor and the incoming height-aware cursor sampler.

The PO's L7 cliff-readability fix now draws on every level: the same merged retaining faces (`sidewalk`, local emission 0.025) and 32 cm pale caps (`picketWhite`, local emission 0.30), with the existing bounded courier reveal. Both quality tiers use identical geometry. This extension changes no lighting, exposure, palette, or grade settings; the prerequisite L6 emergency fill is retained. Empty step sets create no mesh. Geometry follows the combined height field after level-specific layout overrides, including the merged L6 collider corrections; L10's small edge batches remain independent of streamed terrain residency.

The health-bar filled-terrain march remains limited to L7's terrain. Other levels retain exact solid-geometry occlusion for overhanging decks. The regression fixture now keeps an edge group present while asserting that an overhanging deck is not treated as filled terrain.

## Geometry audit

`npx tsx tools/qa/height-steps.ts` runs the original authored-boundary/actual-triangle audit, now including procedural retaining faces on every level. Default mode exits nonzero on missing geometry. `--l7-only` reproduces the prerequisite treatment; `--without-procedural-edges` excludes all generated retaining faces. The legacy `--without-l7-edges` flag still excludes generated faces for the original baseline comparison.

The unit test calls the same audit and asserts ten level rows and zero uncovered segments/metres in each. It inspects actual generated triangles through `heightStepVertices`, with ground, chunk, and placed-asset GLB faces as the fallback for uncovered probes. Generated triangles are tested first, avoiding GLB decoding when they already prove complete coverage. It does not replace the audit with a stored zero-metre snapshot.

| Level | Exposed segments | Missing before (m) | Missing after (m) |
| --- | ---: | ---: | ---: |
| L1 | 821 | 0 | 0 |
| L2 | 952 | 4.00 | 0 |
| L3 | 2193 | 1.82 | 0 |
| L4 | 943 | 5.25 | 0 |
| L5 | 1031 | 16.31 | 0 |
| L6 | 1664 | 253.46 | 0 |
| L7 | 1883 | 0 | 0 |
| L8 | 0 | 0 | 0 |
| L9 | 99 | 0 | 0 |
| L10 | 1666 | 7.07 | 0 |

Total newly covered: **287.91 m / 587 segments**. [Before coordinates](height-steps-before.json) · [After audit](height-steps-after.json). Counts differ slightly from the original L7 report because this worktree includes newer main and L6 collider changes.

## Capture and contrast recipe

```sh
E2E_PORT=3901 SCENE_PORT=3902 E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=1800 \
  sh tools/e2e-lock.sh npx tsx tools/qa/campaign-edges-capture.ts
npx tsx tools/qa/campaign-edges-contrast.ts
```

WebGPU, headless, seed 2, 1600×900, high/low, zoom 1 and 1.5. Captures preserve native level lighting and additionally exercise the shared L6 night preset on normally daytime levels; L6 and L10 retain their own native dark presets. The fixtures complete L4’s convoy ride and L5’s cellar emergence before positioning the courier; other levels stay in the briefing state. Courier staging uses clear locations beside the edge and asserts that the camera remains at the requested support. The west onramp, north crater and Northgate platform use an inspection view from the northeast at the same radius, polar angle, FOV and zoom to avoid intervening structures. Neither fixture modifies shipped lighting data.

Cap probes lie at preselected world coordinates on an originally missing segment. Scene triangle raycasts require a visible generated cap and choose the nearest visible lower ground, including the backdrop at -0.12 m. Figure bounds are excluded after camera-frustum rejection (an offscreen figure beside the lens must not project a spurious rectangle across the whole image). The bounded courier reveal disc is excluded with the original L7 height/depth rules. Contrast uses relative linear sRGB luminance and median 3×3 patches. Samples are never selected by measured brightness. Evidence retains camera, quality/backend, world/pixel coordinates, luminances, and browser errors.

## Visual review and contrast

**88 WebGPU captures, 264 valid patch pairs, zero browser errors.** All 44 night frames are measured; none is silently omitted. Minimum night contrast: **3.10:1**, on the low-tier west highway endpoint at zoom 1. The 22 contact sheets below were opened and reviewed, including all high/low × zoom 1/1.5 combinations. Native-light captures of daytime levels are also retained; the 2.5:1 gate applies to the night pass.

| View | Minimum night ratio | Observation at both zooms and tiers | Contact sheets |
| --- | ---: | --- | --- |
| L2 annex rubble | 5.70:1 | Short retaining faces and pale kerbs identify the rubble support beside the gate. The wider rim also outlines the annex plinth. | [Native](L2-annex-native.jpg), [night](L2-annex-night.jpg) |
| L3 west onramp | 3.10:1 | The short ramp-end cap stays distinct in the warm haze. The endpoint and descent remain readable on low despite its different stair detail. | [Native](L3-west-onramp-native.jpg), [night](L3-west-onramp-night.jpg) |
| L3 east onramp | 5.82:1 | Pale end pieces identify the raised road edge; the purple side face reads against the lower pavement. | [Native](L3-east-onramp-native.jpg), [night](L3-east-onramp-night.jpg) |
| L4 Town Hall | 5.89:1 | The entrance support has a continuous bright lip and shaded riser. It fits the pale portico stone in native daylight and separates from the plaza at night. | [Native](L4-town-hall-native.jpg), [night](L4-town-hall-night.jpg) |
| L5 crater south | 7.02:1 | A continuous pale outline marks the raised surviving slab; the dark crater and broken storefront remain distinct. | [Native](L5-crater-south-native.jpg), [night](L5-crater-south-night.jpg) |
| L5 crater north | 7.09:1 | Small changes in slab height remain visible in the cap, including the short support fragments along the north boundary. | [Native](L5-crater-north-native.jpg), [night](L5-crater-north-night.jpg) |
| L6 shelter field | 6.73:1 | The former black-on-black perimeter has a continuous warm stone cap and dark vertical face. The courier reveal remains local. | [Native](L6-shelter-native.jpg), [night](L6-shelter-night.jpg) |
| L6 night apron | 7.09:1 | A tall retaining wall and uninterrupted pale top make the large drop explicit, including at zoom 1.5. | [Native](L6-night-apron-native.jpg), [night](L6-night-apron-night.jpg) |
| L6 Northgate platform | 5.53:1 | The small pale kerb remains distinct among the dark escalator/landing shapes and emergency light accents. | [Native](L6-northgate-platform-native.jpg), [night](L6-northgate-platform-night.jpg) |
| L6 exit support | 7.23:1 | The retained rubble support has its own pale rectangular rim, distinct from the taller apron perimeter. | [Native](L6-exit-support-native.jpg), [night](L6-exit-support-night.jpg) |
| L10 cure lab | 7.10:1 | A short pale lip identifies the otherwise subtle 0.3002 m support at the lab entrance. It remains clear at the wider zoom. | [Native](L10-cure-lab-native.jpg), [night](L10-cure-lab-night.jpg) |

**Northgate reference surface:** the authored support box ends at x=249.4 m, but the actual metro-exit mesh continues as a landing at y=0.6 m. Its kerb is measured against that visible adjacent landing, rather than claiming a lower ground pixel where no visual drop exists. The other viewpoints compare the cap with visible lower ground. This distinction and the actual reference world coordinates are retained in [contrast.json](contrast.json) and [captures.json](captures.json).

L1, L8 and L9 have no baseline gaps to fix; L8 has no qualifying steps. L7 remains covered by the merged prerequisite and its existing [capture/contrast report](../l7-readability/report.md). No new contrast certification of unsampled steps is claimed: the geometry audit covers all segments; contrast/vision cover the representative fixed supports listed above.

Still-frame maxima across these views are 147 draws / 683,837 triangles high and 129 draws / 294,017 triangles low. These are capture counters, not a frame-time benchmark.

## Validation

- Typecheck, lint and production build: **PASS**, remotely.
- Latest focused retaining geometry, all-level ratchet and overhanging-deck occlusion checks: **5 passed / 3 files**, remotely. The full campaign ratchet took 18.1 s on the loaded runner.
- Cross-campaign `tests/unit tests/levels --maxWorkers=4`: **2,159 passed, 11 skipped, zero failures** (396 passed files, 3 skipped). This includes both standard/newbie L1→L6 campaigns and checkpoint clearance through L10.
- Browser evidence: **88 captures, 264 valid pairs, zero browser errors**, one headless browser at a time under the shared lock; ports 3901/3902, 1800 s admission limit. All 44 night frames meet the 2.5:1 gate.
- Full per-epic browser/performance verifiers were not rerun; this lane used the requested cross-campaign unit/level suite and WebGPU capture gate.
- Baseline rerun after scanner optimization: identical level results and missing coordinates to the initial scan. Default final scan: zero missing metres on all ten levels.

Remote logs are retained locally under `test-results/edges-all-{validation,final-checks,ratchet}.log`. The first remote attempt passed typecheck/lint but did not launch tests because shell log redirection targeted an absent directory; the rerun creates it explicitly.

No specs or reference assets changed. No deployment, push, or merge into main.
