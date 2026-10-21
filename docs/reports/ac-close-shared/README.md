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

## Outstanding acceptance

| Criterion | Current evidence / remaining proof |
| --- | --- |
| E07-AC05 | Restored warnings repaired; all 14 timing/restore browser probes pass. Spatial controls and final capture review remain pending. |
| E07-AC06 | Shared Alpha move proof and the desktop/phone, day/night, occlusion bar matrix remain pending. |
| E07-AC13 | Named 60-runner golden-hour spot still needs the refreshed Checklist D review across both tiers/backends and zoom limits. |
| E07-AC19 | Ten zoo move captures and the shared bar matrix remain pending. |
| E27-AC15 | All seven named H spots still need explicit review. The newly found AC11/12 regressions are repaired and pass their focused browser tests; final full verification remains pending. |
| E28-AC10 | Earlier geometry-cache repair and measured storm/L5 ash proof are in [heap-budgets](../heap-budgets/README.md). Its final-source repeat was unmeasured; fresh current-source quiet acceptance remains required. |
| E28-AC12 | Six-mood Checklist G/reference review remains pending. |

No criterion, threshold, difficulty or test is weakened. No proposed rewrite is adopted. Capture media retained here: two repair comparison sheets so far (limit twelve).
