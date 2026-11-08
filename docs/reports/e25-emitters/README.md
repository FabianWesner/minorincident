# E25-AC02 — emitter inventory

The repaired corpus has **zero missing emitter references and zero uncovered emissive meshes**. Final visual comparison and gate validation are in progress. Starting revision: `ac0a9e26`; branch: `lane/e25-emitters`. This report concerns AC02; it does not close the other E25 criteria.

## Scope and audit corrections

The previous [inventory](evidence/inventory-baseline.json) reported 184 reference errors / 128 uncovered meshes while resolving shipped references in authored files. It also skipped unnamed authored mesh nodes. The corrected extractor accepts named emitter owners, counts anonymous emissive meshes, and validates bindings in the exported graph itself. The general asset validator and runtime-table extractor use that same direct contract. The inventory checks that every named/metadata anchor is actually parsed.

The exact original public GLBs, scanned with the corrected traversal, contain **1,313 missing references / 638 uncovered meshes**: [direct baseline](evidence/inventory-public-baseline.json). The final scan includes 1,032 primary model exports, 390 nested packed model exports and 401 other GLBs: **1,823 exports in total**. The nested packed exports already pass and have not been edited.

Matching authored variants are checked independently. Source discovery now finds `model.black.lod1.glb`, `model.unarmed.glb` and `model.lod1.low.glb` correctly, resolving 21 of the old 32 apparent source gaps. The 11 remaining generated exports have no matching authored GLB at that path; their shipped graphs are checked directly, without uncertainty suppression or hero-model substitution.

## Changes

1. **Exported binding repair** (`ead80f03`). Bindings retain their existing target when it owns geometry. Missing or empty targets are resolved through the authored material and surviving rigid owner; anonymous destination batches receive stable names. Lamps cannot borrow another surviving lamp/door/siren owner's batch merely because its material matches. The optimizer preserves referenced emitter names alongside sockets and animation pivots. [First receipt](evidence/reference-repair.json), [ownership refinement](evidence/reference-repair-batch2.json).
2. **Coverage repair.** Existing head/brake batches, marker batches and the depot side window are assigned to their existing lights. Existing authored decorative flags and the old explicit decorative table are carried into the actual exports. New decorative metadata identifies only the dedicated infected-eye shader effects and the minigun heat sleeve, whose visibility/glow is controlled by the overheating mechanic. These are material effects rather than practical lamps, as permitted by §6. The sprinter's legacy `emi_windowGlow` material is explicitly its authored `eye_core` (`assets/inf.sprinter/build.py`); the other eye surfaces use `emi_infectedEye`. The [receipt](evidence/coverage-repair.json) records each decision: 74 inherited decorative surfaces, 125 eye-effect nodes, and six authored/shipped heat-effect nodes. No practical lamp was exempted to reach zero.
3. **Missing equipment anchors.** Added one `light:equipment` per tier to `acc.headlamp`, `kit.dispersal-console`, `kit.dispersal-filtration-tower`, `kit.dispersal-turbine-hall`, `prop.cure-canister` and `prop.cure-canister-pedestal`: 18 shipped and 18 authored anchors. Positions come from each file's actual drawn emissive geometry bounds. The shared [settings](../../../tools/assets/equipment-lights.json) are used by the metadata repair and Blender authoring helper. The headlamp continues to use the existing runtime beam; its metadata adds no second beam. Other small equipment glows have no ground pool; the turbine hall anchor enables its window spill. [Anchor/geometry receipt](evidence/equipment-anchors.json).

The runtime table contains **376 anchors in 101 assets**, with zero errors or uncovered base emitters. Existing anchor positions, directions, colors, intensities and behaviors are preserved. GLB repairs change only emitter metadata/names and the added empty anchors; no geometry, material, animation or pose rebuild is used. Ten existing Grove/Corridor static bakes receive the repaired light/window attributes. Every original geometry, pose, color, palette and surface attribute stays exact, and the original 142-key cache set is retained. A full refresh had picked up an older fire-station floor palette adjustment; the metadata transfer preserves its accepted appearance instead. [Bake integrity](evidence/static-bake-integrity.json), [appearance preservation](evidence/static-appearance-preservation.json), [cache scope](evidence/static-bake-scope.json). All 258 civilian bakes were regenerated and remain byte-identical, including their manifest: [receipt](evidence/civilian-bakes.json).

## Authoring and regression evidence

The [whole-migration integrity proof](evidence/integrity-final.json) checks all **573 changed GLBs** against `ac0a9e26`: identical binary payloads, unchanged original transforms/materials/animations/geometry, identical triangle counts, and retained file/tier and absolute distance-triangle budgets.

A real headless Blender 5.2.2 LTS run imports every equipment source LOD, reruns the authoring helper and compares it with the repaired anchor. **21 checks pass**: all 18 equipment positions reproduce within 0.1 mm, references cover the actual emissive meshes, and all three minigun tiers recover the heat-effect marker without geometry changes. [Blender receipt](evidence/equipment-authoring-check.json).

The existing asset-contract test covers anonymous meshes, named owner bindings, decorative anonymous meshes, owner/material disambiguation, preservation through optimization and rejection of references that exist only in a separate source document. The focused file passes **3/3 tests**; no test case or file was added to the suite count. The existing gate-tool tests cover explicit backend selection so the required scene gate can honor the repository's manual-WebGPU policy.

## Accepted looks

The A/B tool restores exactly the changed public GLBs, runtime light table and static-bake manifest from `ac0a9e26`, captures the baseline, and restores repaired bytes in `finally`. Both sides use the same seeds, paused simulation clocks, renderer node time and geometry-based depth tie ordering. Every complete RGBA frame is compared; no image region is excluded.

The [fixture list](evidence/visual-fixtures.json) contains **93 changed accepted-level prop/decay cases**, drawn from their actual L1/L2/L4/L5 placements, plus the six equipment assets at night. Each runs at **zoom 1 and 1.5, low and high**. The native L1 entry, L2 `l2-streets-w1`, L4 `l4-plaza-safe` and L5 `pair-plaza` views use the same matrix. Total: **412 paired comparisons / 824 screenshots**. Images remain local under `test-results/epics/E25/emitters-{before,after}/`; hashes, changes and review will be archived here when the run completes.

## Validation

Final inventory is **1,568 named / metadata / parsed anchors; zero errors, missing references or uncovered emissive meshes**, with zero authored-source errors or uncovered meshes. The GLB and static-bake integrity checks pass. Typecheck and lint pass; the complete E25 verify, WebGL2 scene gate and final visual comparison remain in progress. WebGPU remains a manual check under repository policy.

## Reproduction

Reproduce this metadata migration with the same source corpus:

```sh
node --import tsx/esm tools/assets/e25-emitter-repair.ts
node --import tsx/esm tools/assets/e25-emitter-coverage.ts
node --import tsx/esm tools/assets/e25-equipment-lights.ts
npm run assets:lights
# Regenerate the affected bakes listed in evidence/static-bakes.json, then:
node --import tsx/esm tools/assets/e25-static-light-metadata.ts
node --import tsx/esm tools/qa/e25-inventory-audit.ts --check
node --import tsx/esm tools/qa/e25-emitter-integrity.ts
```

The Blender equipment recipes and optimizer retain the new metadata during normal builds. The migration tools also reconcile historical generated LODs and inherited decorative metadata. `e25-emitter-ab.ts` and `e25-emitter-compare.py` reproduce the accepted-prop matrix; use a private `SCENE_PORT` and avoid source sync while the A/B tool temporarily restores the baseline. No deploy or push is performed.
