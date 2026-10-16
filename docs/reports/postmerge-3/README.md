# Batch 5 postmerge gate

Branch: `worktree-agent-a50792334e1515608`, based on `12293a07a`. No deployment or merge.

## Changes and causes

- **Companion recovery:** L6 initialized shelter health to 60 and then replaced it with the incoming resident's old health. Rosa entered at 5/60 HP. More critically, Rosa and Okafor carried `knockedUntil = combat.staggerUntil = 7594` from L5 into L6 tick zero: they remained stunned for over two minutes, through the breach. Full health alone reproduced the failure. Clear those transient combat timers at the L6/L7 boundary as L8 already does, and start living companions at full health. Replaying the actual failing L5 save now completes L6 in 269.9 s with no deaths, no player damage and six rescued. Departure snapshots retain their original health/timestamps; checkpoint restoration still restores checkpoint health. Human identities, appearances, injury walking speeds and narrative poses remain intact. Vehicle durability is preserved. Recovery also covers L8, the L9 passenger roster and the carried corgi.
- **L2 continuity:** replayed the four L2 data/controller/mission/bot files from the recent revisions against the current engine and the same seed-1 L1 aftermath. `5e247bcf3` completes in 134.17 s without deaths; `fbb6200e8` first reaches 213.03 s with two deaths; `24e6a8896` retains that result. The new Maple groups occupy the old side route. The complete bot now takes Maple's western curb (x=-69 for its two street waypoints), completing that carryover fixture in 180.45 s. The newbie route, street population, Alpha tuning and 210 s acceptance limit are unchanged. [Replay timings](l2-bisect.json).
- **Mega measurement:** keep the full-strength boss hole and the 0.6 courier visibility / 0.9 Mega-to-Alpha thresholds. Read the renderer canvas directly, suppress world health bars during pixel probes, hide the courier for both body comparisons, and exclude the same exact reveal disc plus its pixel rim from both bodies. Whole-page screenshots had included changing DOM roster/minimap pixels and moving health-bar borders. A fully excluded Alpha has zero outside-disc pixels; compare the original inequality `mega >= 0.9 * alpha`, while independently proving the reference model drew. Game-camera captures retain the normal HUD and health bars.
- **Merged fixture reconciliation:** generic AI arena tests again require a silent melee miss to leave nearby infected idle, matching the merge lane's L5-only awareness decision. Shotgun resistance fixtures retain the Alpha's 300 HP and 0.8 multiplier; PO #37's merged 240-damage shell therefore deals 192 damage and requires two shells, 0.5 s apart.
- **Scene independence:** the first full WebGPU matrix passed every visibility case but failed eight door/gate draw budgets at 34/30 calls. The same scene alone used 29 calls. Campaign level loading intentionally retained tier-4 courier gear from an earlier fixture (five calls / 2,072 triangles). Scene Lab now explicitly selects each fixture's authored look or default tier 0. A browser regression loads tier 4 then the unstyled gate scene on both backends and tiers, asserting gear reset and the original 30-call budget.
- **Checkpoint fixture:** the revised L2 route can reach the final cluster while still chased. The snapshot-restoration test now creates a calm window before completion (retaining every infected's ID/health) and observes `checkpoint.restored` before intentional retry relief runs. It asserts a real restoration and preserves the existing population/state tolerances. The separate escape-loop tests still enforce checkpoint refusal under pursuit and crowd relief after repeated deaths.

## Specification corrections

The existing health-preservation clauses in E24/E29/E30 contradicted the explicit 2026-10-16 orchestrator decision that companions recover between levels. They now require full health at the next level start. E07's shotgun table and E23/E29's corresponding resistance criteria still described the pre-PO-#37 150-damage shotgun. They now describe the already-merged 240-damage weapon and its two-shell result; Alpha health/resistance and L5 enemy difficulty were not changed.

## QA

New matrix catalog scenes: `qa-l6-rested-shelter`, `l2-finale-maple-curb` and `seethrough-gear-four`. All are part of `scene:matrix`. Existing arrival, close-contact and R6 speed scenes exercise the corrected Mega measurement.

### Validation

- Hetzner `npm run test:unit -- --maxWorkers=4`: **1,533 passed, 7 skipped**. The subsequent L7 carryover suite passed all 15 tests, including future-clock knockdown/stagger input and unchanged departure snapshots.
- Hetzner `npm run test:sim -- --maxWorkers=4` on the committed implementation: **1,079 passed, zero skipped or failed**. The timing project ran first with one worker; E18 horde, Alpha, zoo, finale, weapon and mission CPU budgets all passed.
- Both continuous campaign regressions pass: L1→L9 and L1→L10 through credits, without cheats. The campaign's L6 takes **269.9 s / zero deaths**; L10 takes **1,570.53 s / zero deaths**. [Campaign summary](campaign-summary.json).
- The fresh full level run passed the **L1, L2 and L3 complete/newbie bands** and **T-CONT-01S**, retaining their original limits.
- Hetzner `npx vitest run tests/levels --maxWorkers=4`: **318 passed, 2 skipped, zero failed**. Both continuous campaign tests pass within the full run as well as the focused run. There were no load timeouts in any of the final full unit/sim/level runs.
- One-worker Hetzner isolation: `l2-start`, `l9-start` and `l10-arrival` passed **11/11**, without increasing any timeout.
- The nine unchanged skips are seven macOS `lockf` tooling cases on the Linux runner and two L4 debug probes; their exact names are retained in [validation.json](validation.json).
- L5 checkpoint health: both focused `T-E23-16` tests pass with exact saved-health restoration. Full recovery applies at a new level, not at death.
- Fresh build and the gear-reload browser regression: **4/4 passed**, high/low × WebGL/WebGPU, with the original 30-draw gate budget.
- Original `gate-browser.sh "$PWD"`: **fully green** — typecheck/lint/build exit 0; 6 static smoke checks + 31 browser smoke tests pass; full matrix exit 0; **120/120 e2e pass**, no flaky tests. [Gate output](gate-browser.txt).

- Touched-area WebGL matrix: **56/56 passed**, high/low × zoom 1.5/1.0/0.5 (plus the authored orthographic gate). Peak counters across this set: high **121 draws / 579,570 triangles**, low **116 / 269,432**; all original per-scene limits pass. The original full WebGPU gate and supplemental L9 crossing/crash matrix results follow below.
- Supplemental L9 crossing/crash matrix: **12/12 WebGL + 12/12 WebGPU passed**, both tiers and zooms 1.5/1.0/0.5, including original clipping and render budgets.
- Original gate's full WebGPU `scene:matrix`: **602/602 passed**, both tiers and the complete zoom matrix, 27 min 20 s. All eight former door/gate budget failures now pass without budget changes. [Per-scene gate results](webgpu-matrix.json).
- All **36 Mega variants** (arrival/contact/R6 × three zooms × two tiers × two backends) pass with contact boss strength **1**, courier threshold **0.6** and outside-disc Mega threshold **0.9**. Minimum sampled courier share: **95.3 % WebGL / 95.4 % WebGPU**. Every contact sample has a genuinely drawn Alpha reference. [Measurements](mega-measurements.json).

### Reviewed game-camera captures

The fresh WebGL shelter views show full health bars above the same residents, benches and treating/resting poses, with warm lantern pools in the dark subway. The Maple view shows the courier at the open western curb beside the shopfront and lawn; the authored infected approach from the eastern street group. The close Mega sequence retains the boss's upper body/red highlights, yellow/cyan attack telegraphs and normal health bars while the intended dither reveals the courier at contact. These are normal game-camera sheets; probe-only health-bar suppression is not applied to captures.

| Area | WebGL high, zoom 1 | WebGL low, zoom 0.5 |
| --- | --- | --- |
| Rested shelter | [sheet](captures/webgl-qa-l6-rested-shelter-high-z1.jpg) | [sheet](captures/webgl-qa-l6-rested-shelter-low-z0.5.jpg) |
| Maple curb | [sheet](captures/webgl-l2-finale-maple-curb-high-z1.jpg) | [sheet](captures/webgl-l2-finale-maple-curb-low-z0.5.jpg) |
| Mega contact | [sheet](captures/webgl-l10-mega-close-contact-high-z1.jpg) | [sheet](captures/webgl-l10-mega-close-contact-low-z0.5.jpg) |
| L9 crash/handover | [sheet](captures/webgl-l9-handover-high-z1.jpg) | [sheet](captures/webgl-l9-handover-low-z0.5.jpg) |

The L9 sheets show the APC falling at the broken span, a bright wreck fire and the courier crawling across clear road to the handover marker. The corgi is visible beside the APC at the start. WebGPU [high/1.0](captures/webgpu-l9-handover-high-z1.jpg) and [low/0.5](captures/webgpu-l9-handover-low-z0.5.jpg) preserve the same sequence.

Also reviewed the new [explicit tier-4 fixture](captures/webgpu-explicit-gear-four.jpg) and [default courier/gate sequence](captures/webgl-default-gear-gate.jpg): both render complete figures and the gate sequence retains its normal opening/reveal. The separate reload regression proves the tier changes from 4 to 0 between these independent fixtures.

The reviewed fresh WebGPU views preserve the same shelter poses/full bars, open Maple curb and courier reveal at Mega contact:

| Area | WebGPU high, zoom 1 | WebGPU low, zoom 0.5 |
| --- | --- | --- |
| Rested shelter | [sheet](captures/webgpu-qa-l6-rested-shelter-high-z1.jpg) | [sheet](captures/webgpu-qa-l6-rested-shelter-low-z0.5.jpg) |
| Maple curb | [sheet](captures/webgpu-l2-finale-maple-curb-high-z1.jpg) | [sheet](captures/webgpu-l2-finale-maple-curb-low-z0.5.jpg) |
| Mega contact | [sheet](captures/webgpu-l10-mega-close-contact-high-z1.jpg) | [sheet](captures/webgpu-l10-mega-close-contact-low-z0.5.jpg) |

### Native E18 performance

The first timing attempt (03:15:33 Europe/Berlin) ended at its original 20-minute deadline without admission; partial reservations were released. After the full browser gate completed, a separate ten-minute attempt acquired all four slots nonblockingly and entered `quiet-run` at **05:08:51**, load **2.91**, no other headless Chrome or local Vitest. Three tests passed in **50.5 s**, one worker, headless native Metal Chrome; the reservation was released before 05:10. Batches were separated by over 90 minutes, and no reservation exceeded 20 minutes.

The original desktop 200-infected check measures **5.9 ms p95** against its **16.7 ms** limit. The 40-live-civilian horde checks measure **6.4 ms p95 high** (limit 14 ms; 71 draws / 557,848 triangles) and **11.3 ms low** with 4× CPU throttling (limit 33.3 ms; 70 draws / 120,003 triangles). The low profile is an emulated mobile proxy. No timing, draw or triangle budget changed. [Native proof](native-e18.json), [run output](native-e18.txt), [all validation counts](validation.json).
