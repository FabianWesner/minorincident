# Safe house

Reference: reference-upscaled.png. One-storey bungalow, broad longitudinal ridge, full front gable, tiled purple/brown roof, brick chimney, pale lap siding and cream trim. Front porch carries a left boarded window, warm adjacent window and reinforced central entry. Cream side sign reads SURVIVORS / INSIDE. Sandbags, stair rails, interrupted picket fences, stone plot border and compact flowering garden complete the kit.

Frame: +X front, +Z up, metres, plot touches z=0. Plot 7.9 × 7 m; house about 4.85 × 5.4 m; roof ridge 4.8 m and chimney 5.69 m. Actual reference proportions take priority over the older placeholder dimensions. No manifest/spec changes.

Materials: named palette tokens, scalar Principled materials, one warm emissive window. All letters and badges are geometry with >3 mm separation. Static geometry batches by material within body/roof/interior. Door is separately hinged at its left jamb. Roof subtree can be hidden independently; floor is in interior. Window light anchor and house collider export as extras. AO is deterministic vertex color, 32 rays.

Garden uses bounded low-poly clusters instead of per-leaf detail; roof detail is spent on silhouette, shingle overlap, trim and chimney. LOD meshes regenerated with deterministic decimation, with required functional nodes retained.

Final refinement: added the lower projecting porch gable, moved its vent and house plaque forward, and narrowed the vent to avoid overlap. One-segment bevels keep the house below the orchestrator's 50k cap. Sign font is the macOS Arial Narrow Bold outline converted to mesh; no font or texture is needed by the game. LOD1 uses decimation ratio 0.13. LOD2 is authored from coarse walls, roofs, porch, windows, legible sign, bushes, fences and sacks; automatic distant decimation was rejected because it fragmented disconnected bevelled parts. Both authored detail levels bake 32-ray vertex AO.
