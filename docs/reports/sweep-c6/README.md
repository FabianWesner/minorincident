# sweep-c6 — follow-up acceptance rows

Base: `0991b9da04a4ef65e1d0e5d889776c32b461a6ae`. Work list: `docs/reports/sweep-c5/README.md`, excluding L7-09 per lane ownership. The in-scope set is eight unchecked rows and two L10 measured failures.

## Results

| Row | Result | Evidence / remaining work |
|---|---|---|
| L10-11 | PASS, fixed and reviewed | Hidden far final-approach pursuit speed is tiered at 1.15× low / 1.35× high. Fresh 240 s holds measure arena arrival at 150.45 s / 132.45 s, with capped peaks, 100% bounded-path reachability, sufficient player attacks, one persistent Mega ID and no scheduled relocation. Full L10 group acceptance rerun passed this row at both tiers and policies. Commits: `8ebb570` (game change), `cd87b95` (review and receipts), `a93664e` (refresh review hash after acceptance status report regeneration). |
| L10-03 | Measured FAIL retained | Current-source same-tick local census has no required species/count witness for low industrial, low campus, high industrial or high destroyed corridor. Other regions/tier combinations have witnesses and no upper-bound violations. Spawn experiments made the low complete route time out, so no safe single game fix was clear. Current evidence: `docs/reports/sweep-c5/L10-03/simultaneous-census.json`; review and current-source census are committed in `dae0fe5`. |
| L7-01 | NOT CHECKED | Requires quiet-window real pickup/first-shot frame gate. |
| L7-06 | NOT CHECKED | Requires physical exploration of both corridor routes and wrong-way edges, plus reviewed route-clarity captures. |
| L7-11 | NOT CHECKED | Prior L7-08 frames exist, but the dedicated complete uninterrupted 6–10 s cinematic receipt/consumer was not produced in this lane. |
| L7-12 | NOT CHECKED | Requires progressed-save physical input at low/high and zoom 0.5/1.5, with destruction/Alpha/player contrast review. |
| L8-11 | NOT CHECKED | Requires progressed-save physical input at low/high and zoom 0.5/1.5, sanctuary/battle captures and Opus quality pass. |
| L10-08 | NOT CHECKED | Requires road framing/camera and night readability captures at required zooms. |
| L10-12 | NOT CHECKED | Native HP threshold fixtures pass; real-input motion/death captures, frame probe and visual corpse review remain. |
| L10-14 | NOT CHECKED | Native cure measurements pass; complete physical epilogue, mist/event ledger, camera/title/credits review remain. |

L7-09 is owned by lane fix70-s and was not touched. L10-03 remains a recorded measured failure rather than an unchecked row; L10-11 is current PASS. Thus two of the ten in-scope rows are resolved, with eight visual/physical-input rows open.

## Validation

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS.
- `npm test -- --maxWorkers=4` — FAIL: 106/107 tests pass. Existing architecture test `tests/shared/architecture.test.ts` rejects `src/sim/progression/Save.ts` importing `three/addons/libs/fflate.module.js`; that import predates this lane (last source commit `7bd7cdf`).
- Full L10 `qa:accept` low/high, both policies — initial tuning rerun passed L10-11. The final status refresh rechecked all four policy receipts, fixtures and checkpoints and refreshed the acceptance tracker: L10-11 is current PASS, L10-03 is a fresh current FAIL, with remaining L10 criteria incomplete. The CLI exits 1 for those open rows. L10-03 current-source simultaneous census rerun completed, showing the failure above.
- `npm run qa:threat` — PASS, 474.9 s, zero flags. The complete final gates are not all green: the unit suite has the architecture failure above, and eight physical-input/review rows remain open.

Per-row commits: L10-11 and L10-03 evidence/review commits are present. Other open rows have no completed evidence to commit.
