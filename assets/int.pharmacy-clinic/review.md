# Pharmacy / clinic review

- Round 1: complete storefront and clinic furniture, but 156,724 triangles.
  Reference composition was reversed; the game camera saw a solid side wall.
  Cornice intersections produced dark artifacts. Rejected.
- Round 2: 61,460 triangles / 29 draw calls. Reduced bevel tessellation retains
  rounded silhouettes. Mirrored layout presents the glazed side to both review
  cameras; glyph orientation is preserved. Waiting bench, wheelchair, signs and
  products read clearly. Cornice intersections are clean and the framing fits.
- Round 3: 63,652 triangles / 29 draws. Clipped platform, bolder signage,
  fuller plant and smoother spill contour pass. Left window exposed a shelf
  end panel; added an independent window-facing display in the next pass.
- Round 4: 66,724 triangles / 29 draws. Hero render confirms the stocked left
  display. Distant Three.js game capture exposed faint spill depth artifacts.
- Round 5: 66,700 triangles / 29 draws. Spill silhouettes are disjoint and
  raised 40 mm above floor tiles; final WebGPU and WebGL2 game captures are
  clean. Both backends load with zero console errors/warnings. Final hero
  is 1600×900 at 96 samples; game is 960×540 at 24 samples.

Final verdict: passes the Hero review. LOD1 is 11,699 triangles, LOD2 is
3,829 triangles. GLB inspection confirms finite vertex positions, no image
textures, separate named hinged doors and four wheelchair axle joints, and a
valid emissive-node reference in the pharmacy light anchor. Static geometry
joins by material. Packaging artwork and mottled reference floor reflections
are simplified to the required texture-free palette geometry.

The asset intentionally has no roof mesh: this is an open interior panel.
Root and interior nodes are present. Door hinges, wheelchair axles, colliders
and the pharmacy sign light anchor are separate nodes. Text and labels are
raised geometry, not textures.
