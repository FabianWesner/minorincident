# Historical work log

These are chronological intermediate notes, not final status. See [README.md](README.md) for the final measurements and open failures.

# perf-w5b

Continuation of `8db67f235` in the perf-heap-w5 worktree. Native alarm validation and verifier receipts are in progress; budgets, populations, persistent corpses and L5 difficulty are unchanged.

## Fresh baseline on 8db67f235

Headless native Chrome, ANGLE Metal, one worker, fresh build; admitted through `tools/perf/quiet-run.sh` on port 34851. All three high-tier tests pass. Low results:

| Test | Earlier task baseline | Fresh baseline | Target |
| --- | --- | --- | --- |
| T-E22-20 first turn | 60.7 ms | 73.9 ms | maximum ≤50 ms |
| T-E22-20 tank / line break | 33.0 / 73.8 ms | 32.8 / 101.0 ms | maximum ≤50 ms each |
| T-E29-19-encounters horde | p95 52.4 ms | p95 34.0 ms, max 50.6 ms | p95 ≤33.3 ms, max ≤50 ms |
| T-E29-19-district | p95 33.6 ms, max 51.5 ms | p95 33.8 ms, max 37.2 ms | p95 ≤33.3 ms, max ≤50 ms |

`baseline/` holds the fresh receipts. These establish that the previously unmeasured alarm/headwear/bounds changes did not close the timing gates.

## Changes

- **Exact bar-occlusion triangles:** Chrome's fresh horde profile still spent substantial time in `InstancedGroup.occludesReference → Mesh.raycast → intersectTriangle`. Limiting the query to one placement removed sibling work but left a linear triangle scan. Larger static meshes now build an indirect BVH while loading. Vertex arrays are borrowed; render indices, groups, material sides, finite ray distances, animated placement matrices, and compact interior indices are retained. Small meshes retain Three's raycast. `three-mesh-bvh` 0.9.16 is pinned, MIT licensed, and recorded by the existing credits generator. T-E29-20-occlusion-bvh compares against the original full-batch oracle across indexed/non-indexed geometry, sides, groups, rotated/nonuniformly scaled placements, and near/far ranges; the preexisting door/roof/interior test remains active.
- **Spawn silhouettes:** the L4 turn profile includes repeated eight-corner queries over district wall slabs. Fixed corner/axis arrays now replace per-wall/per-corner tuple and closure allocations; disjoint slabs return early. T-E22-20-silhouette compares the old and new algorithms across 3 camera origins and 1,089 positions each. T-E22-20-alarm still checks both full alarm populations and one final admission per identity.
- **WebGPU horde evidence:** T-E29-19-encounters now accepts `L7_PERF_BACKEND=webgpu`, asserts the actual backend, uses distinct output files, and captures the game camera. No timing or population assertion changed.
- **Navigation:** `NavGrid.visible` tests each newly encountered wall immediately, returning on the first exact slab intersection. One-bucket segments avoid a Set and closures. Mask samples, candidate buckets, boundary rules and rounded-body outward escape remain the same. T-E22-20-nav checks an independent exhaustive wall oracle, masks and dynamic blockers. Alternating samples on the actual L4 alarm map, 152 rays / 60,800 queries per sample: median **298.616 → 107.057 ms**, identical answers (`diagnostic/nav-benchmark.json`). The first version retained an extra closure and regressed native first-turn timing to 80.4 ms; it was replaced by the current shared slab helper and one-bucket path.
- **Scripted actor cutaways:** LOD swaps previously disposed reveal materials and created new output graphs during combat. `EntityAssets` retains each actor's materials across swaps, and `PaletteMaterial` caches immutable output graphs by weather AND cutaway feature, including sharing with frozen copies. Each actor keeps independent active state. The node closure captures its feature when built, avoiding a later toggle changing a previously cached graph. Loading draws both L4 actor variants at the warm-up focus and restores render and simulation positions. T-E22-20-setpiece-materials and T-E18 reveal-cache tests cover identity, independent state, restoration and disposal. Low line-break maximum **101.0 → 45.5 ms** (fresh baseline versus `reveal-native`); tank **32.8 → 28.9 ms**. Diagnostic total node builds **414 → 402**, with no acceptance instrumentation enabled in normal receipts.
- **Alarm targeting and allied scans:** the synchronous arrival batch selects the nearest soldier from one unchanged roster with stable ties, replacing nine roster sorts at the low alarm with none. Engaged non-following soldiers omit the separate close-threat scan, whose result no branch consumes; hearing still runs for civilian panic and forced work. No cadence, shot, spawn, admission or RNG rule changes. T-E22-20-ally-scan, the existing ally hearing/defence cases and both full-population T-E22-20-alarm cases pass (27 scoped tests).
- **Catalog:** the original eight scenes remain. `perf-heap-bars-oblique` adds a rotated, nonuniformly scaled house; `perf-heap-l4-navigation` exercises the armory corner; `perf-heap-l4-setpieces` records the convoy through LODs; `perf-heap-reveal` inherits the sedan cutaway pixel gates.

## Measured intermediate results

All normal native runs use a fresh production build, one worker, headless Chrome with ANGLE Metal and the quiet-run reservation. Profiling runs are diagnostic only. Historic task numbers and the fresh baseline are both retained above; these are separate runs, not a single controlled A/B claim.

| Test / gate | Fresh baseline | Latest normal receipt before final ally-scan change | Status |
| --- | --- | --- | --- |
| T-E29-19-encounters low frame p95 / max | 34.0 / 50.6 ms | **31.7 / 47.7 ms** | Both pass 33.3 / 50 ms |
| T-E29-19-district low frame p95 | 33.8 ms | **32.4 ms** | Pass 33.3 ms |
| T-E22-20 low first turn / tank / break max | 73.9 / 32.8 / 101.0 ms | **61.1 / 28.9 / 45.5 ms** | First turn still fails 50 ms |
| T-E22-20 low sim p95 | 6.6 ms | **6.1 ms** | Still fails 6 ms |

`reveal-native/` contains these normal receipts. `alarm-profile/` is a subsequent instrumented run: first-turn 66.3 ms is not an acceptance result. Its largest frame includes four fixed ticks (30.6 ms aggregate simulation), update 7.9 ms and render 10.6 ms. The alarm's turn takes 12.7 ms, checkpoint flush 3.4 ms, and the next NPC update 14.4 ms. This evidence motivated the final redundant-scan and nearest-soldier changes.

Rejected experiment: caching physical `VehicleView` paint materials did not target the L4 scripted buses and was fully reverted. `native-3/` and its E18 receipts include that rejected experiment and precede the final reveal/NavGrid changes; they are intermediate evidence only. No physical-vehicle source change is retained.

## Visual QA

Final rendering matrices: **72/72 WebGL2 and 72/72 WebGPU**, 12 scenes × high/low × zoom 1.5/1.0/0.5, production preview ports 34861/34863. See [WebGL sheets](final-webgl2/index.md) and [WebGPU sheets](final-webgpu/index.md). These use the final rendering and navigation code; the later allied scan/nearest-soldier change is CPU-only. The original eight scenes are included in all 144 rows.

Opened and inspected final sheets, including WebGPU low zoom .5 navigation/reveal, high zoom 1 convoy/oblique roof, both-tier corpse sheets and WebGL low convoy/oblique roof and high hand props. The courier walks clear of the armory table to the green destination and stops. The convoy bus retains its body, wheels and lamps through travel; foreground fence/canopy cutaways stipple while it passes. The rider is intentionally hidden aboard the bus, so these captures do not establish rider visibility. The sedan opens a bounded cutaway around the courier while neighbouring cars remain whole; inherited pixel gates pass. The oblique roof hides the infected and its bar at high zoom 1; at low zoom .5 the roof fills the crop. Three differently dressed bodies, including their hats, persist after their falls in both corpse sheets. The hand props stay with their holders.

### Earlier baseline captures

The eight-scene baseline matrix passes **48/48 WebGL2 and 48/48 WebGPU** at high/low and zoom 1.5/1.0/0.5, one browser per run, production preview ports 34852/34854. These captures precede the new BVH/spawn changes and do not certify them.

Inspected sheets on both backends: distinct green/orange/purple clothes and hats survive falls and remain on the three permanent bodies. Coffee, rifle and pistol follow their holders across poses. At zoom 1 the pink bar follows the visible infected; the house hides the occluded target's bar. At zoom .5 the visible-bar scene's targets leave the crop, while the occluded low crop fills with roof. Storm shows dense rain, the red sedan, warm window spill and wet-road streaks with a readable courier. Ash surrounds the persistent ruined-bus/debris scene. Rocket sheets show the blast ring, flying parts, persistent victims and growing smoke/fire. The light-lab pool continues to wash out part of the courier; this is not a lighting-readability fix.

Inspected L4 war captures: high shows soldiers firing around the tents, retained body piles and the evacuation bus; low portrait keeps the courier, weapon table, objective and touch controls visible.

## Validation

- Initial fresh build, typecheck and lint pass.
- BVH parity: 2 tests pass on Hetzner (including the original test).
- Scoped final gameplay/render regression: 3 files / 5 tests pass on Hetzner (BVH, silhouette oracle, full alarm admission).
- Full baseline unit/sim/levels on Hetzner: 508 files pass, 3 skip; 3,171 tests pass, 9 skip; 3,086.25 s.
- Final rendering/revised NavGrid full unit run on Hetzner: 297 files pass, 1 skip; 1,648 tests pass, 7 skip; 272.56 s. Later CPU-only allied changes have the separate 27-test focused receipt.
- First changed-source full run on shared runner 2.28 failed seven wall-clock files and stale generated credits (501 files pass, 8 fail; 3,161 tests pass, 10 fail). Credits were regenerated; current full unit coverage passes them. The isolated full run on 2.31 passes: **510 files pass / 3 skip; 3,172 tests pass / 11 skip**, 2,833.53 s. It includes full unit, sim and levels coverage, including all unchanged E18 timing budgets. Its snapshot contains the initial NavGrid early-return version before the final one-bucket/helper revision, reveal graph cache and allied-scan changes; those later changes have separate full-unit and targeted simulation receipts.
- Intermediate E18 native desktop: frame p95 6.6 ms with 200 infected, pass. Four emulated Android/iOS × WebGL/WebGPU profiles: p50 59.88 fps, full 100 infected, pass. Five L1/L6 loads: high heap +2.63%, geometries -4.22%, textures +1.89%; low heap +5.25%, geometries -4.13%, textures +2.44%; pass all 10% gates. These are pre-final-render receipts from native-3 and must be repeated on final source.
- Intermediate E18 functional browser regression: 21 pass, 1.6 min, including all eight gender/tier/backend download combinations and quality/adaptive/context/device gates. Final-source repeat is pending.
- Final-source E18 native desktop: **6.1 ms frame p95**, 200 infected, pass. WebGL Android 4× and iOS 2× profiles pass; WebGPU proxy flag was off in that batch, so its skipped rows remain pending. Final-source five-load memory checks both pass: high heap +2.75%, geometries -4.22%, textures +1.89%, L6 max 65.97 MB; low heap +5.31%, geometries -4.13%, textures +2.44%, L6 max 59.19 MB. Receipts: `final-e18/`.
- Final native L4 high passes: turn 18.8 ms, tank 18.7 ms, break 26.5 ms, sim p95 2.5 ms (`ally-native/`). Low remains running.
- Final native WebGPU timings, E18 functional repeat, bus ride configurations and E22/E25/E28/E29 verifier receipts remain in progress.

No deploy or merge. No population/corpse/effect/difficulty/budget change. No forbidden directory or staticCollision source change.

## Additional alarm investigation

The later `ally-native` batch still fails low: turn **61.9 ms**, tank 29.4 ms, break **51.5 ms**, sim p95 **6.3 ms**. High passes all gates. The redundant ally scans and roster sorts are removed, but this normal run does not establish a frame-time improvement. E18 desktop and memory checks in that batch pass on this source.

A reusable WeakMap stamp experiment for navigation was rejected and reverted: alternating exact-equivalent L4 visibility queries on Hetzner took 66.469 ms with the existing Set versus 96.836 ms with stamps (`diagnostic/nav-stamps-benchmark.json`). No stamp source change remains.

The profile also identifies the alarm's repeated character-cap scans. `spawnRoom` now counts in a loop and exits at the same cap, avoiding temporary arrays. HitQuery rejects a wall after the X/Y slab already proves no intersection or no nearer hit; NavGrid rejects after disjoint X slabs. All remaining slabs, cover heights, range, padding and ignore-ID rules remain unchanged. A 152-ray / 60,800-query alternating cover benchmark preserves every exact distance and changes median **57.023 → 53.956 ms** (`diagnostic/hit-benchmark.json`). Native validation is pending; this microbenchmark does not close the frame gate.

The HMG callback previously solved the soldier's handheld pose/muzzle and then discarded that muzzle for the authored mounted-barrel socket. It now resolves the mounted socket first and records the same aiming intent; missing nests retain the handheld fallback. `DistrictView.aimMachineGun` replaces per-shot arrays, sorting, temporary vectors and an inverse-matrix clone with stable nearest selection and scratch workspaces. T-E22-20-mounted-muzzle compares the exact original algorithm across nested rotation/scale, multiple directions, stable nearest selection and missing/range cases; the mounted socket, long-gun aim and rigid prop pool suite passes 11 tests. A dedicated inherited HMG scene is added, alongside the dumpster-cover scene; their final matrices remain pending.

E25 verifier: typecheck, lint, production build and remote selection pass (50 tests). Browser testing found T-E25-06 hero-shadow pixels red: darkness -7.20%, hue 11.38 degrees, despite the shadow map being active. Capture and metrics are preserved in `shadow-check/after.*`. An isolated build serving the original HEAD source is ready for comparison; do not assume this is preexisting or ignore it. The 3,600-frame forty-light promotion test passes in 6.9 min. The remainder of the verifier is still running.

### E25 shadow baseline control

The production build made from the original `8db67f235` source fails the same T-E25-06 gate with **exactly identical sampled RGB, darkness -7.202395%, and hue 11.380968°** (`shadow-check/before.*` versus `after.*`). The control replaces every changed tracked source module with its HEAD version through a temporary Vite load hook and writes to a separate output directory; gameplay assets and the test remain identical. Both captures were opened. They show a warm lamp pool and courier, with no dark purple ground shadow at the sampled point. This is an inherited baseline failure, not a claimed passing lighting gate. No unrelated lighting source fix is included.

E25 verifier final result: **48 browser tests pass, 2 existing skips, 1 hero-shadow failure**, 15.8 min; native phase is not reached because the verifier stops on the failed browser phase. Typecheck/lint/build and its 50-test remote selection pass. Receipts are in `verifiers/E25-*`.

E28 verifier passes: typecheck, lint, production build, remote selection (25 pass), functional browser selection (70 pass) and all six native performance rows (2.4 min). Its production build precedes the direct crowd-count/refuge allocation changes; weather/rendering code is identical. Receipts: `verifiers/E28-*`.

T-E22-20-refuge passes an original-method control on the real L4 seed-2 low route through turn +120 fixed ticks: every entity record (including looks/targets), mission field and logged event is exactly equal. It covers both the direct crowd-model counter and borrowed refuge-target search. The surrounding appearance and unchanged cap tests also pass (10 tests). No RNG stream or tie rule changes.

### First-turn target reached in focused measurement

The direct counts/refuge version reaches **53.1 ms** (`allocation-native`), still red. Applying the unchanged distance/post limits before allied camera-policy queries then reaches **48.4 ms**, passing the unchanged 50 ms gate (`range-native`). This focused test reproduces the original loading/bot/clock setup and two-second alarm tail; it does not replace the full L4 war/tank/break acceptance run. No shaders build in the alarm window. T-E22-20-ally-range proves that unreachable-by-range candidates do not consume camera-policy queries; all existing ally/shot-cover cases and alarm-state parity pass (20 tests). Production code is frozen here for final-source timings and remaining QA.

Alternating real-map allocation microbenchmarks on Hetzner, 1,600 queries per sample, exact answers: crowd-model choice **53.536 → 48.994 ms**; refuge spot **50.614 → 32.516 ms** (`diagnostic/allocation-benchmark.json`). These are relative CPU measurements, not replacements for native frame gates.

### WebGPU measurements and instance uploads

The first full WebGPU batch has 10 pass / 2 existing skips / 3 low failures: L4 turn 65.8 ms (tank 32.0, break 49.6, sim p95 6.0), district p95 34.1 ms, horde p95 34.5 / max 53.0 ms. All four mobile E18 backend proxies pass at 59.88 fps median with all 100 infected; desktop p95 is 5.7 ms and both memory checks pass. Full L4 high passes (turn 17.5, tank 13.1, break 17.3, sim p95 2.1 ms). These receipts precede the last score and instance-stream changes.

Keeping the exact allied target score but checking whether a candidate can win before casting its cover rays improves WebGPU low turn to 58.5 ms, break 48.3 ms, sim p95 5.8 ms; horde p95 33.9 / max 37.2 ms; district p95 34.1 ms. The remaining low frame gates still fail (`score-native-webgpu`). All 21 focused ally/cover/alarm-state cases pass. The full unit run at this stage passes 299 files / 1 skip, 1,650 tests / 7 skips (268.92 s).

The following WebGPU CPU profile identifies attribute `queue.writeBuffer` as the largest sampled render cost: 374.3 ms during the final eight-second horde interval. It also confirms that the existing TextureRanges adapter already handles partial pose-atlas updates; no texture format or atlas change is made. Instance state/clothing now share one buffer instead of two; civilian frame/clothing/overlay share one instead of three. Float counts, per-instance capacity, attribute locations, poses and shader meanings are unchanged. T-E18-instance-stream checks the production civilian batch across all 350 slots against independent float32 attributes. All 13 focused appearance/pose tests pass. Both-backend crowd visibility, 60-second motion continuity and persistent 20-body browser cases pass (5 tests). The dedicated actor scene is under matrix validation before new timings.
