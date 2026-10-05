# E01 · Foundation, Game Loop and Test Harness

## Goal
Set up the project skeleton everything else stands on: a TypeScript and Vite app, services with lifecycles, a **deterministic fixed-step simulation that also runs headless in Node**, a seeded RNG, an ordered event bus, the `window.__SS__` test API, the headless sim runner, and the test tooling (Vitest, Playwright, pixelmatch). After this epic, an agent can load an empty test level, step time, inspect state, and take a screenshot.

## Depends on / Enables
Nothing / everything.

## Scope
**In:** repo layout (`02-technical-architecture.md` §2), npm scripts, `core/` (Clock, Rng, EventBus, Services, Lifecycle), sim world container and entity store, spatial hash, Rapier init (browser and Node), level loader stub, `debug/testApi.ts`, `tools/sim-runner`, the test runners and configs, CI script, lint rules (ban `Math.random` and DOM imports in `src/sim`), and a scenario fixture format.
**Out:** visuals beyond a ground plane and a debug cube (E02), and real input (E03).

## Deliverables
- `package.json` scripts: `dev`, `build`, `typecheck`, `lint`, `test:unit`, `test:sim`, `test:e2e`, `test:visual`, `test:perf`, `test:smoke`, `verify`, `sim`, `assets:validate`, `assets:turntable`
- `src/core/*`, `src/sim/world/*`, `src/physics/*`, `src/debug/testApi.ts`, `tools/sim-runner/index.ts`
- `tests/fixtures/scenarios/empty.ts` (a flat 100×100 m plane plus a player stub)
- `tools/verify.ts`: maps an `E<NN>` or `M<N>` argument to tagged test selections across runners
- `playwright.config.ts` (Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`, viewport 1600×900, DPR 1) and a mobile project (Pixel 7 / iPhone 14 emulation)

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Game.js`](../folio-2025/sources/Game/Game.js): staged boot
- [`Events.js`](../folio-2025/sources/Game/Events.js): ordered phases (port)
- [`Ticker.js`](../folio-2025/sources/Game/Ticker.js): render ticker
- [`Physics/Physics.js`](../folio-2025/sources/Game/Physics/Physics.js): Rapier service (make fixed-step)
- [`Physics/PhysicsWireframe.js`](../folio-2025/sources/Game/Physics/PhysicsWireframe.js): debug colliders
- [`Debug.js`](../folio-2025/sources/Game/Debug.js): Tweakpane
- [`Materials/MeshGridMaterial.js`](../folio-2025/sources/Game/Materials/MeshGridMaterial.js): debug ground
- [`utilities/maths.js`](../folio-2025/sources/Game/utilities/maths.js): helpers

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E01-AC01 | `npm run typecheck`, `lint`, `build` succeed on a clean checkout | static |
| E01-AC02 | The sim runs at a fixed 60 Hz. With render rates of 30, 60, and 144 Hz simulated, a scripted 600-tick run gives an identical state hash | unit |
| E01-AC03 | `src/sim/**` has no imports from DOM globals, `three/webgpu`, renderer modules, or `src/render` / `src/ui`. Lint and an import-graph test enforce this | static/unit |
| E01-AC04 | Determinism: the same seed and the same input script give an identical `getState()` hash after 3600 ticks, in Node and in the browser | sim + e2e |
| E01-AC05 | `window.__SS__` exists only with `?test=1` (or dev), `version` follows semver, and every method in the contract (`02` §8) is implemented or throws `NotImplemented` with the epic ID that delivers it | e2e |
| E01-AC06 | `__SS__.step(n)` advances exactly n ticks while paused; `tick()` reflects this; `setTimeScale(10)` speeds sim time by 10× within ±2% | e2e |
| E01-AC07 | Loading a scenario, unloading, and repeating 20 times leaves entity count 0 and physics body count 0, and the listener count and `renderer.info.memory` geometries and textures return to baseline (±0) | e2e |
| E01-AC08 | `npm run sim -- --scenario empty --ticks 600 --seed 1` writes a JSON report with the fields `outcome, ticks, seed, stateHash, simMsP95` | sim |
| E01-AC09 | The event log records typed events with `tick` and `type`; `events(sinceTick)` filters correctly; the ring buffer holds the last 10k | unit |
| E01-AC10 | Any uncaught error or `console.error` during e2e fails the test unless allow-listed | e2e |
| E01-AC11 | `npm run verify -- E01` runs only the E01-tagged tests plus smoke and exits 0 | static |

## Verification recipe
```bash
npm ci && npm run typecheck && npm run lint && npm run test:unit
npm run sim -- --scenario empty --ticks 600 --seed 1
npm run verify -- E01
```
Inspect `test-results/epics/E01/report.md` and the sim JSON.

## Notes / risks
- Rapier WASM in Node: use `@dimforge/rapier3d-compat`, awaiting `init()` in both environments. Pin its version; float determinism is only guaranteed for the same build.
- Keep the test API out of production bundles (dynamic import behind a flag).
