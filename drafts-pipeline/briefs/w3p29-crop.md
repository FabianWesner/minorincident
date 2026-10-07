Cut the following items out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the best, largest view of exactly that item (characters: the full turnaround; buildings: the clearest view inside its diorama; props/weapons: the item in its panel), at original resolution, excluding neighbours as far as possible. Find boxes by looking at the sheets with view_image, crop with Python+Pillow, and LOOK at each crop to verify. Write per item `assets/<id>/reference.png` and `assets/<id>/description.txt`, and append boxes to `assets/regions/w3p29.json`. Write nothing else.

Items:
- `veh.fuel-truck` from `initial-drafts/more-vehicles.png`: Fuel tanker truck: white cab, silver tank trailer with hazard placards, no brands
- `veh.jeep-red` from `initial-drafts/more-vehicles.png`: Red open-top off-road jeep with roll bar and spare wheel
- `veh.pickup-white` from `initial-drafts/more-vehicles.png`: White pickup truck, single cab, slightly dented
- `veh.police-suv` from `initial-drafts/more-vehicles.png`: Sunset Grove police SUV: black and white, light bar, push bar, 'POLICE' text
- `veh.sedan-green` from `initial-drafts/more-vehicles.png`: Green four-door sedan, family car
- `veh.suv-green` from `initial-drafts/more-vehicles.png`: Green mid-size SUV with roof rails
- `veh.train-freight` from `initial-drafts/more-vehicles.png`: Freight train: diesel locomotive plus one boxcar (no real railroad marks)

Final message: {"cropped": [...], "missing": [...], "notes": "..."}