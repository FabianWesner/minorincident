# s197 — see-through wall eligibility

## Change

`DistrictOcclusion.cutBlockers` previously added every nearby structural occluder (fences and walls) to the fade set before checking any camera-to-subject segment. That proximity-only exception caused wall spans behind or beside the courier to fade even when they did not cover her. Structural spans now use the same oriented placement slab intersection against the camera-to-subject rays as other occluders. A placement is selected only when the camera ray to the courier or subject box intersects it in front of the subject; the existing shader depth, screen disc, dither and timing remain in place.

Focused coverage in `tests/shared/render-contracts.test.ts` checks a foreground wall, a wall behind the courier, and a long span behind the courier.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- --run tests/shared/render-contracts.test.ts` — passed (14 tests).
- `sh tools/remote/run.sh "$PWD" -- npm test` — passed on unchanged rerun: 27 files, 105 passed, 1 skipped, 233.4 s. The first remote run exceeded the 240 s budget.
- `E2E_PORT=5151 SCENE_PORT=5152 npm run scene:gate -- --filter 'seethrough-*' --jobs 1` — passed all 3 rows.
- HIGH WebGL2 captures at zoom 1 and 1.5: L4 behind-building and an L3 house/corgi fixture passed their scene gates. Reviewed sheets: the courier is visible by the L4 facade, and the house fixture opens around the courier and corgi. An L1-lit house fixture also passed and was reviewed at both zooms: the courier and corgi remain visible through the opening. An L10-lit simple fence fixture passed and was reviewed at both zooms: the fence remains solid behind them. A scaled long fence behind the characters also passed at both zooms with zero cut pixels; its reviewed sheets show the whole visible span opaque. An attempted platform fixture put the characters below the deck and did not show the wall, so the actual L10 platform or an equivalent platform and panel fixture remains open. These are not production level captures.

## PO screenshot review

Opened the supplied L10 screenshot. It shows the courier and corgi unobstructed on the tiled platform with a railing; the tall fence/wall panels to their right and behind are dithered despite not covering either character. This matches the unconditional structural-occluder admission removed by the fix.

## Commits

- `1a6a57c9` — `Fix see-through wall eligibility` (implementation and focused test).
- `6639d457` — initial report; subsequent report update records the remote rerun and captures.
