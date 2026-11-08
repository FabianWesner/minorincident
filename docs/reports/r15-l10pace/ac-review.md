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
