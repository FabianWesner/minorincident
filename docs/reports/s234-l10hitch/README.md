# s234 — L10 second infected opening hitch

**Status: perf pending; cause and runtime fix remain open.** The PO reports an opening hitch when the second infected engages, around ticks 550–700, from the seed-1 `cure-crash` checkpoint on foot in D-CURE. The s194 first-spawn material fix is already present, but its report says its replay did not establish the PO location/trigger and quiet remeasurement was still open. That evidence does not establish this report is solved.

## Fixture and measurement

`tools/perf/s234-l10hitch.ts` replays the existing `tests/fixtures/perf/l10-real-input.json.gz` on L10 seed 1 from `cure-crash` through tick 900, on native headless WebGPU high at 1600×900. It records RAF frame intervals and tick, position, infected/alive counts, renderer material builds, simulation/update/render CPU times, and the existing CPU profiler categories. It reports p99, longest interval, frames over 33/50 ms, and the worst frames within ticks 400–900, and saves the full trace under `test-results/s234-l10hitch/`.

Exact quiet-run command:

```sh
E2E_UNITS=1 SCENE_PORT=5264 sh tools/perf/quiet-run.sh npx tsx tools/perf/s234-l10hitch.ts webgpu high before
```

The run is **pending**. The default quiet-run path failed before browser startup because the browser-pool daemon could not bind `127.0.0.1:4329` (`listen EPERM`). The legacy quiet-run path also failed admission because the process scan returned `spawn EPERM`; it was stopped while still waiting. There is no valid baseline trace or before/after result. The orchestrator should run the exact command above when browser admission is available. After identifying and fixing the measured cause, rerun the same command with label `after` and compare the same fixture/window.

## Current evidence and open work

- `npm run typecheck`: passed with the new trace harness.
- `npm run lint`: passed.
- Remote unit suite: `sh tools/remote/run.sh "$PWD" -- npm test` could not start; there is no healthy Hetzner runner and the remote command is not eligible for the local Mac fallback.
- L10 skilled completion: the raw threat audit completed the L10 seed-1 skilled route (`complete`, 1324.35 simulated seconds). The filtered L10-only audit is diagnostic and ends with `PARTIAL_LEVEL_SELECTION`; it is not a full gate.
- `qa:threat` zero: the formal `npm run qa:threat -- --levels L10 --maxWorkers=1` wrapper rejected the run before execution because the repository currently has 151 cases against its 150-case budget. Running its underlying audit directly completed the L10 passive check with zero L10 passive flags (tick-budget at `hold`) but ended with `PARTIAL_LEVEL_SELECTION`; this does not prove the full `qa:threat` gate is green.
- Cause attribution, runtime fix, before/after p99 / longest-frame / >33 ms counts, and commit of the completed fix: open.

The source currently contains budgeted infected navigation and the prior L10 loading-time render warm-ups. Either may be relevant, but without a tick-aligned admitted trace they are hypotheses, not attribution. No zombie stats, corpse retention, or quality settings were changed.

## Quiet baseline (2026-11-22)

The command above subsequently passed quiet admission and completed on native WebGPU high. In ticks 400–900: 1,352 samples, p99 **9.7 ms**, longest **29.7 ms** at tick 712, and **0 frames >33 ms**. The longest sample had no new material builds; its sampled sim/update/render were 1.0/2.3/3.0 ms. This replay did not reproduce the reported long frame, and its player position at tick 639 differs from the PO report. Attribution and a representative before/after remain open. Raw trace: `test-results/s234-l10hitch/before-webgpu-high/trace.json`. The earlier admission failures were sandbox restrictions; the subsequent run used unrestricted access.

## Combat reproduction pending

The recorded input has no attack inputs during ticks 400–900, so the baseline does not exercise the reported fight. Scene Lab's muted output still runs its audio graph, but requires unlocking. The harness now supports the native L10 skilled driver and unlocks audio after a browser gesture. This mode has not yet been admitted or verified to reach the reported encounter. The attempt exited 75 at the quiet-run 600-second reservation cap while other threat workers kept the host busy. Exact retry:

```sh
E2E_UNITS=1 SCENE_PORT=5264 S234_COMBAT=1 MI_PERF_ADMISSION_TIMEOUT_SECONDS=1200 sh tools/perf/quiet-run.sh npx tsx tools/perf/s234-l10hitch.ts webgpu high combat-before
```

Typecheck and lint passed after the harness change. Verify actual attack, downed state, audio context and location in the trace before using this as evidence for the PO's hitch. The earlier replay baseline was captured before the audio unlock change and cannot serve as a before/after comparison for this mode.

## Combat trace (2026-11-22)

Quiet WebGPU high runs of the skilled driver completed: ticks 400–900 p99 9.5 ms, longest 29.7 ms at tick 682, 0 intervals over 33 ms (1,296 samples). A repeat with audio-state recording measured p99 9.5 ms, longest 28.0 ms at tick 680, 0 over 33 ms (1,320 samples). Audio was running and unlocked, with 201 cues logged and no audio errors; output was muted. At tick 682 the first trace had 8 infected, 6 alive, and no new material builds. The player was at x=582 near tick 470, versus the PO's x=582.32 at tick 639; at tick 639 the trace was at x=594.67. These runs do not reproduce the reported long frame or establish its cause. The two runs are repetitions of the same code, not before/after a fix. Raw traces are `test-results/s234-l10hitch/combat-before-webgpu-high/trace.json` and `test-results/s234-l10hitch/combat-audio-webgpu-high/trace.json`.

The harness now asserts the audio context is running, unlocked, foreground and unmuted in settings, and records the audio snapshot. Typecheck and lint passed. A closer reproduction of the PO's movement and engagement remains necessary.

## Position-matched diagnostic

The skilled driver can now suppress movement for `S234_DELAY` initial ticks while retaining combat. This is a constructed input, not the PO's recording. Quiet WebGPU high with `S234_DELAY=135` reached (581.63, 0.17) at tick 639, with 6 alive and 1 downed among 7 infected; the PO reported (582.32, 0.76), 6 alive and 1 downed. Audio was running (174 logged cues). In ticks 400–900 it measured p99 13.9 ms, longest 32.1 ms at tick 871, and 0 intervals >33 ms. The longest sample had no new material builds, with sampled sim/update/render 1.9/3.4/3.8 ms. A 169-tick delay reached (579.83, 0.18) at tick 639 with the same counts; p99 10.7 ms, longest 29.4 ms at tick 897, 0 >33 ms. These are independent baselines, not a fix comparison; neither reproduced a hang. Input history, HP, actual target and exact audio/visual state still differ or are unverified.

```sh
E2E_UNITS=1 SCENE_PORT=5264 S234_COMBAT=1 S234_DELAY=135 MI_PERF_ADMISSION_TIMEOUT_SECONDS=1200 sh tools/perf/quiet-run.sh npx tsx tools/perf/s234-l10hitch.ts webgpu high matched-before
```

Raw traces: `test-results/s234-l10hitch/matched-before-webgpu-high/trace.json` and `test-results/s234-l10hitch/delayed-before-webgpu-high/trace.json`. Typecheck and lint passed for the diagnostic change. Root cause, runtime fix, before/after proof and remaining gates remain open.

## Normal damage and reported camera

A further quiet run used `S234_MATCH=1 S234_COMBAT=1 S234_DELAY=135`, normal damage and zoom 0.99. At tick 639 the captured state was (581.63, 0.17), HP 80, machete selected, six alive and one downed; the PO reported (582.32, 0.76), HP 90, machete and the same population. Audio was running. Across ticks 400–900 p99 was 10.5 ms, longest 30.4 ms at tick 862 and 0 frames exceeded 33 ms. Full trace: `test-results/s234-l10hitch/state-before-webgpu-high/trace.json`. The constructed driver downed its first infected at tick 388, so matching a snapshot does not prove the same engagement history. Cause and fix remain unproven. The harness saves the tick-639 player, weapon and camera snapshot for future comparisons. Typecheck and lint passed.
