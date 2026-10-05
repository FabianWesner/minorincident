# Production review — veh.sedan-red

Five rounds completed. The final vehicle matches the reference's boxy four-door silhouette, red coachwork, smoked trapezoidal glazing, dark bumpers and side mouldings, vented circular hubcaps and rectangular lamps. Purposeful small parts include mirrors and their mounts, interior seats/headrests and steering wheel, wipers, cowl vents, grille slats, hood ridges, fuel flap, split rear lamps, plate screws and exhaust. The 1600×900 / 96-sample hero and 960×540 / 24-sample game views were visually reviewed. Both browser backends show the interior through the glazing and retain a clear red-sedan silhouette at game scale.

1. Initial full blockout: proportions established; excessive bevel/tread geometry identified.
2. Continuous arch lips, reduced tread and corrected normals; budget met.
3. Muted hubcaps, refined tyres and interior/glass review; AO added.
4. Genuine door apertures, hinge pivots and static material consolidation.
5. Exact front-door wheel clearance, zero-area cleanup, gentle baked AO as primary vertex colour, final export and captures.

Every wheel, door and lamp assembly remains separate with origins at its joint. Static meshes are joined by material. Raised panels, handles, mouldings, lamp lenses, plates and grille components have at least 3 mm surface separation. There are no stripes, decals or lettering to introduce coplanar overlays. Three settled game-camera frames are byte-identical on each backend; no flicker or console errors were observed.

LOD0: 57,352 triangles / 39 draw calls. LOD1: 8,382 triangles. LOD2: 2,318 triangles. Required nodes, wheel pivots, lamp anchors, texture-free material names, finite vertex values and zero degenerate triangles validate in all LODs. Geometry buffers (positions, normals and indices) hash identically across rebuilds; whole-file byte identity is not asserted for the Cycles bake/export. Reference files and shared tooling were not modified.

Verdict: complete. No remaining reference or export gaps.
