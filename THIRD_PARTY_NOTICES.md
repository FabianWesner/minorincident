# Minor Incident third-party notices

The following source adaptations use Bruno Simon's folio-2025 (MIT,
copyright 2025 Bruno Simon):

| Reference | Local adaptation |
| --- | --- |
| `Game.js` | `src/core/Services.ts`, `src/main.ts`, `src/Game.ts` — staged boot and injected ownership |
| `Events.js` | `src/core/EventBus.ts` — ordered callback buckets |
| `Ticker.js` | `src/core/Ticker.ts` — render ticker, with a separate fixed sim clock |
| `Physics/Physics.js` | `src/physics/Physics.ts` — Rapier service, fixed timestep and disposal |
| `Physics/PhysicsWireframe.js` | `src/render/PhysicsWireframe.ts` — debug collider buffers |
| `Debug.js` | `src/debug/Debug.ts` — dev-only Tweakpane |
| `Materials/MeshGridMaterial.js` | `src/render/MeshGridMaterial.ts` — trimmed XZ grid shader |
| `utilities/maths.js` | `src/core/maths.ts` — clamp and lerp |

| `Inputs/Inputs.js` | `src/input/Buttons.ts` — action sources and latched edges |
| `Inputs/Keyboard.js` | `src/input/devices/Keyboard.ts` — keys, blur release and disposal |

| `Inputs/Inputs.js` | `src/input/InputSystem.ts` — input phase, action map and schemes |
| `Inputs/Pointer.js` | `src/input/devices/Pointer.ts` — mouse events and suppression |
| `Inputs/Wheel.js` | `src/input/devices/Wheel.ts` — normalized selector direction |
| `RayCursor.js`, `Inputs/Nipple.js` | `src/input/devices/RayCursor.ts` — ground-plane ray math |

| `Inputs/Nipple.js` | `src/input/devices/Nipple.ts` — radial progress/angle, floating DOM presentation |
| `Inputs/InteractiveButtons.js`, `Inputs/Pointer.js` | `src/input/devices/Touch.ts` — touch actions and independent contact ownership |

| `Player.js` (41046b5) | `src/sim/entities/Player.ts`, `src/sim/locomotion/KinematicController.ts` — input intent before physics, survivor pose after physics |
| `View.js` (41046b5) | `src/render/View.ts` — focus, aspect adaptation, shake and cinematic blending |
| `Rendering.js`, `Viewport.js` (41046b5) | `src/render/Renderer.ts` — backend bootstrap and pixel ratio |

| `Materials/MeshDefaultMaterial.js`, `Materials.js` (41046b5) | `src/render/PaletteMaterial.ts`, `src/render/Materials.ts` — palette texture, captured tinted shadows, core shade, bounce, normalized HDR emissive |
| `Ligthing.js`, `Fog.js`, `Cycles/DayCycles.js` (41046b5) | `src/render/Lighting.ts`, `src/data/timeOfDay.ts` — fitted sun shadows, coherent level moods and fog |
| `Rendering.js`, `Passes/cheapDOF.js` (41046b5) | `src/render/PostFx.ts` — bloom and optional edge-only hash blur |
| `InstancedGroup.js` (41046b5) | `src/render/InstancedGroup.ts` — shared mesh batches and dirty placement updates |
| `PreRenderer.js` (41046b5) | `src/render/GameView.ts`, `src/Game.ts` — shader warm-up before screenshotReady (compileAsync plus two rendered frames) |

| `Explosions.js` (41046b5) | `src/sim/combat/Damage.ts` — radial splash falloff and direction-scaled impulse, without singleton/render dependencies |

All folio-2025 adaptations above reference commit `41046b5`.

## Bruno Simon MIT license

Copyright (c) 2025 Bruno Simon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Dependencies

Three.js, Vite, TypeScript, Vitest, ESLint, typescript-eslint, Tweakpane, tsx,
pixelmatch, pngjs and DefinitelyTyped types use MIT or the permissive licenses
distributed with those packages. Rapier and Playwright use Apache-2.0.
Project dependency versions are pinned in package-lock.json. Wrangler is a
deploy-only tool invoked through npx and is not a project dependency.
No reference art, meshes, textures, or audio from folio-2025 are reused.

E10 district assembly and placement-empty batching adapt the patterns in Bruno Simon's
`World/World.js` and `References.js` (folio-2025, MIT, commit 41046b5) in
`tools/blender/sslib/layout.py`. GPU grass/wind uses the same MIT notice.

E10 also adapts `World/Grass.js` / `Wind.js` in `src/render/Grass.ts`,
`World/World.js` / `References.js` in `src/render/DistrictView.ts`, and the
`TextCanvas.js` canvas-sign pattern for fictional landmark signage (same MIT source).
