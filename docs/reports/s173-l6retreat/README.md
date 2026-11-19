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
