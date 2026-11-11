# s36-nightinf

## Result and cause

Night infected retain their authored skin/clothing hue instead of a pale blue wash. Full blue moon fill and the final cool grade both contributed. Neutral, restrained figure fill and body hue restoration preserve surface colour; infection/night-gated grade protection prevents the composite from reintroducing blue. Heavy fill retains directional body shading; armored keeps s35’s 0.25 fill. Civilian infection uses its existing shader state. No simulation, stats, AI, animation, geometry, or draw-call path changed.

The grazing Fresnel rim is excluded from body hue restoration. Alpha and zoo bosses keep their original fill/rim strengths and have neutral-fill selection zero, so the added correction and grade protection evaluate to zero for them. No outline code changed.

## Before/after measurements

Matched original render `d7796292` and final render: 3 presets (`night` for L4 blackout/night, `L8-zoo`, `L10-night`) × WebGL2/WebGPU × low/high × game-camera zoom 1/1.5 = 24 rows each. All 144 final class means satisfy B ≤ 1.1R or B ≤ 1.1G. Body pixels use an inspected geometry mask, excluding contact-shadow quads and including infected civilian bodies. RGB/luma are 0–255; saturation is HSV 0–1. Values below average all 24 rows.

| Class | Before RGB | Final RGB | Saturation before → final | Luma before → final |
|---|---|---|---|---|
| ordinary | [42.18, 57.4, 76.62] | [64.22, 57.77, 58.69] | 0.458 → 0.277 | 55.55 → 59.21 |
| brute | [62.52, 69.38, 85.77] | [74.4, 64.3, 62.22] | 0.308 → 0.192 | 70.97 → 68.67 |
| butcher | [70.66, 73.58, 87.5] | [82.65, 71.82, 71.4] | 0.284 → 0.175 | 73.96 → 74.09 |
| bloated | [84.05, 66.98, 77.6] | [98.34, 62.24, 59.35] | 0.317 → 0.421 | 71.37 → 69.71 |
| screamer | [72.31, 82.56, 99.64] | [85.53, 81.68, 80.66] | 0.292 → 0.124 | 81.61 → 82.42 |
| armored | [44.87, 56.77, 71.32] | [57.45, 59.04, 61.32] | 0.385 → 0.145 | 55.29 → 58.86 |

Heavy body luma standard deviation relative to ordinary increases: brute 0.815→1.038, butcher 1.017→1.159, bloated 0.762→1.051, screamer 0.735→0.967, armored 1.218→1.233. This measures stronger surface-shading distinction. Silhouette areas remain unchanged; brute/butcher are larger, while bloated/screamer retain smaller silhouettes and rely on authored hue and shading. Mean RGB distance from ordinary falls for four classes as their shared blue cast disappears; no colour-distance improvement is claimed.

Authoritative data: `baseline-final.json`, `final-matrix.json`, and `draw-calls.json`. Earlier baseline/after/preset JSON files are intermediate diagnostics, superseded by these final matched datasets. Draw calls, shadow draw calls and triangle counts are identical before/after in all 24 rows.

## Captures opened

Raw images remain ignored in `test-results/s36-nightinf/`.

- Before WebGPU high zoom 1.5: `before-webgpu-high/s36-game-z1.5-webgpu/shot-0030.png`. Ordinary and screamer read cool blue-grey; butcher surfaces look lavender-grey.
- Final WebGPU high L8 zoo zoom 1.5: `final-webgpu-high/final-L8-zoo-z1.5-webgpu/shot-0030.png`. Brown hair, green ordinary clothing, warm brute/butcher skin, red bloated clothing and grey-green armored panels separate against the teal ground.
- Final L10 night: `grade-protected/s36-L10-night/shot-0030.png`. Warm body colours survive the cool asphalt grade; armored panels stay shaded.
- Opened the corrected mask: all six bodies present, no shadow quads.
- Opened final gate WebGPU high zoo-lineup and Mega sheets. Zoo coats and moonlit outlines remain legible; Mega retains its dark body and strong rim.

## Checks

- `npm run typecheck` and `npm run lint`: passed on final render source.
- `npx vitest run tests/shared/render-contracts.test.ts --maxWorkers=2 --configLoader runner`: 14/14 passed.
- `SCENE_PORT=4935 npm run scene:gate -- --filter 'night-boss-*,alpha-variants-close,inf-looks,inf-horde-headwear,ped-bitten' --jobs 1 --out test-results/s36-nightinf/gate`: 16/16, zero known, zero skipped, both backends/tiers.
- Final 24-row matrix and matched original 24-row matrix: all runtime checks passed, no console/clipping failures.
- No raw captures committed. Servers owned by Scene Lab stopped with their sessions. No check remains running.
