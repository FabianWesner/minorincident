# sweep-a3 — objective ring and L1–L3 acceptance

**Partial; L1–L3 are not signed off.** The objective torus now matches the active anchor trigger radius. Current native and fixture acceptance was refreshed for L1, L2 and L3 at both tiers. Browser review could not run in this restricted worktree, so visual clauses remain open.

## Objective ring

Commit `d991499` scales the marker torus to `anchor.radius` (default 2 m; authored radii such as L4's 1.4 m cellar are honored). The ring compensates for L3's marker zoom multiplier, keeping its world-space outer radius exact. The objective-marker invariant checks the radius at zoom scales 1 and 1.5 and reported no ring-radius violation.

The contract test process exited 1 for unrelated existing failures: L2 high firefighter 125 was hidden from ticks 1501–1520, and L8 `escape`/`depart` setup produced missing objective text/marker violations. No ring assertion failed. SHA-256: `ObjectiveMarker.ts` `7ab9937a752878a272241b5708539d63e662830bab16efa0d0d5e3f033bc99b2`; `contract.test.ts` `b4ac99b4f3c6f83032ee21a12f24c0ae4059815a040521ade87490d9fea45623`.

Fresh screenshot review of the original L1 depot and L4 cellar moments is still open. `qa:accept`'s browser phase attempted `build:qa`, then failed when the preview server could not listen on `127.0.0.1` (`EPERM`). The requested headless shared-pool capture therefore has no new image evidence; no visual PASS is claimed.

## Current-source acceptance

Commands run per level: `npm run qa:accept -- --level L<N> --tier both --policy both --skip-browser` (L1 used `--reuse` on its second pass after all native and fixture receipts had been generated). Current generated reports and receipts are in `docs/reports/fix51-verify/`; the tracker is generated in `docs/qa/acceptance-status.md`.

| Level | PASS | FAIL | NOT CHECKED | Current failing rows |
| --- | ---: | ---: | ---: | --- |
| L1 | 5 | 1 | 11 | L1-08 |
| L2 | 6 | 2 | 8 | L2-11, L2-12 |
| L3 | 3 | 6 | 7 | L3-02, L3-03, L3-06, L3-08, L3-10, L3-16 |

Current native complete routes passed both tiers for all three levels. L1-01, L1-07, L1-09 and L1-13 passed on exact current receipts; L2-04, L2-07 through L2-10 passed; L3-04, L3-09 and L3-11 passed. The remaining NOT CHECKED rows require unmeasured clauses, real-input/browser captures, or manual review. Stationary policy receipts for L1–L3 hit their tick budgets; those results do not count as passes.

Measured failures remain recorded in the generated level JSONs, including L1 low bounded-path reachable share 88.89% vs 90% minimum; L2-11/L2-12 current fixture/native route misses; and current L3 failures for yard-wave admission, combat-rate bounds, squad spacing/calm survivors, near-30 m density progression, high pressure admissions, and the two-column smoke criterion. These need targeted follow-up before any row can close.

## Gates and remaining work

- Focused QA invariant command: `npx vitest run --project nightly tests/qa/invariants/contract.test.ts` — 3 passed, 2 failed (the unrelated L2/L8 failures above).
- `git diff --check` — PASS.
- `npx tsc --noEmit` — PASS; `npm run lint` — PASS; `npm test` — PASS (107 tests / 27 files).
- `npm run qa:threat` ran alone after the final source change — PASS, zero aggregate fail flags, 442.3 s. Individual per-level logs each report a local flag, but the gate's aggregate zero-flag criterion passed; see `test-results/qa-threat/README.md` (git-ignored).
- L1–L3 real-input/browser review matrix, full row closure, review JSONs with inspected-image hashes, and row-by-row evidence commits remain open. Do not treat this report as acceptance sign-off.
- Slim-worktree setup was attempted first but could not write the external `.git/worktrees/sweep-a3/config.worktree` (`Operation not permitted`).
