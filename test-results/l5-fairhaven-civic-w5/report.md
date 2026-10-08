# L5 Fairhaven civic W5 delivery

Recovered the crashed run, committed its source/output state (144f2e18), merged five newer main commits into the lane (876fa8ff), and corrected pre-cut imported normals, outward soot winding and stale packed exports (f9305507). No merge into main, push or deployment.

Four base-owned variants are registered on integrated civic entries via decayVariants [w5]. Dotted IDs have build wrappers, notes and review records; they do not create conflicting runtime IDs. Each tier imports its matching integrated base GLB, makes authored cuts and batches material geometry under protected body/roof/interior/door owners. No decimation, rescaling, regenerated LODs, textures or dependencies were added. Baseline budgets were not widened.

| Variant | LOD | Triangles | Materials | Total asset draws | Production bytes | Source bytes | Footprint IoU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bld.apartment-block-a.w5 | 0 | 25,052 | 6 | 8 | 392,488 | 1,718,320 | 1.000000 |
| bld.apartment-block-a.w5 | 1 | 6,511 | 6 | 8 | 99,232 | 413,296 | 1.000000 |
| bld.apartment-block-a.w5 | 2 | 3,375 | 6 | 8 | 51,132 | 205,732 | 1.000000 |
| bld.apartment-block-b.w5 | 0 | 12,530 | 6 | 8 | 202,280 | 842,024 | 0.999859 |
| bld.apartment-block-b.w5 | 1 | 6,300 | 6 | 8 | 86,192 | 384,864 | 0.999879 |
| bld.apartment-block-b.w5 | 2 | 3,665 | 6 | 8 | 55,784 | 227,740 | 0.999879 |
| bld.town-hall.w5 | 0 | 10,888 | 6 | 7 | 182,380 | 748,952 | 0.997846 |
| bld.town-hall.w5 | 1 | 4,885 | 6 | 7 | 70,076 | 305,316 | 0.997846 |
| bld.town-hall.w5 | 2 | 2,705 | 6 | 7 | 43,344 | 171,888 | 0.997364 |
| bld.church.w5 | 0 | 13,255 | 6 | 8 | 194,628 | 893,944 | 1.000000 |
| bld.church.w5 | 1 | 5,196 | 6 | 8 | 75,952 | 328,848 | 1.000000 |
| bld.church.w5 | 2 | 2,894 | 6 | 8 | 45,004 | 184,708 | 1.000000 |

All root/body/roof/interior/door/front/nav/socket matrix comparisons are exact (delta 0). Measured AABBs remain within the original 1.5% manifest tolerance. Fixed physics and collider records are inherited. The church vestry_door, vestry_hide and sign_of_life sockets survive; the apartment stairwell sockets remain available. Roof-hidden views verify the cutaway ownership. Original colliders remain the runtime navigation contract; a visual breach is not a new traversable doorway.

Civic ss_light anchors retain their contracts with intensity zero; former emissive geometry is unlit and the required body_emi_windowGlow semantic node survives as an empty. Live survivor cues, fire, smoke, sunset switching, placement, sounds and mission behavior belong to the level/runtime lane.

## Validation commands and outcomes

For each base, sequentially: npm run assets:build -- <base> --decay w5; npm run assets:pack -- <base>; npm run assets:validate -- --ids <base>. All four builds/pack commands passed; all 24 selected base/variant tiers passed.

- npm run assets:validate: PASS — 847 tiers, zero errors.
- npm run typecheck: PASS — exit 0.
- npm run lint: PASS — exit 0.
- sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2: queued behind external occupied slots; outcome pending.
- npx tsx test-results/l5-fairhaven-civic-w5/measure.mts: PASS — 12 W5 tiers, all budget, dimension, matrix and footprint checks passed.
- E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- bld.apartment-block-a,bld.apartment-block-b,bld.town-hall,bld.church --decay w5 --lod-contact --output test-results/l5-fairhaven-civic-w5: PASS — 60 views.
- Same turntable command without --lod-contact: PASS — 20 views with coverage checks.
- E2E_PORT=3327 sh tools/e2e-lock.sh npx tsx test-results/l5-fairhaven-civic-w5/capture.mts: PASS — 24 variant game views plus 8 integrated-peer views, zero page/console errors. An initial local capture-script typo was corrected before the successful run.

One headless Metal WebGL2 browser at a time under the shared lock. Viewer draw counters include a presentation pass (one draw and one triangle); the table counts all actual asset primitives, including the moving door. Unit workers capped at two per the crash recovery instruction. No tools/remote/run.sh exists on this main revision. No runtime/gameplay or level epic implementation changed, so smoke and verify -- E23 were not run.

## Visual evidence and limits

Each folder below contains comparison.png (reference + all sides), lod-contact.png (matching LOD0/1/2 at five angles), game-reference-peer.png (reference | LOD0/1/2 | same integrated base at 135/190 px), cutaway.png, and capture metadata:
- test-results/l5-fairhaven-civic-w5/bld.apartment-block-a.w5/
- test-results/l5-fairhaven-civic-w5/bld.apartment-block-b.w5/
- test-results/l5-fairhaven-civic-w5/bld.town-hall.w5/
- test-results/l5-fairhaven-civic-w5/bld.church.w5/

All sheets are at most 1600 px wide. Required JPG copies are in /private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/. Temporary individual frames/debug scripts were removed. Per-asset review.md records the concrete visual comparison and limitations. At 135 px preview fog masks small burn/impact detail; large breaches carry the damage read. Back surfaces are cleaner and rubble less irregular than the references. These are reviewed asset deliveries; independent orchestrator acceptance remains pending.
