# s33-nightread

## Cause and change
The final infected night shading capped body luminance at 0.1 after lighting, flattening coat detail regardless of stronger lights. Seven L8 infected animal bosses now use a 0.4 ceiling, stronger moon rim (2 versus ordinary crowd 0.25), doubled eye emission, and the existing restrained 0.25 fill. Ordinary infected and healthy animals retain their settings. No moves, HP, AI, geometry, or draw calls were added. Thresholds are unchanged.

## Captures opened
Raw captures remain ignored under test-results/. Opened before: s33-before/webgl2-high-1/night-boss-lion@high-z1.5/sheet.jpg: nearly black head/body with little mane or leg separation. Opened after: s33-rim/webgl2-high-1/night-boss-lion@high-z1.5/sheet.jpg: moonlit mane, head and legs separate against the ground throughout idle/walk/hit. Opened after zoo lineup sheet in the same batch: elephant ears and limbs separate, zebra stripes remain distinct; bodies remain dark inside their outlines.

Worst sampled luma standard deviation, WebGL2 high (minimum 14):

| Actor | Before | After |
|---|---:|---:|
| Isolated lion | 10.03 | 23.09 |
| Flamingo | 9.94 | 26.46 |
| Zebra | 14.76 | 35.68 |
| Monkey | 8.87 | 20.38 |
| Lion lineup | 11.76 | 24.79 |
| Lioness | 10.02 | 36.26 |
| Gorilla | 13.37 | 29.31 |
| Elephant | 12.02 | 23.91 |

Dog and regular controls are numerically unchanged (7.71 and 7.43; exempt by body size).

## Checks
Typecheck and lint pass. Focused render-contracts previously passed 14/14. `SCENE_PORT=4922 npm run scene:gate` passed 62/62 rows, 0 known and 0 skipped, in 10.7 minutes (test-results/scene-gate/summary.md). This includes all lion, Mega and zoo-lineup night rows on WebGL2/WebGPU, low/high, zoom 1.5. Post-commit `npm run test:gate` passed 107/107 tests in 27 files (169.9 s, within the 240 s budget). Earlier test:gate failed its dirty-tree review freshness assertion; it passes on the committed source. No raw captures were committed.
