# Fixes 13h: L10 corpse and hitch investigation

## #98 real-play corpse route

The initial retained-civilian-look hypothesis was disproved by a production assault replay. Seed 32, `cure-disperse-ready`, console `(4002,-27)`, 5,400 ticks of ordinary rocket inputs (god mode only for survival): 53 combat kill events, 53 permanent bodies, **zero** bodies with retained civilian appearances. No actors were spawned by the driver and no HP was edited. The driver and exact input ledger are committed alongside this note.

Every frozen page has gore mask `31`: both arms, both legs, and the head are removed. Their sources are the correct #93 meshes, but only 74–168 torso triangles remain for the regular variants. The capture reads as separated coloured torso lumps, not reclining people. The prior fixture set HP directly and therefore bypassed VFX kill events and the five-bit dismemberment mask. See `real-assault-before.json` and `real-assault-before.jpg`.

`CivilianCrowd` has a separate retained-look corpse path. D-CURE has no civilian spawn volumes or civilian routes; the actual assault bodies carry infected model variants, not retained civilian appearances. That path does not explain this failure.

The explicit request for intact permanent corpses must be applied at settlement; transient death effects currently follow `specs/01-art-direction.md` §7 (explosions detach all limbs). Keep that distinction visible in the implementation report and prove the frozen silhouette with real combat events.

## Implementation

`CrowdView` now freezes complete, prewarmed bodies independently of the transient dismemberment mask. Live death/VFX feedback still records dismemberment; permanent pages retain full anatomy. This implements the explicit intact-corpse request over the older full-gore permanent-remnant behavior. The industrial encounter roster also contains firefighters: their corpse path now loads the intact authored source, alongside dogs and Alphas, instead of applying a second reduction to their living LOD. Living meshes, LOD selection, limits, corpse IDs and lifetime are unchanged.

The real-kill guard delivers Damage/VFX events to living actors, lets the production timer settle them, and checks the complete frozen silhouette and retained identities after two simulated hours. It also hashes living surface attributes and indices before/after settlement. It covers regular humans, dogs, firefighters, Alphas and the Mega at both tiers. Melee downings and dog/Alpha gun downings remain recoverable and are then finished with real permanent damage; fire immunity remains intact. The Mega uses its real pursuit flag, conventional HP floor and direct-rocket accounting. Cure release has its own kill-event case. The baseline guard fails on mask 31 (`guard-red.log`); the strengthened ten-case guard passes (`evidence/boss-cure-guard-green.log`). The real console replay covers the Mega's assault waves; Mega physical moves themselves target humans, not other infected.

## #100 performance investigation

The API-only walk to `(755,13.6)` missed the trigger: seed 32 WebGL debug and L9 continue measured 23.2 / 24.3 ms maximum over 65 seconds. This is diagnostic evidence only, not proof of the requested real-play budget.

The real device-input driver reproduces it under quiet-run, seed 1: 466.6 ms at tick 2965 `(755.29,13.74)`, then 349.9 ms at tick 3700. A second bounded CPU replay reproduces 449.9 ms at tick 2957 `(755.16,13.81)`. The final material trace reproduces 400 / 333.3 ms at ticks 2957 / 3697. The first 400 ms window contains 212 ms inclusive node-build work and 145 ms in WebGL `getProgramParameter`, with no samples in `ControlIntent.resolve` or `reachPath`. An isolated Node probe of initial click candidates stayed below 5 ms. Navigation has not been changed.

The material trace identifies **81** new scene/shadow graphs at tick 2957 and **59** at tick 3697, including background, courier, corgi, terrain and VFX. Entering/leaving a checkpoint hero-light pool swaps the sun/spot light list. Three retires the warmed render objects when that list changes. The existing stable-list mechanism covered L5, L6 and L8, but omitted `L10-night`. The first implementation added L10 to that mechanism: both graphs/maps warmed during loading; only the active shadow map refreshed. This implementation was subsequently rejected for its quiet-run p95 regression and has been removed. Three added L10 light-list guards fail on the baseline and pass with the fix (`evidence/hitch-guard-red.log`, `evidence/static-focused-green.log`).

An extended 200-second baseline run also reproduces the later pattern: 333.3 ms at tick 11278 `(1286.54,24.94)`, with **54** new scene graphs. Its 333 ms CPU window contains 198 ms inclusive node-build work and 102 ms in program linking. The reported 600–870 ms amplitude did not reproduce on this host; the same later cold-graph pattern did. The extended profile and window summary are in `evidence/profile-before-extended-*`.

The first complete after matrix retains the same 53/167 bodies and transforms, and its wide views show complete reclining silhouettes. It also exposed a performance regression: low WebGL p95 4.9 ms versus 4.1 ms, low WebGPU 2.8 ms versus 2.3 ms. Three still samples an inactive shadow map before multiplying its result by zero. The second implementation branched the filter on shadow weight, retaining the active filtering algorithm and stable light list; this too was subsequently rejected and removed. A real CPU-only TSL setup guard checks the runtime intensity branch and catches lost named inputs in nested shader functions. Neither stable-list implementation is a performance pass.

The tick-0 report has a separate measurement defect: the real-input trace records a 2,650 ms L10 frame while `loading=true`, although the mission phase already says `playing`. The precise-clock material trace records 2,699.9 ms in that same loading state: 1,087 ms self time in layout `insideXZ` polygon queries, 482 ms in NavGrid baking, 226 ms in flooding, and 292 ms in trap-rescue reachability (`evidence/profile-before-loading-tick0.txt`). This is world construction behind the existing card. The old playtest queue stored only `[ms,tick]` and classified it using the phase/level at later polling time. The corrected probe records loading/level/location at sampling time and clips the first interval at the actual card-close boundary. Its guard retains genuine 300 ms first playable frames and 870 ms later stalls; it does not discard those. A dedicated entry spec covers both backends and both entry routes, but still needs its final timing run.

Compressed baseline console manifests, the precise-clock CPU profile and material trace are committed in `evidence/`. `tests/fixtures/perf/l10-real-input.json.gz` contains the complete device-input recording, encoded as changes with exact tick numbers. The entry guard replays it through both lamp boundaries on both backends, after debug selection and the real L9 automatic-handover path (L9 completion is a declared fixture).

Typecheck, lint, 26 focused guards (including the ten-case Mega/cure guard) and all 31 final smoke cases passed. The fresh full remote command and recorded-input entry guard remain in progress.

## Completion evidence still required

- Real assault kills through settle/freeze for every L10 infected kind and death cause; visual before/after captures at high/low, zoom 0.5/1/1.5, WebGL2/WebGPU; inspect and describe the images.
- Execute the recorded-input post-loading frame budget guard.
- Reproducible before/after hitch measurements, including the 600–870 ms samples if they reproduce; quiet-run L10-low p95 comparison.
- Remote unit/levels command and headless `@smoke` run green.
- Commit the completed evidence bundle and final review. One initial baseline capture is committed; the final comparison sheets will keep the report below ten captures.

## Historical rejected matrix and extended after-profile (runtime `8e11cc330`)

The four comparison sheets each contain native 1280×720 captures at zoom 0.5/1/1.5, before above after. I inspected all four: WebGL2/WebGPU agree; both tiers restore heads, hands, arms and legs, with full reclining outlines especially visible around the pile's edge at zoom 1/1.5. At zoom 0.5 the complete authored faceted anatomy is visible. High quality's 167-body center remains heavily overlapped; low retains 53 bodies. No body is hidden, faded or removed. `evidence/final-matrix-audit.json` verifies exact equality of inputs, kill events, body IDs/transforms and all camera states for each pair, with no browser errors.

The final 200-second device-input after-profile reaches tick 11,455 / `(1297.6,24.9)` with no reported playable interval over 200 ms and no issues. The only graph-build batch ≥20 is tick zero (640 graphs behind loading); the earlier 81/59/54-graph playable rebuilds are absent. The log/profile/material/input ledgers and quiet conditions are retained as `evidence/profile-after-extended-*` and `final-visual-profile-conditions.jsonl`. This bounded run does not claim coverage of ticks 33,164 or 90,240.

Final matrix p95 samples: low WebGL2 `[5.1,5.2,5.2]`, high `[4.3,4.2,4.2]`; low WebGPU `[2.4,2.4,2.4]`, high `[3.0,2.9,3.0]` ms. WebGPU improved over the list-only attempt, but WebGL2 remains above the earlier baseline. The no-regression requirement remains open; a paired low before/after run with CPU profiles outside the cadence samples is queued. These images prove anatomy, not a performance pass.

The first entry-replay harness run was rejected: the menu's post-load `input.clear()` reset Recorder playback, leaving the hero at x=547. The x>800 guard caught it. The harness now uses the existing production telemetry feed across that menu release; it must still pass both lamp boundaries and both entries on each backend.

## Paired rejection and cached-source replacement (`bf8a2b4a9`)

An adjacent baseline/current low run in one quiet reservation confirms the stable-list cost: WebGL2 `[4.1,4.2,4.2]` → `[4.7,5.1,5.1]` ms; WebGPU `[2.3,2.3,2.2]` → `[2.5,2.5,2.5]`. CPU profiles were collected after, outside the cadence samples. The extra spot contributes an additional graph and uniforms even when its filter branch skips texture taps; the road fragment shader grows from 26,509 to 32,969 bytes. The profiles, shaders, manifests and quiet conditions are retained as `evidence/paired-rejected-*`.

The replacement removes the stable-list/filter changes. It extends the existing render-object variant cache with a scoped L10 shadow-source key, including non-palette/background materials. Both exclusive sources warm behind the existing card, and only the selected source participates in a draw. Real Three manager tests reproduce retirement without retention, verify both cached IDs survive repeated switches, and check disposal; a loading guard checks both variants warm and the original source restores even after an error. Typecheck, lint and 43 focused tests pass. Native frame/p95/loading measurements, a fresh full remote suite and fresh smoke remain pending.

The corrected full input replay reproduces the original-scale baseline debug stall: **3,721.9 ms**, tick 2962, `(755.35,13.93)`, with the loading card actually hidden. It also records 611.3 ms at tick 3163, 349.6 ms at tick 3306 and 918.4 ms at tick 3702. End x=896.97 proves both lamp boundaries were crossed. The same replay through L9 automatic continue and both final backends remains in progress.


## Full warm-up rejected; incremental cached-source replacement

The corrected replay reproduces **3,721.9 / 426.8 ms** (WebGL2 debug / L9 continue) and **4,485 / 268.1 ms** (WebGPU). The first debug WebGL2 stall is at tick 2962 `(755.35,13.93)`: 3,404 ms self time in `getProgramParameter` and 237 ms inclusive graph building, with no navigation samples. The same run reproduces the smaller-hitch family too: 611.3 ms at tick 3163, 349.6 ms at 3306 and 918.4 ms at 3702. The 611 ms window contains 582 ms in program linking and 18 ms inclusive graph building; the 918 ms window contains 668 ms linking and 216 ms building (`entry-before-debug-webgl2-tick3163.txt` / `tick3702.txt`). The 200-second baseline separately reproduces the later pool near `(1286.54,24.94)`. `evidence/entry-before-*` preserves all four exact replays/profiles; `entry-before-debug-webgl2-tick2962.txt` summarizes the original-scale stall.

Warming both cached sources entirely behind the card (`bf8a2b4a9`) passes all four playable frame guards, but adds 7,721 ms to debug loading (7,367 ms in view preparation). **Rejected:** this exceeds the allowed one second. The four traces remain in `entry-rejected-full-warm-*`; their green frame thresholds are not acceptance evidence for loading.

The replacement retains the original exclusive Sun/Spot draw and its original active filter. Separate source keys extend the existing render-object pass cache (including backgrounds). After ordinary loading, a queue captures one alternate leaf graph, waits for asynchronous linking, then executes its HDR/MSAA driver draw before advancing. It reuses existing exact static-layout deduplication (607 leaves), preserves instance/camera/object/probe state, and restores the selected source before each normal gameplay draw. It finishes around tick 566 / 9.4 seconds, before the first lamp boundary near tick 2957. Reset cancels the queue. There is no extra loading wait.

The first deduplicated run (`9391755cc`) measures WebGL2 maxima **31.6 / 37.4 ms** and WebGPU **23.6 / 30.3 ms**, with the same replay endpoints and no over-budget playable interval. WebGL2 debug total loading increases only 82.8 ms. However, both WebGPU entry specs correctly reject two depth-binding validation errors: precompiling soft particles used a single-sample fallback before the actual multisampled depth copy existed. `d8d8df2b4` tags those leaves to use their actual HDR driver draw directly; low/high WebGPU assault captures then have no browser errors. A fresh four-entry guard on this fix remains required. Earlier pre-depth entry traces and the failed spec log are retained explicitly as intermediate evidence.

The 200-second depth-safe incremental profile reaches tick 11601 at `(1312.7,24.9)`, including the later reported pool, with no playable interval over 200 ms (`incremental-depth-safe-extended-*`). It does not claim coverage of ticks 33164 or 90240. The settled assault comparison still rejects the low-p95 condition: WebGL2 `[4.0,4.0,4.0]` → `[4.6,4.6,4.6]` ms; WebGPU `[2.3,2.2,2.3]` → `[2.6,2.6,2.5]`. Changing corpse draw order has no effect (both `[4.6,4.6,4.6]`); no application draw-order change was made.

Current candidate `aa657e830` skips cloud-shadow sine work at zero strength and derivative-based blood splats at zero coverage, retaining the exact positive-strength field/math. Typecheck, lint and 15 focused guards pass. The latest full remote suite is running. Native p95/entry/matrix/smoke evidence on this candidate is pending; browser timing is paused by orchestration until 02:50 UTC on October 22.

The full requested remote command on depth-safe source `d8d8df2b4` completes green: **423 files passed, 3 skipped; 2,325 tests passed, 11 skipped**, 2,435.8 seconds. The sanitized log is `evidence/remote-depth-safe-green.log.gz`. The separate full run on the mask-optimization candidate is still pending.


## Zero-strength shader work: paired candidate measurements

The `aa657e830` quiet pair retains exact real-assault inputs and body transforms, with no browser errors. Low WebGL2 `[4.1,4.2,4.1]` → `[4.4,4.3,4.2]` ms; low WebGPU `[2.9,2.5,2.3]` → `[2.5,2.4,2.5]`. The median WebGL2 gap is reduced to 0.2 ms, but still fails the no-regression condition. The batch deliberately stops before high/entry captures. These manifests/profiles/shaders and quiet conditions are retained as `mask-candidate-*`; they are not final performance acceptance.

Candidate `e818b94bb` additionally puts the existing L9 distant-fire and subway-grading computations behind their positive-strength uniform branches. Their active formulas and blending are unchanged, and no geometry/LOD/count/cap/visibility setting changes. Two TypeScript-AST guards retain those branch scopes. Fresh statics, focused guards, the full remote command, and the next quiet pair are queued. The baseline worktree remains unchanged in `src/` against `769d9f8ce`.


The `e818b94bb` adjacent pair resolves WebGL2: `[4.2,4.1,4.1]` → `[3.9,3.9,3.7]` ms, with identical inputs, kills and body transforms. WebGPU still rejects: `[2.3,2.3,2.2]` → `[2.6,2.4,2.8]`. Neither backend builds any new graph during the measured settled view (404→404 / 777→777 WebGL2, 416→416 / 789→789 WebGPU). The WebGPU after profile shifts more wait into `createCommandEncoder`; this is not evidence of a new graph or navigation hitch. The batch again stops before high/entry guards, and `inactive-stage-candidate-*` retains its results. No acceptance claim is made from its similar mean throughput.

Candidate `46f5525f6` memoizes the current caller-pass / palette-output / shadow-source tuple in a weak material cache, avoiding repeated suffix string allocations and hashing during steady draws. Real Three manager guards additionally change the caller's reflection pass and return to the original source without retirement. Typecheck, lint and 17 focused tests pass; the next quiet pair and a fresh full remote suite are pending. The superseded full-suite run on `e818b94bb` was explicitly canceled (exit 130); it is not counted as green.

The full remote suite on mask-only source `aa657e830` also completes green: **424 files passed, 3 skipped; 2,331 tests passed, 9 skipped**, 3,451.52 seconds (`remote-mask-candidate-green.log.gz`). This is historical coverage; the fresh full command on pass-key source `46f5525f6` remains running. Selected focused/smoke/failure logs were explicitly added despite the repository-wide log ignore rule.


## Corpse vertex normal matrices

The pass-string candidate `46f5525f6` measures WebGL2 `[4.0,4.0,4.1]` → `[3.8,3.7,3.7]`, WebGPU `[2.2,2.2,2.2]` → `[2.3,2.3,2.4]` ms. It still misses WebGPU by 0.1 ms, so the batch stops before high/entry guards. The subsequent normal-weight/haze branch experiment `87e6b1b55` regresses both: WebGL2 `[4.2,4.0,4.0]` → `[4.2,4.4,4.3]`; WebGPU `[2.3,2.6,2.2]` → `[2.4,2.4,2.4]`. It is explicitly reverted by `b3977dbca`. Both pairs retain identical inputs, kill events and body transforms (`pass-cache-candidate-*`, `zero-weight-candidate-*`). Their superseded full-suite jobs were canceled and are not green acceptance evidence.

Three's `transformNormal` builds an inverse-transpose matrix in the vertex graph. The frozen-body placement path was evaluating that for every restored head/limb vertex, although placements change only when bodies enter or leave a page. `6ff7f9ca0` / `2af121218` / `300b0beda` precompute the same normal matrix on placement-version changes, using Three's CPU matrix implementation. The three normal columns share the existing placement buffer, with 16-byte column alignment, so no extra WebGPU vertex-buffer slot is required. Reserved rows are initialized too, covering loading's count-only one/two-instance driver draws. The ordinary static/living path retains its original transform; positions, indices, counts and lifetime are unchanged.

The guards verify scale/shear math to six decimal places, unchanged source vertex arrays, no repeated inverse on steady draws, reserved-row validity, and an actual TSL setup graph with no corpse inverse (the ordinary-static control still has one). Four local tests pass; the aligned current implementation also passes full typecheck, lint and **75 focused tests across 13 files**, including every corpse-related unit file. The next quiet pair is queued. Its manifests now also record selected sun/spot/hero-light state and whether each actual frozen page uses precomputed normals. Native p95 and entry acceptance remain pending.


## Current rendering and measurement protocol (runtime `9658ba983`)

The precomputed-normal pair retains exact bodies and inputs: WebGL2 `[4.1,4.0,4.0]` → `[3.9,3.7,3.6]` ms; WebGPU `[2.3,2.2,2.2]` → `[2.8,2.8,2.3]`. All 53 actual frozen pages use the new attributes. Selected lighting matches (Sun on, Spot off, no hero light); this closes the lighting-state confound but does not pass WebGPU p95.

`9658ba983` forwards the exact eight Three RenderObjects.get arguments without allocating a rest array per draw. Its quiet pair measures WebGL2 `[4.0,4.1,4.1]` → `[3.6,3.8,4.0]`; WebGPU `[2.6,2.3,2.2]` → `[2.3,2.4,2.7]`, still a 0.1 ms median p95 regression. Supplemental WebGPU timestamps improve from 13.344/14.879 ms median/p95 to 12.373/13.796 ms, but those GPU results do not substitute for RAF p95 acceptance.

The initial settled-view probe enabled Inspection for rendering. `7d13b87ea` uses the normal presentation loop instead: simulation time scale zero, unchanged world tick, no Inspection panel/picking/pose updates, exact gameplay camera checks. Its WebGPU result `[2.1,2.5,2.1]` → `[2.6,2.9,2.4]` still regresses. These failed microbenchmarks remain evidence, with raw manifests/profiles and admission conditions; changing the harness has not been counted as a pass.

The real-time driver `e4a37491b` additionally measures the entire actual console assault through the production input feed at normal simulation speed, including combat, spawning, VFX, and accumulating permanent bodies. It retains the short settled-view diagnostics and records the full assault's native RAF sample count, p95, maximum and tick range. It never spawns victims or edits their HP. Typecheck, lint and 71 focused tests pass. Paired real-time low runs and the independent four-entry guard are now running. A fresh full remote unit/levels command covers this exact source snapshot.


The first full real-time pair on `9658ba983` also rejects acceptance: WebGL2 5.0→5.2 ms, WebGPU 3.4→3.8 ms full-assault p95. All input, kill and body records match exactly. Settled diagnostics are WebGL2 `[3.7,3.7,3.7]`→`[3.6,3.7,3.7]`, WebGPU `[2.3,8.2,2.4]`→`[2.3,2.2,2.6]`. Improving a settled median is insufficient when actual fighting regresses. The corresponding full remote run was explicitly canceled (exit 130), not counted as green.

The replacement removes the normal-buffer experiment. Both production corpse callers place already-baked geometry using yaw and translation only; their normal inverse-transpose therefore equals the placement rotation. The corpse vertex graph reuses those existing columns, with no additional attributes, copying, inverse or expanded stride. Ordinary static/living transforms retain the original inverse-transpose path. Numeric guards cover rotated float32 placements and verify all real-kill frozen placements against the inverse-transpose across all three basis normals. The next acceptance audit requires *both* full-assault and settled-view low p95 not to regress; neither throughput nor GPU timestamps substitute for them.
