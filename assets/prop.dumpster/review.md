# prop.dumpster review

Accepted after five visual rounds (initial build plus four refinements).

- Reference proportions and silhouette: wide green metal bin, twin five-rib
  dark lids, reinforced rim, long lifting sleeves with forward-facing openings,
  four offset casters. No graffiti, logos or brands.
- Side detail: bevelled seams, inset panels, gussets, metal hinges, raised lid
  handles, swivel races, separate wheel rims and axle bolts. Fine painterly
  reference weathering is represented by sparse geometric rust chips.
- Joints: lidL/R at the hinge axes; casterFL/FR/RL/RR at swivel axes;
  wheelFL/FR/RL/RR at axle centres. Static meshes merge by material.
- Coplanarity: panel skins have clearance, chip fronts have >=4mm surface
  clearance, and overlapping chip footprints are rejected. Both settled game
  frames are pixel-identical on WebGPU and WebGL2; no visible flicker.
- Texture-free Principled materials, seven palette names, baked vertex AO.
- Final geometry: 9,900 triangles, 29 draw calls including every animated mesh;
  no degenerate triangles, no NaNs, wheels touch z=0. Heavy-prop physics and
  collider extras exported. Main collider dimensions within 15% of visual size.
- Browser: prescribed study/rear/game captures on WebGPU and WebGL2, no
  console warnings/errors. Logs in three-check.jsonl and temporal-check.json.
- Final hero: 1600x900, 96 samples. Game: 960x540, 24 samples.

Integration note: manifest dimensions are still placeholders. Measured game
XYZ dimensions are 1.368 x 1.8725 x 2.630 m; update at integration.
Only assets/prop.dumpster was authored by this job; references were untouched.

Repeat exports: decoded positions, normals, UVs, indices and AO are identical.
