Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest view of exactly that item (characters: the full turnaround; buildings: the clearest view inside its diorama; props/weapons: the item in its panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and `assets/<id>/description.txt`, and append boxes to `assets/regions/wave2.json`. Write nothing else.

Items:
- `wpn.baseball-bat` from `initial-drafts/weapons-consumables-and-survival-props.png`: Wooden baseball bat with grip tape
- `wpn.crowbar` from `initial-drafts/weapons-consumables-and-survival-props.png`: Red crowbar
- `wpn.machete` from `initial-drafts/weapons-consumables-and-survival-props.png`: Machete with wrapped handle
- `pick.medkit` from `initial-drafts/weapons-consumables-and-survival-props.png`: First-aid medkit pickup
- `pick.soda` from `initial-drafts/weapons-consumables-and-survival-props.png`: Soda can pickup
- `inf.teen-skater` from `initial-drafts/zombies-civilian-characters.png`: Infected skater, aged up to a young adult (rule R1): hoodie, skate shoes, bloody, glowing red eyes
- `inf.bbq-dad` from `initial-drafts/zombies-civilian-characters.png`: Infected BBQ dad: apron, shorts, spatula, bloody, glowing red eyes
- `inf.cashier` from `initial-drafts/zombies-civilian-characters.png`: Infected cashier: store vest, name tag, bloody, glowing red eyes
- `inf.bathrobe-neighbor` from `initial-drafts/zombies-civilian-characters.png`: Infected neighbor in a bathrobe and slippers, bloody, glowing red eyes
- `inf.screamer` from `initial-drafts/zombies-emergency-workers-and-mutants.png`: Infected Screamer: wild hair, arms raised, open screaming mouth, glowing red eyes
- `inf.sprinter` from `initial-drafts/zombies-emergency-workers-and-mutants.png`: Infected Sprinter: lean athletic body, running pose, glowing red eyes
- `inf.riot-cop` from `initial-drafts/zombies-emergency-workers-and-mutants.png`: Infected riot cop: helmet, riot shield, armour, glowing red eyes
- `inf.bloated` from `initial-drafts/zombies-emergency-workers-and-mutants.png`: Infected Bloated: huge swollen belly, pustules, glowing red eyes
- `wpn.nail-bat` from `initial-drafts/weapons-consumables-and-survival-props.png`: Baseball bat with nails
- `wpn.pistol` from `initial-drafts/weapons-consumables-and-survival-props.png`: Pistol
- `wpn.shotgun` from `initial-drafts/weapons-consumables-and-survival-props.png`: Pump shotgun
- `wpn.nail-gun` from `initial-drafts/weapons-consumables-and-survival-props.png`: Yellow nail gun
- `thr.molotov` from `initial-drafts/weapons-consumables-and-survival-props.png`: Molotov cocktail bottle with rag
- `thr.pipe-bomb` from `initial-drafts/weapons-consumables-and-survival-props.png`: Pipe bomb
- `thr.firecracker-lure` from `initial-drafts/weapons-consumables-and-survival-props.png`: Firecracker lure bundle
- `pick.energy-drink` from `initial-drafts/weapons-consumables-and-survival-props.png`: Energy drink can pickup
- `pick.bandages` from `initial-drafts/weapons-consumables-and-survival-props.png`: Bandage roll pickup
- `veh.suv-dark` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Dark SUV (safe-house vehicle) with roof rack and lights
- `bld.gas-station` from `initial-drafts/roadside-diner-gas-station-and-street-props.png`: Gas station: canopy, convenience shop, price sign — brand renamed to "Sunset Fuel"
- `bld.maple-hardware` from `initial-drafts/roadside-diner-gas-station-and-street-props.png`: Maple Hardware store strip building
- `bld.school-elementary` from `initial-drafts/school-playground-and-gym.png`: Elementary school entrance facade building
- `kit.playground` from `initial-drafts/school-playground-and-gym.png`: Playground kit: tower, slide, monkey bars, swings, spring duck
- `int.supermarket` from `initial-drafts/shops-interiors-and-retail-props.png`: Supermarket interior set: shelves, freezers, checkouts
- `kit.police-checkpoint` from `initial-drafts/emergency-services-buildings-vehicles-and-props.png`: Police checkpoint kit: tent, barriers, lights, sign trailer
- `kit.evac-camp` from `initial-drafts/emergency-services-buildings-vehicles-and-props.png`: Evacuation camp kit: tents, med cots, generator, fence

Final message: {"cropped": [...], "missing": [...], "notes": "..."}