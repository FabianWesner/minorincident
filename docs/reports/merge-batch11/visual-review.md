# Game-camera visual review

Fresh integration build; headless Chromium with Metal. These are new captures from this branch, not inherited lane sheets. Catalog gates retain their original limits.

| Opened sheet | What is visible |
| --- | --- |
| [WebGPU night, high, zoom 0.5](focused-webgpu/night-bodies-eyes-night@high-z0.5/sheet.jpg) | Seven infected keep continuous torsos and limbs through the sampled motion. Small red eyes remain visible against the dark street. Clothing colors and the orange courier distinguish the figures. |
| [WebGPU night, low, zoom 0.5](focused-webgpu/night-bodies-eyes-night@low-z0.5/sheet.jpg) | All seven bodies remain complete with distinct clothing silhouettes at the lower geometry tier. No disconnected torso patches are visible. |
| [WebGPU seethrough, low, zoom 0.5](focused-webgpu/seethrough-apc-behind-building@low-z0.5/sheet.jpg) | The APC's hull, wheels, windscreen and lights stay readable through the fine dithered obstruction. The adjacent red sedan keeps its solid outline. |
| [WebGPU convoy, high, zoom 1](focused-webgpu/seethrough-scripted-convoy@high-z1/sheet.jpg) | The player bus remains whole along the moving route, through dithered facades and trees. Its light-colored roof and dark windows remain distinct. The pixel-reference gate nevertheless fails; see the red table. |
| [WebGPU crash, high, zoom 0.5](focused-webgpu/vfx-vehicle-crash@high-z0.5/sheet.jpg) | The red car chars and opens into a wreck, with a brief large orange fireball and flying panels. The frame does not turn completely white; the wreck remains recognizable. Flames and darker smoke settle afterward. Still sheets cannot establish animated heat-haze quality. |
| [WebGPU phone credits, low, zoom 0.5](credits-phone-webgpu/ui-menu-credits@low-z0.5/sheet.jpg) | At 390×844, the title and grouped credits fit within the panel. Text wraps without horizontal clipping; the Back button remains visible. The content continues within the scrollable region below the visible runtime-library heading. |

## WebGL2 parity review

Opened [crash high/zoom 0.5](focused-webgl2/vfx-vehicle-crash@high-z0.5/sheet.jpg) and [night high/zoom 1](focused-webgl2/night-bodies-eyes-night@high-z1/sheet.jpg). The crash keeps the same orange fireball, visible debris and recognizable charred body seen on WebGPU, without full-frame whiteout. At the wider night camera the seven infected remain separate, complete figures with the orange courier to their right; no torso holes are visible.

Both backend matrices complete at 156/158 passing cells. Every low-tier cell passes. The only integration failures are the two high-tier convoy references at zoom 1 and 1.5: WebGL2 407/3,200 outside pixels; WebGPU 412/3,204.

## Convoy diagnostic

The final frame at high/zoom 1 has 412 outside-disc changed screenshot pixels, located at x875–903/y0–27. A canvas-only comparison also differs outside the disc (549 pixels), excluding DOM updates as the sole cause. [Difference image](convoy-diagnostic/canvas-diff.png) uses green for changed pixels inside the disc and red outside. [Raw measurements](convoy-diagnostic/result.json).

Starting main `c31833b25`, with the exact same new convoy fixture copied into its catalog, also fails: WebGPU high/zoom 1.5 = 7,807 outside pixels; high/zoom 1 = 991; low/zoom 1.5 = 14. Integration reduces these to 3,204, 412 and 0. The zero-outside gate is preserved. This inherited failure is reported rather than fixed per job instructions.

## Final integration-fix recapture

The fold-preserving, surface-constrained simplifier and final low-tier ratio were rebuilt and recaptured. [Final WebGL2 matrix](final-webgl2/index.md) and [final WebGPU matrix](final-webgpu/index.md) both pass **18/18**: the two seven-model body/eye scenes and the new 100-infected fixture, both tiers, zoom 1.5/1/0.5.

Opened [WebGL2 low night/zoom 0.5](final-webgl2/night-bodies-eyes-night@low-z0.5/sheet.jpg), [WebGL2 low stress/zoom 0.5](final-webgl2/e18-infected-surface-lod@low-z0.5/sheet.jpg), [WebGPU low night/zoom 0.5](final-webgpu/night-bodies-eyes-night@low-z0.5/sheet.jpg), and [WebGPU low stress/zoom 1](final-webgpu/e18-infected-surface-lod@low-z1/sheet.jpg). The seven individually framed figures retain continuous torsos and limbs, varied clothing and small red eye cores. In the dense stress view the foreground figures remain complete and distinguishable, while crowd overlap and the close camera crop figures at the edges as expected. No disconnected clothing or limb patches are visible. The courier remains distinct in orange.

Opened [WebGL2 phone credits high/zoom 1](credits-phone-webgl2/ui-menu-credits@high-z1/sheet.jpg): it matches the WebGPU phone layout, with wrapped attribution text, readable group headings and a visible Back button.

## Low-tier VFX review

Opened [WebGPU crash low/zoom 0.5](focused-webgpu/vfx-vehicle-crash@low-z0.5/sheet.jpg) and [WebGL2 smoke column low/zoom 1](focused-webgl2/vfx-smoke-column@low-z1/sheet.jpg). The crash keeps a brief orange fireball, recognizable wreck and visible flying panels; no full-screen white flash appears. The smoke sequence becomes a dark rising plume above a localized flame pool. The warm ground underglow stays below the dark upper puffs. Low-tier heat haze is absent as designed.

## Completed full-gate matrix review

Reopened the final full-matrix [seethrough APC low/WebGPU/zoom 0.5](full-matrix/seethrough-apc-behind-building@low-z0.5/sheet.jpg), [night infected low/WebGPU/zoom 0.5](full-matrix/night-bodies-eyes-night@low-z0.5/sheet.jpg), [vehicle crash high/WebGPU/zoom 0.5](full-matrix/vfx-vehicle-crash@high-z0.5/sheet.jpg), and the [390×844 credits](credits-phone-webgpu/ui-menu-credits@low-z0.5/sheet.jpg). The APC keeps its hull, wheels and lights behind the thin dithered obstruction; the neighboring sedan remains solid. The seven infected keep continuous limbs and torsos, distinct clothing, small red eyes and an orange courier. The crash progresses from a red car through localized flames to a charred wreck, then a large orange fireball with flying panels; the surroundings remain visible. Phone credits wrap within the rounded panel and preserve a large visible Back button.

Opened the full-matrix [zoo high/zoom 1.5](full-matrix/wave3-zoo-routines@high-z1.5/sheet.jpg). Green-uniformed staff remain distinct from visitors, with attached bags/caps and complete figures. The two numeric clipping events are not obvious at contact-sheet scale.

Opened [APC/sedan contact low/zoom 0.5](full-matrix/apc-sedan-contact@low-z0.5/sheet.jpg). The red sedan stays recognizable through the dither while the solid APC passes it. The failed sample at frame 132 contains only seven reference pixels at the viewport edge; two are retained (28.57%, unchanged minimum 30%). Both vehicles leave the frame as the camera follows the APC. This visual observation does not override the failed gate.

The completed starting-main comparisons reproduce both zoo clipping reds (two events at high and low, zoom 1.5). Main also fails the identical APC retained-silhouette gate at all six tier/zoom cells, including 0% at low/zoom 0.5. All five full-matrix reds are inherited; none of their thresholds were changed.
