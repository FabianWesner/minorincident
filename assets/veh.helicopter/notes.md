# Rescue helicopter

Reference: reference-upscaled.png, four-view turnaround. Hero tier.

The rounded cabin is approximately 4.5 m long and 2 m wide, with a long tapered red tail, tall swept fin, four-blade main rotor and four-blade tail rotor. The full main rotor spans approximately 10.3 m. Landing skids contact z=0. Front is +X.

Parts: ivory cabin, red nose and crown, twin turbine housings and exhausts, split windscreen, four hinged cabin doors, raised rescue markings and registration, feather fin emblem, articulated mast and rotor grips, red safety blade tips, curved tubular skids with saddles, boarding steps, nose searchlight and roof beacon.

Static parts batch by palette material. Independent pivots: doorL/R, doorRescueL/R, mainRotor (Z), tailRotor (Y), searchlight, sirenL/R. Vehicle wheelFL/FR/RL/RR contracts are non-rendering skid contact anchors. No fictional wheels are added to the reference.

Glazing and paint use generous physical stand-off (55–80 mm between major layers) for stability with the preview game camera’s 0.01 m near plane. Raised text retains 4 mm extrusion, and separate colored surface layers never share a plane. Cross bar is above cross stem to avoid shared faces. No textures or real brands. Tail registration N472RE follows the reference.

The manifest still uses generic car dimensions; integration must replace these with the measured GLB bounds. No manifest edits were authorized in this asset-only job.

## Review rounds

1. Blockout: reference silhouette readable; 127,444 triangles and 44 calls.
2. Reduced mesh density and conformed rescue/registration markings; 62,112 triangles. Three.js revealed distant depth flicker.
3. Squarer vented engine cowlings, broader rear cabin, corrected skid mounts and uncropped game framing; 62,136 triangles, 39 calls.
4. Increased physical offsets and normalized merged rotations. WebGPU and WebGL2 loaded without errors; both game captures showed stable glazing and markings.
5. Final deterministic vertex AO bake and high-sample hero render; wipers moved above the outer glazing.

The glazing is opaque stylized material, consistent with the police-car quality reference. Seats and a cabin interior are not modeled. Main/tail rotors and all four cabin doors remain independent from the static palette batches.
