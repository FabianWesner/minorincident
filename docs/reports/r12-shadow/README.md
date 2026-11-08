# R12 · Character shadows follow nearby light

## Change

The promoted night shadow source now aims from the selected practical light through the hero focus. Its spot cone and range are fitted to that source-to-focus distance and pool radius, so a nearby point lamp casts its shadow away from the lamp instead of almost straight down. The existing single shadow-map source, promotion hysteresis, 0.3 s transition, moon fallback, and quality controls remain in place.

Light selection now considers per-frame lights as well as placed lights. Fire pools may promote the shadow source, and driven spot headlights carry stable IDs so their moving positions update the same promoted slot without counting each frame as a promotion.

Added the focused `shadow-local-light` Scene Lab fixture and a render-contract regression for focus aiming, cone fitting, moving-light tracking, unchanged promotion count, and dynamic-light eligibility.

## Visual evidence

Opened both PO references, `epics-pipeline/po-findings/1108-shadow-a.png` and `1108-shadow-b.png`. They show the courier and corgi above-left of a glowing street lamp at the lower-right; long character shadow streaks extend diagonally upper-left and visually read as coming from a different, moon-like direction. This reproduces the reported contradiction and is the before evidence.

The required after capture could not be produced in this restricted run. `npm run scene -- tests/scenes/catalog/shadow-local-light.json ...` failed because the browser pool could not start: Node received `EPERM` opening its local listener at `127.0.0.1:4329`. The full scene gate was attempted through `node --import tsx/esm tools/scenelab/gate-run.ts gate`; all 50 rows were not run because each browser-pool child exited 75 for the same socket restriction. This is not a visual pass. Capture and inspect the fixture across zoom 1/1.5, high/low, WebGL2/WebGPU when the browser pool is available.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused render contract: `VITEST_MAX_WORKERS=1 npx vitest run --project default --configLoader runner tests/shared/render-contracts.test.ts` — 14 passed.
- `VITEST_MAX_WORKERS=4 npm test` — failed with host-sensitive failures unrelated to this change: navigation test timeout, review freshness expectation, and test-budget child cleanup. The shadow render-contract passed in both full-suite attempts. No suite limits were changed.
- `npm run scene:gate` — could not start because the sandbox denied tsx's local IPC socket (`EPERM`); direct Node invocation reached the gate but all browser batches exited 75 when the browser pool listener was denied.

## Remaining verification

The code-level behavior and regression contract are covered, but runtime direction and smooth transition still need an opened after capture. The requested L6–L10 and other night-level matrix, WebGPU, and scene-gate evidence also remain unmeasured due to the local socket restriction. No spec, E25 status, or existing baseline was changed.
