# Task: draw one new concept sheet for "Suburban Survivors" (pack 23 / 29)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/infected-animals.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/zombies-civilian-characters.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 23 / 29" and "INFECTED ANIMALS", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
one panel per animal, three-quarter view plus a side view, zombie variants with glowing eyes and torn fur

## Items (draw every one; nothing else)
- `inf.cat-black`: Zombie black cat: arched back, glowing red eyes, patchy fur, small and fast
- `inf.cat-tabby`: Zombie orange tabby cat: hissing, glowing red eyes, torn ear, patchy fur
- `inf.crow`: Zombie crow: black, ragged feathers, glowing red eyes, wings spread
- `inf.dog-dachshund`: Zombie dachshund: long low body, snarling, glowing red eyes, torn collar
- `inf.dog-k9`: Zombie police K9 German shepherd: police vest harness, snarling, glowing red eyes
- `inf.dog-retriever`: Zombie golden retriever: matted golden fur, red collar, glowing red eyes, lunging
- `inf.flamingo`: Zombie pink flamingo (escaped from the zoo): one leg raised, ragged feathers, glowing red eyes
- `inf.gorilla`: Zombie gorilla (escaped from the zoo): huge, knuckle-walking, silverback, glowing red eyes, wounds
- `inf.lion`: Zombie lion (escaped from the zoo): mane, prowling, glowing red eyes, scars

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/infected-animals.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/infected-animals.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}


Rules: town name is always "Sunset Grove"; no real brands or logos; infected are adults or older teens only (no children).