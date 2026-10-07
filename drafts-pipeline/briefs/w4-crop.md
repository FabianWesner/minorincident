Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest view of exactly that item (characters: the full turnaround; buildings: the clearest view inside its diorama; props/weapons: the item in its panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and `assets/<id>/description.txt`, and append boxes to `assets/regions/w4.json`. Write nothing else.

Items:
- `wpn.police-baton` from `initial-drafts/melee-extras.png`: Police baton (nightstick): black rubber/polymer baton with side handle, wrist strap
- `wpn.shovel` from `initial-drafts/melee-extras.png`: Garden shovel used as a melee weapon: wooden handle with D-grip, dented steel blade, a little dirt

Final message: {"cropped": [...], "missing": [...], "notes": "..."}