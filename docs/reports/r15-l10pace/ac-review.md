# L10 acceptance review — baseline and final verification

**Latest result:** native pacing goal passes on low/high; full acceptance retains the explicit open rows below. See [final verification](#final-production-input-verification) and the [handoff README](README.md).

**Historical review stage:** Step 0, before gameplay fixes. Baseline tree: `78219de9` (main story/farm/vignettes merge), with the audit harness added but no gameplay edits. The harness has not yet completed a fresh runner execution; route facts below cite the existing native production-input diagnostic in `docs/reports/eg-l10-story/evidence/route-diagnostic.json` and explicit historical route reports. Lack of a natural-route observation is scored FAIL, not inferred PASS from implementation or fixture tests.

## Acceptance rows

| Row | Demand | Native route behavior / evidence | Result |
|---|---|---|---|
| L10-01 | Opening ≤8 regular infected for first minute; no dogs/Alphas; wreck beside dry corn, broken farms, dead livestock. | Route diagnostic has player at `(547,0)` at 0.02s and `(618.8,0)` at 16.02s. At 24.02s it enters `farmstead` at `(645.3,-12.4)`. PO observed `(858.66,-93.68)` at 188s on plain green grass, with no corn or dressing in view. Existing opening caps are not established by this route trace. | FAIL — PO route view violates authored farm presentation; threat cap not demonstrated. |
| L10-02 | Mega sighting by 3:00; 2–3 close encounters; evasion gaps; unkillable before finale and no health bar. | Existing route diagnostic only traces player movement through 62.02s and contains no sighting/encounter event data. No native evidence establishes sightings, encounters, evasion or pre-finale damage rules. | FAIL — route experience unverified. |
| L10-03 | Seven route regions in order, creek/corn → farm → restricted zone → hangar → dispersal complex; ≈15 min without idle padding. | Mission has active `farmstead` at 24.02s. In the diagnostic, position is frozen at `(695.994,-4.844)` from 36.02s through 62.02s, despite movement input becoming zero; the farther farmhouse rifle target is `(882,80)` and lies outside the streamed player nav grid. The later report `eg-l10-story/evidence/native-low.json` ends at 1500s / 17 deaths, objective `hold`, position `(3990.19,-32.05)` (not a completion). Seven-region playable route completion/15-minute timing is not met. | FAIL |
| L10-04 | QA row asks for quiet 30–60s, authored scare 60–120s, 8–15 concurrent; user brief supersedes pacing with meaningful beats every 20–40s. | At 24.02–62.02s the diagnostic records no movement progress after 36.02s and no beat log. Existing reports do not establish a beat cadence; this audit uses the stricter 20–40s requirement. | FAIL |
| L10-05 | Six actual route finds: farmhouse rifle, barn machete, workshop nail gun, shed Molotovs, guard assault rifle, checkpoint flashbangs; objectives do not name weapons. | The route trace stalls before the farmhouse rifle at `(882,80)`. It therefore never naturally reaches the remaining five finds. Historical `native-low.json` reports the six pickups only in controlled fixtures; that does not show a walking player receives them. PO explicitly reports no new weapons, including after first checkpoint. | FAIL — 0 of 6 delivered on demonstrated native route. |
| L10-06 | Dogs run 1.1×, telegraph ≥0.6s, reach ≤2m, cooldown ≥2s, 10 HP/bite; low and distinct from corgi. | No dog behavior is logged in the production route diagnostic or its event stream. | FAIL — no route evidence for dog encounter/mechanics. |
| L10-07 | Mega pursues without LOS, routes around tight gaps/alleys/culverts/doors, stillness draws it in; red pulsing minimap dot and audio cues. | No native route diagnostic captures Mega movement, obstruction routing, stillness attraction, minimap or sound cues. | FAIL — no evidence player receives these threat rules. |
| L10-08 | Road framing ×1.3, base max zoom ≤2, not finale; night crowds readable and slam telegraph visible. | No native view/camera observation was captured in the input route diagnostic. | FAIL — not demonstrated. |
| L10-09 | Safe, populated hangar; specified Voss/Ruiz/Sam dialogue and cure handoff indoors; Ruiz returns arsenal; Voss gives flamethrower; canister visible zero-slot/no penalty; no infected inside. | The native route diagnostic never reaches the hangar. Historical controlled/injected scene fixtures do not prove a natural player handover. | FAIL — handover and flamethrower inaccessible on demonstrated route. |
| L10-10 | Hold charge exactly 3600 ticks alive within 40m; pauses outside with instruction; minigun cadence/heat thresholds exact. | Latest full-route low report reaches `hold` at 1500s but ends at tick budget, 17 deaths, and 12.845m from hold target. No 3600-tick completion or boundary/cadence measurement is in the native route evidence. | FAIL |
| L10-11 | Finale only: max 22 high /14 low, small waves from three directions with breathers, ≥90% reachable stationary, ≥8 attacks/min, reinforcement through Mega fight, same stalker walks in. | No input-only route reaches a completed finale in available evidence; no threat measurements from this route. | FAIL |
| L10-12 | Mega bar only at finale; shield/platform; stairs-only crowds; mounted gun and arsenal/cover support a survivable kill. | Route report ends in `hold`; no completed Mega encounter is evidenced. | FAIL |
| L10-13 | Release gated by 60s charge + Mega dead + cure installed + player at console. | No completed finale or release in native route evidence. | FAIL |
| L10-14 | Green dust converts living infected in place; dead remain dead; 8s control, 50s Delivered beat, 15s full-level pullback, title by 65s, 90s credits/skip/menu. | Native route has not completed the level; no epilogue observation. | FAIL |
| L10-15 | Death respawns at region checkpoint with checkpoint loadout, cure and boss state. | Baseline trace contains death at 63.13s at `(695.994,-4.844)` after standing still since 36.02s. The supplied event trace does not establish respawn location/loadout/state. PO separately reports first checkpoint >1km away, and brief screenshot shows checkpoint `cure-residential` while at `(858.66,-93.68)`. | FAIL — checkpoint spacing/first checkpoint and respawn state not demonstrated. |

## Story-script beats

The script names the following observable beats. “Actual route” means a normal walking/input route, not a seeded fixture or content existing in a data file.

| Beat | What the script demands | Native route behavior / evidence | Result |
|---|---|---|---|
| Wake at wrong bank with corgi and axe | Start on river bank, alone with corgi and axe. | At 0.02s native player is `(547.0,0)` with movement east; route diagnostic does not log companions/loadout or scene. | FAIL — not demonstrated. |
| Sam opening radio | Sam says “You alive? …Good. Don't stop moving. That thing doesn't sleep.” | No dialogue event in route diagnostic; early route trace contains no beat output. | FAIL |
| Mega climbs from wreck / hunts her | Immediate pursuit premise and recurring threat. | No Mega event in route diagnostic; no first-sighting time recorded. | FAIL |
| River exit → farms | Walk through dry broken corn, burned houses and barns, infected in rows. | At 24.02s farmstead starts at `(645.3,-12.4)`. At PO position `(858.66,-93.68)`, 188s, presentation is plain green grass with no corn/dressing in view. | FAIL |
| Sam hiding-gap line | Culvert/barn gap lets player evade; Sam explains it. | Route stalls at 36.02s before any demonstrated gap/hide beat; no dialogue event logged. | FAIL |
| Hunting rifle farmhouse find | Rifle is found by walking through farmhouse. | Bot stalls before item at `(882,80)`; 36.02s position `(695.994,-4.844)`, move `(0,0)`; no item pickup. | FAIL |
| Machete barn find | Machete is found at barn. | Route never passes farmhouse stage in the 63.13s diagnostic; no pickup event. | FAIL |
| Nail gun workshop find | Nail gun is found at workshop. | No natural route visit or pickup event. | FAIL |
| Molotovs shed find | Molotovs are found at shed. | No natural route visit or pickup event. | FAIL |
| Barn roof HELP / three inside / graves | See HELP — 3 INSIDE; discover three graves dug by last survivor. | No event/view record in native route trace. | FAIL |
| First Mega field crossing | See Mega crossing field within first minutes. | No sighting captured in first 63.13s route trace. | FAIL |
| Restricted zone / warning sign | Pass fences, warning signs, dead searchlights, checkpoint/quarantine; stronger infected and dog packs. | Route trace stalls in farmstead before restricted zone. | FAIL |
| Assault rifle with flashlight | Find at guard tower. | No route visit/pickup. | FAIL |
| Flashbangs | Find in checkpoint locker. | No route visit/pickup. | FAIL |
| Sam broken radio / hangar direction | Static radio points toward hangar. | No native route dialogue event; route fails before region. | FAIL |
| Hangar safe-space arrival | Sealed hangar, generators/emergency lights/tents, researchers, two guards, Sam; no infected. | No native route arrival. | FAIL |
| Voss dialogue and cure handover | Voss explains origin/failure; courier replies “I carried it”; cure handed over and two-kilometre objective. | No native route arrival or dialogue. | FAIL |
| Ruiz arsenal return | Bridge weapons returned. | No native route arrival; fixture-only arsenal evidence is insufficient. | FAIL |
| Voss flamethrower handover | Experimental flamethrower given with corn warning. | No native route arrival or pickup. | FAIL |
| Sam / Voss goodbye | Sam offers to come; Voss keeps him; Sam sends courier onward. | No native route dialogue. | FAIL |
| Delivery route / Mega waiting outside | Leave hangar, run/fight/use gaps to complex. | Route trace cannot establish hangar exit; later report stalls at hold and does not complete. | FAIL |
| Install cure and hold console | Install, then charge console under attack. | Later low report gets to `hold` by 1500s but has 17 deaths and no completion. | FAIL |
| Finale arsenal and hazards | Use arsenal/flamethrower against Mega with machinery, fuel tanks and electric gate. | No completed finale in native input evidence. | FAIL |
| Voss release line and release | On Mega kill, Voss says “Release it. Now!” and console release begins. | No Mega kill/release in native input evidence. | FAIL |
| Release 0–8 s | Courier operates the lever; green ground dust converts living infected to same-ID people; the dead Mega stays dead; corgi sits nearby and courier can walk among the cured. | Native route does not reach release. | FAIL |
| Journey wave 8–30 s | Camera follows the cure across corn/farms, river wreck, zoo with Nadia's cap, L7 skyline and the L1 Annex; infected recover along the way. | Native route does not reach the journey shots. | FAIL |
| Survivors 30–50 s | Mia, Rosa, Dale and Okafor leave army trucks; Voss/Ruiz bring Sam out of the hangar with his delivery line; townspeople and depot workers emerge. | Native route does not reach the survivor sequence. | FAIL |
| Delivered 50–65 s | Courier and corgi at the platform steps; phone buzzes “Delivered ✓”; sunrise, then a 15 s pullback over the whole L10 route. | Native route does not reach the delivery/panorama beat. | FAIL |
| Title / credits / menu | Title at ~65 s, readable 60–90 s licensed scrolling credits, skip, Thanks for playing, menu; repeat-view cinematic skipping. | Native route does not reach title or credits. | FAIL |
| Optional corgi post-credits | Corgi carries its toy to the courier if the L10 toy was found. | Native route does not reach the optional post-credits shot. | FAIL |

## Mega rules from `boss-and-alpha-moves.md`

| Rule | Demand | Native route behavior / evidence | Result |
|---|---|---|---|
| Final arena | Complex yard with machinery, fuel tanks, electrified gate, pillars; console at one side. | No native route reaches arena completion; no route view audit. | FAIL |
| Phase 1 arrival | Charges/slams, escort waves; dodge and lure charge into machinery for 2s stun/weak spot. | No native finale fight evidence. | FAIL |
| Phase 2 rage | Throws objects, climbs structures, roar calls wave; tanks/flamethrower/flashbang counters. | No native finale fight evidence; route never delivers these items. | FAIL |
| Phase 3 last stand | Attacks console; gate one-shot lure, 3s stun; any loadout can finish via weak spots. | No native finale fight evidence. | FAIL |
| Downed failure | Restart at phase start; console charge preserved. | No native finale/death-state evidence. | FAIL |
| Pre-finale Mega rule | Unkillable on the walk; attacks stagger 0.5–1s; no health bar. | No production-input encounter evidence for damage, stagger or UI. | FAIL |

## Baseline conclusion

The observed native route is not an acceptable playthrough: it makes little progress, stalls before the first farmhouse weapon, then dies; later reporting shows the run can reach `hold` but still fails to complete. Fixture pickup tests and authored placements do not satisfy route-accessible acquisition. The baseline has no evidence for a reliable 20–40s beat cadence, route checkpoint spacing, or delivered arsenal. The user-requested fixes therefore start with route completion and route-visible finds, then pacing/checkpoints/farm presentation, then threat and finale behavior. This is the pre-fix review; the same rows must be rerun after fixes.

## Fresh baseline replay (seed 42, 180 s per tier)

Replayed the exact baseline `78219de9` in a detached worktree using production `LevelTenBot.sample()` → `world.applyInput()` → `world.update()`. No position, mission, health or inventory writes were made. Evidence: [`evidence/before-native.json`](evidence/before-native.json). The first audit version reads `world.tick` after disposal, so its top-level `seconds: 0` is a reporting defect; `gameplaySeconds`, event ticks and the trace establish the actual 180 s run.

| Observation | Low baseline | High baseline |
|---|---|---|
| Navigation | Stalls at `(695.99,-4.84)` by ~36 s with zero movement; at 170 s is again stationary at `(688.61,0.12)` after retries. | Larger streamed grid permits progress; `(1212.26,33.69)` at 170 s. |
| Finds | **0/6**, axe only, 2 deaths. | **1/6**: machete at 118.82 s, `(1006.4,80.0)`; farmhouse rifle was passed without collection. |
| First checkpoint | None beyond crash in 180 s. | 45.65 s; later measured walking gap reaches **572 m**. |
| Opening ordinary population | Peak 6 regulars, 0 dogs, 0 ordinary Alphas. | Peak 7 regulars, 0 dogs, 0 ordinary Alphas. |
| First visible close Mega | 53.12 s at `(696.0,-4.8)`. | 83.97 s at `(878.3,46.4)`. |

This refines the baseline: the stall is specific to the smaller streamed navigation coverage, while the high tier independently demonstrates missed weapon delivery. The bot stops visiting a find at <2 m; the pickup used a 0.6 m trigger. The distant story objective also directed human field crossings 75–100 m away from the road finds. Both failures require correction. Opening population and first-Mega timing subclauses now have direct passing evidence; their combined acceptance rows remain FAIL until presentation and full-journey subclauses pass.


## Review after step 2 — marked finds delivered by native input

Evidence: [`evidence/after-finds-native.json`](evidence/after-finds-native.json), seed 42, **650 simulation seconds on low and high**, no health/inventory/position/mission injection. Both runs have **zero deaths**. This is an intermediate review, not a completion claim. The audit's old `finds: 21` includes 15 handover grants; the six physical finds below precede that handover. The subsequent audit distinguishes `find` from `handover`.

| Physical find | Low seconds / player position | High seconds / player position | Before → after step 2 |
|---|---|---|---|
| Hunting rifle | 37.40 / `(694.4,22.4)` | 37.40 / `(694.4,22.4)` | FAIL → PASS |
| Machete | 96.25 / `(935.6,-11.2)` | 96.23 / `(935.6,-11.2)` | FAIL → PASS |
| Molotovs | 146.28 / `(1160.6,-11.9)` | 146.25 / `(1160.5,-11.9)` | FAIL → PASS |
| Nail gun | 198.40 / `(1392.5,15.5)` | 198.50 / `(1392.7,14.9)` | FAIL → PASS |
| Assault rifle | 329.95 / `(1955.5,16.4)` | 329.45 / `(1955.6,16.4)` | FAIL → PASS |
| Flashbangs | 356.27 / `(2072.6,-1.3)` | 355.77 / `(2072.6,-1.3)` | FAIL → PASS |

The six points now lie on the opening road and measured direct field crossings. The shared world/minimap/objective marker selects the next uncollected find while retaining the story objective text. Its pickup ring is enlarged, collection works within 4.5 m, and collection flags survive mission checkpoints. The rifle arrives inside 60 s. The low bot no longer stops at `(696,-4.8)`.

| Acceptance row | Before → after step 2 | Route evidence / remaining failure |
|---|---|---|
| L10-01 | FAIL → FAIL | Opening peaks: 7 regulars, no dogs/ordinary Alphas on both tiers. Farm ground bake still pending. |
| L10-02 | FAIL → FAIL | Visible close Mega at ~98.3 s, `(945,-12)`; only one close section so far; full journey/evasion not established. |
| L10-03 | FAIL → FAIL | Natural route reaches research at 518.07 low /516.25 high and corridor at 632.58/629.87 s. Complex/finish still outside this prefix. |
| L10-04 | FAIL → FAIL | Longest beat gap 25.55 low /24.40 high through 650 s; no corn scare stingers. Full route pending. |
| L10-05 | FAIL → PASS | All six physical finds above; no weapon names in story objective text. |
| L10-06 | FAIL → FAIL | Dogs are route encounters; exact bite/telegraph/cooldown bounds not yet verified by this run. |
| L10-07 | FAIL → FAIL | Same persistent Mega follows the courier from farm through corridor; gap/hide behavior not yet demonstrated. |
| L10-08 | FAIL → FAIL | Native route uses production framing; visual subclauses not established by this receipt. |
| L10-09 | FAIL → FAIL | Complete Voss/Ruiz/Reyes dialogue at 518.08–570.08 low /516.27–568.27 high; cure pickup at 575.92/573.18 s `(2703.3,65)`, flamethrower and arsenal present. Cast/safety/carry subclauses still need observed checks. |
| L10-10 | FAIL → FAIL | Prefix has not reached console hold. |
| L10-11 | FAIL → FAIL | Prefix has not reached finale waves. |
| L10-12 | FAIL → FAIL | Prefix has not reached the final Mega fight. |
| L10-13 | FAIL → FAIL | Prefix has not reached release. |
| L10-14 | FAIL → FAIL | Prefix has not reached epilogue. |
| L10-15 | FAIL → FAIL | First checkpoint 26.78 s; measured walked spacing ≤200 m on both tiers. Restored state after a later route death still needs a direct check. |

| Story beat (same demand as baseline table) | After step 2 | Native evidence / next check |
|---|---|---|
| Wake at wrong bank with corgi and axe | FAIL | Route starts at `(547,0)` with axe; companion/presentation observation pending. |
| Sam opening radio | PASS | Opening continuity fallback `L10.farmstead.reyes` at 0.02 s; the standalone save has no living Sam. |
| Mega climbs from wreck / hunts her | FAIL | Persistent hunt observed; wreck introduction presentation not observed. |
| River exit → farms | FAIL | River exit 23.97 s `(645,-12.4)`; farm palette bake pending. |
| Sam hiding-gap line | FAIL | Line at 96.58/96.57 s, but it currently keys off X progress rather than an observed hide. |
| Hunting rifle farmhouse find | PASS | 37.40 s, above. |
| Machete barn find | PASS | 96.25/96.23 s, above. |
| Nail gun workshop find | PASS | 198.40/198.50 s, above. |
| Molotovs shed find | PASS | 146.28/146.25 s, above. |
| Barn HELP / graves | FAIL | No explicit route visibility receipt for the roof/graves yet. |
| First Mega field crossing | PASS | Visible close encounter by ~98.3 s, within first three minutes. |
| Restricted zone / warning sign | FAIL | Restricted objective begins 307.53/307.07 s `(1855,25)`; sign and dog-pack presentation not yet checked. |
| Assault rifle with flashlight | PASS | Physical pickup 329.95/329.45 s, above; existing assault-rifle equipment presentation applies. |
| Flashbangs | PASS | Physical pickup 356.27/355.77 s, above. |
| Sam broken radio / hangar direction | PASS | Continuity line `L10.armory.reyes` at 416.38/415.43 s. |
| Hangar safe-space arrival | FAIL | Indoor arrival 518.07/516.25 s `(2707,57)`; safety/cast census pending. |
| Voss dialogue and cure handover | PASS | Exact ordered line IDs and native cure collection recorded at 518–576/516–573 s. |
| Ruiz arsenal return | PASS | `L10.ruiz` 552.08/550.27 s; handover fills carried arsenal through ordinary cure collection. |
| Voss flamethrower handover | PASS | `L10.voss-prototype` 559.58/557.77 s; flamethrower in native rack after cure pickup. |
| Sam / Voss goodbye | PASS | Coming/stay/delivery lines 563.58–570.08 /561.77–568.27 s with Reyes fallback. |
| Delivery route / Mega outside | PASS | At 640.02 s courier `(2968,4.7)` low /`(2979.9,7.7)` high; same Mega follows at 24.1/28.3 m. |
| Install cure and hold console | FAIL | Not yet reached. |
| Finale arsenal and hazards | FAIL | Not yet reached. |
| Voss release line and release | FAIL | Not yet reached. |
| Release 0–8 s | FAIL | Not yet reached. |
| Journey wave 8–30 s | FAIL | Not yet reached. |
| Survivors 30–50 s | FAIL | Not yet reached. |
| Delivered 50–65 s | FAIL | Not yet reached. |
| Title / credits / menu | FAIL | Not yet reached. |
| Optional corgi post-credits | FAIL | Not yet reached. |

| Mega rule | After step 2 | Evidence |
|---|---|---|
| Final arena | FAIL | Not reached in this prefix. |
| Phase 1 arrival | FAIL | Not reached in this prefix. |
| Phase 2 rage | FAIL | Not reached in this prefix. |
| Phase 3 last stand | FAIL | Not reached in this prefix. |
| Downed failure | FAIL | No finale death in this prefix. |
| Pre-finale invulnerability / stagger / no bar | FAIL | Mega remains 3000 HP while following; stagger duration and bar presentation need direct observation. |

## Step 5 re-review — full production-input route

Receipt: [`evidence/after-step5-native.json`](evidence/after-step5-native.json), seed 42, low and high, gameplay snapshot `2e181f80`. This replaces the 650 s prefix as the route-delivery proof. Both runs use ordinary movement, aim, weapon selection and interaction; no health, position, inventory, mission or boss writes. The separately labelled [`evidence/finale-input.json`](evidence/finale-input.json) starts with an explicit arena setup and then uses ordinary inputs. Controlled mechanics receipts establish exact rules only after the full native route has demonstrated delivery.

### Before / after pacing

| Measure | Baseline low / high | After step 5 low / high | Result |
|---|---|---|---|
| Route completion | Low stalls at 36 s; high prefix misses 5 finds | Both reach credits, zero deaths | PASS |
| Physical weapon finds | 0 / 1 of 6 in 180 s | **6 / 6**, first rifle at **37.40 s** on both | PASS |
| First checkpoint | None / 45.65 s | **26.78 / 26.78 s** | PASS |
| Maximum checkpoint spacing along walking route | Unbounded low stall / 572 m | **200.0 / 200.2 m**, including bends | PASS |
| Longest gap without content | Baseline did not establish a cadence | **23.52 / 24.52 s** | PASS |
| Fights / scares / Mega moments | No viable low route | **4 / 2 / 5** low; **4 / 2 / 4** high | PASS |
| Installation / release | No completed finale | Install **879.0 / 883.0 s**; release **944.2 / 954.4 s** | PASS — walking/fighting reaches installation in ~14:40 |
| Credits completed | Not reached | **1110.2 / 1120.4 s** (18:30 / 18:40, includes epilogue and 90 s credits) | PASS |

“Fight” groups continuous combat until 20 s without a hit. “Mega moment” requires a visible proximity-band entry after a genuine >50 m separation; it is not a periodic proximity counter. Every beat records player position, subject position, simulation time and cumulative route metres. **Checkpoint and objective notifications do not count as content beats.** Start and the trailing gameplay interval are included in gap measurement; epilogue/credits have their own authored timeline.

The walking-route distance ends at installation. Arena loops and the mounted gun's forced operator-position corrections are recorded separately as `arenaMetres`; they do not add hundreds of metres to a compact, 40 m radius arena. The earlier [`evidence/after-step5-first.json`](evidence/after-step5-first.json) exposes this audit defect as 578–803 m between two same-arena checkpoints. Its actual maximum route gap before installation is ~200 m. That first pass also caught an authored `decor-*` ID suppressing generated scenery, and a high-tier release-return stall; neither receipt is substituted for a successful final run.

### Every L10 acceptance row

Whole-row verdicts stay strict. A missing renderer/performance observation remains FAIL even when the native functional clauses pass. No browser was launched, as required by the brief.

| Row | Before | After step 5 | Native route evidence / remaining criterion |
|---|---|---|---|
| L10-01 | FAIL | PASS | Both opening peaks are 7 regulars, 0 dogs, 0 ordinary Alphas. Start `(547,0)` has axe and safe same-ID corgi. The rebuilt base GLB at the PO's exact `(858.66,-93.68)` is `pal_gloveKhaki` (linear RGB `.3095,.2789,.1441`), replacing green; southern crop blocks and remnants cover that approach. Production assembly retains >100 corn blocks; the scenery-suppression regression has an assembly assertion. |
| L10-02 | FAIL | PASS | Mega first visible **72.73 / 102.03 s**, same ID throughout. At the low farm crossing, `(923.4,-10.8)` at 93.2 s, separation grows **26.5→57.4 m**; military and corridor gaps similarly create real escapes. Full native HP stays 3000 before installation while weapons stagger it. Controlled repeated direct rockets do zero pre-finale damage; bar eligibility reads the installed flag. |
| L10-03 | FAIL | PASS | All 15 story objectives complete, in the intended region/story order. Installation at 879.0/883.0 s meets the ~15 min walking/fighting target. The 56 s hangar conversation is authored dialogue, not idle timing padding. Release/credits timing is separated above. |
| L10-04 | FAIL | PASS | Longest content gaps 23.52/24.52 s; two actual corn scare stingers on each tier. Ordinary population peaks outside assault **11 low /14 high**, during assault **12 /20**. Small admission groups are retained; finale alone admits escort waves. The latest user requirement of 20–40 s supersedes the older quiet-stretch wording. |
| L10-05 | FAIL | PASS | Six retained physical pickups, including first rifle at 37.40 s `(694.4,22.4)`. The shared world/minimap marker points to the next find, a larger visible ground ring marks it, and the 4.5 m pickup trigger exceeds waypoint tolerance. Open farmhouse/barn/workshop/shed structures and tower/checkpoint props now sit beside the finds. Objectives remain story goals. |
| L10-06 | FAIL | FAIL | Dogs are actually delivered along the route (seven dog births on high), with a separate safe corgi. The exact 1.1× speed, 0.65 s telegraph, ≤2 m reach, 2 s cooldown and 10 HP bite need the refreshed exact-mechanics receipt before this whole row passes. |
| L10-07 | FAIL | PASS | The same actor follows without LOS, takes the long way round courier-width gaps, and reaches the arena continuously. Native gap receipts show ~50 m regained separation, not a cosmetic hint. The hide line now triggers within 5 m of an actual gap. Live actor coordinates feed the red pulsing HUD pin; step/roar cues remain attached to that actor. Deliberate native idle deaths in all seven regions prove stillness draws real attackers in. |
| L10-08 | FAIL | FAIL | Production input uses `followTenFrustum` and the actual ×1.3 road framing; framing tests cover the ≤2.0 zoom bound and normal finale lens. **Night readability and rendered ground-slam visibility are not visually approved by a native sim run. Browser QA remains required under the brief's separate visual-QA section.** |
| L10-09 | FAIL | PASS | At 520.02 s low `(2699.5,65.5)` / high `(2703.7,60.7)`, native census records all six living cast members, two guards, injured continuity speaker, **zero infected inside**. All ten Voss/Ruiz/Reyes lines run in order. Cure collection indoors grants the entire selectable arsenal plus flamethrower. The canister is a mission/backpack item, outside weapon slots; native exit speed remains normal. Controlled save/resume restores cast, conversation, cure and racks; living-Sam continuity also passes separately. |
| L10-10 | FAIL | FAIL | Native charge has **exactly 3600 eligible and increment ticks**, zero invalid increments on both tiers. Exact outside/dead/pause boundaries and minigun 20 rounds/s, +12.5% heat/s, 100% lock / <40% unlock await the refreshed contract receipt. |
| L10-11 | FAIL | FAIL | Ordinary assault peaks **12 low /20 high**, below 14/22; same stalker arrives with no teleport. Three-direction bounded waves and breathers remain. Skilled mounted runs have 100% bounded reachability but ~1.92 attacks/min because they shred arrivals. This is **not** the required stationary ground policy; its independent native receipt is pending. |
| L10-12 | FAIL | PASS | Both ordinary-input runs finish with zero deaths and kill the same Mega. Native phase-3 samples show it on the platform at **y=3.78** after using the real stair. Shield/front-ground protection and rear stair pressure pass controlled capability checks; native completion uses the mounted gun and returned arsenal. No close-ground rocket exploit is used. Bar is enabled only after installation. |
| L10-13 | FAIL | PASS | Native release receipts require charge 3600, cure installed, Mega dead and player within console radius. Release occurs at 944.22/954.35 s; controlled predicate checks cover attempts with missing prerequisites. |
| L10-14 | FAIL | FAIL | Native release reaches cured healthy people, keeps the dead Mega dead and the same safe corgi, then Delivered at +50 s, title +65 s, full 90 s credits and completion. Same-ID conversion, initial playable movement and repeat-view skipping pass mechanics fixtures. **Shot continuity, hymn/credits readability, full-map panorama draw/performance and the rendered survivor scenes require visual review; sim events cannot establish those pixels.** |
| L10-15 | FAIL | PASS | [`evidence/recovery-native.json`](evidence/recovery-native.json): 14 deliberate idle deaths, one in every region on both tiers, restore within 0.04 m of the reached local checkpoint, with identical rack IDs, cure flags, Mega ID and HP. None returns to level start. Phase-specific retry/retained-charge checks are separate below. |

### Every L10 story-script beat, after step 5

Demands are unchanged from the complete baseline story table above. Timed delivery comes from the full input-only receipt, not from placing the courier at a scene.

| Story beat | Before → after step 5 | Route evidence / remaining check |
|---|---|---|
| Wake at wrong bank with corgi and axe | FAIL → PASS | Native start `(547,0)`, axe-only rack and same corgi ID 99, never harmed. |
| Sam opening radio | FAIL → PASS | `L10.farmstead.reyes` at 0.02 s; standalone save has no living Sam. Living-Sam fixture preserves his model/lines. |
| Mega climbs from wreck / hunts her | FAIL → FAIL | One persistent actor introduced at 45 s, first visible by 102.03 s, follows throughout. A literal animated climb from the river wreck is not established by the native receipt. |
| River exit → farms | FAIL → PASS | River exit at 23.97 s `(645,-12.4)`; route now crosses dry farm ground, actual standing corn, ruins and dead livestock. |
| Sam hiding-gap line | FAIL → PASS | Real gap trigger and traversed escape, rather than old X-only subtitle trigger; low farm escape gives 30.9 m additional separation. |
| Hunting rifle farmhouse find | FAIL → PASS | 37.40 s `(694.4,22.4)`, physical pickup beside the open farmhouse. |
| Machete barn find | FAIL → PASS | ~96–97 s `(935.6,-12)`, physical pickup beside the open barn. |
| Nail gun workshop find | FAIL → PASS | ~198–200 s `(1392.6,15.5)`, physical pickup beside the workshop shell. |
| Molotovs shed find | FAIL → PASS | ~146–148 s `(1160.5,-11.9)`, physical pickup beside the smaller shed shell. |
| Barn roof HELP / three inside / graves | FAIL → FAIL | Retained roof panel carries the correct atlas text above three graves at `(942–946,-26)` beside the machete crossing. Exact layout/route proximity is fixed; rendered legibility has not been visually approved. |
| First Mega field crossing | FAIL → PASS | Visible at 72.73/102.03 s, before 3:00. |
| Restricted zone / warning sign | FAIL → FAIL | Native restricted-zone traversal and stronger infected/dogs are delivered; actual rendered warning wording/searchlight/quarantine composition needs visual review. |
| Assault rifle with flashlight | FAIL → PASS | ~330 s `(1955.5,16.4)`, retained physical rifle beside the guard tower; its equipment light binding follows the selected rifle. |
| Flashbangs | FAIL → PASS | ~356–358 s `(2072.6,-1.3)`, retained physical pickup beside checkpoint storage. |
| Sam broken radio / hangar direction | FAIL → PASS | `L10.armory.reyes` during the restricted-zone crossing, before the hangar. |
| Hangar safe-space arrival | FAIL → PASS | Full native arrival, six living cast members and zero infected inside; open door leads to indoor handoff. |
| Voss dialogue and cure handover | FAIL → PASS | All ten ordered line IDs and real cure collection; courier says `I carried it`, Voss explains return to humanity. |
| Ruiz arsenal return | FAIL → PASS | Native `L10.ruiz`, then cure transaction adds all campaign weapons to selectable racks. |
| Voss flamethrower handover | FAIL → PASS | Native `L10.voss-prototype`; actual flamethrower in carried rack after handoff. |
| Sam / Voss goodbye | FAIL → PASS | Coming / stay / delivery lines, with Reyes fallback where Sam is absent. |
| Delivery route / Mega waiting outside | FAIL → PASS | Native exit, corridor fight and courier-width escape; same Mega follows and walks into the final complex. |
| Install cure and hold console | FAIL → PASS | Install 879.0/883.0 s; exactly 3600 eligible charge ticks under real assault. |
| Finale arsenal and hazards | FAIL → PASS | Native complete fight uses returned weapons/mounted gun; accessible fuel hazards and powered gate are verified separately. |
| Voss release line and release | FAIL → PASS | `L10.release` after Mega/charge conditions, followed by real console release. |
| Release 0–8 s | FAIL → PASS | Native cure front converts living actors, preserves dead Mega, leaves courier/corgi healthy. Ordinary movement remains enabled during initial 8 s; controlled same-ID conversion also passes. |
| Journey wave 8–30 s | FAIL → FAIL | Native timeline reaches journey segment; rendered journey landmarks and curing continuity require visual review. |
| Survivors 30–50 s | FAIL → FAIL | Native survivor/reyes radio segment is reached; rendered saved-survivor identities and staging require visual review. |
| Delivered 50–65 s | FAIL → FAIL | Exact +50 s Delivered and +65 s title trigger are native; sunrise, phone framing and full-map pullback require visual approval. |
| Title / credits / menu | FAIL → FAIL | Native title/90 s credits/thanks/completion and skip contracts are reached; readability/licence presentation and final menu rendering need visual approval. |
| Optional corgi post-credits | FAIL → FAIL | Optional toy collection and thanks-phase mouth attachment are implemented and mechanics-tested. The canonical walking route does not detour to the optional porch toy, so this receipt cannot claim the conditional shot was received. |

### Every Mega rule, after step 5

| Rule | Before → after step 5 | Evidence / remaining requirement |
|---|---|---|
| Final arena | FAIL → PASS | Both full routes reach the machinery yard; real fuel hazards, console, mounted platform and one-use electric gate are reachable. |
| Phase 1 arrival | FAIL → FAIL | Full native phase 1 begins 879.03/883.03 s with 3000 HP and escort waves. Charge-into-machinery 120-tick stun and glowing back counter need the targeted fixture to pass; it is being corrected rather than inferred from a method existing. |
| Phase 2 rage | FAIL → FAIL | Native phase 2 at 892.00/904.47 s, ~2085/2089 HP; both Megas actually climb to y=3.78. Armour/flame, roar-wave and real corpse-throw fixtures are being refreshed; the first throw setup failed. |
| Phase 3 last stand | FAIL → FAIL | Native phase 3 at 917.12/922.50 s, ~1016/1003 HP; gate deals 900 and stuns for 180 ticks in controlled production mechanics. Console-directed movement and retained full damage have targeted checks; final receipt pending. |
| Downed failure | FAIL → FAIL | All-region native deaths restore checkpoint state. New phase checkpoints and retained charge pass the initial targeted real-death fixture, but the complete refreshed receipt is pending. |
| Pre-finale Mega rule | FAIL → PASS | Full native HP remains 3000; repeated direct-rocket fixture confirms zero HP loss. Hit stagger is 30 ticks with bounded cooldown; renderer bar eligibility follows the installed flag. |

### Remaining visual QA

No browser was used. The FAILs above that explicitly name rendered appearance, shot continuity, audio/credits readability or panorama performance need the PO/visual-QA lane. Native route delivery is now established; those verdicts are not silently converted to PASS by source inspection. The literal river-wreck climb and optional-toy route also remain called out, rather than being hidden behind completion metrics.


## Final mechanics and pressure closure (2026-11-08)

These receipts close the explicitly pending functional checks above. Historical baseline and step-2/step-5 observations remain intact; the table below is the newer verdict where it differs.

| Row / rule | Before | Latest verdict | Evidence |
|---|---|---|---|
| L10-06 dogs | FAIL | PASS | [Contracts](evidence/contracts.json): four exact dog checks per tier pass (speed, telegraph, reach/cooldown, bite damage); full native routes deliver actual dogs separately from the unharmed corgi. |
| L10-10 charge / minigun | FAIL | PASS | All exact boundary/heat/rate contracts pass on low and high. Full route records exactly 3600 eligible increments and no invalid increments. |
| L10-11 stationary pressure | FAIL | PASS | [Independent native stationary-ground policy](evidence/stationary-native.json), after walking to the console: bounded reachability 100% both tiers. Hold attacks/min **98.53 low / 228.36 high**; Mega-fight phase **84.75 / 206.57**, above 8/min. Expected idle-policy deaths are recorded, rather than suppressed. Ordinary caps remain below 14/22. |
| Mega phase 1 counter | FAIL | PASS | [Mechanics](evidence/mega-mechanics.json): actual charge stopped by machinery, 120-tick stun and exposed-back timer. Native route establishes phase delivery; controlled setup establishes the precise counter. Weak-point pixels still need visual QA. |
| Mega phase 2 counters | FAIL | PASS | Real retained corpse is lifted/thrown, roar requests the bounded escort gate, flame strips armour after two seconds, flashbang interrupts for one second without damage or bullet-shortened stun. Both tiers climb the actual stair. |
| Mega phase 3 / downed failure | FAIL | PASS | Actual console-directed walking; real downed courier restores phase HP and retained charge 1234. Gate damage/stun and positive damage contracts pass separately. |
| Platform release obstruction | FAIL | PASS (targeted mechanics) | Dead raised finale body remains rendered but is traversable, like smaller infected corpses. Bot uses authored stair-top/foot anchors: the interaction marker was 2 m offset from the assembly origin. Ordinary input landing/death fixture descends and releases on both tiers. Full current route confirmation follows below. |
| Global G-24 | FAIL | FAIL | Existing mandatory Alpha bar policy makes a healthy distant Alpha visible. All **26 L10-specific contract checks** pass; the broader global failure is retained in the receipt. |

The mechanics receipt now contains **20/20 PASS checks**, with explicit controlled setup labels and a content hash. [E32 verification](evidence/e32-checks.json) passed typecheck, lint and unit tests: **106 passed, one skipped**, with two Vitest workers. Runner validation reconstructed its manifest Git objects so freshness checks used real source contents; it did not modify this branch or push anything.

### Later ambush delivery

[Reserved-slot native receipt](evidence/after-reserved-ambush-slot.json), source `fc867c06`: low/high both finish, with **9 / 8 actual emerged attackers**, separate warning events, six finds, first checkpoint 26.78 s, route checkpoint maxima 200.0/200.2 m and content gaps **25.75/24.25 s**. Low has zero deaths; high has one genuine death/retry at the then-blocked platform exit. This is preserved as an intermediate receipt, not labelled a zero-death final run.

Strict L10-04 caveat: the newer user requirement of content every 20–40 s passes. The older scare-specific “about every 60–120 s” clause is not uniformly proven: high has a 231.5 s emergence gap spanning the safe hangar and exit, and another 132.8 s gap. Therefore **L10-04 as a whole remains FAIL against that older scare-only interval**, despite the passing overall content cadence. These gaps do not disappear by counting music warnings as attackers. Exact emergence times/positions are in the receipt.


## Final production-input verification

**Gameplay source `59587da4`**, seed 42, low/high, [final native receipt](evidence/final-native.json). Content hash: `704521ba76d468fbcac0f1a1ba790974989877c69bb130c111455efd43be44d1`. Both routes use production movement, aiming, weapon selection, mounted gun and interaction inputs; no pose, HP, inventory or mission writes. Both descend the real platform stair and release without a retry after the corpse/stair fixes.

| Measure | Before | Final low | Final high |
|---|---|---|---|
| Completion | Low stalls at 36 s; no demonstrated completion | **Complete, zero deaths** | **Complete, zero deaths** |
| Physical finds | 0 low / 1 high in 180 s | **6**, first **37.40 s** | **6**, first **37.40 s** |
| First checkpoint | None low /45.65 s high | **26.78 s** | **26.78 s** |
| Maximum walking checkpoint spacing | Unbounded low /572 m high | **200.0 m** | **200.2 m** |
| Longest content gap | No viable cadence | **25.75 s** | **24.25 s** |
| Fight groups / actual scares / Mega moments | Not established | **4 /9 /2** | **5 /8 /4** |
| Install / release | Not reached | **879.02 /944.58 s** | **883.02 /948.67 s** |
| Credits complete | Not reached | **1110.58 s** | **1114.67 s** |

### Final whole-row acceptance verdicts

The criterion text remains in the baseline table; every row is reassessed here. “FAIL” includes a partially passing row with an outstanding clause.

| Row | Before → final | Final evidence / outstanding clause |
|---|---|---|
| L10-01 | FAIL → PASS | Opening peak 7 regulars, no dogs/ordinary Alphas; dry ground at the PO position and 236 assembled corn blocks, farm shells/remnants. [Ground receipt](evidence/ground.json). |
| L10-02 | FAIL → PASS | First visible **72.73/102.03 s** by production visibility observer; close encounters across eight route sections, physical evasion gaps, same invulnerable actor until installation. |
| L10-03 | FAIL → PASS | All 15 objectives and seven ordered regions; installation at 14:39/14:43, including fights and the authored hangar conversation. |
| L10-04 | FAIL → FAIL | New overall 20–40 s content requirement passes, 25.75/24.25 s maxima; 9/8 actual scares and ordinary peaks 11/14 before assault. The separate older scare-only 60–120 s clause has longer intervals, including safe-hangar time. |
| L10-05 | FAIL → PASS | Six actual physical pickups; larger triggers/rings and shared next-find world/minimap marker. Find timestamps/positions below. |
| L10-06 | FAIL → PASS | Actual route dogs, distinct safe corgi, plus all exact dog contracts pass on both tiers. |
| L10-07 | FAIL → PASS | Persistent no-LOS pursuit and real gap detours; latest low farm crossing at 94.12 s `(923.48,-10.80)` increases separation **21.94→60.16 m**; later military/corridor escapes exceed 66 m. Stillness attracts genuine attacks. HUD/audio bind to the same actor. |
| L10-08 | FAIL → FAIL | Native camera/framing contracts pass; rendered night readability and ground-slam telegraph remain Browser QA. |
| L10-09 | FAIL → PASS | Six living hangar cast members, injured continuity speaker, zero infected inside; ordered dialogue/cure handoff, complete arsenal and flamethrower. Native census at 520.02/530.02 s; inventory/continuity contracts pass. |
| L10-10 | FAIL → PASS | Exactly **3600 eligible/increment ticks**, zero invalid increments on both complete runs; exact outside/dead/resume/minigun heat/rate/lock contracts pass. |
| L10-11 | FAIL → PASS | Ordinary assault peaks **11/20**, bounded waves, same walking-in Mega; separate native stationary ground reachability 100% and attacks well above 8/min. |
| L10-12 | FAIL → PASS | Same Mega phases/climb/kill and real platform descent; both full routes zero deaths. Shield/stair/arsenal contracts and all targeted counters pass. Raised dead body remains visually persistent but cannot seal the sole stair. |
| L10-13 | FAIL → PASS | Real release at 944.58/948.67 s near console, all prerequisites met; negative predicate checks pass. |
| L10-14 | FAIL → FAIL | Functional cure conversion, safe corgi, dead Mega, initial 8 s control, +50 s Delivered, +65 s title and 90 s credits all delivered. Rendered journey/survivor shots, panorama performance and credits/audio still need Browser QA. |
| L10-15 | FAIL → PASS | Fourteen native all-region death/recovery receipts; phase-entry real-death fixture retains charge and restores phase HP. Final skilled routes need no death/retry. |

### Final physical finds on the walking line

| Find | Low time / position | High time / position |
|---|---|---|
| Hunting rifle | 37.40 s `(694.4,22.4)` | 37.40 s `(694.4,22.4)` |
| Machete | 96.95 s `(935.6,-11.9)` | 97.18 s `(935.6,-11.2)` |
| Molotovs | 146.97 s `(1160.5,-11.9)` | 147.20 s `(1160.5,-11.9)` |
| Nail gun | 199.10 s `(1392.6,15.5)` | 199.43 s `(1392.7,14.9)` |
| Assault rifle | 330.63 s `(1955.6,16.4)` | 330.40 s `(1955.6,16.4)` |
| Flashbangs | 357.00 s `(2072.6,-1.3)` | 356.77 s `(2072.6,-1.3)` |

The complete story-beat and Mega-rule tables above still apply with the final mechanics closures. The literal river-wreck emergence animation, rendered barn/warning/ending presentation and conditional corgi shot remain explicitly open; functional route completion does not approve those presentation criteria.
