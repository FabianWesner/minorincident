# E25 scoped visual review

2026-11-08. Reviewed full light-lab before/after frames at zoom 1 and 1.5, high and low; the WebGPU/WebGL2 pairs; the analytic-light spike pairs; the tone controls; and the four accepted native-level comparisons. Numeric evidence is linked from the [report](README.md).

## Shadow and backend checks

- The hero casts a long ground shadow away from the trailer. The fence also casts its expected shadow. The corrected penumbra reads purple-blue rather than pink; mean hue is 256.57–256.68°, with nonblack RGB and 73.21–74.43% behind/beside darkening.
- Warm practical sources, pool footprints, trailer and fence geometry, surrounding blue darkness and beam placement retain their layout. The correction is confined to occluded practical pools. The first luminance-normalized candidate produced an overly bright blue edge and was rejected; the final peak-strength version avoids it.
- Same-pose WebGPU/WebGL2 pool-mask difference remains below 0.063% on both tiers and zooms. No backend fallback or browser error occurs in these scoped captures.
- DynamicLighting/ClusteredLighting show effectively the same analytic scene. At 256 lamps only two pixels differ by more than two channel levels. The field cost control is radiometrically unmatched and is excluded from equal-look conclusions.
- ACES makes the unlit ground noticeably darker; AgX shifts the backdrop and rolls off the bright pools. Retain the shipping tone curve and authored grades.

## Accepted native scenes

The primary matrix has fourteen exact whole-frame pairs. Two low L4 frames vary only in one background NPC's pose (119 / 58 pixels); a repeat with the same corrected code reproduces both complete baseline frames exactly. All sixteen baseline views are therefore reproducible by the corrected code. Full RGBA frames are compared; no character, health bar or pixel region is removed.

- L1: warm storefronts, purple directional shadows, green foliage, courier, corgi and street details remain identical.
- L2: cool midday pavement, facade colors, crossing markings, vehicles and daylight shadows remain identical.
- L4: golden plaza, portable lighting towers, stalls, sandbags and the broad shadow composition retain the accepted appearance. The only initial low-tier variation is the isolated NPC pose described above.
- L5: the existing red haze, ruined silhouettes, actors and health bars remain identical. The haze is retained; this review does not approve a new L5 grade.

The QA capture freezes the authoritative clock and node time, settles assets, orders asynchronous civilian batches deterministically for the same IK budget, and resets transient pose/contact/LOD history equally on both sides. Current authored clips, geometry and normal rendering features remain enabled. This is capture calibration; production animation is unchanged. Every native capture reports `fieldShadow = 0`, so the repaired term is inactive there.

[Shadow before/after](../../../test-results/epics/E25/rest/shadow-before-after.png). Native sheets: [high z1](../../../test-results/epics/E25/rest/accepted-high-z1-sheet.png), [high z1.5](../../../test-results/epics/E25/rest/accepted-high-z1.5-sheet.png), [low z1](../../../test-results/epics/E25/rest/accepted-low-z1-sheet.png), [low z1.5](../../../test-results/epics/E25/rest/accepted-low-z1.5-sheet.png). [Original low-L4 residual crop](../../../test-results/epics/E25/rest/low-l4-residual.png). The receipt retains both the initially varying frames and the exact same-code controls.

No new scene/color/geometry glitch was found in this scope. This review does **not** close full checklist G / AC16: the named reference images are still absent, `mall-floor` remains unresolved, and the complete L6 progression review is outstanding. AC09/AC10/AC13 remain red in the prior evidence.
