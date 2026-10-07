# Minor Incident favicon

A courier cap: teal crown, cream front panel and orange brim on navy.

`generated-master.png` is the built-in imagegen concept, reduced to 192 px / 16 colours to keep the source small. `master.svg` is the hand-vectorised production master, identical to `public/favicon.svg`. Small panel seams and the top button were removed for legibility. The final colours are backpack teal `#2f6e6a`, picket cream `#f2e6dc`, orange `#f6a623`, and the existing page background navy `#293447`.

## Imagegen prompt

> Use case: logo-brand. Asset: favicon master for browser game Minor Incident. A single bold flat courier baseball cap, centered on solid dark navy #293447 square. Teal green #268675 crown, large cream #fff1d5 front panel, orange #f6a623 brim projecting to the right. Simple side three-quarter silhouette, thick navy outline, just 3 large shapes, no tiny detail, no lettering, no text, no face, no gradients, no shadows, no texture. Clean vector-like geometric illustration designed to read clearly at 16x16. Cap occupies central 70 percent width, generous margin. Output square.

## Export and review

PNG exports were rasterised directly from the SVG using headless Chromium canvas, with a solid navy background, then losslessly optimised with Pillow. The ICO contains 16, 32 and 48 px images. Apple uses 180 px; standard app icons use 192 and 512 px. The maskable export draws the whole SVG at 70% scale, centered on solid navy; all foreground shapes fit inside the central safe circle (radius 40% of the canvas).

`favicon-16.png` and `favicon-48.png` are review exports; the 32 px export is in `public/`. `legibility.png` shows the actual 16 and 32 px renders enlarged with nearest-neighbour sampling, reviewed for silhouette and colour separation. No text or narrow ornament needs to survive downsampling.

The manifest and head links use root-relative paths, matching the game's current root deployment. No service worker or game runtime code is added.
