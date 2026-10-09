# util.radio

Reference-derived handheld portable radio: dark green faceted shell, speaker bars, broad tuning display, top knob, long antenna, side push-to-talk and belt clip. LOD1 drops screws/tuning ticks; LOD2 drops battery cover and display scale, preserving controls, antenna, grille and clip. No decimation. Display is a passive palette surface, not a lamp.

Interface: `audioSocket` is the speaker/static emission point; `ss_audio` labels its shelter dressing role. Light-class root physics, mass 0.75 kg, pushable/kickable, nonflammable. No pickup, UI or new objective is registered. Runtime audio lane owns static/chatter and playback.

Build: `npm run assets:build -- util.radio`, then `npm run assets:pack -- util.radio`. Shared recipes in `tools/blender/sslib/subway_fixtures.py` use sslib palette/primitives/sockets/colliders/export and rescue `Scene` conventions. Explicit `--distance-tier 0|1|2 --glb <path>` emits only the requested tier; ordinary build authors all three. Applied export scale is 1, with one Z-up to Y-up conversion. AO contrast is bounded to keep broad surfaces readable at game scale. Triangle caps 1500/600/200, <=8 total material primitives including moving/emissive assemblies.

QA: `test-results/l6-service-gates-and-lights/util.radio/comparison.png`, `authored-lod-reference.jpg`, `lod-contact.png`, `game-reference-peer.jpg` and `game-camera.json`. Measurements: `report.json`. Orchestrator visual acceptance remains independent.
