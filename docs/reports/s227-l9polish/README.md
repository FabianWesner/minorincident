# s227 L9 polish

[Reviewed frames](frames.jpg) were captured at HIGH WebGL2 and game zoom 1, 1280 × 720, headless on the native L9 mission. The complete driver ran from the start without player relocation or invulnerability; it reached the stall, impact, crawl, get-up and stand. The road image is a separate run with that driver configured to follow the authored asphalt points instead of its usual off-road detour. The impact camera is scripted by the mission. The sheet is a downscaled copy of the original captures.

- **Road:** the asphalt changes direction gently at the photographed bend. The change is subtle at this zoom; the other long routes have shallow bends as well. The full route was not visually swept at every bend.
- **Crossing:** the rail-stall frame shows the rails and plank deck at the road surface, with the masts at its sides. The old independent railway that crossed over the kit was removed. The APC stops on the approach side of the crossing.
- **Crash:** the same APC lands on the far shoulder and burns beside the courier; the infected school bus is hidden when the crash starts. The image is dark and the fire masks part of the vehicle, but its APC silhouette and wheels are visible. The shoulder placement replaces the previous wreck position inside the far bank, which was hidden from the camera.
- **Crawl and stand:** the former shared get-up started face up. The L9-specific mirrored rise now follows the face-down crawl, with leg and mesh ground corrections. [Selected native frames](stand-up.jpg) show the transition at HIGH then LOW, zoom 1 and 1.5. The original `frames.jpg` preserves the earlier defective capture.

Four headless WebGL2 runs drove the native L9 mission from its start using the completion bot, with no player relocation or invulnerability. Each captured every fixed tick from the crawl into standing (413–427 frames per run). The figure remains face down across the switch and rises without an observed back flip or pop. The selected axe attachment was invisible throughout the crawl and rise, leaving her hands empty. After the sequence completed, a movement input moved her 3.13 m in 45 ticks in each run. The LOW zoom 1.5 run was repeated with the presentation clock advanced during paused stepping; without it, a prior hit-stop remained frozen in the capture harness.

A separate controlled flat-ground fixture measured the visible skinned body bounds at or above y = 0.0199 m through 100 consecutive ticks spanning the switch and rise, against a y = 0 plane. This does not cover every ground surface. The courier animation evaluation measured up to 3.3 ms during the native captured sequences; these paused-step runs are not a gameplay frame-rate benchmark.

## Verification and limits

On code commit `4f08dc0d`:

- `npm run typecheck` and `npm run lint` passed. The remote `npm test` passed 27 files: 105 tests passed and one skipped (202.3 s of the 240 s budget). Earlier runs on a busy runner timed out and were rerun unchanged.
- Both threat shards and their merge passed with **zero flags**; L9 skilled and passive both completed.
- `qa:vehicle-campaign-motion` passed all eight high/low L9, L7 and L4 cases. The solid-placement audit reported **zero remaining offenders**. The nightly mission-interactions test passed.
- Remote `npm run verify -- E31` passed typecheck, lint and the unit suite. Per the tool, this is the per-change gate; retired epic-tag tests are not part of that command.

For the final code commit `273e5e9b`, `npm run typecheck` and `npm run lint` passed, and remote `npm test` passed 27 files with 105 tests passed and one skipped in 198.6 s.

For s226b, seed-1 fixed-step drives checked the APC full-height hull against resident fixed or braced pushable props each driving tick on all three primary routes and detours. No fixed or braced pushable props were resident and no overlap was observed. All three detours and the asphalt primary completed normally; the ordinary driver died on the other two primaries. A rerun with courier invulnerability completed the countryside primary, and a run restoring the courier's health each tick completed the shortcut primary. These protected runs check geometry, not combat balance. [The counts and outcomes](prop-route-audit.json) do not cover static district colliders or every possible driver path.

The local worktree contained an unrelated pre-existing modification to `src/data/physicsAssets.ts` during these checks. It was not included in the commits; it changes a courier motorbike entry and a zoo tunnel hash, not the L9 APC or crossing.

The curve screenshot is a single near-bend frame, not a complete visual sweep. The APC fire is visually bright and partly hides the wreck. WebGPU and human driving remain outside this headless WebGL2 review.

