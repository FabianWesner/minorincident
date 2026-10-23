# l9-night-look: the L9 night drive (Opus, 2026-10-23)

QA 13j, verbatim: "L9 4: no glitches, but the night drive is an empty black void around the APC."

## What the frame actually is
The follow camera (radius 21.85 m × 1.15 while driving, fov 25°) frames only about 17 × 10 m at zoom 1 and 26 × 15 m at zoom 1.5.
That is the lane plus 3 to 6 m of verge. The look-l9 and look-l9b fires (8 to 14 m off the lane, one every ~90 m) were almost never
in frame. The E31-AC16 contrast rule keeps the verge band dark, so the void is the lane and the verge beside it.

## Changes (render only, no layout, collider or sim change)
- `NightAccents.ts`:
  - The flare and lantern line along every route is denser: one every ~16 m (was ~43 m on asphalt, ~25 m on gravel). The emitters are brighter and the pools wider (5 / 5.5 m).
  - New small debris fires on the near verge, 1.4 to 2.6 m past the lane edge, one every ~19 m, alternating sides.
  - Flares and debris fires now cover the last stretch too: barricades, crash deck and the crawl to the city. Before, nothing was placed past x 440.
  - Burning wreckage on the far deck, beside the crawl line and never on it.
  - Totals: 217+ fires (was 55) and 199 pooled points (was 107). Every light uses the existing light-field pools and Blasts flame cards, so no new shader graph is added.
- `timeOfDay.ts` L9-crossing:
  - Moon .38 → .6.
  - Grade contrast 1.34 → 1.12 and amount .75 → .55, so the verges are no longer crushed to black.
  - Bloom .3 → .5, so flares and fires get a halo.
  - Ground breakup .22 → .4 and city glow .25 → .4.
  - Cloud shadows were tried and removed: clouds stay day-only (atmosphere rule).
- `Blasts.ts`: debris fires (life, radius < 1 m) trail small, sparse puffs and skip embers on low.
- Capture tools: `tools/qa/l9-night-capture.ts`, `l9-night-round.sh`, `l9-night-all.sh`, `l9-night-sheet.py`, `l9-night-ba.py` and `l9-light-coverage.ts`.
  - The capture tools take real-game L9 captures (start, mid road, mid dry, approach, crash, arrival × zooms) against PROD or a local build.
  - The capture advances render time with the sim. Without that, persistent fires never appear in stepped captures. Older stepped captures may have missed them too.

## Sheets (PROD | after per zoom 0.5 / 1 / 1.5)
`ba-webgpu-low.jpg` (the PO's setting), `ba-webgpu-high.jpg`, `ba-webgl2-low.jpg`, `ba-webgl2-high.jpg`.

## Honest score
- Before (PROD): 4/10.
  - Driving frames show the lane, the headlight cone and one dim flare stub.
  - The dry and approach verges are near black, and no fire is ever in frame while driving.
  - The crash and arrival are a flat grey deck with one burning wreck.
- After: about 5/10.
  - Most zoom-1.5 frames now hold a warm debris fire with a smoke wisp and a red or amber flare with a bloom halo.
  - The verges read as dark ground, not black.
  - The crash deck and arrival have flames along the railing.
  - Zoom 1 still shows mostly lane, because the camera only sees ~10 m across.
- Not stunning yet. What is missing:
  - Props or silhouettes inside the 6 m verge band. That is layout work, and the D-CROSSING dress rules forbid it near routes and the crash approach.
  - A wider driving camera, so the landscape enters the frame.
  - A lane surface with more detail on the dry track.

## Perf (tests/perf/l9-dress.spec.ts, quiet-run, WebGPU, 200/100 infected, same Mac, main build vs final)
- High: frame p95 median 3.5 -> 3.8 ms, max 4.5 -> 4.9 ms (budget 16.7); draws +0..5; tris +1..9k; heap 265.8 -> 265.8 MB.
- Low (4x CPU, 390x844): median 11.8 -> 11.9 ms, max 17.2 -> 14.9 ms; heap 252.3 -> 252.5 MB. Both builds measure the same 7 of 15
  rows (the rest time out: the known E31-AC19 low red), and both fail the spec the same way (pre-existing reds, not worsened).
- No new shader graph: every new light is a light-field pool or a Blasts flame card/glow instance.

## Gates
- AC16 Scene Lab, WebGPU, high+low x z0.5/1/1.5 (`night-read-l9*`, `l9-look-*`): 30/30 pass. Route median min, main -> after:
  apc 3.00-3.19 -> 3.00-3.14, road 2.66-3.00 -> 2.75-3.00, crawl 2.64-2.69 -> 2.56-2.82 (gate 2.5); courier 18.6-19.6 -> 13.3-14.7.
- `npm run qa:invariants`: remote sim 27/27, Mac WebGPU low render 11/11 (L9 level click -> playable vs PROD passes).
- `npm run test:smoke`: Vitest 6/6, Playwright 31/31.
