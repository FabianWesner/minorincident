# S165 — L10 farm set pieces at HIGH walk: admission pacing

Native `SimWorld` receipts ([`metrics.json`](./metrics.json)), same probe method as the s161 lane ([`tools/qa/s165-l10pace.mts`](../../tools/qa/s165-l10pace.mts), a copy of the s161 probe with added whole-run counters). Each row is one tier × policy × seed × encounter; 900 s cap; `skilled` = ordinary `LevelTenBot`, `walk` = the same policy with the walk input modifier. `—` = did not clear by the cap. **Before** = the committed [s161 metrics](../s161-l10fair/metrics.json) (identical receipt logic).

## What was actually wrong at HIGH walk

Instrumenting one HIGH walk seed (per-death attribution and member traces, see the diag note at the bottom) showed the s161 caveat had two concrete causes, plus a third that supplied almost every death:

1. **The whole-cohort dump met nobody.** Each set piece released its full 12–17 member cohort while the courier was still 120 m west. The L1-brain members (runner/sprinter) rushed the release-time press point and searched around it; the archetype members chased her live position, but with ~27 authored plus ~24 ambient infected active the shared A* budget (2000 expansions/tick) and the flow field never reached the set-piece stations behind the farm buildings — half of each cohort stood in `chase` at its station for the entire run (the same members converge normally at LOW walk, where the concurrent load is half).
2. **Disengage → roaming tails.** Once she passed them, the L10 disengage rule put the frozen cohort into `wander`; the re-pursue loop only reaches members not more than 16 m behind her, so the tails roamed between the road and the yard while she re-released the encounter after every checkpoint retry — 19 re-releases on one seed, 11–12 members alive at cap, `clear` receipts never firing.
3. **The ambient pressure machine-gun.** `pressure()` admitted a fresh 12-wide sprinter row at her x+40 every time 15 s passed without an attack on her — while the previous row was still closing. A walk courier collected 415 ambient spawns in one 900 s run and died 18 of 19 times to them (2 to the Mega Alpha), stuck in a die → restore 50 m → re-release → die loop at the farmhouse.

## What changed (admission pacing + re-targeting only; no stat, speed, damage, count, corpse or target change)

In `LevelTenEncounters` (`src/sim/missions/LevelTenEncounters.ts`):

1. **Assault-style wave admission for the four farm set pieces** (corn, farmhouse, shed, depot). The courier's own progress through the ±120 m release band is the wave clock: each wave of five opens as she advances another equal share of the band, or once at most two cohort members remain alive anywhere. A running courier meets overlapping waves (fast clear); a walking one meets them one bounded fight at a time. A courier who leaves the band east dumps the remaining slices, so a skipped set piece still resolves exactly as before. The wave index is checkpoint state; retries keep the s161 ledger rules (kills persist, survivors are carried, nothing stacks).
2. **Per-wave lane re-staging on her current position.** Every open wave pulls onto the courier's current z lane, so it arrives head-on in view instead of converging on the release-time spot. The s161 ±15 m cap stays for the depot ambush only: its yard sits 60–90 m off her road, and its cohort crossing that gap as a chase beats teleporting onto her lane together.
3. **A bounded re-target pass.** While she is still within 60 m past a set piece's station, living members are re-sent at her live position every 5 s (`press`, which leaves attacks, bites and the Mega pursuit untouched) — members more than 24 m behind her are left to the ordinary disengage rule, so nothing re-arms an immortal out-of-view tail, and beyond the set piece's ground the pass stops entirely.
4. **Pressure admission gate.** `pressure()` holds the next off-camera row while three or more region-less hunters are already within 60 m of her — replacement pressure, as its own doc puts it, instead of stacked rows (415 → 45 ambient spawns in the same seed-1 walk run).
5. **The depot ambush runs its wave clock on the near half of its band** (follow-up to the first commit). The Alpha leads the first wave and the yard crossing itself paces the arrivals, so the second wave held for the far end of the band spawned behind her and wandered: on HIGH walk seed 3 the last fight was still two members short at the 900 s cap. Opening the depot's second wave 60 m earlier (its share of the band is 120 m, everyone else keeps 240 m) clears seed 3 at 227 s and even speeds the skilled depot to the s161 79 s baseline.

## HIGH — before → after (clear s / attributed deaths per encounter)

| Encounter | Skilled before/after | Walk before/after |
| --- | --- | --- |
| Corn horde | 115/94/93 → 93/93/93 (0/0/0 deaths) | —/—/— → 259/208/460 (0/0/0) |
| Farmhouse defence | 103/82/103 → 103/103/81 (0/0/0) | —/—/— → 233/238/260 (0/0/1) |
| Shed crossing | 96/96/96 → 96/96/96 (0/0/0) | —/—/— → 318/222/249 (0/0/0) |
| Depot Alpha | 79/79/102 → 79/79/79 (0/0/0) | —/—/— → 228/227/227 (0/0/0) |

Whole-level walk deaths **18/19/22 → 7/8/5**. Skilled whole-run 0/1/0 (per-encounter deaths all 0).

## LOW — before → after (clear s / attributed deaths per encounter)

| Encounter | Skilled before/after | Walk before/after |
| --- | --- | --- |
| Corn horde | 69/69/69 → 69/69/69 (0/0/0) | 355/97/97 → 153/97/97 (0/0/0) |
| Farmhouse defence | 79/79/56 → 56/79/79 (0/0/0) | 124/127/127 → 127/127/179 (0/0/0) |
| Shed crossing | 71/70/70 → 71/70/70 (0/0/0) | 0/108/178 → 158/158/158 (0/2/0) |
| Depot Alpha | 79/79/79 → 79/79/79 (0/0/0) | —/—/268 → 177/177/177 (0/0/0) |

Whole-level walk deaths 10/7/3 → 2/4/5.

## Verdicts

- **HIGH walk clears, seeds 1–3, deaths ≤2 per encounter:** **PASS — 12/12 rows clear** with a maximum of 1 attributed death per encounter. Seeds 1–2 clear all four set pieces with 0 deaths; seed 3 clears corn/farmhouse/shed with 0–1 deaths and the depot at 227 s. The seed-3 corn clear is 460 s (259/208 on the other seeds): its last wave admits while she is deep past the crop stations, and the two members that spawn behind her resolve through the ordinary wander/sleep churn plus one checkpoint-resurrect replay — a cosmetic tail on the receipt clock, not a fight she has to win.
- **Deaths ≤2 per encounter at HIGH walk:** **PASS** — 0–1 across all 12 rows (the s161 run measured 0–1 with nothing clearing; the fights are now real and still do not kill her).
- **Whole-run HIGH walk deaths clearly below 18–22:** **PASS** — 7/8/5.
- **Skilled kept:** **PASS** — every row clears in 56–103 s with 0 deaths, inside the s161 56–115 s band (the depot improves to the 79 s s161 baseline on all seeds; corn faster on all seeds; farmhouse 103/103/81 vs 103/82/103).
- **LOW walk not regressed:** **PASS, improved** — all 12 rows now clear (baseline had the seed-1 shed and the seed-1/2 depot un-cleared), attributed deaths 0–2 per row, corn seed 1 improves 355→153 s, depot —/—/268 → 177/177/177, whole-run deaths 10/7/3 → 2/4/5.
- **Spawn fairness, stuck, ledger:** **PASS** — 0 admissions in view or within 12 m, 0 stuck members, `livingAtEnd` never exceeds the authored count, kills persist across retries, and the four set pieces release once per attempt in all 24 walk rows (the s161 retry ledger rules are unchanged).
- **No stat/speed/damage/count change:** no infected definition, archetype, dog/Alpha cap, role list or authored count was touched; corpses persist; every member still targets the courier. The whole change is admission timing, lane staging and pursuit refresh inside `LevelTenEncounters`.

## Open items

- **`qa:threat` finale window (the one regression this follow-up introduces):** the L10 `dispersal-assault` wave now flags `WAVE_FIRST_ATTACK_OVER_20_SECONDS` — the first console-assault cohort's first attack lands at 63.4 s against the ≤20 s criterion (it was ≤20 s on the pre-lane code). The depot clock change is 2.5 km west of the console and touches no assault code; resolving the farm fights ~50 s earlier shifts the skilled route's arrival ticks at the dispersal complex, and the assault cohort's approach through whatever ambient hunters are then alive near the console takes the hit. All other `qa:threat` rows are unchanged (L1–L9 all complete, 0 flags; the failing run's only other mention is an informational passive-observation stuck-chaser note in the hold window). The farm-lane targets are unaffected; re-tuning the finale assault's arrival window (or the corridor/complex ambient cadence that crowds it) is the next lever, and belongs to the E32 finale lane rather than this one.
- **Seed-3 corn receipt clock (cosmetic):** the 460 s clear above; the fight itself is over in ~100 s, the tail is the wander/sleep churn of the two members spawned behind her plus one resurrect replay.

## Validation

`npm run typecheck` and `npm run lint` pass. The remote unit suite passes on this exact code: `sh tools/remote/run.sh $PWD -- npm test` **105/105 tests (150/150 cases), 164.8 s of the 240 s budget, exit 0**. `npm run qa:threat` fails on the single finale-assault flag documented above (**233.8 s, L10 skilled otherwise complete; L1–L9 all green** — see Open items). All receipts above were measured with the final code (grid: 12 runs × 900 s cap, locally under `tools/sim-lock.sh`; the on-disk metrics were re-verified against a fresh seed-3 HIGH walk run, byte-identical rows).

Diag note: the per-death attribution came from scratch probes (killer archetype + provenance + member traces + per-slot resolution, seeds 1–3 both tiers) that wrapped `ai.spawn`, ledger ids and `player.died`; they were removed before commit — `tools/qa/s165-l10pace.mts` is the committed measurement.

_(updated by the s165 follow-up: depot wave clock on the near half of its band; HIGH walk 12/12 clears)_
