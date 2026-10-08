# Inspect a running level

Open `/?debug=true&inspect=1&level=L2` on a development or production build. Replace L2 with any level in the level registry, including L1 and L3. Production requires the exact `debug=true` query parameter; `inspect=1` alone does nothing.

The default courier is a stationary ghost: infected ignore her and combat cannot hurt her. Add `&bot=complete` to drive the existing complete policy (L1, L2, L3) through the normal mission. The overlay lets you select ghost, bot, or unchanged. Unchanged preserves a running bot and applies no courier cheat, for determinism comparisons. The parked ghost does not complete objectives requiring courier input; choose bot to watch those beats. Leaving inspection restores courier input; an already running bot continues until stopped through the API.

| Control | Action |
| --- | --- |
| F or backquote | Enter / leave inspection with `debug=true` |
| WASD or arrows | Pan across the ground relative to the camera heading |
| Shift | Move faster |
| Mouse drag | Rotate yaw and pitch |
| Wheel | Zoom from close-ups (minimum camera height 1.5 m) to an overview |
| Q / E | Lower / raise the focus and camera |
| Double click | Focus the ground point |
| Click pedestrian / infected | Follow that entity; pan or focus to detach |
| H | Hide / show overlay |
| One finger | Pan |
| Pinch / two finger twist | Zoom / rotate |

The overlay includes camera coordinates, nearest placement or anchor, entity under the cursor (id, kind, look, state, drawn LOD), fps and draw calls, time scales 0 / 0.25 / 1 / 4, anchor/objective/checkpoint jumps, follow controls and PNG download. LOD distance **real** uses the inspection camera; **game** uses a virtual camera at the standard game radius around the inspected point. Frustum culling always uses the visible camera. Lighting, geometry, render tiers and animation come from the game.

The free camera never enters simulation decisions. In particular, the spawn director keeps the normal courier camera frustum. Ghost is an explicit change to courier behavior; use bot or unchanged to compare identical simulation runs. Inspection suspends automatic render quality adaptation while active, so inspecting an expensive overview cannot lower the simulation population. Time scale changes real time per tick; explicit `step()` always advances the same fixed ticks.

## Agent API

With `debug=true`, wait for `window.__SS__.ready`:

```js
const api = window.__SS__;
api.inspect.enable(true, { courier: 'unchanged' }); // 'ghost' | 'bot' | 'unchanged'
api.inspect.anchors(); // { id, kind, position:[x,y,z] }[]
api.inspect.jump('mission/lab-door'); // exact id from anchors()
api.inspect.setCamera({ position: [20, 12, 20], target: [0, 0, 0] });
api.inspect.follow(123); // null stops following; unknown ids throw
api.inspect.timeScale(0); // paused sim, camera remains interactive
api.inspect.lod('game'); // 'real' | 'game'
api.inspect.state(); // camera, following, nearest, cursor entity, counters
await api.screenshotReady(); // then Playwright page.screenshot()
api.inspect.enable(false);
```

## Scene Lab CLI and MCP

```sh
npm run scene -- --inspect-level L2 --bot complete --out test-results/inspect/L2
npm run scene -- --inspect-level L1 --anchor mission/lab-door
```

These commands run a real mission, capture three objective anchors (or the selected anchor), and write screenshots plus `metrics.json`, including console-error gates. They use Scene Lab's headless browser, shared lock and private port 3341. `SCENE_PORT` overrides that port; 3300 is rejected.

MCP sequence: `inspect_level({level:'L2',bot:true})`, `inspect_camera({anchor:'mission/<id>'})` or `inspect_camera({position:[...],target:[...]})`, then `screenshot({name:'rescue'})`. `inspect_camera` also accepts `follow`, `timeScale`, and `lod`. `inspect_state` returns camera, anchors and current entities. Isolated scene tools resume after `load_scene`; calling scene-only tools while inspecting a mission is unsupported.

Validation evidence is in `test-results/inspect/`: L1/L2 anchor and follow PNGs, renderer metrics and the SHA-256 sim-state hashes of two 3600-tick L1 complete bot runs. Run `E2E_PORT=3347 sh tools/e2e-lock.sh npx playwright test tests/e2e/inspect.spec.ts --project=chromium --workers=2` after building.

The isolated camera QA fixture uses a walking pedestrian and an infected with the inspection override active:

```sh
npm run scene -- docs/tools/inspect-scene.json --query debug=true --inspect true
```
