# s236 L10 building solids

## Changes

Farm house and barn ruin collision now uses the authored structural part bounds, transformed by the placement position, yaw, and scale. These bounds approximate the building generator's walls and door gaps; their match to every visible opening has not yet been independently verified. The farm placement helper uses the same bounds. Destructible structure walls are restored to the active navigation/combat wall set after chunk residency refresh; before this change, the refresh discarded them and a courier sweep could pass through the house after activation.

See-through selection for buildings now tests the camera-to-subject centre segment, avoiding false occlusion from a generous subject-box corner. Selected buildings use a shared ordered-noise dissolve across their instanced wall and roof surfaces, so the roof does not remain as a lone slab.

## Sweep audit

`tools/qa/building-wall-sweep-audit.ts` is wired into `tools/qa/solid-placement-audit.ts`. It sampled 664 building placements across L1–L10 with 9,760 capsule sweeps. L10: 242 buildings, 1,958 samples, zero misses. The existing solid placement portion reports 572 before and zero after across all district datasets.

The audit additionally samples vertical LOD0 mesh faces independently of collider bounds, at local heights 0.5, 1 and 1.5 m, retaining slices within the grounded courier's body height after scaling. Segments at least 0.5 m long are sampled at intervals no greater than 1 local metre. It resolves model paths through the manifest, including aliases. The current audit reports 202,160 combined sweeps across 832 level-specific placements; L10 has 45,433 samples and zero misses. Shorter segments, gaps between slices, and openings remain coverage limits. Known misses are ratcheted per level in `tools/qa/building-wall-sweep-baseline.json`.

Mesh normals are transformed using inverse placement scale before yaw, so nonuniformly scaled placements are swept across the face in the correct direction; invalid scale is rejected. The ratcheted audit passes with this correction.

Every level-specific campaign building has at least one qualifying mesh sample. The audit now asserts that property before checking colliders, so a newly introduced asset with no sampled face cannot silently pass. The audit, typecheck and lint pass with this guard.

The farm generator specifies solid 0.18 m side walls, split 0.18 m gable piers, and 2.2 m high door openings. The authored part bounds were tightened to those dimensions; destruction adds its existing 0.035 m hit-zone margin. Typecheck, lint, and the ratcheted sweep audit pass after this correction. This generator comparison is not a substitute for the all-district mesh-face audit or movement captures.

The height-slice audit found a visible chimney with no collider in each of four farm houses. A structural chimney bound matching the generator was added; all L10 sampled misses now clear. Typecheck, lint, and the ratcheted audit pass after this change.

The expanded lower slice also found unblocked hay bales integrated into five barn placements. Structural bounds matching the two bales and the attached silo were added, including placement scale. L10 has no remaining sampled misses. The expanded non-L10 baseline contains 694 sample findings, chiefly supermarket and pharmacy faces, plus the previously identified fire station, metro, garage, shed and bridge; exact placement IDs and coordinates are listed in the baseline JSON for follow-up. These findings have not been individually classified as solid walls or intended openings.

The audit also probes the reported 0.7-scale shed after chunk activation with the courier's full radius: a 3 m sweep stops after 1.1125 m at the side wall and 0.7625 m at a gable pier, while the doorway-centre sweep travels the full 3 m. These checks pass alongside typecheck and lint.

A lifecycle review found that adding destructible walls to the static streamed bake left them blocking after destruction. Chunk refresh now reinstalls intact parts as dynamic nav blockers instead. The audit checks the shed wall after streaming, breaks its side part, and confirms the same 3 m sweep then travels freely. The ratcheted audit, typecheck and lint pass.

A local simulation-only spot probe counted 1,312 active destructible blockers and measured chunk updates at x=700, 900, 1100, 1300 and 1500 as 79, 18, 13, 12 and 12 ms respectively. This is an unpaired diagnostic under shared machine load, not an opening-performance gate or a before/after comparison.

The focused streamed shed-wall check also uses actual courier, corgi, escort and infected entities. All four stop before crossing the side wall; their measured 3 m sweeps stop at 1.1125 m, 0.6225 m, 1.1125 m and 1.1125 m respectively. This verifies the reported shed for each role, not every placement for every role.

After triggering and restoring `cure-residential`, native HIGH then LOW movement inputs stopped the courier at x=1167.107 after starting at x=1166 against the side wall; from the doorway approach at z=-30 she reached z=-25.370 inside the barn. The setup used teleports to trigger the checkpoint and position each approach. Reviewed frames are in `/private/tmp/s236-checkpoint-motion/`. They revealed that the expanded L10 subject disc cleared almost the whole building, so the shader now uses a uniform 90% dissolve for the entire selected building. The HIGH behind-building, companion and non-occluder fixtures pass; typecheck and lint pass. The inspected HIGH wall and door frames show the courier through the dithered walls and roof, with a heavy dark shadow remaining. LOW and zoom 1.5 visual review of this latest shader remain open.

Native production L10 movement captures, seed 1, HIGH then LOW, used a fresh level with the courier teleported beside the shed and ordinary movement input for 120 ticks. At the side wall she stopped at x=1167.107 after starting at x=1166; through the doorway she travelled from z=-30 to z=-21.245. Both tiers produced the same positions. The reviewed wall-after frames show the barn opaque and the courier hidden; this is a production see-through failure that remains open. The door-after HIGH frame shows her outside the far opening. Captures and positions are in `/private/tmp/s236-native-movement/`; this setup did not restore the requested checkpoint or cover zoom 1.5.

Follow-up: L10 expands the reveal subject around nearby infected, shifting its centre away from the courier. Building selection now tests camera segments to the courier's own centre and feet. At the same native HIGH wall position the shed is selected, and the inspected `/private/tmp/s236-native-fixed.png` shows the courier through the faded roof and walls together. Typecheck, lint, and both HIGH see-through fixtures at zoom 0.5, 1, and 1.5 pass. LOW native review and the requested checkpoint/zoom coverage remain open.

The same native wall position was subsequently captured HIGH and LOW at zoom 1 and 1.5 (`/private/tmp/s236-native-zoom/`). The inspected LOW frames and HIGH zoom 1.5 show the courier through the whole faded barn, with its dark ground shadow still present. Both LOW see-through fixtures also pass at zoom 0.5, 1, and 1.5 (`/private/tmp/s236-courier-ray-low/`). These captures use a fresh level and teleport, not the requested checkpoint; independent corgi-only occlusion still needs verification.

[Farm fade sheet](farm-fade-sheet.jpg) compares current native frames at HIGH and LOW, zoom 1 and 1.5, after restoring a triggered `cure-residential` snapshot with the farmstead objective active. Its right column shows the wall and doorway positions after movement input. With the courier behind the shed, walls and roof fade together and she remains visible; in front, the red barn stays opaque and casts its shadow. The selected shed's shadow clears, avoiding the dark slab; its 90% dither remains very faint at night. The setup teleported to the river exit and residential region to trigger the checkpoint, then teleported to each approach; it is not the PO's saved snapshot.

The existing `tools/qa/l10-probe.ts` direct checkpoint load fails with `Unknown checkpoint: cure-residential`: its reconstruction advances objective completions rather than travelling through the region. The sheet instead uses a snapshot triggered by entering the residential region and then restored; it is not a reproduction of the reported saved checkpoint.

Building selection now also tests a segment to the nearby visible corgi, independently of the expanded subject box. The first HIGH companion fixture exposed inadequate courier visibility at the 75% fade; increasing clearance inside the subject disc while retaining the whole-building fade made both the companion and non-occluder fixtures pass (`/private/tmp/s236-companion-fix/`). Typecheck and lint pass. An isolated corgi-only building occlusion capture remains open.

The same companion and non-occluder fixtures pass on LOW (`/private/tmp/s236-companion-low/`). The inspected companion sheet shows both figures visible; it does not isolate a building that occludes only the corgi.

An isolated HIGH synthetic occlusion diagnostic placed the camera at (20, 12, 20), courier at (9, 0.7, 9), and corgi at (7.5, 0.3, 7.5) near `bld.house-a` at (5, 5). With no corgi, the building selection was empty; adding the corgi selected that house. This calls the actual district selection with controlled positions and verifies the corgi-only branch, but is not a gameplay capture.

An 85% uniform fade retained slightly more of the barn in a reviewed HIGH native frame, but failed the LOW companion fixture at zoom 1.5 (courier visibility 0.8 versus 0.85 required). The 90% fade was restored and that LOW row passes (`/private/tmp/s236-fade90-companion/`). The opaque shadow is rendered in a separate instanced shadow pass and remains a visual concern.

The placement shadow pass now masks the selected whole-building instance; other instances retain their shadows. Reviewed HIGH and LOW native frames show the black barn footprint removed while faded and retained while the barn is opaque. The shadow switches off rather than interpolating. Typecheck, lint, and the HIGH and LOW companion, behind-building and non-occluder fixtures pass. WebGPU and a performance comparison remain unverified.

These non-L10 findings remain for follow-up; the first five placements have no collider intersecting courier body height:

- L3 D-CORRIDOR `bld.river-bridge` placement 893
- L4 D-FAIR `bld.garage-detached` placements 644 and 652
- L4 D-FAIR `bld.shed` placement 748
- L6 D-SUBWAY `l6-36`
- L1 and L2 D-GROVE `bld.fire-station:853`; assess whether its sampled faces are intended to block.
- L3 D-CORRIDOR, L4/L5/L7 D-FAIR, L8 D-ZOO and L9 D-CROSSING: supermarket and pharmacy placements listed in the baseline JSON. L5 and L7 also report `bld.metro-entrance:225`, including two authored ingress collider sweeps. L5 repeats the L4 garage and shed findings; L7 repeats the shed finding.

Earlier lower sample counts and the claim that L8 and L9 had no misses predate the expanded height coverage. The earlier report that L5 had no buildings was caused by cross-level deduplication.

## Verification

- `npm run typecheck`: pass
- `npm run lint`: pass
- `node --import tsx/esm tools/qa/solid-placement-audit.ts --out /private/tmp/s236-solid-sweep-final.json`: pass; L10 sweep misses zero
- `npm run qa:threat`: did not finish; test budget stopped it at 600 seconds while scenarios were still running. L10 skilled stage completed in 122.321 seconds.
- A subsequent remote `qa:threat` also exceeded its 600-second budget under runner load; it did not produce an aggregate verdict. L10 skilled started shortly before the timeout.
- A later local `npm run qa:threat` completed in 301.4 seconds with zero fail flags; L10 skilled completed. Its detailed receipt is `test-results/qa-threat/README.md`.
- After the dynamic-blocker lifecycle fix, `npm run qa:threat` completed again in 300.5 seconds with zero fail flags and L10 skilled complete.
- `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; no healthy Hetzner runner and the configured Mac slot rejects the full suite.
- Subsequent full remote `npm test` passed: 27 files, 105 tests passed, one skipped, 213.5 seconds within the 240-second budget.
- After tightening farm bounds, the first remote unit run timed out at 240 seconds; the required unchanged retry passed 27 files, 105 tests with one skipped, in 236.2 seconds.
- After adding the farm chimney collider and height-slice audit, the full remote unit suite passed again: 27 files, 105 tests passed, one skipped, in 233.0 seconds.
- After the shadow change, the first remote unit run timed out at 240 seconds and reported a long save-progression test failure before stopping; the unchanged retry passed all 27 files, 105 tests with one skipped, in 205.4 seconds.
- After the dynamic-blocker lifecycle fix, the full remote suite passed: 27 files, 105 tests passed, one skipped, in 224.4 seconds.
- Focused scene gate and native HIGH/LOW captures: unavailable; browser-pool startup failed with `EPERM` binding its local listener / registering the browser process. No captures were produced or reviewed.
- On a subsequent unrestricted run, the focused `l10-d2-military-breach@low-z0.5` scene row passed. The requested camera captures and other scene rows remain open.
- Both curated L10 gate rows passed on a later run (`l10-d2-military-breach@low-z0.5` and `l10-mega-close-contact@low-z1.5`; `/private/tmp/s236-l10-gate-final/index.md`). Their sheets show isolated actors on plain ground, so they do not verify farm walls or building fades.
- After the shadow change, all four selected WebGL2 curated rows for L4, L10 and see-through passed (`/private/tmp/s236-final-scene-gate/index.md`). WebGPU rows require manual checking.
- Current WebGL2 L5 supermarket-beside and L3-lit synthetic house fixtures pass HIGH and LOW at zoom 0.5, 1 and 1.5 (`/private/tmp/s236-l3l5-high/`, `/private/tmp/s236-l3l5-low/`). The inspected L5 HIGH zoom 1 and LOW zoom 1.5 sheets show the supermarket intact beside the courier. The L3 fixture is synthetic, not a native L3 district capture.
- A temporary L10 farm crop at the reported shed coordinates rendered on HIGH at zoom 0.5, 1, and 1.5 without console errors (`/private/tmp/s236-farm-high/index.md`). The inspected zoom 1 sheet shows the courier over dark ground geometry, without a readable barn wall; it is not acceptable collision or fade evidence. The temporary fixture was removed.
- Scene Lab applies `levelTenLayouts` before cropping D-CURE, and the crop includes the target coordinates and tier 0 placement. The unreadable capture therefore needs further investigation; a passing console-error check alone does not establish that the shed is visibly rendered.
- Follow-up HIGH daylight crops show that with the courier at local `[-4, 0]`, the barn fades almost completely while its shadow remains; at `[5, 5]`, the red barn is visible above the courier with its doorway and roof (`/private/tmp/s236-farm-day/` and `/private/tmp/s236-farm-front/`). Recentering alone made no visible difference. These static crops do not demonstrate walking into a wall or through its doorway, and the near-total fade merits review against the requested soft fade.
- The whole-building dissolve was subsequently reduced from 95% to 75%. In the inspected HIGH farm crop (`/private/tmp/s236-farm-soft/`), roof and walls remain visibly translucent together and the courier remains visible; the dark cast shadow remains. Both see-through fixtures pass HIGH and LOW at zoom 0.5, 1 and 1.5 (`/private/tmp/s236-see-soft/`, `/private/tmp/s236-see-soft-low/`). Typecheck and lint pass after the change.
- HIGH WebGL2 catalog: `seethrough-not-in-the-way` passed at zoom 0.5, 1, and 1.5. `seethrough-building-first-frame` failed at all three zooms: courier visible share 0.3 against 0.6 required and zero measured cut pixels. The see-through change therefore needs correction before acceptance. Results: `/private/tmp/s236-see-high/index.md`.
- After correcting shader-node selection and using a strength-controlled 95% dissolve, both HIGH scenes passed at all three zooms (`/private/tmp/s236-see-high-fix/index.md`). The zoom 1 behind-building sheet was inspected: the courier is visible on the street and the foreground facade is cleared. A LOW rerun stalled before its first row and was stopped; LOW and the requested L10 captures remain open.
- A later LOW WebGL2 retry passed both scenes at zoom 0.5, 1, and 1.5 (`/private/tmp/s236-see-low-retry/index.md`). The zoom 1 behind-building sheet was inspected: the courier is visible on the street and the foreground facade is cleared. These L4 fixtures do not replace the requested L10 captures.
- `tools/qa/eg-l10-farm.ts`: fails an existing crop-spacing assertion (`farmLaneDistance >= 11`); this is outside the wall collision change.

Visual inspection of the barn wall/door and the reported see-through camera spot remains open. The opaque instanced dissolve and the collision sweeps are mechanically audited, but the requested HIGH/LOW native game-camera review still needs a working browser pool.
