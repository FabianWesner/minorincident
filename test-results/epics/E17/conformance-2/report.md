# Asset conformance follow-up

Main merged through 6ab4bda (dark SUV and gas station). No Blender rebuilds or source/reference edits.

The baseline 163-slot audit had 315 stump and 171 dimension findings. The final audit includes the newly merged SUV and gas station (169 slots), with zero stump findings and three dimension findings. The 14 unrelated crawler limb-geometry / clinic triangle-budget findings remain unchanged.

The optimizer repairs empty, zero-scale stump placeholders with a 56-triangle flesh ring and bone stub. Each cap uses the proximal limb geometry near its joint to determine radius and axis, sits at the limb pivot on the surviving parent, and uses hidden metadata consumed by the loader. Caps are generated after simplification; generated infected LOD1s reserve cap budget. Runtime dimensions exclude hidden geometry. Shared JSON palette tokens automatically reach runtime and Blender palette readers.

21 adult character/infected exports are uniformly rescaled to 1.8 m through manifest sourceScale. All local joint/animation transforms stay intact; scale is applied once to the whole assembly. The E04 physics capsule stays at its existing value. Brother is a child; teen-skater, crawler and brute retain authored silhouettes. 51 manifest expectations are corrected from reference construction notes or scaled adult envelopes. Tolerances are unchanged. All individual decisions are recorded in decisions.json.

Vehicles retain authored metres from their construction notes, including mirrors and roof accessories. The school bus has 2.32 m axle track; its 3.6 m envelope includes mirrors. No driving/road layout is implemented yet, so gameplay lane fit cannot be exercised.

## Proportions needing a decision

- bld.house-b:lod2: depth 8.5989 m versus LOD0 7.5180 m (+14.4%); supplied hand-made LOD2 footprint is inflated.
- bld.house-c:lod2: depth 10.7060 m versus LOD0 9.4032 m (+13.9%); supplied hand-made LOD2 footprint is inflated.
- bld.joes-diner:lod2: width 13.2626 m versus LOD0 11.7450 m (+12.9%); supplied hand-made LOD2 lot/sign envelope is inflated.

These LODs are preserved. Uniform scaling would change the other matching dimensions. A later decision can replace the hand-made LOD2 with a generated tier or correct its source proportions.

## Verification

Full unit suite: 52 passed. Smoke: 3 unit and 12 browser passed. Verify E17 uses E2E_PORT=3319 and the main branch lockf wrapper with two Playwright workers. No game gore-probe exists yet; preview goreProbe detaches the actual production limb and reveals the surviving cap. Screenshots and final verification results are saved beside this report.
