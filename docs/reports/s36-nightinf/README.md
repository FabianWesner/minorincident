# s36-nightinf — measurement pending

## Cause and render change

The shared infected figure fill used the night preset's blue `rimColor` at full strength. This fill is distinct from the silhouette rim: reducing or recoloring it can preserve the approved rim while restoring the infected surface's own palette. `PaletteMaterial` now has a neutral-fill selector. Infected atlas materials select neutral fill; ordinary infected use a restrained 0.25 fill, while the five requested heavy asset classes use 0.55 to retain more surface shading. Alpha and zoo boss fill values and every rim value remain as before. No simulation, infected stats, AI, animation, geometry, or draw-call path was changed.

Scene Lab's per-actor flat-silhouette sample now also records mean RGB, normalized saturation, mean luma, and the share of pixels for which B exceeds both R and G by more than 10%. These fields are intended for the required identical before/after matrix.

## Before/after measurements

Not measured yet. The first capture attempt (`SCENE_PORT=4935 npm run scene -- /tmp/s36-night-lineup-z1.json --backend webgl2 --tier high`) failed before Chromium launched: the browser pool control server returned `listen EPERM` on `127.0.0.1:4329`. There is no valid before or after capture, so no numeric comparison is claimed here.

| Capture matrix | Before | After |
|---|---:|---:|
| Night, ordinary + brute/butcher/bloated/screamer/armored, low/high, zoom 1/1.5, WebGL2/WebGPU | pending | pending |
| L8 night zoo, L4 dusk/night, L10 night scene checks | pending | pending |
| Heavy-to-ordinary silhouette and colour contrast | pending | pending |

## Captures opened

None. The Scene Lab run failed before producing an image. The lineup specs used for the attempted fixture are temporary files under `/tmp`; no raw capture is in the repository.

## Checks

- `npm run typecheck` — passed.
- `npm run lint` — passed (the full command completed in the first check run); targeted ESLint on the three changed files also passed.
- `git diff --check` — passed.
- Scene Lab — blocked before browser start by the sandbox's `listen EPERM` on the browser pool's local control port.

This report is intentionally incomplete. The goal remains open until the full matrix has valid before/after measurements, captures have been opened and described, the visual goals are confirmed, and the final report is updated.

## Resumed verification (unrestricted environment)

The permission restrictions are lifted. Slim-worktree now succeeds. The first Scene Lab run exposed an invalid fixture framing (ordinary outside the viewport); after widening to radius 28 and capturing frame 30, the WebGL2 high lineup passed with no console errors or clipping failures. Opened `test-results/s36-nightinf/webgl2-high-z1-fit/shot-0030.png`: all six figures are visible; brute and butcher are clearly larger, while bloated and screamer remain close to ordinary height. Ordinary still reads cool green/blue. This is not a completed visual fix.

The current added RGB/saturation probe samples the entire projected bounding rectangle, including the blue ground. Its ordinary mean RGB is 41.84/43.25/61.95, saturation 0.3841, luma 44.30, and blue-dominant share 0.8907. These are diagnostic crop numbers, **not figure-pixel acceptance evidence**. A true figure mask is required before drawing conclusions from this probe. The full before/after matrix remains pending.

## Figure-only probe and hue experiment

The flat-silhouette probe now intersects its projected bounds with Scene Lab's existing crowd geometry mask, removing ground pixels. In the same WebGL2 high frame, the prototype neutral fill gave ordinary mean RGB 30.54/27.32/50.29 with 100% blue-dominant figure pixels. A subsequent body hue restoration experiment (excluding the grazing Fresnel rim) changed brute mean RGB from 63.01/55.57/62.62 to 64.68/55.00/57.84, butcher from 75.49/67.82/75.94 to 77.30/67.69/70.79, and armored from 53.95/53.86/64.86 to 54.22/53.79/61.43. Ordinary was unchanged, showing that its material path still needs investigation. Opened the experiment capture `test-results/s36-nightinf/masked-hue/shot-0030.png`: heavies retain more warm skin colour, but the small ordinary at the right remains cool. Both fixture runs passed with zero console errors and zero clipping failures. This experiment does not satisfy acceptance yet.

## Ordinary-path follow-up

Enabled the neutral selector on the civilian material path (gated by its infection node, so healthy civilians retain their original tint), and extended the crowd selector to non-atlas humanoids while excluding regular Alphas. Repeated WebGL2 high captures passed, and opened `all-human-hue/shot-0030.png`: ordinary hair now appears brown, though the reported body mean remains 30.60/27.33/50.16. This discrepancy needs investigation before using the mask statistics as acceptance evidence. Typecheck passed during this follow-up; the final selector edit still needs its checks. No capture/check process remains running.

## Mask audit — previous figure statistics invalid

Opened the exported geometry mask (`SCENE_MASK_OUT=/tmp/s36-mask.png`) from a passing diagnostic run. It includes magenta contact-shadow quads under every actor, and the ordinary actor's body is missing entirely. Therefore the earlier supposedly figure-only ordinary numbers were predominantly ground sampled through a shadow quad, and the heavy numbers are contaminated too. They must not be used as acceptance evidence. The next measurement change must exclude contact shadows and cover the ordinary NPC body path. Canvas readback now uses the same canvas dimensions as the mask and asserts equality. Typecheck and targeted lint passed before adding the optional mask export; no processes remain running.

## Corrected geometry mask

The QA ID pass now excludes non-body CrowdView meshes via `_parts`, and includes infected civilian instances via their existing `_overlay.y` infection value. Opened `/tmp/s36-mask-fixed.png`: all six complete silhouettes are present, with no contact-shadow quads. The passing WebGL2 high fixture now reports true figure mean RGB: ordinary 71.03/63.10/61.11; brute 73.39/61.82/59.36; butcher 87.52/76.37/75.00; bloated 100.39/68.72/64.14; screamer 89.04/78.77/78.60; armored 59.05/59.78/62.77. No class's mean is blue-dominant by the requested 10% threshold in this row. This is after-only evidence; the full baseline/matrix remains required. Typecheck and targeted ESLint passed after the mask correction.
