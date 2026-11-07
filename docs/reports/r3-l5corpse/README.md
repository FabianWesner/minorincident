# r3-l5corpse — Alpha corpse avoidance and corgi contact yielding

Both cause fixes are committed separately:

- `c8147ea1` — L5 calm strides and calm route fallback reuse L7's swept `corpseDetour`. The follower retains the selected legs until reached instead of recalculating an arc every tick. Combat cancels the old detour.
- `7233cab6` — record the blocking body when a rollback rejects another actor's proposal. After 30 slow corgi/follower contact rejections without 0.2 m of corgi progress, the corgi takes a swept 1.5 m lateral leg. It remembers the blocking follower even when only that follower's proposal was rejected. The leg persists through the first successful step, uses a 0.1 m arrival stop, and expires after 90 ticks. A standing corgi also responds; respawn and door transitions clear the recovery state.

Formation slots, speed ceilings, acceptance targets and observers were not changed. No push or deploy was run.

## Physical regressions

Both cases are folded into the existing NPC test, preserving the **150-case budget**. They use real navigation, motion response and final solid-body commits; contact and movement results are not mocked.

1. **Alpha corpse:** a follower walks behind a moving courier through an otherwise clear grid route with a real, settled Alpha corpse in its way. It must detour, pass the corpse within 240 ticks, and retain physical clearance on every tick. Restoring the original survivor controller makes this test fail because the follower never detours.
2. **Corgi crossing:** near `(20, 41)`, a corgi and three followers receive opposing route goals. A small post behind the front follower prevents the corgi from simply pushing it backward indefinitely. The test runs the production companion recovery when contact stalls. All three followers must cross north of `z=43`, the corgi must cross south of `z=39`, and every tick must remain free of collision offenders. Restoring the original movement/contact code leaves the front follower at `z=39.721` after 360 ticks; the fixed code clears the crossing within that same six-second window.

The physical tests exposed two flaws in the earlier draft: a normal runner corpse is not solid, and a 1.2 m corgi sidestep is swallowed by its ordinary 2 m follow stop. The final tests check resolved movement rather than a requested goal.

Fault-proof logs: `test-results/r3-l5corpse/corpse-broken.log` and `crossing-broken.log`.

## Reported Alpha wedge: direct before/after

Fresh, unchanged `r2-l5-trace.ts` runs compare baseline `5f64c4d0` with final gameplay source `7233cab6`, seeds 1–3 on both tiers. For the reported **high / seed 2 / follower 30 / dead Alpha 90 at `(47.34, 41.94)`**:

| Measurement | Before | After |
| --- | ---: | ---: |
| Ticks with that dead body as contact witness | 711 | 81 |
| Stationary contact ticks (resolved speed ≤ 0.12 m/s) | 530 | 17 |
| Longest consecutive stationary contact | 475 ticks / 7.92 s | 6 ticks / 0.10 s |
| Longest consecutive **calm** stationary contact | 156 ticks / 2.60 s | 6 ticks / 0.10 s |

## L5-08 formation share

**The broader L5-08 formation failure remains. Its aggregate out-of-band share increased from 3.64% to 4.41%.** These two body-obstruction fixes do not solve the other formation losses diagnosed by r2-l5.

| Tier / seed | Before | After |
| --- | ---: | ---: |
| low / 1 | 5.57% | 5.57% |
| low / 2 | 4.85% | 5.15% |
| low / 3 | 0.57% | 2.77% |
| high / 1 | 2.42% | 4.53% |
| high / 2 | 3.22% | 3.49% |
| high / 3 | 4.66% | 4.66% |
| **All followers, both tiers** | **1,267 / 34,760 = 3.64%** | **1,561 / 35,388 = 4.41%** |

Method and per-follower counts: [trace-summary.json](trace-summary.json). Full traces: `test-results/r2-l5/L5-{low,high}-s{1,2,3}-{r3-before,r3-final}.json.gz`. Each run completed. Shares sum bad calm straight-walk ticks over all observed followers, using the existing observer without changing its criteria.

## Validation

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm test` — pass: 107 tests across 27 files; repository budget 150/150.
- `npm run qa:accept -- --level L5 --skip-browser` — exit 1: **one fresh failing row (L5-08), nine incomplete rows**. Both complete routes finish; stationary policies reach their tick budgets. Fixtures: 10 clauses per tier, zero errors. Checkpoints: 6 clauses per tier, identical controls and zero errors. [Acceptance summary](acceptance-summary.json); full receipts/log in `test-results/r3-l5corpse/acceptance/` and `accept-final.log`.
- `npm run qa:threat -- --levels L5` via `tools/remote/run.sh` — **zero L5 flags**, including zero skilled/passive follower-pace flags over seeds 1–3 and zero passive flags. Skilled route completes; passive route reaches its tick budget. The audit takes 532 s (540 s including the budget wrapper, below 600 s). Exit 1 is solely the existing `PARTIAL_LEVEL_SELECTION` marker that every L5-only audit emits; there are no gameplay failure flags. Remote native hash `f8daf942` matches the final local acceptance run. [Threat summary](threat-summary.json); full receipt in `test-results/r3-l5corpse/threat/audit.json`.
