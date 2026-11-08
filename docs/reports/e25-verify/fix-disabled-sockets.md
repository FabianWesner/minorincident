# Disabled light sockets and validator coverage

The original `assets:lights --check` reported 361 anchors / 94 assets / zero errors, but ignored `light:*` nodes with no `ss_light` and the general asset validator never checked the light contract.

A complete shipped-export scan found 339 disabled sockets retaining the reserved `light:` name (including decay variants and all LODs). Their decay builders intentionally removed the emitting records. The shared exporter now names those dead sockets `disabled:*`; the existing 75 shipped GLBs and 75 authored counterparts received the same name-only edit. All other JSON fields and every binary payload byte are identical, recorded in [anchor-glb-identity.json](evidence/anchor-glb-identity.json).

Both the light-table extractor and the general asset validator reject a named light without metadata. The asset gate additionally checks the existing parser's palette/intensity/spot-range rules and emitter references/coverage. Regression cases extend the existing asset-contract test; no test case was added to the suite count.

The change leaves rendering code and material data untouched. The initial eight lab/asset before/after views were byte-identical. Paused native L1/L2/L4 views also have zero changed pixels; a fresh-page L5 pair, after 20 paused redraws with fixed node time and deterministic depth/order tie breaks, has zero changed pixels. See [capture-identity.json](evidence/capture-identity.json), [accepted-frozen-identity.json](evidence/accepted-frozen-identity.json) and [l5-fresh-identity.json](evidence/l5-fresh-identity.json). Earlier unfrozen captures retained character/particle differences; they are not used to claim identity.

AC02 remains open: the full authored-LOD audit finds additional stale emitter references, and the newly enforced general gate exposes 36 fire-engine emitter-coverage failures across three LODs. These are genuine remaining contract gaps. No decorative exemption or acceptance threshold was added to silence them.

Follow-up: the fire-engine coverage failures were repaired in [the next fix](fix-fire-engine.md). The final exhaustive inventory and remaining failures are in [README](README.md).
