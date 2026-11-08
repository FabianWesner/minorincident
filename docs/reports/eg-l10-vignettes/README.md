# L10 environmental vignettes

**Scope built; all requested main/farm merge checks pass.** The earlier full L10 acceptance run recorded inherited failures and a completion-policy stall reproduced with the vignette layer omitted; full acceptance was not rerun for this integration. Visual and GPU performance acceptance is assigned to the QA lane under the no-browser instruction.

## Main/farm integration verified (2026-11-08)

Merged main `63c40477` into the lane, including farm landscape/scares and the later destruction merge. Checked source: `466b7fd2`. The manifest contains **463 unique entries**, the union of both lanes; every farm asset definition is retained. Rendering combines destruction visibility, farm crop LODs and scatter reduction, vignette scatter reduction and decal updates.

Farm placements enter vignette admission as occupied space. The later evacuation pavement clears crop tiles and relocates field detail `decor-cure-farm-field-9` into the nearest surviving crop tile with space; every farm piece keeps its ID and asset, while structures and machinery keep their positions. The assembled native world retains **205 corn tiles, all 35 farm pieces and 578 fixed vignette placements**. There are zero vignette/farm footprint overlaps, zero farm pieces on the service pavement and zero route blockages. Minimum full-footprint clearance is **5.443 m across 21 route lines**, including the farm mown paths. All 195 complete scenes, 167 static human bodies, 35 approved wall messages and regional density/composition requirements remain admitted.

| Remote check | Result | Seconds |
| --- | --- | ---: |
| L10 decor/vignette scope | PASS | 1.54 |
| Native L10 placement and route clearance | PASS | 9.65 |
| Native crop, perception, movement and scare regression | PASS | 8.98 |
| Typecheck (both projects) | PASS | 69.18 |
| Lint | PASS | 38.44 |
| World systems, including L10 decor/vignettes (5 tests) | PASS | 28.61 |

All checks ran sequentially through `tools/remote/run.sh`, with `MI_LOCAL_FALLBACK=0` and Vitest `--maxWorkers=1`. No browsers ran. [Commands, provenance and exits](merge-checks.json), [native assembled-world placement receipt](evidence/merge-placement.json), [farm regression receipt](evidence/merge-farm-native.json), [merged vignette scope](evidence/scope-audit.json). An initial audit misclassified an attached message wall as a jam vehicle; the corrected assertion selects only sedans and the bus. A stale runner-cache index lock was removed after confirming no live owner; validation then completed successfully.

## Built scope

`main` was merged for ground depth priority and pushable props, then merged again for the PO's `docs/design/story-script.md`. All writing now comes verbatim from that script: **HELP — 3 INSIDE** and **AUTHORIZED PERSONNEL ONLY — BIOHAZARD LEVEL 4**. The two approved messages occupy 35 separate walls; the earlier invented messages were removed.

- 195 complete scene cores across the seven canonical regions and eight measured walking crossings, including enriched existing crossing compositions; 167 frozen human bodies. Core compositions contain 3–8 pieces, with optional loose scatter handled separately.
- Last stands, evacuation remains, abandoned camps, triage, graves, quarantine boundaries, livestock, quarantine executions and one residential refuge beside an existing house with broken furniture.
- A 128 m evacuation jam with six unequally spaced vehicles, open wreck doors, a burned bus and a passenger on a paved service lane connected to the main road; one crashed army helicopter with remains in R4.
- New and existing crossing story pieces are fixed. Large landmarks have fixed physics-only colliders; corpses and small dressing add no sim entities. The admission rules protect routes, encounter slots, anchors and the 60 m console exclusion.
- Low retains every core and halves loose belongings (38 → 19) and casing patches (164 → 82). No vignette lights, animated actors or particles were added.
- Decals share one atlas and one instanced draw, with distance culling and the merged ground depth priority. Meshes use the existing district instancing and LOD path. The jam service lane adds three ground boxes in one batch at paving priority 13; its rectangles also mask the grass.

### Canonical route density

| Region | Route / eligible m | Small scenes/km | Bodies/km | Large | Walls |
| --- | ---: | ---: | ---: | ---: | ---: |
| crash-outskirts | 250 / 250 | 20 | 20 | 2 | 5 |
| residential-fringe | 600 / 600 | 20 | 20 | 2 | 5 |
| industrial-area | 750 / 750 | 20 | 20 | 2 | 5 |
| military-zone | 800 / 800 | 20 | 20 | 3 | 5 |
| research-campus | 550 / 550 | 20 | 20 | 2 | 5 |
| destroyed-corridor | 1000 / 1000 | 20 | 20 | 2 | 5 |
| dispersal-complex | 348.7 / 278.7 | 21.53 | 21.53 | 2 | 5 |

R7 excludes the final 70 m from density calculation to respect the console exclusion. Crossing scenes and large set-piece bodies are additional. Admission reported no missing stations or messages. See [scope audit](evidence/scope-audit.json) and [full scene catalogue](evidence/scene-catalogue.json.gz).

## Asset delivery and inspection

| New small prop | LOD0 triangles | LOD1 | LOD2 |
| --- | ---: | ---: | ---: |
| Grave cross / name board | 60 | 36 | 36 |
| Body bag | 196 | 88 | 40 |
| Quarantine tape | 56 | 56 | 56 |
| Fallen cow | 616 | 292 | 52 |
| Scenery shovel | 60 | 60 | 60 |

All satisfy 800/300/60. Three human poses reuse production `StaticCorpses.prepare`, repaired death clips and the existing worker LOD2 (840 triangles); vehicle derivatives reuse existing wreck and helicopter geometry. Those reused meshes are outside the new small-prop cap. All 33 delivered tiers pass asset validation; exact counts and bytes are in the [delivery report](../../../assets/l10-vignettes/delivery-report.json).

CPU Cycles renders were generated headlessly with one thread and inspected at all three tiers. The cow's distant tier was replaced with a closed coarse silhouette. Inspection caught and corrected atlas text overflow and a floating helicopter hull: the rolled hull and detached rotor now rest independently on the ground, with emissive lenses disabled. The corrected helicopter and atlas sheets were reopened. CPU inspection happened before the remote-only instruction; subsequent heavy checks ran remotely.

The [cell manifest](assets/cells.json) identifies all 33 images. Images remain local under repository ignore rules: `assets/props-sheet.jpg`, `assets/corpses-sheet.jpg`, `assets/helicopter-sheet.jpg`, `assets/atlas-sheet.jpg`, plus individual cells. They are asset inspections, not game captures. [Build and regeneration notes](../../../assets/l10-vignettes/notes.md).

## Earlier native verification (before the farm/main merge)

| Final check | Result | Seconds |
| --- | --- | ---: |
| Python asset/QA script syntax | PASS | 0.1 |
| `npm run typecheck` | PASS | 112.07 |
| `npm run lint` | PASS | 54.09 |
| `npm test -- --maxWorkers=1` | PASS | 212.82 |
| Native scope + service-lane coverage audit | PASS | 1.89 |
| Vignette-omitted completion comparison (execution) | PASS | 605.7 |
| Full `qa:accept -- --level L10 --skip-browser` | FAIL (exit 1; details below) | 3259.92 |

Remote runs used one heavy command at a time, Vitest `--maxWorkers=1`, and `MI_LOCAL_FALLBACK=0`. The test census remains 150/150 cases and 43/45 files. The remote default suite passed 106 tests with one macOS-only test skipped; the preceding macOS run passed all 107. Pre-merge revision `893bf220` provenance, commands, exits and timings are in [final-checks.json](final-checks.json); the preceding full acceptance batch is recorded in [native-checks.json](native-checks.json).

The runner workspace normally has no commit history. The verification helper creates a snapshot commit of the synced files for provenance and review-freshness checks. `sourceCommit` records the originating lane revision; receipt `revision` records that runner snapshot. The full acceptance run predates the final render-only service-lane paving and grass mask. Those changes preserved native placements and collisions; pre-merge typecheck, lint, unit and scope checks were rerun separately on that revision. The integration checks above cover the newer farm/destruction merge.

### Full L10 acceptance: known red results

The complete acceptance command finished with exit 1: one fresh failing **level** row and 13 incomplete level rows. Fresh failed criteria are **G-24** (enemy-bar distance/health eligibility) and **L10-03** (regional population/dog census). Both IDs already failed in saved WIP `3063c08a`; see [inherited criterion comparison](evidence/inherited-gate-status.json). Historical review failures remain visible in the full [L10 report](acceptance/L10.json); this lane does not mark them passed.

| Policy | Low | High |
| --- | --- | --- |
| Completion | Tick budget at hold; 162 deaths | Tick budget at hold; 149 deaths |
| Stationary | Charge reaches 3,600 ticks, zero invalid increments | Charge reaches 3,600 ticks, zero invalid increments |
| Controlled fixtures | 16 clauses, 0 errors | 16 clauses, 0 errors |
| Checkpoint death/reload | 27 clauses, 0 errors; control identical | 27 clauses, 0 errors; control identical |

**Completion-stall isolation:** the final comparison removes only `cureVignettes` in a disposable runner copy, retaining the same code and seed. It produces the **identical full run report and native state hash `707fb2f5`** as the run with the layer present: 162 deaths, hold objective, the same mounted-gun seat position, charge maximum 942 ticks and no invalid increments. Thus the completion stall reproduces independently of the new placement layer. [Comparison summary](evidence/completion-comparison.json), [complete comparison receipt](evidence/without-vignettes-low-complete.json). The mounted-gun/finale issue and inherited criteria were surfaced to the orchestrator.


### Earlier empty-stretch evidence

| Full-route geometric sweep | Before | After | After, centre-only diagnostic |
| --- | ---: | ---: | ---: |
| Zoom 1, high and low | 22 s | 9 s | 13 s |
| Zoom 1.5, high and low | 13 s | 6 s | 8 s |

These measurements predate the farm/main integration. The sweep samples all 15 route lines at 4.5 m/s. This is a geometric projection check, including the visible extent of story footprints; it does not test pixel visibility, occlusion or actual gameplay. Loose scatter alone does not qualify as a story cue. The centre-only diagnostic is retained to expose the difference from the old pivot-only approximation.

An additional replay uses the real-input R6/R7 trace recovered from WIP commit `3063c08a` (`test-results/r10-l10/meter-trace.jsonl`), archived as [historical-real-input.jsonl.gz](evidence/historical-real-input.jsonl.gz). Its longest scenery gaps improve from 11.33 to 8.80 s at zoom 1 and from 9.10 to 6.53 s at zoom 1.5, identically on both tiers. It is historical input, not a fresh capture of this build. The 16 `empty-{sweep,historical}-{before,after}-{high,low}-z*.json` files retain the complete matrix.

## Browser QA needed

No browser was launched by this lane after the orchestrator's prohibition. These checks belong to the QA lane:

1. Run `scene:gate` and capture each region, the jam and helicopter at zoom 1/1.5, low/high, with one headless browser. Open the captures to assess story readability, ground contact, overlap, repetition, the residential refuge and the combined corn/vignette clearings at the evacuation turnouts.
2. Compile and inspect the atlas shader on WebGL2 and WebGPU: approved text, wall orientation, legibility, corpse colors, transparency, ground layering, occlusion and quality switches. Verify all new models load without placeholders.
3. Record fresh real-input gameplay along every route choice and replay the empty-stretch meter. Confirm the geometric result in actual frames, including the R7 console approach.
4. Measure E18 draw/triangle budgets at the evacuation jam, high/low, cold load ≤6 s and no new high-tier frame >66 ms. No GPU frame or cold-load result is claimed here.

## Reproduce native checks

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull docs/reports/eg-l10-vignettes \
  --pull test-results/eg-l10-vignettes-checks-merge -- \
  python3 tools/qa/l10-vignettes-verify.py --merge --revision "$(git rev-parse HEAD)"
```

For the earlier full implementation checks and isolated comparison, replace `--merge` with `--compare-without-vignettes` in the helper invocation and pull `test-results/eg-l10-vignettes-checks-final`. The comparison is expected to record the shared failure; its process exit indicates the experiment completed, not that L10 was won.

Changes are committed per step. No deployment or push was performed. Shared acceptance report changes from the crash-era WIP were restored to main; this lane's new receipts are kept here.
