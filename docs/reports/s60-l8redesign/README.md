# s60 L8 redesign, part 1

## Changes

- Kept the existing path and L8 gate state machine, shortened route prompts, moved route markers to each entry gate, and move the marker to the arena centre after entry. Completed exits close once the whole party is through the next entry gate.
- Added compact 28 m inner fence pens inside the existing zoo enclosures, paved spurs to their gates, and compact monkey and elephant arena bounds. The new placement geometry is appended after the existing layout placements to preserve their IDs.
- Changed habitat floors to a light sidewalk material. Added an arena outline to the minimap and restricted L8 threat dots to living infected inside the active arena.
- Replaced fight objective tips with short kill counters. Existing encounter announcements continue to show the arena tip once as a subtitle. Kept the plaza breach and finale flow.
- No animal models, motion code, or §3 flamingo mechanic changes.

## Captures

None. The D-ZOO assets could not be rebuilt in this restricted checkout, so no runtime capture is representative of the changed layout.

## Checks

- `npm run typecheck`: pass (also re-run directly through the TypeScript CLI after the final gate changes).
- `npm run lint`: pass before the final small gate/test edits; rerun required.
- `node --import tsx/esm node_modules/vitest/vitest.mjs run --project default tests/engine/missions.test.ts --maxWorkers=4`: pass, 6 tests.
- `npm run layouts:build -- D-ZOO`: blocked. The `tsx` wrapper cannot create its IPC socket in this sandbox. Calling `tools/layouts/build.ts` directly avoids that wrapper, but Blender 5.2.2 crashes in its Metal backend probe before the layout script starts. Restore of incidental generated physics metadata was verified.
- `sh tools/ops/slim-worktree.sh "$PWD"`: blocked because it cannot write the linked `.git/worktrees/.../config.worktree` outside the writable workspace.
- Smoke, threat audit, nightly invariants, full `npm test`, and real-input playthrough/captures: pending. Smoke and playthrough require the rebuilt layout; remaining checks have not completed yet.

## Remaining for part 2

Rebuild and validate the D-ZOO output, capture the actual gated route and zoom-1 pens, run the requested audits and real-input path through flamingo → lion → monkey, then score the arena presentation. Part 2 still owns the flamingo rework, signature-attack telegraphs, and deliberate 3–4-piece arena cover pass.

## Continuation validation (2026-11-12)

Filesystem access restored. `slim-worktree.sh` now passes. D-ZOO rebuilt successfully (source hash `71f158d2adc0f3649cf451249f8817bdee4a950d6ecfea0b792387118a517913`). The required smoke run on 4965/4966 completed: 5 passed, 1 failed because L8 load rejects road lane overlaps for crowd-fence placement IDs 2007, 2008, 2022, 2023, 2024. These overlaps must be fixed before playthrough. Latest lint and main TypeScript check pass; mission scenarios remain 5/6 with Hale charge distance Infinity. Earlier pass above predates the final elephant geometry and is superseded. Threat audit reported tunnel-breach first attack 30.45 s; remote checks and captures remain pending. None of these pending validations belong to part 2; they remain required for this lane.

Rebuild continuation: corrected appended placement allocation after filtering (duplicate fence IDs were detected during mission loading). Build succeeded with hash `e1b0021815b05f3829739f45974a0ba1f728fd50dbd4a00e44d88b7525d5e46a`; generated placements now have zero duplicate IDs. Elephant gate openings widened for the vehicle lane, obsolete western through-road edge removed. Runtime checks still pending.

Finale/route continuation: fixed the Hale charge story predicate to use the bounded elephant arena instead of the external vehicle door. Focused mission test then passed Hale assertions and advanced to route checks. Arena zones now match actual fence lines (previous inset left followers outside the declared zone after crossing). Latest mission failure is zebra containment at `(44.8,13.1)`, outside the compact pen; remains unresolved. Remote nightly job `s60-l8redesign-990e7a-31995-1794443133` reports high/low wave census failures with east-outlet infected stuck emerging; full job still running at this entry.

Remote nightly completed (exit 1, 436.57 s): 5 passed, 4 failed. Failures: asset inventory (14 supermarket validation errors), placement vs solids (170 new L8 overlaps), high/low wave census (L8 east tunnel authored/admitted mismatch and emergence failures; high also L2 23/24 reached). Reports and failures must be addressed or proven pre-existing; checks are not green. No checks remain running.

Calm animal placement now places lions, gorillas and zebras inside their compact pens instead of outside their new fences. Latest focused test stops at the earlier tour visibility assertion (animal 397 at 20.69 m, limit 18 m); Nadia tour stops need adaptation to compact pen positions before containment can be rechecked. No checks running.

Tour continuation: routed Nadia to public viewing stops at the compact pens; the lion stop waits for courier proximity before its line. Calm tour limit and story fixture allow 180 s for the longer fenced route. Latest mission run passes tour, Hale and route assertions, then fails the later corpse detour fixture (`queue head beside the elephant finds a way out`, missions.test.ts:203). This fixture/exit obstruction needs diagnosis; no tests running.

Boarding fixture continuation: the corpse-detour fixture restored sanctuary, leaving the new elephant exit locked. It now sets arena phases cleared for boarding and restores them afterward; corpse detour assertion unchanged. Local missions test passes 6/6 (60.07 s), and `npm run typecheck` passes. Required remote `npm test` attempted with 150/150 registered cases; failed on its 240.7 s budget/235 s reservation limit before completion, with reported vehicle, L4 contact, world-systems, navigation and player failures. These need base-revision comparison; not declared pre-existing. No processes/checks remain running.

Overlap cleanup in source: local solidOverlaps scan reproduced 170 new pairs, mostly duplicate flamingo side fences, elephant west boundary, and dressing. Layout now reuses continuous flamingo sides, extends the elephant west wall only beyond the existing enclosure, and filters dressing/obsolete panels beneath appended fences after allocation. Python syntax passes; rebuilt geometry and overlap rerun still required. No check running.

Overlap cleanup validated: D-ZOO rebuilt successfully (hash `aaa45821b0c28c04b5c710574ef66a668e1a87d88543f050cd8ee5ac0355f362`). Generated placements have zero duplicate IDs. Local tier-5 solidOverlaps scan using nightly predicate/baseline reports zero new overlaps (previously 170). Focused mission suite passes all 6 tests against rebuilt geometry (52.12 s). Full nightly tiers, smoke, audit and real-input captures still required. No checks running.

Post-cleanup smoke: `E2E_PORT=4965 SCENE_PORT=4966 npm run test:smoke` PASS, 6 QA browser tests + 1 public-build test, 148.2 s. Uses e2e-lock and headless pooled browsers, max 2 workers. Earlier road-overlap load errors no longer occur. Marker-follow real play, captures, threat audit and final nightly/full-suite resolution remain pending. No check running.

Real-input attempt 1: `r28-vqa-fixture-play.ts http://127.0.0.1:4965 level:L8 --backend webgl --zoom 1 --seconds 180 --shot 15 --follow-marker`, through e2e-lock, one headless browser, god OFF. Completed without browser errors; tour/breach/hold reached sealed checkpoint, ended 6 m from flamingo entry marker. Does NOT satisfy flamingo→lion→monkey acceptance. Opened captures `play-start/s001-t901.jpg` (marker on paving, but entrance path has visible open grass beside it) and `play-start/s011-t9940.jpg` (plaza hold marker extends across grass). These expose unfinished path boundaries/paving and must be corrected. Captures/log retained in play-start/. Preview server stopped; no check running.

Capture-driven source changes: arrival boulevard lawn edges now have appended fixed fences at x20.9/27.1 (junction openings retained), and plaza hold floor is light paving throughout its bounded 28x24 m space. Python syntax passes. Rebuild/overlap checks and visual rerun required; remaining route segments still need perimeter audit. No check running.

Boulevard/plaza rebuild passed (hash `3a61aaad8c5d7907c00393fc0f9a564f0bdf148d8c2021b05cf37afc01bd7b07`); local nightly-equivalent placement scan reports zero new overlaps at every tier 0–6. Subsequently fixed source route inconsistency: monkey east exit now connects by paved spur to x24 boulevard, zebra waypoints follow that boulevard rather than returning through closed monkey entry. Added corresponding fence openings. This subsequent connection still requires rebuild and real play. No checks running.

Monkey exit connection rebuilt successfully (hash `1efeae9906c94b03e02d0c0cb301b25e7695df4a9ff8ec633dd7c7757a11392c`). Tier-5 nightly-equivalent overlap scan: zero new pairs. Mission scenarios: 6/6 pass, 72.28 s. Marker real play and smoke after this rebuild still pending. No check running.

Current threat audit completed: breach first attack 4.58 s, wave flags none, passive gameplay flags none. Overall command exit1 with `L8/INCOMPLETE_NATIVE_POLICY:tick-budget` plus `PARTIAL_LEVEL_SELECTION`; not green. Skilled policy ran 258.365 s and did not complete the native route. Receipt copied to threat-audit.md. Earlier first-attack-over-20 failure is superseded. No checks running.

Native-policy timeout diagnosis: elephant engagement required Hale within 2.5 m of the external vehicle door, but the new staging routine only approached that door after all arenas cleared. Removed the circular precondition; route-open + courier-in-pen still gate engagement, and engagement stages Hale inside the bounded pen. Focused mission suite passes 6/6 (51.07 s). Full native threat policy rerun required to verify timeout resolution. No check running.

Circular prerequisite regression verified: story fixture now starts Hale at `(96,36)` outside the elephant pen, away from the vehicle door, and still observes the real elephant charge and Hale handover. Mission scenarios pass 6/6 (50.92 s). Native audit rerun remains required; this is focused coverage only. No checks running.

Threat rerun after circular-start fix: skilled native policy COMPLETE in 86.385 s; passive gameplay flags 0. Only top-level flag is `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, mechanically emitted for the explicitly requested `--levels L8` scope. Command exits1 for that scope flag, so literal zero-flags command remains impossible without campaign-wide selection or changing audit reporting. Receipt updated in threat-audit.md. Native-policy timeout resolved. No checks running.

Wave census expectation now snapshots initial outlet connectivity using the same pre-breach rule as production instead of assuming the east outlet always has zero initial arrivals. TypeScript passes. Local waves test remains red: L8 east initial cohort reaches 1/6 high, 1/3 low; high L2 reaches 23/24. Emergence failure is retained and unresolved, not masked by the count correction. No checks running.

East queue diagnosis: mission remains playing. All unreached east residents retain `leg:-1` with empty route and no pending-admission flag, while first resident leaves the walking list. High queue IDs440–448 remain at x101.98..99.18,z32; low IDs434/436 similarly. Temporary diagnostics removed. This narrows the fault to doorway walking/correction, not authored count or mission failure. No production change yet, no checks running.

East queue progress: isolated trace showed first handoff at apron x98.5 blocked later walkers. Tested shared porch tolerance; it did not help and was reverted. Added east service waypoint `(96,32)` on boulevard before AI handoff. Wave rerun: low census passes (east3/3), high east improves to5/6; one walker circles near `(96.44,31.41)` still emerging. High L2 remains23/24. Wave gate not green. No checks running.

East endpoint resolved: finishRoute stall detection now measures progress toward the current waypoint, so sideways crowd circling no longer resets the existing90-tick native-AI handoff. No movement/stat tuning or relocation added. Local wave census: every L8 initial and regional cohort reaches full count on high and low (east6/6 and3/3). File still red solely for high L2 market23/24. Mission regression/typecheck and remote nightly rerun needed after shared emergence change. No checks running.

Post-emergence regression validation: `npm run typecheck` PASS, `npm run lint` PASS, focused mission suite6/6 PASS (166.61 s, notably slower than prior runs). Existing porch admission, service-route obstruction handoff, route gates, story and boarding assertions remain passing. Real-input extended play remains next; no processes/checks running.

Extended play attempt2: from level:L8, zoom1, godOFF, follow-marker, planned420s, captures in play-route/. Confirmed stall at flamingo entry `(0.2,-17.5)` outside zone while marker sits at gate. Opened s006-t10821.jpg. Ended own run early after observing stall and stopped own preview. Fixed marker approach: within4m of final gate node it advances3m through gateway toward arena centre, remaining on entrance paving; once inside normal centre marker applies. Typecheck PASS. Real-input rerun required; attempt2 does not meet acceptance. No checks/servers running.

L8 fixtures repacked with native `make-checkpoint.ts --what qa --qa-parts l8 --out tests/fixtures/saves/qa`: lion, monkey, zebra, gorilla, elephant and elephant-engaged (6 saves). Removed stale zebra.gz that would shadow newly generated zebra.br. Direct fresh `level:L8:sealed` targeted play was unavailable (unknown saved snapshot), so no shortcut play evidence claimed; browser/server stopped. Full-start rerun still required. No checks running.

Full-start real-input attempt3 completed420s (play-route-v3/, webgl, zoom1, godOFF, follow-marker). Gate-marker fix works: arena-flamingo engaged. Did not clear flamingos or reach lion/monkey; checkpoint restarted and final counter3/8 Phase1. Errors[]; max frame166.6ms,p99 16.8ms. Opened s007-t12623.jpg: birds and focus marker outside light arena floor, whole arena not visible; player sampled x-14.7 beyond declared pen edge. Objective still has appended phase/name text. Acceptance FAIL; requires placement/confinement/framing review, no stat changes. Preview stopped, no checks running.

Capture fixes: calm flamingos/routine points moved inside entry edge; reinforcement rings capped at9.5–10.5m with1.5m clear search (formerly up to15.5m beyond14m pen). Flight count/HP/attacks retained. Added short pond viewing stop to Nadia route; tour and bite visibility assertions pass. Removed appended arena-name/phase objective suffix. Gate arming now waits for followers1m inside zone to avoid closing on a follower at exact boundary. Mission scenarios6/6 PASS55.07s. Visual framing/confinement and full-start rerun remain unverified. No checks running.

Arena framing source change: GameView uses existing encounterScale and pull controls for active L8 pens, centres on route-zone midpoint and widens4.5x at landscape default zoom (additional width compensation in portrait). Clears framing after arena completion. Default19m/25deg follow view could not fit28m pen. Typecheck PASS. Visual fit/readability validation pending; factor must be judged with actual capture before acceptance. No check running.

Targeted lion framing attempt60s (play-lion-frame/, zoom1,godOFF,follow-marker) completed errors[] but did not engage arena. Opened s005-t3088.jpg: player followed marker across dark lawn. Cause: resumed before-lion position near habitat initialized new leg at pond-side node0. New-leg initialization now chooses nearest authored waypoint rather than always0; typecheck PASS. Visual framing still not verified. Preview stopped; no checks running.

Lion framing attempts2/3: marker-only60s and explicit-keyboard-route90s both completed errors[] without engaging arena. Fixture starts `(-41.3,-53.1)` off path with persisted stage/node; nearest-node initialization does not repair an already-persisted route pointer. Explicit route became blocked outside northeast enclosure side; no camera-fit claim. Fixtures require waypoint-safe capture positions, and path geometry needs real traversal audit. Preview stopped, no checks running.

Fixture-route correction: L8ArenaBot now approaches phase0 arenas via production l8-route marker, rather than taking straight nav shortcuts to entry. Generator captures within5m (was20m) and includes flamingo. Typecheck PASS; native generator successfully completed all7 fixtures in/tmp/s60-route-fixtures, copied into tests/fixtures/saves/qa. This replaces off-path lion snapshot; targeted visual confirmation still required. No checks running.

Regenerated lion fixture visual run45s (play-lion-frame-v4, godOFF,zoom1,follow-marker) cleared lion and engaged monkey, errors[]. Opened s001-t670.jpg: entire inner lion pen visible at zoom1, short Kill lions0/2 objective; actors small and floor dim, visual-quality acceptance not claimed. Opened s004-t2490.jpg: paved monkey approach. Lion fit established for this landscape frame only; all-arena/portrait/full-start validation remains. Preview stopped, no checks running.

Arena edge source pass: added14cm emissive warm-white ground strips inside each28m pen using existing palette emissive material, visual only. Extended monkey/elephant floor boxes to full28x28 pen footprint (previous24x24/28x26 left edge strips of lawn). Python syntax PASS. Rebuild/smoke/visual verification pending; not claimed illuminated-floor acceptance. No checks running.

Edge-strip/floor rebuild PASS hash`dbb1e2b9e6abeec553ab899627f37e2b6c42cb859c62562a97ccdfc79d761d0c`. Generated placement list exactly unchanged (IDs/TRS/metadata), zero duplicate IDs. Required post-rebuild smoke PASS:6QA+1public tests,145.2s,ports4965/4966,headless/e2e-lock. Visual edge-strip readability remains to inspect. No checks running.

Current full-start attempt5 (play-route-v5/,zoom1,godOFF,follow-marker): reached flamingo20/26, then checkpoint restarted3/8; stopped own run after repeat failure. Opened s007-t12620.jpg: complete glowing arena perimeter fits, but live birds remain outside pen on entry approach; confinement acceptance FAIL. Did not reach lion/monkey. Retained inspected capture in git. Both run and preview stopped. Remaining root issue is live encounter confinement/entry group flow, not camera fit alone.

Outside-flight root cause found: flamingo encounter centre remained old`(-6,-27)` while physical pen centre is`(0,-32)`. Reinforcement rings were therefore still offset beyond west/south fences. Aligned encounter centre to pen midpoint; max10.5m ring+1.5m clear search now fits within14m half-width. Mission suite6/6 PASS69.16s. Live confinement/full-start replay still required. No checks running.

Continuous full-start attempt6 completed390s, godOFF,zoom1,follow-marker: cleared flamingo and lion, ended monkey3/7, errors[], maxframe50.1ms,p9916.8ms. Opened/retained flamingo s007-t12638, lion s010-t18061, monkey s012-t21668 captures; all3 lit pen outlines fit landscape zoom1. Sampled stationary travel interval maximum3.08s (3s samples; not exhaustive stall proof). Full route confinement/remaining arenas not proven. Final remote nightly completed296.08s,6pass/3fail: placement-vs-solids now PASS across all tiers; asset inventory supermarket errors persist; high L2 market23/24; low L8 region-north-outlet2 admitted3 reached0. All processes stopped.

North cohort routing fix: default north service endpoint now public path `(0,-56)` so sealed-region reinforcements avoid closed flamingo exit. Initial unsealed north cohort (including carrier/K9) retains original pond-shore per-walker route to preserve keeper/bite story. Census uses each walker override endpoint when present. Before final initial-cohort restoration, waves showed all L8 cohorts reaching full counts; after restoration mission6/6 PASS158.18s. Wave recheck required. No checks running.

Final local wave recheck after north split: all L8 initial/regional quotas reached on both tiers; only high L2 market23/24 fails file. Typecheck/lint PASS. Minimap visibility defect found: node() sets data-testid but CSS expected class; assigned arena boundary className. Visual map confirmation pending. No checks running.

Baseline provenance: archived base73db6c05 source/tests/tools/layout route data into/tmp/s60-baseline-source, linked unchanged public inputs for L2, ran original nightly waves. Reproduced identical L2 high24admitted/23reached, identity216 unreached. This proves L2 failure predates lane source changes; shared current D-ZOO means baseline L8 result is not a valid full baseline. Asset inventory supermarket inputs (all6GLBs), manifest and tools/assets/validate.ts also unchanged vs73db6c05; only public asset diffs are D-ZOO pair. Overall mandated checks remain red; no baseline exceptions silently granted. No checks running.

Inter-arena confinement source pass: appended fence verges on north/south connectors, lion→monkey path, gorilla approach and east service lane, with junction/gate openings retained. All existing IDs allocated before these additions. Python syntax PASS. Rebuild/road validation/overlap cleanup and real-input attempt to leave paths remain required. Junctions not yet proven one-way; no completion claim. No checks running.
