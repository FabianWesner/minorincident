# L5 five survivor aftermath — asset delivery

2026-10-09. Five distinct canonical identities built and registered, all three authored tiers shipped. **Runtime acceptance blocked:** Scene Lab does not draw these identities because `src/render/npc/CivilianCrowd.ts:320` creates batches from a fixed list excluding all five. This needs the runtime lane to register the identities; no character renderer or mission logic was changed in this asset lane.

## Measurements

Production GLB bytes; materials = 3 at every tier. Draws count every animated owner/material primitive and are checked against the shipped base/member at the same tier. Caps: 15000 / 6000 / 2000 triangles.

| Asset | Tier | Triangles | Draws | Materials | Bytes |
|---|---|---:|---:|---:|---:|
| npc.dale.aftermath | LOD0 | 8618 | 19 | 3 | 185432 |
| npc.dale.aftermath | LOD1 | 3852 | 19 | 3 | 91584 |
| npc.dale.aftermath | LOD2 | 1330 | 18 | 3 | 43996 |
| npc.rosa.aftermath | LOD0 | 11838 | 21 | 3 | 239416 |
| npc.rosa.aftermath | LOD1 | 5908 | 21 | 3 | 130504 |
| npc.rosa.aftermath | LOD2 | 1990 | 19 | 3 | 55728 |
| npc.mr-okafor.aftermath | LOD0 | 12572 | 18 | 3 | 259152 |
| npc.mr-okafor.aftermath | LOD1 | 5528 | 18 | 3 | 121856 |
| npc.mr-okafor.aftermath | LOD2 | 1744 | 18 | 3 | 52384 |
| npc.mia.aftermath | LOD0 | 11248 | 19 | 3 | 236340 |
| npc.mia.aftermath | LOD1 | 4816 | 19 | 3 | 112312 |
| npc.mia.aftermath | LOD2 | 1804 | 19 | 3 | 52140 |
| npc.sam.aftermath | LOD0 | 9706 | 19 | 3 | 203736 |
| npc.sam.aftermath | LOD1 | 4204 | 19 | 3 | 98232 |
| npc.sam.aftermath | LOD2 | 1486 | 17 | 3 | 46636 |

## Derivation and contracts

- Dale isolates survivor03_root/glassesMan; Sam isolates survivor01_root/capMan. Neither exports the group. Rosa derives from npc.paramedic, Okafor from npc.civilian-elderly, Mia from npc.civilian-woman-a.
- Replays existing base anatomy recipes before legacy reduction. Explicit radial profiles, ring counts, bevel recipes and named trim omissions author each tier; no decimation or regeneration.
- Original 15 rigid limb owners and weaponSocketL/R/backpackSocket retained. Bandages merge under their limb owners. No body node, which would select animal animation clips. pal_skinWarm and pal_eyeBrown names retained for crowd classification; clothing/attachments use palette vertex colors on pal_picketWhite. No emissive eyes.
- Existing sourceScale applied once; root and front empty face +X, meters and ground Y=0. Character simulation physics remains the existing NPC contract. Escort, L6 identity continuity, placement and batching registration are runtime interfaces.
- Validator now checks animated-owner draws against the selected shipped member and corresponding LOD, also rejecting incompatible body nodes and lost skin/iris material classification. No integrated base budget widened.

## Visual review

Inspected all five authored-LOD contact sheets and the reference/LOD0/LOD1/LOD2/shipped-peer sheets at FOV25°, azimuth45°, polar0.30π, 135 and 190 px. All five retain living eyes without emission; all wraps survive far-tier simplification. No residual floating pack trim after Dale correction.

- Dale: denim workwear and forearm gauze read clearly; inherited large eyes/hair differ from the broader reference. Dark soot is lower contrast than the bandage on navy clothing. LOD2 hair and boots are noticeably angular.
- Rosa: medical shoulder emblems, stethoscope, uniform and wrap remain identifiable. Inherits navy trousers, gloves and ponytail from the shipped paramedic rather than cream reference trousers. Smoky hem and reduced far-tier hair are visible.
- Okafor: bent posture, cane, glasses, warm living face and forearm wrap retained. Shipped cap/argyle vest intentionally survive despite the bareheaded reference. Fine grey hair disappears at far distance; cap/cane and wrap remain.
- Mia: cream cardigan, red dress, bun and arm gauze remain readable. Flower density drops and skirt becomes angular in LOD2; hem grime is subdued on red and stronger at 190 px.
- Sam: cap, olive field jacket and pack distinguish him from Dale; hands empty, pale shin wrap visible in every tier. Broad dark chest soot is subtle under warm camera lighting; pack silhouette and jacket remain comparable to the shipped hunter.

These are independent-QA submissions, not orchestrator acceptance. The soot is a vertex-color treatment; it does not replace silhouette work on wreck/building batches.

## Evidence

Each `test-results/l5-five-survivor-aftermath/<id>/` contains `comparison.png/.jpg` (reference and all five turntable views), `lod-contact.png/.jpg` (all sides at matched LOD framing), `game-reference-peer.png/.jpg` (135/190px), and capture metadata. Widths ≤1600 px. Temporary individual turntable renders removed after composing sheets. JPG sheets copied to `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/` with identity filenames.

## Commands and outcomes

Executed sequentially for each of npc.dale.aftermath, npc.rosa.aftermath, npc.mr-okafor.aftermath, npc.mia.aftermath, npc.sam.aftermath:

```sh
npm run assets:build -- <id>
npm run assets:pack -- <id>
npm run assets:validate -- --ids <id>
E2E_PORT=3317 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --lod-contact --output test-results/l5-five-survivor-aftermath
E2E_PORT=3317 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --output test-results/l5-five-survivor-aftermath
```

Build/pack/selected validation: 5/5 successful, 15/15 tiers within budgets. LOD contact: 5/5 successful. Standard turntable: 0/5 exit success because the generic 10% minimum object-area coverage rejects narrow adult side views (5.3–11.0% across captures); all sheets and metadata were written and inspected. Threshold unchanged.

```sh
E2E_PORT=3317 sh tools/e2e-lock.sh npx tsx tools/assets/aftermath-review.ts test-results/l5-five-survivor-aftermath
SCENE_PORT=3317 sh tools/e2e-lock.sh npm run scene -- test-results/l5-five-survivor-aftermath/scene.json --out test-results/l5-five-survivor-aftermath/scene --size 1280x720
npm run assets:validate
npm run typecheck
npm run lint
sh tools/remote/run.sh . --pull test-results/l5-five-survivor-aftermath/unit-results.json -- npm run test:unit -- --maxWorkers=4 --reporter=json --outputFile=test-results/l5-five-survivor-aftermath/unit-results.json
```

- Game-reference-peer capture: 5/5 assets, all tiers and canonical peers load without placeholders.
- Scene Lab gate: **FAIL**, 2/3 checks pass. Console errors 0, far LOD close frames 0, undrawn frames 120 per actor. Five simulated actors and zero rendered actors. Screenshot and metrics retained as concrete runtime blocker evidence; no claim of gait acceptance.
- Full asset validation: 961/961 pass, zero fail.
- Typecheck and lint: pass.
- Unit tests: 392 passed, 0 failed, 125 suites (remote runner, maxWorkers=4).
- Rebuilt and repacked all five a second time: 30/30 source/production geometry hashes identical. Blender serialization bytes may differ slightly from floating-normal serialization; geometry determinism is preserved.
- Own preview server used port3317, headless Metal WebGL2 under shared lock. No WebGPU manual QA. No gameplay implementation, so no smoke/level-epic verify claim.

## Lane commits

- a6eef0e4: animated-owner draw validation.
- 9e0f8700: initial five canonical derivations and authored exports.
- 8bbc7728: merged newer main into this lane preserving both sides.
- Final corrective delivery commit: see lane HEAD (rig classification fixes, stronger grime, removed Dale floating trim, refreshed exports, evidence/tooling).

No push, merge into main, deployment, protected reference/spec edit, dependency addition, or runtime behavior change.
