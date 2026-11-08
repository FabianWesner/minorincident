# E25-AC02 emitter inventory repairs

## Current inventory

Fresh run on `lane/e25-emitters` at `ac0a9e26`:

```text
1,032 model GLBs; 1,550 named anchors / 1,550 metadata records
184 emitter-reference errors; 128 uncovered emissive meshes
32 model GLBs lack a matching authored LOD source
401 other GLBs scanned
```

Machine detail is in `../e25-verify/evidence/inventory-final.json`. This is a reproduced baseline, not a passing result.

## Diagnosis

The 184 hard reference errors are concentrated in 24 assets' LOD1/LOD2 exports. Several matching authored LOD GLBs contain emissive mesh nodes without names, even though the corresponding anchors refer to named meshes from the full-detail model. In some assets multiple distinct emitters have been merged into one LOD mesh/material batch. Assigning that combined mesh to every anchor would make the static validator pass while changing emitter power behavior, so it is not an acceptable metadata-only repair.

The 128 uncovered emissive meshes span 79 exported model variants. They include assets with no anchors (for example, the headlamp accessory, whose asset notes explicitly say it adds no light), dynamic character emissives, and variants of powered props/vehicles. These require review by emitter behavior before adding anchors or marking any surface decorative.

The 32 source gaps include generated crowd/skin variants and low-tier animal/vehicle exports. The inventory must resolve each to its actual matching authored source or clearly report that the source is unavailable; a hero model must not be substituted for a different LOD.

## Repair protocol

For each batch, preserve the source asset's intended power behavior, make the repair in authored metadata/build inputs where possible, regenerate the affected shipped LODs, and record exact geometry/payload identity plus anchor/reference evidence. Re-run the exhaustive inventory after each batch. Do not treat name-only aliases for merged emitters or blanket decorative exemptions as coverage. For any accepted-level prop whose lighting changes, capture zoom 1 and 1.5 at low and high quality and compare against its accepted view.

## Status

No asset repair is claimed yet. The required end state remains zero unresolved emitter references and zero uncovered emissive meshes across all scanned model exports.

## Batch 1 — resolve exported bindings

The old baseline substituted authored nodes when checking public GLBs and skipped unnamed source emissive meshes. The corrected audit validates each shipped graph and each matching authored graph independently. Source discovery recognizes actual variants such as `model.black.lod1.glb`, `model.unarmed.glb` and `model.lod1.low.glb`; 21 of the 32 apparent source gaps were path-discovery errors.

`tools/assets/e25-emitter-repair.ts` applied existing native-exporter rules: keep a resolving target, otherwise identify its source material and nearest surviving rigid owner, then reference the surviving mesh batch. Existing empty vehicle reference arrays recover their authored full-detail target definitions and resolve those against the actual tier. Anonymous target meshes receive stable names. No geometry, materials, poses, animations or light settings changed. The optimizer now retains emitter bindings alongside gameplay pivots so future optimization preserves ownership.

The [reference repair receipt](evidence/reference-repair.json) records 356 files, 1,281 binding changes, zero unresolved targets and SHA-256 identity of every binary payload. Direct shipped-graph validation now reports **zero missing emitter references**. The strengthened audit finds **151 uncovered shipped emissive meshes / 165 uncovered authored emissive meshes**; this includes previously ignored anonymous meshes. The 11 exports with no matching source have fully resolving shipped graphs, so there is no unresolved source-substitution claim.

The focused asset-contract regression reached its production sample check; it exposed the general validator's old authored-substitution behavior. That validator now checks the shipped nodes directly. Final suite, visual comparison, and coverage repairs remain pending.
