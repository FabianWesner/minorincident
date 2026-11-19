# s178 · Campaign difficulty: Simple (status quo) and Hard

PO 2026-11-19 (verbatim): "For the full game: add difficulity levels: Simple (status quo) Hard - with only two changes:
* friendly fire hurts them and me
* auto-healing is off
* no other changes to amount of Zombies, strength of weapons, etc."

Difficulty lives on the campaign (`CampaignSave.difficulty?: 'simple' | 'hard'`, absent = `simple`, so every
pre-s178 save and replay stays Simple). It is chosen in the main menu when a new campaign is started, shown and
changeable in the settings screen (reachable from the title and the pause menu), persisted with the campaign save,
recorded in telemetry (`level_start`) and in the replay metadata (the campaign snapshot it already carries), and
kept by level select (`debugCampaign` copies it), checkpoint restores (world-level state, never rebuilt) and
restarts (the level-start campaign snapshot). `applyCampaign` copies it onto `SimWorld.difficulty` at every level
boundary; `SimWorld.reset()` restores the `'simple'` default.

## The two Hard rules (nothing else changes)

1. **Auto-healing off** — `Player.prePhysics` regeneration (`survivor.regenDelayTicks` / `regenPerSecond`) is
   gated on the difficulty. Medkits (`Pickups`), checkpoint restores and scripted heals (`Player.restoreVitals`)
   never pass through that gate and still heal in Hard. No other human in the sim regenerates (verified by
   search: the only regen paths are the courier and the infected MegaAlpha pursuit), so this is the whole rule.
2. **Friendly fire both ways** —
   - *Player weapons → humans:* in Hard the melee arc, the gun ray and the roundhouse sweep also target living
     humans (`HitQuery` melee/ray filters + `Combat.sweep`): civilians, allied fighters (soldiers, officers,
     firefighters, armed civilians/survivors) and escorts, with their normal weapon damage. The in-place swing's
     harmless "Hey!" annoy on civilians becomes real damage. The corgi (`companion`), owner pets and zoo animals
     are never targets (campaign rule "corgi safe"), and vehicle impacts stay excluded (all `type: 'vehicle'`
     paths are untouched).
   - *Allied fire → humans:* the damage seam (`Damage.apply`) lets a friendly source (the courier, player-attributed
     hazards/chains, `civilian.ally` fighters, the allied L4 tank/helicopter set pieces) damage living humans in
     Hard. In Simple, friendly-capable bullets never damage the courier (explicit guard; no such hit can occur
     anyway) and the civilian flinch-only guard stays, so allied fire deals nothing — byte-identical.
   - *The courier's own explosives/fire:* in Hard her own blasts deal their **normal** damage to her (the E11
     30 % self-damage reduction is Hard-disabled for own-weapon hits). Her flamethrower/molotov fire patches and
     district fires already damage everyone, both difficulties, unchanged.
   - *Hold behaviour kept:* allied guns still hold fire while a living human is in the firing segment
     (`HitQuery.alliedShotClear`, both call sites in `Allies.ts`) and still aim only at infected; only hits that do
     occur (explosions, the seam above) now deal damage in Hard.

## Simple is byte-identical

Every gate checks `world.difficulty === 'hard'` and the default is `'simple'`: zombie counts, weapon damage,
stats, caps and encounters are shared data (no tuning anywhere). Evidence below: the full unit suite, the remote
suite and `qa:threat` (all Simple runs) are green with the pre-s178 expectations intact — the existing
`self 30 %`/`escort 100 %` combat test passes unchanged.

## One spec deviation (flagged)

The orchestrator test list asked for "own explosive→player … **none in simple**". The pre-s178 sim already deals
30 % self-damage from the courier's own explosives (E11 "environmental blasts retain 30 % player damage", pinned
by the existing E05 combat test). Since rule 4 requires Simple to stay byte-identical, Simple keeps the 30 %
self-damage and **Hard** is where the own-explosive hit becomes full normal damage (`hard 0.125 HP left vs simple
70` in the merged combat test, the same feet-offset falloff). Old saves/replays without the field are Simple.

## Story-critical NPCs — every case, same handling as a zombie kill

`Damage.apply` runs the shared `storyProtected` gate before any friendly-fire rule, so while their beat is active
these actors are exactly as killable (not at all) by friendly fire as by zombies, and after their beat they die
normally (corpses persist, never removed):

- L1: the depot clerk, the tech (until the parcel is delivered), the firestation firefighter (while that objective is active).
- L2: the fire-truck crew and the trapped people until the doors open.
- L3: waiting officers; the squad leader until the fallback call.
- L4: the quartermaster until the machine gun is taken.
- L5: the lookout until the shutter; the station survivors; hidden or just-found survivors during the rescue grace.
- L6: survivors already out; the first survivor until the gate; the medic (Rosa) before breach one.
- L8: Private Reyes; Major Hale until "hale-fallen"; the dormant elephant until his finale.
- L9: the driving crew (`protectsCrew`).
- L10: every `hangar-*` actor.
- Escorts (L2-style hero followers) have no story gate: health 0 → downed → 20 s → `mission.failed`
  (`escort-died`) — identical for zombie kills and Hard friendly fire.

Two authored exceptions retained in Hard (both pre-existing, both listed for review):

- **L7 rocket route rule:** the courier's rocket-launcher splash never damages the `following` column
  (`Damage.apply`, `weapon.rocket-launcher` + L7 roster). The launcher is unlimited in L7 and this authored rule
  opens the route for the column; zombies *can* kill those followers (the roster marks them `dead`) and every
  other Hard friendly-fire path applies to them normally.
- **Cure release (L10):** once `cure-released` is set the courier and the corgi are immune to everything, Hard
  included.

## Evidence (all green, run 2026-11-19)

- `npm run typecheck` (tsc + `tsconfig.sim.json`) — clean.
- `npm run lint` — clean.
- `npm run test:unit` (local) — **150/150 cases, 45/45 files** (the budget cap, merged instead of added:
  the checks live inside the existing health/melee/explosives/save/codec tests), 27 files, 106 tests, 100.5 s.
- `sh tools/remote/run.sh $PWD -- npm test` — 27 files, 105 passed + 1 platform skip, 202.4 s, exit 0.
- `npm run qa:threat` — **0 fail flags**, L1–L10 skilled + passive, 386.6 s.
- `npm run test:smoke` — QA build and public build browser runs green, 141.8 s.
- Live headless UI check (throwaway Playwright spec, deleted after the run, E2E_PORT 5097): character-screen
  picker → Hard campaign → save persists → settings row shows and switches it → reload round-trip. Passed.

`character-difficulty.png` (local, like all report PNGs it is gitignored) shows the character screen with the
new Difficulty row; `settings-difficulty.png` (same run, also local) shows the settings row on `hard`.

## Browser QA needed

These are the human-check items the automated suites cannot judge:

1. **Menu option** — new campaign: the character screen shows the "Difficulty" picker (Simple/Hard) with the note
   "Hard: auto-healing is off and friendly fire hurts them and you…" (see `character-difficulty.png`). Confirm the
   picker reads well on a phone layout (the row stacks under the two survivor buttons).
2. **HUD/pause display** — pause (P/Esc) → Settings: the "Difficulty" row shows the campaign's current value and
   switching it there takes effect immediately in the live level (no auto-heal after the switch in a Hard run).
   Confirm the row fits the two-column settings grid at large text size.
3. **Hard run of L1** — start a Hard campaign, play to the outbreak: no health regeneration after the 4 s delay
   (health only comes back from medkits/checkpoints), the bat/gun can hit fleeing civilians and the corgi is
   never hurt by swings, shots or the player's own grenade.
4. **Hard run of L3** — the police line and the army checkpoint where allies fire: allied guns still hold fire
   while the courier or a civilian is in their line, allied bullets never damage the courier in practice, but the
   tank shell / fuel-truck blast and the courier's own weapons deal full damage to nearby humans; soldiers
   killed by friendly fire stay as corpses and the police line plays unchanged (zombie counts identical).
