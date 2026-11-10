# r25-l8cues: L8 sanctuary/escape cues, boss damage check, playtest rocket fallback

Branch `lane/r25-l8cues`. Coding lane, no browsers.

## Changes
1. **Sanctuary wait cue** (`src/sim/missions/objectiveText.ts`, `src/ui/Hud.ts`, `src/ui/MissionUI.ts`): once the courier is inside the plaza ring and the breach has not fired, the objective reads "Rest at the plaza with the group" and the "· 0 m" suffix is dropped (`l8SanctuaryResting`). Beat 1 timing (breach at +60 s) and the script lines are untouched; no new story text.
2. **Protect the group marker** (`src/sim/missions/LevelEightZoo.ts`): during the 30 s `protecting()` window the objective marker is `central-plaza` (where the group stands) instead of null, from the first tick of the escape step. After that the existing arena/exit marker logic applies.
3. **Damage claims - no immunity found.** New sim tests (`tests/engine/l8-boss-damage.test.ts`, `l8-boss-states.test.ts`, helper `tests/helpers/l8BossShoot.ts`) fire the real weapon pipeline (pistol, shotgun, assault rifle, army MG, rocket) at 2 m and 8 m at flamingo, zebra, monkey (pack and leader), lion, lioness, gorilla, elephant and an ordinary infected; all take damage. The rocket inside 5 m refuses ("Too close!", `combat.empty`, no projectile, no damage) as designed. A second test holds each boss inside its attack/phase states (flamingo dive, zebra kick, monkey grab/debris, lion roar, gorilla pound/roar, elephant charge/swipe, phase 1/2, roof) and still gets damage.
   - Likely explanation for "no damage in 8 s": Damage.ts scales every arena boss to 0.6x unless it is in an exposed window (1.8x), and knockback/stagger are zeroed for arena bosses, so a hit shows little reaction. Other candidates: fire blocked by cover or other bodies (the harness needed per-bearing retries and had to move the flock/crowd away because bullets hit the nearest body), and bot aim. No change to bosses (not weakened, not buffed).
   - Mega (L10, 3000 HP) untouched.
   - L3 "frozen infected at 6.2 m": not investigated (not cheap).
4. **Playtest bot** (`tools/playtest/combat.ts`, `session.ts`): `campaignCombatWeapon` takes the nearest living drawn enemy distance and skips the rocket launcher while one is within 6 m (min range 5 m + 1 m margin), so the bot falls back to the army MG/shotgun instead of holding "Too Close!".

## Checks
tsc, eslint on touched files, the three boss tests and `tests/engine/l8-cues.test.ts` on the runner, `npm run test:gate` on the runner (result in the commit message / final report).

## Browser QA needed
- L8, fresh and progressed save, from reaching the plaza ring until the breach, high and low, zoom 1 and 1.5: tracker reads "Follow Nadia to the central plaza · N m" while walking and "Rest at the plaza with the group" (no distance) once inside the ring, until the breach.
- L8 at the breach (about 60 s after start), same settings: tracker "Protect the group!" with a visible ring/marker on the plaza from the first frame for the full ~30 s; then the arena marker appears.
- L8 arenas: pistol/rifle hits on flamingo (in dive), monkey leader, lion/lioness, gorilla, elephant show a health-bar drop and a visible hit reaction (0.6x damage and zeroed stagger may still read as "no reaction"; a feel call for the PO).
- Playtest bot in L7/L8/L10: the rocket "Too Close!" hold no longer lasts minutes.
