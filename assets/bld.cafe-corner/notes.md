# Modeling plan

The source is a frontal isometric single-storey brick café with a broad sidewalk patio. Building shell: approximately 8 m wide × 4.4 m deep × 3.3 m tall. Complete sidewalk vignette: approximately 18 m wide. Front faces Blender +X, right side is -Y, ground contact Z=0.

Preserve the scalloped Sunset Grove Coffee sign and cup, paired striped awnings, orange umbrellas and café chairs, central entrance, amber storefront, flower boxes, bicycle rack, lanterns, corner street signs, hydrant and bin. Roof controls parapets/HVAC/sign; window nodes control emissive glass; interior controls furnishings; door_main pivots on its hinge.

Use palette tokens directly from the shared palette library. Join static geometry by palette within each control assembly. Procedural lower tiers remove tiny disconnected features and reduce bevel/circular tessellation. Keep all building interaction nodes in all tiers. No manifest or registry changes.

Review round 1 revealed cached pane geometry being translated by a shared origin change. Meshes are now copied before joining/origin edits, preserving all control groups. Foliage uses base icosahedra, shared cylinders and direct tube meshes to avoid repeated operator work. Street signs/bin/hydrant occupy the right corner; chalkboard and ivy sit left of the entrance. The reference render uses the sheet's low frontal isometric angle; the gameplay render uses the higher game angle.
