# Hero survivor

Reference measured in four matching views: height 1.4 m, hair/head region approximately 0.35 m, oversized shoes and hands, relaxed stance. Front +X, right -Y, ground Z=0. Identity: swept brown spikes, warm skin, cream hood/sleeves/shirt, red varsity body, charcoal cuffs, brown cargo trousers, red high tops, teal backpack with orange hardware and a raised corgi face patch. Small cheek bandage, shoulder straps, drawstring tips, snaps, pocket flaps and laces are geometry.

Rigid animation hierarchy: root → hip → torso → head/arms/backpackSocket; arm → foreArm → hand → weaponSocket; hip → leg → shin → foot. Geometry is consolidated per rigid parent, preserving all pivots and sockets. No skinning or image textures. Subdivision is applied to sculpted face, garment lofts, hood, hair and locks before export. All export materials use established pal_* tokens; starting values for asphalt/woodWarm/infectedSkin/schoolBusYellow are tuned to the reference's trouser/hair/living skin/hardware colors.

The explicit hero job overrides the older generic 8k survivor budget and no-subdivision guidance. Source specs have not been edited. The job's 60k budget is enforced in the build.

## Final production evidence

Five reviewed rounds. Final exported height: 1.398519 m. 57,936 triangles; 16 rigid glTF mesh records and 59 material primitives (the runtime `meshes` count). Ten palette materials; no image textures or skinning. The build's unused box subdivision parameter was removed, curves use one consistent resolution, and detail remains grouped by rigid joint rather than speculative helper layers. Final rest transforms are applied to meshes, joints and sockets have unit scale.

The remaining art gap is recorded in review.md: broad hair layering and cloth folds are more regular/simpler than the reference, so highest-tier hero sign-off needs art review. Every requested technical artifact/check is provided.
