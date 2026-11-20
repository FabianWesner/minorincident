# L10 finale route — hangar to dispersal complex (design, 2026-11-20)

PO 2026-11-20, verbatim: "This walk from hangar to final checkpoint feels boring. Not much action, no story elements, scenerry is lame. There are tmp checkpoints that are totally pointless (bc nothing happens there). This needs some serious cnosideration." and "L10 will be our master piec[e]".

## Goal

The ~1 km from the research hangar (x≈2750) to the dispersal complex gate (x≈3755) becomes the climax of the game: 7–9 minutes, a new beat every 45–75 s, never more than 20 s without a fight or a story moment, a landmark always in view that pulls the player forward, and checkpoints only where something just happened.

## Throughline

The courier carries the cure; the Mega hunts it. Each beat either (a) shows what happened to the people who tried this before her, (b) escalates the Mega's hunt, or (c) is a fight she has to win. The dispersal complex is visible from the hangar exit as a lit tower with a sweeping searchlight, and grows in the frame as she approaches.

## Beats (x positions approximate; reuse s186 stations where they exist)

| # | Where | Beat | Story element | Fight | Checkpoint |
|---|---|---|---|---|---|
| 0 | Hangar exit (2750) | Doors open on the amber haze; the complex tower and searchlight on the horizon | Voss on radio: route briefing ("follow the searchlight"); distant Mega roar | Hangar-front group (fix s209) | — |
| 1 | Evac road (2800–2990) | Abandoned evacuation: buses with doors open, suitcases, a child's bike, a hand-painted sign "WAIT FOR THE BUSES" | Environmental story only; Sam: "They never came back for them." | Mega-call reservoir trickle from the yards | — |
| 2 | Quarantine gate (3010) | Gantry "YOU ARE NOW LEAVING THE QUARANTINE ZONE", sandbags, hazmat effigies | Private Reyes' last radio loop playing from a dropped handset | Bus/tower burst (s186) | **CP 1 — after the gate fight** |
| 3 | Billboard (3076) | "STAY CALM. THE CURE IS COMING." billboard collapses, crowd pours out | Irony line from the courier ("It is. Late.") | Horde (s186) | — |
| 4 | Dry crop field + scarecrows (3150–3220) | The road skirts a tinder-dry field with scarecrows | Sam: "Those fields are dry as tinder — light them up." | Scarecrows tear free; burning the field (s202) clears it | — |
| 5 | Burning convoy (3260) | Overturned army trucks, ammo crates popping, refill crates | Soldier's dog tags and a log: "Convoy 7 — they came from both sides" | Three-sided wave (s186) | **CP 2 — after the convoy** |
| 6 | Overpass (3320–3380) | The Mega appears on the overpass above, throws a wrecked car / a zombie down at her, roars and calls the reservoir | Courier: "It's not chasing me. It's herding me." | Mega throw + called infected (s187/s205) | — |
| 7 | Underpass (3390) | Darkness, flickering emergency lights, silence except shuffling; torch matters | Voss's radio breaks up into static | Crawlers in the dark (s186) | — |
| 8 | Field hospital (3502) | Lit tents with moving silhouettes; cots, IV stands, triage tags | A medic's recorder on a cot: the last minutes of the field hospital | Tents burst open (s186) | **CP 3 — at the hospital after the fight** |
| 9 | Final approach (3550–3755) | Searchlight sweeps the road, sirens, the complex gate lit up; burning barricades | Voss: "I see you. Run!" | Last stand at the gate: the Mega's final call brings everything that's left | **CP 4 — complex gate (cure-complex)** |

## Motorbike (PO 2026-11-20)

PO, verbatim: "Why not using a bike. A motorbike with same physics like the bike in L1. This could be a nice gameplay element for L10. Ideally I could still shoot when riding it; but only with the gun."

- Found at beat 1 (evac road, by the buses), keys in it. Same handling model as the L1 bicycle, a bit quicker than the L1 bicycle (top speed ~1.25× the bike; PO), engine sound, headlight.
- While riding: only the handgun, one-handed, aimed with the mouse (forward ~200° arc); no melee, no other weapons; other weapons return on dismount.
- The corgi rides in a sidecar.
- Rhythm: ride → roadblock (gate barricade, convoy wreck line, underpass rubble, hospital fence) → dismount, fight, find the way → remount (the bike can be pushed/ridden through a gap the player opens, or a second bike waits beyond). The final approach (beat 9) is ridden at full speed under the searchlight, ending at the complex gate.
- Infected can knock her off on a hard hit (existing ride-contact rules); she can remount.

## Checkpoints

Replace the automatic `cure-pace-N` checkpoints inside this stretch with the four named ones above (and any authored ones before the hangar stay as they are). Old saves at a removed `cure-pace-N` load at the nearest preceding named checkpoint (migration + test). The HUD checkpoint toast names the place ("Checkpoint — Convoy 7").

## Scenery

Amber dust haze (s186) plus: evacuation buses and abandoned cars along the road, downed power lines, a crashed helicopter in a field, burning oil drums, a military barricade line, and the complex tower with its searchlight as a landmark visible from beat 0 onward. Props go through the district pipeline; every figure through TRELLIS; every prop solid (s211 audit).

## Pacing rules

- No gap > 20 s without a fight or a story moment (radio, discovery, Mega sighting) on the skilled route, HIGH and LOW.
- Each beat ~45–75 s; total 7–9 min on the skilled route.
- Story lines are short (≤ 2 lines), subtitled, never stop the player.
- L10 skilled route completes; `qa:threat` 0 flags.
