# Texts and credits review (lane texts-credits, 2026-10-15)

PO 2026-10-15 (verbatim): "In the credits, mention me (Fabian Wesner https://www.linkedin.com/in/fabian-wesner/) but also all involved LLMs and harnesses" and "Also have an Opus lane reviewing all texts that we have. Make sure we don't have em-dashes, make sure all texts are nice to read for the user and fit to the game (Don't state the obvious)."

## Credits

- New hand-authored `src/data/madeBy.ts` (the generated `src/data/credits.ts` stays untouched). Menu credits (`GameUI`) open with "Made by Fabian Wesner, with a crew of AI agents", Fabian linked to LinkedIn, then AI models, harnesses and tools; the generated licence sections follow unchanged.
- The L10 end-credits roll (`CampaignUI.credits`) is now a short centred roll: title, headline, Fabian's role, models, harnesses, tools, the three.js/Rapier/Bruno Simon line and a closing thank-you. Timing (12 s, sim phase clock) is unchanged.

## Inventory and method

Every string literal in `src/data`, `src/ui`, `src/levels`, `src/sim` (missions, interact, outbreak), `src/audio`, `src/input`, `src/Game.ts` plus `index.html` and `public/site.webmanifest` was extracted with the TypeScript scanner (636 candidates, of which ~280 are player-facing; the rest are thrown errors and ids) and read in context. Areas: HUD objectives and trackers, dialogue/radio/barks, sound captions, tutorial prompts and input hints, menus, settings, pause, loading cards, level titles, upgrade cards, results, credits, page meta.

Rules applied: no em dashes (or spaced en dashes) anywhere in player text, sentences rewritten rather than hyphenated; short in-world wording; no redundant restating (for example the onboarding selector prompt said "RMB / Q · switch weapons · Cycle the selected rack"); one set of level titles (the spec titles) on both the level menu and the loading card; capitalised caption subjects. Ids, keys and test hooks are unchanged. Spec-locked facts (the L10 research recording) were left as written.

Guard: `tests/unit/data/player-text-dashes.test.ts` fails on any em dash or spaced en dash in a string literal under the player-text sources above, `index.html` and the web manifest (comments are ignored, numeric ranges like `20–35` are allowed).

## Changes per area

| Area | Strings changed |
| --- | --- |
| Credits | 4 |
| Dialogue | 21 |
| Objectives | 10 |
| Captions | 17 |
| Menus | 6 |
| Tutorial | 4 |
| Meta | 1 |

## Every change (old → new)

| Area | File:line | Old | New |
| --- | --- | --- | --- |
| Credits | src/ui/CampaignUI.ts:72 | 'Minor Incident — A community still alive. Built with Three.js and Rapier. Technology reference: Bruno Simon (MIT).' | Roll lines: 'Minor Incident' / madeBy.headline / author and role / AI models / Harnesses / Tools / 'Built with three.js and Rapier. Technology reference: Bruno Simon (MIT).' / madeBy.thanks |
| Credits | src/ui/CampaignUI.ts:88 | `${d.title} · Tier ${d.tier} — ${d.description}` | `${d.title} · Tier ${d.tier} · ${d.description}` |
| Credits | src/ui/GameUI.ts:128 | 'Minor Incident · Every third-party library, recording and technology reference, with its license.' | 'Who made Minor Incident, and every library, recording and reference it uses, with its license.' |
| Credits | src/ui/GameUI.ts:138 | title, ' — ', author | title, ' by ', author |
| Dialogue | src/data/dialogue.ts:5 | One cold-chain parcel at the depot, goes to the Medical Annex on Larch Street. Easy one. | One cold-chain parcel for the Medical Annex on Larch Street. Easy one. |
| Dialogue | src/data/dialogue.ts:6 | Sealed and signed. The Medical Annex is on Larch Street. Your cargo bike is at the rack out front — take it, it is quicker. | Sealed and signed. Your cargo bike is at the rack out front; it is quicker to the Annex. |
| Dialogue | src/data/dialogue.ts:8 | Get off the street — grab anything you can! | Get off the street and grab anything you can! |
| Dialogue | src/data/dialogue.ts:9 | 'The fire station at the west end of Elm Street — they’ve got a shutter door. Go!' | 'Get to the fire station at the west end of Elm Street. They’ve got a shutter door. Go!' |
| Dialogue | src/data/dialogue.ts:11 | Organized help still exists — for now. | Organized help still exists. For now. |
| Dialogue | src/data/dialogue.ts:12 | 'Grab some water. You’re safe here — for now.' | 'Grab some water and catch your breath. You’re safe in here.' |
| Dialogue | src/data/dialogue.ts:13 | 'Engine 3, trapped civilians at Grove Market, thirty-plus, building secured from inside — go!' | 'Engine 3, thirty-plus civilians trapped at Grove Market, barricaded inside. Roll out!' |
| Dialogue | src/data/dialogue.ts:15 | 'Engine 3, be advised — attacks reported spreading along Main Row. Make it fast.' | 'Engine 3, be advised: attacks are spreading along Main Row. Make it fast.' |
| Dialogue | src/data/dialogue.ts:16 | 'Doors coming open — get them out, get them out!' | 'Doors coming open! Get them out, get them out!' |
| Dialogue | src/data/dialogue.ts:17 | Anyone who can move — go! | Anyone who can move, go! |
| Dialogue | src/data/dialogue.ts:18 | 'Over here! Move, move — we’re closing the gate!' | 'Over here! Move, move, we’re closing the gate!' |
| Dialogue | src/data/dialogue.ts:25 | 'Contact! River path — both avenues — they’re coming from everywhere!' | 'Contact! River path and both avenues. They’re coming from everywhere!' |
| Dialogue | src/data/dialogue.ts:26 | 'We can’t hold this! Army checkpoint, up the avenues — you’re with us!' | 'We can’t hold this! Army checkpoint, up the avenues. You’re with us!' |
| Dialogue | src/data/dialogue.ts:30 | 'The police are gone. The army holds the line — for now.' | 'The police are gone. The army holds the line, for now.' |
| Dialogue | src/data/dialogue.ts:33 | 'Quartermaster! Take a machine gun. Plenty of ammunition. Short bursts — stay with the line.' | 'Over here, courier. Take a machine gun, plenty of ammunition. Short bursts, and stay with the line.' |
| Dialogue | src/data/dialogue.ts:36 | 'Man down! He is — he is turning — get back, get back!' | 'Man down! He’s… he’s turning! Get back, get back!' |
| Dialogue | src/data/dialogue.ts:41 | 'The tank is gone quiet — they are all over it!' | 'The tank has gone quiet. They are all over it!' |
| Dialogue | src/data/dialogue.ts:44 | 'Soldier down — fall back, fall back!' | 'Soldier down! Fall back, fall back!' |
| Dialogue | src/data/l5.ts:63 | 'Bless you, child. Please — take me with you.' | 'Bless you, child. Please, take me with you.' |
| Dialogue | src/data/l6.ts:20 | 'The injured cannot run. Stay with them — I will hold the rear.' | 'The injured cannot run. Stay with them; I will hold the rear.' |
| Dialogue | src/sim/missions/LevelTwoRescue.ts:39 | 'Chain’s going — stand clear!' | 'Chain’s going! Stand clear!' |
| Objectives | src/levels/L10/mission.ts:42 | 'Pack the cure and carry it to the dispersal complex' | 'Pack the cure canister' |
| Objectives | src/levels/L10/mission.ts:43 | 'Deliver the cure — leave the laboratory' | 'Get the cure out of the laboratory' |
| Objectives | src/levels/L10/mission.ts:44 | 'Carry the cure through the corridor — recover the rocket launcher' | 'Carry the cure down the corridor and grab the rocket launcher' |
| Objectives | src/levels/L10/mission.ts:45 | 'Deliver the backpack cure to the dispersal complex' | 'Bring the cure to the dispersal complex' |
| Objectives | src/levels/L10/mission.ts:47 | 'Charge the system nearby and kill the Mega Alpha' | 'Charge the dispersal system and kill the Mega Alpha' |
| Objectives | src/levels/L10/mission.ts:49 | 'Watch the cure spread — keep exploring' | 'Watch the cure spread' |
| Objectives | src/levels/L3/mission.ts:29 | 'Reach the rendezvous ring inside the army checkpoint' | 'Get inside the army checkpoint' |
| Objectives | src/levels/L6/mission.ts:13 | 'Walk around the shelter' | 'Look around the shelter' |
| Objectives | src/levels/missions.ts:62 | 'Go into the fire station' | 'Get inside the fire station' |
| Objectives | src/sim/missions/LevelTenFinale.ts:52 | `Return to dispersal console · Charge paused · ${progress}` | `Back to the dispersal console · Charge paused · ${progress}` |
| Captions | src/audio/AudioService.ts:442 | `[${text}${direction ? ` — ${direction}` : ''}]` | `[${text}${direction ? `, ${direction}` : ''}]` |
| Captions | src/audio/AudioService.ts:624 | 'Alpha charging — clear the marked path' : 'Alpha ground slam — leave the marked circle' | 'Alpha charging: clear the marked path' : 'Alpha ground slam: leave the marked circle' |
| Captions | src/audio/apcEngine.ts:10 | 'Armor dented — engine straining', 'Glass cracked — engine running rough', 'Engine smoking — lights failing', 'Barely functional — heavy smoke, engine sputtering' | 'Armor dented, engine straining', 'Glass cracked, engine running rough', 'Engine smoking, lights failing', 'Barely functional: heavy smoke, engine sputtering' |
| Captions | src/data/audioCues.ts:51 | 'Alpha preparing to throw a body or prop' | 'Alpha winding up a throw' |
| Captions | src/data/audioCues.ts:55 | 'Lion pounce — clear the marked path' | 'Lion pounce: clear the marked path' |
| Captions | src/data/audioCues.ts:55 | 'Gorilla beating its chest — infected converge here' | 'Gorilla beating its chest: infected converge here' |
| Captions | src/data/audioCues.ts:55 | 'Gorilla ground pound — leave the marked circle' | 'Gorilla ground pound: leave the marked circle' |
| Captions | src/data/audioCues.ts:55 | 'Elephant stampede — clear the marked path' | 'Elephant stampede: clear the marked path' |
| Captions | src/data/audioCues.ts:55 | 'Elephant trunk swipe — leave the marked arc' | 'Elephant trunk swipe: leave the marked arc' |
| Captions | src/data/audioCues.ts:55 | 'Zebra rear kick — leave the marked rear arc' | 'Zebra rear kick: leave the marked rear arc' |
| Captions | src/data/audioCues.ts:55 | 'Zebra herd stampede — clear the marked corridors' | 'Zebra herd stampede: clear the marked corridors' |
| Captions | src/data/audioCues.ts:55 | 'Flamingo flock dive — leave the marked circle' | 'Flamingo flock dive: leave the marked circle' |
| Captions | src/data/audioCues.ts:55 | 'Gorilla preparing to throw a body or prop' | 'Gorilla winding up a throw' |
| Captions | src/data/audioCues.ts:64 | { caption: `${name} approaching`, gain: 0.6 } | { caption: name === 'explosive' ? 'Explosive infected approaching' : 'Infected approaching', gain: 0.6 } |
| Captions | src/data/audioCues.ts:309 | 'Mega Alpha charging — clear the marked path' | 'Mega Alpha charging: clear the marked path' |
| Captions | src/data/audioCues.ts:310 | 'Mega Alpha slam — leave the marked circle' | 'Mega Alpha slam: leave the marked circle' |
| Captions | src/data/audioCues.ts:311 | 'Mega Alpha grabbing — escape its reach' | 'Mega Alpha grabbing: get out of its reach' |
| Menus | src/ui/CampaignUI.ts:85 | this.screen('Unlock reveal') | this.screen('Well done, courier') |
| Menus | src/ui/CampaignUI.ts:91 | 'Pick exactly two cards. Deselect one to change your choice.' | 'Two cards only. Deselect one to swap it.' |
| Menus | src/ui/GameUI.ts:14 | 'Stop the Outbreak', 'Get Them Out', 'Reach the Safe Zone', 'Open the Escape Route', 'Hold the Line', 'Get Out', 'Cross the Ruined City', 'Escape the Zoo', 'Make the Crossing', 'Deliver the Cure' | 'Special Delivery', 'The Failed Rescue', 'The Police Collapse', 'The Safe City Falls', 'Aftermath', 'The Subway', 'The Ruined City', 'The Zoo', 'The Crossing', 'The Cure' |
| Menus | src/ui/GameUI.ts:371 | debug info placeholders '—' (yaw, HP, FPS) | 'n/a' |
| Menus | src/ui/LevelTransition.ts:6 | 'Stop the Outbreak', 'The Failed Rescue' | 'Special Delivery', 'The Failed Rescue' |
| Menus | src/ui/MissionUI.ts:84 | false result value '—' | '✗' |
| Tutorial | src/ui/Onboarding.ts:11 | evade: 'Keep moving to evade infected' | evade: 'Infected nearby. Keep moving' |
| Tutorial | src/ui/Onboarding.ts:11 | selector: 'Cycle the selected rack' | selector: 'Switch to your next weapon' |
| Tutorial | src/ui/Onboarding.ts:11 | 'second-side': 'Try another carried action' | 'second-side': 'Try your other weapon' |
| Tutorial | src/ui/Onboarding.ts:47 | lesson === 'selector' ? 'RMB / Q · switch weapons' | lesson === 'selector' ? 'RMB / Q' |
| Meta | index.html:6 | <title>Minor Incident</title> | <title>Minor Incident</title>     <meta name="description" content="One parcel, one bad morning, one corgi. Ride, fight and rescue your way through a zombie outbreak in this isometric browser game."> |

## Left as is (reviewed)

- L10 research recording (`megaPresentation.ts`): its facts are asserted by E32-AC15 and `mega-presentation.test.ts`.
- Mission retry text shows the raw checkpoint id ("Retry from cure-research."): changing it needs a lookup table (logic), out of scope for a text-only lane.
- Controls guide and input hints: dense but they are a reference card, not prose; key names already consistent (LMB/RMB/MMB, WASD, F / E, Q).
- Credits licence rows and THIRD_PARTY_NOTICES.md: generated, unchanged (the notices file is a repository document, not in-game text).
## Visual check (Scene Lab, 960x540, high/low, zoom 0.5/1/1.5, WebGL2 and WebGPU)

- `ui-menu-credits` (new, in `scene:matrix`): Made by headline, Fabian Wesner linked with his role, Anthropic models, OpenAI models, harnesses and tools sit above "Code libraries and technology"; the Back button stays clear.
- `qa-l10-title-credits`: five-second "Minor Incident / The outbreak is over." title, then the centred roll (title, headline, role, models by maker, harnesses, tools, three.js/Rapier/Bruno Simon, thank-you) fades in above "Skip / Main menu" with no overlap after the compaction fix.
- `l10-e2-terminal` (now in `scene:matrix`): HUD objective "Play the research recording", then the research subtitle panel and the new objective "Pack the cure canister · 6 m" in the tracker.
