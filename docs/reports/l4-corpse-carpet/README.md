# L4 corpse field (Q-166)

The orchestrator's revised acceptance limits are contact ≥60%, ≤150 bodies within 14 m at 150 s, and an in-wall mean ≥6 from minute 1. Corpses remain for the whole level.

## Simulation evidence

| Measurement, seed 3 / low | Batch 13m | Candidate |
| --- | ---: | ---: |
| Corpses within 14 m, 20 / 60 / 150 s (stationary PO view) | 26 / 94 / 243 | 9 / 37 / 144 total (143 infected) |
| Courier contact during the complete-route hold | — | 121 / 191 samples, 63.35% |
| In-wall means, minutes 1 / 2 / partial 3 | — | 6.38 / 8.68 / 6.18 |
| Corpses within 14 m, complete route, 20 / 60 / 150 s | — | 9 / 44 / 49 |
| Soldiers alive 90 s after fallback, seed 2 / high | 14 | Pending final remote collapse receipt |

[Hold summary](hold-summary.json) and [per-second census](hold-census.json) retain the measured route. Contact means at least one active, non-emerging infected within 12 m; in-wall means use the authored perimeter. Minute 3 contains the final 11 hold samples. All three in-wall means are unchanged when emerging actors are excluded. The stationary capture is a separate stress case and is not substituted for the route's contact measurement.

## Changes

- The opening alarm empties the tents once. Subsequent pressure arrives through several outside approaches and opened breaches. Cohorts fan toward the courier's side instead of repeatedly dying at a tent door.
- Reused infected clear their old emergence and door-lane state. Previously, pooled actors could remain immobile while consuming the live population budget.
- Supplemental pressure respects a concentrated corpse field while retaining pending demand and ordinary street waves. At a saturated stationary hold, half of street cohorts approach surviving defenders on the outer flanks; the others keep pressure on the courier. Deaths spread through the entry points without removing bodies. The authored low/high live caps and soldier combat statistics remain intact.
- Collapsing lines open the actual perimeter. Retreat cohorts retain the complete authored quota when the live cap is full, and later waves choose eligible mouths near the surviving army. Pursuers follow moving defenders at their authored chase speed. Excess high-tier pursuers leave over-covered defender pockets for nearby under-covered defenders while coherent cohorts retain their assignments; this fixes pressure concentrating on three western survivors while the other lines have no attackers.
- Collapse pockets retain all authored attackers across failed cap admissions and checkpoints, reserving their existing quota until it joins the fight. Previously the pocket was marked complete before admission, moving its soldiers but silently dropping their attackers. Soldier stats and the live cap are unchanged.
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

The census reader now fetches the courier once from its existing entity snapshot, avoiding repeated whole-world snapshots per corpse. Quiet admission now recognizes relative-path Vitest and typecheck commands, with regression coverage. Invariants use the orchestrator-authorized non-quiet admission mode (`QA_INVARIANTS_NO_QUIET=1`); every simulation and browser assertion remains active; these are correctness checks, not timing acceptance.

## Final gates

- `npm run typecheck` and `npm run lint`: passed.
- Smoke: 6 simulation checks and 31 browser checks passed, using one browser worker. [Receipt](smoke.json).
- L4 low / zoom 1.5 real-input bot, `--no-skip`: finished, **0 deaths**, no skipped objectives, 291 s wall time. It used four navigation assists and reported one transient P2 navigation stall at the start of the escape before reaching the cellar. These assists steer through physical controls; they do not teleport or complete objectives. [Receipt](bot.json).
- Fresh PO WebGPU captures at zoom 1 and 1.5: passed, 144 total bodies (143 infected) within 14 m at 150 s, no missing living figures, no sunk pairs, no repeated intersecting poses/yaw, offset ≤1 m and courier clearance true.
- Focused high collapse case: local pass, **8 survivors** 90 s after fallback, unchanged `<10` / less than half of the initial army assertions. Remote confirmation and the full remote unit + levels and invariants receipts are pending.
- Native timing is deferred to the orchestrator as described above.
