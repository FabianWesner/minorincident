# Corgi hero build

Reference: reference-upscaled.png and the corgi row of the original survivors sheet.
The corgi has deliberately different proportions from humanoid survivors: short legs,
a long barrel, a broad head and large upright ears. Approximate rest bounds: 1.724 m long,
0.847 m wide including bags, 0.953 m tall including ears; feet contact z=0.

Required nodes are the exact corgi contract, not humanoid arm/shin nodes. Head pivots at
neck, legs at upper attachment, tail at rump. All accessories belong to body/packSocket;
face and ears follow head. No skinning is needed for v1 procedural animation.

Separate raised geometry: blaze, eyes and glints, brows, smile, tongue groove, pink inner
ears, layered ruff/flank/tail fur, toes and seams, red collar, golden bell, paired teal
saddlebags, piping, straps, hollow buckles, rivets, carry handle, medical cross and corgi
patches. Meshes merge by material within each rigid joint. All smoothing is baked before
GLB export; no cameras, lights or studio ground are included.

Existing palette tokens retain their specified colors. Asset-local pal_corgiOrange,
pal_corgiOrangeLight, pal_corgiPink and pal_corgiTongue match the reference's fur and
mouth colors; pal_backpackTealDark is a shaded fabric variant. These require registration
if the production palette validator accepts only global tokens. No reference or spec is
modified. Materials use scalar Principled BSDF and no image textures.

Pose review substitutes legFL/legBR/head/tail for the humanoid-only armL/foreArmL/legR.
The companion is healthy; infected eyes and stump caps do not apply.
