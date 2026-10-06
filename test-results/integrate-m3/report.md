# Integrate M3 evidence

All four requested lanes are merged on `lane/integrate-m3`, in the requested order. Main was merged once at the start, fast-forwarding to `d899e55`. Integration is **not fully green**: E18 district triangle budgets and asset-delivery validation remain open.

## Resolutions

- Crowd rendering retains one packed WebGL2 `_state` attribute for animation, detached limbs, gore and hit flash, with a separate tint attribute. It combines the existing attribute-limit fix with E18 distance budgets and the art lane's real-model LODs, nearest-eight hero selection and frustum culling. The pixel check records 7,389 visible infected body pixels, excluding the ground shadow.
- GameView retains classic ARPG controls/movement marker, civilians and progression, performance quality/context/cache handling, and the art lane's real models. Duplicate crowd creation and duplicate civilian presentation were removed. Removed CombatView references were replaced by the merged presentation paths.
- Lighting retains main's fog behavior and the close-camera baseline radius of 19. Vfx retains colorblind handling and E18 gib budgets. Test API retains campaign, NPC, quality, debug and control functionality.
- DistrictAssets retains static batching, semantic building aliases, real-model LOD selection, meshopt decoding and KTX2 delivery. All 275 manifest entries survive a recursive, field-level three-way merge keyed by asset ID; there were no field conflicts.
- E02-AC02 keeps main's close-camera wording (survivor 1/5.5–1/4 of viewport). The art lane's E02-AC04 clarification retains at least nine metres of portrait ground width and local fog density. These are merge resolutions, not new criteria.
- The obsolete LOD1 byte-ratio validator check was removed in accordance with specs/03 §7. Triangle-ratio and absolute triangle limits remain enforced.

## Integration repairs and validation method

Quality switching loads both crowd LODs so low-to-high upgrades work. Campaign quality scaling only changes authored campaign district NPC populations. Performance fixtures no longer add a second infected AI update when campaign setup already owns it. Patient Zero stays on its mission actor spawn path. Close-camera input tests use visible click destinations, and fog comparisons tolerate floating-point rounding without changing the criterion. Verification builds are serialized with browser previews to avoid transient missing hashed bundles.

Browser runs are headless under `tools/e2e-lock.sh`, with E2E_PORT=3339 and at most two workers. Native WebGL2 uses ANGLE Metal, GPU enabled and blocklist ignored. Unit tests used two workers. The desktop E18 timing check disables frame-rate limiting/vsync and retains a twelve-second simulation window plus at least 720 rendered frames, 120 warm-up frames, 300 simulation ticks and a 16.7 ms p95 budget.

## Close L1 review

`play-perf.json` records 60.468 seconds of desktop play at 1600×900 and 60.565 seconds of iPhone portrait play at 390×844. Ground click moved the desktop survivor 1.922 m and right click generated an attack. Touch movement moved the portrait survivor 5.071 m and both weapon controls generated attacks. No browser errors were recorded. Six screenshots (start/end and an injected infected on each viewport) were visually reviewed and deleted. Real survivor/corgi/vehicle/building/street models and infected bodies were visible; the injected-infected views have zero magenta pixels.

The fixed start composition was sampled with simulation time scale zero while rendering and UI continued, after 60 warm-up frames, for 360 samples, with vsync/frame limiting disabled. These numbers measure render headroom at the exact start, not a moving horde or physical phone:

| Viewport / quality | Draws | Triangles | JS heap after CDP GC | RAF p50 / p95 / mean |
| --- | ---: | ---: | ---: | --- |
| Desktop 1600×900 / auto high | 291 | 808,653 | 80,204,960 bytes | 3.0 / 3.4 / 3.055 ms |
| iPhone portrait 390×844 / auto low | 208 | 422,375 | 79,650,836 bytes | 2.1 / 2.4 / 2.091 ms |

GPU: ANGLE Metal, Apple M1 Max. `performance.memory` also reports external asset allocations (approximately 414 MB desktop / 379 MB portrait); the table reports the CDP JS heap after garbage collection. Projected survivor height is 18.305% desktop and 7.661% portrait, with portrait framing governed by the nine-metre ground-width criterion.

## Remaining asset failures

`assets-failures.json` lists every failure: 262 of 471 records, including 258 triangle-ratio findings, 119 absolute triangle-limit findings and four tier-size findings (categories overlap). The requested estimate of approximately eight LOD failures does not match the merged asset lane. The four size failures are `bld.mainstreet-brick:lod0` (1622.512 KiB), `bld.school-elementary:lod0` (1521.469 KiB), `kit.campground:lod0` (478.965 KiB), and `kit.rail-crossing:lod0` (307.234 KiB).

Asset-ship fixes the three formerly invalid LOD2 bounds. They still fail triangle limits/ratios: house-b 56,572 triangles (72.823% of LOD0), house-c 74,104 (82.543%), and joes-diner 38,022 (42.666%). No dimension errors remain for these three.

E18 L5/L6 deterministic counters pass draw-call limits but exceed triangle limits. The budgets remain 1.5 M high / 500 k low. The dense LOD assets require asset-authoring follow-up. The specified budgets and accepted hero art remain in place.

Physical-device and WebGPU-only gates remain manual under the repository's headless macOS policy. Native Metal WebGL2 and CPU-throttled mobile proxies were exercised; emulation does not establish physical-device parity.

| E18 scene / quality | Draws | Triangles | Triangle budget |
| --- | ---: | ---: | ---: |
| L6 Main Street / high | 305 | 2,320,851 | 1,500,000 |
| L6 Main Street / low | 266 | 1,260,665 | 500,000 |
| L5 Bridge / high | 249 | 1,716,243 | 1,500,000 |
| L5 Bridge / low | 199 | 715,911 | 500,000 |

Both horde counter scenarios pass (high 54 draws / 1,309,159 triangles; low 53 / 428,823). All six scenarios reproduce the same counters on repeated renders.

Final check counts and E18 measurements are recorded in `summary.json` and the copied JSON evidence alongside this report.

## Final checks

Typecheck, lint and production build pass. Unit: 136 tests / 52 files pass. Smoke: 3 Node and 22 browser checks pass. Focused classic mouse/touch controls and infected visibility: 3 browser checks pass.

| Verify | Node passed | Browser passed | Browser failed |
| --- | ---: | ---: | ---: |
| E02 | 8 | 37 | 0 |
| E03 | 12 | 120 | 0 |
| E08 | 30 | 27 | 0 |
| E13 | 20 | 32 | 0 |
| E17 | 36 | 36 | 0 |
| E18 headless | 15 | 33 | 4 |
| E18 native GPU/proxies | — | 3 | 0 |

E18's four additional manual/WebGPU checks are skipped. Native desktop horde p95 is 3.9 ms with 200 infected, 721 simulation ticks and 4,420 rendered frames over twelve seconds. Android at 4× CPU throttle and iPhone at 2× throttle pass the 30 fps median requirement. Memory round trips and initial-download checks pass. E18 verify exits 1 solely for the four triangle-counter failures. Asset validation exits 1 with the listed 262 failing records. This branch is merged and reviewable, but does not satisfy every performance/delivery gate.
