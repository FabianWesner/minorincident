# Fire-engine pipeline pilot

Adapted from the hand-built `assets/fire-engine-blender/build_fire_engine.py`
reference in the main checkout. The original reference files remain read-only.

Legacy contract: 7.4 × 3.55 × 2.1 metres (game X/Y/Z), front +X. The truck is
centered on X/Z and grounded on Y=0. Geometry is measured from the upscaled
reference; the rear and far side are inferred consistently.

Separate joint assemblies: body, wheelFL/FR/RL/RR, ladder, sirenL/R.
Driver/exit sockets and a cuboid collider remain empties. Static meshes merge
by palette material inside rigid assemblies. Reduced bevel/radial detail puts
LOD0 below the 80k vehicle budget; LOD1/LOD2 are generated with meshoptimizer.

The original paint/chrome/glass/rubber families map to the shared palette.
The script has no random input. Canonical welding avoids ambiguous BMesh
vertex survivor selection. Geometry hashes compare exact triangle coordinates,
winding and named transforms, independent of normal-induced vertex splitting.

The inventory fire-engine row was an outdated U+L snapshot; it now records
integrated to match the registry and the production-renderer turntable proof.
Other supplied production scripts and models are registered without rebuilding
or rewriting them. Validation findings remain visible in the E17 report.
