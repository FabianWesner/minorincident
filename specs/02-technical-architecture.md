# 02 · Technical Architecture

The Bruno Simon folio-2025 checkout is the **technology reference** (`docs/bruno-reference/`). We keep its strengths: staged boot, ordered update phases, a palette-based stylized material, instancing, GPU wind, and the narrow-FOV camera. We change two things on purpose. Simulation is **fixed-step and headless-capable**, and ownership uses **services and lifecycles instead of a global singleton graph**.

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript (strict) | `npm run typecheck` must pass |
| Build | Vite | Already used in the repo (`vite.config.ts`) |
| Rendering | Three.js (`three/webgpu`, `WebGPURenderer` with automatic WebGL2 fallback) and TSL node materials | `?renderer=webgl` forces WebGL2; tests always force it (see 90 §4) |
| Physics | `@dimforge/rapier3d-compat` | Vehicles, destructibles, static colliders. Infected do **not** get rigid bodies. |
| Audio | Web Audio API graph (HRTF panners, convolver reverb zones, filters, ducking, limiter) + Howler for loading and sprites | `09-sound-design.md`, E16 |
| Animation | GSAP for UI and cinematics; procedural rigid-part clips for characters | See §6 |
| Assets | Blender 5.2 (headless, `bpy` scripts) → GLB → gltf-transform (meshopt, KTX2) | `03-asset-pipeline.md` |
| Unit and sim tests | Vitest (Node) | Headless sim tests import `src/sim` only |
| Browser tests | `@playwright/test` (Chromium, plus WebKit and mobile emulation for smoke) | |
| Image diff | `pixelmatch` + `pngjs` | Visual regression |
| Debug UI | Tweakpane (dev only, `?debug`) | |

## 2. Repository layout (target)

```
index.html                 game entry (the asset preview moves to /preview/)
src/
  main.ts                  boot: services → loading → menu
  core/                    Clock (fixed step), Rng (seeded), EventBus (ordered phases), Services, Lifecycle
  sim/                     PURE game logic: no DOM, no WebGL. May import `three` math classes only.
    world/ entities/ combat/ ai/ vehicles/ missions/ progression/ spatial/
  physics/                 Rapier wrapper used by sim (works in Node)
  render/                  scene, camera, materials (palette), instancing, vfx views, decay layers
  input/                   devices → InputFrame (pure data) → sim commands
  ui/                      HUD, menus, touch controls (DOM + CSS)
  audio/
  assets/                  registry.ts (GLTFLoader + Meshopt/KTX2, palette swap), manifest.json, placeholders.ts
  levels/                  L1..L6 level data, districts/*.ts (gameplay anchors, triggers, spawns, gameplay decay), loader for layout GLB/JSON
layouts/<district>/layout.py   Blender layout scripts (static world + visual decay) → public/assets/layouts/
  data/                    weapons.ts, infected.ts, upgrades.ts, vehicles.ts, balance.ts
  debug/                   testApi.ts (window.__SS__), bot/, scenarios/, overlays
tests/
  unit/  sim/  e2e/  visual/  perf/  fixtures/
tools/                     sim-runner (Node CLI), asset validator, screenshot tools
specs/                     this folder
```

## 3. Conventions

- **Units:** 1 unit = 1 meter. **Y up.** Gravity −9.81.
- **Forward axis: +X** for every asset and entity in local space. This matches the fire engine study (`object-sculpt-spec.json`: front = +X) and Bruno's vehicle. In Blender (Z-up) assets face +X; the glTF Y-up export keeps +X. Character models also face +X.
- **Ground plane:** XZ, sea level y = 0. Districts are laid out on a 1 m grid; the whole town fits in ±400 m.
- **Time:** sim tick = **1/60 s fixed**. Render interpolates between the last two sim states. Catch-up is capped at 5 ticks per frame. Gameplay timers use sim time only; UI uses real time.
- **Randomness:** all gameplay randomness goes through `Rng` streams seeded from `(levelSeed, streamName)`. `Math.random` is banned in `src/sim` (a lint rule enforces this).
- **IDs:** entities have numeric IDs, and data definitions have string IDs (`weapon.bat`, `infected.runner`, `vehicle.sedan`, `asset.fire-engine`).
- **Data-driven:** weapons, infected, upgrades, vehicles, levels, and objectives are typed data modules with schema validation at boot (a failure is a hard error in dev and tests).

## 4. Runtime layers

```
Input devices ──► InputFrame (per tick, pure data) ──► Commands
                                                       │
                              ┌────────────────────────▼───────────────────────┐
                              │  SIM (fixed 60 Hz, deterministic, headless-OK)  │
                              │  world · entities · AI · combat · vehicles      │
                              │  physics(Rapier) · missions · progression       │
                              │  emits GameEvents (typed, logged)               │
                              └────────────────────────┬───────────────────────┘
                                                       │ snapshot (read-only)
            ┌──────────────────────────┬───────────────┼──────────────┬───────────────┐
         render (Three)             vfx views        audio          UI/HUD          test API
```

- **The sim never reads render state.** Render and audio react to sim snapshots and `GameEvents`.
- **Ordered phases** (Bruno's `Events` and `Ticker` pattern): `0 input → 1 player intent → 2 AI → 3 physics step → 4 combat resolve → 5 missions → 6 cleanup` per sim tick. Then per frame: `camera → render-sync → vfx → audio → ui → render`.
- **Lifecycle:** every service and entity implements `init / update / reset / dispose`. Level unload must leave zero live entities, physics bodies, event listeners, or GPU resources beyond shared caches (tested by `T-E01-07`).

## 5. Entity model

A small component store (no full ECS framework): `Transform`, `Health`, `Faction`, `Locomotion`, `Brain`, `Weapons`, `Vehicle`, `Interactable`, `Destructible`, `Escort`, `RenderRef`. Systems iterate typed arrays or maps. A spatial hash (cell 4 m) answers neighbor and hit queries. The sim is pure and the components are serializable, which gives us `getState()` and snapshots.

## 6. Characters and crowds

- Models are **GLBs built from Blender `bpy` scripts** (`03-asset-pipeline.md`) as **rigid-part hierarchies** (separate nodes with pivots at joints such as `hip`, `torso`, `head`, `armL`, `foreArmL`, `legL`, `shinL`, `weaponSocketR`). Animations are **procedural clips** (pivot rotations over time) defined in data: idle, run, attack-swing, shoot, throw, hurt, die, lunge, crawl.
- Crowds: each infected archetype is baked into **one merged geometry with a `partIndex` vertex attribute**. Per-instance part transforms are evaluated on the GPU from a clip texture (vertex animation for rigid parts). One `InstancedMesh` per archetype material gives about 1 draw call per archetype. Heroes (the player, the corgi, escorts, elites) use the normal hierarchy.
- Dismemberment: detaching a limb hides that part (for crowd instances, its scale is set to 0 in the part-transform texture), shows the stump-cap node, and spawns a pooled physics gib using the limb's geometry.
- LOD: infected beyond 35 m drop to half-rate animation, and beyond 60 m are culled or impostors.

## 7. Rendering

- Shared **palette material** (TSL, Lambert-based plus core shadow, tinted drop shadow, bounce, fog), adapted from Bruno's `MeshDefaultMaterial`. Generated assets get remapped to palette materials at registry load (`03-asset-pipeline.md` §5).
- Bloom (threshold 1, strength about 0.25). Optional cheap DOF. Shadows are fitted to the camera's optimal area.
- `InstancedGroup` for repeated props (fences, lamps, cones, trees, parked cars).
- **Decay layers:** a district is `base layout + layer[W1..W5]`, where each layer adds, removes, or swaps prop instances and sets lights and materials (E10).
- Quality tiers `high | low | auto` (E18).

## 7b. Lighting, props and explosions

- **Lighting** is layered (emissive + bloom, the **light field** pass, hero lights, beams and flares, reflections). Light anchors come from GLB extras. Power state lives in the sim; light visuals live in `src/render/lighting/`. See [06](06-lighting-shadows-reflections.md) and E25.
- **Physics props and barricades** are sim entities (Rapier in the fixed step): sleeping bodies, instanced views updated only while awake, and an awake budget. See [07](07-physics-props-explosions-smoke.md), E26.
- **Explosions** split into a sim part (`ExplosionDef`: damage, impulse, chains) and a view part (`BlastFxPreset`). Slow-motion is a deterministic sim time-scale event (E27).
- **Reuse:** before building any subsystem, check [08-bruno-reuse-map.md](08-bruno-reuse-map.md).

## 8. Test API contract: `window.__SS__`

The API is only present when `?test=1` (or in dev). The full semantics are in [90-test-concept.md](90-test-concept.md). The surface is a **stable contract**, versioned by `__SS__.version`.

```ts
interface SSTestApi {
  version: string;                         // semver of this API
  ready: Promise<void>;                    // resolves when boot + current level loaded
  // time
  pause(): void; resume(): void;
  step(ticks: number): Promise<void>;      // advance sim exactly N ticks (paused mode), renders once
  setTimeScale(x: number): void;           // 0..20, sim-time only
  tick(): number;                          // current sim tick
  // loading
  loadLevel(id: 'L1'|'L2'|'L3'|'L4'|'L5'|'L6'|string, opts?: { seed?: number; checkpoint?: string; tier?: 0|1|2|3|4|5; progression?: ProgressionPreset }): Promise<void>;
  loadScenario(name: string, opts?: { seed?: number }): Promise<void>;   // tests/fixtures/scenarios/*
  // state & events
  getState(): GameStateSnapshot;           // JSON-serializable (player, entities summary, mission, progression, perf counters)
  getEntity(id: number): EntitySnapshot | null;
  query(filter: { kind?: string; archetype?: string; within?: { x: number; z: number; r: number } }): EntitySnapshot[];
  events(sinceTick?: number): GameEvent[]; // typed event log (ring buffer 10k)
  // control
  input: { set(frame: Partial<InputFrame>): void; clear(): void };       // injects logical input (bypasses devices)
  spawn(defId: string, pos: { x: number; z: number }, opts?: object): number;
  teleport(entityId: number | 'player', pos: { x: number; z: number }): void;
  setLoadout(left: string[], right: string[]): void;
  cheats: { god(on: boolean): void; infiniteCharges(on: boolean): void; killAll(): void; completeObjective(id?: string): void };
  bot: { start(policy?: 'complete' | 'newbie' | 'idle' | 'aggressive'): void; stop(): void; status(): BotStatus };
  // presentation
  camera: { preset(name: string): void; follow(): void };   // named photo spots per level
  settings: { set(patch: Partial<Settings>): void };
  perf(): { fps: number; frameMs: number; simMs: number; drawCalls: number; triangles: number; geometries: number; textures: number; entities: number };
  screenshotReady(): Promise<void>;        // resolves when all pending assets/shaders compiled and 2 frames rendered
}
```

**Headless sim runner:** `tools/sim-runner` loads the same `src/sim` and `src/levels` in Node, with no renderer. It runs a level with a bot policy, seed, and tick budget, and writes a JSON report (`outcome`, `ticks`, `deaths`, `damageTaken`, `kills`, `objectiveTimeline`, `maxConcurrentInfected`, `simMsP95`). This is the workhorse for balance and completion tests.

## 9. Error and robustness rules

- A console error during any e2e test fails the test (allow-list in `tests/e2e/console-allowlist.ts`).
- Asset load failure shows a fallback placeholder (magenta-striped box), logs `asset.missing`, and in test mode fails the asset test.
- WebGPU unavailable → WebGL2 automatically. WebGL2 unavailable → a friendly error screen.

## 10. Reuse from folio-2025

MIT license. Keep the notice in `THIRD_PARTY_NOTICES.md` when copying code. Candidates to port and adapt: `Ticker`/`Events` (ordered phases), `Inputs` action map and `Nipple` touch stick, `View` camera math, `MeshDefaultMaterial`, `Materials` palette handling, `InstancedGroup`, `PhysicsVehicle` + `VisualVehicle`, `Grass` / `Tracks`, `cheapDOF`, `ResourcesLoader`, `Quality`. Do **not** port the portfolio areas, server, whispers, or the singleton graph.
