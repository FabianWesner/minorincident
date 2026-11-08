# L10 farm + audio

## Built scope

- Dedicated dry, broken corn asset in the opening farm chapter: 208 crop tiles, 35 farm pieces, and 292 existing trees replaced with bare/dead variants. Ruined barns and houses, irregular broken-fence scenes, scarecrows, fallen livestock, abandoned tractor/combine/irrigator. Existing roadside/crossing scenes remain.
- Corn has no physics colliders. Courier, ordinary infected, NPCs and corgi walk at 0.85× in crop; mown objective/road lanes retain full speed. A* prices corn at 1/0.85. Streaming and clearance-grid rebuilds retain terrain cost. Combat impulses retain their existing timing.
- Corn caps infected sight at 3 m and also breaks rays crossing crop between clear endpoints. Hearing remains intact. Corgi warnings recognize crop-concealed threats even inside the camera frustum.
- Shared corn shader bends around up to eight moving nearby actors, sways in wind and fades within 1.5–3 m of the courier. Existing instancing, LOD and chunk residency remain authoritative. Low uses the sparse crop LOD and removes half the loose farm scatter, preserving the main scenes.
- Four crop-edge scare sites duck the score, sting after 1.05 s, then spawn a chasing sprinter at 1.5 s. No actor waits in view. The ledger is checkpointed with `LevelTenEncounters`; retries replay pending telegraphs, and delayed admission requires a fresh warning. Pool/residency/director caps apply.
- L10 brown grass/stubble and foliage palette, saturation 0.55, bare trees, patchier ground, and low grey fog in five hollows. Fog reuses the bounded smoke pool, with a distinct grey marker from cure mist. No new ground layers: merged main's depth-priority rules and baked ground are preserved.
- L10 score streams: *Zombie Hoodoo* for walk/ordinary combat, *Static Motion* for tension, original synthesized heartbeat plus five distinct scare hits. *Metalmania* plays only during the active console/Mega finale (`charge-active && !mega-dead`). Existing approved CC BY 4.0 recordings are reused; original effects are MIT. Credits and hashes are in both audio license files.
- Merged main first for ground rules, and again through `c1af927e` for the orchestrator's story script and intervening fixes. The farm models contain no invented signs or dialogue. Scare captions quote chapter 1 exactly: “Things move in the rows.”

## Assets

Original headless Blender builds, authored LODs and runtime packing. [Asset sheet](asset-sheet.png) was opened and inspected; columns are LOD0/1/2, rows follow this table. It is an asset-only CPU render, not an in-game capture.

| Asset | Runtime triangles LOD0 / 1 / 2 |
| --- | --- |
| `veg.corn-block` | 1376 / 280 / 56 |
| `prop.farm-scarecrow` | 104 / 104 / 50 |
| `prop.farm-carcass` | 204 / 104 / 56 |
| `prop.tree.dead` | 128 / 44 / 40 |
| `bld.farm-barn-ruin` | 348 / 216 / 132 |
| `bld.farm-house-ruin` | 360 / 228 / 144 |
| `prop.farm-tractor` | 180 / 96 / 48 |
| `prop.farm-combine` | 288 / 108 / 60 |
| `prop.farm-irrigator` | 140 / 140 / 56 |

All 30 delivered tiers (including burned-tree variants) pass [asset validation](asset-validation.json) with zero errors. [Source caps](asset-budgets.json) and [runtime counts](runtime-budgets.json) are retained. Corn caps are 6000 / 1500 / 200 per tile.

Source builders: `tools/blender/build_l10_farm.py` (headless, one CPU thread, `--render`), `tools/assets/pack-l10-farm.ts` and `tools/audio/build-l10-farm.ts`. The general audio builder uses the same custom cue generator. Asset authoring predates the orchestrator's remote-only instruction; subsequent heavy checks use `tools/remote/run.sh` with Mac fallback disabled.

## Validation

The farm component checks pass. Runtime files were checked at `29d31086`; the final audit typing fix was checked at `7703153a` (no runtime files changed between these revisions).

| Check | Result | Remote source |
| --- | --- | --- |
| `npm run typecheck` | PASS | `7703153a` |
| `npm run lint` | PASS | `7703153a` |
| `npm test -- --maxWorkers=1` | 106 passed, 1 platform skip; 27 files passed | `29d31086` |
| `node --import tsx/esm tools/qa/eg-l10-farm.ts` | PASS | `7703153a` |
| Asset validation | 30 tiers, zero errors | GLB hashes in `asset-validation.json` |

Collection remains 150/150 cases and 43/45 files; no test cases were added. The final full unit run took 232 s within its 240 s budget. Heavy checks run sequentially through `tools/remote/run.sh`, with Mac fallback disabled.

An earlier unit run exposed a review-digest limit: the public review input grew from main's 506.5 MiB to 513.0 MiB, exceeding the revision reader's 512 MiB output buffer. Commit `8efbc65e` reads bounded batches without changing digest ordering or weakening criteria. The subsequent full unit run passes, including that regression. The final typecheck also caught a flow-narrowing error in the audit after recreating a deleted scare entry; the corrected lookup passes the remote follow-up.

[Verification receipts](verification.json) retain all attempts, commands, source/snapshot revisions, durations and output tails. The [native farm audit](native-audit.json) is a controlled simulation fixture: crop perception/movement, corgi warning, all four scare sites, snapshot/retry/admission checks, caption provenance and distinct audio waveforms/PCM hash. It uses explicit fixture teleports and tick advances; it is not a real-input route or visual proof.

### Full-level acceptance remains incomplete

The remote `qa:accept -- --level L10 --skip-browser` sweep ran on `63faae10`, before the final scare retry/admission fixes. [Preserved receipts and summary](acceptance-summary.json) contain the two low-policy receipts. Both hit their tick budgets. The completion policy traversed both farm regions (66 s and 121 s simulated), reached install at 948 s, then repeatedly died during the final console hold. It stopped at 3600 s, x=3989.6/z=-34.4, with 169 deaths. The sweep was stopped during high/complete after the final fixes superseded its source revision; high policies, fixtures and control/checkpoint sweeps did not finish. No full acceptance verdict is claimed for the final branch.

Rerun full native acceptance after integration with the story/Mega lanes. The farm component has its own current-source checks. The earlier local acceptance attempt was stopped at the remote-only instruction and produced no completed receipt.

No browsers were launched in the resumed lane. Visual/performance gates remain unmeasured.

## Browser QA needed

QA lane owns these checks under the orchestrator's no-browser rule:

1. Walk the real L10 route, low/high, zoom 0.5/1/1.5; open captures. Check crop coverage and broken stalks, courier fade, actor rustling before emergence, scare fairness, bare trees/brown land, ruined farm silhouettes, grounded props, collider gaps, fog vs cure mist and LOD transitions. Confirm low removes half the loose scatter.
2. Measure road/verge contrast ≥2.5:1 after the L10 palette/grade changes. Warm practicals should remain readable; no lush green.
3. Run `scene:gate`, E18 draw/triangle budgets at the densest corn chunk, high frame spikes ≤66 ms and cold load ≤6 s. These are unmeasured here.
4. Capture fresh `PLAYTEST_ROUTE_TRACE=1` evidence and run `tools/qa/r9-l10pace-empty.ts` at zoom 1/1.5. The lane does not claim a fresh empty-stretch verdict.
5. Audition ambient/tension/heartbeat and all five hits, the pre-scare silence, captions, pause/focus behavior and rock restricted to the Mega finale.

## Integration

Farm placement and lane data live in `src/levels/L10/farmLayout.ts`, independently of baked layouts and story data. The current crop chapter occupies approximately x=550–1230 in D-CURE. Scares live in `src/sim/missions/FarmScares.ts`. Future destruction integration owns updating standing-crop cover/cost and removing generated `/farm-wood-*` or `/farm-chassis` solids when their parent is destroyed.

No specs or read-only references were edited. L1–L5 presets/layouts were not changed; shared movement/render/audio additions are dormant outside L10/new farm asset IDs. No deploy or push.

## Commits

- `e9d1643e`: farm assets, landscape, corn cover and scares.
- `a06d3348`: ambient score, original scare bank and finale gate.
- `d1d993eb`: native/decoration coverage and repeatable assembly.
- `5a3b8545`, `63faae10`: approved caption and reproducible audio builders.
- `8efbc65e`: bounded review-digest reads.
- `58611671`, `29d31086`: retry/admission fairness.
- `7703153a`: final audit typing correction.
