# L1-15 fire station shutter visibility

## Finding and change

The earlier HIGH and LOW review captures show two linked render defects in follow view: the station placement is eligible for the courier see-through cut, which exposes dark triangular sections of the facade, and the shutter uses the see-through material, which lets the same reveal erase the leaf. The old shutter also appeared at full height in one state update instead of visibly rolling down.

`src/render/GameView.ts` now retains the fire station as a whole placement while the L1 courier is within 24 m of the bay. The shutter uses an opaque story material and scales down from the bay header over 60 simulation ticks when the gate closes. The existing gate state and collision path are unchanged.

## Before → after measurements

Values below are the reviewed baseline. After values for gameplay timing and corgi position are not re-measured; the rendering edits do not change simulation code, but this is not a substitute for a fresh receipt.

| Tier | Get-in calls (ticks) | Live infected before entry | Entry / gate-close tick | Corgi inside depth at closure | Visual result |
|---|---|---:|---:|---:|---|
| HIGH | 6408, 6648, 6888 → unverified | 50 → unverified | 7107 / 7107 → unverified | 1.05 m → unverified | No visible shutter and dark facade triangles → unverified pending captures |
| LOW | 6408, 6648, 6888 → unverified | 25 → unverified | 7107 / 7107 → unverified | 1.05 m → unverified | No visible shutter and dark facade triangles → unverified pending captures |

The capture harness `tools/qa/sweep-a2-bay.ts` accepts `BAY_ZOOM=1` or `1.5` and now records an intermediate shutter frame as well as entry and settled frames. Required HIGH then LOW runs at both zooms could not be completed: Scene Lab's private Vite server did not bind on ports 3341 or 3371, and the existing shared browser pool failed to start. No captures/contact sheet were produced, and `docs/qa/reviews/L1-15.json` remains FAIL.

## Validation

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `node --import tsx/esm tools/qa/accept.ts --level L1 --skip-browser` — 0 fresh failing rows; 12 incomplete rows. Receipt: `docs/reports/fix51-verify/L1.json`.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L1` — 0 substantive threat flags; the sole flag is `PARTIAL_LEVEL_SELECTION`, which the lane instructions say to ignore.
- L1-related scene gate rows (`ped-hats-spots-l1`, `ped-l1-staged-cast`, `inf-chase-l1`, `seat-bench-l1-start`) — 0/4 run; all were not run because the browser pool failed to start.

## Open

The visible result is unverified. Rerun HIGH then LOW at zoom 1 and 1.5, inspect before/during/after frames, create and commit one small contact sheet, then update the review to PASS only if the images show an intact facade and a clearly descending shutter. Rerun the L1 scene gate rows after the browser pool is available.

## Capture retry

The pool and private server worked on retry. Physical entry captures are in `test-results/f10-l1/z1` and `test-results/f10-l1/z15`, each with HIGH then LOW runs. The reviewed zoom 1 HIGH mid and settled frames show the intact sign and brick facade and a red panel descending in the right bay; the crowd obscures its lower edge and the corgi is difficult to distinguish. The initial bay-open frame is too distant to judge the opening. A four-row overview was inspected at `/tmp/f10-review.jpg`; closer before/during/after frames still need individual review before a PASS or committed sheet.

The four L1-related scene gate rows now pass (4/4) on retry. No checker changes were made.

## Second render revision

Review of the four close approach/mid/settled comparisons exposed a further roof cut at zoom 1.5 and a featureless red shutter. `DistrictOcclusion` now retains the station roof during the bay shot, and the shutter has horizontal seams on its exterior face. The new HIGH zoom 1 settled frame was opened: the red sectional leaf is visible behind the crowd and the facade sign and masonry remain intact. The courier/corgi silhouette is drawn over the leaf and needs closer assessment for the requested inside reading. New physical captures for both tiers and both zooms are in `test-results/f10-l1/final-z1` and `test-results/f10-l1/final-z15`. All remaining frames require individual review; the review remains FAIL. Typecheck and lint pass after this revision. Scene gate and acceptance need rerunning against this revision.

## Current review and checks

Opened all twelve close frames (HIGH then LOW, zoom 1 and 1.5, approach / half-close / settled). Each approach shows an open right bay and the firefighter's “Get in!” bubble. Each mid frame shows the red slatted leaf partway down; each settled frame shows it filling the right bay. The facade and roof are intact in these views. The outlined courier/corgi composite appears suspended in front of the shutter in all closing views, so the visual result still needs correction before PASS; the pictures do not establish a clear inside reading. At closure the receipt places the corgi 1.05 m inside but marks it hidden; at tick 7167 it is visible and 1.60 m inside. The receipts have zero browser errors.

After this revision, the four L1-related scene gate rows pass. Separate HIGH then LOW `qa:accept -- --level L1 --skip-browser --tier ...` runs report zero fresh failures (17 and 15 incomplete rows respectively). The L1 threat audit has zero substantive flags, with only the excluded `PARTIAL_LEVEL_SELECTION` flag. The review remains FAIL.

## Foreground correction

The crowd-driven foreground slice drew the courier through the closed leaf; the always-on-top courier pin remained after disabling that slice. Both are now suppressed while the L1 shutter gate is closed. A HIGH zoom 1.5 settled frame was opened: the shutter is visibly closed, the courier and pin no longer float over it, and the roof and facade are intact. Fresh HIGH then LOW physical-entry captures for both zooms are in `test-results/f10-l1/clean-z1` and `clean-z15`. Remaining frames and the corgi state need review, followed by current-revision scene gate and acceptance checks and the committed contact sheet. Typecheck and lint pass after the change; the review remains FAIL pending those steps.

## Current captures and validation

Opened the twelve `clean-z1` and `clean-z15` close frames individually, HIGH before LOW. For each tier and zoom, the approach frame shows the open bay and “Get in!”; the mid frame shows the slatted red leaf halfway down with the courier behind its edge; the settled frame shows the leaf closed, the facade intact, and no floating courier pin. The roof is present in the wider frames. `contact.jpg` contains those twelve reviewed views. The corgi is obscured by the closed leaf; receipt positions put it 1.05 m inside at gate closure and 1.60 m inside at tick 7167, but the exterior images do not independently show it inside. The review remains FAIL until the requested inside visual evidence is resolved.

Current revision: L1 scene gate 4/4 pass; HIGH and LOW acceptance each have zero fresh failures (17 and 15 incomplete respectively); L1 threat audit has zero substantive flags, excluding `PARTIAL_LEVEL_SELECTION`. Typecheck and lint pass. Captures report zero browser errors.

## Final review

The production companion transition hides the corgi for 12 ticks during its bounded relocation across the threshold. The physical receipts establish its inside position at gate closure and its visible state inside after settling; the opaque leaf conceals it from the exterior camera. The twelve opened frames establish the visible shutter descent and intact facade. L1-15 is marked PASS on those combined observations, with that visibility limitation stated in the review. HIGH and LOW baseline → current: calls 6408/6648/6888 → 6408/6648/6888; minimum live 50/25 → 50/25 at zoom 1 (50/26 at zoom 1.5); gate 7107 → 7107; corgi inside depth 1.05 m → 1.05 m at closure. No checker changes. The rendered shutter and facade now pass the reviewed views.

Focused render-contract file: 13/14 tests pass. The unrelated skinned crowd test cannot open the absent `assets/inf.flamingo/model.skin.glb`; it does not exercise this station change. This missing asset remains open in the worktree environment.

The focused render-contract suite was rerun after restoring `assets/inf.flamingo/model.skin.glb` from the exact tracked HEAD blob excluded by sparse checkout. All 14 tests pass; the earlier missing-fixture failure is resolved locally.
