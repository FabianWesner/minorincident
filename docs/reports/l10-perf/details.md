# L10 performance — batch 26

Code: `90d617a2d` on `lane/l10-perf`; baseline main: `edd0288e9e8d733b9ba1b1758f7b180b53195385`.

## Q-227 — pickup warm-up and corridor

The [weapon census](weapon-census.json) covers all ten levels: L2 axe; L3 handgun; L4 army MG; L5 shotgun, handgun, army MG and assault rifle; L7 rocket; L10 pistol, shotgun, army MG and rocket. Carried racks and bat/fists/kick are included. Deferred mission arsenal transactions now join the loading warm-up. Exact equal-color weapon materials share their graph; identical held-clone layouts share a compile representative, including vertex stride/offset and shadow flags.

L10 now uses the established stable night light list. Lamp promotion changes uniform weights and refreshes one shadow map. The inactive map's filter taps are skipped by a uniform branch; the active nine-tap sun and stock PCF spot filters are preserved. Every held weapon compiles with that complete graph behind the loading card. L10 WebGPU uses 24 compile lanes to overlap its asynchronous pipeline links; other levels retain their existing lane count.

The existing smoke freeze guard exercises every L10 checkpoint pickup and rejects late held-material builds. The existing material contract checks the retained light list, filter identity and one active shadow map through source switches. Registered test count stays 144/150.

[Final quiet corridor result](corridor-summary.json): actual L10 high, native uncapped WebGPU, **3377 frames, maximum 23.9 ms, p95 3.7 ms, zero frames over 200 ms**, one physical rocket pickup and the visible attached GLB rocket launcher. There are no late held-material builds or console errors. The approach is staged at the preceding cure-research checkpoint before view loading; device clicks and E collect the pickup. [Raw frames](corridor-frames.json), [pickup image](l10-corridor-pickup.png).

## Q-228 — where the cold-load time went

The initial instrumented main sample took 5688 ms and requested 14.51 MB. World/navigation setup took 825 ms, mission/cast setup 460 ms, district/character construction about 1.60 s, and infected crowd preparation about 1.51 s. View subphases overlap. Required shader compilation took 2.19 s. Mega LOD0 requests were about 550–578 KB and 58–68 ms each. [Initial diagnostic phase captures](diagnostic-load-phases.json) are single shared runs.

The avoidable CPU work was the 8.88-million-cell grid: empty rectangular terrain still ran per-cell polygon/bucket work, floods allocated neighbor arrays, validation flooded twice, and rescue reachability grew a JavaScript queue. Rectangle rasterization, reused spatial keys, allocation-free flood visits, reuse of the validation flood and a typed rescue queue preserve the result. [All ten levels](nav-equivalence.json) retain identical occupancy, flood and height-aware rescue-reachability bytes against main; [300 additional layouts](nav-raster-equivalence.json) retain fractional/transformed/irregular/excluded boundary behavior. Final quiet medians reduce world/navigation setup from 844.8 ms to 227.9 ms. Shader compilation medians are 2208.9 ms on main and 2452.6 ms on the candidate; total warm-up medians are 2474.6 ms and 2741.3 ms. Requested bytes are 14.411 MB and 14.534 MB. [Final phase medians](quiet-phase-medians.json).

An earlier held-only warm-up candidate met the load budget but exposed a 4359 ms approach frame during deferred alternate-source work. Warming both separate scene graphs fixed that frame but added about two seconds of shader work. The stable list plus additional compile lanes gives full warm-up within the load budget. [Discarded warm-up experiments](warm-up-experiments.json) preserve the failed results and phase timings.

### Final quiet acceptance

One exclusive `tools/perf/quiet-run.sh` reservation, native Metal WebGPU low, a fresh isolated context per sample, alternating main/candidate order, actual menu click to loading-card closure, and no trace profiler. The high corridor check follows in the same reservation.

| Build | n | Median | Range |
| --- | ---: | ---: | ---: |
| Main `edd0288e9` | 5 | 5.6438 s | 5.4774–5.6774 s |
| Candidate `90d617a2d` | 5 | **5.2611 s** | 5.1760–5.2935 s |

Median improves **382.7 ms (6.8%)** with **238.9 ms** headroom under 5.5 s. [Paired samples](quiet-load.json), [quiet admission conditions](quiet-conditions.jsonl), [phase medians](quiet-phase-medians.json), [source identity](source-identity.json). The additional weapon assets are retained in the candidate's requested bytes.

## Quality and Q-229

Matched L10 high snapshots preserve the [moon view](shadows-before/moon.png) [after the change](shadows-after/moon.png) exactly: zero changed pixels. The [promoted-lamp view](shadows-before/lamp.png) [after the change](shadows-after/lamp.png) differs in 0.022% of pixels at pixelmatch threshold 0.1. [Pixel metrics](shadow-comparison.json), [before state](shadows-before/state.json), [after state](shadows-after/state.json). The same figures, LODs, shadow sizes and model files remain loaded.

The supplied `l1-high-infected-hair-blob.jpg` matches the afro on a narrow female skull. The fitter enlarged narrow head depth to 80% of head width. It now uses measured skull depth, bounds afro height at 55% of skull height, and scales about the brow to retain the hairline. Matched seed-1 L1 actor 163, `npc.civilian-woman-b`, after 450 bot frames: [before](l1-afro-before.png), [after](l1-afro-after.png).

The supplied L4 capture identifies the tents within `kit.reception-plaza`; a roof cut is already visible in it. The remaining failure was **not reproduced** during the bounded follow-up, and the orchestrator directed priority to L10. Both matching tent positions (-30.1, -7.7 and -30.1, -14.3), zoom 1.5, line-break checkpoint, expose **100%** of the courier pixels in the forced-open reference on WebGL2 low and WebGPU low. Disabling the cut hides her. [WebGL2 image](l4-tent-webgl2-low.png), [WebGPU image](l4-tent-webgpu-low.png), [pixel evidence](tent-visibility.json). Calm and alarm checks also cover the small tent and triage gazebo on both backends and tiers, with at least 99.7% of forced-open visibility. L4 has no source change.

## Checks

- [Final verify log](verify-final.log): `npm run verify -- E32` passes typecheck, lint and `npm test` (104/104, 24 files; 26.5 s).
- [Final smoke log](smoke-final.log): `E2E_PORT=4735 npm run test:smoke` passes six QA checks and the public-build check, 151.8 s within 240 s.
- `npm run scene:gate`: [48/48 pass](scene-gate.md), zero known failures and zero unrun rows, both backends and tiers.
- Test budget: 144/150 cases, 40/45 files; Playwright at most two workers and Vitest at most four.
- Obsolete captures, traces and build copies were deleted. Cited evidence remains below 50 MB; working build files link the unchanged public assets.
