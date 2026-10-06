# E19 · Level 1: Stop the Outbreak

## Goal
The vertical slice and tutorial level. A normal suburb (W0) turns strange. The player starts **unarmed**, learns to move and evade, finds an improvised melee weapon, learns combat, reaches the source, and completes the objective. Then the twist: **"Mission successful. Outbreak not contained."**

## Depends on / Enables
E04–E08, E10–E12, E14, E15 (basic) / E20, M1 exit.

## Level design

| Segment | District / tier | Beats | Teaches | Target time |
| --- | --- | --- | --- | --- |
| 1. Morning | D-RES cul-de-sac, W0, late morning | Wake-up walk with the corgi; neighbors, traffic, mailbox. An objective "Go to Joe's Diner for breakfast" teaches movement and the scheme prompt. | move | 0:45 |
| 2. First incident | D-MAIN diner lot, W0→W1 | The delivery driver collapses and attacks a customer; screams; 3 runners appear and chase. Objective: "Get away! Reach the hardware store." Civilians flee and traffic swerves. | evasion, line of sight, doors | 1:30 |
| 3. Armed | D-MAIN hardware store | Inside, stand-to-interact on a display: pick **bat, crowbar, or machete** (the first choice of the permanent unlock is previewed here). Learning fight with 4 runners + 1 crawler in the store. | interact, pick up, LEFT action, aim | 1:30 |
| 4. The trail | D-MAIN street → D-SHOP edge | Follow the trail of incidents (objective markers at 3 incident spots; radio: "reports of violent attacks near Sunset Pharmacy"). Mixed fights. The RIGHT side is unlocked here with **kick** (a knockback tool), so L1 plays as LEFT = the found weapon, RIGHT = kick (rack size 1/1). | RIGHT action, side switching, knockback | 2:00 |
| 5. Source | Pharmacy / clinic interior | Patient Zero (an infected courier, mini-boss: 600 HP, lunge + grab, telegraphed) next to the open **medical cooler**. Defeat it, then stand-to-interact 3 s to **seal the cooler room**. | telegraph reading | 1:30 |
| 6. Twist | Cutscene | Camera pulls back: 3 infected break out through the back door into different streets; a car crashes; sirens start. Caption: "Mission successful. Outbreak not contained." | — | 0:20 |

Target total for a new human player: **7 ± 2 min**. Checkpoints come at the start of segments 3, 4, and 5. Concurrent infected ≤ 15.

**End of level:** a permanent weapon choice (bat / crowbar / machete; the other two stay findable later), then the result screen.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): street life W0
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): kickable cones
- [`View.js`](../folio-2025/sources/Game/View.js): twist cinematic

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E19-AC01 | The mission graph is structurally completable (E12-AC07 walk) | sim |
| E19-AC02 | The `complete` bot finishes L1 on **20/20 seeds** in the headless sim-runner without cheats | sim |
| E19-AC03 | The `newbie` bot (handicapped profile, see `90-test-concept.md` §5) finishes on ≥ 18/20 seeds, with median sim time **5–10 min** and median deaths ≤ 2 | sim |
| E19-AC04 | The player starts with an **empty loadout**; no `combat.hit` caused by the player is possible before the weapon pickup (any attack input is a no-op with a "You have nothing to fight with!" hint) | sim |
| E19-AC05 | Segment 2 is survivable by evasion alone: the `evade-only` bot (never attacks) reaches the hardware store on ≥ 18/20 seeds | sim |
| E19-AC06 | World tier changes W0 → W1 at the incident trigger (decay layer events logged), and traffic transitions to panic driving | sim |
| E19-AC07 | Patient Zero telegraphs every damaging attack ≥ 0.5 s ahead; its fight lasts 30–120 s for the `complete` bot | sim |
| E19-AC08 | The twist cutscene plays, shows the caption text exactly, is skippable, and ends in the weapon-choice screen | e2e |
| E19-AC09 | The onboarding prompts for move, interact, attack (LEFT), and attack (RIGHT) each appear exactly once in a fresh save | e2e |
| E19-AC10 | Full-browser playthrough: the `complete` bot running in Playwright (WebGL, time scale 4) completes L1 with no console errors and saves screenshots at all 8 L1 photo spots | e2e |
| E19-AC11 | Vision review of the L1 photo spots: `l1-morning` (W0 calm reads as normal suburb vs S05), `l1-incident`, `l1-store-fight`, `l1-patient-zero`, `l1-twist` pass checklists §7.1/§7.4 | vision |
| E19-AC12 | Performance within the high-tier budget at the `l1-incident` and `l1-store-fight` spots (E18 counters) | perf |
| E19-AC13 | Physics props tutorial: segment 4 prompts a **kick a cone into a runner** moment (prop pre-placed next to a scripted runner); the `complete` bot logs ≥ 1 `combat.hit` with cause `prop`; the hardware store's back door has a barricade slot that can be braced with the nearby cart and shelf (sim) | sim |
| E19-AC14 | Carried over from E08-AC11: in L1 `complete` campaign-bot runs, average concurrent ambient civilians over the first 3 minutes stays within ±10% of the L1 target (60 high tier; low tier ×0.6), measured at both tiers. | sim |
| E19-AC15 | Carried over from E08-AC17: across full L1 `complete` campaign-bot runs, the corgi never enters an infection state and has no infection event; retain the event log for continuous-campaign verification in E24. | sim |
