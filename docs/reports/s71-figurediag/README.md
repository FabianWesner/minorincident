# S71 figure quality diagnosis

**Status: diagnosis in progress.** This report separates measured game scores from source-pipeline observations. The raw → bake → rig → game stage score series and controlled cheap-lever sweep are not yet complete; cells marked **unmeasured** must not be read as inferred scores.

## Evidence and rubric

The strict rubric is the S53 rubric: silhouette, readable face/expression, material detail, colour, distinct identity, and pose readability; 10 is exceptional stylized-toy quality and 8 is the PO acceptance threshold. S53 scores are opened game-camera judgments, not raw-model ratings. Its all-figure summary is [S53 README](../s53-zombie-review/README.md) and [summary JSON](../s53-zombie-review/summary.json). The full opened sheets and captures live outside Git in `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s53-zombie-review/`.

## Representative stage scores

| Representative | TRELLIS raw (a) | Decimated / baked (b) | Neutral rig (c) | In game (d) | What the evidence establishes |
|---|---:|---:|---:|---:|---|
| Ordinary, higher S53 scorer: `inf.common-worker` (5 day / 3 night) | Unmeasured | Unmeasured | Unmeasured | 5 / 3 | The pipeline source sheet shows the high and matched LOD0/1/2 in the pipeline inspection views side by side. The raw GLB is not retained in the high archive; pipeline notes say it is unavailable. Pipeline note's 7.5/10 is a reconstruction-era score before the colour pass, not comparable to S53 and not used here. |
| Ordinary low scorer: `inf.cashier` (3 day / 2 night) | Unmeasured | Unmeasured | Unmeasured | 3 / 2 | A durable 300k / 2K raw high exists at `/Users/wesner/Workspace/trellis-highs/inf.cashier/`; S53's opened game evidence is in `motion-ordinary-matrix/cashier/`. The raw, pipeline LOD0 bake, and shipped skinned LOD0 files exist, but no same-camera stage sheet or stage scores were found. The previously opened pipeline `sheet.jpg` and `motion-sheet.jpg` are old-vs-new and neutral-game-motion reviews, not raw/bake/rig comparisons. |
| Heavy: `inf.butcher` (4 day / 3 night) | Unmeasured | Unmeasured | Unmeasured | 4 / 3 | S53 score is for the existing deployed derived model. S52 butcher pilot reused the TRELLIS `inf.bbq-dad` base and did not create a unique butcher inference. The S52 source report records a pipeline candidate improvement of 4/3 → 5/4 after 6.7 h and two HF runs; this is a pilot judgment, not an S53 re-score or a verified score for the current deployed asset. Its matched runtime sheet is attached below. |

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

1. Treat TRELLIS as mandatory for every figure, including the butcher's unique base; use its 1024 input, seed 42, 12 steps, 300k-triangle / 2K export recipe from the v2 playbook. Never substitute procedural or Blender-built figures.
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
