# s140-wreckground — native audit in progress

## Outside-wire standstill

Ran the full registered L4 mission on the native simulation (seed 1, HIGH, complete bot): 18,468 ticks through mission progression. Every tick, the observer considered living, visible, non-emerging infected outside the perimeter and within 2 m of the authored perimeter walls. It counted a tick only when the infected `NavGrid` had a path from that actor to the courier. The scan recorded 29 actor intervals lasting at least five seconds; none accumulated less than 1 m of travel during its interval. This aggregate does not exclude a stationary five-second subwindow inside a longer moving interval. Closure requires a rolling-window scan with actor target and attack state. IDs, archetypes, interval ticks, duration, travel and closest wire distance are in `qa.json`.

The existing `checkOutsideWireRouting` regression also passes. It covers one actor following the perimeter to an opened north breach for 600 ticks. The full-run scan extends that evidence to real actors and path validity without changing AI stats or corpse handling.

## Wreck grounding

The source-layout inventory is 414 vehicle wrecks. The renderer-shared resolved `district.decay.placements` inventory contains 409 at-load placements: L1 0, L2 0, L3 23, L4 0, L5 25, L6 1, L7 38, L8 0, L9 84, L10 238. Five L8 candidates are filtered before rendering. This turn did not measure contact gaps against resolved terrain heights and did not perform the requested full-level backend close-ups. the archived s139 isolated reference is only the previously reviewed isolated HIGH WebGPU comparison; it is not campaign grounding evidence.

## Remaining work

- Measure the lowest wheel/body contacts against terrain and raised-road support for the renderer-resolved placements, including L9 and streamed L10. Then list offenders and fix placement data if needed.
- Render and review HIGH WebGPU and WebGL2 full-level close-ups at zoom 1.5 for the worst ten and five random in-range wrecks, with identity-checked rendered matrices.
- Add any discovered ground-gap condition to the existing placement gate and extend existing tests only.

## Measurement follow-up

`DistrictBuild.restOnGround` changes rendered vehicle Y using the median of four support samples when authored Y is at most 1 cm. A native contact scan must reproduce this renderer adjustment as well as asset mesh transforms; raw resolved placement coordinates are insufficient. The L4 preliminary scan also needs rolling five-second windows before standstill can be ruled out.

## Rolling-window reproduction

The repeated native seed-1 HIGH complete run finished at tick 18,468 and evaluated 15,405 eligible rolling windows longer than five seconds. Three identities travelled less than 10 cm during a window: Alpha #296 (ticks 3005–3306, zero movement), Alpha #372 (7584–7885, 9.87 cm), and crawler #233 (15676–15977, 9.69 cm). All three retained a scripted destination and targetId 0 despite the independently checked route to the courier. This contradicts a broad no-standstill conclusion from the aggregate scan. Navigation/script ownership still needs diagnosis and correction; no fix is claimed. Exact states and positions are in `qa.json.outsideWireRollingScan`.

## Script ownership diagnosis

`InfectedSystem.followScript` suppresses ordinary targeting while a scripted destination remains set and stops seeking within 0.6 m of it. `LevelFourWar.funnel` excludes Alphas from its open-breach routing loop. `L4Collapse` also deliberately assigns stationary scripted holds before battle beats. These sources explain why targetId 0 alone cannot establish a navigation defect. Next capture must match each flagged identity to its director Alpha job, breachApproach and pressure target before changing ownership. The exact rolling-scan source is preserved in `qa.json.rollingScanReproduction` using repository-relative imports.

## Identity ownership capture

Repeated full-run scan reproduces the same three stationary identities. Crawler #233 retains `breachApproach: outside` in collapse at ticks 15676–15977, with a scripted destination only about 10 cm away and an expired pressure target (until tick 3769). This matches the script follower arrival dead zone and needs a focused regression. Alpha job identities are west (#296) and line (#372), but job and breach objects in this capture were retained by reference, so their later stage/open times cannot establish state at the flag. A subsequent capture must clone these objects at observation time. Evidence remains preliminary.

## Collapse breach navigation correction

Confirmed lifecycle defect: `funnel()` ran only during war, leaving slow exterior approach arrivals in collapse at completed scripted waypoints. Continue the existing funnel updates in collapse. Extended `checkOutsideWireRouting` with a crawler arriving at its exterior waypoint during collapse; it must advance the approach within 30 ticks. Focused L4 contact test, typecheck and lint pass. Full native after-scan, Alpha diagnosis and prescribed remote suite remain pending.

## Full-run validation of collapse correction

After d7b89cf8, seed-1 HIGH complete mission again reaches progression. The scan evaluates 16,827 rolling windows and no longer flags crawler #233. Alpha #296 and #372 still flag. Controller state is now cloned at observation: #296 is west/charge at an open west breach; #372 is south/walk as its breach opens. Their navigation remains open. Prescribed remote npm test passes: 27 files, 105 passed / 1 skipped, complete 150-case budget collection, 134.0 s under 240 s. Typecheck and lint passed on the same source revision. No check remains running.

## Regression sensitivity

Restoring only the original war-only funnel condition makes the unchanged extended L4 contact test fail at the collapse crawler assertion: approach remains `outside`. Current source was restored automatically in a finally block. The earlier focused and prescribed remote passes therefore cover a regression that detects the actual lifecycle change. For the remaining Alphas, inspect wide-grid connectivity and body clearance at the flag: the existing wide-body recovery only activates for goals near the courier, whereas these jobs target scripted breach points. This is a hypothesis, not a validated fix.

## Alpha grid evidence

At the first stationary flag, #296 has radius 0.55 m and no cached path. Its selected wide grid (clearance 0.7 m) cannot reach the scripted inside-breach goal; admission grids at 0.5 and 0.35 m both find a 22-node route. Start and goal are individually clear at the actual radius. This confirms a conservative-grid connectivity mismatch for #296. #372 has routes on all three grids and direct visibility at the flag, so it requires separate temporal/controller diagnosis. Full scan completes; read-only path probes run only after a stationary window is already recorded. Exact rows are in `qa.json.alphaGridScan`.

## Rejected Alpha recovery experiment

Broadening the existing wide fallback to scripted L4 goals when any breach is open did not move an Alpha placed at the captured west position in a 600-tick extension of the existing fixture. That fixture opens north, not west, so it does not reproduce the real topology. Removed both the attempted source change and the mismatched fixture extension; the validated collapse fix remains intact. Next focused reproduction must open the west segments and retain actual controller ownership. No Alpha fix is claimed.

## Renderer contact probe

Added read-only `DistrictView.wreckGroundGaps()`, reusing the existing prop ground-contact measurement against the drawn support. It returns placement identity, asset/decay, selected resident LOD, resolved placement matrix, district origin and gap. It covers only currently resident references and has not yet been exercised in browser; a residency sweep must prove coverage. Typecheck and lint pass. A native static-bake census covers 254/409 resolved placements; 155 need source fallback, so bake-only sampling cannot establish the campaign result.

## First runtime contact result

Browser pool admitted two sequential HIGH WebGL2 L3 probes on port 5018. Initial camera yielded no resident wreck rows. Camera-only positioning over `D-CORRIDOR/l3-jam-3` yielded its selected LOD0 mesh, resolved matrix Y = 0.070005506 m and gap = 0 cm. This validates the probe on one full registered-level placement; it does not cover the remaining campaign inventory or WebGPU. Raw receipt: `test-results/s140-wreckground/probe-L3-webgl2/gaps.json`, also preserved in qa.json. No simulation actor or wreck was repositioned.

## Camera sweep admission

Prepared a sequential camera-only identity-checked sweep of every resolved wreck in one registered level; recipe preserved in qa.json. L3 HIGH WebGL2 sweep attempt exited 75 before browser execution: quiet-run admission exceeded 60 seconds, quiet=false, load 3.56/3.61/3.71. No sweep measurements were produced and no browser process remains running. The earlier single-wreck runtime result remains the only validated campaign gap measurement.

## Probe LOD identity correction

Hero slots can contain temporary lower LOD prototypes. Probe now reports `meshLod` separately from slot `lod` and excludes placeholders. Typecheck and lint pass. Second bounded L3 sweep attempt exited 75 before execution (quiet=false, load 4.11/3.70/3.73); no new measurement. Earlier receipt labelled lod0 establishes slot identity only, not independently verified LOD0 prototype identity.

## Complete L3 runtime gap sweep

Third bounded attempt admitted and completed. Full registered L3 HIGH WebGL2 camera-only sweep measures all 23/23 resolved wreck identities, zero missing rows, all reported gaps 0 cm. Receipts retain matrix, origin, slot and actual mesh LOD per identity in qa.json. This is numerical grounding evidence for L3 only; requested close-up visual review and WebGPU comparison are still pending.

## West-breach focused reproduction

Native isolated reproduction now opens both actual west segments and places an Alpha at the captured position with the same inside goal. It moves 0 m over 600 ticks. Broadening wide-body recovery to scripted L4 goals still yields 0 m, so that attempted change was removed. This disproves simple fallback broadening as a sufficient fix; preserved source in qa.json. L5 browser sweep separately failed admission before execution after 60 s.

## Steering trace

Focused Alpha calls seek on all 600 ticks. Baseline path remains empty with wide goal 48386. Under the rejected broadened trigger, recovery activates at tick 241 (until 841), selects admission goal 48385, but path stays empty and movement remains zero. Thus fallback trigger alone is insufficient. Removed the attempted change. Further diagnosis must inspect path-search budget/resumption and whether the focused manual breach teardown updates every navigation blocker.

## Focused teardown correction

Earlier manual fixture teardown omitted `interactables.unblock`, which production `Barricades.break` performs. Corrected reproduction sets wall HP to zero and runs Barricades.update. Baseline still moves 0 m; broadened recovery now obtains 22 path nodes and moves 0.412 m over 600 ticks. This supersedes the earlier empty admission-path conclusion for that fixture. Recovery alone remains unverified as a fix and its source change was removed. Next diagnosis is collision/steering along the resulting route.

## L5–L7 camera sweep

Sequential HIGH WebGL2 batch completed within one reservation. L5: 25/25 measured, 0 missing; gaps [0]; L6: 0/1 measured, 1 missing; gaps []; L7: 34/38 measured, 4 missing; gaps [0]. Missing rows remain unmeasured; they are not passes. Receipts are preserved in qa.json with per-placement matrices and actual mesh LOD. L6 and four L7 targets need residency/support diagnosis before coverage can be closed. Existing L4 routing regression now uses production barricade break/unblock and passes.

## Baked marker identity

Baked-layout marker references lacked placementId, unlike runtime placements. They now retain district/marker identity for contact audits. Typecheck and lint pass; runtime matching remains to be verified. L9/L10 batch failed admission before execution after 60 s; the quiet guard included this lane’s overlapping typecheck. Future browser admission must run without overlapping CPU checks. No late-level measurements were produced.

L9/L10 retry with no overlapping lane CPU check also exited 75 before browser execution: quiet=false, load 3.99/3.99/3.82, busy=[] after 60 s. No new gap coverage. Native Alpha work remains available, so browser admission alone does not block the entire goal.

## Admission route collision evidence

Diagnostic forced admission-grid routing (no production source change) obtains 22 route nodes but advances only to pathIndex 1 over 600 ticks, travels 0.408 m, and ends with SolidRegistry.clear false at the actual body radius. First route nodes: (-36.25,3.75), (-36.25,4.25), (-36.25,4.75). This shows why coarse-grid path existence alone cannot prove a traversable Alpha route. Future fix must preserve body clearance while routing around the blocker; shrinking body stats or bypassing collision is not justified.

## L9/L10 registered-level sweep

HIGH WebGL2 sequential camera-only batch completed. L9: 84/84 measured; range -2.921 to 0.600 cm; 0 threshold offenders; L10: 238/238 measured; range -2.891 to 1.903 cm; 0 threshold offenders. Matrix/identity receipts are preserved in qa.json, compacted to remain below 200 KB. This is numerical support-gap coverage; WebGPU comparison and requested zoom-1.5 close-up review remain pending.

## Elevated support coverage limitation

Four missing L7 wrecks are authored at Y 2.7–3.9 m. GroundField.add defaults to a 0.4 m ceiling; DistrictView.groundAt reads terrain or this field. Current null rows do not distinguish an absent reference from contacts with no support samples. Before closing grounding, add exact raised-road support coverage and explicit missing-support diagnostics. Existing measured rows remain numerical results against the current field, not proof of every raised-road surface. L6/L7 retry failed browser admission before execution (60 s, quiet=false, load 3.00/3.00/3.35).

## Explicit missing support diagnostics

Wreck probe now retains resident mesh identities with no support samples, returning gapCm=null plus supportSamples/contactSamples. This distinguishes absent ground coverage from missing residency without converting either into a grounding pass. Typecheck and lint pass; runtime check of the new fields remains pending.

## Five missing rows attributed

Fresh HIGH WebGL2 L6/L7 sweep completes. All 39 identities resolve; the five previously absent rows now report actual LOD0 meshes with zero support samples: L6 l6-35 at Y=3.8983 m (21,948 vertices), L7 rocket truck and military 0/1/2 at Y=2.7–3.9 m (17,055–27,083 vertices each). Thus these are ground-field coverage gaps, not missing residency. The other 34 L7 gaps remain 0 cm. Exact elevated road/bridge support sampling is still required. Updated receipts replace earlier missing rows in qa.json.

## Elevated audit field implementation

Added an audit-only GroundField from retained merged layout triangle meshes, including elevated triangles. GroundField queries can limit returned height; wreck probes query beneath authored pavingHeight + 10 cm to exclude overhead roofs, then fall back to existing terrain/ground support. Typecheck and lint pass. This code requires runtime validation on all five elevated wrecks before their grounding can be claimed.

## Height ceiling regression

Extended existing static-placement render contract with stacked road/roof surfaces. It proves unrestricted highest surface, road beneath a height ceiling, null below all surfaces, and query-order independence. All 14 render-contract tests pass; typecheck and lint pass. L6/L7 runtime admission again exited 75 before execution (60 s, quiet=false, load 3.08/3.35/3.40), so five elevated runtime gaps remain unverified.

## Elevated support result and L7 offenders

Fresh L6/L7 HIGH WebGL2 sweep measures all 39 identities with the elevated triangle field. L6 gap is -0.170 cm. L7 now reveals three sink offenders: l7-military-1 -15.001 cm, l7-military-3 -194.002 cm, l7-military-4 -16.468 cm. Opened and reviewed full-level l7-military-3.jpg: APC upper body/roof is visible while its lower body is buried in the road, consistent with the large sink result. Scene is dark; this diagnostic does not substitute for requested zoom-1.5 backend pairs. Placement correction remains to do. Earlier L7 34-row zero-gap result used an incomplete low-only field and is superseded.

## L7 support attribution caution

Source inspection confirms center-only terrace formula for military wreck placement, while northgateGround changes height by 15 cm across footprint boundaries. This is a plausible cause of smaller sinks. The 194 cm candidate needs further attribution: pavingHeight includes walkable building supports, so the audit ceiling may admit nearby building geometry. Added worst contact world XYZ and sampled groundHeight to probe receipts to resolve this before data correction. Typecheck and lint pass; runtime attribution pending. Treat the earlier 194 cm offender label as provisional.

## Native support geometry path established

Loaded all D-FAIR layout GLB layers natively with production GLTFLoader/Meshopt and GroundField (15,258 footprint triangles). Road center heights at x214/138/100,z25 are 3.75/1.50/0.45 m. A 10 cm grid around x134–142,z22–28 peaks at 1.65 m, strengthening concern that the runtime 194 cm candidate is support-selection contamination. Raw-layer probe does not apply all runtime filtering, so no placement correction follows solely from it. Reproduction source retained in qa.json; browser contact rerun failed admission after 60 s.

## Large sink transform cause found

Native asset-vertex + recorded-matrix replay reproduces every military gap, including -194.002 cm. l7-military-3 is authored Y=1.5 m but its renderer reference is Y=-0.290022 m; worst vertex is at [140.3201,-0.2900,24.4840] over road Y=1.65. Vehicles are pushable props; DistrictView sleeping-prop contact correction uses the incomplete low ground field and can lower the elevated reference. Thus the large sink is not dismissed as support contamination. Correct the prop support sampling before modifying authored height; the smaller 15 cm terrace discrepancies remain separate.

## Vehicle prop support correction

Vehicle prop settling now uses the same elevated layout triangle support query as the audit, replacing low-only sampling for vehicles. This targets the sleeping-truck transform that fell from authored Y=1.5 to -0.29 m. Existing 14 render contracts, typecheck and lint pass. L7 after-sweep failed admission before execution (60 s, quiet=false), so runtime correction is pending and not yet claimed verified. Remote suite must run on this source revision.

## L7 footprint placement correction

Military wreck placement now rests on the highest exported Northgate terrace overlapping its rotated footprint, replacing center-only height. Native asset-vertex checks against raw road triangles give military 0–4 gaps of -1.468, -0.0007, -1.468, -0.000004, -1.468 cm; all within thresholds. World-systems tests (5), typecheck and lint pass. Runtime after-sweep and prescribed remote suite remain required; native checks do not alone validate final renderer prop settling.

## L7 correction runtime pair

HIGH WebGL2 and requested WebGPU sequential sweeps both measure 38/38 wrecks at 0 cm, with matching placement matrices. Opened and reviewed military-3 full images and [small before/after sheet](wreck-fix-sheet.jpg): lower body and wheels now clear the road rather than being buried. Session zoom was set to 1.5 with camera-only cinematic positioning. Receipt currently retains requested backend rather than selected backend; explicit backend identity remains required before claiming the WebGPU gate. The sheet replaces the old isolated reference so this report retains only one small image.

## Current remote validation

Prescribed remote npm test on f30878a4 passes: 27 files, 105 passed / 1 skipped, complete 150-case budget collection, 134.1 s under 240 s. No source changes occurred during the suite. Native Alpha diagnostic additionally classifies the admission-route obstruction: convoy exclusion passes, static clearance fails. Exact static solid and a body-clear detour remain to be identified.

## Alpha breach alignment correction

Exact blocker is intact l4-wall-34 beside the west breach (1.41 cm corner contact). Native outer-center waypoint moves the captured Alpha 2.525 m rather than 0 m and reaches the opening. L4Collapse now aligns an outside Alpha laterally with the open breach before assigning its inside waypoint. Existing focused L4 regression, typecheck and lint pass. Full real-actor rolling scan and dedicated regression coverage for this branch remain pending; not yet a complete outside-wire pass.

## Full-run alignment audit

After alignment change, native seed-1 HIGH run completes at tick 18,326 with 30,114 eligible rolling windows. Residual flags remain: #296 now reaches the west outer center but stalls on the inside goal; south Alphas #369/#377 retain scripts, while #345 is attacking target 151 and riot #357 requires separate pressure-target attribution. Thus alignment alone is insufficient and outside-wire completion is not claimed. Exact cloned states are retained in qa.json.l4AlignedFullRun. Next test should combine body-clear aligned entry with bounded route recovery, preserving normal attack states.

## Aligned entry plus bounded recovery

Existing four-second wide-grid recovery now also observes scripted L4 Alpha goals. Full seed-1 HIGH mission completes at tick 18,265 with 19,394 eligible windows; original west #296 no longer flags and west arrivals rise from one to three. Two other Alpha windows remain (#345 and #371). South #371 receives z=24.1 outside the z1=22.5 perimeter despite an open breach, consistent with generic snap searching back outside when the intended inner post is blocked. Focused L4 test, typecheck and lint pass. Overall outside-wire requirement remains incomplete; remote suite pending this change.

## Rejected constrained landing experiment

Tried requiring inside navigation/static-clear landing candidates. Full mission completes at tick 18,571 but residual south Alphas remain at outside goals displaced about 1 m laterally by snap. The .6 m center-alignment criterion then keeps selecting their already completed outer point. Removed this unvalidated experiment; retained full trace in qa.json.insideLandingExperiment. Next correction must account for the usable width of the two-segment opening instead of a center-only alignment threshold.

## Breach-width correction validated for Alpha windows

Alignment now uses the actual two-segment opening width minus actor radius and 5 cm clearance; inside candidates must remain inside and pass nav/static checks. Full seed-1 HIGH mission completes at tick 18,101 with 8,252 eligible rolling windows and zero Alpha stationary flags. One crawler #223 retains an expired-pressure outside waypoint during collapse; overall requirement remains open. Focused L4 regression, typecheck and lint pass. Exact full-run receipt retained in qa.json.l4BreachWidthFullRun.

## Full HIGH outside-wire scan clean

Real collapse can empty the fence registry, which prevented earlier funnel cleanup. Collapse cleanup now runs without that guard and releases approaches whose assigned target has left the camp. Full seed-1 HIGH complete run reaches progression at tick 18,147 with 6,161 eligible rolling windows and zero stationary flags. Existing regression now explicitly retires the fence registry during collapse and passes; typecheck and lint pass. LOW/cross-level fence coverage and latest remote suite remain pending before broad closure.
