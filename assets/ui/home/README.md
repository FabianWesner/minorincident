# Home background art

Clean redraw of the read-only `initial-drafts/home-screen.png`, generated with the built-in imagegen tool. No game code changed.

The reference depicts a ponytailed survivor and backpack-wearing corgi on a garden path overlooking a suburban cul-de-sac: picket fences, flower beds, parked cars, glowing houses, distant emergency lights and smoke. Its elevated composition, rounded miniature 3D illustration, warm peach/amber sunset, sage greens, teal packs and mauve shadows are retained.

## Masters and layout

- `home-landscape.png`: 2560 × 1440 (16:9). Pair fully visible in centre-right; soft left foliage gives a quieter title/menu area.
- `home-portrait.png`: 1290 × 2796 (requested dimensions, approximately 9:19.5). Independently redrawn vertical extension of the same scene, with extra sky and foreground paving; both characters remain visible. Calm upper sky and lower path allow title/menu placement.
- Generated source resolutions were 1672 × 941 and 829 × 1897. ImageMagick Lanczos resizing and a small centred aspect trim produce the exact master sizes; these are upscaled masters, not native-resolution generation.

## Prompts used

### Landscape
Use case: stylized-concept. Asset: clean game home-screen background plate. Input image: /Users/fabianwesner/Workspace/suburban-survivors/initial-drafts/home-screen.png is reference ONLY for scene, mood and rounded polished miniature 3D illustration style. REDRAW as entirely clean art, 16:9 landscape, requested 2560x1440. Golden-hour suburban cul-de-sac viewed from a high garden path: white picket fences, pink flowers, rounded leafy trees, cream houses with lavender slate roofs, amber glowing windows and lanterns, blue parked sedan, distant tiny red-blue emergency lights and a thin smoke plume against peach sunset. Foreground focal pair: brown ponytailed young survivor in red-and-cream hoodie, navy shorts, red sneakers, teal backpack with corgi patch, holding lowered studded wooden bat; orange-and-white corgi with matching teal pack looking up at her. Full bodies visible. Put pair in safe central area around x=60%, y=68%, not at right edge, leaving left third as calm softly shaded low-detail foliage/road for later title/menu overlay; upper-left soft trees/sky with no dominant highlights. Rich peach/amber, sage greens, teal, mauve shadows; soft cinematic depth of field and warm rim light, appealing toy proportions. Preserve cozy neighborhood with subtle impending trouble. No text whatsoever, no letters, no logo, no UI, no buttons, no panels, no borders, no watermark. This must be a single full-bleed illustration.

### Portrait
Use case: stylized-concept. Asset: clean portrait game home-screen background plate, 9:19.5 aspect, requested master 1290x2796. Input image is the approved LANDSCAPE REDRAW, scene/style/character identity reference. Redraw the SAME sunset suburban cul-de-sac with same brown ponytailed girl, red cream hoodie, navy shorts, red sneakers, teal corgi-patch backpack, lowered studded wooden bat, same orange-white corgi with teal pack, white picket fences, flowers, blue sedan, round leafy central tree, cream houses with lavender roofs, amber lanterns/windows, tiny distant emergency lights and smoke. ART-DIRECT A VERTICAL EXTENSION, not a narrow crop: widen the view enough that girl and corgi are both fully visible side-by-side near the horizontal centre in middle third (their combined silhouettes within central 70% width). Add substantial peach sunset sky and soft distant rooftops ABOVE the neighborhood and more softly shaded garden path/steps with blurred flowers BELOW the pair. Upper quarter calm low-detail peach sky for future title, bottom quarter calm softly shaded mauve paving for future menu. Retain warm rounded miniature 3D illustration, rich amber/peach highlights, sage green, teal packs, mauve shadows, soft cinematic depth of field. Same coherent neighborhood geography and cozy mood with hint of impending trouble. Full bleed single image. Absolutely no UI, no text, no letters, no title, no logo, no buttons, no panels, no border, no watermark.

## Web exports

`public/ui/home/home-{orientation}-{width}.{avif,webp}`. Landscape widths: 640, 1280, 1920, 2560. Portrait widths: 640, 1080, 1290. Proportional heights round to whole pixels.

ImageMagick creates stripped PNG masters and WebP (method 6); avifenc creates 8-bit YUV420 AVIF (speed 6, 2 threads). Quality starts at 80 and decreases in steps of 10 until WebP is ≤250,000 bytes and AVIF is ≤120,000 bytes. Export sizes are recorded below.

`public/ui/home/placeholders.json` maps `landscape` and `portrait` to blurred WebP data URLs. Each entire data URL is under 2,000 bytes. Decode directly as an image source.

Visual QA: no visible text/UI/logo/watermark; full character silhouettes in both; portrait extends the setting vertically. Automated QA checks exact master dimensions, expected variants, decodability and size limits. No epic acceptance criteria or game behavior changed.


## File sizes (bytes)

| File | Bytes |
| --- | ---: |
| `assets/ui/home/home-landscape.png` | 4239034 |
| `assets/ui/home/home-portrait.png` | 4125502 |
| `public/ui/home/home-landscape-1280.avif` | 98042 |
| `public/ui/home/home-landscape-1280.webp` | 142372 |
| `public/ui/home/home-landscape-1920.avif` | 116977 |
| `public/ui/home/home-landscape-1920.webp` | 223078 |
| `public/ui/home/home-landscape-2560.avif` | 88611 |
| `public/ui/home/home-landscape-2560.webp` | 248580 |
| `public/ui/home/home-landscape-640.avif` | 68736 |
| `public/ui/home/home-landscape-640.webp` | 58078 |
| `public/ui/home/home-portrait-1080.avif` | 98631 |
| `public/ui/home/home-portrait-1080.webp` | 205488 |
| `public/ui/home/home-portrait-1290.avif` | 88342 |
| `public/ui/home/home-portrait-1290.webp` | 224804 |
| `public/ui/home/home-portrait-640.avif` | 97821 |
| `public/ui/home/home-portrait-640.webp` | 140616 |
| `public/ui/home/placeholders.json` | 350 |
