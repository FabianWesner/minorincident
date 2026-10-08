# L2/L3 asset QA revision — historical sandbox block

Superseded by [the completed rebuild report](art-l2l3-qa.md). Blender execution and Git writes now work; this file preserves the prior sandbox diagnosis.

The source recipes have been revised following Opus's independent QA. These edits are **not a completed asset delivery**: the committed runtime GLBs and contact sheets still show the previous revision.

## Source changes

- Fire station: populated turnout lockers, helmets/jackets/boots, hose coils and rack, pole, tools/workbench, SCBA, dispatch monitors, kitchen seating, coffee machine, notice board, drain, closed slatted door and rolled open bay door, signage and ceiling light anchors. The central truck aisle remains clear.
- Three sedan wrecks: stronger front compression, removed driver-side doors, black exposed cabin, scorch panels, detached bumper, folded door debris and glass scatter, collapsed front tire, police beacon damage. The original sedan sources are retained.
- Army checkpoint: more concrete segments, ring sandbag nests and mounted MGs, boom gate, additional floodlight anchors and tent. Existing razor coils are retained.
- Looted store: plain authored shelves plus toppled shelf, loose boxes, cans and bottles. Scatter counts and radial sides are selected explicitly per LOD.

No generic decimation was introduced. No specs or accepted asset recipes were changed.

## Blocking environment

- `npm run assets:build -- int.fire-station-bay` fails because the tsx CLI cannot create its IPC socket (`EPERM`). `node --import tsx tools/assets/build.ts int.fire-station-bay` avoids that socket but Blender crashes in `gpu::MTLBackend::metal_is_supported` before loading Python.
- An OpenGL startup attempt fails: the installed Blender accepts only the Metal backend.
- `git add tools/blender/sslib/rescue_assets.py tools/blender/sslib/rescue_wrecks.py` fails creating `.git/worktrees/art-l2l3/index.lock` (`Operation not permitted`). The QA job grants read-only access to the Git metadata.

## Resume in the normal asset lane environment

1. Build the interior, checkpoint and looted store through the existing asset build commands. The checkpoint and store footprints grew: replace their manifest dimensions with measured `lod-stats.json` dimensions before publishing through validation; do not weaken tolerances.
2. Build each sedan with `--decay wrecked`. Check the police beacon geometry and collapsed tire orientation visually. If distant blue wreck exceeds its 2k cap, remove a small authored fitting, retaining the damage silhouette.
3. Regenerate light and physics metadata, pack outputs and validate every tier against the existing hard authored caps.
4. Redo and inspect the six LOD contact sheets under `test-results/art-l2l3/`. No new visual QA verdict or triangle table is available until these builds complete.
5. Run required validation and commit the reviewed recipe, manifest, metadata and GLB changes. Opus's independent QA is still pending.

## Validation in this sandbox

- npm run typecheck: PASS.
- npm run lint: PASS.
- node --import tsx tools/assets/validate.ts: PASS, 721 checks / 0 failures, previous runtime GLBs only.
- npm run test:unit -- --maxWorkers=4: config bundling blocked writing shared node_modules/.vite-temp.
- npm run test:unit -- --maxWorkers=4 --configLoader runner: 86 files passed / 1 failed; 283 tests passed / 1 failed. Preview setup cannot listen on localhost:3302 (EPERM).
- Python AST parsing and git diff --check: PASS.
