# PO bug triage — L1–L5 and shared figures/HUD/camera

Audited main base `305071ff2` and current `lane/triage-a`. Prior-fix commits cited below are ancestors of the main base unless explicitly described as a source report. The original backlog is `/Users/wesner/Workspace/minorincident/epics-pipeline/po-bugs-1019.md` (10-30). Early unprefixed issue numbers retain their `#` labels; later IDs retain `Q-`. QA13a–13h citations refer to the explicit “Confirmed fixed” sections of that source backlog; later reports and source changes are checked separately. No issue is closed merely because a later note omits it.

Scope: every L1–L5 issue plus shared figures/animation/gear, companion, corpses, HUD/aim/carried weapons, camera and load times. Environment/vehicle/combat-flow-only L6–L10 issues belong to triage-b. Mixed issues explicitly state the portion reviewed. L5 balance and all camera framing values are frozen; corpses persist.

## Item ledger

| ID | Status | Evidence / open cause and proposed fix |
|---|---|---|
| #1 | fixed | c28100287 retracts the corgi tongue at rest and adds panting gates; current corgi-tongue-female is in scene:gate. |
| #2 | fixed | docs/reports/visual-polish/README.md: non-model fists/kick return no geometry, ActionView skips them; later QA13a confirms no chest box on either survivor. |
| #3 | fixed | e2cfdec8b and e9936b0be keep jointed pet-dog legs attached; docs/reports/polish-26/q206.md later proves all paw contacts (26-row dog matrix). |
| #4 | fixed | f5769d973 anchors ambient leaves in world space; leaf/crowd/ground-blood visual fix is retained in history. |
| #5 | fixed | docs/reports/visual-polish/README.md: raised Grove sidewalk is excluded from the lens cut; exact PO-spot before/after pixel check changes zero support pixels. |
| #6 | fixed | QA13a source check confirms W forward, A left, D right, S brake; current Bicycle keyboard intent retains this mapping. |
| #7 | fixed | QA13c confirms corgi inside the bay at shutter closure; later collision registry station-ingress fixtures retain companion clearance. |
| #8 | fixed | docs/reports/l2-axe-objective.md and QA13c confirm the axe ring in open ground; current station-local l2-axe-rack uses the clear apron point. |
| #9 | fixed | QA13c2 fixes relative depth; QA13e then confirms #47's authored firefighter placement moved clear so both depth and start visibility are covered. |
| #10 | obsolete | The old rigid courier/accessory model was replaced by the textured skinned heroine and fitted gear. docs/reports/courier-gear-tex/README.md and current gear/turn animation gate rows cover the replacement; the old disc/shin-ring model is no longer shipped. |
| #11 | fixed | NPC panic contagion is in the shared NPC system; c1265b2e1/3434d3c2c retain emergency panic and fleeing civilians instead of despawning them. Current scene ped-bitten covers reactive crowd state. |
| #12 | fixed | L2 street groups and staggered multi-door ambush are authored in src/data/l2.ts/LevelTwoRescue; 76dd3aa91 further separates the escape encounters (Q-155). |
| #13 | fixed | Shared infected AI uses individual target/attack slots and nearby civilian selection; c6f78509a records the zombie-AI lane and its L2 pursuit/stuck evidence. |
| #14 | fixed | c6f78509a and b52dd3da5 implement distributed pursuit/navigation/slot escapes; route progress and collision guards remain in tests/engine/infected-ai.test.ts. |
| #15 | fixed | QA13c2 confirms joined corners; 4b9e4a3f7 later closes deck seams and adds lane paint, with L3 ramp catalog captures. |
| #16 | fixed | c6f78509a plus 3b85692f fixes route starvation/pocket escape; docs/reports/sim-triage.md records max unintended stop 8.4→3.2 s on the reported L2 family, and current inf-chase-l3 gate covers L3 motion. |
| #17 | fixed | LevelThreeCollapse uses the PO fifteen-second evacuation wait; the current source and L3 mission gate retain it. |
| #18 | fixed | QA13a observed MP pickup and war activation on the same tick 2024. Current L4 exterior breach redesign retains pickup as the alarm trigger. |
| #19 | fixed | docs/reports/collision-registry/README.md and l4-no-tents/review.md: shared solids apply to all actors; authored breach openings change topology instead of allowing wall pass-through. |
| #20 | fixed | 8ddb5c387/de436991c/7decc332a replace wrong-way keyboard targeting with face-direction ray-closest assist and real-key ±25-degree cone checks (Q-196). |
| #21 | fixed | docs/reports/visual-polish/README.md retains full authored Alpha corpse bodies; fixes-13k-visual/README.md and current textured L4 deliveries remove the later boots/slabs representation. |
| #22 | fixed | 54a880c59 and docs/reports/l4-no-tents/review.md: retained large Alpha/Mega bodies participate in cheap shared solid queries; courier/corgi stop 1.351 m from an Alpha; no full corpse physics is added. |
| #23 | fixed | docs/reports/alpha-variants/README.md and l4-all-new/README.md retain deterministic distinct Alpha looks, shared size/gameplay and live/corpse appearance coverage. |
| #24 | fixed | docs/reports/visual-polish/README.md: quiet cower/hug/glance/look gestures vary by actor and hashed phase. 249580fc1 also clears cower when the last nearby threat dies. |
| #25 | fixed | QA13a measured polar 53.9–54.0 degrees in 1,331 samples; shared HUD row repaired in vfx-hud-polish. Corpse persistence is retained by 5a0b1927e and current StaticCorpses pages; no corpse deletion is introduced by this lane. |
| #26 | fixed | QA13c2 confirms the courier rendered behind the shutter at ground height for both survivors; station ingress/depth and normal support checks remain. |
| #27 | fixed | docs/reports/collision-registry/s3/README.md and s4/README.md cover full companion footprint/contact, fences and wrecks; f6416ad38 also fixes courier/corgi reveal and newer dog matrix checks attachment. |
| #28 | fixed | docs/reports/courier-night-look/README.md, visual-polish/README.md and f019eccb0 preserve hue-true night skin/clothing and readable follower lighting; current L5 all-new figures supersede old bleached bodies. |
| #29 | fixed | docs/reports/visual-polish/README.md, alpha-white/README.md and l4-all-new/README.md: closed surfaces, full hero Alpha detail and bounded non-white hit flash; all shipped crowd figures now use skinned paths. |
| #30 | fixed | docs/reports/vfx-hud-polish/README.md: cyan wire guides removed; retained authored service-gate and depth-tested yellow floor guidance; 60/60 scene matrix and 16/16 HUD cases. |
| #31 | fixed | docs/reports/vfx-hud-polish/README.md caps distinct imminent attack warnings at three and merges overlapping lanes; L1/L3 carpet fixed without changing attacks. |
| #32 | fixed | docs/reports/visual-polish/README.md: droplets 1.8–3.5 cm, ≤180 ms; lasting blood uses supported decals/splats. Q-143 retains the separate later square-shape concern. |
| #33 | fixed | docs/reports/vfx-hud-polish/README.md snaps follow-camera history across level teleport; 496ce0572 adds the cellar dip-to-black and courier-following Metro ending. |
| #35 | open | Partial historical fix f221d744c dresses the exterior yard, but the current actual L5 start capture (playtest/captures/continue-L5-L5-t11.jpg) still shows the cellar staging set beside bare map-edge ground. The post-emergence Harbor Street fixture is dressed and does not close the starting shot. Proposed fix: extend the visible cellar-stage ground/yard dressing and boundary coverage, then review L4 ending plus L5 start with unchanged camera; authored environment work exceeds a safe local edit. |
| #36 | fixed | docs/reports/vfx-hud-polish/README.md reserves Sound/Controls outside health/objective HUD and cinematic bars; high/low desktop/phone 16-case browser checks passed. |
| #37 | fixed | QA13c2 spreads L7 arrivals into rows; shared HealthBars followerBarCap=6 suppresses healthy large-group bar grids. Later L8 arrival routines replace the initial stiff crowd. |
| #38 | fixed | docs/reports/vfx-hud-polish/README.md gives foliage a six-metre subject-space opening; exact foreground cherry stress fixture reviewed across both backends/tiers/zooms. |
| #39 | fixed | docs/reports/vfx-hud-polish/README.md fully clears the solid mask inner disc; exact fire-station wall fixture removes the retained opaque core. |
| #40 | fixed | docs/reports/visual-polish/README.md skips render geometry for non-model actions and empty geometry warm-ups; QA13b records zero placeholder/missing-position messages in nine runs. |
| #41 | fixed | f6416ad38 closes the L4 generator pocket; current collision-placement and no-tents layout preserve a traversable courtyard. |
| #42 | fixed | f6416ad38 includes foreground lamp heads in the reveal mask; camera framing values unchanged. |
| #43 | fixed | Non-model ability.corgi-lure follows the same ActionView/registry skip as fists/kick (#40); no rendered placeholder geometry is created. |
| #44 | fixed | f6416ad38 explicitly preserves corgi night colours; later 26-row dog matrix and current pet materials retain orange/white separation. |
| #47 | fixed | QA13e confirms start-courier visibility after repositioning the firefighter from the camera line; source QA13c2 separately proved correct depth. |
| #48 | fixed | 5f0749fbf directly fixes #48: only upward-facing support surfaces retain the foot-level band; foreground vertical wall bases are cut. Targeted current fixture stunning-cut-l5-pharmacy.json retains the exact PO location. |
| #49 | fixed | 496ce0572 follows the courier through the closing Metro shot instead of retaining the off-screen scripted ingress target. |
| #50 | fixed | 5f0749fbf directly fixes #50: pharmacy and supermarket near-black roof decks use asphalt; low pharmacy statics are rebaked. Both exact-location stunning-cut fixtures remain in the catalog. |
| #52 | fixed | QA13e and docs/reports/objective-clarity/README.md show all five gold discovery rings using the real search anchors. |
| #53 | fixed | QA13e confirms no medkit rings; survivor search markers remain gold and use discovery state. |
| #54 | open | Current shotgun probe reproduces a 1.8 m single-tick move at frame 7, followed by death-back frames 8–32 (review-shotgun-webgl2-high/metrics.json; sheet viewed). Damage/SimWorld.knockback applies the swept endpoint immediately; CivilianCrowd places the fall at final corpseLayout coordinates. Proposed fix: retain and animate the actual swept path through both crowd renderers, with body-picking/grounding/corner-clearance checks. Simple endpoint interpolation can cross clipped corners; shared pose/placement work exceeds a safe local edit. L5 combat values remain frozen. |
| #55 | fixed | docs/reports/survivors-ai/report.md records the PO-authorized rings prerequisite adding nine lone shamblers (27 high opening count), with caps 30/30 and other L5 tuning retained. This triage changes no L5 balance. |
| #56 | fixed | docs/reports/survivors-ai/report.md: eight scenery guns become group pickups within two metres; serialized allied weapon and held prop survive handovers. |
| #56b | fixed | Same report explicitly verifies survivor weapon persistence through L6/L7/L8 and rebase of attack/reload timers. |
| #57 | fixed | docs/reports/survivors-ai/report.md: generated visible-wreck support bake, current-height-layer sampling and full corgi paw footprint; discovery rings use their own supported ground height. |
| #58 | fixed | 21446620c: any infected hurt by courier/ally/companion hunts the shooter for twelve seconds, including out-of-sight Alpha/Mega; docs/reports/alpha-aware-all/README.md. |
| #59 | fixed | 845b56c49 / docs/reports/l5-metro-alpha.md: real-input Metro finish, follower ingress before cower and retained Alpha territory; three full five-survivor runs pass. |
| #60 | fixed | 4d04205f6 and 7d354004c retain every live follower/corgi ingress before shutter seal; docs/reports/l5-metro-alpha.md and Q-232 five timing runs verify closure. |
| #61 | fixed | 8b0a695c1 and docs/reports/weapon-carryover.md preserve all acquired weapon racks through each campaign boundary, including shotgun L5→L6. |
| #62 | fixed | docs/reports/hitches2/report.md: stable light/fog graph warm-up; all twelve native timing cases below 100 ms, including headlamp-equipped L6 exit. QA13e2 confirms 0 frames >200 ms. |
| #67 | fixed | 040db7bda enables equipped-rocket zoom to 2.0; 69f2425b2 preserves it through Cure checkpoint saves/resume. This triage changes no framing values. |
| #68 | fixed | 115052f63d retains the direct PO #68 ground-height correction in GameView: destination ring uses the district support height rather than y=0. RayCursor resolves that same height field; 9b57bb3fa adds corrected objective-ring picking and reachable fallback. |
| #69 | fixed | Shared HUD portion only: HealthBars caps large follower groups at six hurt bars; dead/finished followers are ineligible. The L7 terrain-edge portion is assigned to the L6–L10 level lane. |
| #70 | fixed | docs/reports/survivors-ai/report.md: close-contact flee/fight runs before formation handlers; armed followers retain self-defence during grabs and resume formation. |
| #71 | fixed | Same report: fatal bites set actual HP zero; finished civilians cannot carry survivor bars even if a legacy snapshot has positive HP. Living grabbed/downed bars retain true HP fraction. |
| #72 | fixed | QA13e confirms blue follower radar dots; current Hud.place clamps off-radius followers at the rim. |
| #73 | fixed | docs/reports/survivors-ai/report.md: moving followers face displacement except an active in-range aim window, capped two seconds with a half-second travel-facing recovery. |
| #74 | fixed | docs/reports/l7-departure-p0.md and objective-clarity/README.md route the full live roster to queue slots and make waiting conditions visible; current offscreen recovery retains identity. |
| #75 | fixed | QA13e confirms weather badge below the radar; current HUD navigation layout reserves separate rows at desktop/phone sizes. |
| #76 | fixed | GameUI debug level list allows clicking locked levels; QA13g confirms debug L10 is playable and normal Continue works after L9. |
| #77 | obsolete | Source explicitly retracts the P0 as a stale driver ring. The residual gate-panel filtering is included in lane/p3-ui, retained by docs/reports/objective-clarity/README.md; no hidden seven-minute game soft-lock is established. |
| #78 | fixed | Metro physical arrival/ring fixes 845b56c49 and c2f48239f, plus current small-27/Q-232 timing receipts; L2 blocked click destinations use shared objective-clarity fallback and collision-registry routes. |
| #79 | fixed | 5a8c61f22 preserves courier appearance across all levels; current textured heroine rig/gear does not switch to a different L8 outfit model. |
| #80 | fixed | Current LevelSevenDeparture.recover permits hidden transition only beyond twelve metres and outside the frustum; visible followers use a continuous step-through. No visible actor snap is retained. |
| #81 | fixed | Shared presentation portions: vfx-hud-polish reserves readable HUD rows, fixes-13k-visual covers L7 skyline, 8ac48ff6d retains driver zoom/weapon, and current L8 all-new arrival routines replace old briefing crowd. Unnamed extras may intentionally retain Survivor N. |
| #82 | fixed | QA13e2 verifies low→high switching on both backends with zero errors and correct picture; stable light/shadow lists retain valid depth resources. |
| #84 | fixed | QA13g confirms the group marker remains constant over 360 held ticks after the exit-flap/hysteresis correction; zero errors in 24 matrix frames. |
| #85 | fixed | QA13h confirms intact real rocket-kill corpses, both backends/tiers and all gameplay zooms; current skinned frozen pages replace the old shard representation. |
| #86 | fixed | QA13f/13g confirm keys 1–9, selected rack/HUD and held model; key 1 provides innate fists from any rack. |
| #86b | fixed | Current src/assets/icons.ts and public/assets/icons/ supplies distinct handgun, MG, shotgun and rocket silhouettes; real-key QA13f/13g verifies rack icons and held models. |
| #89 | fixed | QA13g confirms fresh debug L10 and L9→Continue flow; debug save persistence now satisfies campaign invariants instead of writing invalid partial saves. |
| #90 | fixed | QA13g verifies L8 objective, arrow and minimap marker by tick 11 after L7 handover. |
| #91 | fixed | QA13g verifies key 1 chooses innate fists even when no fists slot is present in the progressed rack. |
| #92 | open | Low-tier L3 parapets remain a reported warped silhouette. assets/kit.highway-onramp/build.py applies DECIMATE at 0.12/0.035 to LOD1/2, including Jersey barrier meshes; no planar/corner guard is retained. Proposed fix: retain the barrier's planar/corner surfaces in its low export and inspect both ramp sides at gameplay zoom; asset rebuild/matrix work exceeds a safe small code edit. |
| #93 | obsolete | The old simplified palette corpse exports were replaced by skinned full-body deliveries and packed frozen pages; QA13h and later all-new figure reports cover real kill paths. Current contrast concern remains Q-247. |
| #94 | fixed | Fixed this lane 659138661: low quality uses LOD1, but the builder omitted side letters there. Retained EVAC text in LOD1 (4,966/6,000 triangles, no extra draw); viewed matched bus/before and bus/after captures. LOD0/LOD2 and decay exports retain identical hashes. L10 shelter-lamp portion belongs to triage-b. |
| #95 | fixed | QA13g confirms pipe bomb inside the fist (0 grip intersections, 0.045 m hand gap) on both couriers. |
| #97 | fixed | b9329683e / QA13h: early seat HUD explains breach countdown, counts corgi as a missing passenger and reserves space from vehicle armour; Q-156 addresses later duplicate text. |
| #98 | fixed | QA13h's real-kill WebGL2/WebGPU low/high/three-zoom matrix retains complete bodies and checks the CrowdView merge rule, rather than only synthetic settled corpses. |
| #100 | fixed | QA13h records zero >200 ms frames in a 54,314-tick L10 real-input run and ten-minute finale; later cold-load/held-weapon issues are tracked separately Q-227/228. |
| #103 | obsolete | Old low-poly corpse look replaced by current skinned assets/frozen palettes; the current corpse-look-close/alpha gate rows retain limbs and torso. New low-contrast findings are tracked separately Q-247. |
| #105 | fixed | Fixed this lane 92bba92ff. Reproduced actual touch/debug UI at 844×390: Home/portrait overlap 1,120 CSS pixels. Add Home to the existing debug-row margin selector. Viewed before/after landscape captures; bounding receipts prove 1,120→0, zero errors (review-phone-webgl2-low/). |
| #106 | fixed | 57ca497c3 fixes L1 retry checkpoints; the incident/bat route now resumes from the reached checkpoint rather than replaying the old distant walk. Full L1 playthrough is part of this lane's retained campaign run. |
| #107 | fixed | docs/reports/load-stalls/root-cause.md/profile evidence removes avoidable synchronous driver/catalogue waits; later q212-load worst-of-five L1 is 2.324 s. Original intermittent outlier was not reproduced and is not claimed as a captured cause. |
| #108 | fixed | 5df0cea8e fits shared headwear/hair to the bare brow envelope; current L1 all-new skinned identities and gate rows replace old hexagonal-head accessory placements. |
| #109 | fixed | docs/reports/small-27/README.md explicitly shows the walking clerk returning through the doorway; L1 handoff actor is retained instead of disappearing at parcel transfer. |
| #110 | fixed | Current L1 handover uses authored actor staging/return and parcel transfer; docs/reports/l1-all-new/README.md retains old/new story-sequence captures. No handover animation is changed by this triage. |
| #111 | fixed | ba8076cba parks the bike only on the courier's side of fixed solids after dismount; recorded PO fence case is directly addressed. |
| #112 | fixed | 6b5ce9f37 adds the forecourt bench QA matrix; current station-local L2 benches and seated positions share matching anchors (src/data/l2.ts). |
| #113 | fixed | 4b9e4a3f7 fills raised ramp/deck junctions with flat unbevelled slabs and continuous lane paint; targeted L3 scene catalog retained. |
| #113b | fixed | Same two-sided ramp/deck fix and catalog as #113/Q-129/Q-133; both reported deck joins are covered. |
| #114 | fixed | 333006c53 keeps checkpoint ring and route diamond visible while the camera pulls back at the army line; fixes the delayed visible destination. |
| #115 | fixed | 249580fc1 clears stale cower, ce63f4ed6 gates it on nearby threats, and 5df0cea8e fits headwear; L4 all-new figures retain authored poses and readable faces. |
| #116 | fixed | d36352ae8 moves the tank route/stop clear of walls and parked props and adds a route guard. Current production controls-l4-tank-cadence also passes: viewed tank/shot-0180.png, hull clear of the military wall, zero console errors and convoy overlap frames. The fixture advances the route before sampling the firing post; no tank/camera change here. |
| #117 | fixed | Same later Alpha corpse pose/detail fix as Q-124, followed by skinned textured L4 deliveries; old slab/maw representation no longer shipped. |
| #118 | fixed | L4 exterior breach redesign in 54a880c59: announced wall attack at 19.9 s, measured ongoing mixed-cohort pressure in docs/reports/l4-no-tents/report.md, normal completed low/high playthroughs. |
| #119 | fixed | Same redesign routes cohorts through real wall breaches and moves defender hold posts; docs/reports/l4-no-tents/report.md and review.md retain mixed-crowd/courtyard captures instead of a static no-enemy barrier clump. |
| Q-121 | obsolete | The Mega is a persistent damaged creature, not a fresh full-HP spawn at console arrival. HealthBars uses current/max HP; later Q-200 removed staging teleport, so the original first-sight staging observation no longer defines an initial-health contract. |
| Q-124 | fixed | 5976d95c9 fixes corpse pose and near detail; docs/reports/fixes-13k-visual/README.md records reviewed Alpha/Mega matrices and runtime cases. Later textured L4 assets replace the old palette lumps (docs/reports/l4-all-new/README.md). |
| Q-125 | fixed | docs/reports/fixes-13k-visual/README.md: bar disappears at the first zero-HP frame, f53, in four runtime cases. Current src/render/HealthBars.ts also rejects zero HP, hidden and corpse entities. |
| Q-126 | fixed | docs/reports/fixes-13k-visual/profiles/after-summary.json: three real-input L1 maxima 16.8 ms and L2 33.3–33.4 ms, zero >200 ms; d841b6059 and 94d02693e warm the actual L2 occupants. |
| Q-127 | fixed | docs/reports/fixes-13k-visual/README.md: 48 reviewed L7 departure frames have continuous warm fog across the skyline; camera framing remains authored. |
| Q-129 | fixed | `4b9e4a3f7` (Q-129/Q-133) makes L3 ramp fills flat slabs and carries lane paint across the deck; ramp junction scenes were added in `45c87a98e`. |
| Q-130 | fixed | `4f8ac1292` prevents the ridden L1 bike frame from ending inside a prop; commit directly addresses the hydrant repro. |
| Q-133 | fixed | `4b9e4a3f7` fills both L3 ramp seams and carries the lane markings over the caps; same targeted scene catalog `45c87a98e`. |
| Q-134 | fixed | `698dd7875` applies driver camera widening to the L1 bike. No framing values were changed in this triage. |
| Q-135 | fixed | docs/reports/gameplay-13l.md: explicit one-second search prompts and first-frame pharmacy/bus arrow pixel checks; 52e43db3f separately moves Sam's bus ring. L5 tuning unchanged. |
| Q-137 | fixed | `52e43db3f` addresses the scripted vehicle transition and seated companion; committed `Q-137-green.json` evidence records the corgi/APC entry state. |
| Q-138 | fixed | `52e43db3f` changes companion fetch eligibility to exclude interaction pickups; committed `Q-138-green.json` verifies headlamp remains at its station. |
| Q-140 | fixed | `52e43db3f` moves the L5 bus survivor ring from the far side of the wreck to the visible approach (`src/data/l5.ts`); the lane retains Q-140 green probe data and a reviewed ring capture. |
| Q-141 | fixed | `52e43db3f` updates `l8-missing-survivor-guidance.spec.ts` to exercise physical boarding with passengers beyond the viewport and verifies minimap cue + sign-of-life guidance; the test saves a screenshot. |
| Q-143 | fixed | Fixed this lane 38822dba5. Real launcher reproduction identifies full-bright red BoxGeometry gibs, not blood alpha, as the squares. Faceted Lambert-lit clots replace generic boxes; viewed matched L7-preset before/after captures, draw max 33→33, zero errors. Corpses/physics/cap/lifetime unchanged (review-rocket-webgpu-high/README.md). |
| Q-144 | fixed | be003d807 fixes the camera (docs/reports/polish-26/q218.md). The counts describe different quantities/times: LevelSixSubway.result() returns final out/initial in, exit HUD counts the current living roster, and MissionUI.summary() sums rescued over all completed levels. No count equality is required between a pre-exit frame and cumulative campaign summary. |
| Q-145 | open | Current l5-po-metro-ingress capture still shows crowded silhouettes and a bare red shaft. Queue pitch is 0.6 m in LevelFiveAftermath.ingress, constrained by the short rear-wall clearance and the corgi’s opposite lane. Proposed fix: re-stage/widen ingress slots while preserving companion clearance and shutter completion, then dress the shaft interior. Coupled layout/collision/ending review exceeds a safe small edit; no L5 combat tuning. |
| Q-152 | fixed | `450ef1c83` prevents pointer movement during held attack from replacing an existing click-move target; verification is recorded in `df1b027d8` and `9a0acf00b`. |
| Q-153 | open | Cross-level hidden-wait feedback portion only: original campaign-06 records several distinct L7/L8/L10 waits. Some individual navigation/boarding cases have later fixes, but no current end-to-end receipt closes the entire list. Proposed fix: map each wait to mission progress telemetry and add actionable visible reasons; multi-level flow work is larger than a local safe fix. |
| Q-155 | fixed | 76dd3aa91 and 0f17709aa scatter market-to-bridge route encounters facing the approach (src/data/l2.ts and LevelTwoRescue.spawnRoute); Q-168 addresses the later low-tier density follow-up. |
| Q-156 | fixed | Fixed this lane in 055ef7fa2; verified 350456050. Viewed boarding/guidance.png: exactly one 0/13 aboard count, nearest missing name matches the Find cue and minimap pin. boarding/evidence.json records physical E boarding request and zero errors. |
| Q-158 | fixed | 8224f0b28 / docs/reports/weapon-carryover.md: physical key-4 handgun at L3 end remains selected in L4 handover and normal Continue; 78 progression tests cover every boundary/fallback. |
| Q-159 | fixed | `ce63f4ed6` makes civilians cower only near a threat and stages the L4 wall/breach as the action front; resolves the exposed plaza cower pose. |
| Q-160 | fixed | `ce63f4ed6` replaces the unexplained tent-origin attack with announced Alpha wall breaches; L4 no-tents report records the west breach at 19.9 s and mixed attackers at the front. `0b6b1bcb3` records completed route pacing (254.5 s, zero deaths). Evidence: `docs/reports/l4-no-tents/report.md` and reviewed opening/breach captures. |
| Q-161 | fixed | `d16bfd1a3` adds carried-gun firing while moving and empty-weapon fallback; addresses the MG selected across the L4→L5 handover with no damage. |
| Q-166 | fixed | L4 redesign and `6459bde5f` reduce the corpse carpet; `docs/reports/l4-no-tents/report.md` records only 37/50 bodies within 14 m at 150 s (low/high), courier visibility, and completed no-skip playthrough. Captures were reviewed in `docs/reports/l4-no-tents/review.md`. |
| Q-167 | fixed | Fixed this lane e140344a8, verified 4c12304a4. Viewed hud/hint-visible.png and hint-retired.png: instruction disappears after 180 active ticks while canInteract remains true; no other HUD overlap; zero console errors. |
| Q-168 | fixed | Fixed this lane 055ef7fa2, verified f9941fe79. Six solitary L2 route homes replace two pairs: high stays six, low four→six, caps/bridge quota unchanged. route/evidence.json proves static clearance and six actual low arrivals; viewed Juniper/Elm captures. |
| Q-169 | fixed | The former palette Alpha has been replaced by the skinned textured L4 Alpha deliveries; docs/reports/l4-all-new/README.md and the current corpse-look-alpha scene cover live, dying and frozen bodies. Q-247 retains the separate current contrast review. |
| Q-170 | fixed | `docs/reports/l4-no-tents/report.md` and `review.md` show an exterior west breach flood, with visible infected at the opening and a reviewed mixed horde at the breach. |
| Q-171 | fixed | `3014f5551` fits heroine tier gear and adds the ponytail crown limit; attachment-gap failure is directly addressed. |
| Q-172 | fixed | `3014f5551` plus the 180-degree run-turn fixture `43de3e972` addresses ponytail crown flip; commit includes the Q-172 fix. |
| Q-173 | fixed | L4 no-tents review captures show a readable mixed breach and courier through the pile; measurements in `metrics.json` and `report.md` confirm reduced body density compared with the regression (Q-166). |
| Q-174 | open | Shared HUD-name portion only: generic Survivor N fallback remains, with no targeted identity closeout found. The 9 s batch14-fix comparison predates the reported 56 s wait and cannot prove it fixed. Preserve known names through the passenger identity pipeline and check a named/unnamed mixed roster; L7 boarding/navigation itself belongs to triage-b. This needs a multi-level identity/boarding trace, beyond a safe isolated label edit. |
| Q-175 | open | Original 3 m close capture shows torn leg slivers/inside-out faces; gameplay-zoom zebra deliveries do not close that extreme view. Suspected source: skinned leg topology/weight ownership; exact bad faces still need isolation. Proposed fix: inspect the 3 m kick/run sequence, repair affected mesh/weights and rebuild both tiers, preserving gameplay. Asset/motion matrix work exceeds a safe local edit. |
| Q-176 | fixed | Shared fix 38822dba5, item-specific verification 129229796. Viewed matched real-rocket L10-night before/after captures: shaded irregular clots replace red rectangles; draw max 34→34, zero errors (review-rocket-webgpu-high/Q-176.md). Full corpses persist; no L10 gameplay claim is inferred from this isolated effect. |
| Q-177 | fixed | Current tools/playtest/startup.ts waits for explicit zoom acceptance after scripted intro and the pool releases contexts per level; source Q-226 closes corgi/epilogue driver diagnostics. Slow remote SwiftShader is a host/tooling limitation, not a figure regression. |
| Q-178 | fixed | `f019eccb0` fixes L8 player night readability with a hue-true brighter night key; this is the shared heroine appearance in scope. |
| Q-183 | fixed | `87102e52b`, `a25110b50`, and `f82481767` replace glove-band appearance with textured garment shells and retain enough low-tier glove geometry; evidence and captures are recorded in `626f5ea3e`/`a681480f6`. |
| Q-192 | fixed | L4 no-tents branch removes interior tent emergence; merged as `54a880c59`. Capture/review in `docs/reports/l4-no-tents/` shows exterior approach and announced breach pressure. |
| Q-193 | fixed | `54a880c59` includes the L4 skinned suit-crowd path; `docs/reports/l4-no-tents/review.md` and `suit-skin-proof.json` confirm connected suit surfaces in crowd and corpses. |
| Q-194 | fixed | The same L4 branch records six/seven visible archetypes and largest share 19.05%; mixed infected are visible in reviewed breach/courtyard captures (`docs/reports/l4-no-tents/report.md`). |
| Q-195 | fixed | The Q-192–195 merge `54a880c59` adds Alpha contact clearance; reviewed capture at z1/1.5 shows full courier visible alongside retained Alpha, with movement stopped 1.351 m away. |
| Q-196 | fixed | `8ddb5c387` changes keyboard fire to face-direction ray-closest assist; `de436991c` and `7decc332a` add browser/Scene Lab checks for the ±25° target cone. |
| Q-197 | fixed | `a42317316` recovers a lost WebGPU device; corpse-stall guard `bd7f9f61d` records a specific L1/L10 regression guard. Root cause was WebGPU device loss, not a sim freeze. |
| Q-198 | fixed | 8fdbd8c7e (merged 56efb6434), docs/reports/l8-start-weapon.md: legacy Continue and debug entry now preserve usable carried selection or choose the best usable owned weapon. 68 focused tests and 35 browser checks passed. |
| Q-199 | fixed | Replayed the exact retired webgpu-canvas reload check on current code: seethrough-gear-four → seethrough-door-gate, 250 ticks, WebGPU high. Gear 4→0 and 19 draws ≤ original 33 limit, zero errors (review-reload-webgpu-high/evidence.json). No budget was relaxed and no source fix was needed. |
| Q-201 | fixed | `41299f813` adds GPU-limit headroom for every crowd variant after the 17-attribute WebGL2 failure; `3eacd1b38` records the measurement lesson. |
| Q-203 | fixed | 58f9a5b13, docs/reports/q203-l4-respawn/report.md: hints use independent A*, six forced collapse respawns retain a 524-cell route, low/high real-input runs reach L5 without skips. |
| Q-204 | fixed | 1f74cbf6d, docs/reports/q203-l4-respawn/report.md: register armed allies before same-tick panic; 3/3 keep firearms at exactly +70 ticks on both tiers; death/conversion drops remain. |
| Q-205 | fixed | `2ffeac7a3` fits native hand-grip offsets; `384003631` aligns the floor contract; `7535cae53` records a close cane-grip comparison. |
| Q-206 | fixed | `60afe9da7` fixes planted paws in the live pet-dog trot. |
| Q-207 | fixed | `c2e8f2147` adds the L3 inf-chase fixture and polish; commit is the recorded Q-207 follow-up. |
| Q-208 | fixed | `8513ba415`, `710559d1f`, `0d027c668` remove runtime depth-node recompiles and add the L1 handover/outbreak smoke guard; evidence is the build-count comparison described in backlog. |
| Q-209 | fixed | `ab3a972bc` dissolves corpses inside the courier disc; `09c62db5c` guards carried-weapon shader builds. |
| Q-210 | fixed | ab3a972bc dissolves all nearby corpse pages in the courier disc without lifting her over curbs; 09c62db5c guards carried-weapon first builds. Q-211 is the subsequent rim-polish follow-up, fixed in c2e8f2147. |
| Q-211 | fixed | c2e8f2147 narrows the corpse-cut rim and prewarms withheld weapons; the axe's same-on-PROD first builds are covered by the current carried-weapon smoke guard. No gameplay frame regression was established by the original six-program observation. |
| Q-212 | fixed | 5ae023a8e + a7783a64c, docs/reports/q212-load/report.txt: worst of five L3 3.122 s, L4 3.952 s; matched batch21/main/fix matrix retained with zero late builds. |
| Q-213 | fixed | L4 suit crowd/corpse path is corrected in `54a880c59`; reviewed walkable-suit-pile capture and `suit-skin-proof.json` show connected surfaces instead of the black shard. |
| Q-214 | fixed | Explicitly recorded as fixed 10-29 by `a890e409c` (“Fix Q-214 blocked shared chase destination”). |
| Q-215 | fixed | Explicitly recorded fixed 10-29: 20 s jam not reproduced; 6.5 s continuous travel accepted. Evidence is the QA 23 timing runs referenced in backlog. |
| Q-216 | fixed | Explicitly recorded fixed 10-29 by `5df0cea8e` (hair fit on live and fallen civilians). |
| Q-217 | fixed | Explicitly closed 10-28 after a quiet-window rerun: 0/7 long frames; the prior 1–3 s samples were GPU contention. |
| Q-218 | fixed | `be003d807` fixes the L6 closing camera on the escaping courier; `4f6565c57` retains a reproducible baseline camera capture. |
| Q-219 | fixed | `8ac48ff6d` merges vehicle warm-up, driver zoom/weapon, and cold-load presets; backlog explicitly records Q-219 fixed on 10-28. |
| Q-220 | fixed | Backlog explicitly records the L8 lion look fixed 10-28 on `lane/l8-lion-look`. |
| Q-224 | fixed | A real Continue-resume check found the corgi present in ~90% of samples; the missing flag was the driver's draw-state probe, not a missing companion (`po-bugs-1019.md`, Q-224 resolution 10-28). |
| Q-225 | fixed | docs/reports/followups-25/ report and source backlog close the quiet L8 regression at 4.02 s median; L9 was -2%, not a regression. Render warm-up population and assets were corrected without gameplay changes. |
| Q-226 | fixed | Source backlog explicitly closes followups-25 tooling work: test-list orphan cleanup, timed epilogue waits and corgi draw observations corrected. These are driver diagnostics, not missing rendered companions. |
| Q-227 | fixed | Source backlog closes the held launcher warm-up in lane/l10-perf on 10-29; the quiet corridor pickup checks record no first-use builds. |
| Q-228 | fixed | Backlog records L10 cold load reduced to 5.26 s; later five cold loads were 4.84–4.96 s, closing the >6 s load issue. |
| Q-229 | open | L1 oversized hair has an explicit 10-29 fix, but L4 tent-roof concealment was only not reproduced. Current L4 still has tent roofs, so the no-tents redesign alone cannot close this mixed item. Proposed fix: recreate the exact L4 tent walk at z1.5 and inspect material/cut eligibility, then add the missing reveal coverage if reproduced. Root cause remains unisolated; do not change camera framing. |
| Q-231 | open | L1 stretched triangle was not reproduced in three targeted attempts (`fc1a1a20f`, `32dfe7803`); this is insufficient to prove the transient corpse-hair artifact fixed. L9 pallets and L10 lighting are outside this report’s level scope. Proposed fix: retain as intermittent until the exact L1 fall sequence is captured cleanly or a render-side cause is found. |
| Q-232 | fixed | `829167fc1` records five L5 Metro timing runs; shutter closed 0–1.45 s after final boarding, with the 7.4 s observation explained by the authored resident-view pause. |
| Q-235 | fixed | Backlog explicitly records the cured-survivor transparency/corpse-pile issue fixed before Q-236; spacing and tall mist dither were adjusted. |
| Q-241 | open | Only the shared L6 courier reveal is in scope. a4245303f improves it but the source backlog explicitly calls the dither change marginal. Remaining cause: screen-space stipple at arch intersections; proposed fix: inspect a matched arch/courier mask and tune edge coverage across both backends, preserving camera values and solid depth. Full visual assurance exceeds a small isolated edit. |
| Q-243 | fixed | `7f95341a2` records fixed Q-243 camera easing on level/checkpoint load; the current L10 camera lane commit snaps the framing transition without changing framing values. |
| Q-244 | fixed | `7f95341a2` records fixed Q-244 wide-zoom corpses; `c56ac3e82` keeps frozen corpses shaded at wide zoom. |
| Q-247 | open | Viewed matched-appearance fixture controls at L4 and L8-zoo (review-corpses-webgl2-low/): complete healthy/infected bodies retain clothes and green infected skin, but night lower-body edges remain low-contrast. These are controlled death states, not a natural-kill proof. Candidate cause: frozen/dead shading has less silhouette separation than the live body; exact material/light contribution needs isolation. Proposed fix: measure body/ground masks across real L4/L8 deaths, then tune corpse fill/rim without deleting bodies; lighting/art matrix work exceeds a safe local edit. |

## Counts and scope audit

185 in-scope items: fixed-before 162; fixed-now 7; obsolete 5; open 11.

Open IDs: #35, #54, #92, Q-145, Q-153, Q-174, Q-175, Q-229, Q-231, Q-241, Q-247.

Out of this lane: #34, #46, #51, #63, #63b, #64, #65, #66, #83, #87, #88, #87b, #96, #99, #101, #102, #104, Q-120, Q-122, Q-123, Q-128, Q-131, Q-132, Q-136, Q-139, Q-142, Q-146, Q-147, Q-148, Q-149, Q-150, Q-151, Q-157, Q-200, Q-202, Q-221, Q-222, Q-223, Q-230, Q-233, Q-234, Q-236, Q-237, Q-238, Q-239, Q-240, Q-242, Q-245, Q-246. These concern L6–L10 environment/vehicles/mission balance or process-only scheduling. Definitions, scope and statuses are retained in [scope.json](scope.json).

## Current lane validation

- `npm test`: **110/110**, 26 files; final run 40.1 s including budget collection ([log](test.log)). Budget collection is 150 cases (limit 150), 42 files (limit 45); no new test files/cases.
- `npm run test:smoke`: **6 QA + 1 public pass**, 181.8 s within 240 s, final runtime source ([log](smoke.log)). Earlier admission failures are superseded by this completed run.
- `npm run scene:gate`: **48/48**, zero known/zero not-run, 6.2 min ([final summary](checks/scene-gate-final/summary.md), [log](scene-gate-final.log)). An earlier pre-asset/final-VFX run also passed 48/48.
- Typecheck/lint both pass after the last diagnostic-helper edit ([typecheck](typecheck.log), [lint](lint.log)).
- L1–L5 physical-input/Continue tour: **5/5 finished, zero skips**, five deaths and one physical-route planning assist; four L5 survivors rescued. Raw one-P2 corgi-lure false alarm is retained and explained in [visual/story review](visual-review.md).
- [Audit receipt](audit.json): **234/234 definitions covered**, 185 in scope and 49 assigned out; no missing IDs, unresolved commit citations or nonexistent repository-path citations. Scope JSON retains every source ID, status and evidence.
- Seven fixed-now IDs: **#94, #105, Q-143, Q-156, Q-167, Q-168, Q-176**. Their focused reports link captures that were opened and reviewed. Implementation of Q-156/Q-168 is in the orchestrator's preserved WIP checkpoint 055ef7fa2, followed by separate item verification commits.
