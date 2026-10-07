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

## Combat-feel lane — 2026-10-07

Initial implementation commit: `f79d0d69`; final gameplay commit: `fdb30ffe`. Started from `aff15c89` (lane matched local main; no merge was necessary). No push, merge to main, deployment, dependency change, or protected reference/spec edit.

The PO's **Fast clicks until dead** rule in `00-game-concept.md` §6.2 supersedes the older E19 shove values. Normal unarmed and bat hits now displace 0.15–0.30 m, with 0.15–0.25 s flinch and 42–60 ms hit-stop. Unarmed still deals 9 per beat (5 hits against 40 HP); bat still deals 22 on its opening beats (2 hits), with its explicit overhead finisher at 30 damage/3.3 m shove. Standalone kick and ground slam remain specials. Ordinary melee damage/upgrade strength cannot implicitly become a knockdown; the damage pipeline caps ordinary player melee at 0.4 m/0.25 s.

The displacement was already a deterministic swept sim move (`SimWorld.knockback`), not an additional Rapier impulse on an infected body. The source of the long interruptions was combo data (bat 2.6–2.8 m; unarmed kicks 1.7–2 m), the damage system's magnitude/damage-based `heavy` heuristic, and 80-tick heavy stagger/get-up presentation. Explicit `ActionDef.knockdown` replaces that heuristic for melee. Crowd views now respect the authored flinch end tick, and ground deaths use the settled corpse pose rather than restarting a standing death animation.

The existing XZ mouse/hit queries and damage pipeline already allowed live downed infected. Normal ground hits now preserve their current down/get-up pose and stagger window, still apply damage, and can kill before the get-up finishes. No new invulnerability check or ground animation asset was needed. Released melee taps use a single 12-tick (200 ms) buffer per side; target commands also expire after 12 ticks when queued behind a swing, while ordinary approach commands still walk into range. Click targets can start the next attack on the exact end tick of the previous move. Existing target auto-approach follows small slides. The knee's range changed from 1.15 to 1.45 m to match the normal punch/approach range and avoid a chain miss.

### Measurements

Stationary 40 HP common infected, 1.2 m initial distance, released target clicks at 5 Hz, no upgrades, automatic approach. Before/after use the same protocol; these include approach, wind-up and recovery, with render-only hit-stop excluded from sim time.

| Weapon | Before TTK | After TTK | Hits | Largest hit gap before → after |
| --- | --- | --- | --- | --- |
| Unarmed | 205 ticks / 3.4167 s | 105 ticks / 1.7500 s | 5 → 5 | 70 ticks / 1.1667 s → 30 ticks / 0.5000 s |
| Bat | 78 ticks / 1.3000 s | 25 ticks / 0.4167 s | 2 → 2 | 72 ticks / 1.2000 s → 19 ticks / 0.3167 s |

Evidence: `click-ttk-before.json`, `click-ttk.json`. The ten-click regression uses actual common-infected AI brains; the TTK fixture stays stationary for reproducible before/after comparison. Additional tests cover ground and get-up damage, killing on the ground, exact recovery-buffer start/expiry, ordinary high damage/upgrade reaction caps, and real released mouse clicks on a downed target with both weapons.

### Existing test changes and tuning deviations

- `combat.test.ts` T-E05-07 still checks exact authored displacement and attack interruption; its forehand description now says 0.25 m. No assertion was removed.
- `m1-feel.test.ts` E03-AC20 replaces the unarmed 1.5–2.5 m kick expectation with ≤0.4 m for every normal beat, keeping stronger kick feel relative to the jab. The special kick's tumble/collision and blood/VFX regression stays intact.
- `l1-duel.test.ts` E19-AC14 replaces normal kick/bat large-shove assertions with the PO caps and no knockdown; explicitly checks overhead knockdown at 3.3 m. Damage, hits-to-kill, and the 20-seed difficulty battery are retained.
- `balance.test.ts` E05-AC14/E06-AC10 retains all 500 weapon/archetype checks. Five bat lower bounds assumed long shove pursuit: screamer/nurse/K9 minimum 0.96→0.60 s; bloated/hazmat minimum 2.15→1.50 s. Upper bounds and the other 495 bands are unchanged; observed new TTKs are 0.80 s and 1.90 s respectively. This is a deliberate balance recalibration for the faster PO loop.
- S-05 combat golden is repinned from `94887072` to `2dc515cf`; the same script still runs twice and asserts identical state before the pinned hash comparison. Shorter reactions and displacement change gameplay state deterministically.

### Validation

Final validation results follow below. Initial targeted combat/weapons run: 102/102 passed (including the existing unarmed/bat duel battery). Initial full unit run: 255/256 passed; the static typecheck/lint/build test exceeded its 180 s timeout on the shared Mac. Its three constituent commands completed successfully; this environmental timeout is recorded rather than changing the test's limit.

Follow-up code commit `b8b8a912` preserves the mouse-unarmed intent while approaching or waiting through recovery on the selected kick side. Previously a released click could lose `mouseAttack`, then resolve as the standalone special kick, causing an unexpected knockdown. A seventh regression exercises that exact selected-RIGHT/kick-slot case with released clicks and checks every attack remains `weapon.fists`.

Validation tooling commits `1d3d7191` and `9818b4fd`: the epic runner locks its Vitest command rather than requiring an outer lock around static checks/build/browser work; `SIM_WAIT` optionally uses lockf's queued wait (seconds) to avoid starvation from 2-second polling. The default sim-lock polling behaviour and two-slot machine limit are unchanged. Validation uses `SIM_WAIT=300`, a single Vitest worker for the full unit retry/epic gate, and headless Playwright's existing two-worker cap. The cancelled first verifier used port 3317; the final verifier used the serialized default preview port 3301, and the standalone smoke run uses isolated port 3318.


Final review found a second mouse-intent edge case outside target approach: a released Shift-click recovery tap on the selected kick slot was dropped on the next neutral frame. A regression reproduced one attack instead of two. Commit `fdb30ffe` carries the mouse intent in the runner buffer too; the next unarmed beat starts at tick 17, exactly the jab recovery end. The earlier queued verification/smoke runs were cancelled before browser execution and restarted against this final gameplay build. Commit `8643142c` strengthens the rapid-click fixture to issue all ten released pulses even when death happens before pulse ten.

Local implementation commits: `f79d0d69`, `b8b8a912`, `fdb30ffe`; regression/evidence setup commits: `2dbb5315`, `db55aa2c`, `8643142c`; validation tooling commits: `1d3d7191`, `9818b4fd` (plus comment correction in `fdb30ffe`). All remain on `lane/combat-feel`.


Browser-lock follow-up `2bc1aa8c` replaces the zero-wait poll with a bounded 60 s queued wait (`E2E_WAIT` can override it). This lets a polling lane compete with other lanes already waiting in lockf; the existing one-slot limit remains. Browser commands are locked internally only. `sh -n tools/sim-lock.sh` and `sh -n tools/e2e-lock.sh` both pass. The tooling change adds no game dependency or runtime behaviour.


### Final validation of `fdb30ffe`

| Exact command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | Both app and headless sim configs (also inside the final verifier) |
| `npm run lint` | 0 | No lint errors (also inside the final verifier) |
| `npm run build` | 0 | Final production build, used by the browser checks |
| `SIM_WAIT=300 sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/epics/E05/unit.json` | 0 | 256/256, 77 files; same suite as `npm run test:unit` |
| `SIM_WAIT=300 sh tools/sim-lock.sh npx vitest run tests/sim/combat tests/sim/weapons.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E05/combat-check.json` | 0 | 105/105, 6 files; all 500 TTK pairs and 20-seed duel battery |
| `npx vitest run tests/sim/combat/fast-clicks.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/epics/E05/fast-clicks.json` | 0 | 8/8 |
| `SIM_WAIT=300 npm run verify -- E05` | 0 | 39 Node tests passed, 616 excluded by tags; 26/26 browser tests, 0 flaky/retries |
| `E2E_WAIT=300 E2E_PORT=3318 npm run test:smoke` | 0 | 5 Node tests passed, 650 excluded by tags; 22/22 browser tests, 0 flaky/retries |

The final unit pass took 101.55 s; its static test passed within 17.87 s without changing the original timeout. A preceding `npm run test:unit -- --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/epics/E05/unit.json` run also passed 256/256 before the final Shift-click buffer fix; the exact equivalent direct Vitest suite above validates that fix. Required gates run without outer locks; only direct heavy Vitest commands use the sim wrapper. All browser runs are headless; desktop Chromium uses Metal on macOS, with two workers; final E05 uses preview port 3301 and standalone smoke uses isolated port 3318. No extra port-3300 server was started.

Updated evidence: `combat-feel-validation.json`, `checks.json`, `vitest.json`, `verify-playwright.json`, `smoke-playwright.json`, `acceptance-audit.json` (14/14 E05 IDs), `unit.json`, `combat-check.json`, `fast-clicks.json`, `click-ttk-before.json`, `click-ttk.json`, `render-perf.json`, `sim-perf.json`, the three reviewed PNGs, and `review.md`. Sim p95 is 0.316042 ms against 4 ms; arena rendering is 91 calls / 425629 triangles against 600 / 1500000. Paused arena FPS is not a production frame-rate measurement.

### Spec deviations and remaining work

No spec file or acceptance criterion was edited. The latest PO rule overrides older large-shove assertions; each test update and five bat-band recalibrations are explained above. Unarmed and common-infected bat hit counts are unchanged. Explicit heavy finishers/specials retain their knockdowns; a third bat overhead against a tougher target can still send it farther, and the downed target remains damageable.

The validation tooling fixes are separate commits so the orchestrator can inspect them independently when integrating concurrent lanes. Simulation TTK measurements use the same fixed-tick protocol before/after; they are not a human playtest or a video timing measurement. No outstanding combat-feel defect was observed in the automated regressions and screenshot review. The orchestrator owns merge/deployment and the final PROD feel check.


Final smoke gate completed successfully (22 browser checks in 48.3 s). The queued zero-wait smoke process was cancelled and restarted with `E2E_WAIT=300` after the lock change; the completed run is the one recorded above. No failed browser result or retry is represented as a pass. Required screenshots and small reports/logs remain under E05. After the browser servers exited, the lane's generated 147 MiB `dist` build and disposable Playwright directory were deleted, and unrelated E06/E13/E16 generated artifacts were restored. No videos or persistent temporary renders were created.
