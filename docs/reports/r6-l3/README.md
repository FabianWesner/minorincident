# r6-l3: L3 kiting, infected counts and squad survival (Opus, PO 2026-11-07)

PO, verbatim (PROD batch 58):
"(1) Far too many Zombies. The police crew that should follow me has zero chance to survive
(2) Although I am faving dozens of Zombies at once, I can just walk through it without problems (I walk and shoot backwards, so no Zombie can attack me). This is a gameplay glitch, as it's too simple."

PO follow-ups during the lane: "L4 is still good as is. Make sure you don't change it when fixing L3"; "The gun shut not let Zombies fall back (that's why they cannot catch up)"; "No, just modify the effect of the hand gun and keep the others as is."

Baseline `0f85e3c8`. No deploy, no push. All measurements are native sims (real `InputFrame`s, no teleports). No browser captures were taken, because the change has no visual part.

## Causes of (2), measured

`tools/qa/r6-l3-kite.ts` runs the ordinary `complete` bot to the fallback. After that it runs the army route at full input while aiming and holding fire with the handgun on the nearest visible infected. It counts infected windups that target the courier and strikes that reach her. Results for seeds 1–3, before the fix:

| Tier | Windups/min, whole run | Windups/min in S2–S3 | Strikes/min in S2–S3 | Infected within 15 m in S2–S3 |
|---|---|---|---|---|
| low | 13.6 / 18.8 / 23.5 (all in the yard exit) | **0 / 0 / 0** | 0 / 0 / 0 | 4.9 / 8.1 / 7.9 |
| high | 3.2 / 5.1 / 2.0 | **0 / 0 / 0** | 0 / 0 / 0 | 18.4 / 18.2 / 17.9 |

The PO's reading was correct: dozens of infected are around her, and none of them can attack.

There are two causes. Each was isolated by changing it alone.

1. **The handgun stagger (the PO's cause).** This was L3 mission code (`LevelThreeCollapse`, brief l3-polish). Every courier handgun hit gave the target a 0.25 s stagger and cancelled its windup. At 3 shots/s this froze every pursuer she aimed at. The handgun's catalog entry has knockback 0 and stagger 0, so this hook was the handgun's only pushback in the whole game. **Removed** (commit `b604e3d6`). Removing it alone raised the high-tier windups in the first street. In S2–S3, however, the count stayed at **0** on both tiers (`kite-*-nostagger.json`).
2. **The retreat commit range sat inside the separation ring (the dominant cause).** After the fallback, an L3 runner commits to a lunge only within `l3.infected.retreatLungeM` = **0.9 m** (r2-l3seed). Crowd separation (`CharacterSeparation.meleeRing`) keeps every infected **≥ 1.08 m** from the courier. One steering step closes at most 0.067 m, so no runner could ever start a windup on a moving courier in S2–S3. That is the "walk through dozens" effect. The fix sets the range to **1.4 m** on both tiers. With the stagger removed and the range at 1.4 m, before the count changes, S2–S3 windups went from 0 to 10–55/min (`kite-*-l14.json`). A new test assertion requires the range to stay above `meleeRing` (`tests/engine/infected-ai.test.ts`).

Things I checked and left alone. The courier runs at 4.5 m/s and L3 regulars at 4.0 m/s, so a courier who runs away without fighting still escapes, as L3-09 intends. Raising the L3 chase speed to 4.6 or 5 m/s changed nothing measurable while the commit range was 0.9 m. I tried a slower backpedal/strafe while aiming and reverted it, because the PO's direction was to change the handgun only and not to limit controls.

### Per-weapon pushback (only the handgun row changed)

| Weapon | Knockback (m) | Stagger (s) | Change |
|---|---|---|---|
| handgun | 0 | 0 (was **0.25 s per courier hit in L3**, plus a windup cancel) | **L3 hook removed**. In the other levels the handgun had no pushback before, so L4/L5/L7 handgun behaviour is unchanged |
| pistol (reference gun) | 0 | 0 | unchanged |
| army MG / machine gun / SMG | 0 | 0 | unchanged |
| shotgun | 1.8 (8-tick slide) | 0.65 | unchanged |
| rocket launcher | 1.2 + blast | 0.8 | unchanged |
| bat | 0.25 (roundhouse 0.45) | 0.2 (0.3) | unchanged |
| fire axe | 0.4 (roundhouse 2.5) | 0.2 (0.8) | unchanged |
| fists | 0.2 | 0 | unchanged |
| kick | 1.2 | 0.2 | unchanged |

Player melee knockback is capped at 0.4 m in `Damage.ts` (kicks and sweeps excepted). That rule is unchanged. Police and army guns in L3 keep their own stagger (ally gun code), which is also unchanged. The hit flinch animation stays visual only.

## Causes of (1), measured

Before the fix, the `complete` bot in the qa:threat fixture brought **0 officers to the army line on all 6 seed/tier runs**. The loss positions show where it happens: most squads died at the yard exit (x −120…−107) within 2–3 s of the fallback. Live infected were 27 or more, from the station waves, and 9–13 of them stood within 5 m of an officer. A single bite turned an officer at full health.

Changes (`src/data/l3.ts` unless noted):

| What | Before | After |
|---|---|---|
| Station waves | 30 / 60 / 100 high, 15 / 30 / 50 low | **15 / 25 / 35 on both tiers** (low ×1; the station-door fifth stays a whole number) |
| Live cap | 200 high / 100 low | **140 high / 100 low** (low is now L3's own value in `SpawnDirector`, no longer half the high cap) |
| S1 live budget | 40 (low 20) | **30 on both tiers** |
| Street residents per segment | ×25 → 250 / 625 / 1000 (incl. 2 × 125 horde) | **×12 / ×10 / ×18 → 125 / 240 / 710** (incl. 2 × 60 horde) |
| Side-street spills | 50 / 75 | **30 / 45** |
| Bite on a following squad officer | turns him at once | **costs 40 HP first, and the biter is shoved off for 0.75 s; the third bite turns him** (the L7 evacuee rule, `InfectedSystem.woundL3Officer`) |

Not changed: idle forward pressure (L3-10), medkits, officer guns, the fallback rule, and infected speed.

## Before and after: same native fixtures as qa:threat / qa:accept (seeds 1–3)

| Measure | low before | low after | high before | high after |
|---|---|---|---|---|
| Squad at the army line, competent (L3-06) | 0 / 0 / 0 | **4 / 4 / 0** | 0 / 0 / 0 | **0 / 4 / 4** |
| Squad at the army line, newbie bot | — | 4 / 4 / 4 | — | 3 / 2 / 0 |
| Squad at the army line, kiting run | 0 / 0 / 0 | 0 / 2 / 4 | 0 / 0 / 0 | 4 / 4 / 0 |
| Kiting windups/min, whole run | 13.6 / 18.8 / 23.5 | **35.0 / 14.8 / 4.6** | 3.2 / 5.1 / 2.0 | **5.9 / 6.4 / 27.3** |
| Kiting windups/min in S2–S3 | 0 / 0 / 0 | **14.0 / 8.4 / 0** | 0 / 0 / 0 | **5.6 / 4.2 / 16.8** |
| Kiting strikes landed/min, whole run | 3.2 / 4.5 / 6.4 | 14.7 / 5.2 / 0.7 | 0 / 0 / 0 | 1.3 / 1.9 / 13.3 |
| Kiting deaths (mortal, 150 s) | — | 0 / 0 / 0 (damage 165 / 66 / 11 HP) | — | 0 / 0 / 0 (22 / 33 / 154 HP) |
| Competent attacks on courier/min, route (L3-11, 3–25) | 9.9 / 17.6 / 26.8 | 30.2 / 2.8 / 5.3 | 8.5 / 12.9 / 1.0 | 43.2 / 6.4 / 2.7 |
| S1 officer hits / player damage HP (L3-07) | 150/11, 196/100, 38/99 | 180/102, 157/11, 93/11 | 27/44, 156/11, 44/0 | 185/22, 186/0, 195/22 |
| Live within 30 m, S1/S2/S3 median (L3-08) | 18/28/45, 20/24/49, 22/29/67 | 17/21/25, 11/24/18, 17/23/24 | 72/72/79, 77/96/76, 59/92/77 | **10/32/42, 13/33/40, 9/35/37** |
| Max concurrent | 100 | 100 | 200 | 140 |
| Competent courier deaths (losses probe) | 0 / 1 / 0 | 1 / 0 / 0 | 0 / 1 / 0 | 3 / 0 / 0 (seed 1) |

Exact values: [evidence.json](evidence.json).

Reading the numbers. On high, the PO's on-screen count drops from 60–96 to 9–42 live infected within 30 m. The squad now usually reaches the army line with a protecting player, and a kiting player usually loses it. Kiting is no longer free: windups land in every street segment, and a kiting courier takes 1–15 hits/min. At the windups/min floor it never died in 150 s, which matches "dangerous but fair". The results are bimodal by seed: when the squad dies early, the courier takes 30–43 attacks/min; when it survives, she takes 3–6.

## Gates

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 106/107. The one failure is `tests/tools/gate-tools.test.ts` (`reviewFreshness` → STALE). This is caused by the environment: `slim-worktree.sh --no-assets` removed 3,820 tracked asset files, so the working-tree digest differs from HEAD. It does not involve the code. The L3-specific `tests/engine/infected-ai.test.ts` passes after its update.
- `npm run qa:threat` on all 10 levels (remote runner, game code of `005d1512`, which is unchanged in later commits): **1 flag, `L3-11 native competent rate`** (low s1 30.19 / s2 2.75 / s3 5.29 → 1/3). All other L3 criteria PASS: L3-02 cohorts 15/25/35, stream, alarm frame; L3-03; L3-06 (2/3 ≥ 2); L3-07 (2/3); L3-08 (2/3 low). L1, L2 and L4–L10 have 0 flags.
- `npm run qa:accept -- --level L3 --tier both --skip-browser`: 1 fresh failing row (**L3-11**, the same competent-rate vote on both tiers: low 30.2/2.8/5.3, high 43.2/6.4/2.7). L3-03 currently PASS. L3-16 is an older manual FAIL (smoke), unrelated. 12/12 checkpoint checks PASS, controls identical, 0 fixture errors. Generated central reports were restored; the copy is in `test-results/r6-l3/accept/`.

### L1, L2, L4, L5 unchanged (PO: "L4 is still good as is")

Every game change is scoped to L3 (`scenario === 'L3'` branches, the L3 mission and L3 data). I ran `qa:threat --levels L1,L2,L4,L5` on the Mac, once with `src/` at the baseline and once with the final `src/`. Same machine, same tools. The **native state hashes are identical for all four levels**, with **0 differing phase rows** (attacks, attacks/min, first attack, spawned; skilled and passive). The L4 high hold is identical (first breach 52.72 s level / +19.9 s alarm, 70 alive at the breach, peak 95, plaza min 49). Deaths are identical. Receipts: `test-results/r6-l3/compare-L1245.json`.

## Criteria updated (docs/qa/level-acceptance.md, each marked "PO 2026-11-07")

- **L3-02**: waves 15 / 25 / 35 on both tiers.
- **L3-06**: **≥ 2 officers at the army line** for the competent run, 2 of 3 seeds per tier (was ≤ 2). Officer bite rule: 40 HP per bite. Careless play still loses the squad: the kiting run arrives with ≤ 1 officer on ≥ 1 seed per tier (measured: low seed 1 → 0, high seed 3 → 0).
- **L3-07**: "overwhelmed is the point" is replaced by the L3-06 chance.
- **L3-08**: 125 / 240 / 710 ±20 %; caps 140 high / 100 low.
- **L3-11** (folded in, because the acceptance inventory is fixed at 169 rows): kiting is not a safe line. The kiting run draws **≥ 5 windups/min** and **> 0 in S2–S3**, 2 of 3 seeds per tier (after: low 2/3, high 3/3; before: high 1/3, S2–S3 0 everywhere). The handgun never staggers. The commit range lies outside the separation ring.
- Tooling follows the data: `l3ArmyLine` uses `≥ armyLineMin`. L3-02 cohorts, the census and L3-08 targets/caps read `src/data/l3` (`l3WaveCount`). The 2-of-3 seed votes are unchanged.

## Open

- **L3-11 competent rate fails (1/3 per tier).** With the squad alive, the careful bot is attacked only ~3/min (babysat). When the squad dies, the rate rises to 30–43/min. Two single-knob trials made the squad vote fail instead: squad shot interval 0.45 s (high army 0/4/0) and squad gun damage 20 (low 4/0/0, high 0/0/3). The 3-seed bot result is chaotic under small changes. Suggestion for the next lane: let the squad thin the street rather than wall it off, for example an engage range shorter than 18 m, so attacks reach the courier while the squad lives, and lower the upper bound pressure when it dies. Alternatively, the PO could confirm 3–25 as the right band for a level whose danger now depends on the squad.
- Competent high seed 1 had 3 courier deaths (E21 band 0–2) on the run where the squad died at the yard.
- Perf was not measured (perf pending). Live caps are lower than before, so it should not get worse.
- PO play needed: whether the kiting hits (1–15/min) feel fair, and whether the yard fight still reads as a police collapse with 15/25/35 attackers.

## Commits

`b604e3d6` handgun stagger removed, commit range 1.4 m, first count cut, officer bite rule · `49478050` bite 40 HP, residents, spills, L3 low cap / S1 budget · `0cf1ca41` waves 15/25/35 · `a098706d` tooling and test · `7efa1ba7` criteria · `005d1512` per-segment residents · `24fe93e2` kiting clause folded into L3-11 · `bc20115f` wave census from data · (this report).
