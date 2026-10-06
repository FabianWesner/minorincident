# Wooden garden shed

Reference: reference-upscaled.png. Red vertical siding; warm pale corner trim; dark mauve gabled plank roof. Front faces +X, right wall is +Y after the facade layout mirror. Footprint including paved apron is 4.7 × 4.5 m; ridge height 3.57 m. Model rests on z=0. Four hanging garden tools, framed amber window, lantern, door braces and hinges, workbench/toolbox/watering can, rain barrel and downpipe, cinder blocks, low-poly plants.

The door has a vertical hinge origin at the right jamb. Roof and interior are independent visibility groups. The lamp has a wall-mount origin. Window and lamp emissions each have ss_light anchors. A cuboid collider describes the shed shell. No image textures, labels or brands. Details project 8 mm or more beyond their backings; siding and trim are physically thick. Static meshes join within material/visibility groups.

LOD1 rebuilds with flat-edged geometry and fewer small details. LOD2 rebuilds broad shells and keeps roof, interior, door, emissive nodes, window divisions and barrel silhouette. Ground plane and studio lights are render-only.

Review rounds: 1 corrected budget and inspected facade/frame; 2 corrected handedness, framing, tools and LOD1 density; 3 raised shovel heads, moved cinder blocks, finished window reflections/toolbox/lid/tap. Static joins are centralized in one helper; barrel detail nesting was flattened.

Repository checks: typecheck and lint pass. Unit suite passes 79/80; unrelated `bld.dugout` registration assertion fails. Full epic verification writes outside the authorized asset folder and was not run for this standalone model task.

Fourth technical pass: ridge caps use 6 mm end gaps; cinder-block webs meet rails without overlapping their top faces; rear wall stops below the gable; front sill fits between corner trim; gable fascia uses continuous extruded profiles instead of intersecting beams. Polygon winding is normalized before extrusion. These changes keep decorative and structural exposed faces free from flat overlap.
