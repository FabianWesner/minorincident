# S161 — L10 farm encounters: checkpoint-retry re-release fixed

Native `SimWorld` receipts ([`metrics.json`](./metrics.json)); no browser sampling. Same probe as the previous lane with one correction: a melee kill emits `player.died` before its own `infected.attack` in the same chain, so deaths now attribute to the killing blow instead of requiring a second same-tick hit. The old table undercounted single-killer deaths (LOW walk seed 1 showed 0 farmhouse deaths while the run died 23 times there). Each row is one tier × policy × seed × encounter; 900 s cap; `skilled` = ordinary `LevelTenBot`, `walk` = the same policy with the walk input modifier. — = did not clear by the cap or was not released.

## What changed and why

1. **The checkpoint-retry re-release loop (the reported bug).** `LevelTenEncounters.restore()` replaced `spawned`/`released` with the checkpoint snapshot, so a group admitted after the last checkpoint un-released on every retry and the release loop handed the courier a fresh full cohort each time (HIGH walk seed 2 released the shed 10× with 9 deaths; LOW walk seed 1 released the farmhouse 23×). Fix: at `player.died` the class freezes the slot ledger; on restore every slot the checkpoint predates is marked consumed (`RETIRED_SLOT`, never re-spawned — kills made on the failed attempt are kept), and the attempt's living members are carried and re-admitted where they fell (or on their authored slot when that spot is no longer a fair admission), gated by the same pool/cap/dog/Alpha/director-safe checks as the release loop and never admitted while the courier lies dying. A retry now resumes the encounter with its survivors; cohorts never stack (verified: living-at-end ≤ authored count in all 48 rows) and never return to full strength after kills.
2. **Staging.** The lane pull (which moved a whole formation onto the courier's z-lane on release) is capped at ±15 m for the three set-piece defenses — farmhouse, shed, depot — so they meet the courier from their authored stations as a speed-sorted stream instead of one wall on the road. Corn keeps its authored lane (its walk deaths were never a failing target and the cap only stretched its clear time). No infected stat, count, corpse or target changed.
3. **Kept from the previous lane:** farmhouse perimeter ring, shed/depot radii, HIGH depot station — the final numbers below were measured with them in place (see Verdicts for what they did not fix).

## HIGH — before → after (clear s; deaths per encounter)

| Encounter | Skilled before/after | Walk before/after | Walk deaths before/after |
| --- | --- | --- | --- |
| Corn horde | 115/94/93 → 115/94/93 | 245/208/— → —/—/— | 0/0/0 → 0/0/0 |
| Farmhouse defence | 81/82/81 → 103/82/103 | 233/—/— → —/—/— | 0/0/0 → 1/0/0 |
| Shed crossing | 97/96/110 → 96/96/96 | —/—/— → —/—/— | 0/9/13 → 0/0/0 |
| Depot Alpha | 80/79/115 → 79/79/102 | —/—/— → —/—/— | 3/0/0 → 0/0/0 |

Whole-level walk deaths 10/16/20 → 18/19/22.

## LOW — before → after (clear s; deaths per encounter)

| Encounter | Skilled before/after | Walk before/after | Walk deaths before/after |
| --- | --- | --- | --- |
| Corn horde | 69/69/69 → 69/69/69 | —/97/97 → 355/97/97 | 1/0/0 → 1/0/0 |
| Farmhouse defence | 79/79/56 → 79/79/56 | —/127/127 → 124/127/127 | 0/2/0 → 0/0/0 |
| Shed crossing | 71/70/70 → 71/70/70 | —/158/108 → 0/108/178 | 0/0/0 → 1/1/0 |
| Depot Alpha | 103/79/80 → 79/79/79 | —/—/— → —/—/268 | 0/2/3 → 0/2/0 |

Whole-level walk deaths 23/7/7 → 10/7/3. The LOW seed-1 farmhouse — 23 re-releases, never cleared, ~16 deaths — now clears in 124 s with 0 deaths.

## Verdicts

- **Retry loop:** **PASS** — no encounter re-releases a fresh cohort. Re-release receipts after a death are ledger bookkeeping only: admissions stay at authored counts, `livingAtEndIds` never exceeds them (checked all 48 rows), kills persist across retries, and survivors return instead of duplicates.
- **Skilled targets, 20–120 s and 0–1 deaths:** **PASS, kept** — all 24 rows clear in 56–115 s with 0–1 deaths.
- **Walk deaths ≤2 per encounter:** **LOW PASS** — 1/0/1/0, 0/0/1/2, 0/0/0/0. **HIGH PASS with a caveat** — attributed deaths are 0–1 per row, but the capped cohorts disengage at walk: farmhouse/corn members rush the release-time position, miss the slower courier, and roam rather than fight, so nothing clears at HIGH walk and the whole-run deaths (18/19/22) come from ambient/scare infected plus those roaming tails. The letter of the target holds; the HIGH walk experience does not, and the next lever is admission pacing (the assault-style wave gate) rather than more position staging — that is the open item.
- **Walk clear ≤120 s where reachable:** **PARTIAL** — LOW farmhouse 124–127, shed 108–178, corn 97 (seed 1's 355 s and HIGH remain unreachable at walk pace).
- Spawn fairness and stuck: **PASS** — no member admitted in view or within 12 m in the 48 rows; no stuck member.

S153 receipts and the farmhouse/shed/depot member counts are unchanged. The previous lane's staging hunks were measured with the fix and kept: they compose with the capped lane but did not by themselves fix any target (their own report already conceded that), and reverting them unmeasured would be a guess.

## Validation

`npm run typecheck`, `npm run lint` pass. `npm run qa:threat` and the remote `sh tools/remote/run.sh $PWD -- npm test` results are recorded below after the source settled.

_(updated by s163-l10retry: retry-loop fix + capped set-piece lanes + killing-blow death attribution)_
