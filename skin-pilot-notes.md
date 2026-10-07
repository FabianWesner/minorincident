# Skin pilot progress log (lane/skin-pilot)

- 2026-10-07: worktree was a stale Oct-6 checkout with no pilot work; reset to main 9b184d87.
- Plan: assets/char.courier-female/build_skin.py execs build.py (outfit, joints) up to the proxy marker, spreads limbs,
  voxel-remeshes clothed body into one welded mesh, flat palette face colours from nearest shell, armature with the
  runtime joint names, bone-heat weights, rigid head/hands/shoes/bag 100 % on one bone, poses back and applies as rest.
- Runtime: bones get re-oriented to identity rest frames at load (same contract as rigid empties) so KeyframeAnimator +
  animation library clips play unchanged; ?skin=1 swaps the courier GLB.
- Blender: python3 <main>/experiment/tools/blender_run.py <abs scratch slug> assets/char.courier-female/build_skin.py -- --glb ...
- Commit 2: retargeted M2M clips (idle/walk/run/carry/hurt) for the skinned courier; skinGait (walk 1.05, run 1.75 raw stride).
  Lab metrics (720-tick script): hero-local jerk RMS head 4504→2053, handR 9024→3778, hip 4052→1882 m/s³; planted-foot
  slide p50 ≈0.1–0.2 cm/s both. The then-existing main saddle/S-02 failures were subsequently fixed by lane/l1v2-f.
- Completed courier contacts, strike recovery, stable ride gaze, 12.80-second L1 A/B recordings and desktop CPU/draw probes.
  Main's final bicycle fixes are merged at cc8b9ffc. The current report and expansion estimates are in
  [docs/reports/skin-pilot.md](docs/reports/skin-pilot.md); recordings and raw measurements are in `test-results/skin-pilot/`.
