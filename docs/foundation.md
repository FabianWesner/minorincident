# Minor Incident foundation harness

`npm run dev` serves the game at `/` on port 3300. The existing asset study lives
at `/preview/`; all other `/preview/*.html` pages keep their original URLs.
Do not start another server on port 3300. Browser tests use the production build
on port 3301, started and stopped by Playwright.

The sim uses the same pinned Rapier WASM in Node and browsers. A tick is always
1/60 s. Rendering interpolates the last two transforms; it does not feed values
back into the world. Catch-up is capped at 5 ticks, or 20 with `?test=1`.

Open `/?test=1&renderer=webgl&dpr=1&seed=1`, then:

```js
await window.__SS__.ready;
await window.__SS__.loadScenario('empty', { seed: 1 });
window.__SS__.pause();
window.__SS__.input.set({ move: { x: 1, z: 0 } });
await window.__SS__.step(60);
window.__SS__.input.clear();
console.log(window.__SS__.getState(), window.__SS__.events(0));
await window.__SS__.screenshotReady();
await window.__SS__.unloadScenario();
```

The additive `unloadScenario()` hook releases all level-owned physics, entities,
listeners and GPU resources. Shared renderer caches remain in the baseline.
Snapshots are independent JSON data. `events(sinceTick)` is strictly after the
given tick, with the last 10,000 events retained. State hashes exclude timing and
renderer counters, sort keys without locale dependence and round floats to 1e-4.

`src/debug/testApi.ts` documents the complete version 1.0.0 surface. Methods for
future epics throw `NotImplemented` and name their delivering epic. The empty
scenario's controllable cube is a harness fixture, not the E04 survivor controller.
In dev, `?debug` enables a Tweakpane and collider wireframe.

The production app loads the API chunk only for `?test=1`; its default entry and
eager dependency graph contain no API implementation. `npm run build` explicitly
sets `NODE_ENV=production`, including when invoked from a test process.

```sh
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run sim -- --scenario empty --ticks 600 --seed 1
npm run verify -- E01
```

The sim command writes `test-results/sim/empty-seed-1.json`; use `--out` to choose
another file. `verify` selects exact epic tags plus smoke in both runners and
saves command exit codes and Vitest results under `test-results/epics/<target>/`.
Browser JSON results and failure traces live under `test-results/playwright/`.
Playwright and Vitest both cap concurrency at four workers/threads, with no retries.

The current smoke suite covers boot, a deterministic fixture golden hash and
unload/reload. Campaign, combat, vehicle, save and touch-HUD smoke checks become
available with their delivering epics. The asset validation/turntable command
names are reserved and currently fail explicitly with `NotImplemented E17`.
`npm run deploy` runs `npm run build && npx --yes wrangler@4 pages deploy dist
--project-name minor-incident`. Wrangler is a deploy-only tool outside project
dependencies. Deployment was not run for E01.
