# Requested browser checks — acceptance ledger

Source requests: [collected handoffs](handoffs.json), plus the farm/Mega/flamer reports' visual scope. **PASS is limited to the observation stated. FAIL (defect) means a reproduced problem. FAIL (unverified/blocked) means acceptance was not established; it does not assert that the feature is broken.** Each level's reviewed contact sheet and exact metadata are linked from its report. Performance/audio/native-only results are never substituted for pixel review.

## Lane verdict summary

No lane receives unconditional end-to-end acceptance. The item tables below retain the positive samples and distinguish reproduced defects from unverified requirements.

| Merged lane | Acceptance verdict / retained visual evidence |
| --- | --- |
| eg-l8-story | **FAIL blocked**, [L8 sheet](L8-contact.jpg), all four loading cells. |
| eg-l8-bosses | **FAIL blocked**, [L8 sheet](L8-contact.jpg). |
| eg-l9 | **FAIL defects + unverified branches**, [L9 sheet](L9-contact.jpg), impact cells7/15/23/31. |
| r15-l10pace | **FAIL farm/hangar/finale composition**, [L10 sheet](L10-contact.jpg), cells1–17/46. |
| eg-l10-story | **FAIL hangar/ending composition**, [L10 sheet](L10-contact.jpg), cells2/6/10/14/46. |
| eg-l10-vignettes | **FAIL density/gate; full timing distribution unverified**, [L10 sheet](L10-contact.jpg), cells1/5/9/13/43–48. |
| r15-farmassets | **PASS sampled silhouettes; FAIL full LOD/material acceptance (unverified)**, [L10 sheet](L10-contact.jpg), cells18–26 and collapsed barns. |
| r15-megarun | **PASS sampled motion look; FAIL full acceptance (unverified)**, [L10 sheet](L10-contact.jpg), cells31–33/37–39; six-frame strips inspected before deletion. |
| r15-flamer | **PASS sampled model/icon/fuel; FAIL all-LOD acceptance (unverified)**, [L10 sheet](L10-contact.jpg), cells27–30. |
| r15-flamevfx | **PASS sampled appearance; FAIL quantitative flicker/hitch acceptance (unverified)**, [L10 sheet](L10-contact.jpg), cells27–30. |
| r16-destroll | **FAIL found/fixed lifetime; FAIL floating roof decal; broader first-hit coverage unverified**, [L10 sheet](L10-contact.jpg), cells4/8/12/16; [L9 sheet](L9-contact.jpg),cells36–38. |
| r13-destruction | **PASS sampled damage/settling and corrected original assertions; FAIL scene gate/full coverage**, [L3 sheet](L3-contact.jpg),cells1–28. |
| r14-alphas | **PASS sampled looks/forced shapes; FAIL normal counter/audio acceptance (unverified)**, [L10 sheet](L10-contact.jpg),cells40/41/55–60. |
| r12-group | **FAIL L5 composition; broader pace/A-B unverified**, [L5](L5-contact.jpg),[L6](L6-contact.jpg),[L7](L7-contact.jpg). |
| r14-height | **PASS sampled platform/flat/real stairs; FAIL universal attack/animal acceptance (unverified)**, [L10 sheet](L10-contact.jpg),cells34–36;[L6 sheet](L6-contact.jpg),cells3/8/13/18. |
| r15-qafix | **FAIL APC cab; PASS sampled headlights/G24/platform**, [L9 sheet](L9-contact.jpg),cab cells2/10/18/26;[L10 sheet](L10-contact.jpg),cells34–36/49–55. |
| r12-l4truck | **FAIL canvas material; PASS sampled geometry/camera**, [L4 sheet](L4-contact.jpg),cells1/2/6/7/11/12/16/17. |

## L8 — eg-l8-story / eg-l8-bosses

[Four loading-error photographs and causes](README.md#l8-loading-blocker), [sheet](L8-contact.jpg). Every requested tier/backend stops before Begin; all following requirements are **FAIL (blocked)**:

| Request | Evidence / limit |
| --- | --- |
| Nadia tour, normal species, fence lighting, path/lion/broadcast/Hale reading time and ambience | Startup failure, tick0. No rendered tour or audible pass. |
| Pond breach, K9 tunnel/vest/corpse, keeper grab, same-ID flamingo turn | Startup failure. |
| North-wall Mega reveal, Hale keys/death, subsequent actual cab entry | Startup failure. Separate APC fixture does not accept this story sequence. |
| Both gate leaves, whole group/APC exit, pursuing Mega and departure caption | Startup failure. |
| Return/skip/retry, boarding frame cost and L8→L9 roster/arsenal | Startup failure. Preset L9 completion is not an actual L8 handover. |
| All six arenas and normal/infected continuity | Startup failure. |
| Monkey leader size/silhouette/roof movement | Startup failure; required monkey tier itself fails at low. |
| Windup/bar/audio, marked throw lanes and circles; prop/corpse/living throws and roll | L8 startup failure. Shared Alpha shapes are a separate limited PASS below. |
| Pillars, elephant walls/truck, held evacuees, checkpoint return and full APC escape | Startup failure. |
| Combined Mega/Alpha/flame within L8 | Blocked in L8. Non-zoo shared fixtures are reviewed separately. |

## L9 — eg-l9

[Level review](L9.md).

| Request | Verdict / observation |
| --- | --- |
| Max-zoom mixed-pack admission, already moving | **FAIL (unverified)** continuous first-visible admission; route samples show moving packs but do not cover every newly admitted actor. |
| Boarder climb, turn/scrape/brake release; driver HP and hatch shooting | **PASS sampled hatch firing/damage** from physical mouse input; **FAIL (unverified)** all three release maneuvers and full boarding animation. High defense policies die. |
| Breakable vs solid obstacles; fast/slow ramps; tanker/fire | **PASS sampled ramp/fuse/fire presentation** in corrected fixtures; normalized destruction contacts show breakable parts. **FAIL (unverified)** ordinary-driver obstacle/detour difficulty and all solid controls. |
| Bus chase/wheels/ram/passenger spill | **PASS sampled bus pursuit/ram/spill visibility** in low completed route; **FAIL (unverified)** continuous wheel-motion/complete spill count. |
| Gate deadline/late fence; transfer/goodbye/Sam | **PASS sampled low route**: gate closes, fence entry, transfer and goodbye occur; Sam remains separately represented. Other policy outcomes and all timing edge cases are not accepted. |
| Mega landing, spans/APC roll, rack/launcher loss, crawl/axe/dog/explosion | **FAIL (defect)** impact/crawl framing occludes action. **PASS sampled APC hull/wheel continuity** through fall. Rack/launcher loss and controlled crawl readability remain unaccepted. |
| L10 gets four named survivors, research companion, safe dog, axe only | **PASS sampled actual low L9→L10 save and completed carried L10 replay.** No actual L8→L9 claim. |
| E18/E31 draw/triangle/frame/streaming budgets | **FAIL (unverified)** quiet live timing/streaming budgets. Destruction lifetime failure found/fixed; unit gate passes. L10 ending counters independently fail. |

## L10 — r15-l10pace / eg-l10-story / eg-l10-vignettes

[Level review](L10.md).

| Request / owner | Verdict / observation |
| --- | --- |
| Dry farm, exact PO location, corn density/night route framing — pace | **FAIL (defect)** sparse flat gray farm at exact pose and long empty route stretches. Corn exists and high is denser. |
| Six finds/world markers and contextual dressing — pace/story | **PASS sampled six conspicuous rings and actual collection. FAIL contextual composition** at sparsely framed sites; not every authored label/prop is readable. |
| Barn HELP / three graves; restricted warning/searchlight — pace | **PASS sampled low/high roof text. FAIL grave presentation** in all four intact-roof interior/exterior pose cells: crosses remain hidden. Crosses exist after collapse. **FAIL stale roof text** floating at old height after collapse, tick4326 `(951,-19)`, all four cells. L10cells4/8/12/16/24–26. Restricted warning/searchlight sampled, complete atlas review unverified. |
| Hangar/cast/subtitles/arsenal, Mega slam, weak-point/flame/platform — pace | **FAIL (defect)** zoom1.5 roof occlusion. **PASS sampled** actual arsenal grants, raised gun/stairs/charge and shared ground-slam/flame shapes. Counter interactions/exact subtitle timing/audio remain unverified. |
| Cure/identity/sunrise/phone/panorama/performance — pace | **FAIL (defect)** isolated stages, cast overlap, blank pullback and excess geometry. Actual four named survivor continuity sampled PASS. Phone/hymn audio unverified. |
| Hymn/credits/licences/skip/menu/toy — pace | **PASS sampled** actual credit Pause/Resume/Skip/thanks/menu in portrait matrix and full landscape completion. **FAIL (unverified)** audible hymn, entire90s licence legibility and toy branch. |
| Hangar entrance/enclosure/terminal/canister/cast, exact timing/music — story | **FAIL roof/cast staging**; entrance, enclosure, console/canister and handover visible at zoom1. Timing/music not accepted. |
| Discovery place identity and hostile dog marker — story | Six pickups/rings sampled PASS; **FAIL (unverified)** hostile dog marker semantics and every site's complete environmental story. |
| First Mega/threatening repeated escapes, pulsing real-position dot, hidden walk bar, roar/steps/no pop — story | **PASS sampled** visible lope/pursuit and escapes. **FAIL (unverified)** continuous spawn-pop exclusion, pulse tracking, exact walk-bar/audio behavior. |
| Whole arsenal/fuel/final machinery/fuel/gate counters — story | Actual grants and carried flame sampled PASS; **PASS sampled fuel boundary/reload/restart**, all four cells:60→1at1170→0at1190,jet absent1250/1360,59and jet at1380. Every weapon selection and all three final counter interactions remain **FAIL (unverified)**. L10cells27–30. |
| Green dust/recovery/dead bodies/journey/cast/seat/corgi/Delivered/panorama/credits — story | **FAIL composition/panorama/geometry**, above. Dust/recovery and Delivered caption sampled; same-ID/dead-body preservation, sound and every optional branch not accepted. |
| scene:gate; seven regions/jam/helicopter/refuge/turnouts — vignettes | Regions/jam/helicopter/refuge rendered at both tiers/backends/zooms. **FAIL route story density**, with some repeated/isolated dressing. Gate result reported separately; region samples are not a complete ground-contact/overlap audit. |
| Atlas shader/text/orientation/opacity/colors/layers/quality/no placeholders — vignettes | **PASS sampled compilation** on actual WebGL2/WebGPU. **FAIL acceptance** of complete text/material/ground-layer audit. Confirmed propane placeholder warning; district sampled placeholder draws are empty and do not cover hazards. |
| Fresh real input every route choice + empty-stretch replay, R7 — vignettes | **FAIL (unverified)** all route choices/real-input replay. Production bot completes one actual route; source route is not all-route approval. |
| Jam budgets, cold load≤6s, high frame≤66ms — vignettes | **PASS sampled quiet actual MetalGL jam:** lowp95/max7.8/18.6ms,high9.2/64.2ms; physical movement valid. Cold samples4459.1/4139.9ms (n=1each). **FAIL full acceptance (unverified):**20cold samples/all-route/PROD A/B/first-hit not established. [Data](performance.json), L10cell48. |

## Shared asset / effect lanes

[Shared observations](README.md#shared-rendering-fixtures--all-four-qualitybackend-cells), [L10 evidence](L10.md).

| Owner / request | Verdict / observation |
| --- | --- |
| r15-farmassets — crop, machinery, farm buildings, normal/burned runtime silhouettes | **PASS sampled** crop/stalk variation and distinct tractor/combine/barn/house silhouettes across4render cells. **FAIL overall art integration** at actual night farm; every shipped LOD detail/material not independently certified. |
| r15-megarun — independent low/high toward/away/across game-camera strips, WebGPU look | **PASS sampled visual smoke**: six poses/three directions, low shoulders, heavy long strides, both zooms; GPU counterparts reviewed. New quantitative sole-speed/A/B and L8 scripted11/14m/s are not rerun. |
| r15-flamer — model/icon/held fire at game zoom and all LODs | **PASS sampled held model/icon/firing and sustained fuel-cycle appearance**, all four cells; **FAIL (unverified)** detailed every-LOD acceptance. L10cells27–30. |
| r15-flamevfx — independent look / manual WebGPU | **PASS sampled look** across4cells: continuous jet, warm spill, patches after release; moving/turning origin follows nozzle. This does not approve quantitative flicker/hitch budgets. |
| r16-destroll — new asset damage appearance/clipping/first-hit allocation | **FAIL found/fixed** stale Rapier-body lifetime bug. Corrected8rollout runs have zero runtime errors. **PASS sampled partial/collapsed appearance** where framed; **FAIL (unverified)** every asset/weapon family and first-hit allocation. |
| r13-destruction — scene:gate | **FAIL**1/50PASS,49loading failures (26requiredlioness/23weightedowner); [summary](scene-gate-summary.md). Passing L3bar-cap strip personally reviewed; no visual PASS for unrendered scenes. |
| r13-destruction — original tools/scenelab/destruction.ts sheet/assertions | Literal **FAIL**: remains briefing tick0, handgun assertion fails. Begin-only wrapper **PASS** every unchanged original assertion. L3cells25–28; [review](L3.md#original-destruction-tool). Broader four-cell harness separately reviews settled appearance. |
| r13-destruction — L3 glass/door/roof/burn/wreck/debris/impacts and neighbors | **PASS sampled** four-cell hits/holes/collapse/burn; settled roof clears with neighboring instances intact. Corrected low car-settled repeat reaches4286; invalid initial shot excluded. L3sheet retains all four aged wrecks. |
| r13-destruction — materials/occlusion/moving alignment/checkpoint/perf and GPU | GPU/GL appearance sampled; **FAIL (unverified)** all moving-wreck/checkpoint restore states and qualified first-hit/frame budgets. |
| r14-alphas — each type/windup/landing at night, pose/audio/counters/recovery | **PASS sampled** five looks/six forced shapes at both zooms/tiers/backends. **FAIL (unverified)** audio, normal counters and exposed recovery behavior. |
| r14-alphas — pickup/overhead/projectile/knockdown/landing, kill in air/roll | Prop/corpse/living throw samples visible; **FAIL (unverified)** walk-up and all interruption/airkill/rollkill branches. |
| r14-alphas — Screamer sight/group/interruption | **FAIL (unverified)**; forced roar disc alone does not test these behaviors. |
| r14-alphas — Leaper fence/sidestep/pin/escape/recovery | Lane/pounce shape sampled PASS; **FAIL (unverified)** full control branches. |
| r14-alphas — APC pounce/hull/wreck throws in road | **FAIL (unverified)** specific maneuvers; no recertification from native-only receipts. |
| r14-alphas — browser smoke / E07 gate | **PASS E07 type/lint/unit** gate107tests/27files ([receipt](E07-checks.json)); **FAIL smoke**1/3PASS,2asset-loading failures ([receipt](smoke.json)). Look fixtures are separately reviewed, L10cells40/41/55–60. |
| r14-alphas — Armoured front/flank hits/bash | Bash arc readable PASS; **FAIL (unverified)** directional bullet feedback. |
| r14-alphas — reused looks / firefighter temporary cue | **PASS sampled cue**: helmeted Armoured reads differently from brute/thrower/screamer/leaper. Temporary art cue accepted only at sampled game views. |
| r12-group — natural followers L5/L6 and L7 fallback | **PASS sampled** L5/L6 actual group traversal and L7 low24-person boarding; **FAIL L5 shutter readability**, [L5](L5.md),[L6](L6.md),[L7](L7.md). High L7 policy loses all24followers; zero-survivor progression is allowed. Quiet six-person fixture cannot start/advance under current setup and remains unverified. **FAIL (unverified)** source A/B and all pace/wait guarantees; L8 blocked. Native parity is not a new visual PASS. |
| r14-height — L10 minigun deck | **PASS sampled runner/dog/brute floor separation and actual stairs** with flat controls. **FAIL (unverified)** every grab/animal move; zoo models blocked. |
| r14-height — L6/L4/stairs/ramps/vehicle roofs | L6 actual stair sample supports floor isolation and real climbing ([review](L6.md)); **FAIL (unverified)** every L4 wall/vehicle-roof and attack variant. |
| r14-height — same-floor prior baseline | Flat control takes ordinary hits PASS; **FAIL (unverified)** quantitative previous-source threat-number parity. |
| r15-qafix — physical APC entry/glazing/seat/roof/panels/LODs | **FAIL (defect)** open-looking cab and upright/straight-leg pose across4cells. Entry works. All-LOD completeness unverified. |
| r15-qafix — long moving headlights/one map/shadow direction/stronger/power | **PASS sampled** selected moving headlight through600ticks, one map, separate stronger-right practical and power-off. **FAIL (unverified)** full moving-target shadow direction and continuous APC-to-practical transition. |
| r15-qafix — raised gun pitched fire/tracers/stairs/charge/Mega/death reset | **PASS sampled** actual mounted firing/stairs/charge and route completion. **FAIL (unverified)** exact tracer pitch and forced death during activation/reset. |
| r15-qafix — G-24 five-state + riot | **PASS sampled rendered matrix** across4cells; occluded far healthy Alpha also has no bar. Zero-HP eligibility fixture is distinguished from actual corpse pose. |
| r12-l4truck — arrival/wheels/canvas/clearance/LOD/wreck | **FAIL material appearance; PASS sampled geometry**, [L4 review](L4.md). Offscreen native distance photos cannot certify every LOD. |
| r12-l4truck — alarm→Fall back camera/radio/breach HUD | **PASS sampled all4** through Fall back at13373, zoom0.5/1/1.5; continuous live-input camera behavior unmeasured. |

## PO cross-check limits

[PO checklist](../../qa/po-checklist.md) is applied to touched L3–L10. Newer Q-302 (no hiding-place rings) supersedes the older Q-140 request for a visible L5 search ring. Q-136 APC continuity is sampled PASS; Q-124 Mega night-corpse readability, L10 framing/density and APC cab presentation fail. Completed level reports record L3 ramp/checkpoint, L4 convoy/tank, L5 shutter, L6 exit and L7 departure observations. Q-142 dark wreck fails; Q-144 result27/29/2 agrees; Q-127 no exposed map edge in actual L7 departure samples passes, but bus cropping fails. No all-route PROD A/B, male-courier matrix, every accessory/proportion/grip state, real-input200ms gate, full headlamp aim or universal icon-semantics acceptance is claimed. L1/L2-specific routes were outside the touched-level route sweep.
