# Skinned instanced crowd: prototype (lane/skinned-crowd)

**Question.** Can crowd figures use a skinned, instanced GPU path with a bone/pose texture at crowd scale, so TRELLIS bodies bind like the couriers (one welded body, weights, no cuts)?

**Answer: GO for the render path; mass rollout still needs the asset/migration items in (c).** At 200 AI on low, the path is not slower than main's rigid crowd. It uses the same draws and the same pose-texture memory. The welded bodies show no joint gaps or shards in the captures. It is internal only, behind `?skinCrowd=1` (`?skinCrowd=rigid` puts the same bodies on their dominant joint, for A/B).

## How it works
- **Pose atlas.** It is unchanged: one matrix per crowd joint and frame, the same clips (infected walk/shamble/run/swing/deaths and the civilian walk) and the same CPU rows. Footwork IK, picking, corpse freezing and pose fades keep reading joint world matrices.
- **Bind row.** One extra atlas row holds every joint's inverse bind (+1.2 kB per batch). The vertex shader blends Σ wᵢ·jointᵢ(frame)·bindᵢ⁻¹ and skips zero weights.
  - The first version premultiplied the binds on the CPU for every uploaded row. That cost +2.7 ms p95 on the phone proxy ([receipt](performance-phone-cpu-premultiply.json)), so the multiply moved to the GPU.
- **Vertex layout.**
  - `_parts.x` is the dominant joint, so every CPU consumer keeps a valid part id.
  - One new `_skin` vec4 holds (j1 + 32·j2 + 1024·j3, w1, w2, w3).
  - Result: +1 attribute location and 0 extra buffers. The live batch has 3 buffers (limit 8) and 12 locations (limit 16).
- **Normals.** Skinned normals are computed per vertex (a `varying`). A fragment-stage normal node interpolated packed joint ids inside seam triangles. That read wrong atlas rows and produced NaN normals, which showed as black bloom blocks; this is now fixed.
  - Side finding: main's rigid crowd also evaluates its matrix in the fragment stage (`normalNode`). That is a possible perf win for main.
- **Dismemberment.** Vertices whose dominant joint is on the severed limb collapse onto the limb's root joint. The partly weighted ring closes into a cone under the existing red stump cap. The crawler leg uses the same rule.
- **Hit flash, tint, eyes.** Hit flash and tint use the same instance attributes and shader. Eyes are an `emi_` disc on the head joint.
- **Corpses.** They still freeze into static pages: `StaticCorpses` blends the same matrices on the CPU (`skinnedVertexMatrix`, unit-tested against the shader formula).
- **Prewarm.** Skinned batches are built and warmed behind the loading card like every crowd batch. No new shader compiled mid-play in any run (0 console errors).

## Assets (two archetypes, 3 LODs × high/low atlas)
`tools/assets/skin-crowd-figure.ts` + `skin-crowd-build.sh`, output in `public/assets/models/skinned/`.

**Inputs**
- **Suit zombie** (`inf.common-worker`): lane/batch15's TRELLIS LODs. Their parts are a pure ownership partition of one reduced surface, so the script welds them by position. The head stays its own shell, as it already is in the batch15 source assembly.
- **Woman** (`npc.civilian-woman-a`): the wave2 pre-binding watertight bodies (`source/flat-lod*.glb`). They are placed by the recorded scale/yaw and fit to the rigid surface (mean 3.6 mm at LOD1). Each vertex takes the nearest rigid part's semantic owner.

**Weighting (courier style)**
- Weights blend over a geodesic band along mesh edges across every parent/child seam. They never jump across a gap in space.
- Smooth normals come from the welded surface.

**Result**

| | LOD0 / 1 / 2 triangles | mean influences per vertex | share of vertices with >1 influence |
|---|---|---|---|
| suit zombie | 5704 / 2188 / 886 | 1.22–1.39 | 22–35 % |
| woman | 5986 / 2486 / 898 | 1.36–1.51 | 35–45 % |

- **Suit zombie:** 10 shells (body, head, small pieces).
- **Woman:** 1 component, 0 open edges. 138 edges where a hand or forearm is fused to the dress or hip are not blended ("unrelated seams"). Those triangles stretch when the arm swings.

Vertex numbers are in [vertex-stats.json](vertex-stats.json), and per-LOD weld/seam receipts are in [assets/](assets/).

## Measurements (200 AI, low, perf-horde-200, every actor `inf.common-worker`, quiet-run, ABBA)
| | main rigid (procedural worker) | skinned TRELLIS | same body, 1 influence |
|---|---|---|---|
| Mac WebGL2 frame p95 | 6.1 / 5.2 ms | 4.5 / 4.7 ms | 5.2 / 4.2 ms |
| Mac WebGPU frame p95 | 4.6 ms (5.5 on the first build) | 4.2 ms (5.5 / 5.2 first build) | 4.0 ms |
| Phone proxy (Pixel 7, 390×844, 4× CPU, WebGL2) p95 | 15.8 / 15.2 ms | 15.0 / 16.9 ms (median +0.45 ms) | – |
| Crowd body draws / total draws | 2 / 56 | 2 / 56 | 2 / 56 |
| Pose texture per batch | 76×1540 RGBA32F = 1.87 MB | the same + 1 row (1.2 kB) | the same |
| Vertex shader | 8 texels per vertex | 8×influences + 4 per influence (bind) ≈ 14–18 texels per vertex, plus 1 mat-mat per influence | 12 texels |
| Bake (1×) LOD1 / LOD2 | 10 / 25 ms (LOD2 simplify) | 20 / 4.5 ms | – |
| Crowd view init (1× / phone) | 526 / 1990 ms | 567 / 2066 ms | – |
| Scenario load (1×) | 1.75 s | 1.8–2.2 s (uncompressed float GLBs) | – |

- The perf-horde-200 shipped mix (main-mix, 8 crowd draws) ran at 4.7–6.2 ms on WebGL2 and 5.8 ms on WebGPU; the phone proxy ran it at 19.9 ms.
- Raw receipts: [performance.json](performance.json), [performance-phone.json](performance-phone.json).
- The batches drew LOD2 at this camera. Main's worker has 3× the triangles (2717 vs 886), and that partly pays for the skinning.

## Visual judgement (game camera, low, WebGL2)
- [close-z1-skin](close-z1-skin.jpg) vs [close-z1-main](close-z1-main.jpg) and [close-z1_5-skin](close-z1_5-skin.jpg): run, swing and idle at player zoom 1 and 1.5. No open seams or gaps at shoulders, elbows, hips or knees, and no shards. The tie, shirt, red eye dots and the woman's floral dress read.
  - The woman's white sleeves look faceted.
  - As an infected, she keeps her healthy face (there is no infected recolour for textured bodies).
- [crowd30-skin](crowd30-skin.jpg) vs [crowd30-main](crowd30-main.jpg): 30 figures with no broken silhouettes. The TRELLIS figures are darker and softer than main's toy models (the known PLAYBOOK §5 verdict, not a binding defect).
- Motion strips: [walk/run](motion-strip-skin.jpg) and [chase/swing, 240 frames](motion-close-skin.jpg). Limbs stay attached in every frame.
- Blast: [sheet](blast-sheet-skin.jpg) and [frozen corpses at f600](blast-corpses-f600-skin.jpg). The deaths freeze into textured static pages with intact bodies.
  - I did **not** isolate a severed skinned limb at close zoom. The cone/cap rule is built and gated in code, but it is not yet confirmed visually.

## Answers
- **(a) Does it remove the binding defects?** Yes, for joints that the welded surface connects: no cuts, no open seams, no shards. What remains is asset input:
  - surfaces that are fused in the source (woman's hands to her dress) stretch;
  - a separate head shell (suit) can show a small neck gap at extreme head angles.
- **(b) Does it fit the perf budget (low p95 within +1 ms of main at 200 AI, horde draws ≤ 30)?** Yes. Mac WebGL2 −0.5 to −1.6 ms, WebGPU −0.4 ms, phone proxy +0.45 ms (median); crowd body draws 2 ≤ 30.
- **(c) What is the migration effort for the remaining crowd archetypes and animals?**
  - **Assets, per archetype:** about 1 h. Run the script on the pre-binding body plus the rigid LOD, then check the fused contacts. Bodies need arms clear of the torso (the A-pose input rule).
  - **Runtime still to do:** 2–3 lane-days, plus asset QA per batch:
    - CivilianCrowd (peds currently use their own material and grip path; here the ped was drawn through CrowdView);
    - accessories (head-local skull bounds in bind space);
    - PickBodies and CrowdFigureProbe (part-local assumptions);
    - meshopt/KTX2 delivery (the GLBs are uncompressed floats, 0.2–1 MB);
    - an infected skin recolour for textured bodies.
  - **Animals and Alphas:** the same bake path. The script needs the quadruped joint list and the hoof/paw grounding check.

**Recommendation:** GO to productionize the skinned path behind the flag on the suit zombie first. Keep "no mass rollout" until CivilianCrowd and accessories are ported and one level batch passes the orchestrator's sheet review.

Scenes: `specs/scenes/skinned-crowd/*.json` (generator `tools/scenelab/skinned-crowd-specs.py`). Perf: `tools/scenelab/skinned-crowd-performance.ts`. NaN audit probe: `tools/scenelab/skinned-crowd-probe.ts`.
