# Finding 85 — permanent corpse bodies at low quality

Implementation: `c59e7e5bf`, based on `lane/merge-batch13f` (`f6bd521c3`). **Complete.** Visual review, persistence/living-LOD invariants, native frame-time comparison, and the full required remote suite pass. All implementation and evidence are committed in this lane.

## Cause and production comparison

Settled infected use static instanced geometry, with an authored death pose baked on the CPU. Ordinary corpses previously inherited the living LOD2 mesh, including its low-quality reduction, and then received a second index-only reduction. Thin clothing/body shells became disconnected triangular patches. The audit found generated delivery LODs on six of the seven regular infected variants; a stricter runtime surface limit could not restore surfaces already lost in those files. The old two-pass torso retention measurements are in [geometry.json](geometry.json).

**This is pre-existing in PROD `56d7e7d16`.** Both backends reproduce the broken surfaces in the same finale checkpoint and controlled body field. Compare [WebGL](ab-prod-webgl2.jpg) and [WebGPU](ab-prod-webgpu.jpg), with PROD, merge-batch13f, and the fix in successive rows. PROD has other campaign/appearance differences; the fixed 196-body cohort, checkpoint, seed, zooms, and total corpse counts are shared. The original late-campaign finding is archived as [finding-85.jpg](finding-85.jpg).

## Change

Seven corpse-only GLBs are derived from the intact models. The head and limbs use solid, simplified shells; torso/hip garments use continuous convex volumes. Minor sculpt/bite fragments and garment color noise are simplified so the silhouette reads as a person at gameplay distance. The original rig, main clothing swatches, per-instance appearance, accessories, and authored death pose remain available.

`AssetRegistry.loadCorpse` loads these meshes behind the loading card. `CrowdView` prepares and caches their geometry and their own pose palette, then freezes them into the existing permanent-body pages. Other infected/animal corpse paths retain their previous reduction. The static corpse lifetime, placement, page capacity, population limits, and frustum policy are unchanged.

All 21 existing living GLB/LOD files are byte-identical to merge-batch13f. Living crowd LOD thresholds, near-band limits, simplification settings, and global quality budgets are unchanged. [validation.json](validation.json) records hashes, checks that the production preview contains the final corpse files, and confirms identical before/after recorded body transforms and instance counts.

## Capture method and persistence checks

The fixture uses real campaign levels, seed 32, a 1280×720 viewport, and DPR 1. L10 loads `cure-disperse-ready`, activates the actual console at `(4002,-27)`, runs the mixed assault while leaving the Mega alive, and settles ordinary victims through the production corpse lifecycle. It then adds a repeatable 196-body stress cohort. L4 uses the convoy/quartermaster area; L7 and L8 use their real start areas. These are reproducible stress fields, not a reconstruction of the original tick 75886 save.

Every before/after body ID and transform matches exactly in all 28 capture rows. Rendered static-instance totals match too. No body count is reduced by the implementation.

| Field | Quality | Bodies before / after |
| --- | --- | --- |
| L10 finale / assault aftermath | low | 282 / 282 |
| L10 finale / assault aftermath | high | 363 / 363 |
| L4 convoy / quartermaster | low and high | 196 / 196 |
| L7 evacuation start | low | 400 / 400 |
| L8 zoo start | low | 196 / 196 |

The manifests assert the actual backend, quality, camera zoom, nonempty frozen-body pages, and zero browser errors: [before](before/evidence.json), [after](after/evidence.json), [PROD](prod/evidence.json). All requested zooms are actual game ratios: 0.5 close, 1 default, 1.5 wide.

## Visual review

Opened and reviewed the full capture matrices and representative full-size close/wide frames. Each main matrix contains low and high at zoom 0.5 / 1 / 1.5, before and after.

| Review | Result and observations |
| --- | --- |
| [L10 WebGL](review-L10-webgl2.jpg) | PASS. Close view shows continuous shirt volumes, attached arms/hands, and complete legs/boots around the console. At default/wide zoom the field reads as reclining bodies with heads and clothing, replacing the sparse multicolored torso patches. |
| [L10 WebGPU](review-L10-webgpu.jpg) | PASS. The same complete silhouettes and death poses remain at all three zooms on both tiers. The console bloom and courier remain readable. No backend fallback or missing frozen body was observed. |
| [L4 WebGL](review-L4-webgl2.jpg) | PASS. Beside the convoy bus, the nearest body has a continuous torso and two complete legs; the wide field remains individual bodies. Seeded clothes/headwear remain differentiated. |
| [L4 WebGPU](review-L4-webgpu.jpg) | PASS. Matches WebGL's body volumes and placement at both tiers and all zooms. Warm camp lighting retains the clothing separation; no new clipping or floating body was observed. |
| [L7 low WebGL](after/L7-webgl2-low-z1.jpg) / [WebGPU](after/L7-webgpu-low-z1.jpg) | PASS. Dense bodies beside the evacuation vehicle retain recognizable torsos, hands, and boots among the living survivor group. Dark lighting does not turn the field into disconnected shards. |
| [L8 low WebGL](after/L8-webgl2-low-z1.jpg) / [WebGPU](after/L8-webgpu-low-z1.jpg) | PASS. Body silhouettes remain continuous by the bus and lamp-lit walkway, including the red/blue clothed bodies at the edge of the frame. |

The result is a coarse corpse LOD: small facial/sculpt details remain angular at the closest zoom. Main anatomy and clothing volumes remain intact, with the existing authored death-back pose. This review does not claim a new detailed hero corpse model.

## L10 low frame-time comparison

Native headless Chrome/Metal, uncapped RAF cadence, zoom 1, same fixed finale field, three repeats per backend in each of two runs (six total). Each repeat warms for 1 second and records 5 seconds. Inspection runs the normal view update/render while simulation time stays fixed, keeping the body field identical. This measures the renderer/view cost of the corpse change; it is not a live-AI or phone performance certification.

Timing is admitted through `tools/perf/quiet-run.sh`, with all browser slots reserved, no competing headless Chrome or local Vitest, and load below 3. Each admitted run is below the 20-minute limit. Conditions and raw samples: [before conditions](perf-before-conditions.jsonl), [before samples](perf-before/evidence.json), [after conditions](perf-after-conditions.jsonl), [after samples](perf-after/evidence.json).

| Backend | Before p95 repeats (ms) | After p95 repeats (ms) | Median p95 before → after |
| --- | --- | --- | --- |
| WebGL | 3.4 / 3.8 / 3.3; 3.7 / 3.5 / 3.5 | 3.5 / 3.9 / 3.7; 3.3 / 3.3 / 3.5 | **3.5 → 3.5 ms** |
| WebGPU | 2.3 / 2.2 / 2.3; 2.4 / 2.3 / 2.3 | 2.3 / 2.2 / 2.2; 2.4 / 2.4 / 2.3 | **2.3 → 2.3 ms** |

The first separated run gave WebGL 3.4 → 3.7 ms and WebGPU 2.3 → 2.2 ms median p95. To resolve that mixed result, the second run measured baseline then fix consecutively under one exclusive reservation: WebGL 3.5 → 3.3 ms and WebGPU 2.3 → 2.4 ms. All repeats are retained above; the aggregate median p95 is unchanged on both backends. These sub-millisecond variations do not show a reproducible frame-time regression. [Paired conditions](perf-paired-conditions.jsonl), [paired baseline](perf-paired-before/evidence.json), [paired fix](perf-paired-after/evidence.json), and [aggregate](performance-summary.json).

L10 low capture counters on both backends: **112 → 112 draws; 263,563 → 236,732 submitted triangles (−10.2%); 282 → 282 bodies**. No corpse removal or additional culling is used to obtain the reduction.

## Validation

- `npm run typecheck`: [PASS](typecheck.log).
- `npm run lint`: [PASS](lint.log).
- `npm run build`: [PASS](build.log); final preview corpse file hashes match source.
- Guard: `tests/unit/render/infected-corpse-surface.test.ts` covers all seven variants at both tiers, requires the dedicated corpse source, verifies retained major anatomical parts and rigid triangle ownership, and bounds mesh size. The existing prewarm guard now loads the actual dedicated body.
- Required remote command: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels --maxWorkers=4`: **PASS, exit 0** on final implementation/assets: 417 files passed / 3 skipped, 2,271 tests passed / 9 skipped, 2,547.23 seconds. [Full remote log](remote-suite.log).

## Reproduce

```sh
# Regenerate the dedicated meshes from the intact GLBs.
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/assets/bake-corpses.py

# Capture both backends, both tiers, all requested zooms; one headless browser at a time.
E2E_PORT=4031 SCENE_PORT=4032 CORPSE_OUT=test-results/l10-corpses \
  sh tools/e2e-lock.sh npx tsx tools/qa/l10-corpses.ts

# Native production-build comparison; run each revision separately.
npm run build
E2E_PORT=4031 SCENE_PORT=4032 SCENE_SERVER=preview CORPSE_OUT=test-results/l10-corpses-perf \
  sh tools/perf/quiet-run.sh npx tsx tools/qa/l10-corpses.ts --timing

sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels --maxWorkers=4
```
