# Q233 — prop-independent actor identities

Baseline: `e2ade28ba` (the branch's main checkout). Runtime fix: `f1ba84733`; authored Scene Lab compatibility: `38605484b`; reproducible QA tools: `4d8f27656`.

Pushables used the same counter as actors. Infected perception/path refresh phases, recovery RNG, separation directions, model choices, allied shot RNG and several mission targeting schedules use actor IDs. A remote extra prop therefore changed gameplay. Streaming had a second leak: `reserveIds` treated auxiliary prop records as gameplay IDs when bringing chunks back.

Props now use the existing auxiliary namespace, keyed by `prop:<district>/<placement>`. Inserting, removing or reordering another placement cannot change a retained prop's ID. Gameplay allocation uses a fixed **authored level/scene sequence epoch** plus its existing spawn sequence. The epochs preserve the shipped ID/RNG phases, including frozen L5 difficulty; they are migration constants, never recalculated from the current layout census. Streaming reservations now keep auxiliary and gameplay counters separate. Actor iteration and physics initialization are unchanged.

The D-CURE shortfall assertion is a warning now. Existing surplus pruning is retained to preserve the reviewed narrow-roads bake; neither that historical census nor the number of live props controls actor IDs. One fast engine test replaces the build assertion and covers insertion/order, streaming reservation, checkpoint restore, pool adoption and reset. No dependencies were added.

The first scene gate exposed a cropped-fixture migration: `seat-bench-l1-start` has three pushables and originally spawned its sitter as ID 6. The generic `scene-lab` key lost those legacy slots, changing the held-cup animation phase (height 0.456 against the unchanged 0.5 criterion). Scene Lab now supplies an authored scene key; a fixed epoch of three preserves that reviewed fixture, with sitter ID 6 and hold height **0.504**. This is independent of future prop count. The targeted scene passes; no render code or threshold changed. The initial failed gate is retained in [scene-gate-first.log](scene-gate-first.log).

## Gameplay proof

`withLegacyPropIds` reproduces the original allocator for a fresh reference run: keyed prop creation delegates to the original gameplay `create`, and the migration epoch is disabled. Gameplay code, seed, inputs and balance data are identical. The original checkout was also measured before the fix; those receipts are the `before-*.jsonl` files. All simulations used the Mac CPU slot.

| Probe | Actual pushables (−4 / base / +4) | Reference and candidate result |
| --- | --- | --- |
| L10 high, seed 32 | 93 / 97 / 101 | **143.15 s**, cure released, **0 deaths**, peak 169; full calibration hash `d23478b9b16dd471` in all four runs |
| L10 low, seed 32 | 93 / 97 / 101 | **143.2166667 s**, cure released, **0 deaths**, peak 87; full calibration hash `162c72fc08608d6f` in all four runs |
| L1 complete bot, seed 1, 100 s probe | 74 / 78 / 82 | Outcome hash **`2416de8a1582a2b1`** throughout; 0 deaths, 20 damage; exact objective timings |
| L4 complete bot, seed 1, 240 s probe | 20 / 24 / 28 | Outcome hash **`481f3d493cbf62c1`** throughout; 0 deaths, 0 damage; exact objective timings through the war/hold and cellar objective |
| L5 complete bot, seed 1, full completion | 16 (unchanged) | **164.7333333 s**, 0 deaths, 30 damage; outcome hash **`3ef88c84bc01b11f`**; the whole report, including diagnostics, is identical |

L10 compares the **entire** calibration result, including boss identity/state, rocket hits, HP, activation, arrival, objective timeline, movement/activity totals and charge-gate behavior. [Full results](l10-full-results.json) and [summary rows](after-l10.jsonl).

L1/L4 outcome hashes include exact mission time and objective timestamps, progress, kills, damage, deaths and failures. Collision/query counters and current route-position diagnostics are outside that hash and remain visible in the receipts: removing a physical obstacle can change local positions. The unchanged-layout candidate compares the whole report, including those diagnostics, against main. These are the requested short bot probes, not claims that altered collision geometry produces identical world transforms. [L1](after-L1.jsonl), [L4](after-L4.jsonl), [frozen L5](after-L5.jsonl).

[Actual count and identity receipts](prop-counts.json) assert the ±4 counts, identical actor IDs, and stable IDs for every shared prop key. [All ten levels load](all-level-loads.jsonl) without auxiliary-ID collisions.

## Replay baseline migration

The full state includes prop IDs, so its hashes change once. Seed 1, the existing square-walk/attack input recipe from `tests/engine/determinism.test.ts`, 360 ticks, samples every 60 ticks:

| Level | Main full hash at tick 360 | New full hash at tick 360 | Actor/gameplay hash, both versions |
| --- | --- | --- | --- |
| L1 | `67a74c2f` | `16414731` | `d474f97c` |
| L4 | `35a8606e` | `13b6d14d` | `7dc061b4` |
| L10 | `bfb61d12` | `e77e8a9d` | `59ff377f` |

Every actor/gameplay sample matches exactly after excluding only physics-prop entity records and prop poses. [All old/new samples](replay-baselines.json). The existing replay determinism tests remain enabled.

## Reproduce

```sh
sh tools/sim-lock.sh node --import tsx/esm tools/qa/l10-arrival-check.ts --variants
sh tools/sim-lock.sh node --import tsx/esm tools/qa/prop-invariance.ts L1
sh tools/sim-lock.sh node --import tsx/esm tools/qa/prop-invariance.ts L4
sh tools/sim-lock.sh node --import tsx/esm tools/qa/prop-invariance.ts L5
npm run typecheck
npm run lint
sh tools/sim-lock.sh npm test
E2E_PORT=4233 npm run test:smoke
SCENE_PORT=4234 npm run scene:gate -- --out test-results/q233-ids/scene-gate-final
sh tools/sim-lock.sh npm run verify -- E32
```

Validation receipts: typecheck and lint passed; `npm test` **105/105** (24 files); smoke **6 QA + 1 public-build** checks passed in **135.7 s**. E32 verification passed typecheck, lint and all 105 tests on the final runtime source. The final scene gate passed **48/48**, **0 known failures**, **0 not run** in **5.5 min**: [summary](scene-gate-summary.md), [state](scene-gate-state.json), [log](scene-gate.log). [Requirement audit](completion-audit.json). Browser runs are headless; Playwright uses at most two workers, Vitest at most four. No port 3300, publication or deployment.
