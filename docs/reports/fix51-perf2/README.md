# fix51-perf2 — current-main performance remeasurement

**Complete.** The requested matrix passes after fixing the three failing cells: **20/20 WebGPU low/high cells** (L1–L10 cold/warm loads plus 60-second native gameplay) and **8/8 WebGL2 load cells** (L4/L5/L6/L10, both tiers). Requested named moments pass. Inherited startup-payload overages are **report only**, assigned to a separate lane.

## Builds and method

Frozen main `a3dd415ad982aaafb2a8732631214ceb7f82bca6` versus PROD `0c410e1111f5380e91cb8ca7f2a65b7f4295c003`, both remeasured. Current changes include all 27 adult NPC LOD rebakes, APC seating/cab partition, L4 reception/convoy/navigation and low budgets (80 infected/120 characters), depot leaf, L3 cohorts, foreground vehicle veto, blast opacity, health-bar clamp and the moved L8 zoo layout. Older `fix51-perfmeasure` numbers are not reused.

Mac16,10 / Apple M4 / 16 GiB / Darwin 25.5.0; native Metal WebGPU and ANGLE Metal WebGL2; headless Chromium, 1280×720, DPR 1, seed 1. One browser context at a time through `tools/perf/quiet-run.sh`; caller-owned previews on 4901/4902, final fixed build on 4915. Cold means a fresh isolated context; warm is its reload. Menu timing is the real level-button click through loading-card closure/Begin ready. Gameplay uses ordinary native complete-bot InputFrames for a full minute. L1/L8 retain the measured level by withholding only terminal interaction/exit movement; L8 uses the corrected hold 16 m from the APC. No counts or quality settings were reduced.

Cold **and** warm must each be ≤6 s **and** ≤PROD+0.5 s; p95 ≤PROD+1 ms; maximum allows one additional 60 Hz frame. The accepted 50.0/50.1 ms quantization band is retained, while the relative maximum remains binding. New ≥66 ms spikes fail. These are single cold/warm pairs and native windows, not worst-of-N certification.

[Build hashes and exact source hashes](builds.json), [quiet admissions](quiet.jsonl), [selection/raw SHA-256 manifest](raw-manifest.json), [selected load comparisons](load-comparisons.json), [complete selected load/network receipts](loads.json.gz), [exact gameplay frames](perf/summary.json).

### Baseline integrity

Two defects in `tools/perf/build-revision.mjs` were corrected before valid sampling: restore deleted content-addressed public files from the pinned revision, and apply revision-source substitution inside Vite worker subbuilds too. The earlier mixed-worker attempt is rejected and excluded; its receipts remain under `test-results/fix51-perf2/rejected-mixed-worker/`. The restarted valid matrix begins at 17:24 UTC. [PROD audit](prod-public-audit.json) matches all 2,739 pinned public files to Git and validates all baked URLs in main/prefetch/civilian-worker bundles, with zero missing or foreign references. [Attempt history](attempts.json) records the superseded builds and early resolved runtime restriction.

## WebGPU matrix

| Level / tier | PROD cold / warm s | fix51-perf2 cold / warm s | p95 ms PROD → candidate | Max ms PROD → candidate | Late builds PROD → candidate | Result |
|---|---:|---:|---:|---:|---:|---|
| L1 low | 2.227 / 2.079 | 2.344 / 2.231 | 16.8 → 16.7 | 16.8 → 16.8 | 4 → 4 | PASS |
| L1 high | 2.013 / 1.991 | 2.111 / 2.067 | 16.8 → 16.7 | 33.4 → 50.0 | 0 → 0 | PASS |
| L2 low | 3.974 / 3.808 | 3.375 / 3.326 | 16.8 → 16.7 | 33.4 → 49.9 | 0 → 0 | PASS |
| L2 high | 4.242 / 4.173 | 3.639 / 3.557 | 16.8 → 16.8 | 50.1 → 50.0 | 0 → 0 | PASS |
| L3 low | 3.043 / 2.959 | 2.857 / 2.793 | 16.7 → 16.7 | 16.8 → 16.8 | 0 → 1 | PASS |
| L3 high | 3.074 / 3.021 | 2.810 / 2.806 | 16.7 → 16.7 | 83.3 → 16.8 | 12 → 0 | PASS |
| L4 low | 4.124 / 3.956 | 3.523 / 3.426 | 16.7 → 16.8 | 16.8 → 16.8 | 3 → 0 | PASS |
| L4 high | 5.390 / 5.256 | 4.763 / 4.572 | 16.7 → 16.7 | 33.4 → 33.4 | 1 → 0 | PASS |
| L5 low | 4.724 / 4.624 | 4.042 / 3.877 | 16.7 → 16.7 | 33.4 → 16.8 | 3 → 0 | PASS |
| L5 high | 5.758 / 5.627 | 4.841 / 4.741 | 16.7 → 16.8 | 33.4 → 33.3 | 0 → 0 | PASS |
| L6 low | 2.941 / 2.879 | 2.291 / 2.244 | 16.7 → 16.7 | 16.8 → 16.8 | 0 → 0 | PASS |
| L6 high | 4.159 / 4.071 | 3.374 / 3.260 | 16.7 → 16.8 | 16.8 → 16.8 | 0 → 0 | PASS |
| L7 low | 4.491 / 2.809 | 3.024 / 2.943 | 16.8 → 16.7 | 200.1 → 33.3 | 69 → 46 | PASS |
| L7 high | 3.107 / 3.053 | 3.323 / 3.224 | 16.7 → 16.8 | 66.6 → 33.4 | 17 → 1 | PASS |
| L8 low | 6.473 / 4.642 | 4.341 / 4.244 | 16.8 → 16.7 | 16.8 → 16.8 | 2 → 3 | PASS |
| L8 high | 5.306 / 5.206 | 4.891 / 4.793 | 16.7 → 16.7 | 16.8 → 16.8 | 0 → 1 | PASS |
| L9 low | 5.642 / 4.444 | 4.175 / 4.159 | 16.8 → 16.7 | 16.8 → 16.8 | 3 → 3 | PASS |
| L9 high | 4.507 / 4.459 | 4.139 / 4.123 | 16.7 → 16.7 | 33.3 → 16.8 | 0 → 0 | PASS |
| L10 low | 5.825 / 5.325 | 5.223 / 5.108 | 16.7 → 16.7 | 33.2 → 16.8 | 7 → 0 | PASS |
| L10 high | 5.342 / 5.243 | 5.192 / 5.109 | 16.8 → 16.8 | 66.7 → 50.0 | 6 → 0 | PASS |

Full traces, charge windows, histograms, node-build timestamps, source build identities and per-cell verdicts are in [perf/summary.json](perf/summary.json). Original samples are retained in [initial/perf/table.md](initial/perf/table.md).

## WebGL2 menu loads

| Level / tier | PROD cold / warm s | Candidate cold / warm s | Result |
|---|---:|---:|---|
| L4 low | 6.842 / 4.425 | 3.826 / 3.792 | PASS |
| L4 high | 6.010 / 5.696 | 5.141 / 5.060 | PASS |
| L5 low | 10.009 / 4.878 | 4.328 / 4.245 | PASS |
| L5 high | 6.360 / 6.076 | 5.226 / 5.127 | PASS |
| L6 low | 7.025 / 3.176 | 2.876 / 2.478 | PASS |
| L6 high | 4.475 / 4.293 | 3.693 / 3.509 | PASS |
| L10 low | 10.045 / 5.677 | 5.095 / 5.011 | PASS |
| L10 high | 5.960 / 5.492 | 5.810 / 5.526 | PASS |

## Failures, causes and final selection

Initial failures: L8 low **50.1 ms** and high **66.7 ms**, versus **16.8 ms** PROD; L10 low WebGL2 cold **6.359 s** (warm 5.444 s). See [initial failures](initial-failures.json).

- **L8:** CPU traces attributed the periodic late bursts to `CorpseLayout.place` during `StaticCorpses.begin`, rather than shader builds. Blast-thrown bodies repeatedly searched a dense ground heap during their last airborne frames. The renderer now follows the physical pose throughout an active blast flight and performs ordinary placement on landing. Per-root sweep/support reuse, squared distance comparisons, and scratch reuse reduce the remaining exact search cost. All bodies, physical flights and original candidate positions remain. [400 exact placement/audit comparisons plus three airborne/landing checks](corpse-equivalence.json) pass. Arithmetic/allocation-only diagnostic builds still reached 50 ms on high and were not selected as acceptance reruns.
- **L10:** the load CPU trace showed roughly two seconds of shader graph construction, with about 691 ms in alpha graphs. L10 now uses the existing L8 intermediate living-alpha sharing path, binding each model's pose/atlas per draw while retaining hero/frozen snapshots. The actual menu diagnostic improved to **5.490 / 5.336 s cold/warm** with CPU profiling enabled. Diagnostic timings are excluded from acceptance.

Every initial PROD baseline and passing candidate cell is retained. Only L8 low/high candidate full cells and the L10 low WebGL2 candidate load are replaced by **one final unprofiled rerun each** on the final fixed build. No best-of timing selection or additional acceptance reruns were used. [Final rerun provenance and diagnostic results](fix-verification.json).

## Named moments

| Moment | Tier | PROD max ms | Candidate max ms | Result |
|---|---|---:|---:|---|
| L1 shutter closure (-0.5/+2 s) | low | 150.0 | 16.8 | PASS |
| L3 fresh handgun/armory, full 60 s | low | 33.3 | 16.8 | PASS |
| L3 old tick 1031 ±60 ticks | low | 16.8 | 16.8 | PASS |
| L10 charge 43/60 | low | 16.8 | 16.8 | PASS |
| L10 charge 55/60 | low | 16.8 | 16.8 | PASS |
| L1 shutter closure (-0.5/+2 s) | high | 16.8 | 16.8 | PASS |
| L3 fresh handgun/armory, full 60 s | high | 33.4 | 16.8 | PASS |
| L3 old tick 1031 ±60 ticks | high | 16.8 | 16.8 | PASS |
| L10 charge 43/60 | high | 33.4 | 16.8 | PASS |
| L10 charge 55/60 | high | 50.0 | 16.8 | PASS |
| L3 high station-defense matrix route | high | 83.3 | 16.8 | PASS |

The fresh L3 runs start at tick 0, collect the handgun and complete armory at tick 267, and include the first native handgun shot. [Moment summary and exact event/frame archives](moments.json) record each build's shot tick and window. L3 high station defense is the separately prepared matrix route. L10 windows select the exact charge-counter second, rather than wall-clock offsets. The corrected L8 windows remain in L8 for the whole minute with zero non-gameplay frames.

## Asset bytes — report only

Budget sources, exactly:

- `specs/03-asset-pipeline.md:180`: initial start-district download ≤25 MB; remaining content streams. The same line specifies hero/side delivery sizes.
- `specs/epic-18-performance-quality-mobile.md:19`: ≤15 MB gzip before L1 starts; `:55` (E18-AC03) requires production network events through `level.started`.
- `src/assets/manifest.json:63` begins the registered `budget.fileKB` values; per-asset/decay entries supply their own caps. `tools/assets/validate.ts:181` enforces `fileKB`, and `:182–183` specifies/enforces the 1500/300 **KiB** source-GLB delivery caps. The stricter applicable cap is used.

The table reports Chromium's completed asset response-body bytes from title entry through three RAFs after readiness, including worker requests. Resources are collected after timing. The [full per-file ledger](asset-bytes.json) also provides distinct-path disk bytes, request counts, body sizes, hashes and registered-file checks; [inventory](asset-inventory.json) covers the complete present registered asset set. These startup samples do not claim full-route transfer coverage. MB is decimal; `fileKB` is KiB. Unregistered derived files are not individually certified by the manifest checks.

| Level / tier | PROD startup assets MB | Candidate startup assets MB | 25 MB asset limit | Registered file caps |
|---|---:|---:|---|---|
| L1 low | 15.915 | 15.904 | PASS | PASS |
| L1 high | 16.239 | 15.395 | PASS | PASS |
| L2 low | 39.956 | 39.961 | FAIL | PASS |
| L2 high | 43.783 | 43.787 | FAIL | PASS |
| L3 low | 31.360 | 31.363 | FAIL | PASS |
| L3 high | 29.425 | 29.428 | FAIL | PASS |
| L4 low | 56.779 | 56.345 | FAIL | PASS |
| L4 high | 90.081 | 90.090 | FAIL | PASS |
| L5 low | 84.878 | 86.345 | FAIL | PASS |
| L5 high | 109.996 | 110.662 | FAIL | PASS |
| L6 low | 42.182 | 43.780 | FAIL | PASS |
| L6 high | 50.138 | 51.918 | FAIL | PASS |
| L7 low | 50.258 | 51.062 | FAIL | PASS |
| L7 high | 50.604 | 58.613 | FAIL | PASS |
| L8 low | 53.516 | 53.519 | FAIL | PASS |
| L8 high | 73.502 | 73.445 | FAIL | PASS |
| L9 low | 50.149 | 50.154 | FAIL | PASS |
| L9 high | 46.890 | 46.895 | FAIL | PASS |
| L10 low | 82.955 | 82.962 | FAIL | PASS |
| L10 high | 75.732 | 77.061 | FAIL | PASS |

| Asset total (logical disk bytes) | PROD bytes | Candidate bytes | Registered budget / result |
|---|---:|---:|---|
| All `public/assets` | 519,658,627 | 519,700,680 | No aggregate cap registered |
| Distinct requested assets, L1–L10 low union | 140,823,185 | 141,439,433 | No aggregate cap registered |
| Distinct requested assets, L1–L10 high union | 169,736,806 | 169,743,402 | No aggregate cap registered |
| Distinct requested assets, both-tier union | 195,886,674 | 195,893,142 | No aggregate cap registered |
| 1,195 present registered GLB paths | 163,194,100 | 163,191,012 | All individual caps PASS; sum of caps 1,137,745,920 bytes (not a site cap) |

The sum of per-level bytes repeats shared files; unions count each path once. Both are retained in the ledger. No ten-level or whole-site total budget is registered, so totals are **N/A against an aggregate cap**. All 1,195 present registered GLB paths pass their applicable individual caps on both builds. The 18 candidate L2–L10 tier rows above exceed 25 MB; the corresponding PROD rows also exceed it. No payload fixes were made under the user's separate-lane instruction.

| L1 normalized gzip startup estimate | PROD bytes | Candidate bytes | Candidate vs 15 MB |
|---|---:|---:|---|
| low | 14,699,449 | 14,700,205 | PASS (estimate only) |
| high | 15,332,163 | 14,532,208 | PASS (estimate only) |

The gzip figures are reproducible build-size estimates: gzip level 9 per distinct startup file, retain existing `.gz`/incompressible files, include engine code/WASM. They do not replace production-network E18-AC03 proof. PROD high is above 15 MB in this estimate; both candidate tiers are below it.

### L2 startup payload: top 15 asset files

Main `a3dd415ad`, WebGPU low, cold isolated context. Recorded asset response bodies total **39,960,629 bytes (39.961 MB)**; PROD records **39,956,210 bytes**. Both exceed the **25,000,000-byte** start-district limit (`specs/03-asset-pipeline.md:180`). Including engine code and WASM, the candidate startup bodies total **45,022,241 bytes**. The largest non-asset file is `/build/rapier-C6GCbKVJ.wasm` (3,082,103 bytes).

| Asset path | Response body bytes | Disk bytes | % of asset payload |
|---|---:|---:|---:|
| `/assets/layouts/D-GROVE.base.glb` | 1,781,132 | 1,781,132 | 4.46% |
| `/assets/audio/impacts.webm` | 757,785 | 757,785 | 1.90% |
| `/assets/civilians/npc.civilian-elderly.lod0.35f396363150e6e1.bin.gz` | 700,926 | 700,926 | 1.75% |
| `/assets/civilians/npc.civilian-woman-a.lod0.d6ec2d9c55e9eee0.bin.gz` | 662,524 | 662,524 | 1.66% |
| `/assets/civilians/npc.national-guard.lod0.430c62c91eaa59af.bin.gz` | 648,701 | 648,701 | 1.62% |
| `/assets/civilians/npc.lab-guard.lod0.ea801f4393cada08.bin.gz` | 639,493 | 639,493 | 1.60% |
| `/assets/civilians/npc.lab-tech-a.lod0.28aac12b2d4d316a.bin.gz` | 633,280 | 633,280 | 1.58% |
| `/assets/civilians/npc.police-officer.lod0.1c20b9f6dc6f3410.bin.gz` | 630,550 | 630,550 | 1.58% |
| `/assets/civilians/npc.civilian-woman-b.lod0.d710be70d765053c.bin.gz` | 624,133 | 624,133 | 1.56% |
| `/assets/civilians/npc.firefighter-alive.lod0.7a2a07bf13adc6f7.bin.gz` | 623,208 | 623,208 | 1.56% |
| `/assets/civilians/npc.depot-clerk.lod0.803f44ac0d378d4b.bin.gz` | 617,021 | 617,021 | 1.54% |
| `/assets/civilians/npc.civilian-man-b.lod0.9edef8dd83013101.bin.gz` | 610,828 | 610,828 | 1.53% |
| `/assets/civilians/npc.civilian-man-a.lod0.5f2d005e221a5d2e.bin.gz` | 606,398 | 606,398 | 1.52% |
| `/assets/civilians/npc.lab-tech-b.lod0.5d419e0c4bf46ea4.bin.gz` | 601,428 | 601,428 | 1.51% |
| `/assets/civilians/npc.civilian-elderly.lod1.c2876cf78753f9c7.bin.gz` | 541,317 | 541,317 | 1.35% |

The full per-file ledger, including code/WASM and both builds/tiers, is [asset-bytes.json](asset-bytes.json). Scope: title entry through three RAFs after the loading card closes. Response body sizes are recorded after timing; cache repeats contribute the sizes reported by Chromium. MB is decimal; registered `fileKB` caps use KiB.

## G-01–G-05 reconciliation

| Row | Requested scope | Whole row | Remaining |
|---|---|---|---|
| G-01 | PASS | NOT CHECKED | WebGL2 L1–L3/L7–L9 and worst-of-N repetition remain unmeasured. |
| G-02 | NOT CHECKED | NOT CHECKED | All nine real campaign handovers require separate measurements. |
| G-03 | PASS | NOT CHECKED | Fresh first actions for every other weapon/backend are not fully enumerated. |
| G-04 | PASS | NOT CHECKED | The full scripted-transition inventory remains unmeasured. |
| G-05 | PASS | NOT CHECKED | Fixed peak cameras, absolute desktop/phone budgets, draw calls, triangles, sim p95 and heap are not qualified by this matrix. |

[Scoped criteria](criteria.json) are attached to G-01–G-05 in `docs/reports/fix51-verify/global.json`. Historical statuses/evidence are preserved; unmeasured compound clauses prevent whole-row PASS. `docs/qa/acceptance-status.md` was not hand-edited.

## Validation and reproduction

Final source: `npx tsc --noEmit`, `npm run lint`, `npm test` (**107/107**, 27 files), `npm run qa:threat` (**0 flags**); [gate receipt](gates.json), [complete log](gates.log.txt). Exact corpse placement equivalence and airborne/landing checks also pass. No deploy or push.

Use the same headless/Metal settings and caller-owned previews; run each command under exclusive quiet admission. `RELEASE_OUT` must be new for a new attempt because the route tool resumes existing receipts.

```sh
MI_BUILD_CACHE=off npm run build:qa
BRANCH=qa NODE_ENV=production VITE_QA_HOOKS=1 node tools/perf/build-revision.mjs 0c410e111 test-results/fix51-perf2/prod
# For each low/high tier and L1..L10 pair:
RELEASE_QUALITY=low RELEASE_SECONDS=60 RELEASE_PERF_ONLY=1 RELEASE_OUT=test-results/new-run/low sh tools/perf/quiet-run.sh sh -c 'node --import tsx tools/qa/release-ab-load.mjs L1,L2 && node --import tsx tools/qa/release-ab-browser.mjs strips L1,L2 webgpu'
RELEASE_QUALITY=low RELEASE_OUT=test-results/new-run/low sh tools/perf/quiet-run.sh node --import tsx tools/qa/release-ab-load.mjs L4,L5,L6,L10 webgl2
FIX51_MOMENTS_OUT=test-results/new-moments sh tools/perf/quiet-run.sh node --import tsx tools/perf/fix51-moments.ts low L1,L3 accident
# Diagnostic only: RELEASE_CPU_PROFILE=1; optional alternate candidate origin:
# RELEASE_CANDIDATE_ORIGIN=http://127.0.0.1:4915
python3 tools/qa/batch51-perf-report.py docs/reports/new-run/perf test-results/new-run new-run --frames
```
