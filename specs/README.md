# Minor Incident: Specifications

This folder holds the specification for **Minor Incident**, a colorful isometric zombie action RPG that runs in the browser on Three.js. It is written so coding agents can take one epic at a time, build it, and prove it works without a human playing the game.

## Reading order

| File | Purpose |
| --- | --- |
| [00-game-concept.md](00-game-concept.md) | Full game concept: pillars, core loop, controls, combat, progression, vehicles, enemies, campaign |
| [01-art-direction.md](01-art-direction.md) | Visual language taken from `initial-drafts/`: palette, lighting, world-decay tiers, gore policy |
| [02-technical-architecture.md](02-technical-architecture.md) | Runtime architecture, conventions, the sim/render split, the test API contract |
| [03-asset-pipeline.md](03-asset-pipeline.md) | Codex imagegen → upscaled reference → Blender `bpy` build script → GLB → gltf-transform → game, plus asset contracts and validation |
| [06-lighting-shadows-reflections.md](06-lighting-shadows-reflections.md) | Lighting concept: five lighting layers, light field, hero lights, shadows, reflections, the Blender light-anchor contract |
| [07-physics-props-explosions-smoke.md](07-physics-props-explosions-smoke.md) | Movable objects, barricade building, explosion anatomy, smoke and fire |
| [08-bruno-reuse-map.md](08-bruno-reuse-map.md) | Every useful Bruno folio-2025 source file mapped to our epics, with its reuse mode (port / adapt / pattern) |
| [09-sound-design.md](09-sound-design.md) | Sound design: audio telegraphs, shared noise system, acoustics, adaptive music, ambience per tier, mix, measurable tests, licensing |
| [10-music-sources.md](10-music-sources.md) | Researched MIT-compatible music (CC0 / CC-BY) per level and slot |
| [05-asset-inventory.md](05-asset-inventory.md) | What exists today (drafts, upscaled, modeled), what is missing, and the production order |
| [04-epics-overview.md](04-epics-overview.md) | Epic map, dependencies, milestones, epic template, Definition of Done |
| `epic-NN-*.md` | One file per epic, each with acceptance criteria that can be checked automatically |
| [90-test-concept.md](90-test-concept.md) | How a coding agent tests a game it cannot play by hand |
| [91-test-plan.md](91-test-plan.md) | Concrete suites, test IDs, commands, pass criteria, epic-to-test traceability |
| [99-open-questions.md](99-open-questions.md) | Decision log: open questions answered by the product owner (2026-10-05) |
| `status.json` | Epic status (`todo` / `in-progress` / `done`) read by `verify` and the traceability test |

## Source material

- `initial-drafts/*.png`: 11 concept sheets (10 asset packs plus 1 gameplay mockup)
- `folio-2025/`: Bruno Simon's 2025 portfolio, our **technology reference** (analysed in `docs/bruno-reference/`)
- Blender 5.2 LTS (`/Applications/Blender.app`): asset build tool, run headless from agent-written `bpy` scripts
- `assets/fire-engine/`: a legacy img2threejs study. Its upscaled reference and measured spec feed the Blender rebuild (the pipeline pilot).

## ID conventions

- Epics: `E01` … `E28`
- Acceptance criteria: `E05-AC03`
- Tests: `T-E05-03` (normally 1:1 with an acceptance criterion; extra tests get a suffix such as `T-E05-03b`)
- Levels: `L1` … `L6`. Districts: `D-RES`, `D-MAIN`, `D-SCHOOL`, `D-SHOP`, `D-CIVIC`, `D-PARK`, `D-ZOO`, `D-EDGE`
- World-state tiers: `W0` (normal) … `W5` (destroyed)

## Language rule for criteria

Each acceptance criterion is written as an **observable, machine-checkable statement**: a value in the state snapshot, an event in the event log, a pixel or screenshot property, a performance counter, or a file that exists and validates. Criteria that need visual judgment name the screenshot spot and the review checklist the agent applies (see [90-test-concept.md](90-test-concept.md) §7).
