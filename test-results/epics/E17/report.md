# E17 closeout — PASS with explicit deferrals

Updated by lane/epic-gaps against main `a93caf8f` (including l6-hitch). Each verdict states its evidence or remaining deferral. No deployment; budgets and quality are unchanged.

| AC | Criterion | Main / closeout verdict | Test / evidence |
| --- | --- | --- | --- |
| E17-AC01 | `npm run assets:build -- <id>` runs headless Blender 5.2 (`BLENDER_BIN`), exits non-zero on any script error, and produces `<id>.glb` + `<id>.meta.json`; a second run gives an identical geometry hash (determinism) | PASS historical + current staged tests — acceptance.json records real Blender determinism; installed Blender 5.2.2 | `tests/unit/assets/commerce-pack.test.ts`<br>`tests/unit/assets/build.test.ts` |
| E17-AC02 | `npm run assets:validate` checks every manifest entry at status ≥ `modeled`: dimensions ± tolerance, required and animated nodes present and **not joined**, sockets, forward +X, triangle, material, and file-size budgets, materials restricted to `pal_*`/`emi_*`/`keep_*` with known tokens, no NaN or degenerate geometry | DEFERRED E24 — 1,024/1,025 delivery slots validate; the sole failure is D-SUBWAY.base.glb missing meshopt/quantization. No L6 asset was modified. | `tests/unit/assets/validate.test.ts`<br>`tests/unit/assets/optimize.test.ts`<br>`tests/unit/assets/build.test.ts`<br>`tests/e2e/asset-conformance.spec.ts` |
| E17-AC03 | The optimization keeps manifest nodes addressable: after `join`, every `requiredNodes` and `animatedNodes` entry still exists as its own node with its original pivot (world-space pivot delta ≤ 1 mm vs the raw export) | PASS — optimize node/pivot tests and fresh browser direction/conformance | `tests/unit/assets/runtime-integration.test.ts`<br>`tests/unit/assets/optimize.test.ts`<br>`tests/e2e/asset-conformance.spec.ts` |
| E17-AC04 | **Fire engine rebuilt in Blender:** `assets/veh.fire-engine/build.py` produces a GLB that matches the legacy spec dimensions (length 7.4, width 2.1, roof 3.55 ±5%), has nodes `body, wheel*, ladder, sirenL/R`, passes validate, and passes vision checklist C against `reference-upscaled.png` | PASS — dimensions/LOD tests, existing checklist C and fresh five-view turntable | `tests/unit/assets/build.test.ts`<br>`tests/e2e/turntable.spec.ts` |
| E17-AC05 | Every asset ID referenced by data (actions, infected, vehicles, districts, levels) exists in the manifest; a missing GLB falls back to its placeholder with an `asset.placeholder` log, never a crash | PASS — registry/reference tests and fresh deliberately missing-GLB fallback | `tests/unit/assets/runtime-integration.test.ts`<br>`tests/unit/assets/references.test.ts`<br>`tests/unit/assets/registry.test.ts`<br>`tests/e2e/turntable.spec.ts` |
| E17-AC06 | Inventory sync: every asset in the dated `05-asset-inventory.md` snapshot exists in the manifest at or above its snapshot status; the manifest records current integration status (parser test) | PASS — dated inventory parser test | `tests/unit/assets/validate.test.ts` |
| E17-AC07 | Crowd bake: a baked infected renders 100 instances in one draw call per material; the GPU-animated pose matches the node-hierarchy pose within 0.02 m per part at 5 sampled clip times | PASS — bake/pose tables and fresh 100-instance browser gate | `tests/unit/render/infected-bake.test.ts`<br>`tests/unit/assets/crowd.test.ts`<br>`tests/e2e/crowd.spec.ts` |
| E17-AC08 | Turntable: 5 images per asset rendered in the game renderer, the object covering 10–80% of the frame, plus a comparison sheet with the reference | DEFERRED reference only — all 305 modeled GLB entries have five full-canvas game-renderer views and comparison sheets; 304 have an authored/base reference. decay.burned-facade has no reference and needs an art/PO reference. | `tests/e2e/turntable.spec.ts` |
| E17-AC09 | Milestone production: all P0 assets ≥ `integrated` at M1, P1 at M2, P2 at M3, and no placeholder visible at the milestone's level photo spots (ID-pass check for the placeholder material) | DEFERRED production inventory — manifest now records actual delivery: 350 integrated, 25 reference, 16 placeholder. Pending IDs and photo-camera placeholder inventory are listed below; unfinished assets were not promoted to conceal missing production. | `tests/unit/assets/runtime-integration.test.ts`<br>`tests/unit/assets/production-gates.test.ts`<br>`tests/e2e/art-integration.spec.ts` |
| E17-AC10 | For each asset at `final`, `assets/<id>/review.md` exists with the vision checklist filled in, a pass verdict, and the comparison image path; assets marked `needs-human` are listed in the milestone report | PASS — all final assets checked by production-gates.test.ts; needs-human listing below | `tests/unit/assets/production-gates.test.ts` |
| E17-AC11 | Dismemberment readiness: every infected GLB contains its stump-cap nodes, hidden by default, and detaching a limb in the `gore-probe` scenario shows the cap with no visible holes (vision) | PASS — validator/cap tests and fresh three-model gore-probe visual inspection | `tests/unit/assets/optimize.test.ts`<br>`tests/unit/assets/production-gates.test.ts`<br>`tests/unit/assets/registry.test.ts`<br>`tests/e2e/asset-conformance.spec.ts` |

## Final validation (epic-gaps)

PO 10-09: single seed. E17–E24 multi-seed acceptance gates now use one seed with their gameplay thresholds preserved. Historical calibration tables remain historical. Fun/feel and visual scoring belong to the PO. Single complete-bot gates passed for L1 (seed 1, 106.37 s, zero deaths), L2 (seed 1, 137.62 s, zero deaths), and L4 (seed 3, unchanged 150–240 s band). No additional complete-bot battery was used as a gate.

- Typecheck, lint and production build: PASS.
- Remote unit + simulation: **927 passed, 0 failed**, 6 pre-existing E27 deferred cases (`test-results/epic-gaps/node-integrated.json`); no added skip/filter and no loosened assertions.
- Smoke: **6 Node + 26 browser tests passed** (`test-results/epic-gaps/smoke-node.json`, `smoke-browser.json`).
- Final level browser gate: **31/31 passed**, recorded in `test-results/epic-gaps/levels-browser-final.json`; Chromium headless, at most two workers. Native perf runs reserve both shared browser slots through `tools/perf/quiet-run.sh`.
- E17 five-view inventory **4/4 passed** and phase photo audit **1/1 passed**: `test-results/epic-gaps/turntables-final.json` and `photo-audit-final.json`.
- Main was merged; `lane/l6-hitch` was also merged to reuse its already validated preparation fixes (`dadc52de`, `f640dca5`, branch head `c889fc0b`). This lane adds no independent L6, lighting or VFX implementation.

Status is `done` under this job's rule: every non-deferred criterion passes. A DEFERRED verdict retains the original criterion and identifies the missing evidence or owning epic; it does not claim that the deferred work shipped. Reports supersede the initial epic-closeout verdicts preserved in Git history.

## Manifest truth and remaining production

Eight existing procedural implementations now carry `integrated` status and an actual `presentationSource`: fists, kick, HUD layout, corgi lure, adrenaline, shield bubble (both catalog names), and ground slam. Validation checks that implementation file; it does not demand a fictitious GLB. No modeled prop was downgraded or falsely promoted.

The following 41 entries remain genuinely unfinished (reference or placeholder). `manifest-audit.json` records each status. They are deferred production work for the relevant asset milestone/PO catalog cleanup; retired redesign entries still need an explicit catalog decision. This lane does not substitute sample checks for the entire inventory.

- `equip.backpack-teal` — reference
- `equip.backpack-red` — reference
- `equip.backpack-green` — reference
- `equip.backpack-blue` — reference
- `util.keys` — reference
- `util.batteries` — reference
- `util.lockpick-kit` — reference
- `haz.spike-barricade` — reference
- `haz.gas-can` — reference
- `haz.car-alarm` — reference
- `haz.fuse-box` — reference
- `haz.propane-tank` — reference
- `decal.footprints` — reference
- `decal.papers` — reference
- `ui.logo` — reference
- `ui.palette-swatches` — reference
- `proj.rocket` — reference
- `abl.turret` — reference
- `decay.downed-power-line` — reference
- `decay.fallen-tree` — reference
- `decay.body-bag` — reference
- `decay.graffiti` — reference
- `debris.wood-small` — placeholder
- `debris.metal` — placeholder
- `debris.glass` — placeholder
- `debris.rubble` — placeholder
- `amb.pigeon` — placeholder
- `amb.zebra` — placeholder
- `amb.elephant` — placeholder
- `gib.chunk-set` — reference
- `gib.limb-generic` — reference
- `decal.arterial-spray` — reference
- `bld.park-lodge` — placeholder
- `bld.zoo-gate` — placeholder
- `bld.reptile-house` — placeholder
- `prop.picnic-table` — placeholder
- `ability.turret` — placeholder
- `kit.house-variants` — placeholder
- `prop.cafe-patio-set` — placeholder
- `prop.garden-set` — placeholder
- `prop.alley-set` — placeholder

All 305 physical modeled/integrated GLB entries have five images and a comparison sheet in `turntables/`. The renderer is reused across the batch and releases each previous asset. Long or thin silhouettes adjust viewport/camera roll and distance; the final capture rejects geometry touching a canvas edge. Images remain full-canvas renders, with no image cropping or model/LOD changes. All references are real authored references or declared shared/base references. The only missing reference is `decay.burned-facade`, explicitly deferred to art/PO. There are zero `final` and zero `needs-human` entries: AC10 passes its current manifest scope, not production completeness.

`photo-assets.json` records runtime batch and dynamic placeholder IDs at level photo cameras, including authored checkpoint and timed observer setups (no completion bot). This is camera inventory evidence at those recorded states, not a claim about every gameplay tick. Visible nontrivial vehicles/characters, if any, remain listed for their owning production lane. No simple visible prop required a replacement, so no speculative Blender asset was created.

The 45 other integrated entries are UI/image, decal or ability presentations with no GLB, not missing modeled files. No integrated entry with a declared GLB was omitted from the 305-model batch.

## Photo-spot result

Final native headless Chrome Metal inventory: **156 distinct camera/state checks**, covering **936 W0–W5 camera aliases**, with **zero static and zero dynamic placeholders detected**. Start states and the listed later states of L1–L6 are included in `photo-assets.json`; each row records its staged checkpoint/observer setup, runtime checkpoint and tick. DistrictView registers the six wear aliases with identical camera poses, and camera selection does not change the loaded district wear; all equivalent names are retained for each checked view.

Visible placeholder asset list at these recorded photo states: **none**. No simple prop required replacement, so there is no new Blender model or changed LOD budget. This is runtime inventory at the recorded states; it does not replace the unfinished 41-entry production catalog or cover every gameplay tick. The 305-model turntable coverage is **10.10–70.99%**, with an explicit canvas-edge check and no image cropping.

The expanded photo fixture initially failed checkpoint reconstruction and browser-bot boarding; it now uses authored checkpoints, ordinary mission timers and a staged observer. A remote software-renderer attempt exceeded the 600 s harness timeout; the unchanged 600 s native Metal gate passed in 6.7 minutes. No assertion or quality setting was relaxed.
