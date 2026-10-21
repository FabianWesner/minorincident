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
| E07-AC05 | Restored warnings repaired; all 14 timing/restore browser probes pass. Spatial controls and final capture review remain pending. |
| E07-AC06 | Shared Alpha move proof and the desktop/phone, day/night, occlusion bar matrix remain pending. |
| E07-AC13 | Named 60-runner golden-hour Checklist D passes all five items across both tiers/backends and three actual zooms; see matrix above. |
| E07-AC19 | Zoo spatial/bar proof remains in progress. The nominal zebra-corridor wording has the proposed rewrite above; literal outside-corridor immunity is not met. |
| E27-AC15 | All seven named H spots still need explicit review. The newly found AC11/12 regressions are repaired and pass their focused browser tests; final full verification remains pending. |
| E28-AC10 | Earlier geometry-cache repair and measured storm/L5 ash proof are in [heap-budgets](../heap-budgets/README.md). Its final-source repeat was unmeasured; fresh current-source quiet acceptance remains required. |
| E28-AC12 | Six-mood Checklist G/reference review remains pending. |

No criterion, threshold, difficulty or test is weakened. No proposed rewrite is adopted. Capture media retained here: two repair comparison sheets so far (limit twelve).
