# Barricade production notes

Reference: `reference-upscaled.png`, a portable cream A-frame with two broad orange/white rails, four splayed legs and two square cap blocks. Width 2.25 m; height approximately 1.8 m; spread approximately 1.16 m. The rails are double-sided so the silhouette and markings remain useful from either road approach. No text or brands.

Three material assemblies retain the chunky bevels and clear triangular openings. The caps are solid post ends, not warning lamps, so no light anchors or animated parts are appropriate. Folding animation is outside the runtime contract for this prop; the installed folding frame is static. Root carries pushable medium-prop physics and one bounding cuboid collider.

The hazard palette material `pal_schoolBusYellow` uses the reference's orange (#f65b18), a warm hazard-color variation of the documented starting color. Other colors use the specified palette hex values. There are no textures. Orange stripe prisms stand 6 mm clear of the rail face before a 2 mm bevel, so their nearest painted surface remains at least 4 mm proud.

Cycles AO is baked deterministically at 32 samples into the `ao` corner color attribute, exported as vertex colors. Build and render stages are intentionally in one small standalone script because the planned shared sslib does not yet exist in this checkout.
