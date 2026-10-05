# E06 — Weapons, Throwables and Abilities Catalog

Completed 2026-10-05 on `lane/e06-epic`. All ten acceptance criteria pass.

## Built

The M1–M3 catalog contains 30 validated, side-agnostic actions. It extends E05's
runner, hit queries, damage/status pipeline and loadout rather than replacing them.
Shotgun pellet aggregation and distance falloff, projectile rocket blasts, timed
fire/lure/smoke/shield/adrenaline/turret effects, hearing events and selected-rack
walk-over pickups provide their distinct roles. Drops arm after the player leaves
them, preventing automatic replacement loops. Active fire and lure zones also
affect late entrants.

Held views use E17's asset registry and manifest status gates, attach their grip to
the appropriate hero hand socket, and expose tip/muzzle nodes. All 30 actions have
code SVG icons with browser URLs. Pre-integrated art stays on contract-complete
code placeholders. Selected-side line, cone and ballistic arc/landing-circle
indicators use fixed geometry buffers; projectiles use a reusable mesh pool.
Existing E05 attack events retain animation, VFX and SFX integration hooks.

Bruno's MIT reference implementations were read before implementation:
`ExplosiveCrates.js` supplied the arming → persistent effect → expiry approach,
`Trails.js` supplied reusable ribbon buffers, and `Fireballs.js` informed radial
blast presentation. These patterns were adapted to the fixed sim tick and existing
combat pipeline. No E06 dependency was added. Reference directories and source art
were not edited by E06.

## Acceptance evidence

`acceptance.json` lists every passing tagged assertion with its source file.
`vitest.json` and `verify-browser.json` retain runner results.

| Criterion | Result | Evidence |
|---|---|---|
| E06-AC01 | PASS | Three tagged unit tests: full 30-action roster, missing/invalid schema fields, sane authored ranges. |
| E06-AC02 | PASS | 60 action/side cases plus timed utility and smoke-role tests. Damage/status actions hit; utilities emit `combat.effect` and demonstrate their actual role. |
| E06-AC03 | PASS | `roles.json`; 25 m rifle hit and rocket blast edge-hit assertions in `tests/sim/weapons.test.ts`. |
| E06-AC04 | PASS | Tagged sim test checks pistol 25 m and melee-kill 6 m hearing boundaries and `ai.alerted` cause. |
| E06-AC05 | PASS | Tagged fire-zone, route-around and late-entry tests: 4 m radius, 360 ticks, burning. |
| E06-AC06 | PASS | Tagged lure and late-entry tests: 15 m radius, 300 ticks, displacement, priority over ordinary noise and exact expiry. |
| E06-AC07 | PASS | Tagged walking pickup test checks selected rack append, current-slot replacement, old-item drop and recollection after leaving. Browser pickup wiring also passes. |
| E06-AC08 | PASS | Two tagged unit tests validate icons, manifest IDs and available GLB socket contracts; browser test attaches all 30 actions on both hands of both hero variants within 0.05 m. |
| E06-AC09 | PASS | Three tagged visual tests, six `aim-*.png` captures, geometry/pixel assertions, reviewed goldens and comparison sheets. `review.md`: all three must and both should items pass. |
| E06-AC10 | PASS | `../../balance/ttk.json`: 500/500 kills within fixed bands (24 damaging roster actions plus E05's swept-projectile reference, each against 20 archetypes). Utility/status roles have separate effect tests. |

## Validation and performance

Final command results, durations, source revisions and warning checks are in
`final-checks.json`; command output is in `logs/`. Required gates are typecheck,
lint, build, unit, smoke and `verify -- E06`, with the full simulation suite also
run. Browser execution uses lane port 3317 and two workers; Vitest is capped at
four workers. No deployment or push was performed.

The complete browser regression passed 120 tests across Chromium, four mobile
orientations/devices and WebKit, with zero skipped, flaky or unexpected cases.
The single opt-in headed WebGPU run passed both tests: native adapter/backend
selection and E06 catalog attachments/telegraphs. See `regression-browser.json`,
`webgpu-browser.json`, `webgpu.json` and `webgpu.png`.

| Metric | Actual | Budget / interpretation |
|---|---|---|
| Fixed-tick sim, 200 reactive infected, 3,600 measured ticks | p95 0.445 ms | < 4 ms |
| WebGL arena with 20 infected and one survivor | 159 draw calls; 6133 triangles | ≤ 600 calls; ≤ 1,500,000 triangles |
| Three load cycles | 62 geometries; 5 textures each | Exact plateau across cycles |
| Three unload cycles | 1 geometry; 2 textures each | Return to baseline |
| Native WebGPU sanity capture, one survivor | 39 calls; 1523 triangles | Backend/attachment proof, not a sustained frame-time benchmark |
| Shotgun / SMG DPS at 3 m | 210.00 / 108.00 | Shotgun higher |
| Shotgun / SMG DPS at 12 m | 5.25 / 108.00 | SMG higher |
| TTK matrix | 500 passing rows; 25 actions × 20 archetypes | Every row killed within its fixed band |

Final validation against merged `main` `300cc57` used code revision
`c6f5786`. Full unit: 62 passed; full sim: 106 passed;
smoke: 3 Vitest and 12 browser passed; E06 verify: 78 Vitest and
18 browser passed. Full regression: 120 passed
at `28ae9e0`. The subsequent main merge changed source art and its
manifest registrations only; runtime code, public runtime assets, config and tests
are identical to that full regression revision. All required gates and the full
unit/sim suites were repeated after the art merge. The full browser suite was not
repeated for inactive source exports.

Native WebGPU: 2 passed in the one allowed headed run
at `5e4ce77`.
All final command exit codes are 0, with no warnings. All ten ACs have passing tags.

The final browser sequence held `/tmp/minor-incident-e2e.lock` for its lifetime.
Its nested wrappers used a separate inner lock to avoid recursive acquisition;
the global lock still protected every browser child. `queue-note.json` records
the superseded earlier wait, canceled before any browser launched.

Main's asset-conformance, palette, crowd and locking changes were retained.
Late source/LOD exports received manifest registration only, without promoting
their statuses or editing their art. The first post-merge unit run caught missing
LOD declarations for the new police-officer and elderly-civilian hero entries.
Standard runtime LOD paths were added, matching existing placeholder contracts;
these below-integrated entries still use code fallbacks. The subsequent complete
unit run and required gates pass. `logs/merged-npc-contract-failure.log` preserves
the finding and `final-checks.json` records its corrected rerun.


## Deviations and scope limits

Two criteria contained a contradiction with the specified utility roster:
E06-AC02 required a hit from every action, and E06-AC10 required a kill time for
every action. Lures, smoke, shield and adrenaline are non-damaging utilities, and
flashbang is status-only. The two rows were minimally corrected to require actual
role-effect evidence for those actions. All damaging actions remain subject to the
TTK gate, and flashbang must still produce a status hit. E05's original six authored
TTK band sets and combat behavior remain unchanged; new actions have fixed literal
bands rather than deriving pass thresholds from runtime definitions.

Hearing movement and fire avoidance operate on opt-in reactive arena fixtures;
the shared noise/effect data is an integration point for E07's archetype AI. E27
owns final smoke/fire/blast presentation. Pending art is an intentional status
gate, not a completion blocker. The native WebGPU screenshot demonstrates rendering;
SwiftShader frame rates are not presented as hardware performance guarantees.

No unresolved E06 issues. Earlier-epic generated screenshot/perf artifacts were
restored after regression; their test results remain in the saved browser report.
