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

Existing `tests/perf/l10-lod-residency.spec.ts` records frame durations alongside simulation, update, render, shader-build, residency, and population counters, but its thresholds and route do not yet establish the reported debug-start or automatic-continue spikes. No before profile for ticks 2965 or 0 was present in the current worktree report directories when this investigation began. Capture an instrumented reproduction through `tools/perf/quiet-run.sh` before changing load work; distinguish loading-card time from the first playable frame and retain the profile/counters for each spike.

## Completion evidence still required

- Real assault kills through settle/freeze for every L10 infected kind and death cause; visual before/after captures at high/low, zoom 0.5/1/1.5, WebGL2/WebGPU; inspect and describe the images.
- Guard coverage for the retained-look corpse route and the post-loading frame budget.
- Reproducible before/after hitch measurements, including the 600–870 ms samples if they reproduce; quiet-run L10-low p95 comparison.
- Remote unit/levels command and headless `@smoke` run green.
- Commit implementation and evidence. No captures have been added by this investigation.
