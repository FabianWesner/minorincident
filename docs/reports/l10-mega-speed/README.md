# L10 Mega cruise correction

E32-AC10 takes precedence over the §5.7 arrival target, per the orchestrator's instruction for this lane. Coarse pursuit now always uses `megaAlpha.cruiseMs * Status.speed(e)`, exactly like ordinary pursuit. The route no longer accepts a speed override. Existing handoff, close attacks, snapshots and the 120 m detailed-steering boundary are retained.

D-CURE gains three connected links over existing open ground: supply-area exit → northern rubble breach, breach → R6/R7 seam, and seam → straight R7 apron. The original nodes and road links remain, preserving saved node IDs. Every half-metre of the added links is checked against the production district at the Mega's 1.1 m radius and for floor support, at both quality tiers. The first link begins beyond the supply truck and drum stacks. No terrain, collider, asset, interaction duration or player movement changes are needed. Planning still follows the approximate current target, rather than anticipating the courier's future route.

The original Q3 pressure reproducer passes on Hetzner: high and low each travel 12.6 m in four seconds, **3.15 m/s**, within the unchanged ±2% rule. A production regression also bounds every coarse step and proves that the running courier increases her lead.

Seed-32 rocket-checkpoint calibration: **143.15 s high / 141.9667 s low after activation**, same boss ID 9, zero deaths and successful explicit release. Approach steps peak at **0.0525 m** in both tiers. Both land ten direct rockets; peak infected counts are 168/87. Release HP is 1.40/2.93, a narrow survival margin for this fixed input policy. At unchanged cruise on the original route, high arrived after **179.55 s**; the connected cuts improve that by **36.4 s**. These are checkpoint calibration measurements, not a calibrated novice or full-campaign timing claim.

The 10–40 s target is physically impossible for this checkpoint policy at cruise. Start-to-console distance is 1,145.211 m; activation occurs at 287.433 s high / 289.017 s low. Even an obstacle-free straight path, allowing arrival 50 m short of the console (25 m courier zone plus 25 m arrival radius), cannot arrive earlier than **60.25 s high / 58.67 s low** after activation. The measured approach contains no close-attack speed burst. The epic's late-arrival fallback therefore applies. Charge reaches 60 s, release remains blocked, the boss continues pursuing, and the HUD says `Kill the Mega Alpha`. The calibration records continued movement during that gate; the existing truth-table and release tests remain binding.

The E3b arrival assertion now checks the measured high/low values to ±0.5 s and checks the full-charge gate text and continued pursuit. This is the explicitly authorized reconciliation with AC10, not a change to the epic or a broader timing/budget relaxation. Its identity, continuity, death, release and cap assertions remain unchanged. The E3 close-start arrival fixture still requires 10–40 s.

Scene matrix includes the extended `l10-e3b-mega-arrival`, existing handoff scene, and new `l10-mega-speed-r6` at both tiers and all catalog zooms (0.5/1/1.5), on both backends. The longer isolated arrival fixture allows the same cruise-speed boss to enter the game camera after charge completion.

Reproduce the measurements on Hetzner:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/l10-q3/pressure-audit.json -- npx tsx docs/reports/l10-q3/evidence/pressure-audit.ts
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E32/E3 -- bash tools/remote/timing-isolated.sh npx tsx docs/reports/l10-mega-speed/evidence/calibration.ts
```

## Game-camera review

Opened the retained arrival and R6 sheets at high/low quality and zoom 1.0/0.5 on WebGL and WebGPU. Both backends have matching framing, charge states, warning-ring bands and boss entry. The complete automated catalog also includes zoom 1.5: 36/36 final rows pass.

Arrival: cyan console screens and the yellow interaction marker remain clear against the blue-grey apron; the courier's warm head/top and teal pack remain visible while the boss is distant. Charge reaches 60/60 and the HUD changes to `Kill the Mega Alpha` while the boss is still outside the camera. The same dark armored silhouette, red eyes and red health bar enter at the end. The existing large boss fills/crops against the close camera, especially at zoom 0.5; at contact it can obscure the courier. This is the same close-camera limitation recorded in E3b, not a claim of whole-finale readability signoff.

R6: the white road stripe, flat blue road and dark grassy verge remain continuous across the sequence. The courier stays supported and readable until contact; the warning ring changes from distant through approaching to near. At f7800 the Mega enters from the open verge, with the red face lights, heavy arms and dark armor drawn in both tiers. No missing actor, visible LOD stand-in, black-render failure, terrain gap or sinking appears in the reviewed sheets. The waypoint-clearance sim checks the off-camera links at 0.5 m intervals with the Mega's full radius; these end-camera crops do not visually survey the whole path.

Handoff: warm flat ground, a stable courier shadow and the centered warning ring remain visible while the hunter stays outside the crop. The numeric handoff and cruise gates establish continuous travel there; the sheets establish camera/HUD stability.

All new travel/arrival gates pass: zero console errors, zero undrawn frames and LOD placeholder frames, detailed cruise error within 2%, continuous movement, and the catalog's 300 draw / 500k triangle limits. These isolated fixtures complement the full mixed-assault E18 performance checks.

Retained sheets: [captures/](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/l10-mega-speed/captures). Headless WebGPU is automated here; manual/device QA is not asserted.


## Validation

Production pressure audit: exit 0 on Hetzner, both tiers. Full remote unit: **1,460 passed / seven skipped**. Full remote sim + `tests/levels`: **1,327 passed / three failed / two skipped**. That sweep used the earlier calibration lookup: high hit its unchanged 120 s execution deadline. The final nearest-visible lookup skips unnecessary farther-candidate LOS checks and keeps the stable-sort tie rule. Both tier regressions then pass (**118.03 s high / 38.76 s low** wall time) under the same deadline. All compared gameplay state, objective/activity timelines, movement extrema, HP, counts and arrival values match the pre-optimization run exactly; hashes and fields are in [lookup-equivalence.json](evidence/lookup-equivalence.json).

The two other sweep failures are in untouched L3 files: `L3-route.test.ts` walkability and `ally-combat-feel.test.ts` idle fraction 0.201449 vs <0.2. This lane does not claim a green full sweep. The sweep's other **116 E32 sim/level cases pass**, including all E3 assault cases, Q3's opening/streaming/dog/cure coverage and the new four production cruise/clearance cases. The final calibration supplies the remaining two-tier E3b pass.

The complete ordinary-input L10 seed-32 run passes: **26:10.017 gameplay**, zero deaths, 281 kills, 330 damage, peak 168 infected, all fifteen objectives through credits. Installation remains **15:46.017**, explicit release is **23:40.017**; 150 s playable epilogue is included and 17 s credits are excluded. The full route therefore has a longer living-boss gate than the rocket-checkpoint calibration above. This is the real pursuit/release gate, not an inserted timing delay. The calibrated novice 45–50 min criterion remains outside this lane's signoff.

Final Scene Lab: **18/18 WebGL + 18/18 WebGPU**, high/low × zoom 0.5/1/1.5. The R6 contact sheet rerun adds six passing WebGL rows to capture its final frame; the final matrix uses those six in place of the earlier six R6 sheets. All browser work uses fresh production output, headless Metal, unique ports 34972/34975/34976, one browser per batch. WebGL/R6/WebGPU catalog times are 286/95/237 s; outer lifetimes including admission waits are 455.6/326.7/1076.0 s, with reservations released after each batch.

Native mixed-assault E18: **8/8 pass**, both backends, high/low and zoom 1/0.5. Fresh build on port 34977, one headless Chrome worker, `quiet-run` preflight and machine-wide locks. The reservation's queue + run lifetime is **506.7 s**, with a 1,190 s cancellation deadline plus at most 10 s termination grace; it was released before final verification. Budget values and assertions are unchanged.

| Native maxima | High | Low | E18 cap high / low |
| --- | ---: | ---: | --- |
| Frame p95 ms | 6.9 | 4.7 | 16.7 / 33.3 |
| Sim p95 ms | 1.6 | 1.2 | 4 / 6 |
| Draws | 144 | 121 | 600 / 300 |
| Triangles | 483,188 | 63,832 | 1,500,000 / 500,000 |
| Infected | 168 | 87 | 200 / 100 |
| Detailed chunks | 20 | 9 | 25 / 9 |
| Collected heap MB | 208.83 | 164.51 | 400 / 250 |

Final `npm run verify -- E32`: **exit 0**, with typecheck/lint/fresh build, **168 selected Node tests + 57 browser tests + eight native district budget checks** all passing. This repeats both E3b calibrations at the unchanged 120 s deadline (115.87 s high / 38.67 s low), all E3/Q3 tests and the new production regressions. The district batch held its quiet reservation for **962.9 s including admission wait**, below 20 min, then released it; whole-command lifetime was 2,863.1 s. The native district maxima are 5.7/4.7 ms frame p95 and 1.2/0.9 ms sim p95 for high/low (raw counters in `evidence/district-perf/`). Commands, exits and compact test results are retained in `evidence/verify-*.json` and `evidence/verify-run.txt`. No deployment or merge, spec/reference/dependency changes, or `staticCollision.ts` changes.
