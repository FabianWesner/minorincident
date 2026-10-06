# Infected dachshund

Reference: short-legged black-and-tan wire-haired dachshund, long trunk, floppy ragged ears, short, gently upturned tapering tail, open snarl, red collar with brass tag and torn end. Palette uses asphalt for purple-brown coat, woodWarm for tan markings, uiDark for nose/claws/mouth, blood and infectedSkin for wounds.

Rigid hierarchy maps front legs to arm/foreArm/hand and rear legs to leg/shin/foot. Quadruped nodes are also available as children. Head, jaw, neck and tail pivot independently. Caps are parented to the retained joint and exported at zero scale with hidden=true extras. Pose test rotates the requested left front joints and right rear thigh, reveals stump_armL, and detaches the right front leg for an unobscured cap demonstration.

All sculpt smoothing is applied before export. Geometry is joined by animated parent with multiple palette slots. No textures, image decals, skinning or unapplied subdivision. Dimensions intentionally follow the animal reference; manifest's 1.6 m vertical dimension is a generic infected placeholder.

QA correction: removed the dorsal ridge, crown spike rows, shoulder spike rows and tail tufts. The long low trunk now has a continuous smooth back with patchy side wounds, and the tail is a short tapered canine form. Applied mesh reduction enforces LOD0 <= 7,800 triangles, LOD1 <= 3,000 and LOD2 <= 1,400. Rebuild LODs with --lod 1/2 and export model.lod1.glb/model.lod2.glb.
