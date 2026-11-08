# L10 acceptance review — pre-fix baseline

**Review stage:** Step 0, before gameplay fixes. Baseline tree: `78219de9` (main story/farm/vignettes merge), with the audit harness added but no gameplay edits. The harness has not yet completed a fresh runner execution; route facts below cite the existing native production-input diagnostic in `docs/reports/eg-l10-story/evidence/route-diagnostic.json` and explicit historical route reports. Lack of a natural-route observation is scored FAIL, not inferred PASS from implementation or fixture tests.

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
