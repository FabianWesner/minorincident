# R1 foliage

Trees, garden bushes and hedges now render as instanced alpha-tested leaf cards,
with a separate rounded trunk or shrub stem. Each crown uses 80 cards on high and
the spatially uniform first 40 on low. Bent normals and two colours produce the
round volume; a coherent Perlin gust offsets vertices and turns the leaf texture.
`foliageWind` is exported for the grass lane to share. The original procedural
128×128 leaf-cluster SDF ships as code, without Bruno's bitmap or branded content.
The adaptation headers and MIT notice are retained.

Delivered assets are `prop.street-tree` (round maple),
`prop.street-tree-blossom` (peach/pink), `prop.garden-bush`,
`prop.garden-bush-small`, and the crown-based `prop.hedge`. `prop.tree` aliases the
real maple. Blender builders create bevelled, tapered trunks, branching limbs and
root flares. Crown empties survive export; preview proxies are excluded from
runtime static batches, including nested exported groups. The collision cache
is rebaked from delivered GLBs. Trees block only their narrow trunks; the hedge
body is slightly inset from its leafy fringe.

L1 has a roughly nine-metre street-tree cadence, alternating with lamps, plus
front-yard and diner-lot planting. The complete L1 playable route passes on desktop, portrait and landscape.
Narrow side gardens scale tree crowns horizontally to fit their traffic edges.
The shared `prop.tree` correction requires regenerated base layouts for all eight
districts. World-tier layers and character/NPC/infected assets were not edited.

Foreground cards open independently around the survivor and the current living
attack target. The holes use screen projection with a view-depth gate, so crowns
behind an actor retain their leaves. Shadow masks use the original leaf shape and
do not inherit the reveal hole. Low-tier crowns omit shadow casting.

The dedicated `@foliage` browser check captures V1–V6 at desktop 1600×900/high and
iPhone-shaped 390×844/low. An ID mask counts rendered foliage and grass blades,
excluding flat lawn colour; a second mask measures crowns alone. Combat captures
compare the same scene with reveal disabled and enabled. The 200-infected L1
fixture uses V5, actual physics/navigation and active simulation, with asset warmup
before collecting at least 12 seconds of requestAnimationFrame intervals. The
fixture holds its invulnerable survivor at V5 and fixes the camera there, retaining
the attacking crowd in the measurement view as capsule contacts push on the actor.

Overdraw is reported as clipped, submitted card-quad area divided by viewport
area, and as that area divided by visible crown-mask pixels. This is a conservative
depth-blind geometric estimate including SDF-discarded pixels, not a hardware
fragment counter. The tiny shader gust displacement is not included in the area.
Native headless Chrome uses ANGLE Metal on this Mac; portrait emulation is not a
physical iPhone measurement. Browser runs use the shared lock. Final builds and
Node checks run outside it, following the orchestrator's two-slot lock update.

Validation: typecheck, lint and production build PASS. The complete unit suite
passed 153/153 tests in 57 files. The final layout, collision, foliage and L1/M1
simulation selection passed 37/37. Smoke passed 22 browser checks plus three Node
checks. The full E19 run passed its 37 selected Node checks and 31/41 browser
checks before the final reveal refinement. The dedicated visual test retains
strict coverage, silhouette, frame, draw and triangle assertions; a failed shared
triangle gate is reported as a failure, not turned into a skip or a relaxed limit.

Six full-E19 failures match the starting-state evidence in the r0-lookdev report:
two world-route stalls at (-19,-4.5), the portrait connection triangle limit, and
three desktop weapon probes with zero combat-hit events. These are **baseline**,
per the orchestrator's instruction to finish this lane without repairing them.
The unchanged porch bench intersects the world test's destination clearance.
The portrait connection reported 531,592 triangles here versus the baseline
518,228, so foliage adds 13,364 while the starting scene already exceeds 500,000.
Three corresponding iPhone weapon probes also failed here; r0 recorded those
passing, so their baseline status is **unverified**, not assumed. The full portrait
and landscape L1 playthroughs passed. No combat, weapon or figure implementation
was changed in this lane.

The tenth full-E19 failure was desktop survivor visibility and belongs to this
lane. A paired leaf-on/leaf-off ID pass exposed cards hiding the legs, including
cards behind the chest but in front of the shoes. The fix gates at foot depth
with a shoe/backpack margin and projects a body-centred hole. Final paired
silhouette results and the desktop playthrough rerun are recorded below.

The protected `inf.common-worker` GLBs contain 36,134 / 5,034 / 4,308 raw triangles
at LOD0 / LOD1 / LOD2. Two hundred copies of even LOD2 total 861,600 raw triangles
before scenery. Raw asset counts are evidence of the crowd's geometry cost,
not an isolated GPU attribution or a main-branch replay. The sustained fixed-V5
stress scene therefore does not meet the shared triangle gates. Character and
infected LOD work remains with the figures lane. FPS and draw-call conclusions
come from measured totals, not from subtracting estimated crowd cost.

Final owned foliage assertions PASS. The dedicated test reports two failures,
solely the desktop and portrait whole-scene triangle limits. Its silhouette,
coverage, live reveal, simulation, camera, FPS and draw-call assertions pass.
Strict overall acceptance remains incomplete because the shared geometry gates
and the three unverified E19 mobile weapon probes remain open. The full E19 suite
was not rerun after the reveal fix; its desktop real-input playthrough was rerun
and passed twice. Raw numeric evidence is in [r1-foliage-metrics.json](r1-foliage-metrics.json).

| View | Desktop foliage + grass | Portrait foliage + grass | Desktop submitted card layers | Portrait submitted card layers |
| --- | ---: | ---: | ---: | ---: |

| V1 | 25.12% | 25.36% | 5.11× | 3.15× |
| V2 | 37.21% | 42.62% | 6.18× | 3.53× |
| V3 | 24.84% | 42.36% | 3.77× | 5.03× |
| V4 | 36.35% | 25.89% | 9.54× | 3.06× |
| V5 | 32.10% | 41.40% | 8.24× | 5.69× |
| V6 | 25.59% | 24.68% | 5.68× | 3.35× |

V1, V2 and V4 exceed the required 25% on both tiers. Other viewpoints are
reported without applying that threshold to them. V1 margins are small (0.12 and
0.36 percentage points), so later placement/camera changes should rerun this check.

| V1 paired survivor mask | Desktop cards on / off | Portrait cards on / off |
| --- | ---: | ---: |
| female | 7550 / 7550 pixels | 2830 / 2830 pixels |
| male | 9411 / 9411 pixels | 3470 / 3470 pixels |

Both variants retain 100% of their visible silhouette and their full height.
Live survivor/locked-target reveal removes crown pixels covering 5.23% / 7.83% of
the entire frame on high / low. This clearing affects leaves; solid trunks
and street furniture still occlude normally. The combat still includes a lamp
across the target, and a trunk can cross the survivor at V6.

| Sustained fixed-V5 200-infected scene | Desktop high | Portrait low |
| --- | ---: | ---: |
| Frame p95 | 13.30 ms | 11.30 ms |
| Draw calls | 274 | 266 |
| Total triangles | 2,042,133 | 1,145,238 |
| Main-view crown card triangles | 1,120 | 1,040 |
| Active simulation ticks | 720 | 720 |

FPS and draw calls meet the 60 / 30 FPS and 600 / 300 draw gates. Triangles fail
1,500,000 / 500,000. The main-view card count excludes additional desktop shadow
passes; total renderer counts include the scene's rendering work. Both profiles
run for at least 12 seconds, with all 200 infected alive and simulation active,
on `ANGLE Metal Renderer: Apple M1 Max`, DPR 1. Maximum submitted card layers are
9.54× high / 5.69× low. Dividing by crown-mask pixels gives at most 28.91× / 14.05×
as a depth-blind geometric overdraw estimate. This records fill demand and its
measured frame budget; it does not establish physical-phone or WebGPU performance.

All six final r0 comparison sheets were inspected at both tiers against the local
mockup and Bruno PO capture. Crowns have rounded two-tone volumes, broken leafy
outlines, visible rounded trunks and peach/pink blossoms. V1 and V6 show the
body-centred reveal aperture; V2/V3/V5 have large foreground canopies; V4 has a
leafy diner frontage. Individual leaf marks are coarser than Bruno's. Lawn grass
remains patchy and the broader lighting/figure presentation still differs from
the references; reference parity or an independent art score is not claimed.
Generated screenshots, sheets, browser videos and traces are deleted after review.
No reference bitmap is committed.

Reproduce captures with a production build outside the browser lock, then
`E2E_PORT=3327 sh tools/e2e-lock.sh npx playwright test tests/visual/foliage.spec.ts --project=chromium --workers=1`.
The six-sheet review uses the r0-lookdev harness. Its baseline report shares this
lane's `e6ed970` starting commit. The orchestrator's `tools/e2e-lock.sh` two-slot
update remains outside the foliage commits because the same change is on main.

Commits: `17f9abb` instanced foliage and assets; `6f38a9e` crown fit, planting and
trunk collision. The final lane commit contains the reveal fix, silhouette/crowd
validation and this report; its hash is included in the lane result.
