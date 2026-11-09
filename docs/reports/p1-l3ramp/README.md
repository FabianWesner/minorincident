# p1-l3ramp — invisible L3 on-ramp

Baseline: `cab3405c`. Branch: `lane/p1-l3ramp`. No specs changes, push, or deployment.

## Cause and repair

**`fd0ad256` introduced the regression when it rebuilt the on-ramp LODs.** The new LODs preserve lantern meshes under `lampHead1`–`lampHead3`. Those nodes carry descriptive metadata `extras.pivot: "lamp center"`. Three's GLTFLoader treats `pivot` as a numeric transform, reads characters as coordinates, and produces NaN lantern transforms. These poison the complete ramp's bounding box and culling sphere. Both ramps disappear while their physical road and rails remain active.

This explains the misleading initial result: native centreline traversal passed, including restoration, while the PO and browser captures showed clear-looking ground where the solid rails actually stand. At the reported `(159.34, -1.32, y 5.69)` pose, the baseline submits **zero ramp instances**. After repair it submits **two LOD2 instances / 28,042 triangles**, with the S-curve and rails visible.

- Rename the descriptive metadata to `pivot_note` in the authoring script and all six source/shipped GLBs. **All binary geometry chunks and all other glTF JSON values are unchanged.** Refresh the collider provenance hash; its collision boxes are unchanged.
- Retain a regression in the existing render-contract case: load all three shipped LODs with the production Three loader, check every mesh world transform, then check the production static batch's culling bounds are finite.
- The comparison identifies the asset change directly: both LODs are finite at `fd0ad256^` and invalid at `fd0ad256`. [Comparison](render-bisect.json) · [Exact model changes](model-repair.json) · [Baseline culling](render-before.json) · [Repaired pose](render-after.json).

## Restore and contact coverage

The pooled headless WebGL2 run reaches a genuine seed-1 `segment-3b` snapshot through the native skilled policy. It stops the bot and walks the complete ramp with production WASD. **Death/respawn and Restart level followed by the mission Retry button pass on both low and high**, arriving on the visible deck at y **6.42**, with live infected, downed bodies, police and the corgi retained. Restart level reloads L3's beginning; death and Retry restore the checkpoint. [Four browser runs](browser-receipt.json) · [Native death/retry restores](native-restores.json).

Local captures: `test-results/qa/l3-ramp-courier/l3-ramp-top-{low,high}.png`. The report directory retains ignored local copies. `l3-ramp-visual.ts` separately poses the courier at the reported coordinates to diagnose rendering; that positioning is **not** movement proof. Automated browser verification uses WebGL2/Metal per repository policy; GLTF parsing and the repaired transforms are shared with WebGPU.

The requested obstacle investigation also found a separate physical obstruction: a light cone wedges against the ramp's fine steps because the capsule's lower cap pushes it downward. Give touching light props the existing horizontal push impulse, retaining full courier speed. A 3D contact check excludes props on the road below a deck. The same restored fixture changes from indefinitely blocked at x **143.28** to arrival at the ramp top. This secondary repair is not attributed to the PO screenshot. [Before/after](prop-before-after.json).

All fourteen native restored obstacle runs pass (seven cases on both qualities): downed infected, permanent corpses, followers, props, debris, a live crowd, and waiting at the reported bend. [Obstacle receipts](native-obstacles.json).

The existing movement regression additionally crosses ten cones, ten downed infected, ten permanently killed infected and destruction debris placed at the lips and bends, on low/high. It checks arrival and that walking above a cone cannot push it on the street below.

## Authored route scope

Production movement covers both L3 on-ramps from before their entry lips at walking/running pace, recovery from the reported pose, L5 metro ingress, the separate L6 exit stairs/escalator, L7's raised Northgate road and L10's dispersal-platform stairs, on both quality settings. The user's follow-up explicitly leaves decorative/sealed flights non-climbable. L1 porch dressing, the solid cellar stair block and sealed station approaches retain their authored collision. L9's driving jumps are vehicle routes. [Inventory](authored-slope-candidates.json).

## Validation

- Typecheck and lint: passed.
- Selected asset validation: all three LODs pass, zero errors. [Receipt](asset-validation.json).
- Browser: all four production restore/UI ascents pass; no console errors. Low/high top captures visually reviewed: the courier stands on the visible ramp and both rails read clearly.
- Requested remote `qa:threat --levels L3`: skilled L3 completes in **193.40 simulated seconds**; every measured L3 criterion passes. The command exits **1 solely for `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`**, with no L3 failure flag. This is not a green all-level threat gate. [Current receipt](threat-current.json).
- Full unit/E21 validation: pre-merge run passes typecheck, lint and 105 tests, with one movement-case 30-second timeout. Repeating after merging main. The private runner receives authentic source HEAD commit/tree objects and runtime blobs so provenance tests work. No test is weakened.

Earlier `unit.json`, `validation.json`, `epic-checks.json` and `threat-receipt.json` document the previous geometry-only investigation. They do not validate this repair; final receipts will supersede them.
