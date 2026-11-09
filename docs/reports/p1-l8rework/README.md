# L8 arena route and elephant finale

Verified application revision: `8f11eaee` (implementation through `13115ccc`, with main merged through `d79e1594`). Both requested integrations, `p1-l8apes` and `p1-danger`, are included. Source content hash: `a0c5ff7f57fe38ebd13e9787131069cdedda449176511dd88a1510b72d07883c`. [Static bundle receipt](browser-build.json) records the 46 JavaScript asset hashes; both primary browser tiers used that unchanged build.

## Implemented

- Each remaining enclosure boss holds the keeper route to the APC. Encounter gates, objective text and minimap identify the unbeaten arena; clearing all five opens the yard. The elephant still holds the driver/departure gate.
- Shotgun, MG, hunting rifle and rockets damage and visibly react against every boss. Bosses move, attack, recover or flinch through their cycles. Zebra staging/blocked movement and monkey roof waiting have bounded exits. Rocket firing uses ordinary campaign ammunition rules, without arena rocket stock.
- The same elephant physically breaches the protected north wall, charges Hale at the actual APC door, and plays the keys/death beat. Permanent elephant death triggers the courier's “I'm sorry.” Nadia's elephant line depends on her being alive. Retry restores intact/broken wall state correctly.
- The driver unlocks after the fights, Hale's death and seating of the complete living group. Existing rifle guards cover the party. Boarding reserves a centre passage and uses bounded, physically swept paths around solid animal corpses and displaced props. Ordinary infected retain the merged PROD health/damage rules.
- L8 contains no Mega. L9 has three distant sightings before the bridge, followed by its bridge/crash/crawl sequence. Closed cab occupants are protected from direct boarder bites; exposed hatch occupants remain vulnerable.

## Native checks

| Check | Result | Evidence |
|---|---|---|
| Mortal L8 low, seed 1 | Complete, 1031.23 s; 0 deaths; 9/12 carried alive; 0 collision failures | [low](native-low.json) |
| Mortal L8 high, seed 1 | Complete, 1009.28 s; 1 death; 10/12 carried alive; 0 collision failures | [high](native-high.json) |
| Engaged inactivity | Maximum 26 ticks low / 41 high; limit 120 | Same receipts, `activity` |
| North wall / Hale charge | Real wall collapse; Hale within 1.64 m of door; elephant charging within 6 m | Same receipts, `finale` |
| Runner route locks | Each of five remaining enclosures independently blocks yard entry; clearing them opens it; elephant blocks driver | [route gates](route-gates.json) |
| Four requested guns × six bosses | All 24 combinations: repeated actual discharges, positive damage and reaction | [43 passing controls](controls/low-controls.json) |
| Tactics / lifecycle / retry | All 43 controls pass, including three independent real sidestepped wall impacts, gorilla payload/landing, and intact/broken wall restore | Same controls |
| Healthy habitats | Both tiers pass: 22 healthy enclosed animals, active primates, real same-ID bite/conversion | [low](habitats/native-low.json), [high](habitats/native-high.json) |
| Boarding movement regressions | 14/14 aboard: clear column at tick 1592, corgi/corpse at 2161, Reyes/prop pocket at 1607; 0 collision failures | [column](boarding-column.json), [corpse](boarding-corpse.json), [contact](boarding-contact.json) |
| Mortal L9 | Complete, 227.58 s; 0 deaths; 0 collision failures; all three sightings and bridge/crash/crawl beats | [L9](native-l9.json) |
| Repository gate | Typecheck, lint and all 107 unit tests pass; existing test inventory retained | [verify E30](checks/verify-E30.log), [receipt](checks/verify-E30.json) |

The full native routes are mortal and use ordinary input. Controlled capability/route/boarding fixtures protect the courier and stage their setup; they are separate from combat completion evidence. The hunting rifle is added only in the controlled weapon matrix because the default six-weapon campaign loadout carries handgun, shotgun, MG and launcher alongside its two melee weapons.

## Physical browser play

One pooled headless GPU browser context at a time, WebGL2 with Metal requested, 1280×720. Physical WASD, Digit shortcuts, mouse aiming/held fire and E drive the game. The simulation is paused and fixed-stepped between physical input intervals; the policy reads state and proposes input. There are no health, position, objective or inventory edits. The elephant policy repositions into the open east yard between tells. This establishes input/combat/route behavior; it does not measure real-time frame pacing or WebGPU.

| Tier | Completion | Courier deaths | Carried civilians alive | Final seated group |
|---|---|---|---|---|
| Low | 668.72 s, all six arenas, departed | 0 | 0/12 | 2 |
| High | 713.78 s, all six arenas, departed | 2 | 12/12 | 14 |

**Remaining finding:** low's repeated weapon-rotation run lost all twelve carried civilians and evacuated only the corgi and Reyes. Escort pressure is severe under that physical-input policy. The native skilled routes retained 75% / 83%, and high's physical run retained all twelve. The low browser receipt is route/weapon evidence with those losses explicitly recorded.

The additional [low story replay](story-low/receipt.json) also completed (655.12 s, zero courier deaths, seven total passengers). It releases physical inputs during cinematics; its [Hale midpoint](story-low/hale-mid-tick-33490.jpg) is included in the elephant sheet.

Primary capture code is retained at `8f11eaee`; the story replay code at `bfa70858` releases held inputs during the cinematic. Each receipt records its capture-tool SHA-256.

Both primary tiers have zero browser errors. All four carried guns discharged at least twice with positive damage against every arena; no weapon stopped firing. [Summary and complete per-weapon ledger](browser-summary.json), [low receipt](browser-low/receipt.json), [high receipt](browser-high/receipt.json). Rifle coverage is the native matrix described above.

## Per-arena visual review

“Cannot skip” below refers to the independent physical runner controls; both browser routes fought and cleared every arena. Hit reaction and health loss are supported by the visible bars plus the discharge/damage event ledger.

| Arena | Route / combat review | What looked or felt wrong | Contact sheet |
|---|---|---|---|
| Flamingos | Cannot skip; the flock reacts and loses health. Lane dives and faster second phase occur; sweep fire clears birds. | Escort/infected crowds and muzzle flashes obscure the small birds, especially at engagement. | [flamingos](contact-sheets/flamingo.jpg) |
| Zebras | Cannot skip; repeated guns damage the herd. Telegraph lanes are visible and the herd changes sides. | Crowd overlap hides individual stragglers; a lane can occupy much of the view. | [zebras](contact-sheets/zebra.jpg) |
| Monkeys | Cannot skip; guns damage the pack, melee releases grabs, leader phase occurs. | Roof/doorway geometry and crowds make the small targets difficult to distinguish at entry. | [monkeys](contact-sheets/monkey.jpg) |
| Lions | Cannot skip; both phases lose health. Pounce markings and recovery windows are visible. | Stalking/flanking animals regularly reach the screen edge or foliage; locating the next shot takes time. | [lions](contact-sheets/lion.jpg) |
| Gorilla | Cannot skip; health falls and hits interrupt/expose it. Roar/pound rings and throw phases occur. | Some first-phase camera positions crop the gorilla near the top edge; sustained MG flashes obscure its reaction. | [gorilla](contact-sheets/gorilla.jpg) |
| Elephant | Cannot skip; charge, damage, Hale keys/death, permanent kill and courier line occur before departure. | The north gate is a poor fighting corner. First cinematic frames are still blending; continued fire/movement can skip the shot after 30 ticks. The replay releases those physical inputs for the handover. | [elephant](contact-sheets/elephant.jpg) |

Earlier failed browser runs exposed the blocked boarding column, corgi/corpse approach and Reyes/prop pocket. Those failures were archived outside the final evidence folders; the final primary receipts are complete. No specifications were changed. No push or deployment was performed.
