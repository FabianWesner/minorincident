# Minor Incident: Specifications

This folder holds the specification for **Minor Incident**, a colorful isometric zombie action RPG that runs in the browser on Three.js. It is written so coding agents can take one epic at a time, build it, and prove it works without a human playing the game.

## Reading order

| File | Purpose |
| --- | --- |
| [00-game-concept.md](00-game-concept.md) | Full game concept: pillars, core loop, controls, combat, progression, vehicles, enemies, campaign |
| [po-levels-4-9-2026-10-11.md](po-levels-4-9-2026-10-11.md) | Highest-priority PO campaign source for L4–L9 and later Alpha/zoo health-bar/special-move and L10 updates; wins over older specs |
| [po-levels-2-6-2026-10-07.md](po-levels-2-6-2026-10-07.md) | Earlier verbatim L2–L6 design; still authoritative for L2–L3 and compatible L4–L6 content |
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

- Epics: `E01` … `E31`
- Acceptance criteria: `E05-AC03`
- Tests: `T-E05-03` (normally 1:1 with an acceptance criterion; extra tests get a suffix such as `T-E05-03b`)
- Levels: `L1` … `L9` designed; L10 grand finale storyline pending. Districts: `D-GROVE` (L1), `D-RES`, `D-MAIN`, `D-SCHOOL`, `D-SHOP`, `D-CIVIC`, `D-PARK`, `D-ZOO`, `D-EDGE`, `D-CORRIDOR` (L3), `D-FAIR` (L4/L5/L7, Fairhaven), `D-SUBWAY` (L6), `D-CROSSING` (L9); existing `D-ZOO` becomes the L8 zoo campaign district
- World-state tiers: `W0` (normal) … `W5` (destroyed) → new `W6` (completely destroyed Fairhaven, L7)

## Language rule for criteria

Each acceptance criterion is written as an **observable, machine-checkable statement**: a value in the state snapshot, an event in the event log, a pixel or screenshot property, a performance counter, or a file that exists and validates. Criteria that need visual judgment name the screenshot spot and the review checklist the agent applies (see [90-test-concept.md](90-test-concept.md) §7).

## Campaign epic index

| Level | Specification |
| --- | --- |
| L1 | [E19 · Stop the Outbreak](epic-19-level-1-stop-the-outbreak.md) |
| L2 | [E20 · The Failed Rescue](epic-20-level-2-the-failed-rescue.md) |
| L3 | [E21 · The Police Collapse](epic-21-level-3-the-police-collapse.md) |
| L4 | [E22 · The Safe City Falls](epic-22-level-4-the-safe-city-falls.md) — updated internal outbreak, first Alphas, solitary basement ending |
| L5 | [E23 · Aftermath](epic-23-level-5-aftermath.md) — shotgun at start, sparse Alphas, populated metro/closing doors |
| L6 | [E24 · The Subway](epic-24-level-6-the-subway.md) — night exit hands over to L7 |
| L7 | [E29 · The Ruined City](epic-29-level-7-the-ruined-city.md) — W6 Fairhaven, unlimited rocket launcher, evacuation bus |
| L8 | [E30 · The Zoo](epic-30-level-8-the-zoo.md) — false sanctuary, infected animals with bars/specials, armored escape |
| L9 | [E31 · The Crossing](epic-31-level-9-the-crossing.md) — open routes, temporary vehicle durability, on-foot continuation |
| L10 | Grand finale — storyline from the PO pending; no epic yet |

Shared [E07](epic-07-infected-ai-and-hordes.md) defines Alpha resistance/health bar/four moves and all five zoo species' bars/ten moves, including derived infected elephant/zebra. New/changed acceptance criteria are explicitly marked; implementation plans list lanes ≤ 3 h and reuse existing systems/assets. New T-ids and planned move scenes are indexed in [91-test-plan.md](91-test-plan.md).
