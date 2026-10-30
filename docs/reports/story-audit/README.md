# Story audit (PO 10-30): is the story complete and logical from the player's view?

PO (verbatim): "check if the story is complete and logical (so everything makes sense from the user's perspective)".

Method: I read every player-visible line (src/data/dialogue.ts, mission step texts in src/levels/*/mission.ts, HUD overrides in
src/sim/missions/objectiveText.ts and the level controllers, the loading card src/ui/LevelTransition.ts, the result card
src/ui/MissionUI.ts, the ending src/ui/CampaignUI.ts) against specs/00-game-concept.md §9–11, po-levels-4-9-2026-10-11.md and
po-levels-9-10-2026-10-13.md. Then I played the level starts with a DOM probe (`tools/playtest/story-cards.ts`: loads each level
through the QA hook, reads the loading card, the briefing panel, the tracker and the subtitles, presses Begin). The probe showed
that **L7 and L10 start without a briefing panel** (auto-begin) and that L8's tracker contradicts its briefing; the rest was clear
from the text. Captures (5) in the lane scratchpad `story/`: L6-card, L7-start, L8-start, L9-card, L10-start.

## Verdict

The arc holds: you deliver the parcel that sets it off (L1), organized help fails step by step (L2 firefighters, L3 police,
L4 army in the "safe" city), you protect people instead of fighting (L5–L6), power fantasy and the zoo's false safety (L7–L8), the
crossing, then the cure (L10). L1–L5 hand over cleanly on screen (each loading card and briefing says where you are and why).
The weak spots were all in L6–L10: the cure was never set up before you stood in the lab, the L9 destination was "the next city"
with no reason to go, L6's card showed an old helicopter line, and the named survivors drop out of the story at the L9 crash
without a word.

## Findings

| # | P | On-screen text (before) | Where | Fix | Status |
|---|---|---|---|---|---|
| 1 | P1 | L6 loading card: "Extraction chopper at the substation helipad at dawn." (superseded design; L6 is the subway, no chopper ever comes) | src/data/dialogue.ts:71 (old line), shown by src/ui/LevelTransition.ts:35 | Card uses the real shelter briefing (now in dialogue, L6 mission reads it) | **done** f526eb7d0 |
| 2 | P1 | L7–L10 loading card: "Loading neighborhood" / "Getting the neighborhood ready."; L7 and L10 have no briefing panel either, so nothing explains why Fairhaven is worse, how you got to a zoo, where you drive in L9 or why | src/ui/LevelTransition.ts:6,34-35 | Titles L7–L10 + set-up lines `L7.briefing`…`L10.briefing` (dialogue.ts:72-75): L7 "Night. While you were underground, Fairhaven was overrun. A wrecked army truck by the exit still holds a rocket launcher. …", L8 "The evacuation bus reaches the zoo, now an army safe zone …", L9 "… The armored vehicle's radio loops one army broadcast: the research campus past the next city has a cure. …", L10 "The crash took the vehicle, the others and every weapon but the axe. Find the research campus and the cure. Something huge is on your trail …" | **done** f526eb7d0 |
| 3 | P1 | The cure is never set up: L9 briefing "Cross the countryside toward the next city."; L10's first objective after the axe is "Recover the handgun at the checkpoint", then "Reach the research campus"; the cure is first named by "Play the research recording" mid-L10 | src/levels/L9/mission.ts, src/levels/L10/mission.ts:39-43 | L9 briefing/card names the broadcast and the cure (#2); L10 opening subtitle "The crash took everything but the axe. Find the research campus and the cure." | **done** f526eb7d0, e68581cc7 |
| 4 | P1 | Survivors vanish at the L9 crash: Dale, Rosa, Mr. Okafor, Mia, Sam and the shelter people ride the APC out of L8 (tracker format "… · N/M aboard · Dale, Rosa missing"), then L9 "The bridge gave way. Crawl clear of the wreck." and L10 opens with only the courier and the corgi; old L10 line "The crash took our weapons. The axe is all we have." | src/sim/missions/LevelNineCrash.ts:109, src/sim/missions/Mission.ts:83 | Text now acknowledges it ("the others … gone", #2/#3). The real fix needs a PO decision: see proposal A | partly done; **proposal A** |
| 5 | P2 | L8 briefing "The zoo is secure. Take a breath. Explore the sanctuary." then the tracker at once: "Bring the survivors to the armored vehicle and board · 97 m" (PO: "There is deliberately no immediate objective") | src/levels/L8/mission.ts:10, objectiveText.ts | Before the breach: "Explore the sanctuary · the armored vehicle waits by the exit" (marker unchanged) | **done** f136a5647 |
| 6 | P2 | L8, boarded before the breach: "Wait for the breach · 42 s" (announces the surprise inside a "secure" zoo) | src/sim/missions/objectiveText.ts:52 | "Waiting for departure · 42 s" | **done** d5019ac67 |
| 7 | P2 | L6 result card: "Night. Still alive." / "Campaign summary · 6 levels · Time … · Rescued …" then Continue to L7 (six-level leftover; "Rescued" sums the same people across levels) | src/ui/MissionUI.ts:93 | "The group is out of the tunnels. Above, Fairhaven burns." when L7 follows | **done** b89351db9 |
| 8 | P2 | L5 Sam: "Thank God. I lost my rifle days ago." (the campaign is one day; Rosa says "I have not seen anyone in hours") | src/data/dialogue.ts:70, src/data/l5.ts:68 | "… I lost my rifle in the fighting. …" | **done** e0c0a47c2 |
| 9 | P2 | The ending never links back to L1 (PO arc: "Level 1: you accidentally help start the outbreak. Level 10: you end it."): title card "Minor Incident" / "The outbreak is over." | src/ui/CampaignUI.ts:55 | "It began with one delivery. Now the outbreak is over." | **done** ac2a8146e |
| 10 | P2 | Epilogue survivors are anonymous residents; no named survivor and no reunion. Only the corgi is there ("Corgi · following") | src/sim/missions/LevelTenEpilogue.ts:63-69 | proposal A | **proposal** |
| 11 | P2 | The Mega Alpha is never introduced: it appears as a HUD ring "Mega Alpha: distant" and later the objective "Kill the Mega Alpha" | src/data/megaPresentation.ts:5-7, src/levels/L10/mission.ts:50 | L10 card: "Something huge is on your trail: you will hear it long before you see it." First-roar subtitle: proposal C | partly done; **proposal C** |
| 12 | P3 | The corgi is with you from L1 to L10 (HUD "Corgi · following") but no line says whose dog it is | src/data/dialogue.ts:5 | L1 briefing: "… Easy one, and your corgi can ride along as always." | **done** cddf941a4 |
| 13 | P3 | L3 at the army checkpoint: "Checkpoint reached · Waiting for the rescued group · Officer 1: 12 m away" (they are your police squad, not a rescued group) | src/sim/missions/LevelThreeCollapse.ts:739,741 | "Waiting for your squad" | **done** 9919139d2 |
| 14 | P3 | L4 fall-back radio: "Kessler's cellar is at the far end of Harbor Street." (Kessler is never introduced; the shop sign is Kessler's Hardware; PO: "the basement of a hardware store") | src/data/dialogue.ts:50 | "The cellar under Kessler's Hardware, far end of Harbor Street! …" | **done** 2213ea9f0 |
| 15 | P3 | L6 briefing: "Marcus watches the sealed stair." (first and only mention before he leads the retreat) | src/data/dialogue.ts:71 | "Marcus, who runs the shelter, watches the sealed stair." | **done** f526eb7d0 |
| 16 | P3 | L6 first objective: "Look around the shelter · 0:34 remaining" counts down to an unannounced breach (spoils the calm, unclear what "remaining" means) | src/sim/missions/objectiveText.ts:29 | Drop the clock in the calm phase, or "Look around the shelter · rest while you can" | **proposal** (L6 timing text is relied on by bots/playtest; left for the L6 owner) |
| 17 | P3 | L4 objective "Run to the cellar via Lakeshore, Metro Road and Harbor Street" is long but clear with the route pin; L3 "Buses to Fairhaven" matches the L4 bus ride; L2 "Fire Station 3, a few hours later." matches L1 late morning → L2 midday | — | none | ok |
| 18 | P3 | Unused lines that contradict current design (never shown): `L2.axe`, `L4.quartermaster` ("plenty of ammunition" while there is no ammo system; `L4.gun` says the same and is shown), `L4.turn`, `L4.air`, `L4.alone`, `L5.lookout`, `L3.twist` (`L6.twist` "You survived the first day." removed in f526eb7d0) | src/data/dialogue.ts | delete in a cleanup; "Plenty of ammunition" in `L4.gun` reads as flavor, keep | open |

Consistency checks that passed: survivor names and the count of five are the same in the L5 cues, the found lines, the L7
"Waiting for Dale" and L8 "… missing" trackers; the corgi is present and safe in every level incl. L10; time of day runs late
morning (L1) → midday → late afternoon → false-safety afternoon (L4) → "Hours later" sunset (L5) → underground → night (L6–L10)
without a jump; weapons appear where a line or prop explains them (bat bench, axe rack, armory table, quartermaster, rocket truck,
L10 checkpoints after "The crash took everything but the axe").

## Proposals (not text-only)

- **A (P1, PO decision): the survivors after the L9 crash.** Today they disappear inside the wrecked APC. Options: (1) they are
  thrown clear and are among the epilogue survivors ("survivors emerging from hiding", PO) — spawn the L8 escaped roster at
  `epilogue-survivors` by name, each with one line (Dale: "You did it." …); (2) a short L9 crawl beat where the courier sees them
  carried off by soldiers on the far bank; (3) state plainly that they died. (1) pays off L5–L8 and is cheap: the roster is already
  in the campaign save (`results.L8.escapedSurvivors`).
- **B (P2): briefing panel for L7 and L10.** Both auto-begin, so the new set-up line is only on the loading card, which can be on
  screen for under a second on a fast machine. Show the same line as a 5 s subtitle at start (L7) or keep it as the opening
  subtitle (L10 already has one).
- **C (P2): introduce the Mega Alpha by sound and one line** on its first audible roar in L10, e.g. "That roar again. Whatever it
  is, it is following you." (needs a hook on the first `mega` cue).
- **D (P3): L1 cause.** The parcel → blast → outbreak link is implied ("Delivery complete. Outbreak: not contained."). A line from
  the technician at the hand-over ("Cold-chain? That's the sample they've been waiting for.") would make "you caused this"
  explicit. Needs a voice-free subtitle beat in L1Story.
