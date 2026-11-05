Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest view of exactly that item (characters: the full turnaround; buildings: the clearest view inside its diorama; props/weapons: the item in its panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and `assets/<id>/description.txt`, and append boxes to `assets/regions/w3p25.json`. Write nothing else.

Items:
- `int.diner` from `initial-drafts/interiors.png`: Joe's Diner interior cutaway: counter with stools, booths, jukebox, kitchen pass-through, checkered floor
- `int.food-court` from `initial-drafts/interiors.png`: Mall food court interior cutaway: fast-food counters (no real brands), tables and chairs, tray stands
- `int.gym-cafeteria` from `initial-drafts/interiors.png`: School gym and cafeteria interior cutaway: basketball court with hoops, folding tables, cots for evacuees
- `int.mini-mall` from `initial-drafts/interiors.png`: Strip mini-mall interior cutaway: small shops along a corridor (laundromat, pizza, phone repair), no real brands

Final message: {"cropped": [...], "missing": [...], "notes": "..."}