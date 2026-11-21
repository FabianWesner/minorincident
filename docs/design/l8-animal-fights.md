# L8 animal fights — rethink (design, 2026-11-21)

PO 2026-11-21, verbatim:
- "Fighting Lions is pretty boring. They're not doing anything. They're not really attacking. And they're not strong. This needs to have a completely different gameplay. Think about how Lions would attack, how they would move, how fast they are, etc. Do this for all animals. Rethink. Each fight should feel different."
- "And also there are no animal sounds. There must be animal sounds that fit the animal in a more scary zombie style."
- "I like the idea to be locked in a cage with these flamingos until I kill them all (they should not stand up again like regular zombies). We can keep this for fight with others. So I'm going from cage to cage. I need to fight the other animals, before proceeding."

## Frame (applies to every cage)

- Sealed cage: the entry gate locks behind the courier; the exit opens only when every animal in the cage is dead. Cage to cage, in route order.
- **Solo cages** (PO 2026-11-21: "Fighting the monkeys took like two seconds. The soldiers did all the work. This needs massive better gameplay."): the survivor group, soldiers included, waits outside the cage gate; only the courier (and the corgi) are locked in. Allies never shoot into a cage. The fight is the player's.
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
| **Monkeys** (pack) | Chaos from above: they come from every side and from the roofs; a real fight of 60–90 s, not 2 s | Fast, erratic, hard to hit (dodge sideways when aimed at); climb fences and roofs, leap down, flee after a hit and come back | **Drop attack** from a roof edge (chitter tell). **Grab and ride** the courier (shake off with melee). **Snatch**: one steals a dropped pickup/ammo and runs. Leader: kill him to scatter the pack (existing). | Screeching chatter, shrieks echoing, scrabbling on roofs |
| **Elephant** (L8 finale boss; PO 2026-11-21: "Fighting the Elefant was super easy, super boring") | Environment: lure the charge into heavy objects; the longest, most dangerous fight of L8 (2–3 min), bullets alone barely scratch him until he is stunned | Slow walk, unstoppable charge, turns slowly | **Charge** (trumpet + foot stamp tell) → only an impact into the truck/wall/log barrier stuns him (~4 s, armour cracks, that is when damage counts); three impacts plus damage finish him. Phase 2 after the first impact: he tears loose a log/barrel with his trunk and throws it, and his stomp knocks down. He breaks light cover and chases the corgi if the courier hides. **Trunk swipe** and **stomp** shockwave at close range; destroys light cover. | Rotten trumpet blast, rumbling, ground shake |

## Delivery

Lanes, in order (one at a time; they share L8BossArenas/InfectedSystem):
1. s221 — lions (full rework) + flamingo fixed flock + the animal sound pipeline (all six voice sets).
2. s222 — zebras + gorilla.
3. s223 — monkeys + elephant polish.

Each lane: native HIGH zoom 1 captures of each move's tell and hit, looked at and described; the L8 skilled bot finishes; qa:threat 0 flags; a short "feel" note per animal (what the player has to do differently).

## Why the animals are infected (story, PO 2026-11-21)

PO, verbatim: "Fighting the zebras was far too easy, took only seconds, not a single attack, super boring, also they do not look like zombies" and "Also to me it's not clear why they are infected, there must be some more storyline here. We have all the ingredients in place, let's put them together nicely."

Throughline: the army's sanctuary fed its dead to the problem. Beats, using what L8 already has (Nadia, Major Hale, soldiers, the gate armory, the breach, the APC):
1. **Setup (arrival, before the breach)**: Nadia, walking: "The army burns its dead behind the animal houses. Burns *most* of them." A soldier mutters about "the bodies in the feed store". Smoke column behind the enclosures.
2. **Breach (four gates, see s220)**: the horde floods the zoo; some pour over the low pen walls. Hale on radio: "They're in the enclosures!"
3. **Each cage tells its own piece** (one environmental story + one short line on entering, never stopping the player): lion rocks — a dead keeper with a feed bucket, the lions over him ("They fed them from the feed store. Oh God."); zebra paddock — a broken fence and zombies still inside, the herd bitten mid-stampede; gorilla house — the vet's tranquiliser rifle on the floor, the cage door forced; primate yard — the keeper's office window smashed, monkeys dragging bloody uniforms; flamingo pond — red water; elephant — Nadia: "Not him. Not the old one…" (existing).
4. **Departure**: Hale's last words (existing) land harder because the player saw the sanctuary's mistake.

## Look

Every L8 animal must read as infected at game zoom: torn hide with exposed wound patches, blood around the mouth, matted/patchy fur or feathers, milky or glowing eyes, a limp/twitch in idle, consistent with the zombie palette. Built through the TRELLIS.2 pipeline (PO rule: every figure), derived from the current animal so rigs/animations keep working; LOD budgets as the existing animal assets. Corpses must not clip through fences (zebra screenshot).

Lanes: s224 animal looks (all six, assets only) runs in parallel to the behaviour lanes; the story beats go with s222 (zebras + gorilla) after s220 (breach) merges.

## Enclosures must look like enclosures (PO 2026-11-21)

PO, verbatim: "Killing the gorilla was just a single shot with a shotgun. Super boring." and "Also make sure that the animal arenas look like animal arenas. This one here does not look like a place where a gorilla would live in a zoo." (Screenshot: the gorilla "house" is a paved square with park benches, folding chairs, four red pillars and a street lamp; the whole survivor group incl. soldiers is inside with the dead gorilla.)

The gorilla died to one shotgun shot because the soldiers had already shot it — the solo-cage rule (s221) fixes that; its 1,200 HP stays, and s222 makes the duel last.

Each cage is dressed as the habitat it is, through the district/layout pipeline (props solid, figures TRELLIS), keeping the fight space and cover the behaviours need:
- **Lion rocks**: sandy ground, a big rock outcrop with a sun ledge (lion stalking cover), tall dry grass clumps, a dead tree, moat edge + viewing wall.
- **Flamingo pond**: shallow pond with reeds and mud banks (landing pads on the banks), a little island, a viewing boardwalk.
- **Zebra paddock**: savanna grass and dirt, a long oval run along the fence (stampede lap), feeding racks, a water trough, a shelter.
- **Gorilla house**: indoor/outdoor enclosure: climbing frame of logs and ropes, a rock with a ledge (throw position), straw and hay, a glass viewing window, tyre swing, a night-house door.
- **Primate yard**: high climbing frames, ropes, roofs to drop from, nets, a keeper office.
- **Elephant yard**: packed earth, a pool, a heavy log barrier, the armored truck (lure target).
No park benches, folding chairs, plaza pillars or street lamps inside a cage (lamps outside the fence are fine).
