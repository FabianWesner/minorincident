# s170-followers — follower pace/band defects (G-13, L5-08) + L6-10 anchor list

Base: main `6d745042`. Goal: L5-08, G-13 and L6-10 PASS on fresh `qa:accept` via a
follower-controller fix and the l6-stair anchor. Full values in
[evidence.json](evidence.json); the receipts were regenerated fresh on the remote runner
(`sh tools/remote/run.sh $PWD --pull docs/reports/fix51-verify -- npm run qa:accept --
--level L5|L6|L3 --skip-browser`, one level per run) and restored with `git checkout`
before this commit.

## Shipped (commit `fix(l6)`)

| Row | Before → after |
|---|---|
| **L6-10** | FAIL: offenders exactly the fixed `l6-stair` escalator waypoint (250,15) during exit ticks 11198–11233 (the 2026-11-17 exit-guidance decision predates the fixture's allowed set) → **PASS both tiers**: offenders `[]`, gateCount 3, platformSeen, nightSeen, 12/12 gate branches. The two fixed stair spots (250,15)/(244,15) are now allowed exit anchors, exported as `LevelSixSubway.stairSpots` (single source of truth with `guide()`); every other anchor check is unchanged (the gate/platform/night-exit requirements stay exactly as strict). |
| **G-13 (L6 half)** — follower 42 step/exit | FAIL 0.9268 (okafor median 2.09 vs group 2.26, 11 samples) → **PASS**: step/retreat worst ratio 0.9964, step/exit worst 1.0. Cause: the authored column ramp paces the L6 column, but its resolved stride lost the escalator/dash course corrections on the shared default crowd response (`trackingFor` returned `undefined` for L6). A walking courier now gives the column the shared escort response (`AgentMotion.trackingFor`, scenario-gated); stationary shelter holds and scripted walks keep the authored response. okafor's own exit median is 2.3 (~0.968×) with 5 samples — under the clause's own 10-sample floor, because the column now keeps pace and crosses sooner. |
| L6-08 (escort pace, same values) | FAIL 0.9268 → the pace clause now reads the same PASS set as G-13. |
| L5 / L3 escort rows | No regressions: L5-09 rescued 4 (low) / 5 (high) PASS; L5 high band 96.86–100% PASS; L3 escort pace 1.0; the fresh failing rows on all three levels are only the pre-existing class-3 rows (G-24, L5-05, L6-07, L3-06, L3-11). |

## Not shipped: the L5 follower controller (G-13 L5 half, L5-08) — measured, then reverted

The lane built a read-only probe (`tools/qa/accept/s170-follower-trace.ts`) that reproduces
the acceptance pace/band metrics exactly (locally byte-identical to the fresh remote
receipts: mia 91.60%, dale 89.85%, maxBadRun 90/63) and mapped the defect classes with
per-tick branch/pace/band forensics:

1. **Shared-combat fall-out (the diagnosed class)** — `followerInCombat` (a live infected
   within 10 m *of the courier*) drops a calm rear follower onto the authored 3.8 m/s
   defensive pace while the group runs 4.5 (dale's look median 3.69 vs a 4.18 group
   median). Gating calm travel on the follower's *personal* threat instead fixed exactly
   the named case: **high seed 1 dale step/look 0.8823 → 0.98**.
2. **Medkit strand** — `seekSurvivorMedkit` walks a <70 %-HP follower up to 8 m from the
   courier during a rest; her restart then strands a 184-tick out-of-band recovery ride
   (mia). Leashing packs to within `l5.follow.maxM` of the courier removed that ride
   (mia 91.60 → **100 %** on low seed 1).
3. **Lane flicker** — the side/single-file slot candidates alternate around wreck edges,
   teleporting the slot target a body-width sideways every few ticks; sticky lanes stop
   the zigzag.
4. **Corner momentum loss** — the resolved-motion wall-contact reset zeroes the whole
   response each contact tick (grinds: request 4.73 m/s, resolved 1.2–3.7 for 40–190
   ticks at two recurring corners); preserving the wall-tangent intent share for brisk
   L5 travel removes the long grinds.
5. **Armed-return crawl** — an armed follower returning on `ally.run` (3.8 m/s on the
   default crowd response) crawls at 0.8–2.3 m/s during her stop-fights, leaving a 6 m
   restart gap; escort tracking for the return order closes it.

**Why reverted:** every one of these fixes measurably works on its own case, but the
strict *relative* aggregates reshuffle the deterministic escort timeline faster than they
clear the bars. With the full set: G-13 high seed 1 passed (0.98) but seeds 2/3 moved to
0.927/0.917 (still a 2-of-3 vote FAIL); the low band worst rose 89.85 → 93.31 while the
**previously-passing high band regressed** (mia 91.07, dale 93.05); the **previously-
passing low G-13 clause regressed** (dale 0.973 → 0.9108 — the improved group median
raises the relative bar for whichever follower eats the residual windows); and
`qa:threat` gained 5 L5 flags (SLOW_FOLLOWER:28 ×2, passive STUCK_CHASER ×2 — back to
**0 flags** after the revert). The residual is the turn/reversal transient pool: corner-cut
slot swings and restart ramps cost 20–65 out-of-band ticks per occurrence, and they land
on whichever follower the timeline assigns them to. Under "no regressions on the L3/L5/L6
escort rows" the L5-affecting changes do not ship; the classes above are the measured map
for the orchestrator's next decision — an escort-design change (damped slot heading,
park-behind-at-stops) or the s167 tolerance proposal for L5-08/L6-08.

## Goal state on fresh qa:accept (final tree)

| Row | State |
|---|---|
| L6-10 | **PASS** (both tiers) |
| G-13 | L6 **PASS**; L5 FAIL (the baseline multi-seed vote) |
| L5-08 | FAIL at the baseline (low band mia 91.60 % / dale 89.85 %; maxBadRun ≤ 90 ticks ≤ 2 s) |

## Re-measurement and validation

- `-- --level L5 --skip-browser` → "L5: 2 fresh failing rows" (G-13 high vote, L5-08 low band; L5-09 rescued 4 PASS; high band all ≥ 96.86 %).
- `-- --level L6 --skip-browser` → "L6: 1 fresh failing row" (L6-07 class 3, value 55 unchanged); **L6-10 PASS**, G-13/L6-08 pace clauses PASS.
- `-- --level L3 --skip-browser` → "L3: 2 fresh failing rows" (L3-06, L3-11 class 3, values unchanged); escort pace ratios 1.0.
- `npm run typecheck`, `npm run lint` clean; local unit suite 106/106 (98.4 s / 240 s budget);
  remote `npm test` green (exit 0); `npm run qa:threat` → **0 fail flags** (234.7 s / 600 s budget).

## Open

1. **L5-08 / G-13 (L5)**: the five defect classes above are measured and reproducible via
   the committed probe; the L5 controller change needs either the escort-design follow-up
   (damped slot heading, park-behind-at-stops, turn-transient absorption) or the
   orchestrator's tolerance decision — a steering-only fix under the existing speed rules
   moves the failures between followers/seeds instead of clearing the bars.
2. L5-05's reachable share read 84.6 on this head (the s167 lane had measured 100 at its
   own head); not touched here, flagged for the L5 lane.
