# L3 checkpoint guard tower

Reuses the wood tower, khaki plank parapet and ladder design authored in
`tools/blender/sslib/rescue_assets.py` for `kit.army-checkpoint`. Headless Blender
builds complete geometry at LOD0/1/2: 1144 / 312 / 144 triangles, two materials.
The platform top is exactly Y=4.26 m. The open top keeps riflemen visible at the elevated game camera. The west firing face is open; side parapets protect the deck,
and the east ladder faces away from the approach. Four tower legs, the deck,
parapets have full-height authored compound colliders. Ground navigation
ignores the overhead deck; shot rays retain them.

Four instances at X=138.5, Z=-18/-7.6/7.6/18 each carry two guards. Their fixed
floor support survives ordinary movement updates and checkpoint serialization.
The tower front edge clears the 3.4 m concrete line; the east edge clears the
existing tent. No finale objective or gate-completion rule is changed.

Rebuild: `npm run assets:build -- kit.guard-tower`, then
`npx tsx tools/assets/bake-static-collision.ts kit.guard-tower`.
Visual proof: `SCENE_PORT=3358 sh tools/e2e-lock.sh npx tsx tools/sim-runner/l3-towers-proof.ts`.
The proof reproduces ground guards with towers omitted,
and captures all three delivered tower LODs at the same game camera, recording
rifle-tip muzzles, tracer endpoints, foot positions and console errors.
