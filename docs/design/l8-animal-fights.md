# L8 animal fights — rethink (design, 2026-11-21)

PO 2026-11-21, verbatim:
- "Fighting Lions is pretty boring. They're not doing anything. They're not really attacking. And they're not strong. This needs to have a completely different gameplay. Think about how Lions would attack, how they would move, how fast they are, etc. Do this for all animals. Rethink. Each fight should feel different."
- "And also there are no animal sounds. There must be animal sounds that fit the animal in a more scary zombie style."
- "I like the idea to be locked in a cage with these flamingos until I kill them all (they should not stand up again like regular zombies). We can keep this for fight with others. So I'm going from cage to cage. I need to fight the other animals, before proceeding."

## Frame (applies to every cage)

- Sealed cage: the entry gate locks behind the courier; the exit opens only when every animal in the cage is dead. Cage to cage, in route order.
- Solo cages: the survivor group, including soldiers, waits outside the entry gate and neither enters nor shoots into an active cage. Only the courier and corgi fight inside. Followers resume following when the exit opens. This applies to flamingos, lions, zebras, gorilla, monkeys, and the elephant yard. Treat this deliberate wait as intended in `FOLLOWER_WAIT` checks.
- Dead animals stay dead (arena hits are already permanent). Nothing in a cage rises from the ground mid-fight. Any reinforcement arrives visibly (flies in, drops from a roof, breaks out of a pen door) and is part of a fixed, authored total.
- Each fight has one core idea the player has to learn, a readable tell (pose + sound + short ground telegraph) before every dangerous move, and a punish window after it. The counter hint toast names that idea.
- Animals are infected animals, not the standard zombie archetypes, so their stats are authored per animal; the "zombies identical everywhere" rule is untouched.
- The courier can lose: these are the hardest fights in L8 before the elephant. Skilled bot must still finish L8 (qa:threat 0 flags); deaths may rise moderately, never to a wall.
- Sound: every animal gets its own voice set — idle/stalk, tell, attack, hurt, death — built from real animal recordings (licensed CC0/CC-BY with license snapshot, like the zombie voices) and processed into a wet, rotten, distorted zombie variant (pitch down, grit, gurgle layer). Positional, ducked under dialogue. The tell sound must be audible off-screen so the player can react by ear.

## Per animal

| Cage | Core idea | How it moves | Attacks (tell → move → punish window) | Sound |
|---|---|---|---|---|
| **Lions** (pair) | Being hunted: two predators coordinate; never turn your back | Stalk slowly and low, circling at 10–16 m, using rocks/grass as cover; then explode into a sprint ~1.6× the courier's run for 2–3 s | (1) **Ambush pounce**: one lion holds the courier's attention with a roar from the front while the other circles behind; crouch + tail lash + low growl (0.6 s) → leap 6–8 m → knocks the courier down and pins her (heavy damage per bite; break free by mashing melee/E, or the corgi/another hit knocks it off) → after a missed or broken pounce the lion skids and is stunned ~1.5 s (punish). (2) **Swipe** at close range: fast paw combo with knockback. (3) When one lion dies the other **enrages**: faster, pounces more often. | Deep wet growl while stalking, rattling roar as the tell, snarl on the leap, gurgling death |
| **Flamingos** (flock) | Air raid: dodge dive lanes, shoot them on the ground | The flock circles overhead as a group, lands in clusters on the pads, struts and pecks, takes off again | **Dive bomb** along a red lane (screech tell, lane shown 0.8 s) → hit + stagger → the bird lands and is grounded ~2 s (punish). **Mob peck** when 3+ are landed near the courier. Fixed flock; no birds rising from the ground. | Shrill rotten honk/screech, wing flaps, wet impact |
| **Zebras** (herd) | Stampede timing: stay out of the herd's lane, use the fence to turn them | The herd moves as one, laps the paddock at a gallop in a dust cloud, wheels at the fence | **Stampede** pass (hoofbeat rumble + snort tell, dust lane) → trample knockdown → the herd turns at the fence and is slowed (punish the stragglers). **Rear kick** if the courier stands behind one: huge knockback. | Braying shriek, thunder of hooves, snort |
| **Gorilla** | Duel: interrupt the displays, hide from the throws | Knuckle-walk, bluff charges that stop short, real charges that don't; climbs onto the rock/structure to throw | **Chest-beat** (interruptible by hits; uninterrupted → enraged, harder hits). **Grab and slam** at close range. **Throw** rocks/props from height (barrage). **Ground pound** shockwave. Punish after a slam or a bluff stop. | Deep hoots building to a roar, chest drum, grunt on throws |
| **Monkeys** (pack) | Chaos from above: they come from every side and from the roofs | Fast, erratic; climb fences and roofs, leap down, flee after a hit and come back | **Drop attack** from a roof edge (chitter tell). **Grab and ride** the courier (shake off with melee). **Snatch**: one steals a dropped pickup/ammo and runs. Leader: kill him to scatter the pack (existing). | Screeching chatter, shrieks echoing, scrabbling on roofs |
| **Elephant** | Environment: lure the charge into heavy objects | Slow walk, unstoppable charge, turns slowly | **Charge** (trumpet + foot stamp tell) → three impacts into the truck/wall stop him (existing). **Trunk swipe** and **stomp** shockwave at close range; destroys light cover. | Rotten trumpet blast, rumbling, ground shake |

## Delivery

Lanes, in order (one at a time; they share L8BossArenas/InfectedSystem):
1. s221 — lions (full rework) + flamingo fixed flock + the animal sound pipeline (all six voice sets).
2. s222 — zebras + gorilla.
3. s223 — monkeys + elephant polish.

Each lane: native HIGH zoom 1 captures of each move's tell and hit, looked at and described; the L8 skilled bot finishes; qa:threat 0 flags; a short "feel" note per animal (what the player has to do differently).
