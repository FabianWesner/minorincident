# E27 core — explosions, fire and smoke

Lane `e27-core` (wave 2), 2026-10-07. This is the campaign core from the staging decision in specs/04 §6. It is not the whole epic. `specs/status.json` E27 is set to `in-progress`. No spec criteria were changed. Nothing was pushed, merged into main or deployed. Branch: `worktree-agent-a28879405b25c37ba`; main was merged in twice, most recently at `80d39cc7` (E25 light field and the L2/L3 art).

## What was built

- **Data** (`src/data/explosions.ts`): `ExplosionDef` defines the damage curve `damage × (r − falloff·d)/r`, radius, impulse, upward bias, knockback, barricade and vehicle multipliers, chain fuse, aftermath fires, slow-mo and mega stages. `BlastFxPreset` covers the small, medium, large, mega and incendiary looks. A validator runs, and every explosive source references a def:
  - propane and barrel hazards
  - grenade, pipe bomb, rocket and molotov (their numbers are mirrored from the action catalog, so they cannot diverge)
  - cars
  - the scripted gas station (pump → canopy → tanks)
- **Sim** (`src/sim/combat/Explosions.ts`): one deterministic `blast()` entry point, ported from Bruno's `Explosions.js`.
  - Damage needs line of sight. Static walls and braced barricades give cover; loose props and other explosives do not.
  - Barricade rails take damage measured to the rail segment.
  - Vehicles go through `Vehicles.damage`.
  - The radial impulse has an upward bias and mass-scaled linear falloff. It is queued and applied one tick later to props, debris, cars and car parts. While it acts, props may stay awake up to 60 (low-tier cap) instead of freezing at 12.
  - Car blasts make the wreck jump, and doors and hood detach as pooled bodies (≤ 12, 30 s life).
  - Aftermath fires are E11 fire hazards. They damage and ignite flammables, spread once at half life (cap 24) and burn out.
  - Mega stages are scheduled. The sim emits audio `explosion.beat` events (crack, debris, roar, boom for stages) and `explosion.slowmo` when the player is within range.
  - Hazards, throwables and cars now route through `blast()`; the old inline loops were removed. Throwables keep their E05 damage resolver (`damage: false`) and only add impulse, fx and barricade effects.
- **Smoke gameplay**: `ActionEffects.smokeBlocks()` tests whether a cloud covers the sight segment. In `InfectedSystem`, a chasing infected whose sight line crosses a cloud drops to wander and emits `ai.lostTarget`, and idle sight checks are blocked the same way. The generic AI only; the L1 brain is unchanged.
- **View** (`src/render/vfx/Blasts.ts`, owned by `Vfx`), all fixed pools with TSL motion:
  - flash, capped by flash reduction
  - fireball from up to 48 noise-dissolved spheres with a fire gradient (ported from Bruno's `Fireballs.js`)
  - dust ring and spark/burning-fragment bursts on the E15 particle pool
  - smoke columns and smoke-grenade clouds from up to 400 puffs (120 on low), lit orange underneath, wind-bent, and dimmed inside the shared see-through hole
  - flame cards plus additive ground light pools. The town's custom `PaletteMaterial` ignores three.js lights, so fire light is faked on the ground and `Blasts.lights()` exposes the sources for E25.
  - scorch decals (64, not gated by gore) and charred car panels
- **Camera and clock**: `View.roll()` adds a roll kick that scales with distance and is off when camera shake is off. Bullet time ramps in `Game` (`seconds × blasts.timeScale`), behind a new `slowMotion` setting (default on; persisted in UI and campaign saves).
- **Wrecks and placeholders**: an exploded car's paint chars via a new `char` uniform on `PaletteMaterial` and the vehicle Lambert copies. Fire hazards no longer show the blue E11 placeholder slab.
- **Fixtures and test API**: `blast-lab`, `blast-stress` and `smoke-lab`; photo spots `blast`, `blast-wide` and `blast-car` (game-camera geometry); test API `explosions.blast / wreck / state`.
- **Credits**: `THIRD_PARTY_NOTICES.md` and `tools/credits/generate.ts` updated, and `src/data/credits.ts` regenerated.

- **Light field (E25, arrived with the second main merge)**: blast flashes, persistent fires (flickering, removed when the fire ends) and a 5 s town-wide orange mega tint feed `LightField.addTransient`, so fires light the night (`night-fires.png`, mean luminance .20 → .30).

Shared files were edited narrowly:
- `Game.ts`: 3 lines.
- `SimWorld.ts`: field, construction, reset and fixture hook.
- `GameView.ts`: roll/focus targets, slow-mo setting, photo spot.

Commits: `07d31e61`, `e86cf207`, then a tuning commit, `f4af8cd8`, and the main merge.

## Acceptance coverage

| AC | Status |
| --- | --- |
| 01 | Delivered (unit) |
| 02 | Delivered: per-class curve ±2 % at 0/50/100 %; upward bias, mass scaling, applied +1 tick; cover and barricade |
| 03 | Delivered: frames at ticks 0/2/6/15/40/180/900 with luminance / fire-hue / ring-spread / sparks / gray / decal detectors |
| 04 | Delivered: 5 tanks chain at 0.3 s per link; a 14-tank stack shows ≤ 8 links in any 60-tick window |
| 05 | Delivered: sim rise ≥ 0.5 m, door/door/hood bodies, `exploded` plus charred paint, fires ≥ 20 s; browser check that the column still rises at 20 s |
| 06 | Partial: stage order, ≥ 80 % kills in 12 m and slow-mo only within 15 m are tested. The 5 s light-field tint is wired (a 90 m `addTransient`) but has no automated test. There is no L5 content yet |
| 07 | Delivered: max per-frame full-screen luminance Δ with reduction is small .046, medium .044, large .060, mega .156 (limit .20) |
| 08 | Delivered: all infected inside lose their target ≤ 30 ticks after the cloud forms; no attacks while it lasts; cloud ends at exactly +720 ticks; browser readability shot |
| 14 | Delivered: gas station plus a 6-tank chain (9 blasts). Peak particles 2048/2048 (the E15 ring overwrites the oldest), puffs 234/400, fireballs 48/48, debris 0, parts ≤ 12. All E27 pools and fires return to zero after the fires burn out (+30 s) |
| 09, 10, 11, 12, 13, 15 | Deferred. Each has a `test.skip` placeholder tagged with its AC: toxic/tear gas, extinguisher, night/siren-lit smoke (needs E25), player rim under smoke (core only dims puffs in the see-through hole), L6 landmark columns and shadow strips, orchestrator vision review. These remain later increments in the spec |

Also deferred: building fires by decay tier, heat haze, screen refraction ring, window shatter, grass flattening, tinnitus wiring and exhaust/tire smoke.

## Performance

Worst case in `blast-stress`, measured over 7 s after the first blast: car explosion chaining into a propane tank and a barrel, 8 fires, a smoke column and 30 chasing infected (god mode; about 16 die in the blasts). Headless Chrome on ANGLE Metal (Apple M4), vsync off.

| Profile | Frame p95 / budget | Sim p95 / budget | Max frame |
| --- | --- | --- | --- |
| Desktop high, 1600×900 | 9.8 / 16.7 ms | 0.7 / 4 ms | 39-44 ms (one frame about 2 s after the first blast; was 161 ms before the final main merge) |
| Phone low, 390×844, 4× CPU throttle | 13.1-14.3 / 33.4 ms | 2.6 / 6 ms | 45-48 ms (same frame; was 152 ms) |

The frame falls exactly 120 ticks after the blast kills, when dead infected become static corpse pages (crowd-feel `StaticCorpses`: first page bakes geometry and compiles a material). After merging main (crowd LOD/visibility fixes, light field) the worst frame is 39-48 ms in three runs, under the 50 ms target; no E27 or corpse code was changed. A remaining first-use cost of this size is in the crowd lane's corpse path (a prewarm of the first page would remove it).

This uses the synthetic fixture with placeholder props. It is not a real-phone GPU measurement.

## Validation

| Command | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint` | PASS |
| `sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=2` | PASS: 88 files, 285 tests |
| `E2E_PORT=3327 npm run verify -- E27` | PASS: typecheck, lint, build; Vitest 15 passed (6 deferred placeholders skipped); Playwright 33 passed, including the E27 browser and perf specs plus smoke |
| `E2E_PORT=3327 npm run test:smoke` | PASS: Vitest 6, Playwright 25 |

I also ran all of `tests/sim` and `tests/levels`: 5 of 452 tests failed.
- `T-E26-07` fails on main too: a later PropSystem change keeps the displaced pose, while the test expects home.
- The L1 bot time bands (`T-E19-02`, `T-E19-03`) and civilian idling (`T-E19-05`) also fail on main's code. That check was run on this machine under the same load.
- `l1-ride-input` timed out at 30 s under load.

None of these are E27 tests. E26 and E19 criteria are outside this lane.

## Open issues

- The single 150–160 ms hitch about 2 s after the first blast; see Performance.
- Smoke is not darkened at night (AC11). It reads as light gray against the night ground.
- E15's purple smoke burst still rises on top of the E27 smoke-grenade cloud.
- The medium blast's scorch decal plus the E15 explosion decal read as a large dark disc.
- Columns leave the top of the game-camera frame. Landmark framing is AC13/L6 work.
- Fixture props render as placeholder boxes in labs; that is the E26 fixture view.

Evidence (git-ignored, in this worktree): `test-results/epics/E27/` — frames, detector JSON, flash JSON, budgets JSON, perf JSON/PNG and `review.md`.
