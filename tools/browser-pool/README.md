# Shared headless browser pool

From the worktree root, run `npm run browser:pool` and leave that process running. It listens on `127.0.0.1:4329`; Chrome starts lazily. Stop this owned process with Ctrl-C. It closes its own browsers and releases the legacy locks.

Migrated wrappers discover the pool automatically:

```sh
E2E_PORT=4322 sh tools/e2e-lock.sh npx playwright test --project=chromium --workers=2
SCENE_PORT=4321 npm run scene -- specs/scenes/house.json
BROWSER_POOL_BACKEND=swiftshader E2E_PORT=4322 sh tools/e2e-lock.sh npx playwright test tests/e2e/smoke.spec.ts --project=chromium --workers=1
SCENE_PORT=4321 sh tools/perf/quiet-run.sh npx tsx tools/browser-pool/timing.ts
```

GPU/Metal serves WebGL2 and WebGPU. SwiftShader is a separate headless process for WebGL2 functional checks; it is not a native timing or WebGPU substitute. Each backend has at most one Chrome root. Each context has separate cookies, local storage, IndexedDB and pages. Direct clients can discover the Playwright `wsEndpoint` values at `GET /health` and use `chromium.connect()` followed by `browser.newContext()`. The pinned Playwright version must match.

A lease begins at `Browser.newContext` and ends when that context is actually disposed. The daemon observes client page actions in the Playwright protocol; browser-generated console/network events do not renew a lease. An in-flight action is allowed to finish. An idle context closes after 60 seconds, and idle Chrome processes close after another 60 seconds. These close operations release GPU capacity and every legacy browser slot. The daemon itself can remain running.

Scene Lab CLI/catalog and A/B QA release their context after each spec/capture group. Playwright releases each test's contexts. A continuous playtest owns a context while it sends controls; a paused live session expires after 60 seconds without `/act` or `/shot`, even if autofight or `/look` monitoring was enabled. Restart the live session after expiry. A capture in the middle of an active playtest retains that playtest's state until its current step ends. Continue-mode playtests already end their step at each level. Playtest profiles use `pool-storage.json`, including IndexedDB, and carry state between the new pooled and fallback paths. Historical profiles created before this helper need one fallback seed/session to export that portable state.

Exclusive timing requests block new shared contexts, let current steps finish or expire, then admit one context at a time. Quiet-run retains load < 3, no foreign headless Chrome, no local Vitest/Blender/build, the one-minute cooldown and bounded admission/batch durations. Native channel/uncapped options can restart GPU Chrome after shared contexts drain. Test fixtures reconnect per context. Opaque quiet-run commands run with pooled browsers retired and all legacy locks reserved, so an old direct launcher also runs alone.

The pool reserves legacy slots 0–3 before launching Chrome. Unmigrated tools still use those locks; after idle Chrome release or daemon shutdown they run normally. If discovery finds no pool, wrappers retain the original launch path. A pool disappearing after admission is an error; clients never silently start an unguarded second GPU browser. `BROWSER_POOL=off` explicitly selects the fallback.

Controls (per command/process; no global configuration):

| Variable | Default | Purpose |
| --- | --- | --- |
| `BROWSER_POOL_PORT` | `4329` | Daemon HTTP/WebSocket port; allowed 4321–4329 |
| `BROWSER_POOL_URL` | `http://127.0.0.1:4329` | Client discovery address |
| `BROWSER_POOL_BACKEND` | Mac `gpu`, elsewhere `swiftshader` | Client backend |
| `BROWSER_POOL_SHARED_LIMIT` | `4` | Maximum active contexts across backends, 1–6; SwiftShader capped at two |
| `BROWSER_POOL_IDLE_MS` | `60000` | Context/live action idle timeout |
| `BROWSER_POOL_BROWSER_IDLE_MS` | `60000` | Chrome idle release timeout |
| `BROWSER_POOL_WAIT_MS` | `1800000` | Client/context admission deadline |

Every ten seconds, WindowServer CPU is computed from CPU-time deltas. Above 60%, shared admission drops by one context; three consecutive samples below 30% restore one, up to the configured limit. A missing/restarted WindowServer sample reduces admission to one. Existing active work reaches its next safe point. GPU startup also uses the existing ten-second guard with a one-GPU-browser cap. Status and structured lifecycle/host telemetry are available at `/status` and daemon stdout.

Validation and measurements:

```sh
npx tsx tools/browser-pool/check.ts
npx tsx tools/browser-pool/benchmark.ts before
BROWSER_POOL_SHARED_LIMIT=4 npx tsx tools/browser-pool/benchmark.ts after
```

`check.ts` uses headless SwiftShader, owns its daemon/PIDs, and checks isolation, queuing, idle cleanup, exclusive drain/restart, profile portability and pool-down fallback. The benchmark reserves all legacy slots for the old path, enforcing one GPU Chrome total. It keeps raw captures, command logs, samples and summaries under `test-results/browser-pool/`. See [measurements and recommendation](../../docs/reports/browser-pool/README.md).

The WebSocket proxy observes the Playwright 1.63.0 protocol rather than CDP. Run these lifecycle checks when upgrading Playwright. This is a local development service; do not expose its loopback endpoint publicly.
