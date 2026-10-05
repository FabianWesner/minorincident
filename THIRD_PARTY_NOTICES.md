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
glTF Transform and meshoptimizer use MIT; sharp uses Apache-2.0.
No reference art, meshes, textures, or audio from folio-2025 are reused.
