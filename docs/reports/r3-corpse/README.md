# r3-corpse: stretched / spiky humanoid corpse panels (G-14 remainder)

Branch `lane/r3-corpse`. No deploy, no push. Sheet: `docs/reports/r3-corpse/before-after.jpg` (low tier WebGL2, overlap fixture z0.5; top row full frames, bottom row 2x crop of the dark-clothed cluster).

## Which models, and why

The G-14 ten-corpse fixture resolves (receipt `infected.model`) to cashier x4, bbq-dad x3, common-worker, delivery-driver, jogger. The "center-left dark-clothed corpse with broad pointed panels" is the **delivery-driver** (grey jacket/hood over a shirt); the "front dark-clothed corpse with sharp forearm/hand folds" is the common-worker (dark suit, bloody hands). The mom and bbq-dad bodies showed the same defect in the model sweep.

Not the shoulder/elbow joints being over-rotated in isolation, but the r2 pose search as a whole, measured with `tools/qa/r3-stretch.mjs` (worst skinned triangle edge, pose / bind length, visible parts only, no browser):

1. Every arm was swung to an absolute flat target: the driver's arm axis turned 81 degrees (down to the floor plus a 28/75/125 degree spread) about the shoulder, and legs 35-50 degrees about the hip. Garment panels owned by torso/arm/hip with hard single-joint seams tear apart on that swing (edges 2-5x). The crumple clip's 125 degree arms-beside-the-head were the worst (worker 3.7x).
2. Upright figures were "straightened" about the hip: the mom's rest hip-to-head joint line tilts 36 degrees, so the upper body (torso, head, arms) was bent 35 degrees against her legs; her dress/purse vertices on the torso ended 0.3-0.7 m from the thigh vertices next to them (x18). The head-end pitch search (up to 50 degrees) did the same to bodies thicker than 1 m (driver crumple).
3. Limb axes were taken from the vertex centroid of each limb. For the mom/driver that centroid includes forward-hanging garment or held items and pointed the leg axis 20 degrees off.

## Fix (`src/render/characters/deathPose.ts`)

- Per-limb turn is capped: arms 25 degrees, legs 12 degrees from their rest direction (Alphas unchanged, 180). Limb slope-to-floor capped at 30 degrees for ordinary humans.
- Arm spreads reduced: back 28 -> 20, side 75/20 -> 50/15, crumple 125 -> 40.
- Hip straighten only for Alphas or a rest spine tilt past 46 degrees (was 26); head-end pitch search only when the body is thicker than 1 m and it gains at least 10 cm (Alphas keep their search).
- Ordinary humans use joint-based limb axes (shoulder to wrist, hip to ankle); the vertex centroid stays for Alphas (their joints sit about 1 m from the mesh).
- Mesh, skin, files, budgets, corpse retention untouched. Idempotent as before.

## Numbers (`node --import tsx/esm tools/qa/r3-stretch.mjs`, worst edge ratio, back / side / crumple)

| model | before | after |
| --- | --- | --- |
| delivery-driver | 4.7 / 2.6 / 4.6 | 1.6 / 1.4 / 1.3 |
| common-worker | 2.2 / 2.9 / 3.7 | 1.5 / 1.9 / 1.5 |
| suburban-mom | 18 / 18 / 12 | 3.7 / 3.9 / 3.8 (head hair) |
| bathrobe-neighbor | 2.2 / 2.5 / 6.3 | 1.7 / 1.9 / 1.6 |
| firefighter, riot-cop, hazmat, nurse, jogger, cashier | 1.4-3.5 | 1.3-1.7 |
| bbq-dad | 9 / 10 / 15 | 5 / 5 / 4.8 (spatula vertices owned by the leg joint, an asset skin island) |

Flat poses held (`tools/qa/r2-bounds.mjs`, tops in m): driver 0.99 / 1.04 (table 0.96), firefighter 0.80 / 0.91 (0.94), riot cop 0.76 / 0.74 (0.94), mom 0.65 (0.97), bbq 0.67 / 0.72 (0.83), worker 0.53 (0.47), all floor-fitted within 2 cm. Alphas/Mega: heights unchanged. Corpses stay persistent (no removal code touched; 10 IDs retained at ticks 120 and 7320 in the fixture).

## What I saw (captures I opened)

- Before (low, WebGL2, overlap z0.5): the driver's torso is a pile of crossing dark and blue panels with a wide jacket flap sticking out sideways; the worker's hands end in sharp claws.
- After, WebGL2 low and high, WebGPU high, z0.5 overlap fixture: the driver reads as one body (jacket, sleeves and legs smooth, arms slightly raised); the worker's forearms and hands are blunt; the bbq dads keep apron, sleeves and a spatula in the raised hand (before: the spatula and apron spiked off the body). Remaining: the driver's chest still has some facet noise where it lies against the neighbouring cashier (see 2x crop), and the mom's ponytail/bun is the only stretched edge left.
- Model sweep (corpse-sweep, corpse-z15-0, high WebGL2): nothing regressed; Alphas unchanged (blobby face-down mounds).
- Not seen: WebGPU low after the last tweak, zoom 1.5 close-ups of the mom and bathrobe in the real level.

## Checks

`npx tsc --noEmit` pass; `npm run lint` pass; `npm test` 107 pass (stretch assertions folded into the existing r2-corpse contract in `tests/shared/render-contracts.test.ts`); `npm run scene:gate` 50/50 rows pass (8.0 min).

## Tools

`tools/qa/r3-stretch.mjs` (per-model stretch, `--model=`, `--dump`, `--hist`, `--raw` = authored clip), `tools/qa/r3-cluster.mjs` (G14 fixture with a free camera, `CAM=px,py,pz,tx,ty,tz`), `tools/qa/r3-sheet.py`, `BACKEND=webgpu` on `tools/qa/blk-v-captures.mjs`.
