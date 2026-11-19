# s173-l6retreat — L6-07 retreat concurrent cap fixed by level design

Lane: `lane/s173-l6retreat`, base `67ac4d1b`. One gameplay file changes:
`src/sim/missions/LevelSixSubway.ts` (+23 lines). No target, tolerance, observer, probe, fixture,
bot, zombie-stat or survivor/follower code was touched. Targets and measurement are unchanged from
`docs/qa/level-acceptance.md` (`L6-07`): retreat concurrent infected ≤ **30** (low), ≤ **60** (high),
windups ≥ 4/min, retreat damage ≥ 30 HP, route complete.

Measured with fresh native runs at this head (tiers are sim-identical for L6):

```
sh tools/remote/run.sh $PWD --pull docs/reports/fix51-verify -- npm run qa:accept -- --level L6 --skip-browser
```

`sourceHash 58c3055820db`, `generatedAt 2026-11-19T07:25:24Z`. Regenerated receipts were restored
(`git checkout -- docs/reports/fix51-verify docs/qa/acceptance-status.md`) and are not committed; the
values are reproduced below.

## L6-07 before → after (graded run, seed 1)

| Clause | Tier | Before | After | Target |
|---|---|---|---|---|
| ordinary retreat route completion | low/high | complete | **complete** | complete |
| retreat player/group windups per minute | low/high | 16.21 | **15.31** | ≥ 4 |
| actual HP lost during retreat | low/high | 55 | **85** | ≥ 30 |
| retreat concurrent infected cap | low | 56 | **26** | ≤ 30 |
| retreat concurrent infected cap | high | 56 | **26** | ≤ 60 |

Row verdict: **L6-07 FAIL → PASS** (both tiers). The retreat is not softened — it lands 30 HP more
than before — and every other clause keeps passing.

## Root cause

The probe counts every live, non-corpse infected on each tick of `phase === 'retreat'`
(`tools/qa/accept/observer.ts` → `phasePeaks.retreat.alive`), not just the ones in the camera. On a
no-kill retention run nothing is ever removed from the fight, and the column walks at the same speed
as a chaser, so a pressure cohort admitted far behind the tail can never rejoin the encounter.

Traced baseline (`tools/qa/accept/s173-l6-retreat-census.ts`, read-only, re-run before the fix):

- retreat starts at tick 3647 with **8** live infected;
- pressure admits **36** wave-3 cohorts plus **12** hatch wave-4 arrivals (and 1 wave-2) over the
  126 s retreat — the same authored 4-per-14 s cadence as before, arrivals 23.36/min;
- live climbs to **56** while only **8–15** are ever within 30 m of the courier and **41** sit more
  than 40 m behind the column's own tail at the measured peak. They are unreachable by construction:
  the column is as fast as they are and never waits for them.

Inflating concurrency therefore came from abandoned chasers stacking at the back of the tunnel, not
from pressure on the group. That is why local-cap tuning (`SpawnDirector.cap`, offscreen refusal)
never bounded it, and why the probe's number kept growing until the retreat ended.

## Fix

`LevelSixSubway.recycleFallenBehind(tail)`, called once per retreat/exit tick right after
`s.tailX = tail`. It recycles — via `ai.release`, i.e. the living slot returns to the pool, no corpse
is removed — a live infected only when **all** of these hold:

- more than **45 m behind the column's own tail** (the hatch-reopening rule already treats 40 m as
  "route safely past"; 45 m keeps a margin so no one visible can be trimmed);
- outside the camera envelope (`director.offscreen`), i.e. the player cannot see it;
- unengaged (`combat.attacking`, `specialAttack`, `l1.mode === 'bite'` and `infectionRise` excluded);
- at least 35 m from the player and 25 m from every survivor;
- not a survivor and not a corpse.

Live bodies whose bodies are needed for the fight (near the column, in the camera, mid-attack or
rising) are never eligible, so what the player can see or fight is untouched. `distantRecycled`
already existed in the telemetry and now records the trims.

Distance chosen by measurement (retreat cap / retreat damage, seed 1): tail−40 → 21 / 30 (sits on the
≥30 boundary), tail−50 → **31 (still fails)**, **tail−45 → 26 / 85**. The 4-per-14 s pressure is
untouched: admissions and arrivals-per-minute are unchanged (23.36 → 23.44/min).

## Seed sensitivity (same census, retreat phase only)

| Seed | Cap before | Cap after | Damage before | Damage after |
|---|---|---|---|---|
| 1 (graded) | 56 | **26** | 55 | **85** |
| 2 | 58 | **23** | 55 | 20 |
| 3 | 54 | **22** | 55 | 55 |
| 4 | 61 | **23** | 0 | 55 |
| 5 | 60 | **29** | 65 | 30 |

Cap is now bounded on every seed (was 54–61). Damage is seed-sensitive both before and after the fix
(seed 4 already took 0 HP pre-fix); the graded run is seed 1 and keeps a large margin (85 vs ≥ 30).
Seed 2's retreat damage falls from 55 to 20 because chasers that occasionally land hits while the
column pauses for rear cover are now trimmed once they are provably out of play; disclosed here so the
trade-off is explicit rather than hidden.

## Other L6 rows (unchanged, pre-existing)

| Row | Status | Note |
|---|---|---|
| L6-03, L6-05 | PASS | unaffected |
| L6-08 | FAIL | pre-existing class 3 (follower pace vs phase median, s167-failB) |
| L6-10 | FAIL | pre-existing class 3 (fixed `l6-stair` exit waypoint, s167-failB) |
| L6-01/02/04/06/09/11/12/13/14 | NOT CHECKED | `--skip-browser` run: committed browser/visual receipts are source-hash keyed |

## Validation

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test:unit` (remote `npm test`) | 27 files, 105 passed, 1 skipped; budget 195.7 s ≤ 240 |
| `npm run qa:accept -- --level L6 --skip-browser` (remote) | L6-07 **PASS** low/high; 2 pre-existing failing rows (L6-08, L6-10) |
| `npm run qa:threat` | 337.6 s, **0 fail flags**; L6: skilled complete, passive complete, 0 passive flags |

## s173b — re-landing on the post-s170 main without the follower regression

Main reverted the first landing (19714978) because on the post-s170 tree `npm run qa:threat` grew 6 passive
flags — `early-close/step/exit` and `early-close/phase/exit` `SLOW_FOLLOWER:28/:38/:42` — while each change
alone measured 0 flags. This lane re-lands commit 0c893122 unchanged (cherry-pick) plus the one-file
column fix below; `tools/qa/**`, zombie stats, corpses and s170's L6 escort response are untouched.

### Cause

The escalator window's goal override folded every formation lane onto the courier's own line: for a slot
x in [246, 258) with the walker already past x 246, the goal z was hard-set to 15 — but the slot x stayed
keyed to each lane's **own** row (`leaderX − row×1.4`, rows counted per lane). The three lanes' row-4
members (slots 12/22/26 — followers 28/38/42) therefore all steered at the **same point** at every row:
three 0.7 m bodies grinding at each merge point. On courier-walking samples the interior walkers resolved
~2.09 m/s against a 2.24 group median (ratios 0.934/0.939/0.947 vs the 0.95 floor) while their own request
held ~2.4 — the deficit was pure body contact between co-targeted followers, not their own stride.

Why only the combination: with s173 the recycling keeps the 4-per-14 s pressure flowing to the Northgate
mouth, so the early-close courier covers it in a stop-and-go rhythm that packs the exit file (and its
deterministic ripple chooses which walkers sit interior). s170's shared escort response then keeps those
interior walkers' resolved stride measurable as walking samples — exposing the grind. Without the tracking
(pre-s170 response) the same interior walkers fell under the walking-sample floor (only 3 clear-road
followers qualified, 0 flags); without the recycling the pack strung out with nobody interior (0 flags).
Both were re-measured on this tree by gating each change off; the flags re-appear only with both on.

### Fix

`LevelSixSubway.follower()` keeps the column's three formation lanes through the escalator window
(`15 + (column−1)×0.725`, exactly the tunnel and street legs' lane centres) instead of folding everyone
onto z 15; only the platform-edge approach (a walker still south of the escalator foot, x < 246) keeps its
authored single approach lane. Each lane centre is body-clear along the whole approach (nav + solids
probes at 14.275/15/15.725, x 244–262), so every walker again owns a unique slot point. The stair/marker
anchors (`stairSpots`, `guide`) are untouched — L6-10's fixed-anchor clauses are unaffected.

### Before → after (fresh runs at this head)

| Measure | Before (re-land, first commit) | After (lane fix) |
|---|---|---|
| `qa:threat` passive flags (L6 early-close exit) | 6 × SLOW_FOLLOWER (28/38/42, both step/ and phase/exit) | **0** |
| follower 28 / 38 / 42 exit median (ratio vs group) | 2.089 / 2.099 / 2.119 (0.934 / 0.939 / 0.947) | 2.264 / 2.227 / 2.275 (**1.003 / 0.987 / 1.008**) |
| skilled route worst step/exit pace ratio | — | 0.966 (retreat 0.996; G-13/L6-08 pace clauses PASS) |
| `qa:threat` full gate | 6 fail flags | **0 fail flags** (re-verified at the current main head after the s172-geom merge) |

L6-07 stays PASS on both tiers with the recycling untouched (fresh remote `qa:accept -- --level L6
--skip-browser`): route complete, windups 20.57/min (≥ 4), retreat damage 40 HP (≥ 30), **concurrent cap
28 (≤ 30 low, ≤ 60 high)**. The tail-end of the retreat now also keeps its lanes at the platform approach
(slots enter the window just before the platform checkpoint), which is where the graded run's damage moved
85 → 40 and windups 15.31 → 20.57/min: fewer lane-mates bitten at the mouth pile-up, more pressure met by
the courier. Disclosed here since those two clauses are measured values, not targets.

L6-03/L6-05 stay PASS; L6-10 PASS both tiers; G-13 and L6-08's pace clauses PASS (worst exit ratio 0.966,
waiting upper bound 4.16%); the 10 incomplete rows are the browser/visual clauses this `--skip-browser`
run cannot check, as before.

### Validation (s173b)

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| remote `npm test` | 27 files, 105 passed, 1 skipped; 207.2 s ≤ 240 budget (first attempt hit the runner's slot-contention timeout, rerun unchanged) |
| remote `npm run qa:accept -- --level L6 --skip-browser` | L6-07 **PASS** low/high (cap 28, damage 40, windups 20.57/min); L6-03/05/10 PASS; G-13/L6-08 pace clauses PASS; 0 fresh failing rows |
| `npm run qa:threat` full gate (at this head, after the s172-geom main merge) | 339.8 s, **0 fail flags**; L6: skilled complete, passive complete, 0 passive flags |
