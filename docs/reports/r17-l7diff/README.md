# R17 — L7 difficulty with strong Alphas

**Goal achieved: 6/6 completions, zero courier deaths, strong Alphas retained. All nine other levels reproduce their baseline threat receipts.** Frozen runtime: `dd370e96`; game source SHA-256 `e71de80a6adca1ef8205fe67a9317b1a0f785de89047d029d41f439db07682e4`.

The selected balance gives ordinary L7 runner lunges **2 HP courier damage**, down from 10 HP. Alphas retain **450 HP**, full damage, type identities and move sets. Every complete run admits **five Alphas** and **200/400 regular infected on low/high**. Windups, moving lead, reach, attack cadence, populations, rocket safety/cadence, loadout, regeneration and follower bite damage are unchanged.

**Escort rescue remains poor:** low seeds board 18/15/9 survivors; high seeds board **0/2/0** of the original 24. These are real casualties under the existing continuing-campaign rule, which permits zero-survivor completion. Courier completion does not establish improved group rescue or a clean follower pace gate.

## Native completion

Ordinary mortal `runLevel('L7', 'complete', seed)`, default presets and default 1,200-second observation budget, seeds 1–3 at each actual population tier. Hooks only observe the run. Health, ammunition and qualification are unmodified. The original firing policy and mission boarding rules remain in use.

| Tier | Seed | Main outcome / seconds | Final seconds | Courier deaths | Accepted damage | Boarded / 24 | Courier / group attacks per minute |
|---|---:|---|---:|---:|---:|---:|---:|
| low | 1 | complete / 116.37 | 120.30 | 0 | 76 | 18 | 77.81 / 24.44 |
| low | 2 | death / 74.78 | 115.98 | 0 | 94 | 15 | 101.91 / 25.35 |
| low | 3 | complete / 120.12 | 117.78 | 0 | 114 | 9 | 115.64 / 33.11 |
| high | 1 | death / 105.32 | 125.15 | 0 | 154 | 0 | 504.83 / 38.83 |
| high | 2 | death / 64.52 | 133.00 | 0 | 167 | 2 | 410.98 / 36.99 |
| high | 3 | death / 101.13 | 118.03 | 0 | 121 | 0 | 413.27 / 43.21 |

All six final runs have **zero collision invariant failures**. Accepted damage can exceed 100 HP over a run because the existing regeneration remains active. Damage totals sum positive `combat.hit.amount` events; the existing L7 runner leaves `LevelReport.damageTaken` at zero on failure. Zero-damage contact events are excluded. Attacks/min counts attack starts, including interrupted or missed attacks; accepted positive damage is recorded separately.

[Full native receipts](evidence/native-final.json.gz), [final damage/special/position traces](evidence/native-final-traces.json.gz), [fresh pinned-main receipts](evidence/native-main.json.gz), [main damage traces](evidence/native-main-traces.json.gz), [all matrices](evidence/native-matrix.json).

## What causes the failures

The brief's assumed chronology is inaccurate: R16's pinned main `8622b6d1` already descends from both R14 merges. Fresh runs on the brief's actual baseline `775b3463` reproduce its 2/6 result. Native runs at the requested historical boundaries show that the route was already failing before Alpha types merged:

| Tier / seed | Before Alpha merge `9564f4de` | After Alpha merge `78219de9` | After moving merge `03ed96bb` |
|---|---|---|---|
| low / 1 | death 43.80 s | death 43.80 s | complete 116.37 s |
| low / 2 | death 44.13 s | death 44.13 s | death 74.78 s |
| low / 3 | death 44.35 s | death 44.35 s | complete 120.12 s |
| high / 1 | budget 1,200 s | budget 1,200 s | death 105.32 s |
| high / 2 | death 43.37 s | death 43.37 s | death 64.52 s |
| high / 3 | budget 1,200 s | budget 1,200 s | death 101.13 s |

The four deaths before/after the Alpha merge each take 100 accepted HP entirely from ordinary runners. The two high-tier capped cases record zero attacks. Alpha type moves do not change these outcomes or death times.

On current main, three of the four deaths take **all accepted damage from ordinary runners**. High seed 1 takes 140 runner damage plus one 30 HP Alpha object throw. The traces show repeated moving lunge contacts; they do not show a grab/throw damage chain accounting for the deaths. Alpha stun and positioning still contribute indirectly.

The moving merge also corrects L7 spawns onto Northgate's raised street layer. A controlled ablation on `03ed96bb`, omitting only that explicit spawn Y, changes low/high seed 1 from completion/death to two 180-second capped diagnostic runs; high seed 1 records zero hit events. Removing the layer correction suppresses proper contact and does not produce a valid balance solution. Both the layer correction and moving-hit behavior are retained.

[Before Alpha receipts](evidence/native-before-alphas.json.gz), [after Alpha receipts](evidence/native-after-alphas.json.gz), [after moving receipts](evidence/native-after-moving.json.gz), [spawn-layer ablation](evidence/spawn-layer-ablation.json.gz).

## Changes and scope

- `l7Encounters.courierLungeDamageScale = 0.2` applies only to an ordinary `infected.runner` lunge targeting courier ID 1 in L7. Alpha damage and follower damage keep their existing paths.
- L7 continues sampling logical road support while Alpha stun disables controls. The regression holds the capsule on a 3.9 m support through 89 stunned ticks, prevents held movement, then verifies a real missing support still permits a fall. The [native prefix comparison](evidence/stun-support-prefix.json) also shows main falling through the road during stun while the final courier stays supported. Other levels retain their previous support behavior.
- The L7 completion bot enables the existing corpse-aware planner after physical contact with a large corpse. It retains its route and firing policy. The planner's Cure-platform branch is excluded specifically for L7.
- The bot computes its original wait-band formula from the last occupied survivor row. Casualties leave holes in slot numbering; they do not shorten a surviving tail's assigned row. The mission's 18 m group rule remains intact.

Shared Alpha definitions, special controllers, object throws, damage resolver, weapon catalog and the encounter controller match pinned main byte for byte. Native traces still record active charge, ground slam, roar, object throws and living missiles. [Alpha activity](evidence/alpha-activity.json), [source scope and hashes](evidence/source-scope.json). No dependencies, specs, layouts, assets or protected reference files changed.

## Pressure and multi-direction attacks

The final no-fire control preserves ordinary movement and mortality and disables only attack input. **All six controls die**, in 14.17–91.47 seconds. Alpha damage supplies 44–68 HP in five of those deaths; the remaining run takes its final 14.4 HP from an Alpha. [Mortal control receipts](evidence/mortal-final.json.gz).

Every skilled run records attacks from all four cardinal bearings. The separate overlapping-windup probe records **five approach sectors in streets, three in the corridor and three at the bus**, with entry bearings sampled at 6–12 m. These are overlapping real windups; neighboring 45° sectors are distinct sectors, not proof of 90° separation. [Crossfire receipt](evidence/crossfire-final.json).

The unchanged official L7 passive criterion requires courier + group attacks/min **≥6** in `step/corridor`. The final measurement is **202.50 + 58.25 = 260.76/min** over 86.52 seconds. The skilled corridor measures **106.66 + 30.67 = 137.34/min**. The separate retreat probe lands **3 moving hits/min**, above its unchanged ≥2 floor. The standard passive observer protects courier health for pressure measurement; it is separate from the mortal no-fire control above.

The focused audit exits 1 with two known follower checks and the mandatory partial-selection flag: `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT`, `phase/encounters:FOLLOWER_PACE_UNOBSERVED:63`, and `PARTIAL_LEVEL_SELECTION`. It is not a clean campaign threat gate. No pressure floor or follower qualification was changed. [Complete focused receipt](evidence/pressure-final.json.gz).

## Other levels and repository checks

Full native/passive threat receipts for **L1–L6 and L8–L10 match pinned main exactly**, excluding only each level’s elapsed wall-clock time. All **25 stages, 168 primary phase rows, nine native state hashes, flags and extra qualification data** match. The standard audit uses low quality plus the L4 high-tier hold and its normal additional L3/L5 seeds.

| Level | Passive phase | Courier APM before → after | Group APM before → after | Matching native hash |
|---|---|---:|---:|---|
| L1 | `phase/spread` | 32.49 → 32.49 | 0.00 → 0.00 | `fd9463a7` |
| L2 | `phase/collapse` | 141.33 → 141.33 | 0.00 → 0.00 | `d881c150` |
| L3 | `step/defend` | 79.70 → 79.70 | 0.00 → 0.00 | `532e8221` |
| L4 | `step/hold` | 1122.63 → 1122.63 | 0.00 → 0.00 | `5061c9fa` |
| L5 | `step/look` | 372.82 → 372.82 | 0.71 → 0.71 | `b19eda42` |
| L6 | `step/stop` | 165.58 → 165.58 | 179.86 → 179.86 | `225645f9` |
| L8 | `step/escape` | 269.33 → 269.33 | 52.67 → 52.67 | `a9c213b2` |
| L9 | `phase/driving` | 0.72 → 0.72 | 0.00 → 0.00 | `0d7d6249` |
| L10 | `step/hold` | 465.14 → 465.14 | 0.00 → 0.00 | `fd223748` |

L9’s row is its driving observation; the on-foot kiting floor remains N/A there. The [complete phase-by-phase numbers](threat-parity.md) retain every primary skilled and passive row. [Parity receipt](evidence/other-levels-parity.json), [baseline audit](evidence/other-levels-before.json.gz), [final audit](evidence/other-levels-after.json.gz). Each nine-level command exits 1 solely for partial level selection; all nine individual passive gates are clear.

`npm run verify -- E29` passes on an isolated runner: **typecheck, lint, 106 tests passed / 1 skipped in 27 files**. Vitest takes 83.74 seconds; its wrapper takes 88.7 seconds against the unchanged 240-second budget. Collection remains **150/150 cases and 43/45 files**. The per-change gate includes `npm test` (`test:unit` is an alias), with at most four Vitest workers. [Verification receipt](evidence/verification.json), [full log](evidence/verify-log.gz).

The first gate launch stopped before testing because the remote manifest index lacked Git blob objects. The successful run hydrates that index with `git add --renormalize .`, then creates a disposable snapshot commit for Git-dependent tool tests. This setup changes only the private runner snapshot.

## Reproduce

Run heavy commands through the runner wrapper and explicitly pull their artifacts:

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-l7diff -- \
  node --import tsx/esm tools/qa/r17-l7diff.ts reproduce

MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-l7diff -- \
  node --import tsx/esm tools/qa/r17-l7diff.ts reproduce-mortal both 1,2,3 mortal-passive

MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-focused-threat -- \
  node --import tsx/esm tools/qa/threat-audit.ts \
  --levels L7 --out test-results/r17-focused-threat --maxWorkers 4
```

Focused threat runs report partial level selection and can retain existing follower flags; they are diagnostic receipts. Historical matrices use the same portable `r17-l7diff.ts` observer in detached checkouts at the three named commits, after `tools/worktree-setup.sh`.

[Requirement-by-requirement completion audit](evidence/completion-audit.json), [checksummed evidence manifest](evidence/manifest.json).

No browser, push or deployment was performed. **Browser QA needed** for the stun support presentation, stronger Alpha encounters, corpse routes and the heavy escort casualties. No visual verification is claimed by this lane.
