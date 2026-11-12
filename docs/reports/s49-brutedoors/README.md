# s49-brutedoors — wide-body path audit

**Status: not complete.** The audited geometry passes, but the required regression gates remain red on L2 nightly and L7 threat. Both failures were reproduced on the detached starting revision `71bfbec7`. Historical experiments and superseded results are retained in [INVESTIGATION.md](INVESTIGATION.md).

## Changes

- Added `tools/qa/wide-body-audit.ts`. It records native wide-body admissions, checks paths from recorded spawn positions with body radius plus 0.1 m clearance, and reports narrow collision openings. It checks opposing walls and collinear door jambs. Ground-wall filtering, spatial deduplication and route bounds limit scan cost.
- Added source coverage gates for L3 street Alphas, L4 scheduled Alphas/explicit heavy encounters, L5 heavy wanderers, L6 hatch fronts, L7 Alpha packs, and L9 fixed groups/set pieces. L9 drives every main and detour lane. L10 additionally enumerates both tiers' authored wide slots through production slot/spot helpers.
- L6's audit fixture calls the production open-hatch spawner for all six hatches. L8's fixture calls the production outlet release method with route gates open, checks its four wide roles and authored doorway widths, and stops when routes are proven (600-tick failure bound). Its outcome is `fixture-observed`, not mission completion.

## Level-design fixes

| Level | Authored spot | Fix and evidence |
| --- | --- | --- |
| L5 | Butcher pair near (14,28) | Moved anchor to (11,28). The old second slot (16.5,29.5) failed production clearance and was skipped. Both members now admit and have paths. |
| L9 | Countryside `thrower-2` | Trigger at x=180 only on countryside; default x=200 retained elsewhere. The bend reduced the old post's Euclidean separation to 96.81 m, below the 105 m admission limit. The new post is 112.75 m away. All six route scenarios pass source quotas. |
| L10 | `farm-road-pair-4` near warehouse x=1400 | Moved station from (1400,100) to (1400,106), clearing the armored slot from the warehouse footprint ending at z=94. Both tiers' slots now have paths. |

IDs, rosters, stats, scales and corpses are retained. No staticCollision, test, threat-rule or nightly-rule edits were made.

## Audit results

Completed per-level runs of the corrected scanner report **592 records, zero unreachable paths and zero narrow openings**:

| Level | Records | Coverage |
| --- | ---: | --- |
| L1 | 0 | No requested wide roles observed |
| L2 | 0 | No requested wide roles observed |
| L3 | 7 | Boulevard, Commerce and Oak; each authored Alpha admitted |
| L4 | 39 | Eight scheduled Alpha anchors and four explicit heavy/Alpha encounter homes observed |
| L5 | 4 | Both butchers and both Alphas |
| L6 | 12 | All six open-hatch fronts plus native runtime admissions |
| L7 | 5 | Packs 701, 702, 704 and two final pack-700 slots |
| L8 | 4 | Four outlet roles and doorway widths in the open-gate fixture |
| L9 | 442 | Road 136/107, countryside 61/49, shortcut 43/46; main/detour quotas complete |
| L10 | 79 | 12 runtime records plus 67 authored checks across both tiers |

These receipts come from completed per-level runs, not one final uninterrupted campaign invocation. Runtime coverage is high tier unless a fixture explicitly enumerates both tiers. Random/systemic encounters are sampled by the native run; this does not prove every possible random placement. L8's fixture qualifies the connected open-gate state, not every arena lockdown state. Mega runtime paths use its pursuit grid when available; streamed ordinary encounters use full authored collision when the live window would omit their origin.

Run: `node --import tsx/esm tools/qa/wide-body-audit.ts`. Optional `WIDE_BODY_LEVELS=L4` limits diagnostics. JSON defaults to `test-results/qa-wide-body/report.json`; missing source quotas, unreachable records or narrow openings produce a failing exit code.

## Regression gates

- Typecheck and lint passed for the changed code.
- Required remote `npm test` passed on retry: 106 passed, 1 skipped; 150/150 case budget; 191.3 s. A prior contended run exceeded its reservation.
- Required remote nightly: five passed, one failed. L2 market-ambush admits 24 but only 23 reach the census area; war-waves pass. A native trace shows live runner 216 released at tick 1801 by `retireDistantAmbush()` during `spawnEscape()`, before reaching the measured area.
- Latest remote threat counts: **0,1,2,4,3,4,7,0,0,0**. L3/L5 are the explicitly queued regressions. L7=7 differs from required 6: focused low/skilled seed 2 reaches its 1200 s tick budget (`valid:false`, state hash `93c3855b`), despite measured follower median around 4.50 m/s. This remains unresolved.
- Detached baseline `71bfbec7` reproduces nightly exactly (five passed, L2 23/24 failure) and the L7 seed-2 timeout with the identical final state hash `93c3855b`. These failures predate this lane. The goal is blocked on the required base gates: they remain red, and lifecycle/route changes beyond this lane’s geometry fixes are required. No gate is claimed green while red.

## Browser QA needed

No browser was used, as instructed. Inspect these fixed spots visually:

- L5 butcher pair at (11,28)/(13.5,29.5): both appear outside collision and move along the street clear of adjacent frontage.
- L9 second countryside thrower on both traces: present outside the driving frame before the x=200 bend, throws from the verge, and does not pop in or clip into the APC lane.
- L10 warehouse south frontage near x=1400: all three `farm-road-pair-4` members approach outside the warehouse and clear the lamp/container stack.

Also inspect L4 tent aisles and L8 tunnel mouths/east outlet near (99,32) with the zebra gate open for visual body clipping that navigation alone cannot prove.

## Worktree and handoff

Work is committed on the lane branch; nothing was pushed, deployed or merged. The required slim-worktree setup initially hit sandbox Git permissions, then succeeded after restrictions were lifted. The lessons file was read. No dependencies were added. The baseline comparison uses a detached disposable worktree prepared with the required setup/slim tools.
