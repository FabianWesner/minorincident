# E03 game-camera review

Reviewed the five real Shift+LMB frames for each of the seven moves in
`unarmed/`, plus `unarmed-review.png` (35 crops from the original 1600×900
headless Chromium screenshots). Camera, rig, materials and shadows are the
actual L1 game presentation, rather than an animation-editor camera.

Pass: anticipation reads before contact; jab/cross use different arms and
shoulder torque; front kick extends the shoe forward, roundhouse adds a lateral
sweep/turn, uppercut rises beside the face, knee keeps the lower leg folded;
spinning backfist clearly rotates the torso/backpack and carries the arm through
before returning to guard. The strokes remain distinct at the original game
scale. Silhouette, palette blocks, hands and shoes remain readable; no detached
limbs, missing clips or conspicuous support-foot drift appear in these frames.
The real-input test independently verifies unchanged planar player position and
ordered combos 0,1,2,4,5,3,6. Blender keys stagger hips/chest/limbs and keep the
limb anticipation-to-contact interval at 50 ms over the 0.4 s action.

The default locomotion crossfade is 140 ms; attacks use 35 ms so contact is not
lost inside an idle-to-strike blend. Backfist contact was adjusted to extend
forward after the torso turn. All seven runtime tracks come from the reproducible
Blender library export. No generated bitmap or procedural substitute was used.

Reviewed `civilian-gag.png`: the adult steps back in a readable stagger pose and
the “Hey!” bubble sits above the reacting actor. The child remains inside the
swing arc with unchanged health/state and no hit reaction. The test checks both
health values, no kill/infection, and the adult’s return from annoyed to calm.
The optional dropped-item gag is omitted. WebGPU is outside this headless review.
