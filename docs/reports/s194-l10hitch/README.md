# s194 — L10 first infected frame hitch

**Status: perf pending; root cause and fix remain open.** The PO report is a frame hitch at the first infected during L10, seed 1, cure-crash checkpoint, around tick 489 (8.2 s), at player `(551.55, -0.06)`, district D-CURE near crash-machete, WebGPU high, with 7 infected alive.

## Reproduction and trace

`tools/perf/s194-l10hitch.ts` is a headless checkpoint trace harness. It loads L10 from `cure-crash`, starts the mission, records request-animation-frame intervals through tick 600, and samples the existing CPU categories (simulation, AI, crowd, view, render, audio, and others) along with infected counts. Run it during a quiet reservation:

```sh
E2E_UNITS=1 SCENE_PORT=5144 sh tools/perf/quiet-run.sh npx tsx tools/perf/s194-l10hitch.ts webgpu high before
```

The requested high WebGPU reproduction has **not run**. The harness remains unvalidated in a browser and does not yet replay the reported player movement, so matching the reported location and first spawn must be confirmed before using its results. This host was above the quiet-run load threshold (load 3.36 at admission) and the quiet-run process scan failed with `spawn EPERM`; the browser pool also failed to bind `127.0.0.1:4329` with `listen EPERM`. A subsequent locked diagnostic attempt at load 5.32 stopped before browser launch because uncapped timing requires quiet-run. Therefore no worst-frame or p99 numbers, and no attribution to pipeline compilation, uploads, buffer growth, audio, navigation, or AI, are available. Record the actual baseline and candidate numbers here once a quiet run is available. Per the brief, do not treat a loaded-host result as passing evidence.

## Code review findings

L10 already has a full warm-up behind the loading card. `CrowdView` registers the cure encounter slots, schedules the L10 infected models and corpse pages, and requests warm batches. No additional warm-up was added: without a trace, adding duplicate work could increase level loading without addressing the reported frame.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused tests: not run; no cause-specific fix has been established.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: failed before execution (exit 69; no healthy Hetzner runner and this command was ineligible for the local fallback).
- Before → after worst frame and p99: pending quiet-host measurement.
- Backend/tier coverage: WebGPU high, WebGL2, and low remain unmeasured.

## Remaining work

Reproduce the hitch on a quiet machine, identify its dominant cost, apply the existing prewarm/buffer preparation pattern for that cost, then remeasure WebGPU high plus WebGL2 and low. Run focused tests and the remote unit suite, update this report with evidence, and commit the fix.
