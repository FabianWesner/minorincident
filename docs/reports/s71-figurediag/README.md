# S71 figure quality diagnosis

**Status: diagnosis in progress.** This report separates measured game scores from source-pipeline observations. The raw → bake → rig → game stage score series and controlled cheap-lever sweep are not yet complete; cells marked **unmeasured** must not be read as inferred scores.

## Evidence and rubric

The strict rubric is the S53 rubric: silhouette, readable face/expression, material detail, colour, distinct identity, and pose readability; 10 is exceptional stylized-toy quality and 8 is the PO acceptance threshold. S53 scores are opened game-camera judgments, not raw-model ratings. Its all-figure summary is [S53 README](../s53-zombie-review/README.md) and [summary JSON](../s53-zombie-review/summary.json). The full opened sheets and captures live outside Git in `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s53-zombie-review/`.

## Representative stage scores

| Representative | TRELLIS raw (a) | Decimated / baked (b) | Neutral rig (c) | In game (d) | What the evidence establishes |
|---|---:|---:|---:|---:|---|
| Ordinary, higher S53 scorer: `inf.common-worker` (5 day / 3 night) | Unmeasured | Unmeasured | Unmeasured | 5 / 3 | The pipeline source sheet shows the high and matched LOD0/1/2 in the pipeline inspection views side by side. The raw GLB is not retained in the high archive; pipeline notes say it is unavailable. Pipeline note's 7.5/10 is a reconstruction-era score before the colour pass, not comparable to S53 and not used here. |
| Ordinary low scorer: `inf.cashier` (3 day / 2 night) | Unmeasured | Unmeasured | Unmeasured | 3 / 2 | A durable 300k / 2K raw high exists at `/Users/wesner/Workspace/trellis-highs/inf.cashier/`; S53's opened game evidence is in `motion-ordinary-matrix/cashier/`. The raw, pipeline LOD0 bake, and shipped skinned LOD0 files exist, but no same-camera stage sheet or stage scores were found. The previously opened pipeline `sheet.jpg` and `motion-sheet.jpg` are old-vs-new and neutral-game-motion reviews, not raw/bake/rig comparisons. |
| Heavy: `inf.butcher` (4 day / 3 night) | Unmeasured | Unmeasured | Unmeasured | 4 / 3 | S53 score is for the existing deployed derived model. The older deployed model derives from `inf.bbq-dad`; the S52 rebuild instead performed two unique butcher TRELLIS inferences and selected run 2. The S52 source report records a pipeline candidate improvement of 4/3 → 5/4 after 6.7 h and two HF runs; this is a pilot judgment, not an S53 re-score or a verified score for the current deployed asset. Its matched runtime sheet is attached below. |

The cashier pipeline `review.json` separately records a **3/10 versus old-model parity verdict** (5 = parity), citing weaker face and apron shape, hair dominance, and busy folds. This uses a different scale from S53 and is not a stage score. Its opened motion sheet shows severe triangular deformation in the LOD2 run pose at 400px, despite the LOD0 run view remaining coherent; that is concrete rig/LOD evidence but cannot be equated to the S53 overall score or attributed to a single stage without the matched neutral-pose comparison.

The available evidence does **not** support a numerical stage-by-stage drop attribution. In particular, a prior asset-development score, a studio source sheet, and a game-camera score are different evaluation contexts. A controlled same-camera series is still required before naming a single numeric “biggest drop.”

## Early loss diagnosis

The strongest directly supported loss is in the presented game scene, especially at night and native zoom: all three S53 examples score worse at night (common-worker 5→3, cashier 3→2, butcher 4→3); only common-worker drops by two points, while cashier and butcher each drop by one. Opened S53 contact sheets show the figures become small relative to the playfield at zoom 1 and night shading suppresses already-small face and garment cues. This establishes a presentation/readability risk, not proof that shader lighting alone causes the score loss. Source sheets show substantial shape and material limitations already exist before game integration (coarse angular hands/hair, uneven rear detail, fragmented clothing), so lighting cannot be the only cause. The cashier motion sheet also flags a likely rig/LOD deformation loss during running; the next diagnostic should separate neutral binding from moving-pose and LOD switching.

The butcher S52 runtime A/B sheet shows the candidate has a cleaner pale cap/shirt and fitted visible cleaver in both quality tiers, while its torso reads narrower and its night view remains low contrast. The pilot's recorded 4/3→5/4 improvement is modest and still below the 8/10 bar. The primary rebuild investment should therefore target authored silhouette/face/garment design and stable large colour regions; texture/render tuning is a secondary gain.

## Cheap-lever results

| Lever | Figure / evidence | Score change | Finding |
|---|---|---:|---|
| Region-aware colour matching | Common-worker pipeline before/after sheet, LOD0–2 | Not rescored in S53 rubric | Visible improvement in red tie/wounds and warm suit separation; original S53 game score remains 5/3. Color correction cannot repair missing silhouette/face detail. |
| Butcher bake + fit + rig candidate (compound pilot, not isolated) | Attached S52 low/high, day/night, zoom 1/1.5 sheet | Pilot judgment 4/3→5/4; not an isolated lever | Visible cleaner cap/shirt and retained cleaver; candidate silhouette narrows. Because this bundles geometry, bake, binding and prop fit, it does not identify which operation moved the score. |
| Atlas/texture size, mip/filter, normal/AO, crowd shader/rim/outline, night fill, LOD distance, silhouette scale | Not tested in this lane yet | — | No controlled score delta or S71 side-by-side evidence yet. |

### Opened side-by-side

![S52 butcher runtime baseline and candidate across low/high, day/night, zoom 1/1.5](butcher-runtime-before-after.jpg)

This is the opened S52 pilot sheet, not a fresh S71 capture. It is useful evidence of the candidate's appearance and the narrowing issue, but it is not a valid controlled S71 lever sweep.

## Recommended rebuild-wave recipe (provisional)

1. Treat TRELLIS as mandatory for every figure, including a unique butcher base (already retained from S52 run 2); use its 1024 input, seed 42, 12 steps, 300k-triangle / 2K export recipe from the v2 playbook. Never substitute procedural or Blender-built figures.
2. Before running the wave, prepare full-body concepts specifically for game-camera silhouette, face/expression, and 3–5 broad garment/material regions. The current evidence shows detail/noise alone does not survive game scale.
3. Keep the proven pipeline stages: solidify and silhouette audit; emission base-colour bake; Lab colour match; regional flattening; per-class rig binding; existing delivery/compression. Validate after each stage, retaining matched cameras, lights, pose, and displayed figure height.
4. Make a game-scale gate decisive: open same figure at zoom 1 and 1.5, day and night, low and high. Score blind with the S53 rubric at raw, bake, neutral rig, and game. Reject below 8/10; do not infer acceptance from studio renders.
5. For the controlled lever sweep, first use one representative with a frozen rig and scene. Change one setting at a time (atlas 512/1024, filtering/mips, normal/AO, crowd rim/outline and night fill, then LOD distance/silhouette scale), saving an opened labeled sheet for every comparison.

**Expected score:** unproven. Existing evidence supports only a modest +1 day / +1 night butcher pilot under a compound 6.7-hour intervention (ending at 5/4), far below the PO's ≥8/10 bar. A numeric expected rebuild score would be false precision until the game-camera controlled sweep and another rebuild wave are scored.

## Remaining work

- Render matched raw/bake/neutral-rig stages for all three representatives; acquire a raw common-worker high or replace it with a higher-scoring ordinary figure whose high is durable. Resolve the Blender Metal startup crash or use an available working headless renderer before generating captures.
- Re-score every stage with the exact S53 rubric, same figure display size/camera/light, and report inter-stage deltas; include the requested in-game low/high × zoom 1/1.5 × day/night matrix.
- Run and open a one-variable-at-a-time cheap-lever sheet, recording score deltas and exact settings.
- Update this report with measured biggest drop and evidence-backed expected rebuild score.

## Lane checks for this report update

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test` locally: passed, 27 files / 107 tests, 113.4 s under the 240 s budget.
- Required `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; the runner reported no healthy/provisioned Hetzner worker. `MI_LOCAL_FALLBACK=1` through the remote wrapper also refused this queue item, so the direct local `npm test` result above is a fallback, not a remote result.
- Fresh Blender stage-sheet attempt: blocked by Blender 5.2.2 crashing during Metal backend initialization before Python ran. No new stage captures were produced.

## Fresh CPU inspection follow-up

Opened `/private/tmp/s71-cashier-raw-cpu.png` and `/private/tmp/s71-cashier-baked-cpu.png`, rendered with the existing pipeline CPU base-colour renderer. The raw high preserves fine hair strands, distinct apron straps, a clear face and shoe details. The decoded pipeline delivery is visibly more faceted, with stronger red patches and weaker hair/clothing separation. This establishes visible loss by delivery, but does not isolate baking: the pipeline LOD0 contains 22 rigid parts and is already bound. Its forward orientation differs from the raw high, so the renderer's default view labels do not correspond across these files. These captures are unlit, individually framed inspections, not the required matched stage comparison or game-lighting evidence.

The pipeline file required meshopt/KTX2 decoding via the existing `v2/l1_decode_reference.mjs`; direct trimesh loading failed. The decoder succeeded and the CPU render completed. Use explicit forward alignment and fixed framing for the next comparison, and locate the pre-binding bake to separate stages b and c.

## Butcher lineage correction and retained artifacts

The retained S52 pipeline worktree final checkpoint confirms two unique butcher inferences, selected run 2, and the cap-fit3-shared integration. The earlier S71 draft incorrectly conflated the older BBQ-dad-derived deployed model with this pilot; the stage table above is corrected. Run 2 used resolution 1024, seed 42, 12 steps, 300k triangles and 2048 texture, with a downloaded 11,294,020-byte raw GLB. Its local job record reports SHA256 `5254824e5f5daaf07de36794baf55de388fa9aad437aae5206a5a9d2b204fef8`. The final S52 checkpoint scores the integrated pilot 5 day / 4 night and explicitly withholds release approval.

Raw stages are retained at `/Users/wesner/Workspace/trellis-highs/s52-inf.butcher/run1/raw.glb` and `run2/raw.glb`. Pre-binding bakes and flattened sources exist under `/Users/wesner/Workspace/3dp-s52-trellis-heavies/cast/s52-inf.butcher-anatomical/`; the selected cap-fit provenance must be followed rather than choosing an arbitrary historical bake from this directory. This resolves the raw-source availability question for butcher. No new inference was made by S71.

## Retained butcher pre-binding inspection

Rendered and opened `/private/tmp/s71-butcher-prebind-cpu.png` from pipeline `cast/s52-inf.butcher-anatomical/source-cap-fit1/flat-lod0.glb` using the CPU renderer with `--forward +z`. This is a single static mesh before binding, unlike the 22-part cashier delivery. The unlit view shows broad simple garment colour regions, rounded hands and limited fine shirt/face detail already at this stage. Final eye geometry is added downstream; its absence here is not evidence of eye loss. This historical cap-fit1 source still requires exact final-provenance matching and aligned raw/neutral-rig captures before scoring or attributing a drop.

## Texture-only retained flatten comparison

![Opened retained butcher bake versus flattened source](butcher-flatten-inspection.jpg)

The two retained `source-cap-fit1` files have exactly identical vertex and triangle arrays (5,625 vertices / 5,500 triangles; see `flatten-comparison.json`). Both were rendered unlit with the same CPU renderer, forward direction and settings, then placed side by side. Flattening produces cleaner broad colour regions, but removes shirt, cap and apron shading that describes volume. My static inspection finds **no overall visual improvement** from this texture-only intervention. This is not a runtime score delta: the requested day/night and native-size game test remains outstanding. The observed tradeoff argues for tuning flatten strength on the actual game camera rather than applying maximum simplification automatically. These are retained pipeline outputs; no new HF inference or runtime asset replacement was performed.

## Runtime shader path traced

`src/render/CrowdView.ts` builds infected atlas colour using `texel.pow(.85)` and an 8% source-colour modulation, then applies `albedo.mul(.65)` for infected-atlas authored base before shared game shading. Thus the in-game albedo is intentionally transformed from the decoded atlas. This is a specific test candidate: compare the current 0.65 multiplier with 0.8 and 1.0, holding atlas, pose, camera, lighting and all other shader operations fixed. No runtime improvement is claimed until those captures are opened and scored.

`src/render/PaletteMaterial.ts` already supplies continuous figure fill plus a Fresnel rim; figure fill uses `surface.max(vec3(.12))`, a tint, figure fill amount, `lighting.rim` and a 0.9 factor. Night-fill experiments should adjust this existing path, rather than add a second lighting system. `src/assets/registry.ts` raises figure-map anisotropy to at least 8. These source facts constrain the planned filtering and lighting experiments; they do not establish which setting causes the observed quality loss. Source inspection found no normal/AO sampling in the shown crowd surface construction, so adding authored maps would require checking the full material contract and a separate render test.

## First controlled runtime albedo experiment

![Opened LOW WebGL2 multiplier comparison](butcher-albedo-runtime.jpg)

Captured the same S53 butcher fixture twice through `tools/e2e-lock.sh`, one headless browser per reservation, private Scene Lab port 4971, 1280×900, LOW/WebGL2. Rows are day zoom 1.5, day zoom 1, night zoom 1, night zoom 1.5; columns are current 0.65 multiplier and temporary 1.0 multiplier. Both runs passed fixture checks with no reported errors. Only the infected-atlas authored-base multiplier was changed; `CrowdView.ts` was restored byte-for-byte afterward. Raw captures and receipts remain in `test-results/s71-figurediag/{baseline,albedo-1}/`.

Opened comparison: no meaningful visible improvement. Strict overall judgment stays **4 day / 3 night → 4 day / 3 night (+0/+0)** for this deployed butcher fixture. Night remains a low-volume silhouette with pale cap, red patches and a ground light pool. This null result does not prove the multiplier is irrelevant to every figure: the current butcher material path must be confirmed before generalizing. Do not promote this shader change on this evidence.

## Albedo experiment path verification

The current manifest registers butcher, cashier and common-worker as `textureMode: baseColor`. `CrowdView` enables `infectedAtlas` for textured, non-healthy humanoids, so the butcher is eligible for the changed branch. The captured pairs differ numerically: 11,463 / 25,883 / 15,140 / 6,728 pixels at frames 1/3/5/7 (full receipts in `albedo-difference.json`). These whole-frame pixel differences establish that the images are not byte-identical; they do not independently measure character improvement or exclude other temporal differences. The opened-sheet judgment remains +0/+0.

A second path limits this experiment: `atlasFill` supplies ordinary infected with `albedo * .18` through emission, separately from the 0.65 authored-base multiplier. The butcher also uses neutral figure fill 1, figure-fill amount .55 and rim amount .25 in the shared material. Therefore this experiment changed one contribution while retaining substantial other fills. The next night experiment should vary existing fill and rim independently, checking volume and colour separation rather than brightness alone. These source facts explain why increasing the base multiplier cannot by itself characterize the entire night-lighting loss.
