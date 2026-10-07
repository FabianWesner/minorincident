# E21 — L3 content lane report

Branch: `lane/l3-content`. E21 status stays `in-progress` for the orchestrator's final vision review. Main's vehicle/combat handling was merged in `39bdd545`; the results below use that handling.

## Built

- L3-only four-district road loop, cleared turning lanes, native parking/exit points and pedestrian routing around the empty sedan. Other levels' composition entries and base district layouts are unchanged.
- Fuel-station evacuation defense, actual sedan tutorial (runovers and cone destruction), announced route choice, supermarket Riot bypass/pharmacy supplies or park Sprinter/shelter rescue, evacuation loading defenses, overrun checkpoint with a native heavy wall and Bloated/propane destruction, hospital patient escort through the gate.
- Continuous authored combat rather than idle padding: seven two-infected forecourt waves, 18 route-defense waves, 24 checkpoint-defense waves, finite native medkits, mixed Sprinter/Riot/Bloated opponents. Defense completion requires all authored infected dead and the player inside the area.
- W2 emergency props/blood trails, registered `kit.evac-camp` and `npc.paramedic`, turned patients inside the perimeter, failed Civic emissives, closed gate, and the existing Continue handover to L4. Production HUD exposes the global 12:00 deadline.
- Shared browser/Node bot using ordinary input; newbie samples controls every 250 ms. Both native browser routes run at time scale 2. All nine acceptance criteria have matching tags; four photo spots per route, W0/W2 comparisons and a portrait phone capture are supplied.

Principal commits: `803e7c31`, `b09b1486`, `84b64e0d` (routes/content/rendering); `4aa09c10`, `8dc44426` (acceptance/navigation tests); `39979820`, `ab32f754`, `bf951f87` (parking/escort routing); `39bdd545` (main handling merge); `65651dbd`, `5693443f` (deadline HUD/route announcement); `91f590c2`, `f6c6291f`, `82396963` (deadline fixture, phone view, campaign-loading wait); `2098dca6`, `7a6083ad` (calibration report and vision evidence).

## Calibration on merged handling

Raw evidence: `bots.json`, 20 seeds per policy/route, 60 runs total.

| Policy / forced route | Completed | Median duration | Max deaths | Median deadline left |
| --- | --- | --- | --- | --- |
| Complete / supermarket | 20/20 | 312.09 s | 0 | 407.91 s |
| Complete / park | 20/20 | 295.85 s | 0 | 424.15 s |
| Newbie / alternating routes | 20/20 | **355.93 s (5:55.93)** | **0** | **364.07 s (6:04.07)** |

Complete route median difference: **5.49%** (limit 30%). Minimum complete-bot runovers: **9**; minimum smashed light obstacles: **3**. Peak concurrent infected: **12** (limit 60). The original 5–10 minute newbie criterion is preserved.

## Acceptance evidence

| Criterion | Evidence / result |
| --- | --- |
| AC01 | Both graph choices complete, cancel the unused choice and trigger collapse/progression. PASS. |
| AC02 | Complete bot 20/20 per forced route from L3-default. PASS. |
| AC03 | Newbie 20/20; 5:55.93 median; zero deaths; 6:04.07 remaining. PASS. |
| AC04 | Native enter/drive, at least nine vehicle kills and three native light-obstacle break events. PASS. |
| AC05 | 5.49% median route-time difference. PASS. |
| AC06 | Real sedan stops at the heavy wall; Bloated burst and propane blast each disable its native collider. PASS. |
| AC07 | Timeout produces failure; restore returns the checkpoint deadline plus 60 seconds. PASS. |
| AC08 | Both targeted native browser routes complete at time scale 2, capture every spot, report no console errors and hand over to L4. PASS. |
| AC09 | Screenshots and checklist supplied. Automated capture PASS; manual combat-telegraph/occlusion review remains open in `review.md`. |

## Validation commands and results

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | PASS (both TypeScript projects). |
| `npm run lint` | PASS, no new warnings. |
| `SIM_WAIT=60 sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2` | PASS: 257 tests / 77 files. |
| `SIM_WAIT=600 sh tools/sim-lock.sh npx vitest run tests/levels/L3.test.ts tests/sim/missions/adapters.test.ts --maxWorkers=2` | PASS: 20 tests / 2 files. |
| `E2E_PORT=3335 npm run test:smoke` | PASS: 5 sim tests / 4 files; 22 browser tests. |
| `E2E_PORT=3337 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L3.spec.ts --project=chromium --workers=2` | PASS: 3/3 (both native routes including L4 handover, plus portrait phone evidence). |
| `npm run test:levels` | **FAIL overall: 15/18 complete.** L1/L2/L3/L4/L5 each 3/3; L6 stalls on all 3 seeds. |
| `SIM_WAIT=600 E2E_PORT=3334 npm run verify -- E21` | **PASS, exit 0:** typecheck/lint/build; 19 sim tests / 7 files, 663 skipped; 25 browser tests, zero failures. |

An earlier park browser failure occurred after native L3 completion/collapse. The failure snapshot already displayed the L4 briefing. Its 5-second wait was aligned with the existing campaign/save tests' 60-second asset-loading wait in `82396963`; no gameplay or retry changes were made for this failure. Both the targeted 3/3 browser run and the final fresh 25/25 verification now pass, including L4 handover. Final command exits are recorded in `checks.json`; detailed tagged results are in `vitest.json` and `playwright.json`.

## Deviations and remaining work

- No acceptance criterion or timing band was revised; no new dependencies/models were added.
- Approved art fallback: missing `decay.dropped-belongings` uses existing bags, benches, carts and medical coolers. Camp/paramedic finished assets are integrated from main.
- `npm run test:levels` L6 fire engine stalls at `drive`, near (13.215, 105.277), nearly stationary and about 96.7 m from its target. Required L1/L2/L4/L5 regressions pass; L6 needs its owning lane's route/handling investigation.
- Vision review does not sign off attack-telegraph shape or VFX occlusion duration from static images. The camp is crowded around the gate and the collapse caption overlaps the tent foreground. These are explicit final-review items in `review.md`.
- Screenshots are at most 1600 pixels wide; no videos retained. Large intermediate browser traces were deleted. No merge into main, push or deployment was performed.
