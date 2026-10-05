# Asset conformance follow-up

Main merged through bb7b6b9 (including E10 districts/roads), merge commit 244d690. No asset models, reference images, or specs were edited.

The baseline 163-slot audit had 315 stump and 171 dimension findings. The audit now includes SUV and gas-station exports (169 slots): zero stump findings, three dimension findings, and the 14 unchanged crawler limb-geometry / clinic triangle-budget findings outside this pass.

The optimizer repairs empty, zero-scale stump placeholders with a 56-triangle flesh ring and bone stub. Caps use proximal geometry at the joint, sit on the surviving parent, and use loader-hidden metadata. Neck caps use the surviving torso cross-section so chibi jaws do not produce oversized plates. Caps are generated after simplification, and generated infected LOD1s reserve their triangle budget. Default dimensions exclude hidden geometry. Shared JSON palette tokens automatically reach runtime and Blender readers.

21 adult character/infected exports are uniformly rescaled to 1.8 m through manifest sourceScale. Local joints and animations remain intact; scale is applied once to the whole assembly. E04 physics stays unchanged. Brother is a child; teen-skater, crawler and brute retain authored silhouettes. The school bus is uniformly scaled to 3.3 m including mirrors, fitting E10’s 7 m roads as two 3.5 m lanes. All vehicle LODs retain at least 0.1 m lane clearance. 52 manifest expectations are corrected from construction notes or new uniform scales; tolerances are unchanged. Individual decisions are in decisions.json.

The same optimizer refreshes exported district collider/footprint/acoustic/surface metadata and derived entrance offsets from canonical dimensions. Layout mesh exports are preserved. This prevents updated asset dimensions from leaving stale collider boxes or entrances inside enlarged footprints.

## Proportions needing a decision

- bld.house-b:lod2: depth 8.5989 m versus LOD0 7.5180 m (+14.4%); supplied hand-made LOD2 footprint is inflated.
- bld.house-c:lod2: depth 10.7060 m versus LOD0 9.4032 m (+13.9%); supplied hand-made LOD2 footprint is inflated.
- bld.joes-diner:lod2: width 13.2626 m versus LOD0 11.7450 m (+12.9%); supplied hand-made LOD2 lot/sign envelope is inflated.

These LODs are preserved. Uniform scaling would change the other matching dimensions. A later decision can replace the hand-made LOD2 with a generated tier or correct its source proportions.

## Verification

Full unit suite: 61 passed, including adult height at every LOD, vehicle envelopes against road lanes, and all district collider/navigation contracts. Typecheck/lint/build pass. Final verify E17 passed typecheck/lint/build, 28 selected unit tests and 25 browser tests. The earlier smoke run passed 3 unit and 12 browser tests; those same smoke cases are included in verify E17.

All browser runs use E2E_PORT=3319, lockf /tmp/minor-incident-e2e.lock, and two workers. No game gore-probe exists in the merged main yet; the preview goreProbe detaches actual production limbs and reveals their surviving caps. Screenshots/logs are saved here. Visual review confirmed closed shoulder, neck and forearm cuts with readable flesh/bone surfaces; the neck-cap correction removes the oversized jaw plate. Adult and SUV previews remain readable in the game camera; E04 survivor movement and the E17 crowd pose/direction probe pass.

The newly merged E10 unit test initially invoked its direct Blender runner for 16 layout rebuilds during test:unit. Outputs were restored. Its exporter/cache boundary is now mocked so unit tests exercise cache invalidation and fatal exporter failures without Blender. No asset models or reference images were rebuilt.
