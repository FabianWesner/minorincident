# r2-l3seed — L3 seed votes and squad formation

**Brief completed.** Runtime baseline: `7d2c9af`. Validated candidate: `58f6da1`. The final standalone threat gate passed with **0 flags**. No deploy or push.

## Brief item 1 — fixed: common seed vote

`qa:accept` and `qa:threat` use the same two-of-three rule for L3-07/08/11. Two valid passing seeds are required; fewer than two measured seeds stays unmeasured. Duplicate seed IDs cannot vote twice. Existing fixture clause names and every per-seed numeric target are preserved. L3-11 counts **infected windups against the courier**, including interrupted attacks.

Unit controls cover passing/failing votes, missing observations and duplicate seeds. The ordinary engine suite remains within its test-count budget.

## Brief item 2 — fixed: retain the squad-band change without losing a pass

`465b970` was cherry-picked as `c9e675d`. It centered calm rows but also moved fighting officers closer to the infected line. A controlled low-tier seed-1 replay isolated the resulting losses:

| Formation | Officer losses after fallback in the first segment | Courier damage | Damage taken alone | Deaths |
|---|---|---:|---:|---:|
| Original rows | One at 28.70 s | 22 HP | 0 HP | 0 |
| Closer rows during combat | All four by 12.73 s | 141.13 HP | 97.13 HP | 1 |
| Centered calm rows; former combat depth | None | 11 HP | 0 HP | 0 |

The retained fix centers calm rows at 3.8/4.4 m behind the courier (about 4.2/4.8 m total distance with the 1.8 m side offset), and preserves the former 4/5 m depth during combat.

The new seed vote also exposed excessive late courier pressure. Late low-tier courier lunges now commit at the existing high-tier contact range, including contact reached during steering. The first squad segment and civilian grab approach retain their original behavior. Queued gunfire spills search their recorded noise position when their designated officer is gone or the courier fired alone; they no longer gain her later live position through admission. A native perception regression fails against the original spill code and passes with the fix.

## Seeds 1–3, both tiers

The baseline game source was verified against `7d2c9af`; the same native observers and mortal input fixtures measured both versions. L3-06 votes below refer to army arrival; calm following is reported separately. [Exact values and provenance](matrix.json).

| Clause and tier | Before | After | Result |
|---|---:|---:|---|
| L3-06 low | 2/3 | 2/3 | preserved |
| L3-06 high | 3/3 | 3/3 | preserved |
| L3-07 low | 2/3 | 2/3 | preserved |
| L3-07 high | 3/3 | 3/3 | preserved |
| L3-08 low | 0/3 | 2/3 | fixed |
| L3-08 high | 0/3 | 0/3 | **not fixed; baseline failure retained** |
| L3-11 low | 1/3 | 3/3 | fixed |
| L3-11 high | 3/3 | 3/3 | preserved |

Low-tier damage by seed: **22 / 111 / 99 → 11 / 100 / 99 HP**. Exactly 100 HP still fails its seed. Army counts: **3 / 0 / 0 → 4 / 0 / 0** on low, **0 / 0 / 0** in both versions on high.

Incoming windups/min:

- Low: **5.39 / 43.43 / 40.06 → 4.44 / 19.01 / 24.66**.
- High: **13.58 / 14.24 / 15.78 → 13.43 / 17.24 / 6.32**.

Low-tier live medians by traversed segment changed from `[20,21,20] / [20,24,24] / [22,27,25]` to `[16,23,20] / [19,21,31] / [22,27,36]`. High-tier density remains failing: `[80,115,70] / [75,102,73] / [63,111,67]`; it was 0/3 before and is still 0/3. **No baseline two-of-three pass was lost.**

Calm follow-band observations on low: **2/192 outside 3–6 m before → 0/40 after**, maximum **5.47 m** after. High tier had no eligible calm samples in either version; no high-tier calm-band qualification is claimed. Newbie low-health share remains **3/3 passing at both tiers**; low after shares are **2.62% / 0% / 0%**, high **0% / 0% / 0%**. The medkit census remains 9 / 15 / 9 (33 total). Authored population tolerances, medkit requirements and 100/200 live caps are unchanged.

## Validation

- `npm run typecheck` and `npm run lint` also pass after the scheduling change.
- `npm run verify -- E21`: **PASS** — typecheck, lint, **107/107 unit tests, 27 files**.
- `npm run qa:accept -- --level L3 --skip-browser` and the hash-matched `--reuse` refresh: exit 1, **one fresh failing row** (the retained high-tier L3-08 baseline failure), 11 incomplete rows. **12/12 checkpoint checks pass**, both control runs identical, zero fixture/checkpoint errors.
- `npm run qa:threat`: **PASS, 0 flags across all 10 levels** (native low-tier skilled/passive audit), exit 0, **322.0 s / 600 s budget**. Complete-route seed values appear in the skilled-policy column.

[Machine-readable validation](validation.json).

## Commits

- `73165ff`: common votes and seeded receipts.
- `c9e675d`: cherry-pick of `465b970`.
- `8c3e2d1`: preserve combat depth while centering calm rows.
- `0cbffb8`, `97b8385`: contact commitment, narrowed to late courier pursuit.
- `1595877`: queued spills retain the recorded noise position.
- `13ba768`, `34cdc79`: clarify incoming-rate semantics and retain every seed’s follow-band evidence.
- `58f6da1`: dispatch the longest native routes first with the same two workers, checks, seeds and 600 s budget. The final audit validates all ten receipts and keeps output order unchanged.
- `fccd7bc`: display mortal complete-route values in the skilled-policy column, including numeric per-seed rates.

Raw local receipts and controlled replays are in `test-results/r2-l3seed/`; the compact matrix accompanies this report. Generated global acceptance reports were restored after their L3 receipts were retained, keeping this lane scoped to its fixes and report.
