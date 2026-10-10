# Gun pose and muzzle origin review — 2026-10-10

## Changes

- Firing applies a final torso/right-arm IK layer to the existing courier and crowd rigs. The hand is nearly fully extended at shoulder height, with a slight downward elbow bend. The torso faces the shot; the animated legs retain their pose and heading. The firing layer holds for 24 simulation ticks (0.4 seconds) after the last shot.
- Courier shots use the held weapon's authored `muzzle` socket. Police, army and armed civilian code-art weapons use their actual barrel endpoints transformed by the same hand/prop matrix as the rendered gun. Army nests retain and rotate their authored gun and muzzle through district batching. Flash, first tracer particle and the visual obstruction ray share the shot-time muzzle position.
- Gun range lines are absent at idle for either slot. Firing shows a translucent, tapered cue from the muzzle, limited to 4 metres, clipped by the combat obstruction query and fading over the firing hold.
- Scene Lab records firing gun contact against the owner's torso, neck and head. Its zero-clipping gate includes those contacts. Attack scripts can inject walking and firing together. Explicit NPC schedule commands clear the random spawn pause, so a walk command starts walking immediately.

## Review method

All browsers are headless. The review scenes use the normal game camera angle with an allowed close zoom and L3 lighting, plus a separate side view. They isolate the pose on asphalt rather than reproducing the station layout. Walking NPC render probes emit the production firing event at a real walking rig pose; standing NPCs and the HMG nest use their normal ally firing logic.

## Visual observations

- Standing: the idle pistol hangs low without a range line. During firing the right arm raises and extends in front of the courier; flash/tracer puffs begin at the visible barrel. The short cue fades between shots. No gun/head or gun/torso overlap is visible in the inspected game-camera frames.
- Walking: the courier advances across the scene while her legs continue their walk cycle and the raised pistol follows the firing direction. The flash and tracer remain attached to the muzzle. The inspected contact sheet shows no body clipping.
- Turning: after the target switch the torso and firing arm face the new direction; the tracer reverses with the barrel. The inspected contact sheet shows no gun/body intersection.
- Side: the close profile shows a level pistol, an extended right arm and a small elbow bend. The gun is visibly separated from the head and torso. The contact sheet shows the arm lowering after firing.
- Police: the officer raises the pistol toward the infected target; flash and tracer start at the visible barrel. Standing police, army and armed civilian render captures show no gun/head overlap.
- Idle: the gun remains equipped in the right hand while the courier rests; no cyan or yellow gun range line crosses the ground in the inspected idle frame and contact sheet. The separate two-slot idle render probe reports zero indicator vertices for both LEFT and RIGHT.

All six Scene Lab scenes pass on both remote SwiftShader and native Metal. Each run reports zero console errors and zero static, actor, held-prop and gun/body clipping hits.

## Validation

Local typecheck, lint, build and the seven focused rig/VFX unit tests pass. The focused tests cover female/male courier, police, army and both armed civilian rigs in idle/walk poses; they also inspect the actual VFX particle origins.

The standing render suite passes for all six cases (courier handgun, police pistol, army rifle, army HMG handheld fallback, armed civilian pistol and hunting rifle). Maximum muzzle/tracer separation is 0.00163 cm; maximum hand/shoulder height difference is 0.00146 cm; maximum forearm/shot angle is 6.669 degrees. Every clipping count is zero.

The final native Metal and remote SwiftShader render suites both pass all five tests. Across the twelve standing/walking cases, maximum muzzle/tracer separation is 0.008995 cm (0.09 mm), maximum hand/shoulder height difference is 0.001741 cm, and maximum forearm/shot angle is 6.669 degrees. Walking speeds are 2 m/s for the courier and 0.787 m/s for the NPC probes. Every clipping count is zero. The idle test checks both slot colours; the cue test checks a fence, the 4 m cap and fading; the nest test checks its rotating authored muzzle.

The full remote unit suite passes 460 tests across 131 files with one worker. The final Scene Lab helper change also passes the 17 focused rig/tooling tests locally and remotely.

The initial remote broad browser attempt passed smoke simulation checks (6 tests) but failed four browser smoke tests (loading timeouts and crowd-render checks). The remote levels attempt was stopped after a five-minute failure; several level tests explicitly request Metal and belong on the native Mac. Those logs are preserved in `test-results/gun-pose-final/`. The E05 verification simulation gate passes 61 selected tests remotely. Native smoke, levels and the E05 browser gate are queued; their final results will be recorded below.

## Review artifacts

- Native Scene Lab captures and metrics: `test-results/gun-pose-native/gun-pose-{standing,walking,turning,side,police,idle}/`. The side view at `gun-pose-side/shot-0026.png` shows the extended arm and clear gun/body separation; `gun-pose-idle/shot-0060.png` shows the equipped gun without a ground line.
- Archetype muzzle/pose probes: `test-results/gun-pose-render/metrics-standing.json`, `metrics-walking.json` and each named PNG/probe JSON.
- Final remote focused gate: `test-results/gun-pose-render-complete/summary.txt` records zero exit codes for typecheck, lint, build, focused units and render tests.
