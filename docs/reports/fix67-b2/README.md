# fix67-b2 — L5 reachability regression

## Result

The requested regression is fixed at `f8fa4bb` (source SHA256 `faed0882a930e24356a8ece4b426a9944ec7dcf6f7aba4a705700f708f79cde7`). **L5-05 PASS; all measured G-13 checks PASS(full row NOT CHECKED); standalone qa:threat exit0/10 levels/0 flags.** The truck stays at its previously safe northern site **(16.3,−45)**. Every measured L4 impact clears protected living actors≥15m; ordinary intervals remain8–12s.

## Retained change

The original reachability failure occurs only at low population. Give the northern Alpha a low-tier street position **(−42,−41.5)** instead of(−40,−37.4), using an optional authored `lowAt` and the existing population selection. **High keeps its original position and exactly reproduces incoming world hash `f14b9e54`.** Both tiers retain their100/150 infected and two Alphas. No counts, caps, timers, policies, checkers or acceptance thresholds changed.

At the old low-tier failure sample(tick2237), Alpha97 is at(−38.757,−36.152) after a firearm hit reaction; the player is at(−38.669,−44.745). The independent body-radius query returns no path, leaving7/8 reachable(87.5%). The alternate street approach removes that counterexample. The [trace](alpha-trace.json.gz) is diagnostic; fresh canonical receipts provide the qualification.

| Final measurement | Low | High |
| --- | ---: | ---: |
| L5 complete bounded reachability | 100.00% | 100.00% |
| L5 player attacks/min | 6.527 | 4.355 |
| L4 every-impact minimum(m) | 15.003722 | 16.535094 |
| L4 forced-shell clearance(m) | 26.029396 | 20.804517 |

## Rejected trials

- Truck(27,−9.5) restores L5 paths/pressure but exposes a high721-tick(12.0167s) firing interval; another0.5m move gives11.43m forced clearance. Both rejected. Truck(27,−9) still has the721-tick interval.
- Holding tank aim during its turn worsens high cadence to12.3833s and forced clearance to13.57m. All three simulation files were restored; no tank-aim code is retained.
- Applying Alpha(−42,−41.5) to both tiers exposes high-tier G-13: survivor28 pace92.751% vs≥95. The first threat run was stopped deliberately for this regression and archived as [aborted](aborted-alpha42-threat.log.gz), not reported as a pass. Several nearby shared placements also miss reachability, pressure or follower pace. The final low-only adjustment preserves the previously passing high route.

[Position screening](position-screening.json), [rejected shared-position acceptance](rejected-alpha42-acceptance.json.gz), and [rejected tank proof](rejected-27-cadence-tank.json.gz) retain the counterexamples.

## Final validation

- Typecheck and lint: PASS. Existing unit suite:107/107 PASS,4-thread cap; no new cases.
- `qa:accept` L4/L5, both tiers and both policies, `--skip-browser`: fresh matching receipts, zero fixture/checkpoint errors and identical checkpoint control hashes. Tier producers run independently; sequential whole-level `--reuse` rebuilds publish the final reports.
- Actual mortal L4 tank-event recheck: all ordinary/forced impacts, living registered actor positions and exact canonical final hashes; [ledger](final-tank.json.gz). Original sweep evidence restored after the producer ran.
- `npm run qa:threat`: run alone after the one-minute load fell below6; recorded1/5/15-minute loads (4.00830078125, 5.3017578125, 5.6767578125); exit0,10 levels,zero flags. Existing600s watchdog unchanged.

Whole-level acceptance is still non-green. G-13 has no fresh failing checks, but its full row remains NOT CHECKED, as on the incoming lane. Known failures and compound incomplete clauses remain:

- L4: row failures none; global failures G-22; 14 incomplete rows.
- L5: row failures L5-08; global failures none; 9 incomplete rows.

L5-08 already fails on baseline. Earlier L4/L6 compound/visual results remain scoped to their recorded sources; this follow-up reran the requested L4/L5 native matrix. No browser captures, perf work, deploy or push. All owned checks finished.

Exact exits, source/control hashes and evidence SHA256s: [qualification](qualification.json), [canonical receipts](canonical-receipts.json.gz), [threat audit](threat-audit.json.gz), [budget receipt](threat-budget.json.gz).
