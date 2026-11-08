# R13 — generic world destruction

## Delivered

- L3: two Oak Street timber houses and two parked sedans opt in; other L3 buildings and cars are protected.
- Placement-owned part HP and five materials; weapon-specific bullets, pellets, axes, sustained MG fire, explosive breaches and incendiary damage.
- First-hit instance extraction, clipped parts, bounded impact/scorch marks, detached debris, roof collapse and burned-car variant.
- Same-tick structural collider/nav/LOS updates; shared r12 movable bodies; fixed-tick fire, chain explosions and vehicle impulses.
- Checkpoint/tier restoration and deterministic state hashes include damage and fire state.
- Boss extension: pillar, machinery and fuel-tank policies; gorilla smash and Mega charge entry point. Arena placement/move wiring belongs to the boss lane.

Architecture and extension instructions: [destruction design](../../design/destruction.md).

## Verification

Code-check source: `a0f76924`, with main `a7b70c78` merged in `5628370e`.

- Hetzner: typecheck and lint pass; unit suite **106 passed, 1 skipped, 27 files**, 176.7 s within 240 s. The skip is the macOS-only legacy browser-lock test. [Compact checks](checks.json).
- Case budget: **150/150**, files **43/45**. No browser launched.
- Threat diagnostics below used `cd84315b`, before the subsequent lifecycle fixes. They are not final-source full-gate evidence.
- [L1–L3 threat receipt](threat-1.json): L1/L2 have zero gameplay flags. L3 has the existing competent-survival-rate flag. [Exact merged-main L3 comparison](main-l3.json) reproduces that flag plus a density flag; there are **zero new L3 audit flags**. The comparison reverses the branch's complete `src/` diff in a private remote job; `public/` is unchanged.
- [L5 threat receipt](threat-3.json): zero gameplay flags across the skilled/passive multi-seed checks.
- **Full threat gate unresolved:** the full command timed out at 600.2 s before producing a receipt. Smaller L4/L6/L8 and L7/L9/L10 batches also timed out (601.2 s and 600.9 s), waiting on the L8 and L10 skilled stages. Completed stages are not claimed as complete level verdicts. Their temporary output paths collided with a completed batch, so both mismatched receipts were discarded. Future retries must use job-relative output paths.
- Partial-selection markers remain in the retained diagnostic receipts. These are not a passing full gate. No zero-new-flags claim is made for the entire campaign.

Commands used the prescribed `sh tools/remote/run.sh "$PWD" -- ...` wrapper with `MI_LOCAL_FALLBACK=0`. The temporary remote Git snapshot enabled tests requiring `HEAD`; no local build or worktree was created.

Follow-up lifecycle fixes release destroyed movable fixture bodies, invalidate cached LOS after blocker changes, and suspend absent-tier objects and their owned fires while preserving saved damage.

Existing world-system tests cover real handgun, shotgun, axe and MG input; blocked shots; rocket collapse and nav openings; protected geometry; checkpoint replay; moving-car fire expiry; pool lifetime; tier replacement; rendered-part restoration; boss impacts, one-shot fuel detonation, movable-body restoration and tier-driven object/fire suspension. No test cases added beyond the existing budget.

## Timeout investigation

A bounded native-route comparison at `5fbd7b2f` versus merged main `a7b70c78` produced identical reports for L8 and L10 over 180 simulated seconds ([comparison receipt](route-comparison.json)). Both reproduce L8's escape stall. This establishes equivalence only for that measured window; it does not prove a complete route or full threat pass. The remaining gate needs the upstream route/performance issue resolved or runner conditions that allow the prescribed audit to finish. Limits were not raised.

## Browser QA needed

Per the post-crash instruction, no browsers were launched. These checks remain unverified:

1. Run `npm run scene:gate` on the approved browser runner.
2. Run `SCENE_PORT=4833 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/destruction.ts`; inspect its single contact sheet and gameplay assertions.
3. Inspect L3 glass/door holes, roof collapse, car burn/wreck, debris and impacts on low/high tiers; confirm neighbouring static instances remain intact.
4. Check extracted geometry/materials, camera occlusion, moving wreck alignment, performance and checkpoint appearance in WebGL2; WebGPU remains manual QA.

No capture or visual pass is claimed. The model uses discrete parts; parked-car hull collision remains with its wreck. The carried flamethrower and L8/L10 boss move state machines are outside this lane; their destruction entry points are supported.

## Status and handoff

Implementation is complete and unit-verified. The brief's full threat-gate requirement remains blocked by the timed-out runs; it needs a successful runner audit before the entire brief can be marked complete. Browser QA is deliberately deferred under the latest instruction. No deploy or push.

Commits since restart: `5628370e` (merge main/shared prop ownership), `cd84315b` (boss policies and impact hook). Follow-up commits `467ca896`, `5fbd7b2f`, `6dac81e3`, `d550a07c`, and `a0f76924` cover movable-body lifecycle, LOS invalidation, absent-tier ownership and fire resumption/caps. Earlier commits on this branch contain the L3 sim/render integration and regression coverage.
