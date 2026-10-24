# L4 corpse field (Q-166)

The orchestrator's revised acceptance limits are contact ≥60%, ≤150 bodies within 14 m at 150 s, and an in-wall mean ≥6 from minute 1. Corpses remain for the whole level.

## Simulation evidence

| Measurement, seed 3 / low | Batch 13m | Candidate |
| --- | ---: | ---: |
| Corpses within 14 m, 20 / 60 / 150 s (stationary PO view) | 26 / 94 / 243 | 9 / 37 / 144 total (143 infected) |
| Courier contact during the complete-route hold | — | 121 / 191 samples, 63.35% |
| In-wall means, minutes 1 / 2 / partial 3 | — | 6.38 / 8.68 / 6.18 |
| Corpses within 14 m, complete route, 20 / 60 / 150 s | — | 9 / 44 / 49 |
| Soldiers alive 90 s after fallback, seed 2 / high | 14 | 7 (Linux) |

[Hold summary](hold-summary.json) and [per-second census](hold-census.json) retain the measured route. Contact means at least one active, non-emerging infected within 12 m; in-wall means use the authored perimeter. Minute 3 contains the final 11 hold samples. All three in-wall means are unchanged when emerging actors are excluded. The stationary capture is a separate stress case and is not substituted for the route's contact measurement.

## Changes

- The opening alarm empties the tents once. Subsequent pressure arrives through several outside approaches and opened breaches. Cohorts fan toward the courier's side instead of repeatedly dying at a tent door.
- Reused infected clear their old emergence and door-lane state. Previously, pooled actors could remain immobile while consuming the live population budget.
- Supplemental pressure respects a concentrated corpse field while retaining pending demand and ordinary street waves. At a saturated stationary hold, half of street cohorts approach surviving defenders on the outer flanks; the others keep pressure on the courier. Deaths spread through the entry points without removing bodies. The authored low/high live caps and soldier combat statistics remain intact.
- Collapsing lines open the actual perimeter. Retreat cohorts retain the complete authored quota when the live cap is full, and later waves choose eligible mouths near the surviving army. Pursuers follow moving defenders at their authored chase speed. Excess high-tier pursuers leave over-covered defender pockets for nearby under-covered defenders while coherent cohorts retain their assignments; this fixes pressure concentrating on three western survivors while the other lines have no attackers.
- Collapse pockets retain all authored attackers across failed cap admissions and checkpoints, reserving their existing quota until it joins the fight. Previously the pocket was marked complete before admission, moving its soldiers but silently dropping their attackers. Soldier stats and the live cap are unchanged.
- L4 high civilian grabs now check contact reached during steering as well as before it, at the same reach and with the same sight check. Separation otherwise pushed the runner back to the boundary before the following tick, allowing a moving soldier to stay just outside the pre-movement grab check. Soldier stats and bite reach are unchanged. The approved low-tier admission and contact behavior are retained.
- Native and pedestrian-look infected share one corpse footprint layout. Back, side and crumple poses have deterministic varied yaw. Retained frozen matrices move when necessary to keep the courier's feet clear; corpses have no movement collider.
- Retained hats and other accessories keep their own fitted geometry and identity. Bodies without accessory geometry may share a page by their hair mask. L4 world-space identity roots and corpse pages skip repeated world-matrix composition; their instance transforms retain the audited placement. Empty or fully culled corpse pages skip render-list submission and become visible again when occupied and in view. Prewarming still includes hidden pages.
- Frozen bodies are darker and desaturated after palette resolution. Their emissive eye flags are removed. Full heads and hats remain; hats receive the same darkening and desaturation as the body. The original headwear identity fixtures are unchanged.

## PO captures

[Zoom 1](captures/150s-z1.png) and [zoom 1.5](captures/150s-z1.5.png) use WebGPU, low, seed 3, 1280×720, DPR 1. The [120-second zoom 1.5 view](captures/120s-z1.5.png) shows eight drawn living infected beside the layered dead. Standing figures retain brighter clothing and upright silhouettes; settled bodies form a muted gray field with varied directions and poses. The courier beside the dog has a clear footprint and visible legs. At both zooms, the 150-second view shows varied muted bodies and hats in a dense western heap, with floor gaps toward the courier and eastern fighters. The gray heaps remain visually distinct from standing figures with brighter clothing. The heap audit covers 256 retained bodies across the level. Footprint overlaps are permitted by the revised decision; sinking, repeated intersecting pose/yaw, and shuffle beyond 1 m fail the capture gate. The western heap remains dense and reaches 2.64 m; living figures retain brighter clothing and upright silhouettes beside it.

Capture generation checks the actual WebGPU backend, low tier, drawn living figures, bounded shuffle and distinct heap layers and courier clearance. See [receipt](captures/receipt.json). Renderer capsule spacing and courtyard movement have dedicated unit coverage; the permanence smoke still requires all twenty killed actors retained and drawn after a 60 m walk away and back, with the original camera and all original visibility assertions.

### Approved bounded heap audit

The orchestrator rejected the earlier 18.3 m redistribution and approved **at most 1.0 m** of final shuffle, with overlapping footprints allowed to form a raised heap. The current audit is explicitly **no corpse sunk into another + offset ≤1.0 m**, rather than the earlier zero-footprint-overlap rule. Intersecting footprints occupy distinct 0.22 m layers (0.32 m for large prone bodies) and use different death poses or visibly different yaw. The solver fills the lowest available layer rather than building an ever-rising chain. Frozen matrices retain the same audited height and yaw. The stationary courier is fully visible; walking rechecks her footprint and corpses never become movement colliders.

## Combat smoke hash

The combat smoke pin changes from `3b991b78` to `4e40db7a` solely for Q-161's intended empty-trigger fallback. As a control, temporarily disabling only that fallback in `Combat.update` reproduced the original passing `3b991b78`; restoring it reproduced `4e40db7a`. Combat source was restored, and the fixture documents this reason.

## Timing deferred to the orchestrator

Per the final orchestrator decision, native Mac and phone acceptance measurements move to a separately scheduled quiet window. This change does not claim a final performance pass. The last phone sample was **63.9 ms p95** and was contaminated by simultaneous local Vitest (~243% CPU) and typecheck (~148% CPU) processes. Previous phone iterations measured 34.2 / 34.3 ms and 39.8 / 46.6 ms. The last completed Mac pair was **7.2 / 7.3 ms**, on an earlier layout; it is historical and does not verify the final build. No queued or aborted Mac run is reported as a result. Acceptance budgets remain Mac ≤11 ms and phone proxy ≤33.9 ms.

The hold census uses the complete route with God mode; the independent real-input run uses ordinary health. The census reader now fetches the courier once from its existing entity snapshot, avoiding repeated whole-world snapshots per corpse. Quiet admission now recognizes relative-path Vitest and typecheck commands, with regression coverage. Invariants use the orchestrator-authorized non-quiet admission mode (`QA_INVARIANTS_NO_QUIET=1`); every simulation and browser assertion remains active; these are correctness checks, not timing acceptance.

## Final gates

- `npm run typecheck` and `npm run lint`: passed.
- Smoke: 6 simulation checks and 31 browser checks passed, using one browser worker. [Receipt](smoke.json).
- L4 low / zoom 1.5 real-input bot, `--no-skip`: finished, **0 deaths**, no skipped objectives, **0 issues**, 255 s wall time. It used 1 navigation assist through physical controls. [Receipt](bot.json).
- Fresh PO WebGPU captures at zoom 1 and 1.5: passed, 144 total bodies (143 infected) within 14 m at 150 s, no missing living figures, no sunk pairs, no repeated intersecting poses/yaw, offset ≤1 m and courier clearance true.
- Final invariants: **28 Linux simulation checks + 12 Mac WebGPU browser checks passed**. The same-revision successful simulation receipt is resumed with source-cleanliness checks; the build requests one slot after this worktree's other browser readers have closed. Every browser assertion remains active. [Run receipt](invariants.json), [simulation cases](invariants-sim.json).
- L4 collapse suite: **all 5 Linux cases passed**. The high-tier audit records **7 survivors from 20**, 90 s after fallback, unchanged `<10` / less than half assertions. Seven first-line soldiers physically reach fallback. [Receipt](collapse-linux.json). The full remote unit + levels run and targeted timeout retries leave one unresolved simulation time-band assertion; see [receipt](remote.json) and the section below.
- Native timing is deferred to the orchestrator as described above.

## Full remote gate: one criterion decision remains

The exact full unit + levels command completed across **486 files: 2,619 passed, 5 failed, 9 existing skips**. Four failures were confirmed timeout errors: asset validation (300 s limit), L9 navigation equivalence (120 s), static typecheck/lint/build (180 s) and the L7 audit (300 s). All four then passed with **one worker on a separate runner**, with their assertions and timeouts unchanged: 164.45 / 64.84 / 96.45 / 162.14 seconds respectively. The combined case coverage is **2,623 passed, 1 failed, 9 skipped**. This is a full run plus targeted retries, not a claim of a single successful full invocation. [Remote receipt](remote.json).

The remaining L4 simulation-bot assertion is solely the lower time bound: the seed 3 high complete route finished in **254.53 s with 0 deaths**, below the existing **260 s** minimum in the 260–460 s band. Its [simulation receipt](bot-sim.json) records all completed objectives, ride 30.48 s, peak 108 infected and 145 characters. The independent final low real-input run finished in 255 s with 0 deaths. Epic 22 §8 calls time bands provisional and forbids padding. The proposed correction is a 250–460 s band (4:10–7:40), retaining all death, completion, convoy and population limits; **neither the criterion nor its fixture has been changed without the orchestrator's decision**. The source and all completed gameplay evidence remain unchanged. The full remote gate is **not green** until that decision is resolved and the affected case passes.
