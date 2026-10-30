# q257 — adult heights, Dale atlas binding and coffee grips

## Changes

Healthy adults now share the heroine’s measured height class: women **1.454 m**, men **1.570 m** (+8%), elderly man **1.492 m** (male × 0.95). Both children retain their PROD heights. Mia, Sam, Rosa, Dale and Mr. Okafor were 1.800 m on PROD, outside the requested heroine-relative class, so they use the corresponding adult class. Lab-tech A is male; lab-tech B and the depot clerk are female, as authored in their build scripts.

The q249 authored-size flag bypassed the old civilian fitter. Restored uniform fitting and rebuilt all **78 delivered civilian GPU bakes** (26 figures × 3 LODs); changing the loader alone does not change those already delivered files. CharacterView applies the same female/male class to playable outfits. Uniform whole-figure scaling preserves the approved head ratios, shoulders and anatomy; no GLB, UV or texture pixels were changed.

Dale’s source atlases were correct. The mixed cast reused one material while rebinding different atlas and pose textures. Each atlas now owns its material binding; the shader program can still be shared. Dale’s hair and blue shirt remain correct beside the other survivors in production L5.

Coffee reach now accounts for the reduced fingertip envelope on woman-a and man-b at near/normal LODs. [Rendered contact measurements](grips/rendered-contact.json) use the actual weighted GPU hand vertices, current pose and mug triangles: woman-a **0.96/0.65 mm**, man-b **1.11/1.81 mm** clearance at LOD0/1. The handles meet the hands with a small skin margin.

## Height census

[Every human figure: PROD / main / after](height-census.md) and [exact values, ground planes, delivery paths and all LODs](height-census.json). PROD batch 40 is `fd8f56ca3`; pre-fix main is `73a855ef6`. The census reads the actual encoded delivery geometry, including offline normalization, and covers **71 figures**, with **zero healthy adult class or child preservation errors**. Infected archetypes retain their authored size/pose distinctions; unused legacy models are identified separately.

| Figure | PROD 40 (m) | main (m) | after (m) |
|---|---:|---:|---:|
| Heroine | 1.454 | 1.454 | 1.454 |
| Depot clerk | 1.800 | 1.281 | 1.454 |
| Lab-tech A / B | 1.800 / 1.800 | 1.240 / 1.150 | 1.570 / 1.454 |
| Dale | 1.800 | 1.429 | 1.570 |
| Mia / Sam | 1.800 / 1.800 | 1.285 / 1.444 | 1.454 / 1.570 |
| Rosa / Mr. Okafor | 1.800 / 1.800 | 1.371 / 1.529 | 1.454 / 1.570 |
| Elderly man | 1.800 | 1.339 | 1.492 |
| Child / brother | 1.474 / 1.427 | 1.474 / 1.427 | 1.474 / 1.427 |

## Visual review

Opened the supplied batch-41 lineup, depot and Dale evidence. Captured exact main and final output through the headless shared browser pool. Inspected all five final side lineups with the heroine, both quality tiers, and the corpse lineups. [Lineup 1 comparison](visual/lineup-1-main-vs-after.jpg), [lineup 2 comparison](visual/lineup-2-main-vs-after.jpg), [L1 depot comparison](visual/l1-depot-main-vs-after.jpg) show main above after. The clerk now belongs to the heroine’s class; men consistently exceed it. Original children are preserved.

Inspected Dale alone at LOD0/1/2 in [high](visual/after-high/dale-lod1.jpg) and [low](visual/after-low/dale-lod1.jpg), then in the actual L5 mixed survivor scene ([high](visual/after-high/l5-dale-45.jpg), [low](visual/after-low/l5-dale-45.jpg)). His blue shirt and dark hair are intact. Coffee captures at all three LODs are in both final quality folders; near/normal contacts are measured above.

All 26 resized adult figures were infected and killed through Scene Lab, then allowed 180 frames to settle. Grounding receipts and the five corpse screenshots per quality tier record zero corpse ground offset ([summary](visual/grounding-summary.json)).

## Validation

- `npm test`: **110/110**, 26 files; repository case budget **150/150** ([log](qa/npm-test.log)).
- `npm run typecheck` and `npm run lint`: pass ([typecheck](qa/typecheck.log), [lint](qa/lint.log)).
- Height census: **71 figures, 0 errors** ([log](qa/height-census.log)).
- Rerun q249 audit: **65 adult variants / 68 figures / 394 files / 0 errors** ([audit](q249-audit.json), [log](qa/head-audit.log)); caps remain head/height ≤ 0.299787 and head width/shoulders ≤ 0.959122.
- Headless high/low screenshots: no browser errors; [grounding summary](visual/grounding-summary.json) records 26 corpses per tier, maximum offset **0 cm**.
- `npm run test:smoke`: **6 QA cases + 1 public case pass**, 147.8 s / 240 s. Portable GPU limits pass on WebGL2 and WebGPU; the handover/outbreak/gear shader warm-up guard passes with no late builds ([log](qa/smoke.log)).
- `npm run scene:gate`: **48/48 pass, 0 known failures, 0 not run**, 3.6 min across WebGL2/WebGPU and high/low ([summary](qa/scene-gate/summary.md), [log](qa/scene-gate.log)).

## Reproduce

```sh
node --import tsx tools/q257/rebuild-civilians.ts
node --import tsx tools/q257/height-census.ts
node --import tsx tools/q249/audit-rollout.ts docs/reports/q257/q249-audit.json
npm run build:qa
SCENE_SERVER=preview SCENE_PORT=3373 node --import tsx tools/q257/capture.ts after high
SCENE_SERVER=preview SCENE_PORT=3374 node --import tsx tools/q257/capture.ts after low
SCENE_PORT=3373 node --import tsx tools/q257/grip-audit.ts
npm test
E2E_PORT=3377 npm run test:smoke
SCENE_PORT=3376 npm run scene:gate -- --out docs/reports/q257/qa/scene-gate --jobs 2
```

Only one temporary baseline source copy was used (1.0 GB), then removed; final disk free space is 17 GB. No port 3300, deployment or GitHub operation was used.
