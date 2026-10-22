# P1-107: scene preparation

## What the card waits for

`GameView.load()` awaits crowd assembly, shader/node compilation, pose-atlas uploads, actual HDR warm-up draws, and GPU completion fences before closing the loading card. These draws include ordinary and instanced paths, shadows, depth-dependent effects, and alternate lighting graphs. The retained traces show native driver work during preparation; they do not show an asset request, retry timer, worker response or GPU readback causing the long preparation interval.

The original intermittent 10–16 s **L1** outlier has not recurred in this investigation. Its precise original trigger is therefore unproven. The evidence does establish avoidable synchronous driver waits in the same preparation path and reproduces the separately reported **L8** delay. Do not treat an L1 budget pass as a captured trace of that historical outlier.

## Reproduced L8 delay

The quiet baseline profile takes **24.490 s**: scene assembly 17.708 s (infected-crowd preparation 17.256 s), then warm-up 6.177 s. See `evidence/diagnostic-L8/` for the original compressed CPU profile, browser trace and stage measurements.

Cold menu entry used the cooperative L7→L8 handover policy despite having no live scene to keep updating. That policy paces model parsing, pose baking and node builds across many scheduler continuations. The crowd also prepared unused catalogue creatures and duplicate pedestrian figures already rendered through `CivilianCrowd`. The CPU profile records the continuations and idle intervals; profiler sample deltas are not an exact wall-clock attribution.

Cold L8 entry now uses the foreground policy. Live L7→L8 retains its pacing. L8/L10 preparation selects the complete campaign population, including future encounters, animal conversions, dog coats, Alpha/Mega appearances and explicit infected model overrides. Ordinary pedestrians that keep their look retain their existing civilian batches. Unit checks cover both quality settings and future population coverage.

## Native shader and texture waits

Foreground WebGPU previously skipped asynchronous compilation on several levels. Their first actual draws created pipelines synchronously, leaving native compilation to block later queue writes and completion fences. Foreground preparation now compiles disjoint partitions asynchronously on every level. Leaves that acquire viewport depth during the actual multisampled HDR pass remain in that pass: compiling their fallback depth binding produces the wrong sample count.

The WebGL trace also contains `texSubImage2D` waits of about 1.50 s and 0.92 s and `getProgramParameter` of about 0.76 s, with native command-buffer flushes. Pose atlases are now initialized before shader linking on both backends. This avoids large first uploads flushing queued native compilation. Cold foreground upload does not impose a paint pause for every 4 MiB; live/background upload keeps that budget. `evidence/native-waits.json` indexes retained native waits.

Actual warm-up draws, GPU fences, ordinary/instanced representatives, and the L10 lamp variants are retained. There is no new cross-session cache. Each measurement launches a fresh headless browser profile.

## Repeated geometry work

L10's quiet diagnostic comparison still took about 6.1–6.3 s after those changes, including about 2.4 s of scene assembly. The crowd bake expanded indexed source meshes into triangle soup, transformed and packed every repeated vertex, then immediately deinterleaved and welded that data back into indexed meshes. Native source accessors also contain vertices unused by individual material primitives.

CrowdView now retains indices, compacts unused source vertices before transforms, and skips the interleave/deinterleave round trip. Welding preserves Three's quantization and first-use vertex order while hashing each reused source vertex once. The separate civilian grip tessellator retains its triangle-soup input. Real worker, dog and Mega Alpha tests compare exact welded index/attribute bytes and animation matrices with the previous implementation; no triangle or animation sample is removed.

## Acceptance status

The executable gate and complete per-configuration status are in [distributions.md](distributions.md). Diagnostic comparisons with fewer than 20 samples are excluded. Build hashes and quiet-run conditions are retained alongside raw observations. L10 replay evidence identifies its source build separately from the cold-load snapshots.

Both snapshots use Vite's production preview on the same Mac (baseline port 4221, candidate port 4222), with the same public asset tree. The browser is Chromium headless shell 153.0.8010.12, revision 1243, on Apple M4/Metal, viewport 1600×900 and DPR 1. Each observation launches and closes its own browser/profile; it does not reuse HTTP storage or a previous game's JS caches. Later levels use a validated unlocked campaign save, then the real menu selection. This is a controlled local-delivery comparison; it does not measure WAN download latency.

The existing L10 boundary guard additionally uses headless system Chrome 155.0.8059.86 with uncapped rendering. Both debug and saved-continue entries pass on WebGL2 and WebGPU: 84,720 playable frames, largest 28.1 ms, with both prewarmed light sources and actual lamp promotions exercised. See `evidence/l10-entry/` and the retained smoke report (31 passing checks).
