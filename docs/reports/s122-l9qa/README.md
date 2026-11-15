# s122 L9 bus pursuit and hatch fight browser QA

Status: **incomplete — browser QA blocked before the game opened**. Target source is batch 103, merge `2815e0d5`. No gameplay source or playtest driver was changed. No deployment, push, or main movement occurred.

## Current verdict

There is no observed gameplay verdict yet. I did not run the required real-input route, hatch defence, ending-at-trucks, or save-fix checks. No glitch severity or fun/tense/boring judgment is claimed. No contact sheet is included because no game frame was captured; an invented or unrelated sheet would misrepresent the requested visual review.

## Blocker and reproduction

The QA production build completed, but the browser pool could not start. Under the required wrapper, `tools/e2e-lock.sh` attempted to bring up the browser pool and its daemon failed to bind `127.0.0.1:4329` with `listen EPERM`. The wrapped preview command therefore never began listening on `4981`. A direct preview attempt on `4981` also returned `listen EPERM`. The pool log tail and command outcomes are recorded in [browser-qa.json](browser-qa.json).

The unchanged remote unit command also could not run: `sh tools/remote/run.sh "$PWD" -- npm test` exited 69 because no healthy provisioned Hetzner runner was available and `npm test` is not eligible for the Mac fallback.

## Checks completed

- `MI_BUILD_CACHE=off npm run build:qa`: pass.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `sh tools/remote/run.sh "$PWD" -- npm test`: not run; runner unavailable (exit 69).
- Browser pool, preview, and all requested gameplay passes: not run; local listener bind denied (`EPERM`).

## Open work

Resume when the browser pool can bind its loopback listener and the remote runner is healthy. Then seed an L9-default save, enter through the visible Continue flow, and run HIGH before LOW with zoom 1 and 1.5, WebGL2 and at least one WebGPU pass. Drive the authored road and an off-road shortcut by real input. Observe bus spawn/pacing/collisions, passenger disembarkation and hatch threat, smoke readability, and the truck ending. During L9 death/retry, change quality in settings and verify the game keeps running and Continue resumes. Capture and inspect a small contact sheet, then report glitches with P1/P2/P3 severities and a fun/tense/boring verdict.


## Resumed with unrestricted access

Browser and preview startup now work. HIGH/WebGL2 zoom 1 road pass entered through Continue from L9-default and ran 480 seconds by real input, with one logged map route assist. It reached the hatch, recorded 22 deaths and retry recovery, and did not finish. Driver flags and captures require visual review; no final severity or fun verdict yet. Raw evidence: `test-results/s122-high-road/`. Remaining matrix, save settings check, ending and contact sheet remain open.

LOW/WebGL2 zoom 1 road completed through actual L10 handover. Temporary driver correction sent real mouse fire at drawn boarders during the visible Engine stalled objective; the original driver suppressed all vehicle gunfire, explaining the earlier HIGH death loop. The driver was restored. Earlier deaths are not a valid difficulty estimate. Corrected HIGH and remaining matrix/save checks are still open.

## Contact sheet review

Personally inspected `contact-sheet.jpg` (six panels, 960×870): HIGH GL rail, LOW GL post-rail restart, HIGH GPU rail, HIGH GPU trucks, LOW GL trucks, and HIGH GPU L10 loading after handover. Rail APC/courier remain readable. LOW trucks shows a broad smoke plume and overlapping attackers obscuring the hull (known smoke P2 candidate). Last panel is a loading screen, not an ending cinematic. These stills do not prove continuous absence of bus popping, clipping, jitter, or passenger spawn defects.
