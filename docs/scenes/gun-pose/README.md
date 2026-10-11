# Gun pose review scenes

Run all six using the shared browser lock (headless):

```sh
SCENE_PORT=3357 npm run scene -- docs/scenes/gun-pose/{standing,walking,turning,side,police,idle}.json --out test-results/gun-pose
```

The game views use the normal camera azimuth/polar angle, zoomed within the game's wheel limits. `side` uses a close side camera. All scenes gate on console errors and zero clipping, including the firing gun against its owner's torso, neck and head. Idle frames show that neither slot draws a permanent gun range line.

Scene Lab's attack command accepts `move: [x, z]` to walk while firing. It injects ordinary movement, aim and held fire together; legs retain their normal locomotion clip. The scripted turning case switches the target across the courier.

`tests/e2e/gun-pose.spec.ts` also captures police, army rifle/HMG, armed civilian pistol and hunting rifle standing and walking. Walking NPC probes use the production event bus at a real walking pose. The separate nest case checks the rotating authored HMG socket. Tests compare the rendered muzzle with the tracer start (<5 cm), hand and shoulder heights (<15 cm), and the forearm with the shot direction (<15 degrees), and check the temporary cue against a fence.
