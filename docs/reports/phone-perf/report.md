# Phone base frame cost — 2026-10-12–13

## Method

Mac: Apple M4, 16 GiB RAM, macOS 26.5.1. Headless native Chrome/ANGLE Metal, WebGL2, Pixel 7 user agent/touch, 390 × 844 CSS pixels, device DPR 2.625, render DPR capped at 1.5, explicit low quality, CDP CPU throttle 4×. Full UI, unlocked audio and telemetry recording are enabled. This is an emulated phone CPU profile on the Mac, not a physical phone recording.

Each fresh page loads seed 2, starts the mission, enables god mode and stays still. L1 uses the depot start; L3 uses Commerce Street at (124, 0) with 12 pursuing runners; L4 is after the ride objective; L5 is after emergence in the plaza at (-14, 8). Natural civilians and pets remain active; the sparse actor count refers to infected. There is no bot driving during sampling. After 120 settling frames, 569 live rAF intervals are sampled. Frame p95 is the actual rAF interval. Sim p95 is the slowest complete `Game.simTick` in each frame that runs a fixed tick, including input, world simulation and camera advance. This conservatively covers catch-up frames. The world-update average per tick is retained separately. Optional Chrome CPU sampling runs after the timing sample.

The before build is `fe38f893` plus the opt-in diagnostic instrumentation. The same instrumentation is retained for after. `quiet-run.sh` reserves all four browser slots and checks load < 3, no other headless Chrome and no local Vitest before each run; `e2e-lock.sh` is nested in that reservation. The harness records local Vitest and other headless browser PIDs at both ends and rejects overlaps. No baseline worktree was created: the original production source is built in this isolated worktree with the current source saved and restored in a `finally` block. A failed L3 fixture spawn was corrected before baseline sampling. Initial world-average timing, zero-infected L3 and cellar L5 exploratory samples are excluded from the final comparison.

## Changes

- Strip empty placement/crown markers from cloned render layouts after their metadata has supplied the generated batches. Preserve meshes, nonempty nodes and the source GLB.
- Hide empty static LOD batches from render traversal and restore visibility when their instance lists become populated.
- Compose baked layout and batch world matrices once at their immutable district origin. Doors, roof cutaways, LOD repartition and physics placement transforms still update their instance buffers; streamed replacement batches are composed after attachment.
- Keep 64 exact nearest-cell memo entries so the morning population does not evict its route targets every tick. Test candidate distance before visibility: a farther cell cannot replace an already nearer reachable answer. Preserve scan/tie order and blocker invalidation.
- Cache the parked bicycle's ground/tyre solve until position, height, yaw, steer, pedal, speed, mounted/fallen state or ground source changes. Parcel, glint and camera-facing prompt continue updating.
- Guard unchanged HUD/touch/mission/escort badge attributes, text, styles and visibility. Cache CSSOM serialization so rounded fractional projections are not rewritten each frame. Hide only previously used threat pins, cache the ACTION button, and avoid repeatedly hiding/showing an active survivor cue within the same frame.
- Reject distant roof placements before world-to-local inversion. Near roofs retain the existing exact rotated/scaled footprint test.
- Keep flash overlay opacity unchanged when its value is unchanged.
- Cache authored static doorway geometry while evaluating live actor proximity and opening/closing the leaves each frame.
- Limit low civilian/retained-infected full footwork admission to four figures (with the existing held-slot hysteresis). Other figures keep the existing cheaper world-space stance solver, continuous animation, hunch/reaction layers and appearance. High remains at 48 full solves. An exploratory escort pose cadence did not reduce L3 cost and was removed.

Most changes remove redundant work across tiers; the full footwork admission limit changes only on low. High quality settings, assets, gameplay and all existing budgets remain unchanged.

## Cost attribution

Chrome samples show `updateMatrixWorld`, `multiplyMatrices`, render traversal and render-object submission among the largest recurring base costs. In L1 the parked bicycle repeatedly samples `GroundField.height` from `contact` and `clearance` (76.2 ms of sampled self time over 120 traced frames in the refreshed before build). NPC navigation visibility is the main L1 simulation cost. The nearest-cell search tested even farther candidates after finding a nearer answer, and the 16-entry memo was smaller than the morning population’s route target set. Both now avoid repeated exact work.

In the refreshed L3 CPU trace, the retained civilian-body infected pose correction (`CrowdPosePalette.correct ← CrowdLocomotion.present ← CivilianBatch.place ← CivilianBatch.update ← CivilianCrowd.update ← NpcView.update`) accounts for 103.6 ms inclusive over 120 traced frames. This justified limiting full footwork solves on low while retaining the existing cheaper stance path. Matrix traversal is older shared engine work, and the bicycle/nav costs precede the recent telemetry and cutaway additions.

Recent systems were measured with recording/audio enabled: telemetry input sampling is at or below 0.1 ms/frame p95; TrapRescue and accessory finish round to 0.0 ms; audio is 0.5–0.9 ms before. Accessory placement and crowd variety remain included in animation/render costs: the finish timer alone cannot attribute their total cost. Low infected already use LOD2 without accessory draws. Seat-follow work occurs in NPC presentation and is inactive in the parked fixture. Cutaway/see-through/foliage together cost 0.7–1.0 ms before. Telemetry, TrapRescue and audio are smaller than render submission and NPC presentation in these sparse scenes. This is runtime attribution, not a claim based on reverting each merge individually.

`sim`, `lighting`, `input` and other parent timers include their nested timers. CPU p95 columns must not be added: multiple fixed ticks can occur in one render frame, and percentile maxima need not coincide. Render submission is the existing `renderCpuMs` timer; the opt-in diagnostic times simulation, crowd/NPC animation, accessory finish, occlusion/cutaway, doors/LOD, light-field, UI, telemetry and audio separately. NPC badge DOM is included in NPC presentation; the UI column covers GameUI/HUD. Timer values rounded to 0.0 ms mean below the observed timer resolution, rather than zero work.

## Measurements and checks

The three-hour reporting limit arrived with the final full-unit rerun still running and the final browser rerun incomplete. Their live logs and raw reports are under `test-results/perf/phone-base/`; the completed checks below are attributed to their tested source. No pending rerun is counted as a pass.

L3 has little remaining frame-time headroom; this result covers the documented sparse stationary scenes. Earlier source iterations reached 33.2 and 33.1 ms on L3 repeats and were rejected. Final clean repeat confirmation is incomplete because local Vitest started during the repeat. [Validation evidence](validation.json) retains the failed iterations and unchanged E18 failures.

All values below are milliseconds at 4× throttle. “After” and cost rankings use the final primary run. Complete sim was already below 6 ms in the reproduced baseline. The primary run passed all four unchanged 33/6 ms gates. The repeat was rejected because local Vitest started during L1; clean repeat confirmation remains incomplete.

| Level | Frame p95 before → after | Complete sim p95 before → after | Before top five CPU buckets (p95) | After top five CPU buckets (p95) |
|---|---:|---:|---|---|
| L1 | 35.0 → 18.1 | 4.6 → 4.1 | render 10.3; sim/frame 6.9; animation 2.5; HUD 1.2; occlusion/cutaway 0.9 | render 8.8; sim/frame 4.2; animation 2.5; HUD 0.9; occlusion/cutaway 0.9 |
| L3 | 35.0 → 31.9 | 4.2 → 4.0 | render 10.6; sim/frame 5.7; animation 2.8; lighting (incl. field) 1.2; HUD 1.2 | render 8.0; sim/frame 4.8; animation 2.5; lighting (incl. field) 1.2; HUD 1.1 |
| L4 | 32.9 → 17.1 | 2.6 → 2.7 | render 10.1; sim/frame 3.0; animation 1.3; lighting (incl. field) 1.1; HUD 1.1 | render 9.8; sim/frame 2.7; animation 1.3; lighting (incl. field) 1.1; HUD 0.9 |
| L5 | 32.4 → 31.5 | 3.3 → 3.4 | render 9.5; sim/frame 3.8; animation 1.7; HUD 1.1; lighting (incl. field) 1.0 | render 9.6; sim/frame 3.9; animation 1.7; lighting (incl. field) 1.0; HUD 0.9 |

### Requested CPU split (before → primary after, per-frame p95)

| Level | Sim ticks Σ | Crowd/NPC animation | Render submission | See-through/occlusion/cutaway | Light field | UI/HUD | Recorder tap | Audio |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| L1 | 6.9 → 4.2 | 2.5 → 2.5 | 10.3 → 8.8 | 0.9 → 0.9 | 0.0 → 0.0 | 1.2 → 0.9 | 0.0 → 0.0 | 0.8 → 0.8 |
| L3 | 5.7 → 4.8 | 2.8 → 2.5 | 10.6 → 8.0 | 0.9 → 0.9 | 0.9 → 0.9 | 1.2 → 1.1 | 0.0 → 0.1 | 0.8 → 0.9 |
| L4 | 3.0 → 2.7 | 1.3 → 1.3 | 10.1 → 9.8 | 0.7 → 0.8 | 0.9 → 0.8 | 1.1 → 0.9 | 0.0 → 0.0 | 0.6 → 0.5 |
| L5 | 3.8 → 3.9 | 1.7 → 1.7 | 9.5 → 9.6 | 0.8 → 0.7 | 0.9 → 0.9 | 1.1 → 0.9 | 0.0 → 0.0 | 0.6 → 0.7 |

### Browser DOM work (before → primary after, mean ms/frame)

CDP `devtools.timeline` traces span 120 extra live frames after timing. These are means, not p95; browser events can overlap and should not be summed.

| Level | Style recalculation | Layout | Paint |
|---|---:|---:|---:|
| L1 | 0.707 → 0.105 | 0.000 → 0.000 | 0.331 → 0.000 |
| L3 | 0.722 → 0.223 | 0.131 → 0.136 | 0.187 → 0.176 |
| L4 | 0.678 → 0.105 | 0.000 → 0.000 | 0.000 → 0.000 |
| L5 | 1.543 → 0.272 | 0.159 → 0.141 | 0.104 → 0.076 |

[Compact measurement evidence](measurements.json) includes exact values, top five sampled self costs, native GPU identity, host conditions, source hashes, recorder/audio state and raw evidence hashes. Full raw frames, CPU samples, screenshots and logs remain in `test-results/perf/phone-base/`.

The original reported L3 48–70 ms / sim 6–9 ms was not reproduced in this sparse stationary fixture: the paired original build measured 35.0 ms frame / 4.2 ms complete sim p95. The comparison below applies to the documented locations, population, seed and Mac emulation. It does not establish a physical-phone or dense-horde result.

### Validation

- Earlier source: native Mac headless browser regressions **36/36 passed**, including HUD/touch, mission markers/dialogue/results, escorts/corgi/civilian turning, bicycle mounts/turns and four telemetry replay cases. An earlier broader 32-case pass had **31 passed / 1 failed** on the landscape HUD coverage gate.
- Full unit suite on Hetzner: **978/978 passed** on source before the final empty-batch visibility change. Four workers maximum. Final typecheck and lint passed; fresh build passed on the final source. Final full-unit rerun: running; test-results/perf/phone-base/final-empty-unit.log.
- NPC integration/navigation/infection causality and permanence on Hetzner: **12/12 passed** on the earlier source; the doorway-source rerun result is retained when available.
- `npm run verify -- E18` was run with remote functional suites and native Metal timing. It is **not green**: the selected remote sim suite passed **54/54**, remote functional browser **11/11**, native GPU tests **32 passed / 6 failed**, desktop/device tests **3 passed / 2 failed / 4 manual skipped**. The preliminary new phone gate had **3 passed / L3 frame failed at 34.1 ms** before the final DOM fixes. The final primary phone run above supersedes that preliminary timing; the repeat was rejected for local Vitest contamination.
- An original-production-source comparison reproduced **7/7 selected failures**: 915×412 HUD coverage 0.272615 vs 0.27; save selected side RIGHT vs LEFT; both L6 counter tiers accessing missing district `origin`; both L5 counter tiers reaching the infected cap; initial download 33,627,622 gzip bytes vs 15,000,000. The verification download case also emitted a pending `response.body()` teardown error. Tests and budgets were kept intact; these unrelated failures were not repaired in this task.
- WebGPU remains a manual check under repository rules. No high quality settings or assets were reduced.

Reproduce with a fresh build under the shared browser reservation:

```sh
PHONE_CPU_TRACE=1 E2E_PORT=3376 \
  PERF_CONDITIONS_LOG=test-results/perf/phone-base/conditions.jsonl \
  sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh \
  sh -c 'npm run build && sh tools/perf/quiet-run.sh npx playwright test tests/perf/phone-base.spec.ts --project=chromium --workers=1'
```
