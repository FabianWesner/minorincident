# Courier depot modeling notes

Source crop: initial-drafts/l1v2-neighborhood-kit.png, original pixels [42, 183, 407, 511]. Crop excludes panel labels and neighbours. Compact cream masonry shop, teal/yellow striped awning, teal Sunset Parcel Co. sign with winged parcel emblem, four gooseneck sign lamps, warm glazed storefront, parcel shelves/counter, red drop box, rooftop HVAC and silver duct. Sidewalk dressing belongs to this diorama: A-frame sign, red hand truck with taped parcels, flowering pots and left conifer.

Metre-scale target: shell 2.7 m deep × 4.3 m wide, parapet 3.5 m tall, entrance clear opening 1.3 × 2.2 m, counter 1.0 m high. +X is front, +Z up; camera sees front and -Y side. Slab rests at z=0. World-space geometry is rebased at functional parent pivots before export. Door hinge at right jamb. parcel_counter is an empty at the counter/customer edge. Roof and interior remain separate. Shell collider empties leave door aperture accessible. Window nodes separate transparent panes from frames; keep_glass preserves glTF glazing rather than using an opaque runtime palette swap.

LOD1 rebuilds un-beveled core forms and removes tiny hardware/flowers/labels; LOD2 keeps shell, signage silhouette, striped awning, window/door frames, parcels, counter, HVAC and sidewalk-prop silhouettes. All tiers retain functional nodes and collider/light extras. All colour materials are shared palette tokens; transparent glass is the one keep_* material. No image textures or external font dependency; Blender's built-in Bfont authors raised fictional signs.

## Rebuild and QA

```sh
python3 experiment/tools/blender_run.py ../assets/bld.courier-depot assets/bld.courier-depot/build.py -- --glb assets/bld.courier-depot/model.glb --render assets/bld.courier-depot/renders/hero.png --view ref --samples 96 --width 1600 --height 900 --turntable
npx tsx assets/bld.courier-depot/pack.ts
npx tsx assets/bld.courier-depot/validate.ts
sh tools/e2e-lock.sh node assets/bld.courier-depot/capture.mjs
```

The first command exports raw, AO-baked geometry and authored tiers; pack.ts uses the production optimizer (dedup/prune/weld/join, quantization, meshopt) while preserving functional pivots and named emissive nodes. validate.ts invokes production validateDocument and checks local delivery, AO, light references and LOD ratios. capture.mjs uses one headless Metal WebGL2 browser on the existing server. It injects the production MeshoptDecoder into the preview response only because the generic preview does not wire that decoder; no preview file is edited. WebGPU remains a manual integration check per AGENTS.md.

Rest door angle is 65 degrees, matching the open shopfront. Pose test closes the same hinge and hides roof. Rebuild hash canonicalizes triangle order by world coordinates/winding, matching production validation: Blender may reorder its cached loop-triangle list after AO even when vertices, topology and transforms are unchanged.
