# Task: draw one new concept sheet for "Suburban Survivors" (pack 22 / 29)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/infected-workers-and-specials.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/zombies-civilian-characters.png`
- `initial-drafts/survivors-corgi-and-equipment.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 22 / 29" and "INFECTED WORKERS & SPECIALS", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
character turnarounds (front, three-quarter, back) per character, like the infected sheet; the survivor group as one small group shot

## Items (draw every one; nothing else)
- `inf.armored-football`: Infected high-school-age football player (older teen, adult build), padded helmet and shoulder pads, torn jersey #13, tank-like charger silhouette
- `inf.butcher`: Butcher elite infected: huge adult in a blood-stained white apron and rubber boots, cleaver in hand (weapon socket), hulking
- `inf.construction-worker`: Infected construction worker: hi-vis orange vest, hard hat, tool belt, work boots, dusty jeans
- `inf.firefighter`: Infected firefighter: tan turnout gear with reflective stripes, helmet, oxygen tank on back, axe (weapon socket)
- `inf.hazmat`: Infected hazmat worker: yellow hazmat suit, gas mask with cracked visor, rubber gloves, torn suit leaking green
- `inf.nurse`: Infected nurse: teal scrubs, sneakers, ID lanyard, stethoscope, blood-splattered
- `inf.skater`: Infected adult skater: hoodie, beanie, ripped skinny jeans, skate shoes, knee pads (no board)
- `inf.corpse-poses`: Set of 4 dead infected lying on the ground in different poses (face down, on back, curled, slumped sitting), generic civilian clothes
- `npc.survivor-group`: Group of 4 adult civilian survivors huddled together (two men, two women, mixed ages, casual clothes, backpacks), scared but alive

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/infected-workers-and-specials.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/infected-workers-and-specials.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}


Rules: town name is always "Sunset Grove"; no real brands or logos; infected are adults or older teens only (no children).