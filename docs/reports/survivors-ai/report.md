# Survivors AI — PO 2026-10-20

Lane `lane/survivors-ai`, based on main `60c51a67a`, with the required merges of `lane/p0-l5-finish` and `lane/l5-survivor-rings` (merge `6445bff26`). No deployment or push.

## Changes

- **#70:** Direct infected attacks interrupt pedestrian routines. Found survivors react to close contact before the L5/L6/L7/L8 formation handler. Unarmed people run away while steering toward the courier when safe. Armed followers run the existing allied combat, including self defence during a grab, and resume formation with no stale target when the threat leaves range. L3's existing exception for grabbed officers remains.
- **Grab design:** E23 §7 specifies a one-second grab, rescue by hitting the attacker, then bite and a 2.5–3.5 second transformation. This existing bite design is preserved under the intake's explicit exception. Rescued people clear their old route/cover and flee on the next behaviour tick. No automatic immunity or removal of the bite.
- **#71:** Every fatal outbreak bite sets actual HP to zero, including unarmed people at the infected cap. Finished civilians are ineligible for survivor bars, including legacy snapshots that contain positive HP. Living grabbed/downed bars read the existing HP fraction. Bodies remain in the world.
- **#73:** Moving followers and gunners face their actual displacement. A shooter may retain target facing only with a living target in gun range while aiming, outside reload; continuous aiming during movement is capped at two seconds, followed by at least half a second facing travel with the gun lowered. The final correction applies to follower/gunner movement; passive crowd nudges retain the controller’s pose. Repeated hits cannot shorten an engaged fighter’s weapon cadence.
- **#56/#56b:** The eight existing L5 scenery firearms become actual group pickups. Live followers collect one within two metres, with height/visibility checks, and receive the existing allied pistol/rifle combat. The original action ID and held prop live in the serialized civilian component. Courier mission pickups, shelf weapons, melee, rockets and weapons discarded by the courier are excluded. No additional guns or enemies are authored. The regular campaign survivor payload keeps the weapon through L6/L7/L8; new level clocks clear stale attack/reload/post/target state while preserving the gun. Checkpoint restoration rebases the timers.
- **#57:** Wreck tops are sampled only on an actor's current height layer; street actors cannot jump up through a wreck. A generated mesh support bake supplies the actual visible wreck roofs above the intentionally clipped 1.65 m crowd-collision band; an independent GLB ray test and source hashes guard it. The corgi samples its full paw footprint so roof edges do not bury the body. Objective/discovery rings resolve the surface at their own position on the appropriate layer and depth-test against wrecks; the overhead arrow keeps its existing visibility.

The PO intake supersedes the old E23 statements that found survivors are always unarmed and never fight. The sole specification edit corrects E24-AC02’s upper time bound, explained below. Enemy counts and weapon damage/accuracy/cadence data are unchanged by this lane. L6 criteria and one L4 inferred first-beat casualty assertion are corrected with three-seed evidence below; the prerequisite rings lane supplies the requested extra loners and its associated count/hash changes.

## Evidence

- `tests/unit/survivors-ai.test.ts`: attack → flight, rescued grab → flight, unchanged bite timing, armed fight-back, travel facing and two-second bound, firearm eligibility and one-per-follower, actual HP/bar eligibility, persistent fatal body.
- `tests/levels/survivors-ai.test.ts`: production L5/L6/L7/L8 handler precedence and authored injury speed, production L5 ground pickup, save reload and L6→L7→L8 carry, actual bus roof and marker layers.
- `tests/scenes/catalog/survivors-ai-*.json`: grab/release, armed fight-back, following through a corner without a threat, production L5 pickup, bus discovery ring and the L5 wreck roof. All use the game camera at zoom 1. [Visual review and retained captures](visual-review.md) covers all twelve scene/tier combinations.
- `tools/survivors-ai/compare.ts`: identical main/branch comparison for seeds 1/2/3 and complete/newbie/evade-only profiles; no cheats or balance edits.

[Three-seed comparison](comparison.md) is complete. Validation results are recorded below after the queued full runs finish.

## Imported balance pins

The required `lane/l5-survivor-rings` merge changes the L5 opening population from high/low **18/12 to 27/18** by adding nine lone shamblers. Caps remain 30/30, damage 1.25, maximum group size 3. This lane adds none.

That prerequisite also changes these assertions relative to main:

- `tests/levels/L5.test.ts`: opening upper count 20 → `l5.infected.start.high + 2` (29).
- `tests/unit/levels/l5-static.test.ts`: authored high-count upper bound 20 → 27.
- `tests/levels/l5-po-2-balance.test.ts`: infected-layout hash `3ea30ea6b351df44b128911ff143484a213c04d197600d3910b3041c5734c2e4` → `8464845744df35c5b51b267a500f0ef37c3faba64bbf722e5c34a5654ea9b90f`.

The three-seed comparison uses untouched main `60c51a67a` and this full branch, so it includes those imported population changes. L5 complete/newbie/evade-only time and death thresholds are unchanged. Additional assertion edits cover pickup ownership, the serialized dropped-weapon marker, ring depth, and the Metro HUD phase introduced by the prerequisite merge.

## L6 criterion corrections

[Three-seed main/branch evidence and rationale](comparison-l6.md) records both changes: E24-AC02 complete upper time 270→300 seconds (also corrected in the epic), and E24-AC09 replacing inferred rescue of waiting people with a real-casualty check while retaining the actual ≤30% evacuation ceiling. No enemy counts, damage, injury speed, rescue floor or group pause rule is changed.

## L4 first-beat assertion

[Three-seed main/branch evidence](comparison-l4.md) corrects one inferred casualty: first-beat living soldiers `< initial` becomes `≤ initial`, because E22-AC13 permits a forced break at 62 seconds even with no casualty. Main already has no first-beat loss on two of three seeds. The later strict half-loss assertion, all beat windows, Alpha/barricade checks, caps and corpse persistence stay unchanged.
