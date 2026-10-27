# Test rewrite (2026-10-27)

PO: "Let an agent reduce the overall number of tests by a full rewrite. We have far too much tests. Even the shorter 16m is ridiculous slow. I think we should have 3-5% of all tests and only test cover that represent game engine logic or code that is used on more than one place to avoid side effects. Also make sure the new test strategy is applied afterwards so it doesn't grow fast again."

Rule and layout: [test strategy](../../qa/test-strategy.md). Budget check: `tools/qa/test-budget.mjs`. Injection check: `tools/qa/inject-regressions.mjs`.

## Numbers

| | Before (main 190574c78) | After |
|---|---|---|
| Test/spec files | 980 | 37 |
| Test cases run | 5,492 (Vitest 4,097 at runtime; Playwright chromium 1,383; invariant browser 12) | 132 (2.4 %): Vitest 112 (default 77, nightly 35), e2e 6, perf 2, invariant browser 12 |
| Per-change Vitest run | full suite 71 min of test time on a runner (`test:gate` ≈ 16 min) | `npm test` 15 s on the Mac, 44.5 s on a runner (4 workers) |
| Smoke | 22 browser tests + Node `@smoke` | 6 browser tests, 2.2 min (133 s incl. budget check) |
| Nightly | `test:nightly` (expanded, not completed green) | campaign L1 → credits + content ratchets + invariants + sim budget |

The budget counts collected cases (`vitest list`: 99 Vitest); the QA invariants add a few per-tier cases at runtime (28 run vs. 21 collected), so the runtime total is 132.

### Baseline: the old suite on main once (runner, 2026-10-27)

`vitest run` over tests/unit, sim, levels, qa/invariants: 4,097 tests, 3 failed, 9 skipped, 4,265 s of test time (6,994 s wall with queueing on loaded runners). The three failures and whether the new suite would have caught them:

| Old failure | Kind | New suite |
|---|---|---|
| `sim/performance/zoo-s2` 200 mixed zoo specials p95 5.07 ms > 4 ms | wall-clock micro-budget under a loaded runner | missed by design (perf is the nightly horde budget, run isolated) |
| `sim/world/solid-admission` queued house resident leaves the doorstep, 12.3407 < 12.349 | 1 cm pinned position in one scripted case | missed (collision core is covered by wall-crossing invariants, not this pin) |
| `sim/missions/l10-finale` #101 remote living boss joins within 15 s | level-specific scripted scene | missed per change; the nightly campaign did not trip it either: it belongs in Scene Lab / the PO checklist |

### New suite results (2026-10-27)

| Check | Result |
|---|---|
| `npm test` (Mac / runner) | 77 passed, 15 s / 76 passed + 1 Mac-only skip, 44.5 s |
| `npm run test:smoke` (Mac, one browser) | 6 passed, 2.2 min |
| `npm run test:nightly` (runner) | 35 passed: campaign L1 → credits (1,182 s, every level completed, 0 deaths), content ratchets, invariants, sim budget (p95 0.92 ms / 0.25 ms on the Mac); 1,198 s wall, just inside the 20 min budget on a cx33 runner (the campaign alone is ~20 min there; run it on the Mac or an idle runner) |
| `npm run qa:invariants` | green: remote sim 28 passed, Mac WebGPU-low browser 12 passed |

## Coverage map (engine module → old tests → new test)

| Area | Old (examples) | New |
|---|---|---|
| Clock, event bus, RNG, services, spatial hash | unit/core/foundation, clone | engine/core (4) |
| Determinism, replays | sim/determinism, recorder, runner, unit/telemetry/codec | engine/determinism (3: render rate, recorder hash per tick, L1/L4/L10 same-seed hash), engine/input-log-codec (2) |
| Save / Continue / handovers / weapon carry | unit/progression/* (10 files), sim/progression*, selected-weapon, weapon-order | engine/save-progression (5) |
| Combat pipeline | sim/combat/* (19 files), unit/combat/* | engine/combat (7) |
| Aim assist | sim/combat/aim-assist-keyboard (18 parameterized), combat T-E05-11 | engine/aim-assist (3) |
| Input mapping | unit/input/* (10 files) | engine/input (5) |
| Navigation | sim/ai/navigation, unit/ai/*, unit/performance/nav-* | engine/navigation (4) |
| Infected AI state machine | sim/ai/* (26 files) | engine/infected-ai (5) |
| Collision / solids / corpses | sim/world/solid-*, explosion-corpses, player wall tests | engine/collision (4), engine/player (3) |
| Spawn / pressure admission | sim/ai/director, unit/performance/l4-spawn-room | engine/spawn-director (4) |
| Vehicles | sim/vehicles/* (9 files) | engine/vehicles (2) |
| Interactions, pickups, explosions, hazards | sim/interact/*, explosions*, barricades | engine/world-systems (4) |
| NPCs (civilians, escorts, corgi) | sim/npc/* (18 files) | engine/npcs (3) |
| Mission runtime | sim/missions/objectives, adapters, unit/missions/schema | engine/missions (4) |
| GPU limits, skinned crowd, corpse pages, LOD, materials, textures | unit/render/* (157 files) | shared/render-contracts (6) + e2e/crowd-gpu-limits (2) |
| Asset validator | unit/assets/* (41 files) | shared/asset-contract (1: validator rejects each violation, all production assets pass) |
| Sim architecture | unit/import-graph | shared/architecture (2) |
| Gate tools | unit/tooling/*, unit/tools/*, unit/performance/quiet-admission | tools/gate-tools (3) |
| Playtest driver, Scene Lab specs | unit/playtest-* (8 files), unit/tooling/scenelab | tools/qa-drivers (3) |
| Boot / draw / pipelines | e2e smoke, crowd-drawn, webgpu-pipelines | e2e/smoke (3), e2e/webgpu-unflagged (1) |
| Campaign L1 → credits | levels/L10-campaign | nightly/campaign (1) |
| Content ratchets (PO 10-13) | unit/assets/lod-fidelity (per asset), unit/levels/decoration-surface, placement-solids, sim/world/support-seams | nightly/content-invariants (4, same baselines) |
| Perf | sim/performance/* (13), tests/perf (63 specs) | nightly/sim-budget (1), nightly/render-budget.spec (2) |
| QA invariants | tests/qa/invariants | unchanged |
| Deleted without replacement | levels/* (88 per-level bot/tuning files), unit/levels/* (33), unit/audio/* (19), unit/vfx, unit/ui, unit/layouts, sim/levels, sim/missions per level, tests/visual (28 goldens/look specs), 214 e2e specs | Level correctness: nightly campaign bot, Scene Lab catalog/matrix, Opus visual QA, PO checklist |

## Regression injection

`node tools/qa/inject-regressions.mjs` applies each bug to `src/` (or the manifest), runs `npm test`'s Vitest project, records the failing tests and restores the file. Results: [injections.json](injections.json).

| Injected regression | Caught by |
|---|---|
| Determinism: RNG state leaks across worlds (every 97th draw shifted) | engine/core (seeded streams), engine/determinism (L1/L4/L10 same-seed hash), engine/infected-ai (seeded down time) |
| Save/carry-over: handover rack cap cuts carried weapons to three per side | engine/save-progression (every handover keeps every carried weapon) |
| Aim: keyboard assist mirrors the cross-track sign (Q-196 class) | engine/aim-assist (8 facings; idle burst) |
| Collision: nav clearance uses half the body radius against walls | engine/navigation (capsule margin) |
| Spawn admission: director drops the 18 m courier radius | engine/spawn-director (placement) |
| GPU limits: frozen corpse pages stop interleaving their surface (Q-201 class) | shared/render-contracts (GPU limits) |
| Asset contract: a shipped prop's LOD1 points at a missing file | nightly/content-invariants (asset inventory); per change only if the asset is in the per-category sample |
| Skinned contract: skin packing normalizes without the dominant weight | shared/render-contracts (skinned crowd) |

Found and fixed while injecting (the old suite had the same blind spots): a 1e-7 RNG drift is below `stateHash`'s 1e-4 rounding (by design, so the injection was made realistic); the first carry injection was masked by `autoRewards` re-racking owned weapons (not a real bug); the spawn test never isolated the 18 m rule (every probe point was also on screen); the asset test filtered validator errors to five kinds, so a missing LOD file passed. The inventory has zero validator errors, so the test now requires none.
