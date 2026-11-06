# fix65-c — L7 pressure, L9 groups/routes, L10 regional encounters

Base: `f807c96`. Production source is frozen at `26b9228`; SHA-256 `98ba7f93a1d4798849f83f7c62a78bf324ae793ae7c85a6795138e29a7e1fd80`. All four assigned rows now PASS with complete automated coverage (14 / 6 / 14 / 86 checks respectively); the full threat gate remains open (12 L7 follower flags and a budget timeout). The earlier filesystem and socket restrictions were removed; row fixes are committed locally.

## Fixes and evidence

| Row | Fix | Evidence |
|---|---|---|
| L7-05 | Restore the opening pack from x239 to x259, keeping the current party formation, regroup/alarm and boarding code. | A/B source isolation reproduces skilled 0.8132/0 windups per minute and stationary first attacks 83.97/22.67 s at x239. At x259, skilled pressure is 11.1801/6.5188 per minute, both stationary first attacks are 0.0667 s and bounded-path reachability is 100%. Initial follower body clearance is at least 3 m. See `L7-05-bisect.json` and its hashed four-policy receipts per variant. |
| L9-02 | Groups 3 and 6 have seven runners plus one Alpha: eight total. | Both tiers: road 2×6, countryside 3×6, shortcut 6×8 including exactly two Alphas. All three ordinary native InputFrame detour routes finish with identical observer-free controls; minimum driven group-centre clearance is 22.65 m. See the final source-prefixed census and adapter-control receipts. |
| L9-04 | Correct the physical producer's endpoint-only steering; the game and authored paths already permit the required comparison. | Same healthy seed-1 starts and same WASD controller on both paths: safe 990 HP versus shortcut 860 low / 900 high. Full path, input and damage ledgers are in `L9-04-{low,high}-physical.json.gz`; reviewed frame digests are in `L9-04-review.json`. |
| L10-03 | Move the first high-tier corridor packs 13 m east; stage the first three low-tier patrols at the horde approach. On the smaller low budget admit Alpha, regular rank, then dogs. | The high campus peak was inflated by an R6 dog crossing the R5/R6 overlap. Counts and caps are retained. A second diagnostic shows the unchanged low-tier cap of 75 admitting only 18 regulars initially and 19 later; the balanced ordering observes a 20-member regular group, an Alpha peak of two and a dog peak of five within the unchanged budget. A regular-first trial was rejected because its Alpha peak fell to one. The original dog observer retains exactly the baseline state hash `d97376d0`; see `historical/L10-03-original-boundary-dog.json.gz`, `L10-03-dog-peak-investigation.json` and `L10-03-corridor-{before,balanced}.json`. Both complete profile controls retain the passing native state hashes: low corridor pressure 5.60/min, high 5.32/min; all four final native policies and the independent handgun/dog timing control pass. |

### L7 regression isolation

The named vqa-fix-4/fix61-c commits and their source snapshots were removed by the history squash; `git fsck` found no recoverable objects. The reachable vqa-fix-5 diff leaves the L7 follower clause unchanged and its story-protection changes are scoped to other levels. A literal three-commit Git bisect was therefore unavailable. Instead, the retained one-factor source bisect changes only the documented opening-pack relocation and runs both tiers/policies on each variant. This reproduces and clears the regression while retaining the newer shared behavior. Current boarding identity, door spacing and 20-second recovery fixtures pass.

### Proven QA corrections

L9-04's original producer drives several metres parallel to the authored east detour and catches verge props. The unchanged driver currently measures safe860/shortcut920 HP. Moving one wreck improves safe HP to900 but still fails; braking alone gives760. Both failed trials are retained, and the geometry change was reverted. A 12 m segment lookahead, smaller steering deadband and ordinary braking on sharp turns keep the physical car on its prescribed path. The same controller applies to both routes. Its safe drive has only 0.4 s stopped, compared with prolonged recovery in the original failure. No HP, damage, route, population, timer or cap target was changed.

The legacy L9 authored census check incorrectly required eight runners before adding Alphas. It now checks eight total, matching the literal existing criterion and the actual admitted-entity counterexample. L9-02 also lacked a complete-coverage registration; the new registration requires the full both-tier group census and driven-detour clause. Fault controls reject oversized groups, missing Alphas, duplicate/mismatched IDs, missing groups/detours, short clearance, stale source and observer effects. These changes qualify existing requirements; no criterion was relaxed.

## Commits

- `40b08a6` — L7-05 opening pressure and source-bisect evidence.
- `4f2d55f` — L9-02 composition and independent census adapter.
- `f361a33` — L9-04 physical route producer and reviewed evidence.
- `2183cb9` — L10-03 campus overlap correction.
- `26b9228` — L10-03 separate authored patrol stations for the two population budgets; preserves high pressure and low complete ranks. Intermediate failed attempts remain in history and the retained receipts.

- `8a5876a` — final L7 qualification and separate follower-stall trace.
- `87a8440` — final L9 census qualification and fault controls.
- `73853f1` — final physical route/damage qualification.
- `39a3115` — final L10 census and pickup-timing qualification.

## Validation and limits

- Final `npx tsc --noEmit` and `npm run lint` pass; QA build passes.
- Final isolated unit suite: 106 tests pass, one platform-dependent test skipped, 27 files; 65.4 s within the 240 s budget. The earlier concurrent Mac attempt timed out two individual tests; its log is retained.
- L7/L9/L10 full native acceptance and final `--reuse` qualification finished for both tiers after the final gameplay change. Each level command exits1 for unassigned incomplete/failing rows; all four assigned rows are PASS/current PASS/automatedComplete=true with no failing checks. All checkpoint controls are identical and fixtures have zero errors.
- Final local `npm run qa:threat` ran with no other owned local checks. It exits1: L7 emits12 slow-follower flags (actors56/61/64/65/71/74, each in corridor and encounter phases), then the unchanged600s cap stops L8 at601.2s (child124). L1–L6 reported zero flags. **The full zero-flag gate is NOT met.** Native L7 low skilled state remains exactly `593cf510`, matching acceptance. No budget, follower criterion or performance rule was changed.
- The isolated remote attempt also times out at600.9s after L4; it additionally reports `criterion/L3-06 squad counts/losses:FAIL`. Both attempts and the successful unit rerun are archived under `validation-logs/`; `validation.json` records exact exits, source, report digests and flags. No further rerun or gameplay change after the orchestrator ended the time box.
- All 150 owned raw route captures were personally inspected, hashed and deleted. Twelve labelled sheets were also inspected and deleted. `L9-04-capture-cleanup.json` retains every digest and observation. Images show the intact olive APC on the grass detour or contact-marked shortcut and normal illuminated bridge approaches; temporal HP claims use the full ledgers.
- The broader sweep exposes a genuine navigation stall for L7-09 high-tier departure actor51, about35m from the queue: 3.288 m/s versus group4.6 (ratio0.715). This and the final full-audit low passive corridor follower flags remain open; boarding identity/spacing/recovery still pass. Navigation trials did not establish a small safe repair, and none landed. This report does not claim the entire L7–L10 acceptance catalogue is complete: final commands retain L7 one fresh failure/eight incomplete rows, L9 zero fresh failures/six incomplete rows, L10 zero fresh failures/ten incomplete rows. No taste-only items were assigned.

The shared global status/index files are restored to base because these are three-level results, not a new ten-level global census. Current L7/L9/L10 JSON reports retain all measured failures and incomplete rows.

Historical review evidence that pointed to mutable native receipt paths is archived byte-for-byte under `historical/`, preserving its original SHA-256 and observations. Historical failures are retained alongside new measurements. No push or deployment.

## Handoff

Closed: L7-05, L9-02, L9-04, L10-03 (all current PASS, complete automated coverage). Open: the full threat gate, L7 follower pace findings, remote L3 squad counterexample, and unassigned catalogue work above. Stopped at the orchestrator’s explicit time-box instruction. Do not treat this as a clean global acceptance pass.
