# Final visual review — inf.nurse

Reviewed after four modeling rounds against the upscaled turnaround, original crop, original infected sheet and accepted worker proportions. Final hero is 1600×900 at 96 Cycles samples; four review cameras and pose test use 960×540 at 24 samples. Turnaround is a 1680×540 strip.

Retained reference identity: brown high messy bun with red scrunchie, loose temple/nape locks, pale infected face with emissive red eyes and a carved snarling mouth, teal V-neck short sleeves and matching trousers, ragged knees and back, pale sneakers with dusty pink accents, medical wrist bands, hanging ID lanyard and stethoscope. Blood is raised conforming palette geometry; small source cloth marks are simplified into sculpted folds and tears.

Separate rigid hierarchy passes required node and parent checks. All subdivision/bevel/reduction modifiers are applied. Static details merge within each moving parent. Seven proximal stump caps export hidden using zero scale and explicit extras. Rest joints have unit scale and zero rotation; foot minimum is z=0. The pose render moves armL, foreArmL and legR, toggles stump_armL, and exposes the opposite shoulder by removing armR.

Final GLB: 39,584 triangles, 62 meshes, ten palette/emissive materials, no textures. Both WebGPU and WebGL2 loaded the final artifact and produced three captures each with no console warnings or errors. Final renders were compared again to the reference. Build script remains self-contained with a small shared set of primitive helpers; temporary construction scripts have been removed. No specifications or reference assets were edited.
