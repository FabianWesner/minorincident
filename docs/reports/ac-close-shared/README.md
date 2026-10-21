# Shared acceptance closure — E07 / E27 / E28

Base: `c867e392b`. Work remains in progress. The 2026-10-18 ledger is the starting audit, not proof of the current renderer. Epic statuses stay in progress until their complete acceptance and verification gates pass.

## Confirmed repair

Checkpoint restoration restored each special's sim timer, locked area and target, but did not replay the consumed telegraph event. The renderer therefore showed no ground warning for a restored windup. A new production-checkpoint regression reproduced this for **all 14 moves** ([before receipt](evidence/restore-before.log.txt)).

`Vfx.updateSpecialState()` now rebuilds missing special warnings from the current locked attack and its remaining fixed ticks, including paused redraws. It emits no sim event, changes no sim state, and retains the original activation deadline. Paused redraws neither duplicate nor leave the warning at zero opacity; activation removes it normally. The focused remote regression passes **30 tests in four files**, including all 14 restored warnings and the existing VFX integration/zoo marker tests ([receipt](evidence/restore-final.log.txt)).

All **14 headless Scene Lab browser probes pass**, including visible warning opacity, the tick before activation, activation, impact, a restored windup, a restored cooldown, rejection one tick before the next legal windup, and the second activation at its exact authored interval ([receipt](evidence/move-boundaries.log.txt)). The opened Alpha comparison shows the missing second-windup corridor before the paused-selection repair and the visible orange corridor afterwards ([comparison](warning-repair.jpg)). Spatial/phone proof and final framing review remain separate work.

Remote typecheck and lint pass ([receipt](evidence/static-final.log.txt)). The complete remote unit suite passes **1,860 tests / 342 files**, with nine skipped tests / one skipped file ([receipt](evidence/units.log.txt), [lossless JSON](evidence/unit.json.gz), [summary](evidence/unit-summary.json)). [Runtime source hashes](evidence/runtime-source.json).

## First complete E27 verifier attempt

`E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600 E2E_PORT=4051 SCENE_PORT=4052 MI_VERIFY_REMOTE_SIM=1 npm run verify -- E27` exited **1**. Typecheck, lint, build and **37 selected Node tests** passed; **39 browser tests passed / two failed**. The verifier stops on the browser failure, so its quiet perf stage did not run. This attempt built the base renderer before the restore repair and does not certify the later renderer change. [Command receipt](evidence/verify-E27.log.txt), [stage checks](evidence/verify-E27-checks.json), [browser result](evidence/verify-E27-browser.json).

- AC11: the fire-column hue/brightness assertions passed (lower 15.80°, lower/top luminance 2.62×), but the beacon patch at world `(0,3,0)` contains zero background-subtracted smoke pixels. The opened full/background images show a low cloud around the police car; its placement must be reconciled with the fixed sampling point before claiming strobe evidence.
- AC12: the opened night image shows the courier blending into the gray smoke. Mean player/ring contrast is **1.0134:1**, below **2:1**; measured smoke coverage **29.99%** is within the unchanged 40% cap. This is an acceptance failure, not a passing silhouette review.

### Smoke repairs and focused recheck

The isolated survivor scenarios did not instantiate the production composite, although their palette materials write courier grade protection into scene alpha. The direct smoke-lab image therefore lost the courier's intended visible colors. These scenarios now use the same composite as gameplay. Player-ray smoke retention is 20%, leaving room for antialiasing/bloom under the existing 40% final-coverage gate; smoke away from that six-metre tube and all sim effects are unchanged. The beacon test now samples world height **2 m** in its actual low cloud; the former **3 m** point intermittently sampled air. Its >100 smoke-pixel and ≥1.15× strobe assertions are unchanged.

Both existing smoke tests pass together on the repaired source ([receipt](evidence/smoke-final.log.txt)). Lower fire smoke is **15.80°** orange and **2.62×** brighter than its top; beacon on/off smoke is **2.669×**. Night player contrast is **2.173:1**, coverage **30.58%**. [Fire readings](evidence/smoke-fire-final.json), [beacon readings](evidence/smoke-beacon-final.json), [player readings](evidence/smoke-player-final.json).

Opened the [before/after and beacon phases](smoke-repair.jpg): the repaired courier's red/teal clothing and warm face separate from the cloud; the gray billows remain visible around her. The beacon visibly lights the cloud pink in its on phase. This closes the two focused regressions; the complete final-source E27 verifier and its H review are still pending.

## Spatial controls and shared bars — E07-AC05/06/19

[Spatial before/after and solid-cover sheet](spatial.jpg), [complete actor/HP/event receipts](evidence/spatial.json.gz). Opened both seven-move halves at readable size. **28 controls pass; the literal zebra corridor control fails** as detailed below. Every pre-activation receipt asserts `inspectionGhost: false` and `god: false`. These are real Scene Lab actors, manual legal attacks and solid privacy fences, with no altered attack timers or damage.

| Move | Boundary outcome (HP) / scope |
| --- | --- |
| Alpha charge / grab-throw | Inside 100→70; outside 100→100 for each. |
| Alpha ground slam | 4 m inner/outer control: 100→75 / 100→100. |
| Alpha / gorilla roar | Radius−0.01 m receives the roar; radius+0.01 m does not. The covered target hears it, as expected for sound rather than a damaging projectile. Far radius controls are recorded numerically; they do not fit the close image. |
| Lion pounce / flank | Pounce hits 100→70 at 6 m; 20 m control remains 100 and the lunge stops within 8.001 m. Flank moves laterally >2 m without direct damage. |
| Gorilla pound / grab-throw | Inside 100→70; outside 100→100 for each. |
| Elephant charge / swipe | Charge 100→60 / outside 100; swipe 100→75 / outside 100, including the rear/arc control. |
| Zebra kick | Rear inner control 100→80; outside and front controls remain 100. |
| Zebra stampede | Two zebras each hit once: inside 100→50, nominally outside **100→50**. Literal corridor check fails; separate 0.88 m physical-contact control is untouched. |
| Flamingo dive | Inside 100→95; outside 100→100. |

Solid-cover cases pass for all damaging moves; the courier remains untouched behind the fence. The sheets show empty ground warnings before impact, inside knockdowns after the charge/swipe/kick, and the protected courier still standing behind cover. Long charge/stampede cue tails and distant roar targets extend beyond this close camera; the separate per-move timing captures cover full cue framing.

The **12-case shared-bar matrix passes**: WebGL2/WebGPU × day/night × 1600×900 high, 390×844 low and 844×390 low. [Receipt](evidence/bar-matrix.log.txt), [opened matrix](bars.jpg), [pixel/state readings](evidence/bars.json.gz). Minimum sampled pairwise fill/empty/outline contrast is **3.086:1**. Actual HP updates within one redraw; dimensions are **64×8 / 48×6**; camera anchors stay within two CSS pixels. Pristine bars stop just beyond 15 m, damaged bars remain, off-frustum/dead-by-explosion bars disappear, and same-id infection gains eligibility. Recoverable downing has an empty bar and recovery restores it. Separate occlusion and zoo scenes reset their own authored daytime lighting; the matrix's night label applies to the initial shared-bar scene, not those later fixtures.

Opened the full-size WebGPU night phone frame: the pale outline, red fill and dark empty section remain crisp above the infected, with a visible gap to its head; the healthy civilian has no bar. In the occlusion pair the building hides both the infected and bar; the rotated camera reveals both. The zoo frame shows separate lion/gorilla/flamingo bars with half fill. The dedicated Alpha and elephant/zebra/flamingo phone probes remain part of the final E07 verification; the opt-in regular-runner matrix alone is not substituted for those actual archetypes.

## Named Checklist D review — E07-AC13

Reviewed the **24** named golden-hour `horde-readability` images: 60 runners, both WebGL2/WebGPU, high/low, real zoom **0.5 / 1 / 1.5**, with a second frame adding Brute/runner warnings. [Matrix](d-horde.jpg), [state receipts](evidence/horde.json.gz). The capture runner asserts the actual backend/tier, 60 infected before the warning additions and actual camera zoom; it scales the named camera pose rather than relabeling one fixed view.

| D item | Observed result across all twelve configurations |
| --- | --- |
| Player identifiable within one second | **Pass:** red sleeves, teal backpack, ponytail and separated foreground stance locate the courier immediately at every zoom. |
| Infected/background separation and glowing eyes | **Pass:** pale hands/faces and red eye pairs remain visible against the purple road; rear silhouettes overlap as a crowd, without losing the leading threats. |
| Distinct warning shapes | **Pass:** the runner corridor and Brute ground area remain separate red outlines in the foreground; close zoom makes their distinct outlines particularly clear. |
| Pickups distinguishable from clutter | **Pass:** the bat and grenade have yellow ground rings; the nearby bin, car and bench do not. |
| VFX preserve player/warnings | **Pass for this named spot:** window/streetlight bloom remains local; neither the courier nor warning outlines disappear under it. |

## Named Checklist H review — E27-AC15

Opened both complete [high](h-high.jpg) and [low](h-low.jpg) frame sheets plus the full-size column frame. [102 final frame/state receipts](evidence/vfx.json.gz) retain actual ticks, backend/tier, entity positions, events and source-image hashes. The seven spots are medium/car/mega blast lab, night building fire, an actually thrown smoke grenade, a persistent wind column, and **production L4's `l4-collapse` objective set piece**. The lab sequences use real physics props and a persistent corpse. The original exploratory fire camera hid the source behind the house; those images are excluded from the retained proof and replaced by an unobstructed fire with the isometric camera aimed at the plume.

| H item | Observed result / evidence limit |
| --- | --- |
| Flash → fireball → shockwave → debris → smoke | **Pass:** medium f8/21/46, car f186/200/230 and mega f6/40/70 separate white flash, orange lobes, expanding pale ring, dark flying fragments and cool black plume. L4 f6/40/186 repeats that progression at the authored building. |
| Physical consequence and persistent scorch | Props move visibly; state receipts quantify medium cart **1.18 m**, cone **1.86 m**, mega cart **7.44 m**, cone **9.28 m**. Car panels detach and the raised chassis settles into a black burning wreck. Dark scorch persists at late frames. Corpse transform stays at its entity anchor; ragdoll motion needs the separate physical regression/visual review, so this subitem is **not yet signed off** solely from these sheets. |
| Volumetric noisy hot/cold gradient | **Pass:** overlapping lit lobes have bright yellow cores, orange edges, holes and shaded folds; cool dark lobes overtake them. Medium, car and mega differ visibly in scale. |
| Volumetric lit/wind-bent smoke; player silhouette | **Pass:** persistent column billows rise and bend to screen right, with holes/overlapping edges; full-size night frame shows the courier fully colored below it. Grenade f90 overlays the courier while preserving face/clothes and the red ground warning. Fire lighting is additionally quantified by the unchanged focused smoke test (2.62× lower/top luminance); the distant night sheet alone is too small to judge that ratio. |
| Car jump/parts/wreck | **Pass:** raised car/body, airborne dark panels and late flames around the charred chassis are separate stages. |
| Flicker/embers/local illumination | **Pass:** flame tongues change between night f60/90/180/600, sparks rise above them, orange light pools stay around their bases and house facade. |
| Class intensity | **Pass:** grenade cloud is local and gray; medium/car fill a few metres; mega's broad flash/fire/ring and many persistent fire pockets dominate the lab. |

Final E27 verification and the corpse subitem remain pending; no complete H signoff is inferred from these stills alone.

## Outstanding acceptance

### Proposed rewrite for E07-AC19: zebra stampede corridor

The epic's move row says **1.5 m-wide sweep**, while the current physical-contact rule also hits a human whose centre is **0.76 m** from the lane centre. A fresh remote audit records **100→50 HP** from two distinct zebras at that nominally outside point; the **0.88 m** control remains at **100 HP**. The probe explicitly records `literalCorridorControlPass: false`. [Audit receipt](evidence/corridor-audit.log.txt), [actual positions and hit events](evidence/zebra-corridor.json).

The existing `zoo-s3.test.ts` comment, introduced by **2e4df83867** on 2026-10-15, calls this a PO contact-hit decision: **0.45 m zebra radius + 0.35 m human radius + 0.02 m contact tolerance = 0.82 m**. That comment is secondary provenance; it is not represented as a recovered verbatim PO request. The current test already places its outside control at 0.88 m. This lane changes neither that test nor the contact behavior.

**Proposed wording, awaiting the user's decision:** “The stampede marks a nominal 1.5 m-wide corridor. Ordinary body contact additionally uses the sum of the zebra and human capsule radii plus 0.02 m contact tolerance (0.82 m in the standard human fixture). Each distinct zebra/attack id deals 25 HP once; a target beyond both the marked corridor and that contact boundary is unaffected.”

Reason: this reconciles the nominal ground cue with the established physical-contact behavior. Narrowing collision to the centre corridor would change the current combat behavior, contrary to this task's no-difficulty-change constraint. The literal corridor criterion is **not marked met** by a green existing test.

| Criterion | Current evidence / remaining proof |
| --- | --- |
| E07-AC05 | Restored warnings repaired; all 14 timing/restore browser probes pass. Spatial controls pass except the literal zebra corridor proposal; final timing-capture framing review remains pending. |
| E07-AC06 | Shared Alpha move proof and the desktop/phone, day/night, occlusion bar matrix remain pending. |
| E07-AC13 | Named 60-runner golden-hour Checklist D passes all five items across both tiers/backends and three actual zooms; see matrix above. |
| E07-AC19 | Zoo spatial/bar proof remains in progress. The nominal zebra-corridor wording has the proposed rewrite above; literal outside-corridor immunity is not met. |
| E27-AC15 | All seven named H spots still need explicit review. The newly found AC11/12 regressions are repaired and pass their focused browser tests; final full verification remains pending. |
| E28-AC10 | Earlier geometry-cache repair and measured storm/L5 ash proof are in [heap-budgets](../heap-budgets/README.md). Its final-source repeat was unmeasured; fresh current-source quiet acceptance remains required. |
| E28-AC12 | Six-mood Checklist G/reference review remains pending. |

No criterion, threshold, difficulty or test is weakened. No proposed rewrite is adopted. Capture media retained here: two repair comparison sheets so far (limit twelve).

## Current memory candidate (not yet accepted)

Index-only crowd LOD simplification left unreferenced vertices in live/cached geometry. `compactCrowdGeometry` now removes only those vertices after final appearance packing. An exact remote audit of **20 shipped asset/tier cases** keeps every expanded indexed attribute hash and triangle count identical; raw packed channel types/normalization and group/draw/bounds contracts have dedicated regression coverage. The first audit saves 502,368/793,440 vertex bytes across the ten high/low LOD2 model samples; this is CPU geometry accounting, **not** a browser heap result.

The larger candidate removes the prepared-cache's second CPU copy of finished vertex/index arrays. `cloneCrowdGeometry` shares immutable arrays through **independent BufferAttribute/geometry wrappers**, so scene GPU uploads/disposal, per-instance channels, bounds and metadata stay independently owned. The final audit also proves clone attribute equality, separate wrappers and shared array identity for all twenty cases. [Exact asset receipts](evidence/compact-bake-final.json), [remote static/regression receipt](evidence/compact-final2.log.txt). No animation, triangle, actor, particle or corpse is removed. A failed intermediate static check caught a typed morph-channel index; the corrected run passes. Browser heap, pixels and lifecycle acceptance are pending.

The baseline E28 verifier additionally found fog-player contrast **2.9636:1 <3:1** on the repaired composite. Its opened image has a visible but washed courier against the night road. A hue-preserving 8% dense-fog figure gain after the night key is now under test; it leaves the ground/ring and gameplay unchanged. No passing contrast result is claimed yet.

## Baseline E28 verifier

The pre-memory-change production build finishes the complete E28 functional sweep with **26 selected Node tests passing, 69 browser tests passing and one failing**: fog player contrast **2.9636:1**, below the unchanged 3:1 gate. Typecheck, lint and build pass; the browser failure stops the verifier before its performance stage. [Command receipt](evidence/verify-E28-before.log.txt), [stage receipt](evidence/verify-E28-before-checks.json), [browser result](evidence/verify-E28-before-playwright-headless.json), [measured contrast](evidence/fog-before.json). This baseline is not the final source acceptance run.

Opened both interim reference sheets authorized by `06` §7 (`initial-drafts/weather-and-time-of-day-moods.png` and `initial-drafts/explosions-fire-smoke-and-lighting-fx.png`). The weather matrix's regular wet sine bands do not match the broken wet highlights in those targets. The candidate now breaks their spacing/length using anchored world-space noise, retaining the wet mask, light-field contribution and 0.08 brightness cap. Final-source images and all seven explicit G answers remain pending; the baseline mood test's green exit is not treated as vision signoff.

## Candidate validation update

Full remote unit suite on the memory fix plus dense-fog gain passes **1,862 tests / 343 files**, with nine skipped tests / one skipped file ([receipt](evidence/units-final.log.txt)). The later wet-glint shader change and final verifier plumbing pass remote typecheck, lint, the strengthened verifier regression and production build ([receipt](evidence/final-build.log.txt)). Final browser contrast, mood, heap and lifecycle results remain pending. [Candidate source hashes](evidence/runtime-final-source.json).

E07 verification now separates functional browsers from all tagged heap/perf probes under `quiet-run.sh`, keeps each at one worker and archives both browser stage results. Its shared-bar heap probes and physical crowd-budget fixture carry the perf tag; the physical fixture is explicitly included in the quiet selection. With `MI_VERIFY_REMOTE_SIM=1`, static checks and the production build also run remotely; the build is pulled before this verifier starts its browser stages. The unchanged hero-shadow metric `T-E25-06` is cross-tagged to E28-AC12 so its actual shadow/pool pixels supplement the weather moods' G review.

## Quiet memory comparison (diagnostic viewport)

Both builds ran through `quiet-run.sh` with all browser slots held, load <3 and no other headless browser/local Vitest. The fixed **960×600** diagnostic scene uses the same storm, seed 28, 3,600 ticks, camera and three completed-frame collections on each build. It is **not substituted for the native desktop/phone acceptance fixture**. [Before](evidence/heap-before.json), [memory candidate](evidence/heap-memory.json), [build identities](evidence/memory-builds.json), [quiet receipts](evidence/heap-before.log.txt) / [candidate](evidence/heap-memory.log.txt).

| Counter (high / low) | Before | Memory candidate |
| --- | --- | --- |
| Collected CDP JS heap, decimal MB | 114.45 / 113.95 | 114.43 / 113.92 |
| Collected backing stores, decimal MB | 406.70 / 395.93 | 385.76 / 373.35 |
| Legacy `performance.memory`, MiB | 497.33 / 486.58 | 477.36 / 465.02 |
| Live scene geometry arrays, decimal MB | 37.60 / 28.20 | 32.66 / 21.65 |

The real backing-store reduction is **20.94 / 22.58 MB**; it is not presented as hundreds of MB of JS-heap savings. Exact unmasked RGB comparison is **zero changed pixels on both tiers**, at the same 960×600 size ([counts](evidence/heap-pixels.json), [remote receipt](evidence/corpse-audit2.log.txt)). The intermediate transfer attempt omitted ignored inputs; its failure is retained and replaced by the successful staged-input comparison. The memory-only build predates the wet-glint shader change. The legacy counter remains high in this diagnostic; actual native acceptance heap readings and the measurement-contract decision remain open.

## Corpse-motion repair and fixture corrections

Checklist H revealed a real omission: `Explosions.queueImpulses` launched props, debris and cars, but ignored retained corpse records. Static instancing in E07-AC14 is **not** a prohibition on motion; the earlier question conflated that requirement with an implementation comment. No H rewrite is proposed on that basis.

Retained infected bodies now receive the same radial/upward falloff, starting one tick later, through a plain fixed-step cosmetic flight component. Their existing thrown-pose path moves the frozen instances, then leaves them at their actual landing location. No collider, contact damage, brain, HP change or corpse removal is introduced. Full cover and the death-pose feet/head footprint stop flights at walls; explicit Alpha/gorilla throws take over ownership. Relative delay/velocity survive real mission checkpoints. Frozen pages update bounds once per moving page, and compare stored float32 translations exactly so settled bodies stop uploading.

Remote typecheck/lint and **71 tests / five files pass** ([receipt](evidence/corpse-alpha-final.log.txt)), including four blast classes' exact first-tick curve, no added rigid bodies/HP damage, identity/permanence, pending/midair checkpoint restoration, cover/radius/zero-impulse controls, original E27 blast tests, Alpha/zoo behavior and the page upload regression. The initial new checkpoint fixture had empty objective text; correcting it exposed no runtime restore defect. Fresh H images and final full verifiers remain pending.

The first E07 verifier passes its **five isolated timing tests** and **372 selected Node tests**, but fails one ordinary Alpha/soldier contact fixture and stops before browsers ([receipt](evidence/verify-E07-first.log.txt), [stages](evidence/verify-E07-first-checks.json), [selected tests](evidence/verify-E07-first-vitest.json.gz)). The kick in that fixture correctly provokes the courier for 720 ticks, overriding the manually assigned soldier noise target; the audit records no Alpha/soldier attack ([actor/target audit](evidence/alpha-contact-before.json.gz)). The corrected fixture keeps the original kick assertions plus a retaliation-target assertion, then uses a separate unprovoked Alpha and a held, non-firing soldier for the unchanged 25 damage / 72-tick knockdown / cooldown / second-hit checks. Runtime targeting and difficulty are unchanged; it passes in the 71-test batch above.

The repaired fog probe passes **3.0349:1** with the same 7,585 player-mask pixels ([reading](evidence/fog-final.json)). The added G hero-shadow probe initially samples **promotionBlend=0** and no usable cast shadow ([before](evidence/hero-shadow-before.json), [receipt](evidence/fog-shadow-final.log.txt)). Its bulk `step(90)` promoted the new lamp only on the final redraw. The probe now submits each intermediate fixed-tick view, as gameplay does, and additionally requires promotion blend **1** before applying the unchanged darkening/hue thresholds. This corrected probe is running with the refreshed captures.

The corrected full remote unit repeat passes **1,865 tests / 343 files**, seven skipped tests / one skipped file ([receipt](evidence/units-corpses-final2.log.txt)). The runner had the optional audio prerequisites, so two former audio skips ran; the new page-update test adds one case. Its first transfer attempt lost a file that was compressed during rsync; the fresh repeat completed normally. No test or skip was added to conceal a failure.

The refreshed 14 move probes pass again in 2.6 minutes, and the correctly settled hero-shadow probe passes at **85.88% darkening**, hue **254.7°**, promotion blend **1** ([capture/test receipt](evidence/captures-final.log.txt), [shadow reading](evidence/hero-shadow-final.json)). The car corpse fixture is placed at `(2.5,2.5)` outside the hull's solid footprint: its original `(1,2)` footprint overlapped the car and correctly blocked motion through the hull. The final receipt shows it rise and land at approximately `(3.82,0.7,3.87)` with its original id ([car receipt](evidence/car-final.log.txt)). One high-tier late grenade frame was flat/blank and is excluded from signoff pending a pinned-production repeat; a source comment was edited during the dev capture, so that overlap is recorded as a possible cause rather than a proved renderer defect.

The first final E28 attempt was interrupted while its remote build was unnecessarily holding/waiting for a GPU reservation ([receipt](evidence/verify-E28-build-wait.log.txt)). Remote builds now use no browser slot; their artifact pull precedes this verifier's browsers. Local browser and quiet/perf reservations are unchanged, and the complete verifier restarts from its static checks rather than skipping any gate.

## Final-source Checklist G review — 2026-10-22

This review supersedes the earlier AC12 failure above. I opened the fresh **24 six-mood frames** (WebGL2/WebGPU × high/low), the full-size storm and facade frames, and the settled hero-shadow frame. Retained matrix: `docs/reports/ac-close-shared/g-moods.jpg`. References opened: `initial-drafts/weather-and-time-of-day-moods.png` and `initial-drafts/explosions-fire-smoke-and-lighting-fx.png`; `06` §7 permits these interim references while dedicated lighting keyframes are absent.

| Priority | G item | Observed result |
| --- | --- | --- |
| must | Emissive glow and visible pools/spill | PASS — yellow windows, headlamps and streetlamp bloom; orange pools brighten nearby pavement and facade. |
| must | Geometry / hero shadows | PASS — wall-facing window spill remains on the outside pavement; settled lamp casts separate courier, infected and prop shadows. The unchanged hero probe measures 85.88% darkening after promotion blend reaches 1. |
| must | Colored, appropriate shadows | PASS — blue/purple shadows, long and crisp in haze, broader and subdued under overcast; hero shadow hue 254.7°, no black cutout. |
| must | Night readability | PASS — courier cap, orange clothing and limbs remain distinct; gray/green infected silhouette and limbs separate from the dark blue street in storm, fog and snow. Dense-fog player contrast is 3.0349:1 over the unchanged 7,585-pixel mask. |
| should | Beams / haze / glints | PASS — amber shafts cross the haze scene and window spill lights the storm haze; fog softens the distance without hiding the courier. The lightning frame is bright but characters and house remain legible. |
| should | Reflections | PASS — storm pavement carries irregular, broken warm highlights under windows and lamp, with dark gaps; car paint/glass retain specular separation. Dry clear/overcast pavement has no wet streaks. |
| should | Script mood | PASS — clear is cool and crisp; overcast softer/dimmer; haze amber with long purple shadows; storm dark blue with rain/warm practicals; fog blue with softened distance; snow cold night with flakes and gray coated upper surfaces. |

**AC12 met: 4/4 must and 3/3 should.** All six moods are checked against the authorized reference, across both tiers/backends. These fixed scene reviews do not substitute for native storm/L5 performance evidence. Current verifier: all 71 functional browsers pass; performance stage is still pending.
