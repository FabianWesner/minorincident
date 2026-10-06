# E11 — Interactables, Hazards and Destructibles

Complete on approved fixed base `cb91d59` (last main merge: `b5dcd1c`). Every E11-AC01–09 has passing tagged tests, recorded in `acceptance.json`. The orchestrator instructed this lane to make no further upstream merges or registrations; subsequent main and E07/E15 integration is reconciled centrally.

Implemented fixed-step stand-to-interact devices with damage interruption, conditions, keyed open/close doors, generator fuel and typed completion/blocker events; environmental damage, delayed/chained propane, alarm targets, gas trails, electrical/toxic/fire zones; pooled destructible debris; exact capped pickups; and registry-backed presentation with a depth-independent ring and readable progress prompt. Scenario and district placement hooks use existing sim, combat, spatial hash, Rapier, nav and asset modules.

| Criterion (all PASS) | Evidence |
| --- | --- |
| E11-AC01 | `tests/sim/interact/devices.test.ts`, `tests/e2e/interact.spec.ts`: fixed fill/decay, exactly-once completion, permission/range, physical E and middle-click. |
| E11-AC02 | `devices.test.ts`: accepted damage floors to the previous 25% notch only for flagged devices. |
| E11-AC03 | `devices.test.ts`, `integration.test.ts`: locked hint/key, open/close, single-tick nav/collider change, overlapping blockers and shifted district authoring. The existing reactive infected fixture is physically blocked by the closed door and walks through after opening. |
| E11-AC04 | `hazards.test.ts`: exact 18-tick fuse, 4m chain, infected/prop/player damage, radius exclusion and eight blasts per rolling second without dropped links. |
| E11-AC05 | `hazards.test.ts`: actual bullet hit, 20m/10s noise and target expiry. The reactive infected actually moves toward the car instead of the player and returns to idle at expiry. |
| E11-AC06 | `hazards.test.ts`: adjacent wood exposure/ignition, authored burn time, fire radius/expiry and non-flammable exclusions. |
| E11-AC07 | `hazards.test.ts`, `integration.test.ts`: real melee, nav restoration, ≤8 pieces/break, 8s expiry, reuse, 32-piece pool and no survivor obstruction. |
| E11-AC08 | `pickups.test.ts`: exact capped health, 480-tick speed buff, throwable refill, weapon rack, unique objective items, collection events and respawn persistence. |
| E11-AC09 | `tests/visual/interact.spec.ts`: W0–W5 at 1600×900/390×844, 15.617:1 text contrast, visible ring pixels, prompt bounds and head clearance. PNGs, comparison sheets, metrics and §7 review are saved here. |

Bruno's MIT `InteractivePoints`, `ExplosiveCrates`, `RayCursor`, and `Objects` patterns were adapted to existing fixed ticks, components and event ownership. No dependencies were added.

## Scope and deviations

No acceptance criterion was changed or weakened. Devices without integrated art use code placeholders. Hazard/debris presentation is deliberately the E11 placeholder layer; E26 owns movable full props and barricade mechanics, and E27 owns blast/fire/smoke effects. Exports supplied before the final merge cutoff required registry source/LOD metadata to preserve existing asset-reference tests; their art statuses were not promoted. The latest standalone flashbang was registered and compressed using the existing optimizer, with measured dimensions replacing its placeholder one-metre box. It passes production validation (4,988 triangles, five materials/draw calls, 109.19 KiB). The pilot and truck from the last merge were also registered and exported. The pilot is uniformly normalized to 1.8 m using the existing scale transform; its generated LOD1 initially exceeded 9,000 triangles, so the existing rigged-export target was reduced to leave room for retained parts. Final LOD1 is 8,804 triangles and LOD2 is 1,972. No triangle limit, acceptance criterion or art status was changed. `asset-exports.json` records validation of these seven outputs without errors.

## Validation and performance

All final required gates exit 0 on the approved source commit:

| Command | Result | Saved evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS, exit 0 | `typecheck.log`, `final-node-gates.json`, `checks.json` |
| `npm run lint` | PASS, exit 0 | `lint.log`, `final-node-gates.json`, `checks.json` |
| `npm run build` | PASS, exit 0 | `build.log`, `final-node-gates.json`, `checks.json` |
| `npm run test:unit` | PASS, 66/66 | `unit.json`, `unit.log` |
| `npm run test:sim -- --maxWorkers=1` | PASS, 129/129 including earlier epics' sim tests | `all-sim.json`, `all-sim.log` |
| `npm run test:smoke` | PASS, 3 Node + 12 browser, no retries | `smoke.log`, `playwright-smoke.json`, `final-browser-gates.json` |
| `npm run verify -- E11` | PASS, 26 Node + 16 browser, no retries | `vitest.json`, `playwright-verify.json`, `verify.log`, `checks.json` |

There are no new build, lint or typecheck warnings. Browser runs used the machine-wide lock, E2E_PORT=3321 and two workers. Unit workers stayed within four; the full sim used one worker. Verify's 169 pending Node tests are outside its tag filter, not failing acceptance tests. All nine IDs are covered by passing tests. Twelve final PNGs cover W0–W5 at both viewport sizes, with comparison sheets and a structured vision review in `review.md`.

The first concurrent static/unit/sim run exceeded the E11 timing budget under CPU contention; the single-worker full sim run passed all 129 tests without changing assertions. Final verify's stress scene measured **5.813 ms p95 / 0.759 ms median** against **6 ms**, for 100 static infected fixtures and 200 props over 600 ticks (`sim-perf.json`). The debris pool remains bounded at 32 pieces / 34 physics bodies. Final paused UI fixtures measured at most 165 draw calls and 108,881 triangles, with 15.617:1 text contrast and 16px font size across all tiers (`ui-desktop-metrics.json`, `ui-mobile-metrics.json`). These WebGL/SwiftShader screenshot fixtures establish readability and render counts; their frame timings do not establish native device FPS.

## Final orchestration deviations

Per the orchestrator's final instruction, the final browser checks are E11 verify and smoke only. E11's queued cross-epic regression lock request was canceled before its browser process started; full cross-epic browser regression is delegated to the orchestrator on main. The optional headed WebGPU project was never started. `final-browser-gates.json` records these omissions explicitly. No main merge or new upstream asset registration occurred after the cutoff. The evidence/status commit changes no runtime behavior, so the green final checks above apply to the delivered implementation.

## Known issues and integration handoff

No known E11 issues remain on the approved base. The current E06 reactive infected fixture proves required physical door/alarm behavior. For central E07 integration, `world.blocker.changed` carries the changed wall extents and `noiseTarget` carries the alarm entity ID and expiry; E07's separate path grid and brain can consume those hooks when the orchestrator merges the lanes. E26 and E27 retain ownership of full movable props and explosion/fire/smoke presentation.
