# E12 · Missions, Objectives and Level Flow

## Goal
A data-driven mission system that drives each level from briefing to the "…but" twist. It covers objectives, triggers, timers, checkpoints, scripted events (spawns, cutscenes, radio lines), win and fail conditions, and the level result.

## Depends on / Enables
E04, E10 / E13, E14, E19–E24.

## Scope
**In:**
- **`MissionDef`:** an ordered and parallel graph of **objective steps** (`reach`, `interact`, `kill`, `killAll`, `survive(time)`, `defend(target, time)`, `escort(npc, to)`, `collect(items)`, `drive(to)`, `custom`), each with `start/complete/fail` triggers and an optional timer.
- **Trigger system:** volumes (enter/exit), events (`combat.kill` filtered), timers, and conditions (counts, states).
- **Script actions:** spawn group, start migration, set tier layer, open/close gates, play radio line (subtitle), camera cinematic (letterboxed, skippable), set time of day, grant item, set checkpoint, set objective marker.
- **Checkpoints:** a snapshot of mission state plus player stats; restore on death.
- **Fail conditions:** escort died, timer expired, defend target destroyed. Each fail goes to a retry screen (from the last checkpoint or the level start).
- **Level result:** time, kills, damage taken, deaths, rescued count, optional objectives, then the progression screen.
- **Objective markers:** world-space marker, HUD tracker, minimap.
- **Twist cutscenes:** in-engine scripted camera plus caption ("Mission successful. Outbreak not contained.").

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Zones.js`](../folio-2025/sources/Game/Zones.js): trigger volumes
- [`Respawns.js`](../folio-2025/sources/Game/Respawns.js): checkpoint respawns
- [`View.js`](../folio-2025/sources/Game/View.js): cinematic camera blending
- [`Notifications.js`](../folio-2025/sources/Game/Notifications.js): objective toasts

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E12-AC01 | `MissionDef` schema validation catches unreachable steps, unknown IDs, and missing triggers (unit tests with broken fixtures) | unit |
| E12-AC02 | Objective types: each type has a sim test in `mission-sandbox` that completes it via the test API and emits `objective.started` / `objective.completed` in order | sim |
| E12-AC03 | Parallel objectives (L4 style "3 of 3 tasks in any order") complete in any permutation (all 6 permutations tested) | sim |
| E12-AC04 | Timers: a `reach` with a 120 s timer fails at 120 s ±1 tick with `mission.failed{reason:'timeout'}`; completion before the timer cancels it | sim |
| E12-AC05 | Checkpoint restore: dying after checkpoint C restores objective state, player HP (full), loadout charges, and escorts at C; already-killed scripted bosses stay dead | sim |
| E12-AC06 | Cinematics: skippable by any action input after 0.5 s; skipping lands in the same sim state as watching (state hash of the gameplay-relevant subset equal) | sim/e2e |
| E12-AC07 | `cheats.completeObjective()` advances exactly one step. A test walks every level's mission graph this way from start to `level.completed` (the mission graph is structurally completable) | sim |
| E12-AC08 | Objective markers point to the active objective's anchor; the HUD tracker shows the text and distance; off-screen markers clamp to the screen edge with a direction arrow | e2e/visual |
| E12-AC09 | The level result screen lists time, kills, damage, deaths, and rescued, and the values equal those in the sim's event log | e2e |
| E12-AC10 | Radio lines show subtitles and are logged as `dialogue.line` events with IDs; every line ID used in levels exists in `src/data/dialogue.ts` | unit |
