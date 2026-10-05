# E05 — Combat System: complete

Implemented the two directional action sides, 1–3 item racks, 15-tick swaps, fixed-tick action phases/cooldowns, magazines with automatic reload and infinite reserve, timed charge recharge, melee and swept/hitscan attacks, aimed/fused grenades, splash falloff/cover LOS, directional shields, modifiers/armor/HP/death, stagger/knockback, burning/stunned/slowed/toxic, friendly fire, aim assist, and 50 ms presentation-only melee hit-stop. The 30×30 m combat-arena has configurable stationary infected/escort dummies and a placeholder view. Runtime/test snapshots include active attacks, projectiles, resources, settings, RNG cursors, and immutable copies.

The E05 reference catalog has six actions: bat, pistol, machine gun, frag grenade, a fast swept projectile, and ground slam. E06 owns the full weapon roster/tuning/views. The schema includes that catalog's fields without adding dependencies. Shared-machine Playwright concurrency is 2; Vitest is 4. `E2E_PORT=3316` isolates every browser run. No shared 3300 server, deployment, push, environment file, or protected reference was touched.

## Acceptance audit

All 14 IDs have passing tagged tests in the final reports; [acceptance-audit.json](acceptance-audit.json) maps exact passed test titles to the JSON result files.

| Criterion | Result | Primary proof |
| --- | --- | --- |
| E05-AC01 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC02 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC03 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC04 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC05 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC06 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC07 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC08 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC09 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC10 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC11 | PASS | `tests/sim/combat/combat.test.ts`; `vitest.json` |
| E05-AC12 | PASS | `tests/unit/combat/events.test.ts`; `vitest.json` |
| E05-AC13 | PASS | `tests/e2e/combat-wiring.spec.ts`; `verify-playwright.json` |
| E05-AC14 | PASS | `tests/sim/combat/balance.test.ts`; `vitest.json` |

Extra tests prove independent resource timers while cycling, action interruption, full-cover hits, nearest visible aim-assist filtering, immutable snapshots, stable attack IDs across re-equipping, seeded spread, simultaneous held-button selection, and the 1800-tick combat golden hash `d76f3702`. The original E01 golden remains `4e5fda97`.

## Verification

Code commit checked: `2fbd3d42e9abc6dd8f466177363073c0932344bc`. Latest local main merged: `5bb0895c86c4640c9ea94806409a8564db13bbce`. The final merge added only machete report/review documents. All six required commands were rerun after that merge, with status E05=`done`. The only merge conflict was the equivalent two-worker Playwright setting; main's version was retained.

| Command/check | Exit | Results |
| --- | --- | --- |
| `npm run typecheck` | 0 | Both app and headless sim configurations |
| `npm run lint` | 0 | No warnings |
| `npm run build` | 0 | No warnings; production query-gated test API |
| `npm run test:unit` | 0 | 28 passed; 1 existing optional-preview skip (untracked preview absent in lane) |
| `npm run test:smoke` | 0 | 3 Node + 12 headless browser tests passed |
| `npm run verify -- E05` | 0 | 27 Node tests + 14 browser tests passed; all E05 criteria included |
| E01–E04 tagged Node regression | 0 | 36 passed; tag-excluded tests and the optional preview are skipped |
| E01–E04 tagged browser regression | 0 | 70 passed, 0 failed, 0 flaky, 0 retries |

Raw command exits are in [validation.json](validation.json), verifier exits in [checks.json](checks.json), and stdout in `logs/`. Browser runs are serialized; no headed WebGPU run was started. A pre-audit four-worker regression hit the existing E04 120 s animation-bot timeout during the orchestrator-reported Mac load 95. After the requested two-worker limit, the complete final regression passed with unchanged tests/timeouts (E04 animation bot about 1.3 min). This is recorded rather than treating the earlier timeout as a green run.

## Balance and performance

[TTK matrix](../../balance/ttk.json): 120 of 120 pairs in band, six actions × twenty profiles. Profiles use concept §7 HP for all human/animal archetypes plus the dachshund/K9 variants. Dummies remain stationary; the script chases knockback, exposes Riot shields from the rear, aims serial grenades, and uses no damage upgrades. Armored uses an explicit 50% reduction test fixture; E07 owns final archetype behavior/armor tuning. Measured TTK spans 0.016667–121.516667 s.

- [Sim perf](sim-perf.json): 3600 measured ticks, 200 dummies, sustained fire, p95 **0.086958 ms** (budget 4 ms).
- [Render counters](render-perf.json): 9 entities, **211 draw calls**, **113295 triangles**, 164 geometries, 5 textures (budgets 600 draws / 1,500,000 triangles).
- SwiftShader diagnostic frame measurement: 83.40000000000009 ms / 11.990407673860899 FPS on the shared CPU. This is not a real-GPU production frame-rate certification. E05 validates sim/counter budgets; E18 owns GPU/device FPS gates.

Queries reuse result/scratch buffers; stationary hash cells update in place; combat scans the entity iterator without producing per-tick entity arrays. Projectile/attack objects are created on attacks, not on idle frames. Debug snapshot allocations are outside normal sim work.

## Presentation and reuse

[Combat arena screenshot](combat-arena.png), [reference comparison](compare/combat-arena.png), and [review](review.md) were opened with the image viewer. E05 has no visual acceptance criterion; the supplemental review passes all applicable player/target readability, tinted-shadow and camera items. Full district/HUD/telegraph/weapon/VFX art certification is explicitly outside this arena review. Infected remain code placeholders while the integrated E17 registry is unavailable; the supplied E04 survivor hierarchy remains intact.

Bruno `Explosions.js` and `Time.js` were read from the read-only main checkout before implementation. Splash falloff and radial impulse adapt the explosion pattern for bodyless infected. Kinematic knockback is authored displacement in metres and clamps at cover; no per-infected Rapier bodies were added. Hit-stop freezes presentation for three fixed ticks (50 ms) and never alters simulation time. Attribution is in `THIRD_PARTY_NOTICES.md`.

## Deviations and known issues

No acceptance criterion was edited or weakened. `specs/status.json` is the only spec change, as explicitly requested. No outstanding E05 issue. Placeholder infected, missing full roster/weapon views, AI behaviors and VFX are the declared E06/E07/E15/E17 integration work, not unfinished E05 criteria. Campaign level composition enables the combat flag; existing E01–E04 scenarios keep their original behavior.

The complete diff was reviewed after implementation, unnecessary baseline test-artifact changes were removed, and the audited implementation was checked again. Small feature/fix commits plus this report commit remain local on `lane/e05-epic`.
