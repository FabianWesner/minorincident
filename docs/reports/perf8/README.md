# perf8 — pre-deploy performance vs live batch 55

**Performance verdict: FAIL.** 11/12 requested matrix cells pass; 1 fail; 0 remain incomplete. All 12 cold/warm load pairs pass. Initial L10 high gameplay fails the maximum-frame rule; its later clean confirmation is shown separately and does not replace that failure.

Candidate: fresh `MI_BUILD_CACHE=off npm run build` at `e494d9823f516294b82bab2fa9eb3e44797fe275`, public bundle `index-BzuaCi5R.js`, SHA-256 `63a63e88f5175a49a2a6b1ee6c0334a51c176e8432e1112e8d04fcfad307f073`. PROD: fresh mirror of [minor-incident.com](https://minor-incident.com/), live batch 55, public bundle `index-C--BNbRW.js`, SHA-256 `f5e0961cc5a0897f8ed007f9f47601fd72af72643a642d9326f734478de2fc7b`. The offline build of deploy commit `5a7f84b` matched the delivered main bundle hash; acceptance uses the downloaded live mirror.

## Verdict table

Load columns are cold/warm seconds. Frame columns are milliseconds, PROD → candidate. L10 high uses the complete 90-second capture; every other WebGPU cell covers a full native gameplay minute. The two named moments are expanded into the captured L10 charge segment, its historical 43/60 and 55/60 samples, and the L4 high war window.

| Scope | Cell / moment | PROD cold / warm s | Candidate cold / warm s | p95 ms P → C | Max ms P → C | Verdict |
|---|---|---:|---:|---:|---:|---|
| WebGPU | L3 low | 3.241 / 2.745 | 2.925 / 2.729 | 16.8 → 16.8 | 150.0 → 16.8 | PASS |
| WebGPU | L4 low | 4.090 / 2.993 | 3.092 / 3.027 | 16.7 → 16.7 | 233.3 → 33.3 | PASS |
| WebGPU | L7 low | 2.790 / 2.511 | 2.541 / 2.578 | 16.8 → 16.7 | 50.0 → 50.0 | PASS |
| WebGPU | L9 low | 4.724 / 3.112 | 3.292 / 3.044 | 16.7 → 16.8 | 50.0 → 50.0 | PASS |
| WebGPU | L10 low | 3.410 / 3.243 | 3.327 / 3.211 | 16.8 → 16.8 | 50.1 → 50.0 | PASS |
| WebGPU | L3 high | 2.574 / 2.439 | 2.574 / 2.460 | 16.8 → 16.7 | 16.8 → 33.4 | PASS |
| WebGPU | L4 high | 3.424 / 3.292 | 3.405 / 3.275 | 16.8 → 16.8 | 50.0 → 49.9 | PASS |
| WebGPU | L7 high | 6.841 / 2.726 | 3.009 / 2.772 | 16.8 → 16.7 | 33.4 → 50.1 | PASS |
| WebGPU | L9 high | 2.920 / 2.908 | 2.942 / 2.890 | 16.8 → 16.8 | 50.0 → 33.4 | PASS |
| WebGPU | L10 high | 3.076 / 2.939 | 3.025 / 2.906 | 16.8 → 16.8 | 216.6 → 250.0 | FAIL: max > PROD+1 frame |
| WebGL2 load | L4 low | 6.624 / 3.160 | 3.260 / 3.156 | — | — | PASS |
| WebGL2 load | L10 low | 7.926 / 3.454 | 3.809 / 3.456 | — | — | PASS |
| Moment | L10 captured charge through completion (+2 s) high | — | — | 16.8 → 16.8 | 216.6 → 250.0 | FAIL: max > PROD+1 frame |
| Moment | L10 charge 43/60 high | — | — | 16.7 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L10 charge 55/60 high | — | — | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L4 war phase within first 60 s high | — | — | 16.8 → 16.7 | 50.0 → 49.9 | PASS |

## L10 high failure and follow-up

The first paired capture records **216.6 → 250.0 ms**, exceeding the one-frame allowance. Both p95 values are 16.8 ms. The maximum occurs at **charge tick 260** on both sides: PROD native tick 60237 at +2.542 s; candidate tick 60405 at +2.502 s. The absolute native entry ticks differ; the charge state aligns. Both have nearby late `corpse_pal_picketWhite` material builds. The next large frames are 166.7/166.6 ms around charge tick 618/617. The frames immediately following first charge completion are 49.9/50.0 ms. These initial ≥66 ms hitches remain visible; the candidate fails the relative maximum rule even though the threshold itself was already exceeded by PROD.

A separate CPU-profiled 15-second paired diagnostic records **50.0 ms on both sides**. Maximum instrumented material graph build times are 32.7/32.6 ms, with frozen-pose bakes at most 2.8/1.7 ms. The profile does not reproduce the original large pause. Public view-update/render CPU probes are compiled out and their zero readings are not used for attribution. The original excess is consistent with first-use shader/driver/cache variation; a candidate-only source cause is unproven. No speculative game change is credited as a fix.

A predeclared unprofiled paired confirmation uses fresh isolated contexts, the same public bytes and 90 seconds through charge completion and the following 30 seconds:

| Confirmation | Duration s | p95 ms | Max ms | ≥66 ms frames | Boundary / page errors | Verdict |
|---|---:|---:|---:|---:|---:|---|
| prod | 90.195 | 16.8 | 50.0 | 0 | 0 / 0 | Control |
| candidate | 90.160 | 16.7 | 50.1 | 0 | 0 / 0 | PASS |

The later confirmation and diagnostic are excluded from initial acceptance selection. They establish that the initial L10 excess did not recur in those captures; they do not certify clean-driver-cache startup or erase the FAIL. No small regression with a demonstrated source cause was found to fix. No game source, count, quality setting, asset, dependency or spec was changed.

## Method and limits

Apple M4 / Mac16,10 / 16 GiB / macOS 26.5.1 (25F80), headless Chromium 153.0.8010.12 / Playwright 1.63.0, native Metal WebGPU and ANGLE Metal WebGL2, 1280×720, DPR 1, seed 1. One context at a time through `tools/perf/quiet-run.sh`, with owned local servers on 4901/4902. Admission logs and commands are retained. Cold is a fresh isolated context and warm its reload; host GPU/driver caches remain shared. Results are one cold/warm pair per cell, not worst-of-N or a clean-driver-cache certification. First-use cost also appears on PROD (L7 high WebGPU cold 6.841 s; WebGL2 L4/L10 cold 6.624/7.926 s); candidate loads pass both rules.

Loads use original public menu bytes. Native gameplay adds the same bootstrap-only exposure of the existing Game instance and common current-source test-control adapter to each public build. Ordinary complete-bot InputFrames drive native gameplay; rendering, simulation and level content remain each build's own. L3 starts at armory; L4 reaches the native turn/war beat; L7 reaches its native opening; L9 drives its ordinary route; L10 starts the finale and records charge completion. Public render probes are compiled out, so zero crowd probe counts are not evidence of absent actors. The L4 moment selects recorded war-phase frames through war tick 3600; the L10 captured charge segment starts at roughly charge tick 120 and ends two seconds after its first completed frame, with the historical 43/60 and 55/60 windows sampled separately.

Pass rules: candidate cold and warm each ≤6 s and ≤PROD+0.5 s; native p95 ≤PROD+1 ms; max ≤PROD+one 60 Hz frame (16.7 ms with 0.1 ms quantization tolerance); a new ≥66 ms maximum fails when PROD is below 66 ms. Inherited threshold hitches are labelled rather than described as an absolute smoothness pass. Every initial result is retained. This check covers the requested matrix and moments, not every changed mission beat or every machine.

The candidate production build passes public-hook exclusion (19 HTML/JS files). No game gates were rerun for this report-only change. The initial restricted session's DNS/loopback blockers were resolved before these measurements; no proxy timing is used.

## Evidence and cleanup

[Matrix inputs](matrix.json) · [Complete load phases and identities](loads.json) · [Initial native frame/charge/war traces](native.json) · [Separate confirmation](confirmation.json) · [Diagnostics and CPU summaries](diagnostics.json) · [Independent audit](audit.json) · [Build/harness provenance](provenance.json) · [Commands](runs.json) · [Quiet admission conditions](conditions.json) · [Live mirror ledger](mirror.json) · [Mirror/asset-version audit](mirror-audit.json) · [Request audit](request-audit.json) · [Raw-source hashes](raw-manifest.json) · [Cleanup receipt](cleanup.json) · [Evidence checksums](evidence-manifest.json).

The mirror contains 2,756 files / 536,281,348 bytes. All files were rehashed and all 2,074 embedded asset-version paths match their content hashes. Literal source/authoring/template paths that return SPA fallback HTML are recorded as crawl failures and are never substituted for runtime assets. Request coverage, selected-load network statuses, full-minute coverage, backend/tier checks and exact verdict recomputation are recorded in the independent audit. Raw profiles, local mirror and capture output are removed after retaining the evidence; owned preview servers are stopped. No deploy or push.

## Reproduction

Restore the harness sources from `provenance.json` under their recorded paths (replace the recorded workspace prefix in native imports for another checkout). Run `node test-results/perf8/perf6-mirror.mjs`, then `node test-results/perf8/build-public.mjs` to build the candidate and shared adapter. Start `node test-results/perf8/serve.mjs` on the free 4901/4902 ports. The exact measurement commands, environment and source revision are in `runs.json`; each command goes through `tools/perf/quiet-run.sh`. Use fresh output directories for every attempt. Initial acceptance results come only from `initial/`; the short profile and full unprofiled confirmation are separate runs. Regenerate the summary, package the evidence, and run the independent auditor before deleting raw output.
