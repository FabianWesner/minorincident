Cut the following characters out of the original concept sheets in `initial-drafts/` (read-only). For each, crop the
FULL 4-view turnaround of that character (all views, nothing of its neighbours; labels and colour swatches excluded),
plus, when the sheet has one, its portrait/head close-up as a second crop. Find boxes by looking at the sheet with
view_image, crop with Python+Pillow at original resolution, and LOOK at every crop to verify it.

Write per item: `assets/<id>/reference.png` (turnaround), optional `assets/<id>/reference-portrait.png`,
`assets/<id>/description.txt` (the description below). Append the boxes to `assets/regions/hero-characters.json`
as {"<id>": {"sheet": "...", "turnaround": [x0,y0,x1,y1], "portrait": [..] }}. Write nothing else.

Items:
- `char.survivor-female` from `initial-drafts/survivors-corgi-and-equipment.png`: Female survivor: red jacket over white tee, denim shorts, red sneakers, teal backpack with corgi patch, ponytail (also in the gameplay mockup)
- `char.survivor-male` from `initial-drafts/survivors-corgi-and-equipment.png`: Male survivor: red-and-white hoodie, cargo pants, red sneakers, teal backpack with corgi patch, spiky brown hair
- `char.corgi` from `initial-drafts/survivors-corgi-and-equipment.png`: Corgi companion: orange-and-white corgi with a small teal pack and red collar
- `inf.common-worker` from `initial-drafts/zombies-civilian-characters.png`: Infected common worker (Runner): torn shirt and tie, grey trousers, bloody, glowing red eyes
- `inf.baseball-cap` from `initial-drafts/zombies-civilian-characters.png`: Infected in a red baseball cap (Runner): cap, white tee, jeans, bloody, glowing red eyes
- `inf.schoolgirl` from `initial-drafts/zombies-civilian-characters.png`: Infected schoolgirl (Runner): school uniform, pigtails, bloody, glowing red eyes
- `inf.brute` from `initial-drafts/zombies-emergency-workers-and-mutants.png`: Infected Brute: huge hulking body, torn clothes, oversized arms, glowing red eyes

Final message: {"cropped": ["<id>", ...], "missing": [...], "notes": "<one sentence>"}