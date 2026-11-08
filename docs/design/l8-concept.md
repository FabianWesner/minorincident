# L8 "The Zoo" — gameplay concept (r12-l8story, 2026-11-08)

PO 2026-11-08, verbatim: "the entire level is pointless. I expected to see normal Zoo animals which then become Zombie animals. Seems like this didn't make it into the game." and "The whole level needs a gameplay concept. It feels fully broken right now."

Source of truth stays [E30](../../specs/epic-30-level-8-the-zoo.md). This page says how its beats play, with the existing D-ZOO layout (no Blender rebuild needed).

## Map facts this concept uses

Arrival/bus at (0, 70) at the south gate; APC at (96, 74) in the south-east corner. Enclosures: lion (−60, −32), flamingo pond (0, −32), gorilla (60, −32) north of the **central boulevard z = 0**; elephant (−60, 32) and zebra (60, 32) south of it. Each enclosure has a 5 m gate on the boulevard side, so a walk along z = 0 passes four fences at 12 m and the pond. Tunnel outlets: west (−101, 32), east (101, 32), north (−30, −69), south plaza (32, 69).

## What is broken today (measured, `tools/qa/r12-l8story/animal-probe.ts`, high tier, passive courier)

1. **The player never sees an animal.** Animals stand in enclosure centres, 32–118 m from the arrival→APC route (zebras 32 m, elephant 68 m, gorilla 96 m, flamingos 96 m, lion 113 m). The iso frame at zoom 1 is ~24 m wide. They pace between two points 3.6 m apart.
2. **The calm 60 s has no destination.** Main shows "Stay with the group" with no marker; the only obvious walk is straight to the APC 96 m east, which never passes an enclosure. (r12-l8, in progress, points the calm objective at the zoo gate ≈ 8 m from the spawn: still no animals on the way.)
3. **Almost no animal turns.** In 4 min: one elephant bitten at 83 s (66 m from the route), one flamingo at 187 s (94 m away), two flamingos simply die. Lion, gorilla and both zebras never turn. The battle is ~180 human infected and 1–2 animals. L8-05/AC09 passed on isolated fixtures only, never in the level.
4. Every tunnel cohort is scripted toward the route/APC (east cohort to the APC door, south cohort across the plaza exit), so no infected ever enters an enclosure. The fight is a human horde corridor, not a zoo.
5. No zoo ambience: there is no normal-animal sound at all (only infected telegraph cues).
6. Known, owned by other lanes: board/depart before the fight (r12-l8), ~190 characters in the breach (r12-l8perf).

## The level in five beats (target ~5 min)

| Beat | Time | Goal / motivation | What the player does | Objective + marker |
|---|---|---|---|---|
| 1 Sanctuary tour | 0:00–1:00 | "We're safe." A zookeeper guides the group to the commander's post in the central plaza, past the animals. The player should relax and look. | Walk the group north on the x = 24 path, then along the boulevard; look at the lion, gorilla, elephant, zebras and flamingos at the fences (spawned near their boulevard gates, lit, idling, keepers feeding); free to wander. No enemies. | "Follow the keeper to the central plaza" → marker on the plaza (≈ (0, 0)); arriving early is fine, the timer stays 60 s. |
| 2 From below | 1:00–1:30 | Shock. Tunnel doors open; soldiers fight; the player sees a keeper and **an animal bitten at the fence 10–15 m away** and watch it turn in 3 s (it shakes, eyes go red, bar appears). | Protect the group in the plaza: shoot the first wave (north outlet cohort routed through the lion and gorilla gates onto the boulevard; that is how animals get bitten). | "Protect the group!" (no marker for 10 s while the first wave arrives), then beat 3. |
| 3 Zoo outbreak | 1:30–3:30 | Get the survivors out. The zoo you just toured is now the threat: infected lion, gorilla, elephant, zebras come out of their gates onto the boulevard. | Lead the group east along the boulevard or the southern loop (two routes, both past enclosures); fight infected animals (lion pounce, gorilla pound/throw, elephant charge, zebra kick/stampede, flamingo dive, all telegraphed with bars), Alphas and turned staff/soldiers; pick up rescued zoo adults. | "Lead the group to the armored vehicle" → marker on the APC door. |
| 4 Hold at the APC | 3:30–4:30 | Get everyone in. | Cover the boarding queue at the service yard while the east cohort and the last infected animals come in; the courier boards last (existing rule). | "Cover the survivors while they board (n/N)". |
| 5 Departure | 4:30–5:00 | Escape. | Drive out of the east gate; L9 loads in the same APC. | Existing. |

**Why the animals matter:** beat 1 shows them as residents the keepers care for; beat 2 shows the bite and turn right in front of the player; beat 3 makes those same animals (same ids, same enclosures) the hardest enemies between the player and the APC. That continuity is the level's story.

**Group/companion:** the carried L7 group follows in formation all level (existing follower). The corgi stays at the courier. Soldiers fight (existing allies) and mostly fall in beat 3. Zoo staff/civilians can join via the existing survivor interaction.

**Threats and failure:** beat 1 none. Beats 2–4: human infected from the tunnels, 3–5 Alphas, **≥ 4 infected zoo animals actually attacking the player/group** (lion, gorilla, elephant at minimum). Courier death → checkpoint (sanctuary / breach / escape-route); APC destroyed → fail; survivor losses persist; zero survivors stays completable. No kill-all goal, no timer.

**Sequence breaks:** the APC is locked (no board, no drive) before the breach and until the escape step is active (r12-l8's guard). The calm objective never points at the APC.

## Reused vs new

Reused: D-ZOO layout and enclosures, the 8 healthy `zooAnimal` civilians and their same-id turning in `Outbreak.ts`, infected lion/gorilla/elephant/zebra/flamingo brains, moves, bars and telegraph captions, staff looks, HouseEmergence tunnel outlets, followers, allies, APC boarding/transfer, story.say barks.

New (small): animal spawn points at each enclosure's boulevard side plus a wider idle wander and facing toward the visitors; one keeper guide (existing staff NPC with waypoints) and the plaza objective/marker; a breach-cohort route through the lion and gorilla gates so bites happen near the plaza; infected animals given `pursueTarget` on the courier/group once turned; a quiet animal-ambience loop (existing synthesis/AmbienceSchedule) for calm; story barks ("The lion's been bitten!"). Optionally, raise the animal count to 10–12 (2 lions, 2 gorillas) if perf allows; animals are only ~10 % of the infected budget.

## Implementation plan (2–3 lanes)

1. **Story lane (Opus, ~2.5 h, this lane):** animal placement at the boulevard gates and wander; calm "follow the keeper to the plaza" objective + marker (coordinated with r12-l8, which owns `LevelEightZoo.ts` objective/marker code and the APC lock); breach cohort through the lion/gorilla gates; turned animals pursue courier/group; barks. Check: animal probe (≥ 5 animals ≤ 15 m from the route in calm; ≥ 1 turn ≤ 20 m from the courier ≤ 30 s after breach; ≥ 4 infected animals attack the player/group) plus real-input runs low/high, zoom 1/1.5, captures.
2. **Feel/ambience lane (Sonnet, ~2 h):** calm animal ambience, keeper feeding idles, turn "readability" (shake, eye/blood swap timing, caption), plaza lighting check; Opus visual QA "is it stunning?" on calm/turn/battle frames.
3. **Balance lane (Sol, ~2 h, after 1 and r12-l8perf):** human infected count down, animal share up within E18 budgets; qa:threat L8 and qa:accept L8 rows L8-03/05/06 green.
