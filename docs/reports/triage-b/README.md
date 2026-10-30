# Triage B · L6–L10, figures, corpses, camera, HUD, hitches and tooling

Source: `/Users/wesner/Workspace/minorincident/epics-pipeline/po-bugs-1019.md`, read 2026-10-30; audited against main `305071ff2`. Early bare numbers and `P1-N` are normalized to `Q-N` below. Referenced-only Q-179–191 are expanded from the cited QA16–18 reports. Each item has exactly one status; any unresolved subpart keeps its whole item **open**. A later green gate does not by itself close an unrelated visual symptom.

Scope includes every L6–L10 record plus the shared figure/corpse/camera/HUD/performance/tooling records. L1–L5 mission, AI, route and combat-only records remain on triage-a. Explicitly outside this ledger: Q-6, Q-7, Q-8, Q-9, Q-11, Q-12, Q-13, Q-14, Q-15, Q-16, Q-17, Q-18, Q-19, Q-20, Q-26, Q-35, Q-38, Q-39, Q-41, Q-47, Q-48, Q-52, Q-55, Q-56, Q-58, Q-59, Q-60, Q-78, Q-92, Q-106, Q-111, Q-112, Q-113, Q-113b, Q-114, Q-116, Q-118, Q-119, Q-129, Q-130, Q-133, Q-135, Q-140, Q-155, Q-158, Q-160, Q-161, Q-168, Q-170, Q-192, Q-196, Q-203, Q-204, Q-215. No source record is silently dropped: source IDs are partitioned by the table and this exclusion list.

Provisional counts: **159 fixed-before / 0 fixed-now / 9 obsolete / 24 still-open** (192 rows). Counts remain provisional until focused visual review and final checks are recorded. No L5 balance, camera framing values, corpse lifetimes or budgets changed.

| ID | Status | Evidence / root cause and proposed next action |
|---|---|---|
| Q-1 | fixed | `c28100287`: corgi tongue retracts at rest; panting follows movement. |
| Q-2 | fixed | `4dc60196f`: fists/kick/abilities no placeholder geometry; `3014f5551` and textured courier rollout replace the old attachments. |
| Q-3 | fixed | `e9936b0be`, `60afe9da7`: jointed pet-dog paw solve; attached legs and planted feet. See [dog motion proof](../polish-26/q206.md). |
| Q-4 | fixed | `f5769d973`: ambient leaves anchored to world positions, with walking comparison captures in [visual polish](../visual-polish/README.md). |
| Q-5 | fixed | `f5769d973`: removed the courier-following dither patch; batch 13b rechecked the original spot. |
| Q-10 | fixed | `3014f5551`: fitted heroine gear and ponytail; current textured courier replaces the old disc/rings mesh. [Gear proof](../qa-invariants/coverage.md). |
| Q-21 | fixed | `5976d95c9`, `05948cba6`, later v2 Alpha rollout; [reviewed near/far corpse matrix](../fixes-13k-visual/README.md). |
| Q-22 | open | Large Alpha bodies have solid footprints, but small bodies remain walkable (`InfectedSystem.settle`, comment “small human corpses remain visual debris”). Full crowd/soldier footprint steering with chokepoint escape and determinism needs >1 h; proposed fix: spatial corpse-footprint avoidance with a tested clearance fallback, preserving every body. |
| Q-23 | fixed | Five ordinary Alpha and three Mega appearances are shipped; `3014f5551` attachment work plus [L10 native variant census/review](../l10-all-new/README.md). |
| Q-24 | fixed | `f5769d973`: varied waiting clips and phases; `ce63f4ed6` removes unthreatened cowering. [Visual polish](../visual-polish/README.md). |
| Q-25 | fixed | `67201663f` synchronizes large follow-camera jumps without altering framing; [HUD/camera proof](../vfx-hud-polish/README.md). Corpses remain persistent; visible/downed counters are distinct from permanent-body counts. |
| Q-27 | fixed | `f6416ad38` fixes courier/corgi reveal; `73895e42e` adds grounded wreck-roof routes; `60afe9da7` verifies the live pet's foot solve. [Dog matrix](../polish-26/q206.md). |
| Q-28 | fixed | `8c441c909` preserves courier colours; `65683baeb` protects corgi orange/white; [L6 v2 cast](../l6-all-new/README.md) includes fitted, matte bandages and night-reviewed followers. No global grade change here. |
| Q-29 | fixed | `0893faa11`, `32887e065`, `ef19a7563`: hit flash scales original albedo and stops on corpses; `3014f5551` and v2 crowd rollout preserve body surfaces. [Actual Alpha review](../q231-p3/README.md). |
| Q-30 | fixed | `a94c0f620`: solid steel-mesh service gate; `67201663f`: yellow floor guides replace cyan debug boxes/rings. [60-row visual proof](../vfx-hud-polish/README.md). |
| Q-31 | fixed | `67201663f`: three primary nearby warnings with merged lanes and a bounded suppressed-opacity budget. [Reviewed telegraph matrix](../vfx-hud-polish/README.md). |
| Q-32 | fixed | `f5769d973`: tiny ballistic droplets and supported splats replace floating capsules. [Ground-blood fixture](../visual-polish/README.md). Square-decal follow-up remains separately Q-143/Q-176. |
| Q-33 | fixed | `496ce0572`: cellar exit fades to black instead of cutting 150 m; [first-presented-frame and emergence checks](../vfx-hud-polish/README.md), both backends/tiers. |
| Q-34 | fixed | `9ab76731b` dresses L8 drive-out; L9 night/road life and current L10 `0044d60ad` add authored roadside content. The original void is removed; the higher “stunning” standard remains open at Q-150. |
| Q-36 | fixed | `67201663f`: reserved Sound/Controls row above HUD and letterbox, including portrait. [16 browser cases / viewed captures](../vfx-hud-polish/README.md). |
| Q-37 | fixed | `c55e4f6ef`: large groups hide healthy world bars and cap hurt bars at six; L7 entry rows and current v2 cast separate bodies. [L7 cast](../l7-all-new/README.md). |
| Q-40 | fixed | `4dc60196f`: abilities never resolve to placeholder boxes; console guard covers all ten levels. |
| Q-42 | fixed | `f6416ad38`: near lamp heads participate in the reveal; retained PO-spot and backend matrices. |
| Q-43 | fixed | `4dc60196f`: corgi-lure ability no longer loads placeholder geometry. |
| Q-44 | fixed | `65683baeb`: neutral moon bounce and grade protection retain authored corgi orange/white; follows the earlier `f6416ad38` correction. |
| Q-46 | fixed | Shared pool (`137960f82`, `54cda1c74`, `9e290c274`) supports queued shared work and exclusive timing. [Operation](../../../tools/browser-pool/README.md). This lane observed queue delay; it is not classified as a game defect. |
| Q-49 | fixed | `496ce0572`: Metro closing camera follows courier; [L5 transition captures](../vfx-hud-polish/README.md). No framing values changed by triage-b. |
| Q-50 | open | Reveal cuts expose unmodeled dark interiors. A clean fix requires authored interior/roof-edge treatment at each large building, not a global opacity change; >1 h across L3/L5. Proposed: add restrained interior floors/wall backs and validate the existing subject reveal. |
| Q-51 | fixed | `29b18e9d5`: transport doors carry the `cabCrack` attribute required by their shared cab shader. |
| Q-53 | fixed | `e235951e9`, `4d7195b7c`: medkits/drinks no longer carry objective rings. |
| Q-54 | fixed | Directional heavy-hit knockdown/flung clips and retained blast flight are implemented; `224aebeb4` keeps corpse poses during blasts. Current v2 movement/corpse reviews are in [L10 rollout](../l10-all-new/README.md). |
| Q-56b | fixed | `8b0a695c1`, `73895e42e`: carried arsenal and armed survivor equipment survive L5→L6 handover. |
| Q-57 | fixed | `73895e42e`: followers/companion use wreck-roof support; grounded pickup/objective presentation covered by L5 route receipts. L5 combat balance unchanged. |
| Q-61 | fixed | `8b0a695c1`: every level handover retains carried weapons, including L5 shotgun into L6. |
| Q-62 | fixed | `b198db054`: stable underground light list; `c0c098cfa` prewarms campaign hitch paths. [Hitch proof](../hitches2/report.md). |
| Q-63 | fixed | `f91771d29`: metro colliders match visible mesh; `d1264986a` ends southern barriers at the drawn pier; `88ae13e18` makes side walkways traversable. |
| Q-63b | fixed | `520f1b9e7`, `e00ca85b3`: grey readable tunnel outside headlamp; [L6 lighting/route captures](../l6-po.md). |
| Q-64 | fixed | `01a1efa31`: closable hatches and gates use ordinary interaction/breakable collision; [L6 route proof](../l6-fists-loop/README.md). |
| Q-65 | fixed | `01a1efa31`, `6101b529d`: group checkpoint follows actual column; held reasons have dwell. [L6 escort receipts](../l6-weapons-flow/README.md). |
| Q-66 | fixed | `81980394b`: focus loss during load cannot freeze L7 at tick zero. |
| Q-67 | fixed | `040db7bda`, `69f2425b2`: equipped rocket max zoom 2 and saved/resumed limits. [Launcher verification](../l7-rocket/report.md). |
| Q-68 | fixed | First visible support is picked/refined, including near cliffs; [raised/lower cursor and ledge proof](../l7-readability/report.md). |
| Q-69 | fixed | `eb2223685`: visible kerb/cap/vertical faces; [572 contrast pairs and terrain-occluded bar checks](../l7-readability/report.md). |
| Q-70 | fixed | `73895e42e`: survivors flee/respond or fight when armed; `18bede35d` keeps injured L6 survivors reacting to attackers. |
| Q-71 | fixed | [L7 readability](../l7-readability/report.md) and current truthful state/bar pipeline suppress corpse/hidden bars; Q-125 specifically checks first zero-HP Alpha frame. |
| Q-72 | fixed | `040db7bda`: blue living-survivor minimap dots and rim clamp shared across levels. |
| Q-73 | fixed | `73895e42e`: armed followers face travel outside active engagement; carried firearm animation remains active. |
| Q-74 | fixed | `8788c32ee`, subsequent [L8 continuity](../l8-continuity.md): visible followers repath/step through at normal speed, complete boarding with real input. |
| Q-75 | fixed | `040db7bda`: shared radar/weather layout places the area badge outside radar; desktop/phone proof retained. |
| Q-76 | fixed | Debug level select enters locked levels using a preset-consistent campaign state; [debug/handover proof](../playtest-harness/report.md), `6e160f923` regression history. |
| Q-77 | obsolete | Source retracts the stale-ring P0. The residual stale gate prompt is covered by `5b6eef6cc` N11 gate/prompt table and current mission-qualified gate guidance. |
| Q-79 | fixed | [L8 continuity](../l8-continuity.md): one campaign outfit selection through L10, retained gear tier and actual visible groups. |
| Q-80 | fixed | [L8 continuity](../l8-continuity.md): hidden recovery requires entire silhouette outside frustum and >12 m; visible assistance moves continuously to the door. |
| Q-81 | fixed | [L8 continuity](../l8-continuity.md) hides cinematic arrows, resets stale trackers and preserves zoom; `c55e4f6ef` removes healthy bar grids; Q-127 covers skyline/fog. |
| Q-82 | fixed | `2779c79e0`: quality switch no longer toggles shadow casting on a live spotlight; backlog batch 13e2 rechecks both backends/tiers with zero errors. |
| Q-83 | fixed | `fb51f5ed1`, `65066f978`: correct column rear and blocked-straggler progress; [completed weapons/fists routes](../l6-fists-loop/README.md). |
| Q-84 | fixed | `ae99d6483`: two-second reading dwell; backlog 13e2 records one change instead of 53. |
| Q-85 | fixed | `877c2b14e`: intact retained bodies after actual kills; [L10 low-body/runtime evidence](../fixes-13k-visual/README.md). |
| Q-86 | fixed | `fb784e885`: fixed weapon-number mapping; [HUD and physical-input proof](../weapon-keys/README.md). |
| Q-86b | open | The old near-identical pistol glyphs need direct current rack review; proposed cheap fix: distinct long-gun/launcher silhouettes in the existing icon path after capture. |
| Q-87 | fixed | `6101b529d` and the per-gate guard documented in the linked report: gate-specific safe checkpoint guards; [zero-skip male/female/fists receipts](../l6-fists-loop/README.md). |
| Q-87b | fixed | Same underlying checkpoint/driver issue as Q-87; [audited final provenance and complete routes](../l6-fists-loop/README.md). |
| Q-88 | fixed | `6101b529d` and actual-column-head rejoin documented in the linked report: ring follows real head/tail and held reasons have dwell; [viewed ring/respawn captures](../l6-fists-loop/README.md). |
| Q-89 | fixed | Preset-consistent debug starts and complete crawl handover wiring; [fresh campaign/debug-entry proof](../playtest-harness/report.md). |
| Q-90 | fixed | Backlog 13g directly verifies L8 objective/arrow/minimap at tick 11; current L8 handover/boarding work preserves guidance. |
| Q-91 | fixed | Backlog 13g explicitly checks key 1 selects fists from every progressed rack; fixed keys `fb784e885` remain shipped. |
| Q-93 | fixed | `877c2b14e` real-kill retention and v2 skins replace reduced frozen slabs; [L10 figures/corpses](../l10-all-new/README.md). |
| Q-94 | open | L10 shelter lamp-disc through roof and low-tier L4 EVAC decal have no direct later closure. Proposed: reproduce exact shelter/lamp depth and retain decal in low mesh; asset/material + two-level review estimated >1 h. |
| Q-95 | fixed | Backlog 13g: pipe bomb in fist, zero grip error, 4.5 cm hand error, both survivors. |
| Q-96 | fixed | `ac89500cf`, `b8d3f2a6e`: collected survivors return across raised walkway edges and maintenance routes; [flow report](../fixes-13h-flow/report.md). |
| Q-97 | fixed | `b9329683e`, `62153b5bf`: APC locked until breach/passengers; missing corgi displayed, armor panel below controls. [HUD/input proof](../fixes-13h-flow/report.md). |
| Q-98 | fixed | `877c2b14e`: real-kill frozen bodies keep intact surfaces; [runtime proof](../fixes-13k-visual/README.md). |
| Q-99 | fixed | `8c4bc6db8`: real fists seed and empty handover frames accepted without silently changing arsenal; [provenance](../l6-fists-loop/README.md). |
| Q-100 | fixed | [Matched L10 corpse/hitch proof](../fixes-13k-visual/README.md) plus later [quiet weapon/lighting warm-up](../l10-perf/README.md); no old 2.8–3.4 s gameplay stalls. |
| Q-101 | fixed | `213064893`: far Mega rallies out of view without teleport, preserving approach; [full-HP join / ten rockets](../l10-all-new/gates/boss-rally.json). |
| Q-102 | fixed | `c5c9e66e3`: exit-platform checkpoint guarded by group state; later [completed fists route](../l6-fists-loop/README.md). |
| Q-103 | obsolete | Old reduced corpse meshes replaced by full v2 skinned source surfaces; [L10 native close/body review](../l10-all-new/README.md), Q-244 later shading correction. |
| Q-104 | fixed | `ff7a2d8b2`: late-level bots/earned arsenal and HUD prompt E; [real-input campaign](../playtest-harness/report.md). |
| Q-105 | fixed | `7a53dc210`: phone gate/HUD layout; subsequent [continuity HUD matrix](../l8-continuity.md) covers compact landscape controls. |
| Q-107 | fixed | Loading prefetch/prewarm work and latest bounded smoke cover L1 presentation; `1afcb5adf` preloads L1 behind menus. Current smoke receipt retained below; no new full cold-load claim. |
| Q-108 | fixed | `edb118146`: Q-187–190 accessory fits and face corrections; [native eye/hat proof](../l1-hats-faces/README.md). |
| Q-109 | fixed | `6677caf72`: depot clerk and lab technician remain visible through full handover choreography. |
| Q-110 | fixed | `6677caf72`: handover keeps the technician visible and animated through the exchange. |
| Q-115 | fixed | `ce63f4ed6`: cower only near threat; native hat/head fixes in [Q-187–190 review](../l1-hats-faces/README.md). |
| Q-117 | fixed | `05948cba6`, `5976d95c9`: grounded detailed Alpha corpse silhouettes; [near/far matrix](../fixes-13k-visual/README.md); later v2 Mega skin ownership repaired. |
| Q-120 | fixed | `57ca497c3`: completed charge snapshot replaces pre-charge snapshot; exact restored boss transform, full HP and retry state tested. [Report](../fixes-13j/README.md). |
| Q-121 | fixed | `57ca497c3`: early rockets legitimately damaged boss during charge; fight start restores living boss to full HP; bar uses current/max. [Reproduction](../fixes-13j/README.md). |
| Q-122 | obsolete | PO 10-22 explicitly accepts 1/30 with fists; only finishability is required. [Later fists route](../l6-fists-loop/README.md). |
| Q-123 | fixed | `a5819dd7a`: observer excludes HUD-covered combat targets; [physical-input title-menu reproduction](../fixes-13j/README.md). |
| Q-124 | fixed | `5976d95c9`: Alpha boots flat, side-fallen Mega with separate head/arms/feet; [visual matrix](../fixes-13k-visual/README.md). |
| Q-125 | fixed | [Fixes-13k proof](../fixes-13k-visual/README.md): HP bar gone at first zero-HP frame (53). |
| Q-126 | fixed | [Three actual L1/L2 input profiles](../fixes-13k-visual/README.md): 16.8/33.4 ms maximum, zero >200 ms, zero late vehicle programs; actual L2 occupants warmed. |
| Q-127 | fixed | [48 L7 ending frames](../fixes-13k-visual/README.md): continuous warm fog covers skyline; no void rectangles. |
| Q-128 | fixed | `ff7a2d8b2`: earned rocket selection, visible Mega aiming and non-skippable mega/crawl; [47.5-minute no-skip campaign](../playtest-harness/report.md). |
| Q-131 | fixed | `0385d88d7`, `b9b467846`, `ca1a45376`: cleared route gores/tree/lamp maneuvering strips; [matched drive and full L9 runs](../l9-vehicle/README.md). |
| Q-132 | fixed | `13a9d7fed`: debris fires cast no column shadow; shadow tint follows ambient, removing lavender ground streaks. |
| Q-134 | fixed | `698dd7875`: L1 bike receives driver widening. No framing changes by triage-b. |
| Q-136 | fixed | [120 fall frames](../fixes-13l-gameplay.md): exact hull height plus all six wheel offsets; scripted falls bypass ground settling. |
| Q-137 | fixed | [61 real drive samples](../fixes-13l-gameplay.md): companion seated before L9 drive starts, zero visible overlapping-corgi frames. |
| Q-138 | fixed | [Exact no-pickup probe](../fixes-13l-gameplay.md): E-only pickups cannot be fetched even from restored pending-fetch state; lamp stays fixed until E. |
| Q-139 | fixed | [Original stop rerun](../fixes-13l-gameplay.md) drives beyond x447; `b9b467846`/`ca1a45376` clear later bypass obstacles. [L9 final input runs](../l9-vehicle/README.md). |
| Q-141 | fixed | [Missing passenger guidance](../fixes-13l-gameplay.md): nearest missing passenger on minimap and named distance; later APC lock Q-97. |
| Q-142 | open | Original evacuation truck material/lighting has no direct truck-specific later acceptance. Recheck `qa-l7-entry-rocket` against actual truck; proposed localized truck surface fill/practical repair, without global grade or camera change. |
| Q-143 | open | Current blood decal path still needs targeted capture; `FxPool` uses texture alpha for blood shapes. Proposed: confirm whether squares originate in texture alpha sampling or a different ground shape, then fix that path only. |
| Q-144 | open | Q-218 fixes roof framing (`be003d807`), but the original three counter definitions still need reconciliation. Proposed: record starting, living, lost and rescued IDs at exit and use one consistent result definition; investigation spans checkpoint/handover state (>1 h). |
| Q-145 | open | L5-specific finale crowd/camera composition not explicitly closed by camera-follow fix. Frozen difficulty remains untouched. Proposed: inspect final boarding spacing and shot occluders, then correct presentation/formation without combat tuning; >1 h including L5 regression. |
| Q-146 | open | The L9 flat 3D direction arrow has no explicit later removal commit identified. Proposed: replace its oversized filled mesh with existing grounded guide styling after current capture. |
| Q-147 | open | Ground-slam warning still uses a hard geometric ring; current targeted sequence queued. Proposed cheap presentation fix: soften its pressure-wave edge while preserving the true danger radius and lifetime. |
| Q-148 | open | Point-blank rocket flash remains allowed by the current blast path; capture queued. Proposed cheap fix: cap the exposure pulse independently of the fireball so scene silhouettes remain visible. |
| Q-149 | fixed | [Four aimed weapons at 1.1 m](../fixes-13l-gameplay.md) each kill the target; later Q-223 repairs missed body click retry/bar observation. No global invulnerability found. |
| Q-150 | open | Current [L9 look](../look-l6-l9/README.md) is ~5.5 and [L10 camera look](../l10-camera/README.md) ~5.5–6; L9 decor was reverted for collision. Proposed: authored roadside set pieces with verified vehicle clearance and richer bridge surfaces; >1 h, no camera framing changes. |
| Q-151 | fixed | The fuller originating [report](../visual-qa-l5-l10/README.md) lists closed-page loops, crossing handover and missing late bots; all addressed by [harness completion](../playtest-harness/report.md), `ff7a2d8b2`. |
| Q-152 | fixed | `450ef1c83`: held attack pointer changes no longer retarget an existing click-move destination; `df1b027d8` retains verification. |
| Q-153 | open | [Full campaign receipt](../playtest-harness/evidence/campaign-06.json) still has ten P2 progress/wait observations, including 88.7 s L7 wait. Later specific boarding fixes do not prove every wait removed. Proposed: per-passenger route/door queue trace and visible recovery; >1 h across L7/L8. |
| Q-156 | open | Q-141 adds nearest missing passenger, but the original duplicated count/inconsistent names need direct current HUD capture. Proposed cheap fix: build count and target text from one current missing-passenger list. |
| Q-157 | open | Historical one-seed L6 survival difference (6 vs 10) has no isolated post-headlamp comparison. Current L6 was substantially revised afterward. Proposed: isolate the headlamp-fetch change and compare exact input/event sequences before balance action; >1 h on the historical runtime, no L5 tuning. |
| Q-159 | fixed | `ce63f4ed6`: before-alarm alert idles, shelter-aware flee, cower only with infected within 15 m. [Result section](../l4-storyline/design.md) documents implemented rule, not only proposal. |
| Q-166 | fixed | `6459bde5f`, `52a4e20e5`, `537e288ea`, `591eb20c9`: spread arrivals and bounded corpse settling retain every body. Later desired L4 pressure is preserved. [Native crowd/body review](../l4-no-tents/report.md). |
| Q-167 | fixed | `c2e8f2147`: onboarding enter/exit card gated by vehicle presence; absent throughout L4 war. |
| Q-169 | fixed | Old rigid Alpha corpses replaced by fitted skinned cast; [L4 native corpse review](../l4-no-tents/report.md), later [Q-231 palette comparison](../q231-p3/README.md). |
| Q-171 | fixed | `3014f5551`: fitted gear plus attachment gate; [courier gear receipts](../qa-invariants/coverage.md). |
| Q-172 | fixed | `3014f5551`: ponytail crown limit; `43de3e972` adds 180° run-turn close fixture with attachment gate. |
| Q-173 | fixed | Later pressure decision keeps the heavy war; `6459bde5f`/corpse settling and varied skinned infected retain readable forms. [L4 living vs dead review](../l4-no-tents/report.md). Q-247 separately audits current contrast. |
| Q-174 | fixed | `f4d005329`: carried survivors route around buildings and keep story injuries; L7-specific batch14 reproduction and later [native L7 rollout/input acceptance](../l7-all-new/README.md). Generic boarding names remain checked at Q-156. |
| Q-175 | obsolete | Old textured zebra bake superseded by v2 skinned animals; [native L8 body/turn/feet/corpse sheets](../l8-all-new/README.md) show intact animal surfaces. |
| Q-176 | open | Same square blood-decal path as Q-143, reported at L10 console; both must be closed by current matching captures, not by unrelated cure-mist work. |
| Q-177 | open | Driver zoom issue overlaps Q-181 and is fixed by vehicle-warmup; 770 s remote SwiftShader scene cost is not yet remeasured. Proposed: profile shader/scene setup and cache only equivalent immutable work; >1 h. Native pool scenes remain available. |
| Q-178 | fixed | `f019eccb0`: textured heroine receives brighter hue-preserving night key, specifically Q-178. |
| Q-179 | fixed | `41299f813`, skinned crowd integration and retained infection palette; [native crowd/body review](../skinned-crowd/README.md) and [Q-231 Alpha palette](../q231-p3/README.md). |
| Q-180 | fixed | Later quiet L10 cure-release recheck: four runs, zero >200 ms frames (backlog Q-222); [weapon/lighting path](../l10-perf/README.md). |
| Q-181 | fixed | Vehicle-warmup merger `8ac48ff6d` includes driver zoom/weapon timing; it waits for scripted intro/loading before applying requested zoom. [Harness behavior](../../../tools/playtest/session.ts). |
| Q-182 | fixed | [Followups-25](../followups-25/README.md): timed epilogue/credits progress accepted; orphan/corgi flags corrected with Q-226. |
| Q-183 | fixed | `87102e52b`, `a25110b50`, `f82481767`: textured fitted gloves/cuffs and full low-tier garment shells. [Gear acceptance](../qa-invariants/coverage.md). |
| Q-184 | open | Male tier-1→2 vest contrast against orange shirt was explicitly left known in [QA17](../visual-qa-17/README.md). Proposed cheap fix: assess current fitted textured garment colours before a scoped vest swatch change. |
| Q-185 | open | `__SS__.survivor.select('male')` on a loaded level is a debug-only invisible-model path (QA17); normal menu flow passes. Proposed: route live variant changes through the existing awaited courier reload; estimate ≤1 h plus capture. |
| Q-186 | fixed | Driver route recovery/vehicle reverse implemented in `ff7a2d8b2`; [full no-skip L1–credits campaign](../playtest-harness/report.md) passes the L2 fence. |
| Q-187 | fixed | `edb118146`: native hat/accessory placement and face fits; [144 game-camera views / 72-case eye gate](../l1-hats-faces/README.md). |
| Q-188 | fixed | Same fitted hat correction and native comparison as Q-187; [report](../l1-hats-faces/README.md). |
| Q-189 | fixed | `edb118146`: smooth retained face tint and eye landmarks; [native face/eye receipts](../l1-hats-faces/README.md). |
| Q-190 | fixed | `edb118146`: firefighter helmet fits native head; [helmet/back/front review](../l1-hats-faces/README.md). |
| Q-191 | fixed | Backlog 10-29 closure lane small-27; depot apron back texture corrected (close-only defect). |
| Q-193 | fixed | `41299f813` portable GPU headroom plus skinned-crowd source path; [actual native suite/poses](../skinned-crowd/README.md). |
| Q-194 | fixed | L4 uses multiple infected identities and skinned corpses; [source census and varied native body review](../l4-no-tents/report.md). Pressure retained. |
| Q-195 | fixed | `a670fed37` large-corpse foreground and `ab3a972bc` corpse cut; courier stays readable through piles without lifting her over curbs. |
| Q-197 | fixed | `a42317316`: recover WebGPU device loss; `9d9dfb460` explains P0 and `bd7f9f61d` adds body-stall guard. |
| Q-198 | fixed | [Specific L8 carry-over/best-usable-weapon logic and proof](../l8-start-weapon.md); no default bat reset when a usable saved action exists. |
| Q-199 | fixed | Current portable shader-budget smoke and courier scene gate cover the retained 33-draw gear envelope; no threshold changed here. |
| Q-200 | fixed | `213064893`: persistent Mega rallies by continuous simulation out of view, no stageNear teleport; [143 s calibration](../l10-camera/README.md) and [rally proof](../l10-all-new/gates/boss-rally.json). |
| Q-201 | fixed | `41299f813`: crowd GPU-limit headroom; smoke compiles every retained variant on WebGL2/WebGPU (current receipt below). |
| Q-202 | fixed | `213064893` closes far-boss join without teleport; current L10 full-route/house interactions and [completed rollout input route](../l10-all-new/README.md). |
| Q-205 | fixed | `2ffeac7a3`, `384003631`: fitted native hand grip and cane floor contact. [Before/after review](../polish-26/q205.md). |
| Q-206 | fixed | `60afe9da7`: native paw contacts, slide 8.2→0.1 cm. [Motion matrix](../polish-26/q206.md). |
| Q-207 | fixed | `c2e8f2147`: chase fixture has actual attack reach/timing, preserving the production swing behavior; scene gate no longer excludes it. |
| Q-208 | fixed | `8513ba415`, `710559d1f`: uniform foreground depth switch and shadow separation; `0d027c668` warm-shader/frame guard. |
| Q-209 | fixed | `ab3a972bc`: corpse dissolution inside courier disc; no deletion or foreground leg lift. |
| Q-210 | fixed | `ab3a972bc`, `09c62db5c`: corpse pile cut plus held-weapon depth prewarm, guarded by smoke. |
| Q-211 | fixed | `c2e8f2147`: withheld weapon warm-up, smoke picks up axe, and a narrower corpse-cut rim. |
| Q-212 | open | Later L8/L9/L10 cold-load receipts do not close this distinct L3/L4 regression. Proposed: quiet paired cold loads with unchanged renderer/quality, then profile registration/asset/pipeline cost; >1 h for a reliable pair and fix. |
| Q-213 | fixed | Skinned corpse/native bind retention `4a6971cec`, `5ae023a8e` and [L4 frozen-body review](../l4-no-tents/report.md); Q-247 remains a separate current appearance check. |
| Q-214 | fixed | `a890e409c`: shared chase BFS seeds nearest walkable cell when courier grid cell is blocked; seven nearby freezes→zero in matched 240 s hold. |
| Q-216 | fixed | `5df0cea8e`: hair/skull envelope fitted to bare brow, shared by live/frozen figures; [review](../polish-26/q216.md). |
| Q-217 | obsolete | Backlog quiet-window recheck: zero reproductions in 7 runs; long frames were GPU contention. Reopen only with quiet current-runtime evidence. |
| Q-218 | fixed | `be003d807`: L6 exit shot follows actual courier instead of flat roof; [matched final frames](../polish-26/q218.md). |
| Q-219 | fixed | Vehicle-warmup `8ac48ff6d`: APC/courier-vehicle materials warmed; carried weapon/intro zoom handled before play. |
| Q-220 | fixed | Backlog lane l8-lion-look (10-28); [healthy/infected native lion and gorilla comparisons](../followups-25/zoo-comparison.json). |
| Q-221 | fixed | `b9b467846`: tree footprints removed from APC encounter bypasses; [matched real W-key drive](../polish-26/q221.md). |
| Q-222 | obsolete | Backlog quiet cure-release rerun: four L10 runs, zero >200 ms frames; contaminated 233/383 ms samples are not a persistent runtime defect. |
| Q-223 | fixed | [Exact runner/body-click reproduction](../followups-25/README.md): retry missed click, 20 HP damage and visible bar; all seven looks and 542 populations audited. |
| Q-224 | obsolete | Backlog real Continue resume shows corgi present ~90% samples; driver's false drawn flag fixed by Q-226. |
| Q-225 | fixed | [Quiet L8 cold loads](../followups-25/README.md): 4.024 s median vs 4.211 s control; L9 −2%, no L9 regression. |
| Q-226 | fixed | [Followups-25](../followups-25/README.md): direct Vitest descendant ownership, three orphan-free runs, timed epilogue/credits progress and visible-corgi flag. |
| Q-227 | fixed | `d892145bf`, `eddef8c67`: every mission pickup warmed; [quiet L10 high 23.9 ms max / zero late builds](../l10-perf/README.md). |
| Q-228 | fixed | `90d617a2d`: shared shadow programs and loading links; [5.261 s quiet median](../l10-perf/README.md), later five cold samples 4.84–4.96 s. |
| Q-229 | open | L1 afro fixed and L4 tent not reproduced ([bounded report](../l10-perf/README.md)); exact L9 4-minute barrier stop not reproduced. Keep the composite item open for exact APC pose/input before changing collision; proposed follow-up: log obstacle ID and reverse/steering envelope (>1 h without original pose). |
| Q-230 | obsolete | Backlog quiet rerun: 129/21/21 ms, zero shader builds; the 300 ms sample at host load 5.3 was not reproduced. |
| Q-231 | open | [Precise follow-up](../q231-p3/README.md): L9 pallets and L10 Alpha palette fixed; L1 stretched triangle still unresolved after three targeted attempts. Root actor/tick unavailable; proposed capture exact death identity/frame before modifying common animation (>1 h bounded repro). |
| Q-232 | obsolete | Backlog five real runs: shutter delay 0–1.45 s; 7.4 s included authored resident-view pause. L5 difficulty remains frozen. |
| Q-233 | fixed | `4d8f27656` proves prop-count invariance; lane q233-ids removes ID-dependent simulation ordering; 97-pushable guard only warns. |
| Q-234 | fixed | `ec73a0409`: R3 yard collider gaps closed; `33956d730` and `50bf2181d` add visible varied fill without changing collider envelope. |
| Q-235 | fixed | `987f313fe`, `7aa4b9bff`: separate epilogue figures, opaque cured bodies and low mist. [Retained epilogue receipts](../l10-all-new/README.md). |
| Q-236 | fixed | `15742ae36`, `6253fd63c`: R1 foreground pole moved in authoring and evac flood dimmed. |
| Q-237 | fixed | Road-only framing `223c609e6` and close lit belt `0044d60ad`, `305071ff2` address the requested R3/R4 context. Broader art-quality target remains open Q-150. |
| Q-238 | fixed | `25df02671`: stream-retire fixture stays on road; [L9 clean route/gates](../l9-vehicle/README.md). |
| Q-239 | fixed | `ca1a45376`: full lamp footprints clear APC route-to-detour maneuvering strips; [three real-input runs](../l9-vehicle/README.md). |
| Q-240 | fixed | `33956d730`, `529c49714`: lantern sightlines/bedroll scale; `50bf2181d` visible R3 gap fill, verified colliders/nav unchanged. |
| Q-241 | open | R3 repeated units varied (`a4245303f`, `ee23c8f07`), but backlog says L6 reveal improvement marginal. Proposed cheap rendering fix after capture: reduce the speckled feather band at tunnel arches while retaining clear core and per-placement eligibility. |
| Q-242 | fixed | `09a9eabda`: feathered playable cure-mist edge; [subsequent evidence](../l10-camera/q243/README.md). |
| Q-243 | fixed | `491f554ac`: snap framing on explicit pose transitions; [first-frame/reset probe](../l10-camera/q243/README.md). |
| Q-244 | fixed | `c56ac3e82`: retained corpse shade/colour at wide zoom; no body deletion or LOD substitution. [Material and persistence evidence](../l10-camera/q243/README.md). |
| Q-245 | fixed | `601df6db6`: unsupported oil polygons removed while consuming the same seeded random draws; [world identity comparison](../l10-camera/q243/README.md). |
| Q-246 | fixed | `0044d60ad`, `a57062154`, `305071ff2`: close lit supply belt and medkit prewarm; reviewed roadside sheets and final checks committed on main. |
| Q-247 | open | Current frozen-corpse fill change Q-244 needs L8 dark-ground contrast and L4 healthy/infected comparison; targeted high/low day/night pair captures pending. |

## Current verification and remaining work

- Prior restricted run: `npm test` passed 26 files / 110 tests. Its smoke and scene attempts could not open sandbox sockets; these are superseded by unrestricted runs below.
- Unrestricted smoke: first attempt found occupied 3301; dedicated-port attempt passed both full shader-budget checks, then exceeded 240 s while queued behind another lane's exclusive job. No success claimed; fresh shared-window rerun required.
- Unrestricted `scene:gate` and focused visual receipts are running through the shared pool; final results and viewed-capture review will be added after terminal completion.
- Current table is the evidence-audit checkpoint. Open items with targeted cheap fixes remain active; every >1 h item records a concrete root/unknown and proposed next action in its row. Full current L6–L10 input/story/visual review is pending.
