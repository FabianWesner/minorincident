# Fire death review

HIGH WebGL2, zoom 1.5, six frames over two seconds: [contact sheet](ash-high.jpg). LOW used the same scene and ended at frame 125; [metrics](low-metrics.json). Both runs reported zero console errors and no clipping flags.

Visual review: the initial capture showed the full-colour corpse still drawn over the heap. Routing fire deaths away from the civilian renderer removed that duplicate. The remaining heap reads as a dark rectangular slab with pale bars rather than ash and bones, and the crumble is not convincing at this zoom. **Visual acceptance fails**; improve the heap and repeat both captures before sign-off. LOW shows the same slab. Scene setup is [scene.json](scene.json); it invokes the real fire damage path on an infected fixture.

Second capture: the heap is now rounded rather than rectangular, and the duplicate body remains absent. HIGH and LOW still show a smooth dark oval with barely visible bones at zoom 1.5; the crumble is not clearly readable. Visual acceptance remains open. Both reruns report zero console errors.

Latest capture: the linked sheet crops the original 1280×720 frames around the target without changing the 1.5 camera zoom; the final panel is LOW. The body now turns dark across its whole surface and two pale bones are visible on both tiers. The body visibly shrinks, but it does not yet break into convincing fragments and the heap still reads as a smooth dark oval. Visual acceptance remains open. Both runs reported zero console errors.

The latest sheet also removes the red blood pool previously emitted by fire damage. A brief ash puff was added, but is not clearly readable in these frames; the transition still appears to shrink and then switch to the heap, so visual acceptance remains open.

## Audio source investigation

The sprite now includes CC0 recordings for flame ignition, a [blowtorch-based flamethrower](https://freesound.org/people/SamsterBirdies/sounds/490166/) loop and tail, a pneumatic nail-gun shot, and a [flashbang detonation](https://freesound.org/people/areniporgen/sounds/693421/); provenance and hashes are in `assets/audio/imports.json`. Weapon-specific reload and impact cues are wired and listed in the design table. The builder can use hash-verified cached source files when an upstream archive is unavailable. The flame loop and stop still need listening review against the requested roaring hiss and sputter, and layered melee sounds need an audible distinctness audit.

## Preliminary L6 threat comparison

The merged L1–L10 threat audit reported four L6 early-close flags: two slow-follower observations and two breach waves without an attack within 20 seconds. The same L6 audit on current main and on an isolated branch copy with only MG suppression removed had no L6 flags. The early-close courier still lost 75 HP with suppression, so these flags do not establish that the entire level is harmless. The prescribed suppression remains enabled and infected stats are unchanged. [Comparison](l6-comparison.json); [merged summary](threat-summary.json). The L10 skilled route also reached its tick budget rather than completing, although that condition was not counted in the audit's four gate flags.

Rocket knockdown is not yet universal: existing arena-boss and Mega handling suppresses it, and the L7 escort rule exempts following civilians. These exceptions need implementation and validation against the requested blast behavior.

Remote `npm test` passed with 105 tests passing and one skipped after the gameplay and TTK changes. The subsequent contact-spread assertion passed in the focused combat test. Typecheck and lint passed; both HIGH and LOW capture runs had zero console errors.

Main was merged through `ef72dad9`, integrating the assault-rifle torch and fixed start racks. The post-merge L6 diagnostic still reports the same four L6 flags (plus the expected partial-level diagnostic marker). The separate `s191c-l6balance` lane also reports unresolved L6 pressure failures and has not supplied a passing L6 fix.
