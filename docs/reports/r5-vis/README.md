# r5-vis — vqa58 visual findings

Base: `8b7a1fa0` (batch 58). Local changes only; no deployment or push. Scope is the six findings in the lane brief.

## Changes and findings

| Finding | Cause and result | Commit |
| --- | --- | --- |
| L1 corpse against a raised planter | The flat-body search checked three centreline points and tolerated a 30 cm floor difference against the original feet. A 13 cm kerb could bury the torso while leaving bent legs visible. Check the supporting floor across the capsule width against the candidate root floor, with a 5 cm tolerance, including the narrow-door fallback. Bodies settle fully on one surface or slide off the edge. If surrounding solids prevent every slide, the last-resort flat pose clears the highest sampled support. | `de637d35`, `1a069bd8` |
| Dead brute threat rings | Warning cleanup ran in `Vfx.advance()`, which pauses with presentation time. Staged sim steps and redraws could leave dead-source warnings visible indefinitely. Retire warnings from `updateSpecialState()` using source health/corpse state; do not restore dead windups. Preserve the real bloater death countdown. `cheats.killAll()` is unchanged. | `ebe9ce4a` |
| L3 triangle through checkpoint geometry | The arrow material disabled depth testing. Enable it, as for the objective ring. The objective anchor and trigger are unchanged. | `48467da8` |
| L4 corpse across registration rope posts | Not reproduced in the targeted registration fixture: 24 killed runners beside the actual table/rope rows, 11 actual rope posts, both backends and tiers. Opened all eight frames; no obvious post penetration. A triangle/AABB separating-axis probe reports zero intersections in all four runs, including a crossing control with every triangle vertex outside the box. No separate post-placement change. | — |
| L9 first-photo stall | Reproduced at tick 9: acceptance photos pause the clock, then request high terrain whose production upload gate waits until four seconds of play. `test=1` staged scenes bypass that gate and had hidden the problem. Capture the opening frame without readiness waits and defer the tier matrix until tick 300 (timing runs retain tick 600). Real-input replay advances through the matrix and driving. | `ed21cd98` |
| L1 fresh bat pin / unhittable runners | The original 208-second pin did not reproduce in two fresh real-input runs before the route change. A concrete driver gap existed: its four-metre “near ring” band disabled route recovery before actual arrival at 1.2 m. Recovery now remains available until arrival. A third fresh run completes with the fix. Physical bat inputs at the reported position land hits; no melee simulation change was justified. | `15f30186` |

The floor and warning fixes are shared across levels. A further pinned-body regression failed with y = 0 before the last-resort correction and passes at y = 0.35 afterward. Regression fixtures cover 13 cm, 35 cm and 60 cm steps, including forced narrow-door fallback, and paused death cleanup/live warnings/bloater countdown. The arrow material has a depth-test assertion. These extend existing tests within the repository test budget.

## Real-input evidence

Courier god mode follows the original QA method. Route runs use physical keyboard/mouse input; logged navigation assists locate a route and walk it with keys. No objective skipping.

| Run under `test-results/vqa58/` | Result |
| --- | --- |
| `r5-l9-repro/` | Reproduced initial-photo wait at tick 9; cancelled the owned session after tracing the clock/upload dependency. |
| `r5-l9-capture-fix/` | Photos complete at tick 312, including high quality. 66 simulated seconds in the 75-second sample, zero deaths; APC moves from x −550 to approximately x 89. This is a stall check, not a full L9 completion. |
| `r5-l1-bat-repro/` | Fresh WebGL2 low, zoom 1: completes L1 in 153 simulated / 178 wall seconds, zero deaths; maximum no-progress interval 19.8 seconds. |
| `r5-l1-bat-z15-before/` | Fresh WebGL2 low, zoom 1.5, old near-ring guard: completes in 141 simulated / 169 wall seconds, zero deaths; maximum pause 13.7 seconds. Combat audit records 10 player hits, three near the station. |
| `r5-l1-bat-z15-after/` | Same setup with recovery fix: completes in 162 simulated / 190 wall seconds, zero deaths; maximum pause 13.0 seconds. Combat audit records 19 player hits, three near the station. Opened `L1-t9701.jpg`: objective checked, courier and corgi inside the bay, active runners outside. |

`tools/qa/r5-vis-bat.ts` stages the reported station position (−75, 38.7), equips the bat and places six runners nearby, then attacks exclusively with real mouse input. `test-results/r5-vis/bat-contact/receipt.json`: 26 attacks, 13 hits and seven kill/down events. Opened `physical-swings.jpg`. The setup is staged; the swings are not injected combat events. Fresh route completion and recorded hits do not establish the exact cause of the old run’s reported “enemy-unhittable” message.

## Opened visual evidence

All images remain git-ignored under `test-results/`. Every matrix below includes WebGL2/WebGPU, low/high and zoom 1/1.5, unless explicitly labelled as an extra inspection angle.

- **Corpses:** `r5-vis/before/`, `r5-vis/matrix/`, `r5-vis/final-matrix/`, and final post-fallback `r5-vis/post-fallback-matrix/`. Ring, overlap pile, runners/brutes and Alpha in L1/L3/L7/L10. L1 bodies lie across the pavement with their torsos visible, rather than vanishing under the raised kerb. Bent knees remain part of the authored death pose. The dead brutes have no red warning circles. L7’s ash and L10’s dark apron retain readable body silhouettes.
- **Floor diagnostics:** `r5-vis/corpses-before/L1-webgpu-high.json` found 71 frozen vertices buried 13 cm on one body and 13 vertices buried approximately 9 cm on another. `r5-vis/corpses-after/L1-webgpu-high.json` checks all 16 staged bodies: zero vertices more than 8 cm below their support surface. `r5-vis/diagnostics/L10-webgpu-high.json` has no telegraphs while FX time remains zero.
- **L3 marker:** `r5-vis/marker-depth/` includes the normal follow-camera matrix and before/after material toggles. The ordinary arrival views can see over the obstruction, so those alone do not demonstrate occlusion. Extra low inspection-angle A/B frames on all four backend/tier combinations show the old yellow triangle drawn over the foreground evacuation coach; with depth testing it disappears behind the coach. The same depth rule applies to checkpoint walls. These extra inspection angles are not labelled as player zoom captures.
- **Registration:** `r5-vis/details/L4-registration-corpses-*` and its four receipts. Bodies spread beside the rope rows and tables; upright posts remain visible between them. Zero frozen vertices inside the 11 post AABBs; the stronger `r5-vis/registration-triangles/` receipts also report zero triangle/AABB intersections in all four combinations. A projection overlap in the original frame remains possible; its precise corpse state was unavailable here.
- **L9:** `r5-vis/l9-final/` and opened `r5-vis/sheets/L9-final.jpg`. Actual recorded camera zoom is 1 / 1.5; story pulls were excluded because they neutralize player zoom. APC damaged to 200/1000 health (stage 3) emits a visible rising pale-grey smoke column. The roadside six-runner pack is visible and spatially separate from the APC. Both backends and tiers match closely. The ordinary approach frame shows verge wrecks and road debris; an extra `r5-vis/l9-overview/L9-convoy-overview-webgpu-high.jpg` supplies wider context: damaged APC, military truck, school bus, cars and red pickup are visible around the broken approach, without an obvious vehicle overlap.

### L9 visual glitches / limitations

- Smoke puffs have coarse polygonal outlines, especially at the wider framing; the column is pale rather than dense/dark.
- The six roadside runners repeat the same dark worker-like silhouette, producing a visually repetitive group. No palette corruption was seen.
- The normal approach camera crops some verge vehicles; the overview is an inspection camera, not a change to gameplay framing.
- The 75-second real-input sample crosses a sparse dark field. This lane fixes the photo deadlock and inspects the requested subjects; it does not establish full L9 mission acceptance.

## Validation

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 27 files / 107 tests. An earlier run while source was uncommitted failed the review-freshness assertion; it passes with the source commits in place.
- `npm test -- tests/shared/render-contracts.test.ts`: PASS, 14 tests.
- `npm run build:qa`: PASS.
- `npm run verify -- E07`: PASS; the repository’s current epic verifier runs typecheck, lint and the shared/engine unit gate (`test-results/epics/E07/checks.json`).
- `npm run scene:gate`: PASS, 50/50 on the final runtime source, 7.5 minutes (`r5-vis/scene-gate-complete/`). The preceding stable-source run also passed 50/50. An earlier 49/50 was one execution-context destruction during a source/HMR edit.
- `qa:threat`: completed remote split runs covering all ten levels. All ten skilled routes complete; all passive checks have zero flags. Selective invocations exit 1 solely for `PARTIAL_LEVEL_SELECTION`, rather than representing a complete single-command gate. L4 has one skilled diagnostic: `wave/breach-north:WAVE_FIRST_ATTACK_OVER_20_SECONDS` (38.58 s); its passive checks and high hold pass. The same diagnostic is archived in `docs/reports/sweep-c5/threat-L1-L5/L4.json`. This lane leaves `src/sim`, `src/data`, `src/levels`, the native runner and threat policy unchanged from the base. The all-level and initial eight-level attempts exceeded the 600-second reservation; the final split audits each finish within the budget.

### Remote threat receipts

Receipts are under `test-results/r5-vis/<batch>/`. Audit seconds: L3 141.2, L4 299.6, L5 375.9, L7 105.2, L10 162.8, small 112.2. L3 army-line seeds 1–3 pass; L5/L7 skilled and passive follower-pace seeds 1–3 have zero flags.

| Level | Batch | Skilled / passive flags | Native state hash |
| --- | --- | --- | --- |
| L1 | `threat-small` | 0 / 0 | `faa7b2d3` |
| L2 | `threat-small` | 0 / 0 | `8a3e72af` |
| L3 | `threat-L3` | 0 / 0 | `5604a575` |
| L4 | `threat-L4` | 1 / 0 | `a873a819` |
| L5 | `threat-L5` | 0 / 0 | `4b908b40` |
| L6 | `threat-small` | 0 / 0 | `fcc92418` |
| L7 | `threat-L7` | 0 / 0 | `63d74db6` |
| L8 | `threat-small` | 0 / 0 | `b1b9cd1a` |
| L9 | `threat-small` | 0 / 0 | `16a15ab1` |
| L10 | `threat-L10` | 0 / 0 | `1b9f8082` |

## Reproduction commands

```sh
# Final corpse view matrix
VQA_OUT=test-results/r5-vis/post-fallback-matrix VQA_PARTS=corpses \
VQA_CORPSE_LEVELS=L1,L3,L7,L10 SCENE_PORT=3368 E2E_UNITS=1 \
sh tools/e2e-lock.sh node --import tsx tools/qa/vqa58-spots.ts

# Frozen-body floor diagnostics (repeat backend/tier and L1/L10 as needed)
VQA_OUT=test-results/r5-vis/corpses-after SCENE_PORT=3368 E2E_UNITS=1 \
sh tools/e2e-lock.sh node --import tsx tools/qa/r5-vis-corpses.ts webgpu high L1

# Targeted production views (repeat all backend/tier combinations)
VQA_OUT=test-results/r5-vis/details VQA_PARTS=l3,l4,l9 SCENE_PORT=3368 E2E_UNITS=1 \
sh tools/e2e-lock.sh node --import tsx tools/qa/r5-vis-details.ts webgl2 low

# Bat contact probe
SCENE_PORT=3368 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/r5-vis-bat.ts

# Full fresh run
PLAYTEST_REVEAL_AUDIT=1 PLAYTEST_COMBAT_AUDIT=1 PLAYTEST_SHOT_SECONDS=20 \
VQA_LEVEL_MINUTES=8 node --import tsx tools/qa/vqa58-run.ts \
L1 low webgl2 1.5 fresh r5-l1-bat-z15-after 420 weapon.bat

# Remote threat audit (repeat with the level groups and batch names above)
sh tools/remote/run.sh "$PWD" --pull test-results/r5-vis/threat-L4 -- \
npm run qa:threat -- --levels L4 --out test-results/r5-vis/threat-L4
```

L7 survivor losses and the L10 empty walk are inherited findings outside this brief’s six items. They are not claimed fixed.
