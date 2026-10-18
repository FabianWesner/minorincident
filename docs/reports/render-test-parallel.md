# Rendering test capacity on the Mac mini

> **2026-10-18 operational correction:** The capacity recommendations below were superseded after WindowServer watchdog session losses. The current Mac hard limit is **two headless browsers**, regardless of `E2E_SLOTS`; the browser gate runs locally. Hetzner handles CPU suites; SwiftShader browser runs are opt-in. WindowServer CPU admission uses a ten-second measurement (wait above 60%). Uncapped timing runs require quiet-run, at most 20 minutes per batch, with a 30-minute admission deadline. Preserve local WebGPU and E18 native timing coverage. See [GPU offload report](gpu-offload/README.md) and [deploy gate](../qa/deploy-gate.md). Earlier throughput measurements are historical evidence, not permission to run three/four browsers.


Research and measured prototype, 2026-10-13. Branch `lane/render-test-parallel`; source build `cbdba3f0`. Apple M4 Mac mini, 10 CPU cores, 16 GiB unified memory. Playwright 1.63.0, bundled Chromium revision 1243, three.js 0.186.0, Node 26.0.0, macOS 26.5.1 (25F80). No deployment or merge.

## Method

All browsers were headless. Browser probes reserved every existing machine lock slot through `tools/perf/quiet-run.sh`; it admitted each group only after load average fell below 3 with no other headless Chromium or local Vitest process. The machine remained in use: background CPU and load are retained in the data, rather than describing these runs as a laboratory benchmark. Probe groups release their reservation on completion. The initial production build took **4.59 s** wall time (Vite: 3.92 s), with 1,245,200,384 bytes maximum RSS reported by `/usr/bin/time -l`.

Each Scene Lab worker ran the same four authored fixtures, in order: `bench-sitter` (300 ticks, two captures), `house` (30 ticks, two captures), `courier-turns` (540 ticks, four captures), and `qa-grove-east-south` (26 ticks, three captures). Two repetitions per setup; viewport 1280×720, DPR 1, high quality, WebGL2 through ANGLE Metal. A later independent N=1–4 sweep requests and verifies WebGPU on Apple Metal. All authored gates, captures, fixed ticks and readiness waits were retained. The sitter's existing clipping gate fails with exactly one intersection on the serial baseline; that is recorded as a deterministic fixture failure, separately from any change of outcome or pixels under concurrency.

The in-process sweep compares N=1,2,3,4 independent browser processes with N separate contexts in one browser, plus retained browser/page sessions. It uses one preview server to isolate the browser comparison. A separate sweep invokes the **actual Scene Lab CLI in separate Node processes with separate dev servers**, N=1,2,3,4. The Playwright runner comparison uses six real scene tests, fresh contexts and worker-owned browsers, with **only one or two workers**: the repository limit excludes three- and four-worker Playwright probes.

Telemetry samples at one-second intervals: the owned process tree's summed RSS and `ps %cpu`, host load, other processes' CPU, AGX GPU device utilization and allocated system memory, and swap usage. Summed RSS can count shared pages and changes under memory compression; it is **not physical footprint** or a private allocation measurement. `ps %cpu` is a process-lifetime average, not instantaneous CPU usage; 100% represents one core. GPU counters include the user's desktop. Short peaks can be missed. Throughput includes scene/context opening in the measured rounds; common browser/server priming is separately included in `totalMs`. Warm-mode round zero starts with one primed session and opens the remaining contexts; round one reuses them all.

## Measurements

[Committed measurements](render-test-parallel-data.json) retain resource samples, timings, gates, decoded-pixel hashes and backend capabilities. Raw PNGs and complete metrics remain under `test-results/render-parallel/` in this worktree. All memory figures below are **MiB**; earlier progress updates incorrectly labeled division by 1,000 as GiB.

| Setup | Scenes/min | Peak RSS (MiB) | Peak CPU (%) | GPU mean/peak (%) | Unexpected outcomes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Separate browsers, one preview, N=1 | 14.1 | 2,543 | 352 | 35/98 | 0/8 |
| Separate browsers, one preview, N=2 | 25.6 | 4,335 | 619 | 46/100 | 0/16 |
| Separate browsers, one preview, N=3 | 34.4 | 5,995 | 912 | 48/100 | 0/24 |
| Separate browsers, one preview, N=4 | 37.9 | 6,050 | 906 | 58/100 | 0/32 |
| One browser, fresh contexts, N=1 | 14.1 | 2,444 | 308 | 40/100 | 0/8 |
| One browser, fresh contexts, N=2 | 24.9 | 4,387 | 700 | 44/100 | 0/16 |
| One browser, fresh contexts, N=3 | 29.5 | 6,055 | 858 | 49/100 | 0/24 |
| One browser, fresh contexts, N=4 | 36.5 | 6,204 | 891 | 55/100 | 0/32 |
| One browser, retained sessions, N=1 | 13.5 | 2,556 | 257 | 24/100 | 0/8 |
| One browser, retained sessions, N=2 | 26.3 | 4,477 | 548 | 35/99 | 0/16 |
| One browser, retained sessions, N=3 | 35.2 | 6,343 | 702 | 62/100 | 0/24 |
| One browser, retained sessions, N=4 | 40.0 | 6,323 | 885 | 66/100 | 0/32 |
| Actual CLI, private dev servers, N=1 | 14.4 | 3,236 | 377 | 33/100 | 0/8 |
| Actual CLI, private dev servers, N=2 | 25.4 | 5,525 | 735 | 44/100 | 0/16 |
| Actual CLI, private dev servers, N=3 | 33.1 | 6,630 | 912 | 48/100 | 0/24 |
| Actual CLI, private dev servers, N=4 | 38.0 | 7,551 | 919 | 51/100 | 0/32 |
| Separate browsers, WebGPU, N=1 | 17.2 | 2,153 | 329 | 21/91 | 0/8 |
| Separate browsers, WebGPU, N=2 | 31.4 | 4,569 | 567 | 34/97 | 0/16 |
| Separate browsers, WebGPU, N=3 | 42.7 | 6,980 | 843 | 44/100 | 0/24 |
| Separate browsers, WebGPU, N=4 | 47.7 | 7,122 | 920 | 47/100 | 0/32 |
| Unified headless browsers, N=2 | 21.3 | 5,617 | 476 | 37/100 | 0/16 |
| Warm browser through CDP, N=2 | 26.9 | 4,458 | 574 | 49/100 | 0/16 |
| Actual CLI, private previews, N=3 | 32.1 | 5,994 | 893 | 55/100 | 0/24 |
| Actual CLI, shared preview, N=3 | 33.2 | 5,929 | 872 | 50/100 | 0/24 |
| Playwright, 1 worker | 10.2 | 2,870 | 388 | 21/100 | 0/6 |
| Playwright, 2 workers | 17.5 | 4,760 | 747 | 45/100 | 0/6 |

All **492 measured scene executions** retained the expected gate outcomes. The 120 sitter executions fail the same existing one-intersection clipping gate; the other 372 executions pass. No new console failure or reported context loss occurred. All **1,356 captures** exactly match the corresponding serial baseline's decoded RGBA pixels **within their renderer backend**. Browser backends are not compared against each other's goldens. “0/n” is the observed instability count on these repeated fixtures, not a predicted future flake rate. Two rounds, one host and four scene fixtures do not establish soak reliability or capacity for every full mission. The Playwright probe also uses Scene Lab's 1280×720 context, rather than the normal suite's 1600×900 viewport.

Three actual CLI lanes deliver **2.30×** the serial CLI throughput and retain **87%** of four lanes' throughput. Their peak summed RSS is **6,630 MiB (6.47 GiB)**, versus **7,551 MiB (7.37 GiB)** at four. Single-session probes peaked at 2,153–3,236 MiB (2.10–3.16 GiB), including their Node/browser/server overhead. Plan from the measured aggregate with desktop/job headroom; compression and shared mappings make the RSS rows non-linear. The WebGPU sweep independently supports the same choice: three sessions deliver 42.7 scenes/min, four 47.7, with diminishing returns and higher aggregate memory. Its serial/parallel captures also remain identical within WebGPU.

The six-test Playwright workload takes **35.36 s with one worker** and **20.54 s with two**, a **1.72×** speed-up; all 12 tests pass with retries disabled. N=3/4 worker runs were deliberately excluded by the repository's two-worker limit. Shared-browser sessions do not avoid the per-page renderer/scene costs: fresh shared contexts are slower at N=3, while retained contexts gain only 2–6% at N=2–4 over independent browsers in this sweep. CDP attachment takes 17 ms; its 26.9 scenes/min versus 26.3 for in-process warm sessions does not justify attributing a throughput improvement to the transport. Unified headless Chromium at N=2 gives 21.3 scenes/min and 5,617 MiB peak RSS versus shell's 25.6 and 4,335. Keep the shell for this workload.

Shared immutable preview and three private previews give **33.2 versus 32.1 scenes/min**, with **5,929 versus 5,994 MiB** peak summed RSS. Hashing/copying the 371 MiB build costs another **879 ms**, excluded from scene throughput; server startup is also outside that prototype's measured rounds. The small difference is within the uncertainty of these short sequential runs. Avoiding duplicate 4.59-second builds may be useful for an identical-build sweep, but the 10–30 minute production queue waits were not reproduced or causally measured. A persistent preview service is deferred: these measurements do not justify its leases/identity/lifecycle machinery.

Serial capability checks confirm actual WebGPU with non-fallback Apple adapters in shell/full Chromium (`apple`, `metal-3`) and Playwright WebKit (`apple`). The confirmed courier scene takes 4.20/4.23/4.24 s respectively, excluding browser boot. These are capability probes, not a cross-engine speed ranking. The later WebGPU capacity sweep still serves as research; the project's manual WebGPU validation policy remains.

Dawn Node + the repository's three.js rendered a cube into a RenderTarget and verified 100 center-pixel readbacks on a non-fallback Apple M4 Metal device. The confirmed run reports **63.6 ms** renderer init/compile after imports, **0.373 ms** median render/readback, **45.5 ms** total for 100 checks, and **107.4 MiB peak process RSS**. This is a small pure-render check, not scenes/min for the game. Peak RSS uses Node's documented kibibyte `resourceUsage().maxRSS` result. [Node resource accounting](https://nodejs.org/api/process.html#processresourceusage).

The OS shell Metal cache was 428 MiB at initial inventory, approximately 430 MiB after the WebGL sweep and 440 MiB after the additional backend probes/sweep. This does **not** reproduce the reported 3 GiB/hour growth on a diverse long-running workload. No cache was cleared, made read-only or moved. The first experimental harness attempts required a missing RAF-yield shim for Dawn and an explicit repository cwd for the relocated Playwright config; those setup failures were corrected and excluded from throughput/flake counts, with logs retained under `/tmp/render-test-parallel-*`.

## Recommendation

Historical recommendation (superseded 2026-10-18): use **three machine-wide browser units by default**, with one unit per Scene Lab browser or Playwright worker. This permits three one-browser jobs, or a two-worker Playwright job alongside one Scene Lab job. A two-worker suite keeps its measured speed-up without pretending to cost one slot. Four simultaneous sessions are the **highest measured capacity**, not a new per-process Playwright worker limit; opt into four units for a coordinated throughput sweep when desktop latency and memory permit. Timing/perf gates always reserve the whole range and run alone with one worker.

Keep the existing headless shell and Metal flags, multi-file Scene Lab batches and ordinary Playwright browser-per-worker lifecycle. Avoid a global warm browser/CDP daemon on these numbers. Keep the macOS Metal cache shared and writable; monitor growth and retire owned browser batches at natural boundaries rather than modifying a host-wide cache while lanes run. Preserve each lane's own sources/server; use the immutable-preview prototype only for an explicitly identical built snapshot. Use Dawn as a future narrow shader/material test path if the coverage is worth implementing, with browser integration tests retained.

The admission change addresses oversubscription: previously four command slots could admit eight two-worker browsers. It does not claim a measured end-to-end queue-time reduction. Polling admission remains non-FIFO; under sustained one-unit traffic, a two-unit request can wait longer. Close idle long-lived MCP browser sessions and release their reservations; workloads larger than these fixtures need a fresh capacity measurement rather than assuming this ceiling is universal.


## Research and interpretation

**Browsers versus contexts.** Playwright's worker model gives each worker a browser and runs one test at a time in that worker. Contexts isolate cookies/storage, while browsers provide a separate GPU/crash boundary. Sharing a browser still needs renderer processes, per-scene assets and GPU submissions; it cannot share all game memory. Maintainers recommend measuring the local workload and favor ordinary worker isolation. If cross-process sharing is justified, `launchServer()` plus `connect()` preserves Playwright's protocol. [Worker model](https://playwright.dev/docs/test-parallel), [maintainer discussion #19706](https://github.com/microsoft/playwright/issues/19706).

**Warm reuse and CDP.** Scene Lab already opens one browser/page for an entire multi-file CLI batch; its MCP session is also retained. Playwright already reuses a browser between tests in a worker while creating fresh contexts. A global browser daemon therefore saves startup mainly between separate commands, and introduces lifecycle/version/crash management. CDP can attach to an existing Chromium browser, but Playwright documents lower fidelity than its own protocol. Reuse fresh contexts for unrelated jobs; pages in one context share storage. [Connection APIs](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp).

**Headless implementation.** Both current launch sites omit `channel`, so they **already use chrome-headless-shell**. Full Chromium's unified headless mode is selected with `channel: 'chromium'`, still `headless: true`; adding `--headless=new` to the shell does not turn it into full Chrome. Unified headless shares the regular browser implementation; old headless moved to a separate binary after Chrome 132. Browser-channel changes must be assessed for rendering differences before changing goldens. [Playwright browser selection](https://playwright.dev/docs/browsers), [Chrome headless modes](https://developer.chrome.com/docs/automation-and-testing/headless), [Puppeteer mode selection](https://pptr.dev/guides/headless-modes).

**GPU flags.** Keep the existing `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` on this Mac; verify the reported adapter/renderer rather than inferring hardware rendering from the flags. `--enable-gpu` removes forced software rendering in headless Chrome. `--enable-unsafe-webgpu` is a capability override for an explicitly requested WebGPU probe; it is not a throughput setting. `--ignore-gpu-blocklist` bypasses eligibility checks, rather than adding GPU capacity. There is no measured reason to add `--disable-gpu-sandbox`; the captured Playwright command already contains `--no-sandbox`, and removing a sandbox does not make more Metal GPU engines. OffscreenCanvas can move browser rendering to a worker, but still consumes the same GPU and needs changes to the DOM/input/asset pipeline; it does not make existing pages cheap. Xvfb solves a Linux X11/display issue and is not needed for these headless macOS runs. [Chromium headless GPU guidance](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/using-gpu-hardware-in-headless-chrome.md), [Chromium GPU debugging](https://github.com/chromium/chromium/blob/main/docs/gpu/debugging_gpu_related_code.md).

**Caches and pipeline warmup.** Distinguish three.js's in-memory shader/pipeline cache, Chromium profile caches, and macOS's Metal compiler cache. Independent Playwright launches use temporary profiles; the OS cache is already shared by the executable/bundle identity. On this machine the shell cache is under `$(getconf DARWIN_USER_CACHE_DIR)/com.apple.metal` (428 MiB at the initial inventory), not the nonexistent `org.chromium.Chromium.helper/com.apple.metal` directory. Chromium's macOS sandbox explicitly permits Metal cache writes to system-selected directories. A shared **read-only Metal cache per build** is not a supported cache selector found in the reviewed documentation. Changing permissions or clearing this host cache would affect other jobs, and was not attempted. A Chrome user-data directory or HTTP disk-cache flag does not relocate the OS Metal cache. [Chromium macOS GPU sandbox](https://chromium.googlesource.com/chromium/src/+/main/sandbox/policy/mac/gpu.sb).

Warm representative materials/variants and wait for streaming/pipeline readiness before screenshot or frame-budget measurement; include that cost when measuring boot. Scene Lab already keeps `ready()` and the game's screenshot readiness contract. Preserve cold-start checks as cold checks; do not turn them into warm checks to improve reported timings. A shared browser should be recycled at batch boundaries if its resource counts grow; it should not run indefinitely merely to preserve caches. Three's WebGPURenderer supports explicit compilation and backend fallback, so a successful request is insufficient evidence of actual WebGPU execution. [Three renderer API](https://threejs.org/docs/pages/WebGPURenderer.html).

**Workers, sharding, servers.** `fullyParallel: true` is already set. It improves scheduling granularity; it does not add GPU capacity. Sharding on this same Mac multiplies competing browsers; use it to distribute functional checks to different machines, with at most two workers per process and a machine-wide admission budget. Remote SwiftShader runs remain useful for functional correctness; preserve local GPU visual/timing coverage. A shared preview must serve a copied immutable build, identified by both commit and full output-content digest: HEAD alone cannot identify dirty source/public content. Sharing a lane's dev server risks silently testing different sources. The prototype compares private dev servers with a single copied production build and records copy/hash cost. A production shared preview service additionally needs build validation, leases, stale-process cleanup, per-build port/identity checks and artifact isolation. [Playwright sharding](https://playwright.dev/docs/test-sharding).

**Alternatives.** Playwright WebKit is its patched WebKit build rather than stock Safari; use it for a distinct compatibility check, not as a replacement for Chromium rendering goldens. WebGPU support needs a local capability probe; an upstream report notes differences from stock Safari. [WebKit browser notes](https://playwright.dev/docs/browsers#webkit), [WebKit WebGPU issue #39762](https://github.com/microsoft/playwright/issues/39762).

Dawn's `webgpu` npm bindings can render textures/read back pixels without a browser; they do not supply HTML canvas, DOM image/video import or other web APIs. The isolated prototype uses the repository's three.js WebGPURenderer with a real Metal device and RenderTarget, validates a green cube's center pixel 100 times, and installs the optional native package outside this worktree. This is a pure renderer feasibility/overhead check, not an equivalent Scene Lab benchmark. A game harness port would need loaders, texture import, browser globals, render targets, post-processing and frame scheduling. Adopt it later for narrowly scoped shader/material checks if useful, while retaining browser integration. The installed `webgpu@0.6.2` package declares MIT; no repository dependency was added. A separate Apache-2.0 project demonstrates a broader three.js headless runtime, but was not adopted. [Dawn Node bindings](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/dawn/node/README.md), [binding publisher's API and limitations](https://github.com/dawn-gpu/node-webgpu), [headless-three-webgpu](https://github.com/juniorxsound/headless-three-webgpu).

The MIT-licensed `puppeteer-cluster` offers page/context/browser scheduling, but those modes face the same local hardware limits; a change of automation library does not add GPU capacity. Browserless provides remote browser provisioning and connection/session management; investigate only if a service with the required real GPU can offload this workload. Neither was installed, contacted for render jobs, or measured. Browserless source is dual-licensed SSPL/commercial; its source license is outside this repository's permissive dependency allowlist. [Cluster license](https://github.com/thomasdondorf/puppeteer-cluster/blob/master/LICENSE), [Browserless license](https://github.com/browserless/browserless/blob/main/LICENSE). [puppeteer-cluster modes](https://github.com/thomasdondorf/puppeteer-cluster#concurrency-implementations), [Browserless documentation](https://docs.browserless.io/).

**Reddit research, treated as anecdotes.** The r/QualityAssurance discussion recommends reducing workers and recording resource pressure when shards multiply processes; r/Playwright discusses context memory/lifecycle problems; r/webdev's WebGL-in-Docker discussion concerns software rendering/display/backend configuration; r/threejs describes shader warmup and mistaken backend assumptions. These informed probes, not capacity claims. The broad assertion in the three.js thread that WebGPU has no software fallback was not adopted as a general technical fact. [r/QualityAssurance](https://www.reddit.com/r/QualityAssurance/comments/1kcdqn0/playwright_tests_failing_inconsistently_when/), [r/Playwright](https://www.reddit.com/r/Playwright/comments/1jh259y/help_need_to_manage_and_run_heavy_tasks_in/), [r/webdev](https://www.reddit.com/r/webdev/comments/1hitq7q/webgl_with_puppeteer_in_docker/), [r/threejs](https://www.reddit.com/r/threejs/comments/1vcnk3t/webgl_to_webgpu_migration/). A Playwright issue likewise reports memory pressure with parallel headless runs; its reproducer/environment is different from this game. [Issue #36686](https://github.com/microsoft/playwright/issues/36686).

## Changes, validation, and proposed lane rules

Implemented:

- `tools/e2e-lock.sh`: default capacity three; reserve one/two units, infer ordinary Playwright worker arguments and full executable paths, charge two for an unspecified Playwright worker count, reject under-reservation or nested expansion, and consider every free pair without holding a partial allocation while waiting. Preserve lock-file inodes. Preserve command stderr and distinguish actual child exit 75 from lock contention so a failing command is executed only once.
- `tools/perf/quiet-run.sh`: reserve at least the legacy four-slot range, even when `E2E_SLOTS=1`; expose/report the actual held capacity for nesting and conditions logs. Preserve the existing quiet preflight. Without macOS `lockf`, retain direct execution for remote runners.
- `SceneSession.open(browser)`: borrow a headless browser in an isolated context; closing a borrowed session leaves the owner's browser alive. This supports the prototype and normal Playwright fixture ownership. Normal CLI behavior is unchanged.
- Reproducible browser/context, actual-CLI/server, Playwright worker, backend capability and optional Dawn probes; shared telemetry and compact result/pixel comparison scripts. The copied shared-preview is a measured prototype, not a persistent cross-lane service.
- Updated `docs/tools/scene-lab.md`; corrected the obsolete headless-WebGPU availability comment in Playwright config. No launch defaults, renderer code, golden pixels, specs or reference content changed. `CLAUDE.local.md` remains for the orchestrator to edit.

Validation:

- `npm run typecheck`: passed, including `tsconfig.sim.json`.
- `npm run lint`: passed; final changed helper/test files also checked after the last adjustments.
- `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2`: **196 files, 1,220 tests passed**, 152.05 s. Generated tracked unit-test metrics were restored rather than committed.
- Seven capacity-lock regressions pass: weighted contention/release, exact child exit 75 and stderr, worker inference (including full paths), invalid/undersized reservations, re-entrancy/expansion, nonadjacent slot allocation, and quiet-run's fourth-slot coverage. The final path-inference adjustment was rechecked with this file.
- 26 measured setups, **492 scene executions / 1,356 backend-specific pixel comparisons**, expected outcomes throughout; 12/12 Playwright tests passed. Additional capability probes and 100 Dawn readbacks passed. Native frame-budget gates were not claimed from the throughput probes.
- `git diff --check` and shell syntax checks passed. No epic completion is claimed; there is no assigned epic for a `verify -- E<NN>` gate. No deployment, merge, headed browser, port-3300 server or broad process kill.

Proposed addition to **CLAUDE.local.md** (orchestrator applies it; deploy the lock script across active worktrees consistently):

```text
Browser capacity on the M4/16 GiB Mac is budgeted per live browser, not per lane command.
Use tools/e2e-lock.sh for every normal browser job. Default E2E_SLOTS=2; hard maximum two on Mac.
Scene Lab / look / replay / single-browser MCP cost one unit. Keep related scene specs in one batch.
Playwright commands cost their worker count; never exceed two workers. Prefer --workers=1 for small jobs;
use --workers=2 for full suites (the wrapper reserves two units automatically).
Opaque sh/npm wrappers must declare their maximum E2E_UNITS=1 or 2; reserve that capacity at the outer wrapper.
Nested wrappers can reuse a reservation but cannot expand it. Close idle retained browsers and release their reservations.
Do not raise Mac capacity for throughput sweeps; offload CPU suites to Hetzner. Remote browser runs are opt-in.
Native timing/perf: invoke tools/perf/quiet-run.sh directly, --workers=1, with no outer e2e wrapper.
Quiet-run reserves at least all four legacy slots; E2E_SLOTS=1 on an ordinary wrapper is not a quiet-machine guarantee.
Each lane has a unique E2E_PORT and SCENE_PORT; never use 3300. Reuse another server only for an explicitly
verified immutable build identified by both commit and full served-content digest. Preserve per-lane artifacts.
Keep headless chrome-headless-shell + --use-angle=metal --enable-gpu --ignore-gpu-blocklist.
WebGPU validation remains manual under project policy; the documented headless WebGPU tools are research probes.
Do not chmod, clear or relocate the host Metal cache while lanes run. Retain current OS cache sharing.
```

Reproduce from this worktree with `npm run build`, then the commands in [Scene Lab documentation](../tools/scene-lab.md). For the optional pure-render probe:

```sh
npm install --prefix /tmp/render-test-parallel-dawn --no-audit --no-fund webgpu@0.6.2
DAWN_MODULE=/tmp/render-test-parallel-dawn/node_modules/webgpu/index.js sh tools/perf/quiet-run.sh node tools/scenelab/dawn-probe.mjs
```

The experiment used only owned PIDs and private ports 3471–3476. Native dependency installation stayed outside the repository. Browser/server processes created by probes closed at the end of each group; retained artifacts and the optional temporary Dawn package remain available for review.
