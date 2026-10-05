# Sunset Fuel gas pump

Reference proportions: 2.747 m high; cabinet 0.51 m deep × 0.77 m wide;
base 0.68 × 0.94 m; star globe diameter 0.584 m. Blender +X faces forward,
+Z is up; the cast base touches z=0. Hose is on the visible -Y side.

Three rounds: (1) full bevel blockout and mechanical counters; (2) open
meter frames, ivory globe, heavier hose, tapered plinth; (3) selective bevel
and tube density reduction to 11,232 triangles / 12 material primitives.
Reference micro-rust is reduced to sparse, raised enamel chips for Side tier.
The fictional SUNSET FUEL plaque replaces the reference's plain grille badge.

Static geometry joins by material under body. The door_service pivot lies at
the lower hinge edge; nozzle is pivoted at its docking joint. lamp_globe is a
separate named assembly and light:globe supplies ss_light extras. The pump is
fixed street infrastructure, so no movable-prop physics extras are added.

Materials use Principled scalar inputs and emission only, with six palette
names and no image textures. The milk glass has an ivory base and gentle warm
emission. Deterministic 32-direction BVH ray sampling stores local AO in the
vertex color attribute ao, exported as COLOR_0. Applied chips, ink, plaques,
screw slots and stars clear their supporting surfaces by at least 3 mm.

The specified mid gas-pump attempt and sslib are absent in this checkout.
The build is self-contained and uses the supplied blender_run wrapper.

Final review: hero 1600×900 / 96 Cycles samples; game 960×540 / 24 samples.
WebGPU and WebGL2 each load 12 meshes and 11,232 triangles without warnings or
errors. Repeated final game captures are pixel-identical on both backends,
with no visible z-fighting. A rebuild produces a byte-identical GLB.

The shared preview server's optimized dependency directory disappeared during
final verification, yielding HTTP 504 before viewer initialization. The local
capture-native-deps.mjs preload routes optimized imports to the same installed
Three.js native modules; the supplied capture_glb.mjs remains unchanged:

    NODE_OPTIONS='--import ./assets/prop.gas-pump/capture-native-deps.mjs' node experiment/tools/capture_glb.mjs /assets/prop.gas-pump/model.glb assets/prop.gas-pump/renders/three

This adapter changes dependency delivery only, preserving both renderer
backends, camera settings, lights, materials and source model.
