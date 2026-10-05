# bld.tunnel-portal production review

Four design rounds: (1) segmented arch, masonry lining, road apron, guarded lamps, rocks and planting; (2) closed facade shoulders, outward normals, corrected framing, rock transforms applied before joins; (3) fuller planting and reference-style recessed block wall; (4) both lamps exposed in the reference camera, mounting pivots on the wall, distant palette joining.

Actual GLB validation is in validation.json; backend results are in backend-check.jsonl. AO is baked with Cycles at 32 samples into corner vertex colors. No image textures, subdivision surfaces, real brands, or coplanar decals. Hazard paint sits 6.5 mm beyond the plate face; road paint sits 13–15 mm above the paving surface. Concrete wear is raised geometry.

The roof group contains the crown and barrel vault, independently hideable from the interior. Two guarded lamp assemblies retain wall mounting pivots and light anchors. Static geometry is joined by material per hideable group. LOD2 combines small palette details to meet the 12 static draw cap; the six serviceable lamp meshes are separate.

Integration: interior_end is a removable visual recess panel matching the reference, without collision. Hide it when connecting this portal to a playable tunnel. Wall/crown collider empties leave the entrance open. The rear barrel continuation is modeled for reverse study views.

Final review: segmented silhouette, tapered facade, peach concrete, two amber lamps, charcoal/yellow hazard plates, yellow road edges and dashes, faceted rocks and vegetation are readable. Review imagery uses the shared CPU Blender runner. Final hero is 1600×900 at 96 samples; game is 960×540 at 24 samples. Both Three.js backends include front/rear study and game captures.
