# p0-l8load — L8 loading repair

**PASS:** L8 loads and plays through Begin + 60 seconds in all four quality/backend cells. Scene gate passes **50/50**. Smoke passes **6 QA checks + 1 public-build check** in **128.4 seconds**.

## Repair

The canonical `tools/assets/build-l8-monkeys.ts` derivation only generated high GLBs. It now also derives all three low LODs of `amb.monkey`, `inf.monkey`, `amb.lioness`, and `inf.lioness` from the corresponding shipped low gorilla/lion exports. The low atlases have a maximum side of 512 pixels; high remains 1024 pixels. Twelve missing low GLBs are committed.

The appended monkey tail was fully hip weighted, but its `_CROWD_PART` metadata inherited the first body vertex's owner. At LOD2 that owner was `armR`, with no matching tail weight. The builder now resolves the hip's skin-joint index and uses it for both tail ownership and weights. The strict runtime weighted-owner assertion remains in place.

`tools/assets/validate.ts` checks weighted semantic owners and required low siblings. Low coat-variant paths follow the registry's quality-before-decay order. The existing asset-contract test now rejects a missing low GLB and an unweighted low owner, then reads all **408 high/low LOD/coat GLBs across 64 crowd manifest entries** and checks ownership. The test budget remains **150/150 cases, 43/45 files**.

## Browser proof

[Raw evidence and current asset/probe hashes](four-cells.json). One pooled headless Metal browser, one isolated context at a time, with the 600-second wrapper cap. Each cell loads a fresh `L8-default` campaign with its requested quality set before loading, clicks the native Begin button, and runs the production `complete` bot at normal time scale. No health, actor, mission or renderer overrides.

The engine calls its WebGL backend `webgl`; the probe additionally checks that the actual canvas context is `WebGL2RenderingContext`. WebGPU cells assert the actual selected WebGPU backend, without accepting a fallback. All four fetch the new animal assets at the requested tier, retain 100 HP, and move the courier approximately 70 metres.

| Cell | Begin → final tick | Wall seconds | Rendered frames | Errors / asset fallbacks | Capture |
| --- | --- | --- | --- | --- | --- |
| Low / WebGL2 | 0 → 3601 | 60.090 | 3599 | 0 / 0 | [60 seconds](low-webgl2-60s.jpg) |
| High / WebGL2 | 0 → 3601 | 60.096 | 3581 | 0 / 0 | [60 seconds](high-webgl2-60s.jpg) |
| Low / WebGPU | 0 → 3601 | 60.085 | 3599 | 0 / 0 | [60 seconds](low-webgpu-60s.jpg) |
| High / WebGPU | 0 → 3601 | 60.086 | 3557 | 0 / 0 | [60 seconds](high-webgpu-60s.jpg) |

Visual review: all four final captures show the rendered zoo, moving courier/group, mission HUD, full health, and the tunnel-alarm dialogue at the sixty-second boundary. The loaded captures show the actual mission briefing and Begin button. This verifies loading and the requested opening play window.

Capture links refer to local review images. Repository policy keeps screenshots untracked; their SHA-256 hashes are recorded in `audit.json`.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Standard asset validation for all 24 GLBs of the four affected animals | PASS, zero errors | [assets.json](assets.json) |
| `npm run typecheck`, `npm run lint`, `npm run test:unit` | PASS; 107 tests, 27 files | [unit.json](unit.json) |
| `npm run verify -- E30` | PASS | [verify-E30.json](verify-E30.json) |
| `npm run scene:gate` | PASS, 50/50; zero known failures or missing rows; 8.5 minutes | [summary](scene-gate.md), [rows](scene-gate.json) |
| `npm run test:smoke` | PASS, 6 QA + 1 public build; 128.4 / 240 seconds | [receipt](smoke.json), [individual checks](smoke-checks.json) |

The gate ran against asset repair commit `0e676b1a`. Subsequent implementation commits only change validation/tests and QA tooling: `git diff 0e676b1a..53d5c6b8 -- src public assets` is empty. The four-cell proof identifies revision `53d5c6b8` and SHA-256 hashes for its producer and all 24 affected GLBs. [Completion audit](audit.json) checks these against the current files and checks all gate, unit, verify and smoke receipts.

The inventory regression check covers file availability, parseability and semantic ownership. A broader scan in the first work session also found pre-existing dimension discrepancies in older human assets; those were not changed by this loading repair. No specifications or gameplay acceptance thresholds were changed.

## Reproduce

```sh
node --import tsx tools/assets/build-l8-monkeys.ts
npm run assets:validate -- --ids amb.monkey,inf.monkey,amb.lioness,inf.lioness
npm run verify -- E30
E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 sh tools/e2e-lock.sh node --import tsx tools/qa/p0-l8load.ts
npm run scene:gate
npm run test:smoke
```

Repair: `0e676b1a`. Regression checks: `1b8f72ca`. Browser proof tooling: `fe1ccff9`, `d4912b9a`, `53d5c6b8`.

Code, JSON receipts and reports are committed locally. Review screenshots and the full `smoke.log` remain local according to repository policy. No deploy or push.
