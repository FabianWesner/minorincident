# s137-screammove — interim evidence

## State

Implementation committed as `ef387646` (`Improve screamer warning readability`). This is not acceptance complete: no real-input frames could be captured or inspected in this sandbox, and HIGH/LOW, zoom 1/1.5, WebGL2/WebGPU visual coverage remains open.

## Changes

- `src/render/vfx/Vfx.ts`: source rings now last 0.8/0.9 seconds and use larger, brighter existing violet wave geometry. One transient CSS direction marker points toward an off-screen scream source for 1.1 seconds. It adds no draw calls.
- `tools/playtest/session.ts`: `--scream-captures` now records four screenshots at 4 fps after each scream event.

## Validation

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `MI_LOCAL_FALLBACK=1 npm test`: pass, 106 tests / 27 files (150/150 manifest cases).
- `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; no healthy remote runner. The documented local fallback was run and passed.
- `npm run playtest -- --levels L6 --quality high --zoom 1 --scream-captures ...`: blocked before browser launch; Node 26 `tsx` IPC listener returned `EPERM`.
- `tools/qa/s124-screamer-ground.ts`: blocked before browser launch; browser pool listeners on 127.0.0.1:4321/4329 returned `EPERM`.

## Open acceptance evidence

No before/after sequence or contact sheet exists yet. On-screen noticeability while moving, any off-screen direction cue in rendered gameplay, HIGH then LOW, zoom 1 and 1.5, WebGL2 and WebGPU, and the s124 visual regression result are unverified. The CSS marker is an implementation hypothesis pending those captures. Resume the bounded real-input run in an environment where `tsx` IPC and browser-pool listeners can bind; inspect the resulting frames before closing this report.

## Resumed validation

Browser access is operational. s124 now passes on WebGPU (violet pixel counts 0, 1621, 3340, 2060, 2142, 1990). Enlarged rings initially exceeded its 5000-pixel limit, so ring sizes and colours were restored while retaining longer duration. Typecheck and lint pass. Moving real-input acceptance remains open.

Required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed: 105 passed, one platform skip, 27 files, 126.9 seconds under the 240-second budget.

## Native moving capture matrix

`tools/playtest/s137-screammove.ts` uses physical KeyD input, a restored L10 checkpoint and an ordinary screamer spawned in chase state (encounter setup, no stat edits). It records 4 fps for ten seconds and observes native noise events. All eight HIGH-then-LOW, WebGL2/WebGPU, zoom 1/1.5 after runs produced two screams and confirmed their actual backend. A HIGH/WebGL2/zoom 1 before run restores the batch-110 VFX constants and omits the bearing.

Opened `sheet.jpg`: after rings remain conspicuous over consecutive moving frames; before is faint and shorter. This is partial evidence: zoom 1 sources sit near the upper edge. A clearly off-screen before/after sequence and full-size frame review remain required. JSON retains capture paths, tick, player movement, source projection and native events.
