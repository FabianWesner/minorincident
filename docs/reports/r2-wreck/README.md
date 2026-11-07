# r2-wreck

Runtime base: `daada5d`; final runtime: `0a2c8f6`. The 0.35 m body / 0.5 m crowd clearance contract is preserved, as directed by the orchestrator.

## 1. Rotated wreck and prop footprints — fixed

Commit: `381d6a0` — Fix rotated prop footprints across navigation and static contact.

Non-axis-aligned placement boxes retain their authored orientation through district rasterization, campaign and streamed crowd walls, route clearance, the simulation contact solver, and Rapier static colliders. Bounds still serve spatial indexing. Axis-aligned placements retain their existing behavior.

The reported L3 Oak wreck pocket at (-72, 26.8) contained two cells before the fix. Those cells now connect to the street. The existing regression verifies the route succeeds and retains its original assertion that the corgi catches up to within 6 m of the courier. A second two-cell L3 island at the highway ramp end also disappears from the audit.

### L1–L10 audit

[Full counts and component locations](nav-pockets.json). Reproduce with:

```sh
node --expose-gc --import tsx/esm tools/qa/nav-pocket-audit.ts test-results/nav-pockets.json
```

The audit uses each level's native tier, seed 1, a 0.5 m grid, and the complete static level footprint, including nonresident L9/L10 terrain. It excludes the largest crowd component, then counts other components whose cells connect to it on the matching 0.35 m body grid. “Before” strips oriented footprints to reproduce the old AABB walls; “after” uses the committed geometry. Dynamic blockers are outside this static audit.

| Level | Before pockets | After pockets | Before cells | After cells |
|---|---:|---:|---:|---:|
| L1 | 10 | 10 | 646 | 646 |
| L2 | 12 | 16 | 1,103 | 1,106 |
| L3 | 65 | 64 | 2,421 | 2,448 |
| L4 | 6 | 6 | 95 | 95 |
| L5 | 6 | 6 | 95 | 95 |
| L6 | 0 | 0 | 0 | 0 |
| L7 | 7 | 9 | 98 | 100 |
| L8 | 0 | 2 | 0 | 2 |
| L9 | 9 | 11 | 74 | 78 |
| L10 | 0 | 0 | 0 | 0 |

Residual components are retained under the required clearance contract: body-clear passages can remain too narrow for the crowd grid. Correcting the rotated geometry also exposes additional small components in some levels. The report does not claim that all body-accessible components have been removed; the two reported L3 rasterization islands are gone.

## 2. Companion trail fallback — fixed

Commit: `0a2c8f6` — Enable two-second companion trail recovery in every level.

Every level now records the living, visible courier's trail and allows a companion to use it after 120 ticks (2 s) of failed routing. The existing retry throttle and collision-safe movement remain in use.

The L1 unit scenario exercises trail recording through `Companion.update()`, forces routing failure, checks that no movement occurs during the first 120 ticks, and verifies trail-directed movement begins at tick 120. The L3 catch-up regression also passes. Both assertions extend existing test cases, keeping the repository at its 150-case budget.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused navigation/NPC suites — 7 tests passed across 2 files.
- `npm test` — 107 tests passed across 27 files, 28.2 s including budget collection; 150/150 collected cases.
- Final `npm run qa:threat -- --out test-results/qa-threat-r2-final` — ran alone after the other checks, starting at load averages 4.35 / 5.02 / 5.33. All ten levels were measured in 539.1 s (541.1 s including budget collection), within the 600 s limit. It exited **1**, with **11 acceptance flags**.

[Persistent threat summary](threat-summary.json). Full local receipts are under `test-results/qa-threat-r2-final/`.

| Level | Final threat flags | Detail |
|---|---:|---|
| L1, L2, L4, L5, L6, L9, L10 | 0 | All skilled native routes complete |
| L3 | 1 | Army-line squad gate fails: surviving counts 3, 4, 3 across seeds 1–3 |
| L7 | 8 | Follower waiting share and pace |
| L8 | 2 | Follower 354 pace in escape/breached measurements |

All ten skilled native routes completed. Passive `tick-budget` outcomes are the audit's configured observation-window caps. The final threat gate is **not green**; this lane records the failures without expanding into threat calibration or follower tuning. No verified main-source comparison was performed, so the flags are not classified as pre-existing.
