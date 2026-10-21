# Fixes 13h: L10 corpse and hitch investigation

## #98 real-play corpse route

The initial retained-civilian-look hypothesis was disproved by a production assault replay. Seed 32, `cure-disperse-ready`, console `(4002,-27)`, 5,400 ticks of ordinary rocket inputs (god mode only for survival): 53 combat kill events, 53 permanent bodies, **zero** bodies with retained civilian appearances. No actors were spawned by the driver and no HP was edited. The driver and exact input ledger are committed alongside this note.

Every frozen page has gore mask `31`: both arms, both legs, and the head are removed. Their sources are the correct #93 meshes, but only 74–168 torso triangles remain for the regular variants. The capture reads as separated coloured torso lumps, not reclining people. The prior fixture set HP directly and therefore bypassed VFX kill events and the five-bit dismemberment mask. See `real-assault-before.json` and `real-assault-before.jpg`.

`CivilianCrowd` also has a separate retained-look corpse path using its living geometry, and omits L10 from explicit corpse-band warmup. This remains a coverage concern, but is not the observed finale failure. Do not claim it explains #98.

The explicit request for intact permanent corpses must be applied at settlement; transient death effects currently follow `specs/01-art-direction.md` §7 (explosions detach all limbs). Keep that distinction visible in the implementation report and prove the frozen silhouette with real combat events.

## Implementation in progress

`CrowdView` now freezes complete, prewarmed bodies independently of the transient dismemberment mask. Live death/VFX feedback still records dismemberment; permanent pages retain full anatomy. This implements the explicit intact-corpse request over the older full-gore permanent-remnant behavior. The industrial encounter roster also contains firefighters: their corpse path now loads the intact authored source, alongside dogs and Alphas, instead of applying a second reduction to their living LOD. Living meshes, LOD selection, limits, corpse IDs and lifetime are unchanged.

The real-kill guard delivers Damage/VFX events to living actors, lets the production timer settle them, and checks the complete frozen silhouette and retained identities. It covers regular humans, dogs, firefighters, Alphas and the Mega model at both tiers; ordinary melee downings remain recoverable. The baseline guard fails on mask 31 (`guard-red.log`). Final green validation and visuals remain pending.

## #100 performance investigation

The API-only walk to `(755,13.6)` missed the trigger: seed 32 WebGL debug and L9 continue measured 23.2 / 24.3 ms maximum over 65 seconds. This is diagnostic evidence only, not proof of the requested real-play budget.

The real device-input driver reproduces it under quiet-run, seed 1: 466.6 ms at tick 2965 `(755.29,13.74)`, then 349.9 ms at tick 3700. A second, bounded CPU replay reproduces 449.9 ms at tick 2957 `(755.16,13.81)`. The profile window contains Three.js node construction and WebGL `getProgramParameter`, with no samples in `ControlIntent.resolve`, `reachPath`, or `forPlayer`. An isolated Node probe of initial click candidates stayed below 5 ms. Navigation has not been changed. Render-object/material tracing is collecting the identity of the cold graph before changing warmup.

The tick-0 report has a separate measurement defect: the real-input trace records a 2,650 ms L10 frame while `loading=true`, although the mission phase already says `playing`. The old playtest queue stored only `[ms,tick]` and classified it using the phase/level at later polling time. The corrected probe records loading/level/location at sampling time and clips the first interval at the actual card-close boundary. Its guard retains genuine 300 ms first playable frames and 870 ms later stalls; it does not discard those. A dedicated entry spec covers both backends and both entry routes, but still needs its final timing run.

Current raw artifacts are under `test-results/fixes-13h-l10/entry/`, `real-input-before/`, and `real-input-before-profile/`; the latter contains the CPU profile and exact ground-click ledger. These are not yet the final committed evidence bundle.

Intermediate validation: typecheck, lint, 12 focused guard tests and all 31 smoke cases passed. The full required remote command is still running. Final runtime profiling, visual review and validation of the hitch fix remain open.

## Completion evidence still required

- Real assault kills through settle/freeze for every L10 infected kind and death cause; visual before/after captures at high/low, zoom 0.5/1/1.5, WebGL2/WebGPU; inspect and describe the images.
- Guard coverage for the retained-look corpse route and the post-loading frame budget.
- Reproducible before/after hitch measurements, including the 600–870 ms samples if they reproduce; quiet-run L10-low p95 comparison.
- Remote unit/levels command and headless `@smoke` run green.
- Commit implementation and evidence. No captures have been added by this investigation.
