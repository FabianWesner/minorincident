# Skin pilot progress log (lane/skin-pilot)

- 2026-10-07: worktree was a stale Oct-6 checkout with no pilot work; reset to main 9b184d87.
- Plan: assets/char.courier-female/build_skin.py execs build.py (outfit, joints) up to the proxy marker, spreads limbs,
  voxel-remeshes clothed body into one welded mesh, flat palette face colours from nearest shell, armature with the
  runtime joint names, bone-heat weights, rigid head/hands/shoes/bag 100 % on one bone, poses back and applies as rest.
- Runtime: bones get re-oriented to identity rest frames at load (same contract as rigid empties) so KeyframeAnimator +
  animation library clips play unchanged; ?skin=1 swaps the courier GLB.
- Blender: python3 <main>/experiment/tools/blender_run.py <abs scratch slug> assets/char.courier-female/build_skin.py -- --glb ...
