# L3 Oak Avenue D/E houses delivery

All five requested IDs delivered on the scheduler lane. Four building siblings are base-owned W2/W3 variants; the fire dressing is a canonical prop. Independent orchestrator visual acceptance remains pending.

## Measured production tiers

| Asset | LOD | Triangles | Draws | Materials | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| bld.house-d.w2 | 0 | 14,276 | 6 | 2 | 184,992 |
| bld.house-d.w2 | 1 | 10,360 | 6 | 2 | 139,420 |
| bld.house-d.w2 | 2 | 3,868 | 6 | 2 | 65,616 |
| bld.house-d.w3 | 0 | 10,988 | 6 | 2 | 146,712 |
| bld.house-d.w3 | 1 | 10,444 | 6 | 2 | 138,928 |
| bld.house-d.w3 | 2 | 3,872 | 6 | 2 | 64,872 |
| bld.house-e.w2 | 0 | 7,968 | 6 | 2 | 107,188 |
| bld.house-e.w2 | 1 | 6,700 | 6 | 2 | 92,560 |
| bld.house-e.w2 | 2 | 2,648 | 6 | 2 | 45,952 |
| bld.house-e.w3 | 0 | 6,878 | 6 | 2 | 94,724 |
| bld.house-e.w3 | 1 | 6,708 | 6 | 2 | 92,256 |
| bld.house-e.w3 | 2 | 2,632 | 6 | 2 | 45,560 |
| decay.burned-facade.house | 0 | 727 | 6 | 6 | 18,216 |
| decay.burned-facade.house | 1 | 212 | 5 | 5 | 8,192 |
| decay.burned-facade.house | 2 | 152 | 5 | 5 | 7,260 |

All caps enforced by the manifest: houses 30,000 / 12,000 / 4,000 triangles, <=8 draws; facade 1,500 / 600 / 200, <=8 draws. House variants use two palette materials plus per-owner vertex colors; no new textures/dependencies. The original integrated base budgets and detailed LOD0 GLBs are unchanged. Their previously decimated distance tiers were replaced with explicit source recipes and seven draws.

## Geometry, contracts and review

All house tiers preserve the exact root, roof, interior, door_front, entrySocket, front and col:house matrices (maximum delta 0). Rasterized union of projected production triangles at 512 px gives footprint IoU >=0.9977 for every twin/tier (D: 0.99995; E: 0.99773 near, 0.99971 far). No variant was fitted/scaled to a new AABB. See footprint-checks.json and the footprint sheets. All five repeated builds have identical geometry hashes; see determinism.json.

Roof/interior cutaway ownership and the door hinge stay separate. W2 boards, a broken pane and entry belongings survive all tiers. W3 has jagged dark openings, local soot and splintered sill accents, with outward polygon winding on every facade. No collapse/rubble. Fixed ss_physics and collider records survive; window light intensities are disabled for broken/boarded panes while porch lamps retain stable emissive links.

Game-camera review uses FOV25, azimuth45, polar54; model heights are 122–131 px, with identical framing across LOD0/1/2. References, all sides and these small views were inspected. Concrete limitations: native roof tiles/flower density are simplified, far shrubs are faceted, and far sash bars are omitted. The E reference/base has no garage; exact base footprint and porch/gable forms take precedence over inventing one. The fire reference depicts a devastated whole house, whereas the brief asks for a localized standing fire patch, so the delivered asset is a shallow wall section with an intact roof-edge strip.

Facade standard turntable saves all captures but exits 1 because its legitimate edge-on views occupy only 2.57% / 2.79%, below the generic 10% volume heuristic. Front/rear/game views occupy 46.47% / 46.59% / 14.81%. No validator/render/load error accompanies this exception. Its LOD contact command passes. Its clean rear is intended to mount against the host wall. This harness exception is the remaining QA deviation.

## Interface for runtime lanes

Place each twin with its exact base transform; entrySocket is the entrance/nav anchor, door_front the hinge, and roof/interior the cutaway owners. The fire dressing exports mountSocket (mounting back, +X outward) and windowSocket (opening centre), fixed physics and col:body. Placement, NPC/mission behavior, smoke, sound and power switching remain with level/runtime lanes.

## Commands and validation

Executed sequentially per base:

```sh
python3 tools/blender/run.py assets/bld.house-d/build.py --distance-tier 1 --glb assets/bld.house-d/model.lod1.glb
python3 tools/blender/run.py assets/bld.house-d/build.py --distance-tier 2 --glb assets/bld.house-d/model.lod2.glb
python3 tools/blender/run.py assets/bld.house-e/build.py --distance-tier 1 --glb assets/bld.house-e/model.lod1.glb
python3 tools/blender/run.py assets/bld.house-e/build.py --distance-tier 2 --glb assets/bld.house-e/model.lod2.glb
npm run assets:build -- bld.house-d --decay w2
npm run assets:build -- bld.house-d --decay w3
npm run assets:pack -- bld.house-d
npm run assets:validate -- --ids bld.house-d
npm run assets:build -- bld.house-e --decay w2
npm run assets:build -- bld.house-e --decay w3
npm run assets:pack -- bld.house-e
npm run assets:validate -- --ids bld.house-e
npm run assets:build -- decay.burned-facade.house
npm run assets:pack -- decay.burned-facade.house
npm run assets:validate -- --ids decay.burned-facade.house
npx tsx tools/assets/physics-metadata.ts
npm run assets:validate
npm run typecheck
npm run lint
sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=4
npm run build
E2E_PORT=3347 npm run test:smoke
```

Blender 5.2.2 runs headless, three threads via the shared runner. All browser captures were headless Metal WebGL2 through tools/e2e-lock.sh; one browser worker for sheets, <=2 for smoke. WebGPU manual checking was not performed. No level epic/runtime gameplay implementation was added, so verify -- E21 was not run.

Final merged-lane validation: 778 records, zero failures; typecheck and lint exit 0; unit suite 343/343 tests in 98/98 files passes. The initially stale generated physics registry was rebuilt to include the canonical fire dressing. Smoke simulation: 6 passed / 816 skipped (5 files passed / 152 skipped). Browser smoke: 25/25 passed with two workers (Chromium, mobile Chromium profiles and WebKit). The combined `E2E_PORT=3347 npm run test:smoke` completed its sim part then failed because the QA preview already occupied 3347. The lane-owned QA preview was stopped and the browser part was run directly with `E2E_PORT=3347 sh tools/e2e-lock.sh npx playwright test --grep @smoke`; it passes. A redundant queued simulation rerun was canceled before execution because its same checks had already passed. See smoke-sim.log and smoke-browser.log. All lane-started servers/processes are stopped.

Capture command for each house sibling used both forms:

```sh
E2E_PORT=3347 sh tools/e2e-lock.sh npm run assets:turntable -- <base> --decay <w2|w3> --lod-contact --output test-results/l3-oak-houses-de
E2E_PORT=3347 sh tools/e2e-lock.sh npm run assets:turntable -- <base> --decay <w2|w3> --output test-results/l3-oak-houses-de
E2E_PORT=3347 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade.house --lod-contact --output test-results/l3-oak-houses-de
E2E_PORT=3347 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade.house --output test-results/l3-oak-houses-de
```

## Evidence paths

- `bld.house-d.w2/lod-contact.png`, `bld.house-d.w2/comparison.png`, `bld.house-d.w2/game-camera.png` (plus `footprint.png` / `cutaway.png`)
- `bld.house-d.w3/lod-contact.png`, `bld.house-d.w3/comparison.png`, `bld.house-d.w3/game-camera.png` (plus `footprint.png` / `cutaway.png`)
- `bld.house-e.w2/lod-contact.png`, `bld.house-e.w2/comparison.png`, `bld.house-e.w2/game-camera.png` (plus `footprint.png` / `cutaway.png`)
- `bld.house-e.w3/lod-contact.png`, `bld.house-e.w3/comparison.png`, `bld.house-e.w3/game-camera.png` (plus `footprint.png` / `cutaway.png`)
- `decay.burned-facade.house/lod-contact.png`, `decay.burned-facade.house/comparison.png`, `decay.burned-facade.house/game-camera.png`

All sheets are <=1440 px wide; temporary single frames/videos/build stages were removed. Metrics, anchors, footprint checks, deterministic hashes and load metadata are retained alongside the sheets.

## Lane commits

- `dbc932d3`: authored native D/E distance recipes, four variants, facade, contracts and production outputs.
- `58353d01`: merge current main into this lane, preserving both manifest/physics additions.
- Final QA commit: `git log -1` after this report is committed. No push, merge into main or deployment.
