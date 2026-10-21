# Fixes 13h: L10 corpse and hitch investigation

## #98 real-play corpse route

The initial retained-civilian-look hypothesis was disproved by a production assault replay. Seed 32, `cure-disperse-ready`, console `(4002,-27)`, 5,400 ticks of ordinary rocket inputs (god mode only for survival): 53 combat kill events, 53 permanent bodies, **zero** bodies with retained civilian appearances. No actors were spawned by the driver and no HP was edited. The driver and exact input ledger are committed alongside this note.

Every frozen page has gore mask `31`: both arms, both legs, and the head are removed. Their sources are the correct #93 meshes, but only 74–168 torso triangles remain for the regular variants. The capture reads as separated coloured torso lumps, not reclining people. The prior fixture set HP directly and therefore bypassed VFX kill events and the five-bit dismemberment mask. See `real-assault-before.json` and `real-assault-before.jpg`.

`CivilianCrowd` has a separate retained-look corpse path. D-CURE has no civilian spawn volumes or civilian routes; the actual assault bodies carry infected model variants, not retained civilian appearances. That path does not explain this failure.

The explicit request for intact permanent corpses must be applied at settlement; transient death effects currently follow `specs/01-art-direction.md` §7 (explosions detach all limbs). Keep that distinction visible in the implementation report and prove the frozen silhouette with real combat events.

## Implementation in progress

`CrowdView` now freezes complete, prewarmed bodies independently of the transient dismemberment mask. Live death/VFX feedback still records dismemberment; permanent pages retain full anatomy. This implements the explicit intact-corpse request over the older full-gore permanent-remnant behavior. The industrial encounter roster also contains firefighters: their corpse path now loads the intact authored source, alongside dogs and Alphas, instead of applying a second reduction to their living LOD. Living meshes, LOD selection, limits, corpse IDs and lifetime are unchanged.

The real-kill guard delivers Damage/VFX events to living actors, lets the production timer settle them, and checks the complete frozen silhouette and retained identities after two simulated hours. It also hashes living surface attributes and indices before/after settlement. It covers regular humans, dogs, firefighters, Alphas and the Mega at both tiers. Melee downings and dog/Alpha gun downings remain recoverable and are then finished with real permanent damage; fire immunity remains intact. The Mega uses its real pursuit flag, conventional HP floor and direct-rocket accounting. Cure release has its own kill-event case. The baseline guard fails on mask 31 (`guard-red.log`); the strengthened ten-case guard passes (`evidence/boss-cure-guard-green.log`). The real console replay covers the Mega's assault waves; Mega physical moves themselves target humans, not other infected.

## #100 performance investigation

The API-only walk to `(755,13.6)` missed the trigger: seed 32 WebGL debug and L9 continue measured 23.2 / 24.3 ms maximum over 65 seconds. This is diagnostic evidence only, not proof of the requested real-play budget.

The real device-input driver reproduces it under quiet-run, seed 1: 466.6 ms at tick 2965 `(755.29,13.74)`, then 349.9 ms at tick 3700. A second bounded CPU replay reproduces 449.9 ms at tick 2957 `(755.16,13.81)`. The final material trace reproduces 400 / 333.3 ms at ticks 2957 / 3697. The first 400 ms window contains 212 ms inclusive node-build work and 145 ms in WebGL `getProgramParameter`, with no samples in `ControlIntent.resolve` or `reachPath`. An isolated Node probe of initial click candidates stayed below 5 ms. Navigation has not been changed.

The material trace identifies **81** new scene/shadow graphs at tick 2957 and **59** at tick 3697, including background, courier, corgi, terrain and VFX. Entering/leaving a checkpoint hero-light pool swaps the sun/spot light list. Three retires the warmed render objects when that list changes. The existing stable-list mechanism covered L5, L6 and L8, but omitted `L10-night`. L10 now uses that mechanism too: both graphs/maps warm during the existing loading pass; only the active shadow map refreshes. No loading delay has been added. Three added L10 light-list guards fail on the baseline and pass with the fix (`evidence/hitch-guard-red.log`, `evidence/static-focused-green.log`).

An extended 200-second baseline run also reproduces the later pattern: 333.3 ms at tick 11278 `(1286.54,24.94)`, with **54** new scene graphs. Its 333 ms CPU window contains 198 ms inclusive node-build work and 102 ms in program linking. The reported 600–870 ms amplitude did not reproduce on this host; the same later cold-graph pattern did. The extended profile and window summary are in `evidence/profile-before-extended-*`.

The first complete after matrix retains the same 53/167 bodies and transforms, and its wide views show complete reclining silhouettes. It also exposed a performance regression: low WebGL p95 4.9 ms versus 4.1 ms, low WebGPU 2.8 ms versus 2.3 ms. Three still samples an inactive shadow map before multiplying its result by zero. The filter now branches on the shadow weight, retaining the exact active filtering algorithm and stable light list. A real CPU-only TSL setup guard checks the runtime intensity branch and catches lost named inputs in nested shader functions. Final p95 measurements remain pending; the initial matrix is not a performance pass.

The tick-0 report has a separate measurement defect: the real-input trace records a 2,650 ms L10 frame while `loading=true`, although the mission phase already says `playing`. The precise-clock material trace records 2,699.9 ms in that same loading state: 1,087 ms self time in layout `insideXZ` polygon queries, 482 ms in NavGrid baking, 226 ms in flooding, and 292 ms in trap-rescue reachability (`evidence/profile-before-loading-tick0.txt`). This is world construction behind the existing card. The old playtest queue stored only `[ms,tick]` and classified it using the phase/level at later polling time. The corrected probe records loading/level/location at sampling time and clips the first interval at the actual card-close boundary. Its guard retains genuine 300 ms first playable frames and 870 ms later stalls; it does not discard those. A dedicated entry spec covers both backends and both entry routes, but still needs its final timing run.

Compressed baseline console manifests, the precise-clock CPU profile and material trace are committed in `evidence/`. `tests/fixtures/perf/l10-real-input.json.gz` contains the complete device-input recording, encoded as changes with exact tick numbers. The entry guard replays it through both lamp boundaries on both backends, after debug selection and the real L9 automatic-handover path (L9 completion is a declared fixture).

Typecheck, lint, 24 focused guards, the stronger ten-case Mega/cure guard and all 31 final smoke cases passed. The fresh full remote command and final quiet timing/visual runs remain in progress.

## Completion evidence still required

- Real assault kills through settle/freeze for every L10 infected kind and death cause; visual before/after captures at high/low, zoom 0.5/1/1.5, WebGL2/WebGPU; inspect and describe the images.
- Execute the recorded-input post-loading frame budget guard.
- Reproducible before/after hitch measurements, including the 600–870 ms samples if they reproduce; quiet-run L10-low p95 comparison.
- Remote unit/levels command and headless `@smoke` run green.
- Commit the completed evidence bundle and final review. One initial baseline capture is committed; the final comparison sheets will keep the report below ten captures.
