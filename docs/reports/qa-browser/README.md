# Browser QA — 2026-11-08

**Acceptance BLOCKED / incomplete.** Browser QA evidence is retained within the2.5-hour brief timebox. The goal of closing every pending check has not been met. Headless native GPU checks run serially through the shared browser pool. No game code changes, deployment or push. The initial sandbox denied the pool listener and Git index; those restrictions have been removed. Restarting the idle daemon resolved its inherited Chromium Mach-port failure.

Initial main was `4640125c`; vehicle/flicker receipts use `8db1ce18`. The worktree then advanced to `ff6edd7c`, adding r12-shadow. The L8 performance merge was subsequently included at `5cd762aa`. Remaining checks are not counted as gameplay failures merely because they are pending. Current main has since merged the L10 farm and r13 follower changes; older receipts below keep their original revision and are not certified as post-merge results.

## Failures and blockers to act on

- **APC cab visibility FAIL.** In `vehicle-detail.ts`, physically enter the APC with E, then inspect `detail-apc-front` and `detail-military-apc`: seated driver exists but front armor covers the glazing/driver. Seven other driven cabs pass. [Evidence](vehicles/detail-receipt.json).
- **Sustained headlight shadow coverage FAIL.** `shadow-capture.ts`, `isolated-headlights`, night/asphalt, moving APC, either native backend and quality: `vehicle-3-light:headL` selected near21, null by51 and through120 despite visible beam. [Trajectory](shadow/measurements.json).
- **Pre-farm L10 native completion FAIL**, low/high charge hold; G-24 fixture assertion FAIL, details below. Physical finale remains unverified because restored-route attempts did not reach it.
- **BLOCKED L8 performance:** missing actual batch59 replay/full state at5722 and9051; both native quiet admission attempts timed out without timing. Need the state payload and an admitted quiet GPU window. Counter-only or23-survivor fixtures cannot substitute for the reported50-follower state.

## r12-l9flicker

| Check | Result | Evidence / capture |
|---|---|---|
| L9 seed 1, tick 1170, (-550,0), zoom 1.14, WebGPU/high | PASS: 30 consecutive real rendered frames, including a small camera translation. Pale track/shoulder/asphalt edges remain stable; no striped bands, floating overlay or flashing rectangle seen. The reported pixel hits the y=.0012 track at layer 6, offset −24, ahead of the shoulder. | [Receipt](flicker/l9-webgpu-high.json), [before/after sheet](../r12-l9flicker/comparison.jpg) |
| Same L9 pose, WebGL2/low | PASS: same visual findings and track priority; 30 consecutive rendered frames. | [Receipt](flicker/l9-webgl2-low.json), same sheet |
| L10 geometry fixture, tick 38160, (2363.99,-75.39), zoom 1.3, WebGPU/high | PASS for fixture: street-lamp pavement, verge, lane paint and practical-light pools remain stable over 30 consecutive frames and camera translation. | [Receipt](flicker/l10-webgpu-high.json), same sheet |
| All 18 L9 corners on both requested combinations and all five L10 corners | PASS: personally opened all 41 thirty-frame corner strips, including frame0/29 full-image follow-up of L9 corner9. Its growing dark shape is a light-source shadow handoff away from fire, not a ground flash. Surface boundaries are clean; fire/light pools and decals retain normal occlusion. Some L10 authored probe sites are open grass. | 41 corners ×30 consecutive rendered frames in same sheet; [corner summary](flicker/corner-summary.json); [hashed capture manifest](flicker/capture-hashes.json) |
| Actual L10 mission checkpoint at reported campus position | PASS for native position: physically walked from restored spawn(547,0) to(2363.613,-75.391), tick29888, mortal, zero deaths, WebGPU/high. Ordinary pavement, road paint and long lamp shadows are stable. Exact38160 remains the separate fixture above; actual route arrival differs. | Appended native-campus cell in same sheet; [receipt](flicker/native-campus.json). The capture calls zoom1.3; its saved state predates that camera call and reads1.5, so no independent capture-time zoom telemetry is claimed. |
| Frame pacing / rendering costs | Observed 30-frame median 16.7 ms in each combination; maxima 33.3/16.7/16.8 ms for L9 WebGPU / L9 WebGL2 / L10 WebGPU. Not an admitted quiet performance pass. No equivalent baseline draw-call measurement exists. | Per-frame and final renderer counters in receipts |
| Full one-job scene gate | PASS assertions: all50 standard rows, zero known/unrun; production low13 repeated after initial dev batch. All full source sheets opened; sparse scenes are not encounter approval. | [Catalog receipt](catalog/receipt.json), [reviewed sheet](catalog/review.jpg) |

I opened the original baseline sheet, all three 30-frame strips, every corner capture sheet, and the final retained before/after sheet. The original baseline contains L9 only; no L10 baseline image was present. Reviewed raw captures were deleted after hashing; one combined comparison sheet is retained. [Capture producer](flicker-capture.ts).

## r12-vehicles

| Check | Result | Evidence / capture |
|---|---|---|
| All eight driven definitions: arrows/WASD screen headings, actual lateral travel and forward movement | PASS for runner assertions | [Receipt](vehicles/checks.json), [17-cell sheet](vehicles/review.jpg) |
| Native L1 bicycle keeps local W/S/A/D steering; native L2 boarding reaches ride | PASS | Same receipt; f10 bicycle, f11 fire-engine ride |
| Native L9 low/high, zoom 1/1.5: physical keys move the APC; native wreck/parked-car ram; awake cap | PASS for runner assertions and reviewed views. APC roof is continuous in f1/f2; native road shots and prop displacement render correctly. Low wreck moved 18.343 m; high parked pickup moved 17.498 m. One prop awake in each, budget 12. | Same receipt and sheet, f12–f17 |
| All eight close front views | FAIL for APC driver visibility: opaque front armor obscures the driver/full-width pane in both front angles despite driver=1 and a seated render occupant. Roof is continuous. Other seven cabs show the seated driver through glazing; complete body panels in reviewed angles. | [Supplement receipt](vehicles/detail-receipt.json), lower cells of [combined sheet](vehicles/review.jpg), `detail-apc-front` / `military-apc` |
| Explicit brake / reverse, physical arrows | PASS: APC forward speed 11.877 → braking → −5.944 m/s under the opposite screen direction | Same receipt |
| Small props, settling / navigation, fixed structures and awake cap | PASS for chair/drum contacts: moved 7.120 / 34.899 m at contact; settled asleep with nav blockers at their new poses. Concrete barrier/fence/house stop APC at x=10.655/12.030/8.669 before their x=15 centers. Twenty-cone stress peak 8 awake ≤12. Centered cone only moved .0084 m as the hull passed over it; this probe establishes no cone shove, so no pass is claimed for that contact. | Same receipt and reviewed sheet |
| Scene gate and quiet GPU timing | Standard50catalog assertions PASS; quiet native GPU timing unmeasured | [Catalog](catalog/receipt.json) |

The supplied `tools/qa/r12-vehicles.ts` ran with `E2E_SERIAL=1 SCENE_PORT=4341 R12_OUT=docs/reports/qa-browser/vehicles`, exit 0. Personally opened its retained sheet.

## r12-l8 opening / early APC

| Check | Result | Evidence |
|---|---|---|
| Fresh and persisted progressed L8 seed 1; low/high × zoom 1/1.5; normal mission button and physical W | PASS: gate objective/distance, world arrow, minimap pin and calm group in all eight views. First guidance ticks 0/0/3/7; physical movement 2.005–2.080 m. Personally opened the eight-view sheet and full high image. | [Manifest](l8-opening/manifest.json), [sheet](l8-opening/review.jpg) |
| High zoom 1.5, physically walk south road to APC and hold E, tick 3125 at (96.430,76.005) | PASS: sanctuary active, escape/depart pending, sanctuary checkpoint, gate marker, zero infected, no driver/passengers/entry ring. Personally opened image: group beside APC, gate arrow points back left, no gold ring or boarding prompt. | Same manifest; bottom cell in the same reviewed sheet. |
| Same door, tick 3660 / supplementary3663 | PASS for state and supplementary high visual at3663: breach checkpoint, gate marker, sanctuary active, escape/depart pending, no driver/passengers/ring. Personally opened: the APC and group remain visible, objective says lead group to gate90m, no entry ring/prompt. Infected are outside this door camera; native state establishes their admission. | Same manifest |

Supplementary physical captures also show “Wait with the group at the zoo gate ·1m” before3600 and high-tier return at tick5772, (8.750,77.168), switching to “Lead the group to the armored vehicle ·88m” with the world arrow and minimap guidance pointing towards the APC. Final all-passenger seating/driver unlock and L9 handover are still unverified.

### Current-main normal L8 route

[Current-main receipt](l8-opening/current-main.json), appended cells in the same L8 sheet. Source2c178f95 / game tree320a2d45. Native WebGL2/Metal, physical inputs with paused-world stepping, zoom1/1.5, no God/teleport/skip/injected driver. Player deaths0 both. Low12survivors+corgi, high11survivors+corgi(one follower lost). Low first sampled complete seating6303→driver6333→progression6388; high6429→6447→6502. No sampled driver/ring before all living survivors and every current occupant were seated. Low result images visibly show the L9 road and “Drive toward the city”; its saved end state precedes automatic loading. High explicitly records L9 playing at177, with capture-time L9 levels at both handover zooms.

The early “passengers-seated” label in these two raw producers means only the first occupant had sat; the compact receipt corrects it to first-occupant-seated. The later original late “apc-breach-61s” capture is corrected to all-seated-driver-ready; it is not a61s view. The helper now requires the complete living roster and bounds the61s capture time. Normal-route evacuation/handover PASS. The current-main low adversarial detour also completes: exact3125/3665door captures, gate5278, all12survivors+corgi seated7866, driver7938, L9capture-time progression7993; zero courier deaths. A high attempt was invalidated by main HMR during the corgi merge; the frozen dcfd32d3 retry stopped without completion (see [detour receipt](l8-opening/current-main-early.json)); it is not accepted as a full high detour pass.

## r12-l6

Fresh mortal physical routes, seed 1, captions enabled, WebGL2/Metal, zoom requests 1/1.5. [Low receipt](l6/low-repeat.json), [fresh high receipt](l6/high-aligned.json), [reviewed sheet](l6/review.jpg), [capture hashes](l6/repeat-capture-hashes.json). Both clean runs completed without deaths or manual intervention; one read-only map-route assist supplies ordinary physical movement bearings. The high “aligned” monitor never needed to send a command.

| Check | Low | High |
|---|---|---|
| Full route / result identities | PASS: 192.17 sim seconds, 1/29 rescued, 28 lost; survivor #16 | PASS: 189.68 sim seconds, 3/29 rescued, 26 lost; #16/#17/#27 |
| First original survivor safe / last crossed / all rescued x≥266 | PASS at ticks 11007 / 11007 / 11093 | PASS at 10931 / 10995 / 11081 |
| Gate waits for physical clearance | PASS: gateAt11230 after clearance11093 | PASS: gateAt11081, all rescued already clear |
| Full six-second night and result | PASS: world tick11530, cinematic elapsed0–359; same rescued identity remains hidden=false | PASS: world tick11381, elapsed0–359; same three rescued identities remain hidden=false |
| Recurring three-person pressure, two complete successive cohorts | INCOMPLETE: admission8142 has3 ahead at198 while courier164.74; second10542 has1 behind at228 while courier249.38 (exact40s, admission cap). No full second three-body cohort. | One three-body admission8142, photographed visibly on-track8374. No full second cohort before finish. |
| Ordinary Rejoin cue | Separate mortal high attempt visibly displays “Rejoin Marcus · 18 m” after checkpoint restoration. Physical sideways stair alignment then permits reunion/ending; no skip or teleport. | Cue cell retained in same sheet; [that run's receipt](l6/high-repeat.json). |

Personally opened every retained rail/safe/crossing/clear/night/result cell. Clean high now frames the courier and all three rescued actors in the street, with readable safe and exact “Night. Still alive.” captions. Low's survivor remains visible but its safe caption coincides with a “Survivor lost!” toast, and hostile bodies/red bars remain beside the courier in the night view; this is a readability concern for PO review, not a count mismatch. The authored cinematic camera keeps the same framing under both player-zoom requests. Two drawn=false audit samples at elapsed12 coincide with paused API zoom recapture; screenshots and hidden flags do not establish a natural-play disappearance.

A separate high run with one death rescued five, but its post-restoration all-clear captures at tick14417 are black. Those two invalid diagnostic cells are retained at the bottom of the sheet; they are not accepted as visual approval. The clean no-death high repeat above supplies usable all-clear views. The initial manually shortened low night is superseded by the full clean repeat.

Focused L6 catalog supplement ([receipt](l6/scene-gates.json)) passes12/12assertion rows: WebGL2low/WebGPUhigh, gate route/exit approach/night UI ×zoom1/1.5. All full sheets were personally opened; their first/last cells are appended to the same L6 sheet. Exit actors stay visible while traversing the stairs/street, and the gate route uses the authored mouth. The `ui-night-l6-gate` fixture has overlapping tutorial/objective cards at the top left on both combinations: a readability concern, not visual approval of that layout. This fixture is distinct from the clean six-second ending above.

## r12-l7 completed physical route matrix

[Compact receipt](l7/receipt.json), [reviewed route/departure sheet](l7/review.jpg), [capture hashes](l7/capture-hashes.json). Fresh `L7-default`, seed 1, mortal, WebGL2 Metal, 1280×800. Physical number keys, WASD and mouse; shotgun chosen below 6 m, no injected driver/god/teleport/skip. The earlier high rocket-only timeout remains an operator limitation, not a damage bug.

| Check | Low | High |
|---|---|---|
| Full route, boarding, continuous departure and L8 handover | PASS: 131.13 sim seconds, 135 wall seconds, 1 death, 15 boarded | PASS: 181.07 sim seconds, 185 wall seconds, 2 deaths, 23 boarded |
| Opening / corridor / bus physical captures, zoom 1.5 | PASS at actual ticks 224 / 3625 / 6309 | PASS at actual ticks 284 / 5753 / 9116 |
| Bus zoom 0.8 | PASS: physical approach capture | PASS: physical approach capture |
| Distinct approach pressure / follower damage | PASS: windup events from all four cardinal sectors in opening, corridor and bus; wounded #51/#58 later boarded | PASS: opening/bus all four sectors, corridor three; eight wounded followers later boarded, including #53 at 11 HP |
| Global rocket cadence | PASS: minimum 50 ticks, individual shot ticks retained | PASS: minimum 50 ticks across 31 launches |
| Native Alpha health | PASS: observed 450 maximum HP | PASS: observed 450 maximum HP |
| Alpha survives two hits, dies on third | PASS controlled production L7 spawn: 450 → 279.9 → 120.312 → 0 HP; launches67/117/167, impacts93/144/194 | PASS: same sequence and cadence |

Personally opened all 14 retained route/departure cells. Opening shows red threat telegraphs around the courier and the exit crowd; the corridor has room between the courier and following column. Bus approach shows followers near the wrecked vehicles and threats on multiple sides; the 0.8 view is closer than the 1.5 view. Both departure sequences show the bus moving along the street and leave the HUD hidden before normal L8 handover. The requested departure 0.8 zoom is overridden by its authored cinematic (actual 1.5), so only the **pre-departure bus approach** is certified at 0.8. The driver's `simSeconds=0` is a clock-reset reporting bug at L8 handover; the actual L7 mission result time is used above.

[Shared rocket safety](rocket-safety/receipt.json) and [L10 scenario fixtures](rocket-safety/L10.json) pass both qualities: 2m aim and forward living infected reject discharge; behind infected permits it; an8m shot hits. The [extended cover probe](rocket-safety/early-cover.json) tracks the projectile until its pre-5m collision, with no blast, hit or player damage. The16-tick incomplete samples are retained as superseded diagnostics in the aggregate receipt. [Alpha receipt](rocket-safety/alpha.json) disables target AI only for stationary health isolation; production spawning, damage and projectiles remain active, the courier is mortal, and no health values are overwritten. Its first-to-third impact span is1.683s; this is not moving-encounter TTK. Strict first-ready native low/high pickup PASS: beforetick51 readyAt0, zero earlier launches; close LMB rejected58 with “Too close!” at67 and zero launches, then farther aim fires. [Receipt](rocket-safety/native-first-ready.json). The earlier low pickup with a prior launch is superseded. L10 physical finale remains NOT VERIFIED; see failed attempts below. Controlled safety and health cells were personally opened in the same sheet.

### Follower-merge L7 repeat — main2c178f95

[Fresh real-clock receipt](l7/current-main.json), [capture hashes](l7/current-capture-hashes.json);16new cells appended to the same L7 sheet. Both completed without skips or injected assists: low125.68sim/129wall seconds,1death,21rescued; high175.23sim/179wall seconds,2deaths,8rescued. Both minimum rocket gaps50ticks,450HP Alphas, and all final boarded identities retained. Actual departure snapshots occur at1.55/4.08/8.20s low and1.55/4.20/8.17s high, despite their requested0.5/3/8filenames. Authored cinematic zoom overrides the optional0.8request as before. All16full images opened: visible opening/bus pressure and follower columns, then a moving bus/panning city shot. High loses many followers during ordinary combat before departure. The result image is an L8 loading card; separate telemetry records first playable L8, so that card is not claimed as an interactive opening image. These runs predate the subsequently merged corgi change.

## r12-shadow

[Measurements](shadow/measurements.json), [personally opened 68-cell sheet](shadow/shadow-sheet.jpg). Native WebGL2/Metal and WebGPU, low/high, requested zoom 1/1.5; actual backend fallback is rejected. The latest GL/high repetition corrects the original fixture zoom labels. Fixture poses are distinct from mortal traversal evidence.

| Check | Result |
|---|---|
| Dominant brighter right street lamp, courier/corgi/infected direction | PASS all four combinations: shadows extend away from the right lamp. The before-method replay points towards the wrong side. Ground shadow hue 254.72–257.73°, inside 230–290°. |
| Rendered forty-lamp walk | PASS all four combinations: 40 changes over119.96m, ≤2 promotions/s,39fades of300–316.7ms, one refreshed map. Maximum pool luminance steps GLhigh8.235%, GLlow8.263%, GPUhigh8.725%, GPUlow8.500%, all<15%. GPU uses3600RAF-rendered frames with15,066nonblack samples each. Historical skipped/error invocations are superseded; this is not quiet timing. |
| Power off / transient expiry | PASS all four: selected source becomes null and moon returns, with one refreshed map. Fire/work-light images show dark violet shadows extending away from their visible light pools. |
| L5 / L6 underground and outdoor / L7 / L8 / L9 / L10, both zooms | PASS for the requested fixture matrix and posed native L7-low moon probe. Outdoor practicals remain readable; the underground low-tier restriction is retained. Actual physical L6/L7 routes are separately reviewed above. |
| Moving headlight coverage | FAIL of sustained coverage in an isolated night/asphalt APC drive: source `vehicle-3-light:headL` selected around tick 21, null by tick 51 and at tick 120 on all four combinations. The beam remains visible. No stable headlight-driven actor-shadow direction is established. Repro is the `isolated-headlights` fixture in [audit](shadow-audit.ts); complete source/car/map trajectories are retained. |
| Catalog driveout headlight assertion | Not a game-defect verdict: this fixture contains a dominant street lamp, which is what the selector chose. Raw nonzero audit exits retain that assertion. The separate isolated probe above is the relevant sustained-coverage finding. |
| Geometry / map budget | PASS sampled fixture limits: maximum 82 submitted draws / 163,527 triangles; never more than one refreshed map. Quiet native GPU timing is unmeasured. |

The “before” restores two original Lighting methods from `a0d4f7ba^`, not a complete older build. Native L7 moon is a deliberate posed/god probe. The new production QA artifact was built on Hetzner (18.498 s, exit 0), not on the Mac; [artifact identity](production-build.json). Remote lint passes. The nullable helper error was corrected; remote typecheck rerun passes (53s, runner94.130.181.173). Later changes to report-only producers are not included in that result.

## L10 finale and native acceptance

[Physical finale diagnostics](rocket-safety/finale-diagnostics.json) start the real `cure-disperse-ready` graph through the debug checkpoint loader, which reconstructs the courier at the crash anchor(547,0). Low ends after one death at that anchor; high stalls at(588.762,0), zero deaths. Both stop after120sim seconds without movement. Neither reaches the authored stairs/console, charge completion, moving-Mega objective or ten rocket hits. These are failed operator/harness attempts; **normal physical finale play is NOT VERIFIED**. Controlled rocket safety above remains a separate fixture pass.

The remote pre-farm full native acceptance sweep ([summary](l10-native/summary.json)) finished all ten receipt groups, exit1 in2889.657s. [Fresh verdicts](l10-native/fresh-verdicts.json) distinguish current status from stale manual reviews: one failing level row(L10-03),13not-checked rows, one passing level row; globalG-24 also fails.

| Receipt group | Low | High |
|---|---|---|
| Complete policy | FAIL completion: 3600s budget,162deaths, stuck at hold/charge near(3989.385,-32.520) | FAIL completion: 3600s,149deaths, hold/charge near(3989.175,-32.015) |
| Stationary control | Reaches Mega, then times out1225.52s,0deaths; not a completion pass | Reaches Mega, times out1238.35s,0deaths |
| Controlled fixtures | 15PASS /1FAIL(G-24) | 15PASS /1FAIL(G-24) |
| Checkpoint restore/control | 27/27PASS, identical control | 27/27PASS, identical control |
| Composition probes | 2FAIL assertions; fresh=false | 2FAIL assertions; fresh=false |

L10-03 reports corridor-exit regular group19 against20–35 and dog peak6 against3–5; its controlled composition receipts also markfresh=false. The actual handgun pickup precedes first dogs(3497≤4950) with no premature ticks and identical controls, yet that associated assertion is FAIL; do not turn this provenance/criterion issue into a claim of premature spawning.

G-24 expects far/full enemies to be ineligible, but the Alpha returns eligible=true; all listed animal archetypes return false at far/full. This is an exact **fixture assertion failure**, requiring criterion/design reconciliation before calling it a game defect. These receipts predate farm and follower merges; they do not establish post-merge acceptance. Heavy work ran only on Hetzner. The final charge/Mega browser requirement is still unmet.

## eg-l10-farm — current main2c178f95

[48-view route matrix plus scare/contrast cells](farm/review.jpg), [receipt](farm/receipt.json), [contrast samples](farm/contrast.json). Native headless WebGL2/Metal, seed1, actual low/high, zoom0.5/1/1.5; x550/650/750/850/950/1050/1150/1230, actual positions and ticks retained. Personally opened all48views and the high warning/actor images. These are accelerated physical-input diagnostics on Vite dev, not admitted timing or a full-L10 route.

| Check | Result |
|---|---|
| Opening through x1300, mortal physical movement | PASS scope: low28.514wall/high36.767wall, zero deaths; normal combat damage/pickups, no God, teleport, injected driver or skip. |
| Dry brown landscape / no lush green | FAIL appearance: broad green banks and green bushes remain on both qualities. Bare branch trees are present; low removes much ground scatter. Warm practical pools remain readable. |
| Road/verge ≥2.5:1 | FAIL sampled displayed patches at x≈750,z≈24.5,zoom1.5: low1.0834:1, high1.0735:1. Exact25×25pixel boxes and per-pixel linear-sRGB formula are retained. This is not a global minimum survey. |
| Crop visibility / scare1 | High contains nearby crop at6of8sample sites(max7tiles within40m); crop is visibly sparse/tall/angular in scare1 images. Stinger4980, due5070, then native sprinter #114 appears in the field after warning. No actor is visible in the warning image. Only one of four sites was naturally reached; complete scare fairness/rustling approval remains NOT CHECKED. |
| Courier crop fade / entering fields / ruined farm gaps / LOD transitions / half-scatter count | NOT CHECKED: the normal route mainly stays on mown roads. Zoom comparisons alone do not prove continuous LOD or rustling behavior. No assertion that corn was globally absent. |
| Audio audition, five hits, pre-scare silence, pause/focus, finale-only rock | NOT CHECKED; a logged stinger event is not audio audition. |
| New-source scene gate, dense corn E18 budgets, ≤66ms spikes / ≤6s cold load, empty-stretch trace | NOT CHECKED. Standard50-row gate below uses the pre-farm production artifact; no post-farm performance equivalence is claimed. |

## Outstanding acceptance

| Lane | Result / remaining work |
|---|---|
| r12-l6 | Clean low/high routes and full ending PASS above. Second complete three-person cohort is INCOMPLETE under the admission caps. Standard50catalog PASS; focused L6 gate/exit/night12/12PASS assertions, reviewed and appended to the single L6 sheet. |
| r12-l7 | Route/safety PASS above. Strict low/high first-ready pickup PASS. L10 physical finale NOT VERIFIED. |
| r12-l8 / r13-followers | Current-main normal low/high gate→evacuation→L9 PASS above. Current-main low adversarial detour PASS; high HMR attempt invalidated and frozen dcfd32d3 retry incomplete. Fresh real-clock L7 follower-merge low/high runs completed and reviewed. |
| r12-shadow | Functional matrix PASS except isolated sustained headlight coverage FAIL. All four60s walks PASS; quiet GPU budgets unmeasured. |
| r12-l8perf | **BLOCKED**: actual batch59 checkpoint/replay/full state has not been supplied. Both 20-minute quiet admission attempts exited75 without starting timing. [Admission evidence](quiet-admission.json). A real23-survivor L7 campaign is retained for ordinary-route reproduction; it does not reproduce the reported50-follower state. No frame-p95, spike, per-object GPU-cost or long-route resource verdict is claimed. |
| r14-height (32222f42) | Newly merged at closeout. L10 platform attacks/stair traversal, L6/L4 walls/ramps/vehicle roofs and flat-ground comparisons remain NOT CHECKED. Earlier L10 finale diagnostics predate this merge and do not certify it. |
| r13-corgi (dcfd32d3) | New handoff after the final L7 runs. Rear rejoin across headings/zoom limits/both backends, touch portrait/landscape across all companion states, and first interactive restore/vehicle-ownership frames remain NOT CHECKED. The final L8 high detour uses a frozen Git archive to avoid main HMR; its scope does not cover this whole handoff. |
| eg-l10-farm | Opening low/high captures reviewed; palette and sampled contrast FAIL above. Full route/audio/crop-interaction/LOD and admitted performance checks incomplete. |

## Runners and retention

[Physical playtest dev wrapper](playtest-dev.ts) uses the existing playtest driver against a private Vite dev server, with a bounded session and no separate build. [Planner-advice diagnostic](route-capture.ts) sends device events and advances the paused world in tick batches, recording deaths; these are accelerated physical-input diagnostics, not real-clock timing runs; it is supplementary where its policy cannot complete a real route. [L8 opening runner](l8-opening-capture.ts) is the supplied producer with report output redirected. [Shadow admission](shadow-capture.ts) and [audit](shadow-audit.ts) similarly redirect the supplied producer.

All partial, blocked and failing checks remain explicit. Production receipts identify the pre-farm source; no post-farm equivalence is claimed. Final batch receipts and reviewed sheets will be retained, with raw captures removed after review.

## Closeout

The2.5-hour browser lane timebox is reached. Every retained sheet was opened, raw captures/profiles and private builds were pruned, and no push/deploy/game-code fix was performed. **Goal not met:** batch59 replay/full state is missing; quiet timing never admitted; L10 physical finale, complete farm interaction/audio/performance, and newly merged corgi/height browser handoffs remain incomplete. Passing pre-merge evidence is not certified for later merges. New source at final review is main32222f42; the last frozen detour source is dcfd32d3.
