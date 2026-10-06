# Shared character actions

`build.py` authors the shared humanoid and quadruped TRS actions in Blender.
It keys contact, passing, anticipation, strike, follow-through and recovery poses;
Blender exports the clamped curves as sampled glTF actions in `library.glb`.
The geometry and rigs remain the existing character assets.
The export forces constant object channels to remain: otherwise Blender drops
fixed guard arms and head compensation from the NLA actions. Duplicate samples
still collapse to two keys, and the compiler removes neutral rest channels.

Rebuild from the repository root, using the machine's Blender slot wrapper:

```sh
python3 /Users/fabianwesner/Workspace/suburban-survivors/experiment/tools/blender_run.py m1-anim assets/animation-library/build.py -- --glb assets/animation-library/library.glb
npx tsx tools/assets/animation-library.ts
```

The second command compiles the exported GLB samplers to
`src/render/characters/library.json`, so startup does not need an asynchronous
animation download. Commit the authoring script, GLB and generated JSON together.

`KeyframeAnimator` retargets by node name, preserves each rig's rest transforms,
crossfades actions over 140 ms, and uses additive upper-body strikes during movement.
Stride lengths in `clips.ts` describe the authored stance displacement; runtime phase
also includes the optimized asset and portrait/child scale. `bakeInfected` samples
these same actions for all crowd LODs, with interpolated GPU frames.

Combat emits combo and reaction intent. Presentation uses that intent for alternating
stagger directions, knockdowns, flung reactions, get-up and three grounded death poses.
Corpses hold for 30 seconds, fade for two seconds, then stop drawing. The companion
uses the quadruped idle, walk, diagonal trot and sit actions with distance-driven gait.

Regression checks live in `tests/unit/render/authored-animation.test.ts`,
`tests/sim/combat/m1-feel.test.ts` and `tests/e2e/m1-animation.spec.ts`.

The unarmed style uses seven `unarmed-*` clips (jab, cross, front kick,
roundhouse kick, uppercut, knee and spinning backfist). These are authored at
normalized duration 1 and played over 0.4 seconds: hips lead at phase .035,
chest/limb anticipation at .075, contact at .20 (50 ms strike), follow-through
at .36 and recovery at .66–1. The finisher appears once per seven attacks;
all moves retain equal damage. Legacy fists/kick clips remain for older fixtures.

Game-camera frame sequences from real Shift+LMB input are saved under
`test-results/epics/E03/unarmed/`; the review is in `test-results/epics/E03/review.md`.
