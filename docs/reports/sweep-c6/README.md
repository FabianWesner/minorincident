# sweep-c6 — follow-up acceptance rows

Base: `0991b9da04a4ef65e1d0e5d889776c32b461a6ae`. Work list: `docs/reports/sweep-c5/README.md`, excluding L7-09 per lane ownership. The in-scope set is eight unchecked rows and two L10 measured failures.

## Results

| Row | Result | Evidence / remaining work |
|---|---|---|
| L10-11 | PASS, fixed and reviewed | Hidden far final-approach pursuit speed is tiered at 1.15× low / 1.35× high. Fresh 240 s holds measure arena arrival at 150.45 s / 132.45 s, with capped peaks, 100% bounded-path reachability, sufficient player attacks, one persistent Mega ID and no scheduled relocation. Full L10 group acceptance rerun passed this row at both tiers and policies. Commits: `8ebb570` (game change), `cd87b95` (review and receipts), `a93664e` and `c41791c` (immutable aggregate evidence), plus `b5740b5` (refreshed L10 tracker and retained prior receipts). |
| L10-03 | Measured FAIL retained | Current-source same-tick local census has no required species/count witness for low industrial, low campus, high industrial or high destroyed corridor. Other regions/tier combinations have witnesses and no upper-bound violations. Spawn experiments made the low complete route time out, so no safe single game fix was clear. Current evidence: `docs/reports/sweep-c5/L10-03/simultaneous-census.json`; review and current-source census are committed in `dae0fe5`. |
| L7-01 | NOT CHECKED | Requires quiet-window real pickup/first-shot frame gate. |
| L7-06 | PASS, qualified | Both physical Harbor/alley and Lakeshore routes at both tiers; screenshot-only wrong-turn recovery reaches corridor;106qualification frames reviewed; current Rapier perimeter sweep129walk/95drive per tier,0escapes;23semantic controls reject. |
| L7-11 | PASS, qualified | Fresh low/high physical runs from progressed L5/L6 saves:540consecutive departure ticks/9s, same live bus moves118.5m, original1/4humans boarded. All48frames personally reviewed: shrinking burning skyline, lit military truck/tower, red blood and no map edge. Dedicated consumer rejects20semantic faults. Native cinematic overrides userzoom; some bus cropping is explicit. |
| L7-12 | current PASS; P taste | Fresh physical low/high and actual zoom0.5/1.5;28lossless same-tick courier-ID/ring cells span rocket, live Alpha/horde and bright city-fire motion. Minimum contrast3.879:1 with stricter .05 offset. All84frames reviewed;27faults reject and inclusive3.0passes. P sheets retained for worst-destruction/Alpha-human judgment; no PO taste approval claimed. |
| L8-11 | NOT CHECKED | Requires progressed-save physical input at low/high and zoom 0.5/1.5, sanctuary/battle captures and Opus quality pass. |
| L10-08 | NOT CHECKED | Requires road framing/camera and night readability captures at required zooms. |
| L10-12 | NOT CHECKED | Native HP threshold fixtures pass; real-input motion/death captures, frame probe and visual corpse review remain. |
| L10-14 | NOT CHECKED | Native cure measurements pass; complete physical epilogue, mist/event ledger, camera/title/credits review remain. |

L7-09 is owned by lane fix70-s and was not touched. L10-03 remains a recorded measured failure rather than an unchecked row; L10-11 is current PASS. L7-11 and L7-12 are also qualified current PASS, with the explicit L7-12 taste question tagged P. Five of the ten in-scope rows have current decisions, with five unchecked rows open.

## Validation

- `npx tsc --noEmit` — PASS, repeated after the dedicated L7 consumers.
- `npm run lint` — PASS, repeated after the L7 tools.
- `npm test -- --maxWorkers=4` — FAIL: 106/107 tests pass. Existing architecture test `tests/shared/architecture.test.ts` rejects `src/sim/progression/Save.ts` importing `three/addons/libs/fflate.module.js`; that import predates this lane (last source commit `7bd7cdf`).
- Full L10 `qa:accept` low/high, both policies — initial tuning rerun passed L10-11. The final status refresh rechecked all four policy receipts, fixtures and checkpoints and refreshed the acceptance tracker: L10-11 is current PASS, L10-03 is a fresh current FAIL, with remaining L10 criteria incomplete. The CLI exits 1 for those open rows. L10-03 current-source simultaneous census rerun completed, showing the failure above.
- `npm run qa:threat` — PASS, 474.9 s, zero flags. The complete final gates are not all green: the unit suite has the architecture failure above, and five physical-input/review rows remain open.

Per-row commits: L10-11 and L10-03 evidence/review commits are present; L7-11 and L7-12 qualifications are recorded in their dedicated row directories and reviews. Other open rows have no completed evidence to commit.

Latest L7 follow-up: complete current native/fixture/checkpoint rerun and cached refresh qualify L7-11/L7-12 PASS with zero fixture/checkpoint errors. The CLI exits1 for L7-09 (owned by fix70-s); six rows are incomplete: the two original in-scope L7 rows01/06 plus four previous browser qualifications02/03/07/08 whose global source hash is stale after the L10-only game change. Old/new L7 native states and observations match exactly at both tiers/policies; diagnostic proof is retained in L7-11. These prior rows were not silently requalified from limited control evidence.

L7-12 P: inspect `test-results/sweep-c6/L7-12/po-low.jpg` and `po-high.jpg` for whether the night convoy/fire scenes read as the worst destruction so far and whether enlarged Alpha bodies still read human. Quantitative player contrast is current PASS; taste remains an explicit PO question.
