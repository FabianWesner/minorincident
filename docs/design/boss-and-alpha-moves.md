# Boss fights and Alpha move sets

Author: the orchestrator (PO 2026-11-08: "make sure the boss fights are clearly defined" and "About regular Alphas in
earlier levels, also give them more special moves than the one they have now. Also different alpha types can have
different moves, incl throwing stuff they find on the way (like corpses, anything movable from the scenery).").
Story context: `story-script.md`. Gameplay context: `endgame-story.md`.

## Common rules for every special move

- **Telegraph first, always:** a readable windup (pose + sound + ground marker where it lands) of 0.5–1.0 s.
  No special move ever hits without its telegraph having been visible on screen.
- **Counter exists:** every move has one clear counter the player can learn (dodge direction, cover, interrupt, distance).
- **Punish window:** after every big move there is a recovery window (0.8–2 s) where the attacker takes extra damage.
- **Cooldowns and one-at-a-time:** at most one special move in progress per Alpha; at most two Alphas start a special
  move in the same second near the player.
- **Throwables come from the world:** anything movable (the pushable props from r12-vehicles: wrecks under 1.5 t, barrels,
  chairs, crates, bins, cones) and corpses. The thrower must walk to it and pick it up first (visible), so the player sees
  it coming. Thrown objects use the existing physics; they damage on hit, knock down, and stay where they land.
- **Deterministic sim, replay-safe;** moves are data-driven per Alpha type.

## Alpha types (L3 onward; each level picks a mix)

| Type | Look cue | Move set (telegraph → effect → counter) |
|---|---|---|
| **Brute** (current Alpha body) | biggest, slow walk | Charge (lowers head, scrapes ground 0.8 s → straight rush, knockdown → sidestep; stunned 1.5 s if it hits a wall) · Ground slam (raises both arms 1.0 s → ring shockwave 4 m, knockdown → step out of the ring) · Grab-and-throw (reaches 0.6 s → throws the courier or a follower 6 m → break line or shoot the arm to make it drop) |
| **Thrower** | lankier, long arms, scavenges | Pick up (walks to a prop/corpse, lifts it overhead 0.8 s, glowing landing marker) → throw (arc up to 25 m) → move behind cover or dodge the marker · **Living missile** (PO: "They might even throw Zombies that still live and then attack when closer"): grabs a nearby living infected, hurls it at the courier; it lands 1–3 m away, rolls (0.6 s down) and attacks immediately → shoot it in the air or during the landing roll · Barrage (when cornered: three quick light throws of debris) |
| **Screamer** | thin, jaw open | Roar (inhales 1.0 s → stuns within 8 m 1 s, and calls 6–10 nearby infected toward the player) → interrupt with a hit during the inhale, or break line of sight |
| **Leaper** | crouched, long legs | Pounce (crouch + eye glint 0.6 s → leap 8–12 m, pins and bites) → dodge sideways at the glint; shoot in the landing recovery · Wall climb: comes over low walls/fences instead of around |
| **Armoured** (riot gear / soldier Alpha) | helmet, vest | Shield bash (raises arm 0.6 s → push + stagger) · Front armour: bullets from the front do 25 %; flank it or use explosives/fire |

Level mix (keeps accepted levels recognisable; only the move sets grow):
- L3: Brute (with slam + grab-throw added), first Thrower near the yard.
- L4: Brute, Thrower, Armoured (soldier Alpha at the breaches).
- L5: Brute, Thrower, Leaper.
- L6: Screamer in the tunnels (sound carries), Leaper.
- L7: Brute, Thrower, Screamer (PO: "stronger alphas ... a bit of danger").
- L8: the animal bosses below (no humanoid Alpha except the Mega's sighting).
- L9: Leapers that jump onto the APC; Throwers that throw wrecks into the road.
- L10: all types, rare and dangerous (jump-scare encounters).

## L8 animal boss fights (each a short arena)

Each fight: one animal (or one pack), health bar shown when it engages, clear telegraphs, a tactic that wins, a fail state
(the courier downed → checkpoint at the arena entry). Rockets are scarce in L8 (one pickup per arena at most).

| # | Boss | Arena | Moves (telegraph) | Winning tactic | Phases |
|---|---|---|---|---|---|
| 1 | **Flamingo flock** (6–8) | pond with reeds | Swarm circling, then line dive (shadow line on the ground 0.6 s) | Step out of the shadow line; shotgun/MG sweeps | Dives get faster when half are down |
| 2 | **Zebra herd** (4–5) | paddock with fences | Stampede down a lane (dust + rumble 1 s), single kicks up close | Leave the lane (fences turn the herd); shoot stragglers | Second stampede from the opposite side |
| 3 | **Monkey pack** (6–10) | primate house, ropes and roofs | Harass from roofs, then grab-and-pull (a monkey hangs on the courier, weapon swap blocked 2 s), throw fruit/debris | Fight in the doorway choke point; shake off by melee | Leader monkey (bigger) appears when half are down; killing it scatters the rest |
| 4 | **Lion** (later a lioness joins) | rock enclosure with cover | Stalks out of sight (low growl), pounce (crouch + eye glint 0.6 s), pin | Keep your back to rocks; dodge sideways on the glint; shoot in the recovery | Phase 2: the lioness flanks while the lion roars |
| 5 | **Gorilla** | gorilla house, pillars, barrels | Chest-beat roar (stun 8 m, 1 s windup — interrupt by hitting it), throws barrels/benches (Thrower rules), ground pound (ring) | Break line of sight behind pillars; hit it during the chest-beat (it is exposed) | Phase 2 at half health: enraged, throws faster, smashes pillars (destruction system) |
| 6 | **Elephant** | elephant yard, walls, a truck | Charge (trumpet + foot stamp 0.9 s), trunk swipe up close | Sidestep so it charges into a wall or the truck; it is stuck and exposed 2 s | Three successful wall hits end the fight (or damage) |

## L10 final fight — the Mega at the dispersal complex

Arena: the complex yard, larger than today's survive circle (PO), with cover: machinery, fuel tanks, an electrified gate,
pillars. The console sits at one side; the cure charges while the courier keeps the Mega and its escort off it.

- **Phase 1 · Arrival (100–70 % HP):** charges and slams (Brute set, bigger); infected escort waves. Counter: dodge; lure its
  charge into machinery (stun 2 s, exposed weak spot glowing on its back).
- **Phase 2 · Rage (70–35 %):** throws wrecks, containers and corpses (Thrower set, heavier, longer range); climbs onto
  structures; roar calls a wave. Counter: fuel tanks (shoot when it is next to one), the flamethrower burns off its armour
  plates (exposes red weak spots), flashbangs stun it briefly.
- **Phase 3 · Last stand (35–0 %):** goes for the console directly; the electrified gate can be switched on once (lure it
  through: big damage + 3 s stun). Any loadout can finish it: weak spots take full damage from every weapon.
- **Fail:** the courier downed → restart at phase start; the console charge is kept.
- **Release:** when the Mega falls, the objective "Release the cure" — the epilogue plays.

Before the finale the Mega cannot be killed (L10 walk): weapons only stagger it (0.5–1 s), no health bar.
