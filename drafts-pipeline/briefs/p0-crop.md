Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest
view of exactly that item (for characters the full turnaround; for buildings the clearest view inside its diorama; for props the item
in its props panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with
view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and
`assets/<id>/description.txt` (the description below), and append boxes to `assets/regions/p0-originals.json`. Write nothing else.

Items:
- `inf.jogger` from `initial-drafts/zombies-civilian-characters.png`: Infected jogger (Runner): pink visor, sports top, shorts, bloody, glowing red eyes
- `inf.suburban-mom` from `initial-drafts/zombies-civilian-characters.png`: Infected suburban mom (Runner): cardigan, jeans, bloody, glowing red eyes
- `inf.delivery-driver` from `initial-drafts/zombies-civilian-characters.png`: Infected delivery driver (Runner, also the Patient Zero base): uniform, cap, parcel, bloody, glowing red eyes
- `inf.crawler` from `initial-drafts/zombies-civilian-characters.png`: Infected crawler (legless, crawling on its arms), bloody, glowing red eyes
- `veh.sedan-red` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Red sedan (parked vehicles row)
- `veh.sedan-blue` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Blue sedan (parked vehicles row)
- `veh.sedan-white` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: White sedan (parked vehicles row)
- `bld.house-a` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Suburban house A: one-storey ranch house with porch, from the cul-de-sac/street-corner dioramas
- `bld.house-b` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Suburban house B: two-storey house with attached garage, from the dioramas
- `bld.house-c` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Suburban house C: house with backyard deck (backyard diorama)
- `kit.porch-stairs` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Porch and stairs modular kit (white railings, wooden steps, door, planters)
- `prop.picket-fence` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: White picket fence segment
- `prop.hedge` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Trimmed hedge block
- `prop.mailbox-blue` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Blue street mailbox (no real brand marks)
- `prop.trash-bin` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Wheeled trash bin (green) and recycling bin (blue)
- `prop.fire-hydrant` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Red fire hydrant
- `prop.street-lamp` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Victorian-style street lamp with warm glowing lantern
- `prop.bench` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Wooden park/street bench
- `prop.utility-pole` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Wooden utility pole with crossbar and transformer
- `prop.street-sign` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Street-name sign post (Maple Ave / Pine St)
- `prop.traffic-cone` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Orange traffic cone
- `prop.barricade` from `initial-drafts/suburban-homes-backyards-and-street-props.png`: Orange-white striped road barricade
- `bld.joes-diner` from `initial-drafts/roadside-diner-gas-station-and-street-props.png`: Joe's Diner: retro diner building with neon sign and 'Good Food Brighter Days' sign (retro diner lot diorama)
- `bld.mainstreet-brick` from `initial-drafts/roadside-diner-gas-station-and-street-props.png`: Main-street red-brick two-storey shop building with bakery awning and pharmacy cross (main street intersection diorama)
- `int.pharmacy-clinic` from `initial-drafts/shops-interiors-and-retail-props.png`: Pharmacy / clinic interior set: counter, shelves, consultation area (pharmacy/clinic interior panel)

Final message: {"cropped": [...], "missing": [...], "notes": "..."}