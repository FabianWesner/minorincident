# p1-l3ramp — invisible L3 on-ramp

Baseline: `cab3405c`. Branch: `lane/p1-l3ramp`. Main `f691bf05` merged at `2c27c397`; final checked source `3549e844` (full unit gate `df7448aa`, identical runtime/tests). No specs changes, push, or deployment.

## Cause and repair

**`fd0ad256` introduced the regression when it rebuilt the on-ramp LODs.** The new LODs preserve lantern meshes under `lampHead1`–`lampHead3`. Those nodes carry descriptive metadata `extras.pivot: "lamp center"`. Three's GLTFLoader treats `pivot` as a numeric transform, reads characters as coordinates, and produces NaN lantern transforms. These poison the complete ramp's bounding box and culling sphere. Both ramps disappear while their physical road and rails remain active.

This explains the misleading initial result: native centreline traversal passed, including restoration, while the PO and browser captures showed clear-looking ground where the solid rails actually stand. At the reported `(159.34, -1.32, y 5.69)` pose, the baseline submits **zero ramp instances**. After repair it submits **two LOD2 instances / 28,042 triangles**, with the S-curve and rails visible.

- Rename the descriptive metadata to `pivot_note` in the authoring script and all six source/shipped GLBs. **All binary geometry chunks and all other glTF JSON values are unchanged.** Refresh the collider provenance hash; its collision boxes are unchanged.
- Retain a regression in the existing render-contract case: load all three shipped LODs with the production Three loader, check every mesh world transform, then check the production static batch's culling bounds are finite.
- The comparison identifies the asset change directly: both LODs are finite at `fd0ad256^` and invalid at `fd0ad256`. [Comparison](render-bisect.json) · [Exact model changes](model-repair.json) · [Baseline culling](render-before.json) · [Repaired pose](render-after.json).

## Restore and contact coverage

The pooled headless WebGL2 run reaches a genuine seed-1 `segment-3b` snapshot through the native skilled policy. It stops the bot and walks the complete ramp with production WASD, using the carried axe through Digit3 and the left mouse button only when a living infected intercepts. Bodies and props are crossed using movement alone. **Death/respawn and Restart level followed by the mission Retry button pass on both low and high**, arriving on the visible deck at y **6.42**, with live infected, downed bodies, police and the corgi retained. Restart level reloads L3's beginning; death and Retry restore the checkpoint. [Four browser runs](browser-receipt.json) · [Native death/retry restores](native-restores.json).

Final local captures: `test-results/qa/l3-ramp-final/l3-ramp-top-{low,high}.png`. The report directory retains ignored local copies. `l3-ramp-visual.ts` separately poses the courier at the reported coordinates to diagnose rendering; that positioning is **not** movement proof. Automated browser verification uses WebGL2/Metal per repository policy; GLTF parsing and the repaired transforms are shared with WebGPU.

The requested obstacle investigation also found a separate physical obstruction: a light cone wedges against the ramp's fine steps because the capsule's lower cap pushes it downward. Give touching light props the existing horizontal push impulse, retaining full courier speed. A 3D contact check excludes props on the road below a deck. The same restored fixture changes from indefinitely blocked at x **143.28** to arrival at the ramp top. This secondary repair is not attributed to the PO screenshot. [Before/after](prop-before-after.json).

All fourteen native restored obstacle runs pass (seven cases on both qualities): downed infected, permanent corpses, followers, props, debris, a live crowd, and waiting at the reported bend. [Obstacle receipts](native-obstacles.json).

A repeated high Retry investigation found a test-driver error: a live runner held the unarmed courier until death at tick **13112**; after respawn at x **94**, the script retained its old x **160.3** waypoint and walked toward the ramp from below. The trace records death and checkpoint teleport, with the courier supported on the ramp until death. The driver now detects death and defends live interceptors through normal controls. No simulation change was made for this anomaly. [Trace excerpts](browser-driver-diagnostic.json) · [Initial attempt](browser-initial-merged.json).

The existing movement regression additionally crosses ten cones, ten downed infected, ten permanently killed infected and destruction debris placed at the lips and bends, on low/high. It checks arrival and that walking above a cone cannot push it on the street below.

## Authored route scope

Production movement covers both L3 on-ramps from before their entry lips at walking/running pace, recovery from the reported pose, L5 metro ingress, the separate L6 exit stairs/escalator, L7's raised Northgate road and L10's dispersal-platform stairs, on both quality settings. The user's follow-up explicitly leaves decorative/sealed flights non-climbable. L1 porch dressing, the solid cellar stair block and sealed station approaches retain their authored collision. L9's driving jumps are vehicle routes. [Inventory](authored-slope-candidates.json).

## Validation

- Typecheck and lint: passed after merging main. [Final E21 receipt](final-checks.json).
- Selected asset validation: all three LODs pass, zero errors. [Receipt](asset-validation.json).
- Browser: all four production restore/UI ascents pass **together after merging main**, with no traversal deaths and no console errors. Each final trace retains HP and live-blocker evidence; the axe is used only for intercepting live infected. Low/high top captures visually reviewed: the courier stands on the visible ramp and both rails read clearly.
- Requested remote `qa:threat --levels L3`: after merging main, skilled L3 completes in **230.38 simulated seconds**. The command exits **1** for `L3-06 squad counts/losses`, `L3-11 native competent rate`, and partial-level selection. A controlled run with main's original PropSystem produces the **identical native state hash `1cf74210`**, completion time, army results and flags. The ramp repair does not cause those failures. Preserve main's merged ordinary-zombie rules. [Current receipt](threat-current.json) · [Controlled comparison](threat-main-comparison.json).
- Full unit/E21 validation: **passed**, 27 files / **106 tests passed, 1 existing skip**, on the isolated runner with two workers. The mixed slope/contact regression passes in **25.1 s**. Earlier runs exceeded its 30-second limit; the fixture now disables ambient population maintenance that `setQuality` had unintentionally enabled. No route or contact assertion is removed, and the registered-case budget remains 150/150. The private runner receives authentic source HEAD commit/tree objects and matching runtime blobs so provenance tests work. [Receipt](final-checks.json).

Earlier `unit.json`, `validation.json`, `epic-checks.json` and `threat-receipt.json` document the previous geometry-only investigation. They are superseded by `final-checks.json`, the final `browser-receipt.json`, `native-obstacles.json` and `threat-current.json`.
