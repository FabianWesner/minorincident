# Empty-stretch dressing — 2026-10-31

Local branch `lane/look-empty`; baseline runtime `53949e814`, final runtime `012044601`.
Only existing assets are used. L4 is untouched. Nothing was published or deployed.

## Visual review

All 14 comparison sheets were opened and inspected. Each row shows **before zoom 1, after zoom 1, before zoom 1.5, after zoom 1.5**, at the same loaded-game camera position. Both low and high tiers are included, across 30 stops (240 source frames).

| Level | Honest before → after score | Change and remaining limitation |
|---|---|---|
| L6 | 6 → 7 | Three warm exit supply/rest clusters, eight existing props; the broad central path stays clear. |
| L7 | 5 → 7 | Four alternating remnant clusters and five ground flare pools between wrecks. Crates, glass, sandbags, belongings, bench and barricade vary the silhouettes. Large road areas remain plain between stations. |
| L10 | 5 → 6.5 | 92 existing props extend dressing through R6 and the R7 approach; closer verge placement brings warm lanterns into the normal camera view. The final arena remains clear. |

[L6 high](sheets/L6-high-1.jpg) · [L6 low](sheets/L6-low-1.jpg)

L7: [high 1](sheets/L7-high-1.jpg), [high 2](sheets/L7-high-2.jpg), [low 1](sheets/L7-low-1.jpg), [low 2](sheets/L7-low-2.jpg)

L10: [high 1](sheets/L10-high-1.jpg), [high 2](sheets/L10-high-2.jpg), [high 3](sheets/L10-high-3.jpg), [high 4](sheets/L10-high-4.jpg), [low 1](sheets/L10-low-1.jpg), [low 2](sheets/L10-low-2.jpg), [low 3](sheets/L10-low-3.jpg), [low 4](sheets/L10-low-4.jpg)

The capture tool enters L6's actual exterior exit stage before photographing it; L7 uses the actual stepped terraces. HUD removal changes DOM presentation only. The QA build follows the real game camera rig.

## Placement and rendering receipts

| Level | Maximum sampled draws / triangles | Budget |
|---|---:|---:|
| L6 | 110 / 113,191 | 300 / 500,000 |
| L7 | 108 / 166,725 | 300 / 500,000 |
| L10 | 102 / 140,134 | 300 / 500,000 |

Minimum sampled L10 night contrast is **2.69048**, above AC16's 2.5. R1–R5 placement and light parameters are unchanged. R6 lamp station gaps are 25.43–33.29 m. L7 station gaps are approximately 38 m, alternating sides; intermediate existing-wreck flare pools improve the opening rhythm. L6's short exit is dressed at its three visible handover points.

[Placement audit](plan.json): no added solid overlaps, all new L7 full rotated bounds supported by their terrace, unchanged colliders/navigation. New L10 bounds keep at least 1.2 m outside the central road edge; the final accepted prop is x3891, leaving roughly 100 m clear before the arena. L7 reuses types already loaded in baseline L7, avoiding six extra model types from the first draft.

[Frame receipts](review.json) show no added post-load shader builders. L6/L7 and L10 R1–R6 have none. At R7, both baseline and candidate report the same two existing detached `wpn.minigun-mounted` material prewarm events (`pal_picketWhite`, `emi_orange`); traces end at the detached GLTF Scene. MountedGunView awaits warmHidden before attachment/presentation. These are retained streaming prewarm, not new cold visible builds.

## Load timing

Two shared-host cohorts are retained transparently: [first draft](loads-diagnostic/summary.json) and [final runtime](loads-shared-final/summary.json), including raw stage/frame/browser receipts. The first draft added new L7 asset types; the final runtime reuses the existing L7 load set. Neither cohort proves the absolute six-second requirement. In the final-runtime cohort all six median changes are within ±0.3 s (−65, +133, −46, +32, +62, +197 ms for L6 low/high, L7 low/high, L10 low/high), but L10 maxima are 6.189 / 6.209 s. Baseline L10 also exceeds six seconds. These are failed acceptance attempts, not passes.

The [final measurement pass](loads-natural-quiet/summary.json) **passed**: five interleaved baseline/candidate pairs per level and tier, 60 samples total, fresh isolated browser contexts in the native WebGPU pool. Before each pair it waited for a naturally quiet host (load <3, no heavy tool processes, idle pool), retaining normal shared admission. [Admission conditions](loads-natural-quiet/conditions.jsonl) are recorded. There was no exclusive reservation; another job could start mid-pair, and all samples were retained. This is a five-context-pair task check, not the separate 20-fresh-profile full regression sweep.

| Level / tier | Baseline median ms | Candidate median ms | Delta ms | Candidate maximum ms |
|---|---:|---:|---:|---:|
| L6 low | 2959.8 | 2958.7 | −1.1 | 2992.5 |
| L6 high | 4275.7 | 4276.5 | +0.8 | 4342.2 |
| L7 low | 2958.7 | 2925.6 | −33.1 | 2926.7 |
| L7 high | 3091.8 | 3107.6 | +15.8 | 3142.7 |
| L10 low | 5408.3 | 5444.1 | +35.8 | 5576.8 |
| L10 high | 5309.3 | 5326.7 | +17.4 | 5377.0 |

All candidate samples are below 6000 ms and every median delta is within ±300 ms. Browser errors: zero. Baseline first-load outliers (including L6 7325.4 ms and L10 low 6259.2 ms) remain in the raw evidence and summary.

## Finale and checks

The full [before](arrival-before.json) and [after](arrival-after.json) arrival-check JSON files compare byte for byte: high arrival 143.15 s / hash `d3ab9a98ae664737`; low 143.2166667 s / hash `1010f3567297cbae`; released true, deaths zero. Peak living 169 / 87 respectively.

- `npm run typecheck`, `npm run lint`, `npm test`: passed; 26 unit files / 110 tests.
- `npm run scene:gate`: **48/48 pass**, zero known or skipped, 7.4 minutes ([log](scene-gate.log)).
- `npm run test:smoke`: passed, 6 QA cases plus 1 public-build case; 157.6 s ([log](smoke.log)).
- Final matched load acceptance: passed as detailed above; all samples and earlier failed attempts are retained.

Source capture/audit tools are `tools/qa/look-empty-review.ts`, `look-empty-plan.ts`, `look-empty-sheets.py`, and `look-empty-loads.ts`. [Build fingerprints](artifacts.json) identify the captured bundles. Runtime changes were committed per level; QA tools and evidence have separate commits.
