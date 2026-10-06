# E15 — VFX, Blood and Feedback

Complete: all ten acceptance criteria have passing tagged tests; all required lane checks pass; evidence and status are finalized. Branch: `lane/e15-epic`. Latest main incorporated: `5d7b048` (E06 catalog, E10 district composition, asset conformance and incoming exports), merged before final checks.

## Built

- Fixed instanced TSL slots for ballistic billboards, depth-soft particles, sine noise, ground splats, shockwaves and four shape-distinct attack-lifetime telegraphs. Particle cap 2,048 (512 low tier); blood/scorch cap 600, fade 120 seconds. GPU buffers and geometry are reused. A world-position light sampling node can be supplied by E25/E27.
- Event-driven hit flashes, render-time 50 ms hit-stop with crowd suppression, blood spray/arcs/trails, player/weapon masks, seeded limb detachment and visible stump caps. Eighty preallocated Rapier gib bodies live in a separate presentation world, expire after 30 seconds, and skip work when empty. No visual RNG, masks or bodies enter sim state.
- Infrastructure presets for muzzle flash/tracers/high-tier casings, explosion fireball/smoke/debris/shockwave/scorch/shake, fire/smoke/toxic/electric/screamer/objective/pickup/ash. `vehicle.feedback` drives paint/glass blood, damage smoke and fire through a code adapter for E09. E27 owns detailed blast anatomy and smoke choreography.
- Full/Reduced/Off gore, VFX enable, flash reduction and high/low quality; lifecycle disposal includes all generated depth texture copies. Bruno Confetti/Leaves/Trails/Noises patterns were adapted under MIT, with attribution in THIRD_PARTY_NOTICES.md; the existing palette shader supplies the blood-mask hook.
- Deterministic stress, blood, gore and L4/L6 showcase fixtures; query-gated test API exposes a visual clock and typed presentation event probes.

## Acceptance evidence

All named tests carry the acceptance ID. Machine-readable measurements and screenshots are adjacent to this report.

| AC | Tests | Measured evidence |
| --- | --- | --- |
| E15-AC01 | T-E15-01, T-E15-01b | 3,600 ticks / 60 real kills, all six VFX/gore combinations hash `e43b5e7b`; determinism.json. |
| E15-AC02 | T-E15-pool, T-E15-02 | 600 sim/render seconds, 36,000 ticks; every post-warmup sample 65 geometries, 7 textures, 63 draw calls, 20,679 triangles, 192 active particles and ≤600 decals; stress.json / stress.png. |
| E15-AC03 | T-E15-03 | 1,142 red pixels in Full, zero in Off, within the same 2,020-pixel projected decal mask; blood-pixels.json / blood-Full.png / blood-Off.png. |
| E15-AC04 | T-E15-events, T-E15-tell-slots, T-E15-04 | Chevron, lane outline, circle and cross appear on event dispatch, survive 180 ticks plus 5 visual seconds, and vanish on resolution; telegraphs.json and four on/off/settled image sets. Birth and settled frames have the same solid footprint; a nonzero-time disable/re-enable probe also passes. |
| E15-AC05 | T-E15-05 | Radii 2/4/6 m measure 146.66/295.45/449.00 screen pixels, maximum proportional error 2.05% versus allowed 15%; shockwave.json / ring-*.png. |
| E15-AC06 | T-E15-hit-stop, T-E15-06 | Active at 39 ms, ends at 50 ms, independent of sim time scale; eight real slam hits suppress the freeze; hit-stop.json. |
| E15-AC07 | T-E15-07 | Checklist D: 3/3 must and 2/2 should pass for each of L4/L6; review.md, showcase-L4.png / showcase-L6.png, compare/L4.png / compare/L6.png. |
| E15-AC08 | T-E15-08 | Maximum consecutive normalized mean luminance delta 0.04016 reduced versus 0.26307 full; budget ≤0.20; flash-reduction.json and fixed 60 Hz frame sequence. |
| E15-AC09 | T-E15-09, T-E15-09b | 71/200 = 35.5% seeded machete kills detach; Reduced/Off zero; all modes 200 kills, hash `b6c9622c`; real grenade detaches all five parts plus three chunks in Full, none in Reduced/Off; all gibs expire after 30 s; gore.json / gore-*.png. |
| E15-AC10 | T-E15-10 | After 30 real melee kills both masks reach 0.75; level load and Off yield 0; accumulation.json / blood-accumulation.png. |

Additional tests cover three load/unload cycles returning GPU resources to 1 geometry / 2 textures with zero sim listeners/bodies, 512 low-tier slots, and vehicle mask/smoke/fire feedback leaving the sim hash unchanged. A native WebGPU compilation/RAF sampling test is available for the orchestrator; it was not run in this lane.

## Validation

| Command | Exit | Result |
| --- | --- | --- |
| npm run typecheck | 0 | Both TypeScript projects pass (final verifier). |
| npm run lint | 0 | No new warnings (final verifier). |
| npm run build | 0 | Production build passes (final verifier). |
| npm run test:unit | 0 | 73/73 tests, 29 files. |
| npm run test:sim | 0 | 106/106 tests, 8 files. |
| npm run test:smoke | 0 | 3 Node and 12 browser tests; browsers 26.3 s. |
| npm run verify -- E15 | 0 | 10 selected Node and 24 browser tests; browsers 7.8 min. |
| Cross-epic / native GPU regression | orchestrator-owned | Per final scheduler instruction; not claimed as a passing lane gate. |

An earlier full-regression attempt found one outdated closed API-key list; the corrected API contract passed in the later partial run. That partial run stopped at the scheduler job limit and is not claimed as a completed regression. The final scheduler rule requires only the epic verifier plus smoke in each lane, with cross-epic regression run once on main by the orchestrator. Logs are in `logs/`; `checks.json` and `vitest.json` are emitted by `npm run verify -- E15`. All ten acceptance IDs have passing tagged coverage, audited in acceptance-results.json against verify-results.json and vitest.json. No further main merges or asset registrations are performed after the orchestrator's final-base instruction.

## Performance

The isolated ten-minute event stress fixture stays at 63 draw calls / 20,679 triangles, well below the desktop 600 / 1.5 million budgets. GPU resources plateau after warmup. High/low fixed particle capacities are 2,048/512; decals 600; total gib slots 80; tell slots 256; shockwave slots 16. Visual gib physics uses its own fixed 60 Hz world. No per-hit meshes, textures, buffers, or rigid bodies are created. Particle colors use numeric RGB rather than CSS parsing; hit flashes use 512 fixed slots instead of map-entry churn, and the blade matcher is shared.

`stress.json` frameMs/fps include paused API stepping, screenshot waits and shared-machine scheduling gaps; they are not a real-time GPU benchmark. Its simMs values are RAF counters while paused, not a measurement of the 60-tick batch. The resource/geometry acceptance test intentionally asserts caps and plateau rather than claiming a frame-time result from those counters. Earlier epic unit/sim tests passed in the full Node suites. Cross-epic browser and native GPU regression are delegated to the orchestrator under its final rule.

## Deviations and integration notes

1. Fixed the epic's nonexistent vision-checklist §7.4 link to §7.1, Checklist D. No acceptance threshold was weakened.
2. The temporary E05 machete fixture and TTK rows were removed when E06 landed. VFX consumes its authoritative catalog (32-damage machete); 25-HP probe targets exercise 200 real kills with the same rate and all original probability/hash assertions. E06 ActionView supplies the actual held models and blood masks; no extra E15 weapon remains.
3. Main delivered unregistered source GLBs during implementation; the small source-path repair preserved their below-integrated statuses. The later asset-conformance merge supersedes those identical paths and retains its orientation/LOD metadata. Reference material was never edited. A newly tracked flashbang was compiled through existing optimizeExports (4,988 triangles, 5 materials/draws, 109.2 KiB, validation errors=[]); only source path and measured dimensions were registered, with status still reference. A temporary asset-readiness test guard was removed after main supplied the missing runtime exports; final E17 checks remain authoritative.
4. Infrastructure effects and code placeholders follow E15/E27 and asset-status boundaries. E10 district composition, cached materials, photo spots, masks and disposal were retained during conflict resolution; non-combat characters reuse its palette cache. E14 owns a user-facing settings UI/persistence; E09/07 own actual vehicle/attack emitters. E06 fire/smoke zone events are connected to the pooled infrastructure. E15 provides the typed event contracts and rendering hooks.
5. Earlier overlapping browser runs hit shared-machine contention; long tests have bounded 300/600-second deadlines; the 600-kill browser test needed 600 seconds after a 300-second timeout during screenshot capture, with all semantic assertions retained. All final runs use the machine-wide lock added by main, with ≤2 Playwright workers and ≤4 Vitest threads.

## Known issues

No unresolved E15 acceptance failures. Native GPU performance has not been measured by this lane; the opt-in test remains available to the orchestrator. This report does not claim district art parity or a real-time frame-rate benchmark from paused SwiftShader stress measurements; those are outside the isolated fixtures used here.
