# Crowd footwork: the courier technique for pedestrians and infected

PO: "Figure is good now. Take it to main and apply the technique for all figures (peds and zombies)." and "Zombies might need different moves."
The courier footwork is on main (`17c888d7`). This lane brings it to both instanced crowds. Presentation only: no sim module changed, so determinism is untouched.

## Approach

The crowd look stays rigid-part. Skinning the crowd failed E18 in the skin-rollout lane, and the rigid parts already read well at the game camera. What changed is the footwork.

- **Same solver, crowd-scalable.** `CourierGroundContacts` (Fable's solver) now runs per crowd figure inside the existing `CrowdLocomotion` pose-correction path. Each batch keeps one off-scene skeleton. The per-figure contact state (locked feet with yaw, swings, pelvis) lives in a shared `CrowdFootwork` map, so a figure keeps its feet when it changes LOD batch (`rebind`). The solved pose is written into the figure's existing corrected row in the pose atlas. That means no new vertex attributes (WebGPU stays at 8 buffers), the same draws, and partial texture uploads as before.
- **LOD.** Full footwork applies only in the close pixel band, which is the LOD1 civilian batch and the LOD0/LOD1 infected band (crowd LOD pixel hysteresis 104/88). It has a per-frame budget: high tier 48 pedestrians and 40 infected, low tier 16 and 12. Figures already stepping keep their slot. Mid-band moving figures keep the old stance plants, and far figures show the baked clip. Weight fades over 0.12 s, so nothing pops.
- **Crowd style on the solver** (`GaitStyle`, opt-in; the courier code path is unchanged and `skin-pilot` still passes). Each figure has its own stance and knee, blended over 0.15 s on walk/run switches. Other parts of the style:
  - Swing cap 0.4 s. An early "stretched" release lands on time and waits for its next stance.
  - Hermite landing approach to a fixed world point, so turning or running bodies cannot drag the arriving foot.
  - Landing yaw is latched late in the swing.
  - A planted foot is never teleported or pivoted. It takes a quick step instead.
  - No twist steps mid-run. The next gait swing re-aims the foot.
  - Low-swing clearance floor, and swing height is capped when a foot is out of reach.
- **Turns.** Crowd presentation caps the displayed turn rate at 6 rad/s, the courier's cap (`MotionPresentation(crowdTurnRate)`). Sim facing snaps, such as infected snapping to face a target, become stepped turns. Turning in place is a series of alternating steps.
- **Speed-matched stride** (`cadenceStride`, crowd clips only):
  - Slow walkers keep at least 1.5–1.6 cycles/s, the shamble at least 1.5 and frail at least 2.2. They take shorter steps instead of over-long strides they cannot plant.
  - Running tier gaits are capped at 3 cycles/s (frail 3.3). Before, `infected-lurch`/`-frail` ran at a 2 Hz cap, which meant 2.5 m strides at 5 m/s — the runners' skating.
  - Shorter legs (children, short rigs) step faster (Froude √scale).
  - Corgi, courier and story NPC actors are unchanged.

## Zombie move set (`InfectedMoves`, both infected paths: L1 turned pedestrians and `CrowdView`)

- **Walker drag-foot shamble.** Below run speed one foot (by id parity) drags: knee peak ×0.45, scraping just above the ground with its toes down, a quick lift-off and touchdown. A light lurch goes on top.
- **Runner lurch.** The average-tier gait throws the torso over each landing foot (roll) and pitches on the push-off. Frail runners still favour the dragged foot; sprinters lurch lightly.
- **Crawler.** Stays on its crawl clip without footwork. Legs are not IK'd on a prone body.
- **Lunge-grab attack.** The body coils back through the first half of the windup, then throws itself about 0.22 m at the target as the windup ends (the hit tick). The arms come from the windup clip. It recovers over 0.45 s. The planted feet make the lunge a real step: the drift step fires.
- **Flinch.** Light hits (normal player melee is ≤ 0.25 s of stagger in the sim) no longer swap to a full stagger clip. Before, that clip was also skipped whenever knockback moved the body. Now a recoil layer runs along the hit direction: chest and head snap back and the hips give way. It peaks at 30 % and is gone at min(0.25 s, reaction). It restarts on every hit, so fast clicks read as separate hits until death. The feet stay planted, and knockback becomes a step.
- **Knockdown/get-up only on heavy reactions.** That means deaths, finishers, kicks and blasts, as the sim already classifies them. It now also plays while the body is knocked back; before, it required speed ≤ 0.06.
- Standing L1 infected near the camera hunch at the hips over planted feet instead of tilting the whole body from the soles. Far away the old instance lean stays.

## Measurements

### Footwork harness (`tests/unit/render/crowd-footwork.test.ts`, `tools/crowdfoot/harness.ts`)

The harness runs the shipped GLB bake, pose atlas and `CrowdLocomotion` at 60 Hz, driven the way the crowd views drive them. It measures model-free from the displayed foot parts with the player-anim metric. A foot is grounded while its lowest heel/toe point is within 1.2 cm of the floor; slide is the motion of the grounded point per contact; yaw drift is the foot yaw change per contact. Gate: ≤ 3 cm and ≤ 8°.

"Mid band" is the stance-plant path that main ran for every moving figure. Standing figures on main used no correction at all, so their turns spin on the spot.

| Figure | Scenario | Mid band / main: slide cm / yaw ° | Close band (new): slide cm / yaw ° |
| --- | --- | --- | --- |
| civilian man | walk 1.4 m/s | 7.4 / 0 | **0.21 / 0** |
| civilian man | walk turn 90° / 180° | 29 / 90 · 35 / 103 | **0.79 / 0 · 2.24 / 0** |
| civilian man | turn in place 180° | 64 / 180 | **0.62 / 0** |
| civilian man | start–stop | 5.0 / 0 | **0.47 / 0** |
| civilian man | flee 4 m/s / flee turn 120° | 1.2 / 0 · 17 / 40 | **0.08 / 0 · 0.20 / 0** |
| civilian man | seeded wander (stand/walk/run, ±150° snaps, 10 s) | 75 / 147 | **2.18 / 0** |
| civilian woman (long legs) | walk / turn 180° / in place / flee turn | 7.2 / 30 / 66 / 22 cm | **0.13 / 1.58 / 0.36 / 0.21 cm, ≤ 0.04°** |
| child (0.7 scale) | walk / turn 180° / in place / flee turn / wander | 9.2 / 31 / 50 / 27 / 62 cm | **0.76 / 2.55 / 0.43 / 0.85 / 1.93 cm, ≤ 0.01°** |
| infected worker | drag-foot shamble 1 m/s / shamble turn 90° | 6.0 / 0 · 22 / 74 | **0.12 / 0 · 0.58 / 0** |
| infected worker | runner lurch 5.1 m/s / runner turn 90° | 12 / 0 · 29 / 40 | **0.17 / 0 · 0.21 / 0** |
| infected worker | face target 150° (snap) | 30 / 85 | **0.56 / 0** |
| infected worker | lunge-grab attack | 17 / 1.1 | **0.86 / 0** |
| infected worker | flinch ×4 (fast clicks) | 17 / 1.2 | **0 / 0** |
| infected (woman-b body) | all of the above | up to 33 / 113 | **≤ 1.77 / 0.01** |

All rows are in `test-results/crowd-footwork/metrics-{pedestrians,zombies}.json`. Swing lift is 6–19 cm (≤ 26 cm in the wander). Knee lift and leg separation are visible.

`tools/crowdfoot/sweep.ts` runs a harsher stress: 8 seeds × 5 bodies, 12 s, with 150° heading snaps every 0.6 s while switching between standing, walking and full flee/sprint speed. 34 of 40 runs stay ≤ 3 cm and ≤ 0.1°. The rest:

- 3 runs reach 3.0–3.2 cm.
- 1 run reaches 5.2 cm.
- Child seed 5: 13 cm / 12.7°.
- Infected worker seed 6: one contact at 16° yaw.

These outliers need sprint-speed reversals that sim agents rarely make. See "Remaining weaknesses".

### In-game probe (actual renderer, game camera angle, every tick at 60 Hz; `tools/crowdfoot/capture.ts`)

The probe reads heel/toe points of every drawn close-band figure through `crowdFigures().soles`, which is new and test-only. Excluded clips: lying, crawling, sitting, rising and grabbed.

| Scene (10 s) | main: contacts, slide p95 / max, contacts > 3 cm | this lane |
| --- | --- | --- |
| civ-street walkers: square routes, 180° line, then flee | 138, 32.5 / 69 cm, 90 | **181, 0.96 / 6.6 cm, 1** |
| L1 accident outbreak: 12 pedestrians fleeing, infected chasing | 227, 21.3 cm / (teleport), 171 | **307, 1.14 / 1.93 cm, 0** |
| horde arena: shamblers, runners, attacks, fast-click flinches, deaths | 30, 32.7 / 61 cm, 17 | **94, 1.08 / 5.3 cm, 1** |

`test-results/crowd-footwork/{before,after}-probe.json`. The "before" build is main (`0ffaf16a`) built from a git archive, with only the probe's heel/toe instrumentation added.

### Performance gate (E18 horde: `perf-horde-200` + 40 civilians, native ANGLE Metal, shared machine)

| Tier | Build | Frame p95 ms (runs) | Presentation CPU p95 ms | Render CPU p95 ms | Sim p95 ms | Draws | Triangles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| High (desktop, 1600×900) | main | 12.5, 12.6 | 3.5, 3.5 | 8.6, 8.6 | 1.8, 1.9 | 60 | 1,154,541 |
| High | this lane | **12.2, 11.8, 11.9** (gate 14) | 3.9, 4.1, 4.0 | 8.0, 6.3, 6.8 | 1.9 | 60 | 1,154,541 |
| Low (Pixel 7 emulation, 4× CPU throttle) | main | 16.1, 15.4 | 7.3, 7.2 | 4.8, 4.4 | 4.6, 4.3 | 59 | 268,379 |
| Low | this lane | **16.5, 17.1, 17.0** (gate 33.3) | 7.8, 8.2, 8.0 | 4.5–4.7 | 4.3–4.5 | 59 | 268,379 |

- Footwork costs about +0.5 ms presentation CPU on desktop and about +0.7 ms at 4× throttle.
- Frame p95 stays inside both gates.
- Draw calls and triangles are identical. No new buffers or draws.
- Numbers are from a shared, loaded Mac, so expect ±0.5 ms run-to-run noise.

## Evidence (`test-results/crowd-footwork/`, small files)

- `{before,after}-pedestrians.webm`: civ-street. Walkers on square routes (90° turns) and a back-and-forth line (180° turns). An infected walks in at 6 s and everyone flees.
- `{before,after}-l1-outbreak.webm`: the real L1 accident checkpoint with 12 pedestrians fleeing and turned infected chasing.
- `{before,after}-zombies.webm`: horde arena. Three wandering shamblers (drag foot) and two runners close in. They attack the god-mode courier (coil, lunge-grab), flinch under 10 Hz Shift+click hits, die, and are knocked down.
- Each video is 10 s at 20 fps, 1280×720, recorded at the game camera angle with a close review radius. Stills are `{before,after}-<scene>-{90,300,540}.png`.
- Metrics: `metrics-pedestrians.json`, `metrics-zombies.json`, `{before,after}-probe.json`.

Reproduce:

```sh
npm run build && E2E_PORT=3392 sh tools/e2e-lock.sh npx tsx tools/crowdfoot/capture.ts test-results/crowd-footwork after --port=3392
npx vitest run tests/unit/render/crowd-footwork.test.ts   # harness metrics
npx tsx tools/crowdfoot/sweep.ts 8                         # stress sweep
npx tsx tools/crowdfoot/debug.ts inf.common-worker.lod1 infected 'runner turn 90°'   # per-frame foot trace
```

## Guarantees kept

- Crowd-drawn and close-LOD guards are unchanged: same batches, same LOD bands and same draw probe.
- Corpses still bake once into `StaticCorpses`. Pedestrians persist.
- WebGPU buffer count is unchanged; footwork writes only pose-atlas rows. WebGPU itself was not checked headlessly (manual check, as before).
- Combat timing is unchanged: the hit tick is still the windup end, and the lunge peaks there.
- Sim determinism holds: no `src/sim` change.

## Validation

Run on the final code after `git merge main` (`4da3cd53`). All runs headless, ANGLE Metal, lane ports 3392–3396 (never 3300).

| Command | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint` | PASS |
| `sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=2` | **303 passed**, 89 files |
| `E2E_PORT=3394 npm run verify -- E07` | Unit/sim: 60 passed, 2 failed (`T-E07-16` dogs flank, `T-E07-09` stream spline). Both are sim-only and fail identically on unmodified main `0ffaf16a`, so they are pre-existing. Verify stops there, so I ran the browser phase separately: `playwright --grep @E07` gave **9 passed** (crowd-drawn WebGL + WebGPU, corpses persist, crowd-feel 60 s no flicker, T-E07-12/13). |
| `E2E_PORT=3394 npm run verify -- E08` | Unit/sim **35 passed**. Browser: 29 passed, 1 failed (`npc.spec` "ambient civilian rendering": 0 instances vs 30). It fails identically on main `0ffaf16a`, so it is pre-existing. |
| `E2E_PORT=3394 npm run test:smoke` | **6 sim + 25 browser passed** |
| `sh tools/e2e-lock.sh npx playwright test tests/perf/horde.spec.ts tests/perf/horde-budget.spec.ts tests/e2e/crowd-close-lod.spec.ts --workers=1` | **8 passed**: horde budget high p95 11.4 ms, low 16.3 ms; close-LOD guard WebGL + WebGPU, high + low |
| `PERF_HORDE_RUNS=3` budget runs (table above) | high 12.2 / 11.8 / 11.9 ms, low 16.5 / 17.1 / 17.0 ms |

## Remaining weaknesses

- **Extreme reversals at sprint speed.** A 150° snap while switching between standing and 4.8 m/s can still produce one contact of 5–16 cm, or a 12–16° yaw. This happens only in about 1 of 8 runs of the synthetic stress. The chibi legs (0.37–0.7 m) cannot plant a full-speed reversal; the courier report notes the same reach limit.
- **Drag foot by design.** The toe scrapes about 1.6 cm above the ground. At the game camera it reads as dragging, but it is not literally sliding on the ground.
- **Mid-band figures** (about 88–104 px and below) still use the old stance plants. Their turns are presentation-capped but not stepped. Further out, figures show the baked clip.
- **Arms are still the baked clip.** Lunge and grab come from the windup clip plus a body lunge; there is no arm IK to the victim.
- **Kicks** still play knockdown/get-up because the sim classifies kicks as heavy. A kick-specific stagger would need a sim-side rule.
- **Cadence change applies to all crowd figures.** Slow walkers step at ≥ 1.6 Hz and runners at 3+ Hz. The baked arm swing follows the same phase, so it stays in sync, but the far crowd also looks a little brisker than before.
- WebGPU parity and a physical phone were not measured, as for every lane.
