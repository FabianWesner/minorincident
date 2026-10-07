Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest view of exactly that item (characters: the full turnaround; buildings: the clearest view inside its diorama; props/weapons: the item in its panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and `assets/<id>/description.txt`, and append boxes to `assets/regions/w3p26.json`. Write nothing else.

Items:
- `bld.river-bridge` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Concrete two-lane road bridge over a river, guard rails, lamp posts, one span section
- `kit.bleachers` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Aluminium sports bleachers, five rows, metal frame
- `kit.campground` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Campground kit: tents, campfire ring, picnic table, camper van shape, string lights
- `kit.creek-bridge-wood` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Small wooden footbridge over a creek with railings
- `kit.highway-onramp` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Highway on-ramp kit: curved elevated concrete ramp, barriers, green highway sign 'SUNSET GROVE EXIT'
- `kit.rail-crossing` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Railroad level crossing kit: track section, crossing gates with red lights, crossbuck sign
- `kit.river-terrain` from `initial-drafts/bridges-roads-and-terrain-kits.png`: Riverbank terrain kit: water surface tile, rocks, reeds, sloped grassy bank

Final message: {"cropped": [...], "missing": [...], "notes": "..."}