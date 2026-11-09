# R17 — L7 escort survival

**Goal met and verified.** Low seeds 1–3 board **24/24 each**. High seeds 1–3 board **23/24, 21/24, 24/24**. All six courier runs complete without death or collision failures. The minimum rescue rate is **87.5%**, above the requested 60% (15 people).

Frozen runtime: `1096efee474490c6ddab49084122bbc07d7c7db7`; source SHA-256 `fb925a584e7a6df0c2a10c57505210985dc3771978bda3fcf5ffc090dcb73043`. Baseline is the brief's pinned main, `7c2583f10d35c1044b998533511bc06d4424b9d6`, with the expected source hash `e71de80a6adca1ef8205fe67a9317b1a0f785de89047d029d41f439db07682e4`.

The final runtime diff changes two L7 balance values and one bot waypoint tolerance:

- A completed ordinary bite on an evacuee takes **5 HP**, down from 34. A 100 HP evacuee dies on the twentieth completed bite. The one-second grab, rescue window, 45-tick biter recoil, health bars, infection/death path and lack of follower regeneration remain in use.
- An ordinary runner lunge on the L7 courier takes **1.5 HP**, down from 2. This covers the longer exposure while the larger living group boards. The existing regeneration and opening grace are retained.
- The L7 bot advances tight corner waypoints within **0.7 m**, up from 0.3 m, while retaining ordinary swept movement and obstacle routing. Surviving-group trials exposed a corner where the capsule stopped about 0.6 m from the requested point and the exact arrival condition could never advance.

## Native evidence

Ordinary mortal `runLevel('L7', 'complete', seed)`, default presets, actual low/high populations and the default 1,200-second observation budget. Hooks only observe these skilled runs; no health, input, ammunition or qualification override is active. The original firing policy and passenger rules remain in use.

| Tier | Seed | Main → final boarded | Seconds | Courier deaths | Accepted courier damage | Alpha attack starts/min, main → final |
|---|---:|---|---:|---:|---:|---:|
| low | 1 | 18 → **24 / 24** | 128.67 | 0 | 36.0 | 2.49 → **4.20** |
| low | 2 | 15 → **24 / 24** | 120.33 | 0 | 101.5 | 7.76 → **9.47** |
| low | 3 | 9 → **24 / 24** | 116.40 | 0 | 78.5 | 5.60 → **6.19** |
| high | 1 | 0 → **23 / 24** | 132.88 | 0 | 136.0 | 10.55 → **14.00** |
| high | 2 | 2 → **21 / 24** | 145.12 | 0 | 197.0 | 9.02 → **18.61** |
| high | 3 | 0 → **24 / 24** | 132.77 | 0 | 107.5 | 8.13 → **10.85** |

All six cases admit **five 450 HP Alphas** and **200/400 ordinary infected on low/high**. Alpha attack rates exceed pinned main **in every case**. Counts include real attack windups and contact grabs, including later interruptions or misses; they are not successful-hit rates. Roar activity is retained separately in the special-event traces. Every run records attacks from all four cardinal bearings.

Every boarded original id is alive and included in the exact L8 transfer payload. The final group rescues 140 of the original 144 people across the six independent runs. Accepted courier damage can exceed 100 HP because the existing regeneration remains active.

[Full final receipts](evidence/native-final.json.gz), [final damage/special/roster traces](evidence/native-final-traces.json.gz), [fresh pinned-main receipts](evidence/native-main.json.gz), [main traces](evidence/native-main-traces.json.gz), [all trial matrices](evidence/native-matrix.json).

## Cause and rejected trials

Fresh main reproduces **18/15/9 boarded on low and 0/2/0 on high**. Every one of its 100 follower losses matches a completed ordinary fatal bite. There are **zero Alpha damage hits on a still-living follower in all six baseline traces**. High seeds 1 and 2 lose 19 people by 30 seconds; high seed 3 suffers its largest later losses around the second street group and corridor.

The mismatch was the ordinary crowd damage budget: the courier took 2 HP lunges and regenerated, while each follower took 34 HP completed bites without regeneration. Repeated grabs consumed the entire group under the high population before it could reach the bus. Lowering only to 17 or 10 HP was insufficient on all seeds. At 5 HP, the group survives the ordinary crowd long enough to board; the courier's 1.5 HP chip value prevents the extra boarding exposure from killing her in high seed 2.

Courier-priority targeting, rotating/trail/compact formations, tighter courier wait bands, extra guard support, defensive rocket targeting and physical contact shoves were tested and rejected. They introduced courier deaths, poor high-tier rescue, collision failures or live-follower corner stalls. All of those runtime changes were reverted. The [matrix](evidence/native-matrix.json) retains completion, rescue, source identity, collision and Alpha-rate results for each trial.

Shared Alpha definitions, move controllers, throws, damage resolver, weapon catalog, encounter placement, follower movement and bus controller match main byte for byte. Alpha damage, 450 HP toughness, resistances, attack cadence and move selection are intact. [Source scope and hashes](evidence/source-scope.json).

## Mortality and repository checks

The six separate **mortal no-fire controls all die**, in 14.80–75.30 seconds. They retain the route and mortality and disable only attack input. Alphas contribute accepted damage in five controls. [Control receipts](evidence/mortal-final.json.gz), [control traces](evidence/mortal-final-traces.json.gz).

The follower mortality fixture retains the fatal-bite assertion and the same observation budget. It isolates one live evacuee from other residents' routines and courier targeting, so it can prove the entire twenty-bite health sequence on one target.

`npm run verify -- E29` passed on the frozen runtime, with the final fixture revision `2bf53600`. E29 now dispatches the repository's per-change gate:

| Check | Status | Seconds |
|---|---|---:|
| `npm run typecheck` | pass | 54.493 |
| `npm run lint` | pass | 32.799 |
| `npm test` (`test:unit` alias) | 106 passed, 1 existing skip | 139.227 |

The passive collection check remains **150 cases / 43 files**. No test cases or test files were added, no test budget was raised, and no browser project was run. The final gate held both remote slots and used **two Vitest workers**, preserving the 30-second per-test and 240-second suite limits. Navigation's combined test passed in 21.55 seconds. A preceding four-worker gate timed out that test at 30 seconds; the [failed gate receipt](evidence/verify-four-workers-timeout.json), [failed log](evidence/verify-four-workers-timeout.log.gz) and [focused 4/4 pass](evidence/focused-navigation.log.gz) are retained.

[Final check identity and timings](evidence/verification.json), [full successful log](evidence/verify-log.gz).

## Every other level

Fresh pinned-main and final audits each ran 25 simulation stages. The **entire per-level receipts match exactly** for L1–L6 and L8–L10, excluding only elapsed `wallSeconds`. This includes all **168 primary skilled/passive phase rows**, L3 army-line seeds, L4 high hold and L5 follower-pace seeds. Every level has zero passive flags.

| Level | Main and final native state hash | Receipt |
|---|---|---|
| L1 | `fd9463a7` | identical |
| L2 | `d881c150` | identical |
| L3 | `532e8221` | identical |
| L4 | `5061c9fa` | identical |
| L5 | `b19eda42` | identical |
| L6 | `225645f9` | identical |
| L8 | `a9c213b2` | identical |
| L9 | `0d7d6249` | identical |
| L10 | `fd223748` | identical |

The audit intentionally selects the nine other levels. Both commands return exit 1 for the same sole `PARTIAL_LEVEL_SELECTION` diagnostic marker; no per-level threat failure was added. L7 is qualified by the six mortal native cases above.

[Exact comparison](evidence/other-levels-parity.json), [stage timings](evidence/other-level-stage-jobs.json), [main audit](evidence/other-levels-main.json.gz), [final audit](evidence/other-levels-final.json.gz).

## Reproduce

Run heavy commands through the remote wrapper with one separator and pull the artifacts:

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-l7diff -- \
  node --import tsx/esm tools/qa/r17-l7diff.ts escort-final both 1,2,3

MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-l7diff -- \
  node --import tsx/esm tools/qa/r17-l7diff.ts escort-mortal-final both 1,2,3 mortal-passive

MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-l7escort-final-other -- \
  bash tools/remote/timing-isolated.sh --all \
  node --import tsx/esm tools/qa/threat-audit.ts \
  --levels L1,L2,L3,L4,L5,L6,L8,L9,L10 --out test-results/r17-l7escort-final-other --maxWorkers 4

MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r17-l7escort-verify-final -- \
  bash tools/remote/timing-isolated.sh --all \
  bash docs/reports/r17-l7escort/evidence/verify.sh
```

Audit the committed receipts, source scope and file hashes from a clean checkout:

```sh
python3 docs/reports/r17-l7escort/evidence/audit-completion.py --require-clean --check-manifest
```

[Completion audit](evidence/completion-audit.json) covers every requirement. The [SHA-256 manifest](evidence/manifest.json) covers this report and every retained evidence file except the manifest itself.

The verification script hydrates the runner's manifest index and makes a disposable snapshot commit for Git-dependent tests, entirely inside its private runner copy. The baseline source archive and rejected bite trials are retained with the evidence.

No specs, dependencies, protected references, layouts or assets changed. No browser, push or deployment was performed. Browser QA remains unperformed per the brief; this lane makes no visual review claim.
