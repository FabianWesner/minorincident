# Scene Lab (QA agents)

Scene Lab builds a small isolated scene from real game content and steps it in a headless browser. Use it to check
a house, a backyard, a sitting pedestrian, a horde or an explosion without playing a level.

It runs the real game modules: the composition loader, `DistrictWorld` (collision and navigation), `DistrictView`
(static instancing, LOD, foliage, grass), the renderer and PostFx, the courier, the L1 pedestrian and infected crowd,
the corgi, vehicle physics and the explosion system. The rules are L1's: the morning light, the L1 infected brain
and pedestrian looks. If a scene passes here, the same content behaves the same way in the game.

- Runtime: `src/debug/scenelab/` (`SceneLab.ts`, `spec.ts`, `geometry.ts` for clipping, `motion.ts` for foot metrics). The browser exposes it as `window.__SCENE__` with `?test=1&scenelab`.
- Runner and MCP server: `tools/scenelab/` (`cli.ts`, `mcp.ts`, `session.ts`, `mcp-smoke.ts`).
- Examples: `specs/scenes/*.json`. The `qa-*` specs are the standing QA sweep (couriers, corgi, pedestrians, infected, D-GROVE chunks and `qa-grove-clipping-all`); run them with `npm run scene -- specs/scenes/qa-*.json` and add `--backend webgpu` for the character ones.

## CLI

```sh
npm run scene -- specs/scenes/bench-sitter.json
npm run scene -- specs/scenes/*.json                      # several scenes, one browser
npm run scene -- specs/scenes/courier-turns.json --frames 600 --shots 0,120,480 --video 4
npm run scene -- specs/scenes/house.json --backend webgpu --tier low --out test-results/scenes/x
npm run scene -- specs/scenes/courier-turns.json --query skin=0   # extra game URL params (A/B)
```

- **Headless and locked.** It always runs headless and takes the shared e2e browser lock (`tools/e2e-lock.sh`), so it may wait for another lane first.
- **Private server.** It starts its own Vite dev server on `SCENE_PORT` (default 3341, never 3300), so you always test the current sources. `SCENE_SERVER=preview` serves `dist/` instead.
- **Deterministic.** The seed comes from the spec (default 1), and the sim runs on fixed 60 Hz ticks. Every tick also renders one frame.
- **Outputs.** Each spec writes to `test-results/scenes/<name>[-webgpu][-low]/`:
  - `shot-NNNN.png`: the frame number after N ticks, taken once LOD0 streaming has settled.
  - `video.webm`: 20 fps, when `--video` or the spec's `video` is set.
  - `metrics.json`: everything below, plus `checks`, `consoleErrors` and `timing`.
- **Exit code.** It exits 1 when an `expect` gate fails or the scene throws. stdout gets a short JSON summary.
- **Speed.** A scene usually takes 5–8 s once the browser is open, and about 17 s with a video.

## Writing a spec

```jsonc
{
  "name": "bench-sitter",
  "seed": 1,
  "ground": "sidewalk",            // grass | asphalt | sidewalk | district (baked ground of layout.district)
  "size": 20,                       // square slab edge in metres (synthetic scenes)
  "time": "L1",                     // L1 (game morning), L2, L3, L4/golden, L5, L6, night
  "props": [{ "id": "bench", "asset": "prop.bench", "at": [0, 0], "yaw": 90, "scale": 0.95 }],
  "actors": [
    { "id": "sitter", "kind": "pedestrian", "at": [2.5, -3],
      "look": { "model": "npc.civilian-man-b", "tint": "#d8b04a", "handProp": "coffee" },
      "state": { "sit": "bench" } }
  ],
  "camera": { "mode": "close", "target": [0, 0.7, 0], "radius": 5, "azimuth": 150 },
  "frames": 300, "shots": [0, 300],
  "expect": { "consoleErrors": 0, "clippingMax": 0 }
}
```

**Coordinates.** Positions are game metres on the ground plane: `[x, z]`, and props may also give `[x, y, z]`. Yaw is in
degrees about +Y, with the same convention as layout placements. A yaw-0 asset faces its manifest `forward` (+X), and
a yaw-0 actor faces +X.

### Static content

- **`props`** take any manifest id (`src/assets/manifest.json`): `bld.*`, `prop.*`, `veh.*` (static) or `house.*` kit pieces. They are placed with the same record the Blender layout exporter writes, so collision, navigation, light groups and crowns match a shipped district.
- **`layout`** copies placements from a shipped district: `{ "district": "D-GROVE", "bbox": [[x0, z0], [x1, z1]], "assets": ["prop.flower-bed*", "prop.picket-fence"], "ids": [...], "recenter": true }`.
  - `assets` accepts a trailing `*` as a prefix match.
  - `recenter` moves the crop so its centre is at the origin.
  - `ground: "district"` keeps that district's baked roads and paving, and its surface and lawn polygons (so the bicycle's pavement rule and kerb heights work).
- **Static instances are baked at load.** Adding a prop with `place` reloads the scene, and the frame counter goes back to 0.

### Actors

| kind | notes |
| --- | --- |
| `courier` | The player entity; at most one. God mode is on by default (`"god": false` turns it off). She is empty-handed as at the L1 start; `"loadout": ["weapon.bat", "weapon.fists"]` arms her. `look.model`: `female` or `male`. With no courier, the player is hidden in a corner. |
| `pedestrian` | An L1 pedestrian (outbreak layer). `look`: `model` (`npc.civilian-man-a`/`-b`, `npc.civilian-woman-a`/`-b`, `npc.civilian-elderly`), `tint`, `accessories` (`cap`, `glasses`, `backpack`, `scarf`), `handProp` (`coffee`, `bag`, `phone`, `cane`, `watering-can`), `tier`, `role`. |
| `infected` | `archetype` (default `infected.runner`; see `src/data/infected.ts`). `count` and `spread` spawn a ring; the ids become `<id>-1` … `<id>-N`. Under L1 rules, runners get a pedestrian look. Infected see in a cone, so give them a `yaw` that faces their target. |
| `corgi` | The companion. It always follows the courier. |

**Spawn positions** must be on free navigation, not inside a collider. Otherwise the scene throws `... outside navigation`.

### Actions

Actions work as an actor's initial `state`, as a `script` step (`{ "frame": 60, "actor": "courier", "do": {...} }`) and through MCP `command`.

| Action | Applies to | What it does |
| --- | --- | --- |
| `"idle"` / `{ "idle": true }` | all | Stand still. |
| `{ "walk": [[x, z], ...], "loop": true }`, `{ "run": [...] }` | courier, pedestrian | Follow a path. The courier is driven like a keyboard player, so turns are crisp. A path that doubles back gives 180° turns. |
| `{ "moveTo": [x, z], "pace": "walk" }` | courier, pedestrian | Click-to-move with the game's pathfinding. |
| `{ "turn": deg }` | all | Turn to face that yaw; the courier turns on the spot. |
| `{ "sit": "<placement id or asset id>" }` | pedestrian | Sit on that prop, using the same seat rule as L1. |
| `{ "attack": "<actor id>", "seconds": 2 }` | courier | The real target-attack input. |
| `"chase"` / `{ "chase": "<actor id>" }` | infected | Chase. |
| `{ "hit": { "from": "<actor id>" or [x, z], "heavy": true } }` | all | A heavy hit is a knockdown. |
| `"infect"` / `{ "infect": { "by": "<infected id>", "instant": false } }` | pedestrian | The 3 s transformation; the same entity turns into an infected. |
| `{ "flee": [x, z] }` | pedestrian | Flee from that point. |
| `{ "mountBike": "<vehicle id>" }`, `{ "dismount": true }` | courier | A real interact press next to the bike. |

### Vehicles

`"vehicles": [{ "id": "sedan", "asset": "vehicle.sedan", "at": [0, 0], "yaw": 0, "path": [[16, 8]] }]`

- **Vehicle ids:** `vehicle.sedan`, `pickup`, `suv`, `police`, `ambulance`, `school-bus` and `fire-engine`.
- **Driving:** with a `path`, the real vehicle physics drives the car through a small autopilot (`Vehicles.autopilot`).
- **Bicycle:** `vehicle.bicycle` is the courier bike. It needs `sidewalk` ground, because of the game's parking rule.
- **Traffic:** `traffic` is the kinematic ambient-traffic box.

### Effects and timeline

`"script": [{ "frame": 20, "effect": { "wreck": "sedan" } }]`

- **Effects:**
  - `{ "blast": "explosion.car", "at": [x, z] }`: see `src/data/explosions.ts` for the ids.
  - `{ "wreck": "<vehicle id>" }`: the car explodes about 3 s later.
  - `{ "fire": [x, z] }` and `{ "smoke": [x, z] }`.
- **Other script steps:** `{ "frame": N, "camera": {...} }` and `{ "frame": N, "time": "night" }`.

### Camera

All camera modes use the game's 25° lens. A `target` is `[x, z]`, `[x, y, z]` or an actor id.

- **`game`:** `{ "mode": "game", "target": [x, z], "zoom": 1 }`. The game camera (radius 19 × zoom, polar 0.30π, azimuth 45°).
- **`follow`:** `{ "mode": "follow", "actor": "courier", "zoom": 0.6 }`. The same angle, tracking an actor every frame.
- **`close`:** `{ "mode": "close", "target": ..., "radius": 5, "azimuth": 150 }`. The game angle at a short radius.
- **`orbit`:** `{ "mode": "orbit", "target": ..., "radius": 10, "azimuth": 45, "polar": 54, "spin": 30 }`. `spin` is in degrees per second.
- **`pose`:** `{ "mode": "pose", "position": [...], "target": [...] }`.

### Expectations

`expect` sets gates; the runner exits 1 if one fails:

- `consoleErrors` (default 0)
- `clippingMax`
- `footSlideMaxCm`
- `footSinkMaxCm` (deepest sole below the floor, spawn frames 0-2 excluded)
- `undrawnFramesMax` (frames a living actor was inside the camera frustum but not drawn: invisible-but-active)
- `yawDriftMaxDeg`
- `torsoPitchMaxDeg`
- `drawCallsMax`
- `trianglesMax`

`clipping` takes these options:

- `ignore: [["a", "b"], ...]`: pairs of placement ids or asset ids.
- `ignoreFoliage: true`: skip pairs with a tree, bush or hedge (crowns rise behind houses and bushes stand in beds by design).
- `sameAsset: true`: also check chains of one asset. Fence and hedge runs share end posts by design, so they are skipped by default.
- `slackCm` (default 2).

## Reading metrics.json

- **`checks`.** Pass/fail per `expect` gate.
- **`consoleErrors`.** Console errors, page errors, failed requests and HTTP 4xx/5xx.
- **`metrics.perf`.** p50, p95 and max per frame:
  - `drawCalls` and `triangles`: the view pass, from the renderer `?profile` counters, including the PostFx scene pass.
  - `shadowDrawCalls` and `shadowTriangles`.
  - `stepMs`: CPU time of one sim tick plus render submission. It is not GPU time, so use the E18 perf suite for frame budgets.
  - `lastFrame.categories`: draws per crowd, buildings, props, other and shadows.
- **`metrics.actors.<id>`.** `position`, `yawDeg` and `state` (pedestrian, infected or corgi state, or the courier's animation). `drawnFrames` counts the frames in which the actor was actually drawn, and `lod` counts frames per detail tier. `motion` holds:
  - `contacts`: planted-foot periods. A foot is planted while its lowest sole point is within 1.2 cm of the ground. This is the rule in `tools/playeranim` and `tools/crowdfoot`.
  - `slideMaxCm`, `slideP95Cm`, `worstSlideFrame`: horizontal travel of a planted heel or toe. Above about 3 cm reads as skating. A worst frame of 1–5 is the spawn settle.
  - `yawDriftMaxDeg`: foot rotation while planted. Turning on the spot shows up here.
  - `liftMaxCm`: highest step.
  - `sinkMaxCm`: feet below the ground.
  - `torsoPitchMinDeg` and `torsoPitchMaxDeg`: hip to shoulders against vertical, positive leaning forward. The courier runs at about 3–11°. L1 infected lurch at 20–30° and hunch at about 50° when idle.
  - Seated, knocked-down and rising clips are excluded from the foot metrics. The corgi has paws: slide only, no yaw drift. A paw that skims within 1.2 cm of the ground during its swing counts as sliding, so the corgi's slide also catches paws dragging through the floor (see `sinkMaxCm`).
- **`metrics.lods`.** The current detail band of every placement (`lod0`, `lod1`, `lod2` or `culled`).
- **`metrics.visibility`.** Sim counts against drawn counts per kind in the last frame, such as infected alive in the sim against infected figures drawn. A gap with the subject on screen is a crowd or visibility bug.
- **`metrics.vehicles`.** Position, yaw, health and speed per vehicle id.
- **`clipping.static`.** Placement pairs whose LOD0 meshes cut through each other. Each entry has `a`, `b`, the asset ids, `intersectingTriangles` and the contact `region` box (with `regionCm`). Any entry is real interpenetration (for example, `flowerbed-fence` reported 1208 triangle pairs where the picket fence ran through the flower bed; both the fence and the remaining 14 × 9 cm contact are fixed in the layout, the scene is a gate now).
- **`clipping.actors`.** Rig bones (`thighL`, `shinR`, `spine`, `neck`, `upperArmL`, `foreArmR`, …) against prop meshes. `crossing: true` means the bone centre line pierces a prop surface. Otherwise `clearanceCm` is less than the bone's flesh radius minus `slackCm`, so the skin is inside the prop. The entry also gives the prop id, the worst `frame` and `count` (sampled frames with the hit). `bench-sitter` uses the game's seat anchors (`src/sim/npc/seats.ts`) and the authored squashed bench scale. With the full-height bench it pierced in 6 of 7 bones (the pelvis was about 6 cm under the 52 cm seat top); after the seat-anchor fix and the bench `hipX` 0.31 it reports nothing. A bone hit also carries `at`, the world point where the bone centre line pierces the surface.

**Limits:**

- Bones are probed on every third frame.
- Pushable props (such as benches) are checked at their authored pose.
- The courier's skeleton comes from the rig nodes, and crowd figures from the crowd pose palette (`CrowdFigureProbe` joints).
- Vehicles are not part of the clipping report.

## Common checks

- **Asset in isolation.** One `props` entry and an `orbit` camera with `spin` and `video` give a turntable in game lighting. Check `metrics.lods`, `perf.triangles` and `clipping.static` (pieces of a kit fighting each other).
- **Layout clipping.** Crop a district with `layout.bbox` and set `expect.clippingMax: 0`.
- **Seated or posed actors.** Use `sit` or another action plus `clippingMax: 0`, and screenshot with a `close` camera.
- **Locomotion.** Use courier `run` paths with turns and gate on `footSlideMaxCm` and `yawDriftMaxDeg`. Compare `--query skin=0` with the default.
- **Crowds.** Spawn `count` infected, then check `visibility` (sim against drawn), `perf.drawCalls` and per-actor `lod`.
- **Effects.** Script a `wreck` or `blast`, record a `video`, and check `consoleErrors`.

## MCP server

`npm run scene:mcp` starts a stdio MCP server (`@modelcontextprotocol/sdk` 1.32.1, MIT).

**Session.**

- **Browser and lock.** It opens one headless browser on the first scene call, and takes the e2e browser lock only then.
- **Idle close.** It closes the browser after `SCENE_MCP_IDLE` seconds idle (default 300). The `close` tool closes it at once.
- **Outputs.** Files go to `test-results/scenes/mcp/`.

**Tools:**

| Tool | What it does |
| --- | --- |
| `load_scene` | Loads `{spec}` or `{path}`, with optional `backend` and `tier`. |
| `place` | Adds a prop: `{asset, at, yaw, scale, id}`. Reloads the scene. |
| `spawn_actor` | Spawns an actor: `{kind, id, at, yaw, look, archetype, count, spread, state}`. |
| `command` | Gives an actor an action: `{actor, action}`. With `actor: "fx"`, the action is an effect. |
| `step` | Advances the scene: `{frames}`. |
| `set_time` | Sets the lighting preset: `{preset}`. |
| `set_camera` | Sets the camera: `{camera}`. |
| `screenshot` | `{name}`. Returns the PNG path and an inline 320 px thumbnail. |
| `metrics` | The metrics above. |
| `clipping` | The clipping report. |
| `describe` | Placement, actor and vehicle ids. |
| `reset` | Reloads the current spec, including spawned actors and placed props. |
| `close` | Closes the browser and releases the lock. |

**Claude Code.** Use a project-scoped `.mcp.json` at the repository root; this is an example and is not committed:

```json
{
  "mcpServers": {
    "scene-lab": { "command": "npx", "args": ["tsx", "tools/scenelab/mcp.ts"], "env": { "SCENE_PORT": "3341" } }
  }
}
```

The command form is `claude mcp add scene-lab --scope project -- npx tsx tools/scenelab/mcp.ts`. The first call can
wait for the shared browser lock, so raise the tool timeout with `MCP_TOOL_TIMEOUT=600000`.

**Codex.** Codex reads MCP servers from its own config (`~/.codex/config.toml` or a profile), so add a
`[mcp_servers.scene-lab]` table there. This changes your Codex config; Scene Lab does not change it for you.

```toml
[mcp_servers.scene-lab]
command = "sh"
args = ["-c", "cd /path/to/minorincident && npx tsx tools/scenelab/mcp.ts"]
tool_timeout_sec = 600
```

**Smoke test.** `npx tsx tools/scenelab/mcp-smoke.ts` is a scripted client. It runs load, spawn_actor, command, step,
set_time, screenshot, metrics and clipping.
