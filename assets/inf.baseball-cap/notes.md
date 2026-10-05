# Runner hero — revised proportions and lurching rest pose

The supplied turnaround and original crop remain the source for the red cap with a white front panel, thick brown hair, collared white shirt and chest badge, torn denim shorts, dark wrist cuffs, and chunky red high-tops. The orchestration review requested a larger chibi head, approximately one third of the overall height, plus large claw hands and bigger shoes. Final overall height is 1.672 m. The adult workwear and runner silhouette remain readable.

The rest pose is now hunched, with the head pushed forward, knees bent, and both arms reaching forward/up. Geometry is authored with the named rigid-part hierarchy, posed, then baked into mesh coordinates. Joint empties are reset to translation-only transforms, preserving shoulder, elbow, wrist, hip, knee, ankle and neck pivots for procedural animation. No armature or skinning is needed. Soles are grounded at Blender z=0; +X is forward and -Y is the right side.

The head, face, hands and shoes were enlarged without adding rig scales. Eyes use emi_infectedEye for both the glowing volume and center. Infected skin is grey-pink under the infectedSkin token. Teeth and an open mouth are separate volumes, with blood conformed to the cheek/chin skin and hanging blood drops. Hair uses thick, tapered volumes with uneven long bangs, side flicks and a lower nape. Sleeves have irregular cuffs, the shirt has hanging torn tabs, and shorts have separate ragged strips. Blood remains palette geometry, fitted to the shirt/skin surfaces; there are no image textures.

Three review rounds in this revision: (1) enlarged proportions and crouched/reaching rest pose; (2) inset larger eyes, thicker uneven bangs, three finger segments and broader shirt stains; (3) luminous eye centers, fuller shirt, lower nape, irregular cap emblem and stump alignment. Final hero and all four turnaround views were compared again with the reference. Fine fabric wear and diffuse staining remain simpler than the illustration.

All subdivision is applied. Input tessellation is fixed; there is no decimation. Details are joined by material within each rigid part. Final model: 39,738 triangles including seven stump caps, 63 meshes, eight palette/emissive materials. Caps remain on the retained side of the joint, align with the new limb directions, and carry hidden/ss_hidden extras. They are enclosed by the attached parts and hidden in Blender review renders. The pose-test rotates armL, foreArmL and legR, shifts the detached left arm outward, and reveals stump_armL.

Rebuild and render through the shared runner:

```sh
python3 experiment/tools/blender_run.py ../assets/inf.baseball-cap assets/inf.baseball-cap/build.py -- --glb assets/inf.baseball-cap/model.glb --render assets/inf.baseball-cap/renders/hero.png --view ref --width 1600 --height 900 --samples 96
```

The temporarily restricted r2 session crashed in Blender's Metal startup before running the script. The r3 full-access session rebuilt and rendered successfully. Rebuild validation confirms identical joint transforms and geometry within 9.1e-8 m. Export vertex packing/normal splits still vary between GLB files.
