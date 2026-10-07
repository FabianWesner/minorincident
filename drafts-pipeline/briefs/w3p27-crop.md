Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest view of exactly that item (characters: the full turnaround; buildings: the clearest view inside its diorama; props/weapons: the item in its panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and `assets/<id>/description.txt`, and append boxes to `assets/regions/w3p27.json`. Write nothing else.

Items:
- `prop.dumpster` from `initial-drafts/street-and-camp-props.png`: Green metal dumpster with lids, wheels, graffiti-free
- `prop.fire-extinguisher` from `initial-drafts/street-and-camp-props.png`: Red fire extinguisher with black hose
- `prop.folding-chair` from `initial-drafts/street-and-camp-props.png`: Metal folding chair, grey
- `prop.pallet` from `initial-drafts/street-and-camp-props.png`: Wooden shipping pallet
- `prop.plank-stack` from `initial-drafts/street-and-camp-props.png`: Stack of wooden planks tied with rope (barricade material)
- `prop.sandbag-pallet` from `initial-drafts/street-and-camp-props.png`: Pallet stacked with sandbags
- `prop.shopping-cart` from `initial-drafts/street-and-camp-props.png`: Metal shopping cart with red handle
- `prop.sofa` from `initial-drafts/street-and-camp-props.png`: Old brown three-seat sofa, worn cushions
- `prop.vending-cart` from `initial-drafts/street-and-camp-props.png`: Street hot-dog vending cart with umbrella (no brand)

Final message: {"cropped": [...], "missing": [...], "notes": "..."}