# fix72-c — regional census, Mega corpse, launcher timing

Base `fa27d0b`; no push or deploy. Final game source SHA-256: `6bd47c715412b028930eab167464b55a4f39ab8c6a6834c254b75398d953ed0c`.

## Rows closed / fixed / open

| Row | Result | Numbers and evidence |
|---|---|---|
| L10-03 | Closed: PASS/FRESH | All 12 same-tick joint count/species witnesses; zero upper-bound violations; 74 boundary/separated-peak controls. Both complete policies and all 54 checkpoint checks pass. Final state hashes low `99215cf9`, high `860b50df`, identical to independent controls. Handgun pickup tick 3497 precedes first fringe dogs tick 4950. [Report](L10-03/README.md). |
| L10-12 | Requested visual FAIL fixed; scoped PASS | Settled Mega retains its head and all limb chains despite raw severance mask 31. Geometry 7,865/16,119 vertices/indices before, 18,375/46,338 after. 102 raw captures personally reviewed or exact-duplicate hash verified, then deleted; both final-source physical probes have zero errors. Whole row remains NOT CHECKED for separate fight/death timing and complete grab/12m boundary clauses. [Report](L10-12/README.md). |
| L7-01 | Closed: PASS/FRESH | Unchanged strict 50ms gate: low pickup 49.9ms / first rocket 16.8ms; high pickup 50.0ms / first rocket 16.8ms. All 22 fault controls pass, including 50ms PASS / 50.01ms FAIL. [Report](L7-01/README.md). |

The requested lane outcomes are complete. Independent unfinished level criteria remain open; this is not whole-level signoff.

## Fixes and commits

- `06dab81` — L10-03 regional cohort admission and joint census.
- `3a0d07a` — L10-12 complete settled Mega silhouette and matched physical proof.
- `65591f5` — preserve earlier-region quotas and carried Alpha once-only identity.
- `3a1601b` — L10-03 current joint-census acceptance and full-criterion review.
- `b305c03` — L10-12 physical confirmation and scoped review.
- `35e305b`, `bc4cafe` — retain initial L7 timing failures and narrow shader diagnosis.
- `66f29ff` — L7-01 restores carried quality before assets and pipelines warm up. Previously the low save warmed the high-tier light graph, then changed it after loading. Four lines fix the ordering; 14 paired shader records establish the cause.

Final evidence commits: `0540b57` (L7-01), `f2a0d99` (L10-03), `a67651d` (L10-12). Prior failed measurements and the rejected renderer experiment remain archived. The final L7 result is the first uninstrumented pair after the ordering fix, using the unchanged producer and event windows.

No authored counts, HP, timers, caps, acceptance ranges or frame thresholds were reduced. No specs, reference trees or assets were edited. No broad performance run was started.

## Validation on final source

- `npx tsc --noEmit`, `npm run lint`, `npm run build:qa` — PASS.
- `npm test` — PASS, 107/107 tests in 27 files.
- L7 whole-group refresh: both complete policies pass, all 6 checkpoint checks match controls, fixtures have zero errors. L7-01 PASS; unrelated L7-09 remains the one fresh FAIL; 8 incomplete rows remain. Command exits 1 for those outstanding criteria.
- L10 whole-group refresh: both complete policies pass, all 54 checkpoint checks match controls, fixtures have zero errors; zero fresh FAILs and 10 incomplete rows. Stationary policies reach the Mega hold and exhaust the normal tick budget. Command exits 1 for incomplete criteria.
- Dedicated final-source census and both physical corpse confirmations pass.
- **Final `qa:threat` deferred at orchestrator request.** The in-progress final-source audit was stopped (exit 143); the orchestrator runs the gate on main. The retained 301.2s, zero-flag audit in [gates](gates/threat-summary.json) covers the prior `cd41f284…` source only and is historical evidence, not a final-source gate claim.

Current validation logs and hashes are retained in [validation.json](gates/validation.json). All 114 raw lane captures were inspected/hash verified and deleted; only two ignored derived comparison sheets remain. Shared all-level indexes are restored to baseline; regenerate them on main after integration. Per-level JSON and current receipts are retained. Original L10-11 evidence bytes remain in `prior-receipts/` with their original digests and verdict.
