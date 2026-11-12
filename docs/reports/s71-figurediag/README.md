# S71 — TRELLIS figure quality diagnosis

**Diagnosis complete with the lineage limitations below. HIGH is the PO acceptance view; LOW is secondary. No asset or rendering change is proposed for promotion.**

The current figures are not losing a hidden 8/10 model solely in the renderer. The three inspected raw highs score about **6/10** under strict S53 criteria. Historical proportion changes, reduction/bake processing and colour matching then lose another 1–2 points in some figures. Correct neutral binding adds no whole-point loss in the controlled comparisons. Night presentation costs another 1–2 points. None of the tested cheap runtime settings produces a whole-point improvement.

A separate, severe integration failure was reproduced and resolved: **new GLBs paired with stale official pose/UV bakes corrupt appearance**. Matching the selected butcher GLBs and bakes restores its cream cap and coherent body. Treat them as one versioned delivery.

## Stage scores

S53 criteria: silhouette, readable face/expression, material detail, colour, distinct identity and pose readability. Eight is shippable; ten is exceptional stylized-toy execution. Scores are visual judgments, not metric averages. Studio stages use controlled overlapping camera/light comparisons; native game views necessarily use game lighting and screen size. These context changes limit causal attribution.

| Representative | Raw TRELLIS | Pre-bake correction | Repaired bake / texture processing | Neutral skin | HIGH game day / night | Biggest supported loss |
|---|---:|---:|---:|---:|---:|---|
| BBQ-dad, higher S53 ordinary scorer (historical 5/3) | 6 | Exact historical calibrated high reproduced | Repaired bake 6; colour match 5; flatten 5 | 5 | **5 / 3** | Colour match −1; native night presentation −2 |
| Cashier, low scorer (historical 3/2) | 6 | **5**: head enlarged 42.9% | Repaired bake 4; colour/flat 4 | 4 | **4 / 3** regenerated candidate; shipped 3/2 separately | Pre-rig processing totals −2: calibration −1, geometry/bake −1 |
| Selected S52 butcher pilot | 6 | Fitted high 6 | Pre-binding flat 5 | 5 | **5 / 4** | Reduction/bake/flatten −1; night −1 |

BBQ-dad replaces common-worker as the higher-scoring ordinary stage representative because common-worker's raw GLB was not retained. Common-worker's fresh shipped HIGH score remains 5/3. Regenerated ordinary candidates are diagnostic reproductions, not byte-identical historical deliveries: one body and matching official bake serve all requested LODs, with recorded dimension fallbacks. They establish fixed-geometry stage observations, not production LOD/performance acceptance. Butcher uses the actual selected checkpoint; its geometry hash matches the S52 validation receipt.

The largest aggregate pre-rig loss is cashier's **−2**, and the largest presentation loss is BBQ-dad's **−2 at night**. A universal single lossy operation is not established. The strongest integration finding is the avoidable stale-bake mismatch, which can overwhelm the art comparison entirely.

## Opened evidence

- [Cashier raw versus historical head enlargement](cashier-calibration-comparison.jpg), [bake/texture stages](cashier-controlled-bake.jpg), [neutral binding](cashier-neutral-comparison.jpg).
- [BBQ-dad raw/bake/flat](bbq-controlled-prerig.jpg), [isolated colour correction](bbq-colour-isolation.jpg), [neutral binding](bbq-neutral-rig-comparison.jpg).
- [Butcher untouched raw/fitted high/flat](butcher-raw-fit-controlled.jpg), [aligned bake/selected neutral delivery](butcher-aligned-stages.jpg).
- **HIGH:** [matched ordinary candidates](ordinary-matched-candidate-high.jpg), [matched selected butcher](butcher-matched-high.jpg). **LOW:** [matched three-figure matrix](matched-candidates-low.jpg).

All game matrices cover zoom 1 and 1.5, day and night. Scene Lab zoom is a radius multiplier: 1.5 is farther out. Captures use WebGL2 headlessly, one browser, reserved through `tools/e2e-lock.sh`, private port 4971, 1280×900. Receipts/native captures remain in `test-results/s71-figurediag/`. Detailed commands, hashes, rejected experiments and qualifications are in [EXPERIMENTS.md](EXPERIMENTS.md) and accompanying JSON files.

## Cheap levers — one consistent figure, cashier

These use the current shipped cashier HIGH baseline **3 day / 2 night**, rather than the regenerated stage candidate. Each sheet was opened. No HF inference was needed.

| Lever / tested range | Day / night score change | Evidence and interpretation |
|---|---:|---|
| Actual shared atlas 576×768 → 144×192 | 0 / 0 | [Sheet](cashier-shared-atlas-size.jpg); accessors unchanged; active LOD1/2 draws verified at 144×192. Downsampling sensitivity, not proof that a better source bake cannot help. |
| Nearest min/mag sampling instead of current filtering | 0 / 0 | [Sheet](cashier-nearest-high-runtime.jpg). No expression/readability gain. |
| Flat face normals instead of interpolated skin normals | 0 / 0 | [Sheet](cashier-flat-normals-high.jpg). Geometry-normal test; separate baked AO result below. |
| Baked AO, 40% moderate albedo occlusion | 0 / 0 | [Sheet](cashier-ao-high.jpg). Existing UVs; unused atlas space neutralized; not a dynamic AO system. |
| Figure fill .25 → .65 | 0 / 0 | [Sheet](cashier-light-levers-high.jpg). Existing fill graph, no new light system. |
| Fresnel rim .25 → .8 | 0 / 0 | [Sheet](cashier-light-levers-high.jpg). Not a new outline algorithm. |
| Retain LOD1 at both zooms | 0 / 0 | [Sheet](cashier-lod1-high-runtime.jpg). This figure's LOD1/2 have nearly matching geometry and share the runtime atlas. |
| Whole-figure visual scale 1.0 → 1.2 | 0 / 0 | [Sheet](cashier-scale-high.jpg). Larger screen coverage, same weak expression/material finish; gameplay stats/collision unchanged. |

Standalone LOD image dimensions were misleading: active cashier LOD1/2 bind a shared **576×768** atlas even though the standalone LOD2 image is 72×96. A prior LOD2-file replacement was rejected as a resolution test. All temporary runtime edits were restored; no shader/asset replacement is committed.

## Recommended rebuild-wave recipe

1. **Spend the next art effort on the TRELLIS input/raw result.** Require a readable face, role silhouette and broad garment regions at the elevated game view before downstream processing. Current raw scores around 6 cannot demonstrate an 8/10 delivery. Keep TRELLIS mandatory for every figure; no procedural figure substitution.
2. Preserve current heroine-based shrink-only anatomy limits. Do not replay the historical chibi enlargement targets: cashier's 1.429× head change independently costs a point. Keep body/leg landmarks fixed.
3. Retain the 300k/2K raw immediately. Keep raw, calibrated, repaired bake and flat textures immutable and hash pinned. Apply solidification/reduction only after reviewing face/fingers/role cues; inspect all LODs.
4. Use emission base-colour bake and reviewed source-surface repair. Run the existing guarded component cleanup: cashier's four-triangle scrap was watertight but disconnected, and correctly failed binding until cleanup removed it (0.0439% area).
5. Make colour matching/flattening conditional on opened game-camera improvement. BBQ-dad's Lab match costs a point despite a passing palette gate. Preserve a repaired uncorrected comparison; numerical colour/noise gates are necessary evidence, not art approval.
6. Bind through the compatible rig contract, verify semantic ownership, both eye attachments and hidden stump handling, then inspect neutral and animated poses. The invalid skinned-template experiment is not evidence of a shipped rig defect.
7. **Publish geometry, shared atlas, official pose/UV bakes and mapping together.** Verify decoded geometry/UV provenance against the bake before rendering. GLB-only swaps produced dark caps and fragmented bodies; matching official bakes restored the selected butcher.
8. Gate each rebuild at **HIGH**, zoom 1/1.5, day/night, then LOW. Open native-scale sheets and score strictly. The tested coefficients do not justify a global runtime fix. Reject below the PO's “We only accept at least 8/10”.

**Expected score with these existing highs:** observed matched candidates are BBQ-dad **5/3**, cashier **4/3**, butcher **5/4**. Avoiding demonstrated postprocessing losses may preserve more of the approximately 6/10 raw quality, but an exact improved score is unverified. Planning expectation is **about 5–6 day / 3–4 night**, an inference rather than a scored combined recipe. **No evidence supports promising 8/10 from cheap settings.** A new wave needs materially better raw art plus native HIGH acceptance; 8/10 is the gate, not an achieved prediction.

## Validation, scope and remaining work

- S71 HF use: **0/4**. Existing S52's two inferences are historical, not charged to S71. No secrets printed or committed.
- Typecheck and lint passed. Required `sh tools/remote/run.sh "$PWD" -- npm test` passed on runner 46.225.66.90: 27 files, 106 passed / 1 skipped, 197.0 s against the 240 s budget; exit 0. This supersedes the earlier unavailable-runner attempts. Local suite also passed.
- Committed changes are report/evidence only. Production assets, shader source, stats, corpses and main are unchanged. No push/deploy.
- Still unverified: an authored normal-map addition beyond the tested normal interpolation; a combined improved recipe's score; exact historical ordinary distance deliveries. The current ordinary stage matrices deliberately freeze geometry across requested LODs. The fixed-geometry ordinary matrices isolate presentation; the separate shipped cashier LOD lever tests distance selection. These are diagnostic results, not certification of authentic historical ordinary LOD deliveries or a rebuilt 8/10 asset.
