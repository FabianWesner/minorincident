# S34 zombie hits and attacks

## Status

Acceptance is **not complete**. Render implementation is committed as `e2db4c7e`. The final foot-slide matrix passes all 24 day/night × low/high × WebGL2/WebGPU rows (maximum p95: nurse 1.8 cm, crawler 1.4 cm, dog 0.3 cm). The broader matched visual matrix, final-source 62/62 gate, draw-call comparison and full test gate remain outstanding. Historical investigation results below are superseded by the latest measurements.

## Cause

- Ordinary infected attack presentation followed only the simulation's `attack` state. The simulation exits that state on the strike tick, leaving no readable recovery pose. The pose also depended on the standing attack clip, so moving attacks had no upper-body strike gesture.
- Light reaction duration was derived from simulation stagger. A one-tick bullet reaction therefore lasted one frame even though the authored reaction pose could be rendered longer without changing combat.
- Dog assets carry embedded gallop/bite clips, but their joint-preservation flag bypassed runtime contacts and pose layers. The runtime contact path also used trot cadence and offsets for the gallop phase. The fallback bake aliases resolved to idle. Crawler motion was excluded from the Scene Lab planted-foot metric, so its old result was not measured.

## Changes

- Added a render-only ordinary infected attack phase with a recovery tail, upper-body attack gestures for bite, swipe, crawler grab, and riot shove, and moving-attack layering.
- Made light flinches last 0.30 seconds independently of simulation stagger, with a quick rise so repeated hits can read under sustained fire.
- Kept dog gallop and bite poses on the dog atlas and added a render-only dog coil, leap, and snap gesture.
- Added a crawl stride cadence and contact gait shape, and included crawl frames in Scene Lab foot-slide summaries.
- Added assertions to the existing render-contract test (no test-case budget increase).

## Measurements and visual review

| Measure | Before | After |
| --- | ---: | ---: |
| Nurse foot-slide p95 | 12.8 cm (archived r31 audit) | 1.8 cm (contiguous contacts, high WebGL2; other matrix rows pending) |
| Crawler foot-slide p95 | Not reported (crawl excluded); independent archived-track recalculation was about 63 cm | 0.5 cm (detailed crawl contacts, high WebGL2; other matrix rows pending) |
| Dog foot-slide p95 | 92.7 cm (archived r31 audit) | 0.2 cm (bite hop arc, high WebGL2; other matrix rows pending) |
| Scene gate | Prior audit baseline only | **62/62 pass** on an earlier checkpoint; final source rerun pending |
| Draw calls | Prior audit baseline only | Not measured |

The archived before strips were opened: the suit attack strip showed little visible change through the attack, the suit hit strip showed effects without a clear body response, and the nurse walk strip showed foot drift. Nine first-pass after strips were generated and opened (attack, hit, and walk for nurse, crawler, dog): nurse shows an arm/chest attack change and recoil under gunfire; crawler shows a grab but its attack pelvis drop buried its torso; dog showed a gallop but weak gun-hit body response. Subsequent changes removed the crawler pelvis drop and prevented humanoid hunch/attack layers from rotating animal bodies. These subsequent changes still need matching strips reviewed. The requested low/high, day/night, WebGL2/WebGPU capture matrix remains outstanding.

## Checks

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx vitest run tests/shared/render-contracts.test.ts --maxWorkers=2` — pass, 14/14.
- `npm run test:gate` — run once, failed: 106/107 tests passed. The remaining `tests/tools/gate-tools.test.ts` freshness assertion expected a clean source digest and saw the dirty worktree. Do not interpret this run as a gate pass.
- `npm run scene:gate` — blocked before scene execution: Node could not create its temporary tsx IPC pipe (`listen EPERM`). The required one-browser Scene Lab CLI attempt also could not bind its local browser-pool coordinator (`127.0.0.1:4329`, `EPERM`). No capture or metric was produced by these attempts.

## Remaining acceptance work

Correct the remaining measured contact failures, then run the requested Scene Lab fixtures, inspect and describe every before/after strip, record post-change nurse/crawler/dog p95 values, and pass `npm run scene:gate` at 62/62. Then rerun the required gates from the clean committed source and update this report with the evidence.

Latest crawler check: `test-results/s34-crawl-contacts` completed 1080 frames with slide p95 0.5 cm / max 1.4 cm. Walk and attack strips were opened: attack torso remains above ground with a visible grab; the walk strip crop misses part of the approach, so smoothness across the full route still needs review. Crawl now uses detailed contact solving in the close band. Focused render contracts pass 14/14.

Nurse attack contact check: removing attack pelvis rotation/drop gave 9.7 cm p95; keeping the ordinary attack lunge on the torso gave 6.9 cm in `test-results/s34-nurse-plants`. This is still above the 3 cm limit.

Nurse follow-up: flat-foot settling measured 6.4 cm p95; moving the attack hunch from pelvis to torso measured 5.4 cm (`test-results/s34-nurse-hunch`). Both remain failing acceptance.

Dog sole follow-up: declared paw soles now participate in standing and gallop/bite grounding. `test-results/s34-dog-grounded` measured {'frames': 1080, 'torsoPitchMinDeg': 35.2, 'torsoPitchMaxDeg': 100.8, 'contacts': 29, 'slideMaxCm': 36.7, 'slideP95Cm': 24.3, 'yawDriftMaxDeg': 1.5, 'liftMaxCm': 76.1, 'sinkMaxCm': 10.5, 'jitterRunMax': 3, 'worstSlideFrame': 326}. Acceptance remains failing.

Full current-source gate completed: `SCENE_PORT=4928 E2E_UNITS=1 npm run scene:gate -- --jobs 1`, exit 0, 62/62 rows pass across WebGL2/WebGPU and low/high, 9.4 minutes. Results: `test-results/scene-gate/`. This gate does not prove the separately failing nurse/dog foot-slide criteria or replace the requested audit-strip matrix.

Diagnostic follow-up: a temporary contact-count assertion completed the first 90 dog frames without triggering, ruling out missing paw entries for that path. The assertion was removed. The ankle-endpoint correction left aggregate p95 unchanged at 24.3 cm.

Contact-summary correction: excluded frame intervals now close the previous contact instead of counting the knockdown/get-up displacement as planted sliding. Existing grounded threshold and tolerances are unchanged. Regression assertions check that contiguous translation is counted and a knockdown gap is not joined. Nurse rerun `test-results/s34-nurse-contiguous`: p95 1.8 cm, max 5.4 cm. Dog floor-target experiment remains failing at p95 25.3 cm, sink 10.5 cm.

Dog settling strip `test-results/s34-dog-settle/strip-settle.jpg` opened: forequarters rise during bite recovery while rear paws remain near the floor and slide. Standing support now fits pelvis height to locked leg reach, as moving support does. New run `test-results/s34-dog-support`: {'frames': 1080, 'torsoPitchMinDeg': 35.2, 'torsoPitchMaxDeg': 100.8, 'contacts': 36, 'slideMaxCm': 37, 'slideP95Cm': 26, 'yawDriftMaxDeg': 1.5, 'liftMaxCm': 52.9, 'sinkMaxCm': 10.6, 'jitterRunMax': 5, 'worstSlideFrame': 326}.

The standing pelvis-fit experiment was reverted: p95 worsened to 26.0 cm and sink remained 10.6 cm, so it did not satisfy the proposed correction.

Dog recovery correction: embedded bite clip now stays selected through a render-only recovery phase; removed conflicting procedural leg rotations. `test-results/s34-dog-recovery` measured p95 13.9 cm / max 14.0 cm / sink 2.5 cm, improving on the prior 25.3 cm p95 and 10.5 cm sink but still failing acceptance. This source change is newer than the recorded 62/62 scene-gate run.

Dog spring correction: added a render-only 12 cm hop arc while the authored bite legs are airborne. `test-results/s34-dog-leap`: p95 0.2 cm, max slide 0.7 cm, sink 0 cm. No simulation position, attack timing, damage, or AI changed. Latest high-WebGL2 measurements: nurse 1.8 cm, crawler 0.5 cm, dog 0.2 cm; remaining matrix and visual review still required.

Renderer/quality follow-up (same original r31 L4 fixtures, 1080 frames each; screenshots/metrics under `test-results/s34-matrix/`):

| Fixture row | Slide p95 cm |
| --- | ---: |
| r31-crawler-low | 0.4 |
| r31-crawler-webgpu | 0.4 |
| r31-crawler-webgpu-low | 0.4 |
| r31-dog-low | 0.1 |
| r31-dog-webgpu | 0.2 |
| r31-dog-webgpu-low | 0.1 |
| r31-nurse-low | 2.3 |
| r31-nurse-webgpu | 1.8 |
| r31-nurse-webgpu-low | 2.3 |

All listed rows meet 3 cm. These metrics do not replace the outstanding day/night game-zoom visual-strip matrix.

Game-camera visual review: generated and opened all 18 strips for nurse/crawler/dog × day (`L1`)/night (`L8-zoo`) × walk/attack/hit at low WebGL2, zoom 1.5, under `test-results/s34-visual/`. Nurse shows alternating stepping, arm raise/recovery and chest recoil; crawler shows approach pose changes, reaching grab and head/chest response; dog shows gallop, spring/bite/settle and a head/body recoil. No obvious large skid is visible in these strips. Night silhouettes remain visible, but fine flinches are difficult to read; this batch alone does not prove every hit is clear at zoom 1.5. The first night attempt used invalid preset `L9`; those failed loads were discarded and rerun with `L8-zoo` successfully. `tools/qa/s34-strips.py` composes unchanged shot crops at native pixel size. Other type groups, before counterparts and remaining renderer/quality rows are still outstanding.

Important acceptance failure in the new game-camera batch: nurse p95 is 4.1 cm in both day and night low-WebGL2 rows (crawler 1.4 cm; dog 0.3 cm). Thus the original close fixtures passing does not establish the complete foot-slide requirement. The game-camera nurse result must be corrected.

Game-camera nurse investigation: largest contiguous contacts occur at frames 117–121 and 542–550. Testing full-rate low-tier pose updates within 3 m left p95 unchanged at 4.1 cm (`test-results/s34-nurse-contact-cadence`), so that experiment was reverted. Typecheck/lint passed during the experiment; no tolerance was changed.

The game-camera nurse swing-clearance experiment (`test-results/s34-nurse-clearance`) also left p95 unchanged at 4.1 cm; it was reverted. Its focused render contracts passed 14/14. Active solver-path diagnostics are the next step before further contact changes.

Solver diagnostics (temporary throws removed): nurse at game zoom uses detailed contact solving (`near=true`, `grounded=true`, `want=true`, rest reach 0.416683 m). At render time 1.933 s the requested left ankle target was [2.1193, 0.2473, 0.1229] but the drawn ankle was [2.1673, 0.2361, 0.0873]. This confirms a target/solved-position mismatch during the failing swing; loaded-chain reach/length handling needs investigation. Diagnostic runs intentionally failed their console-error criterion and are not acceptance evidence.

Root-cause correction for game-camera nurse: LimbIK cached bind-pose limb directions, while the loaded retargeted pose changes shin/ankle translations (observed shin offset [-0.0209,-0.3363,-0.0850]). It now derives lengths/directions from the current pose. `test-results/s34-nurse-live-offsets`: p95 1.8 cm, max 6.0 cm, sink 0 cm. A regression assertion changes offsets after solver construction and verifies target reach. This shared solver change requires broader scene and character validation; prior gate results are not final-source proof.

Post-checkpoint high-WebGL2 day/night game-camera metrics completed successfully for all six rows: nurse p95 1.8 cm in both presets, crawler 1.4 cm in both, dog 0.3 cm in both (`test-results/s34-final-metrics/`). Clean-checkpoint `tests/tools/gate-tools.test.ts` passes 8/8, including the previously failing freshness assertion. Working tree was clean after the implementation commit. Remaining work still includes all ordinary type-group strip comparisons, remaining final-source matrices, final full gates and draw-call comparison.

Post-checkpoint low-WebGL2 day/night game-camera metrics also pass: nurse 1.8 cm, crawler 1.4 cm, dog 0.3 cm in both presets. This replaces the pre-fix nurse 4.1 cm failure for these rows. Captures/metrics: `test-results/s34-final-metrics/*-low/`.

High-WebGPU final-source day/night game-camera metrics pass: nurse 1.8 cm, crawler 1.4 cm, dog 0.3 cm in both presets. Added `tools/qa/s34-capture.ts` for matched Git-baseline/current captures on the same port and fixture, recording source hashes. Its baseline nurse low-WebGL2 day/night pilot completed and all six strips were opened: the baseline attack goes from a slight arm movement to a stationary reach, and gunfire changes the body only briefly; walking has alternating poses but its small slide is difficult to judge visually at zoom 1.5. The night baseline shows the same outline changes with much weaker body detail. Full paired comparisons remain pending. Capture runner typecheck/lint pass.

Completed final-implementation foot-slide matrix: 24/24 game-camera zoom-1.5 rows (3 actors × day/night × low/high × WebGL2/WebGPU) have non-null p95 ≤3 cm. Aggregate checked from each actor motion summary; maximum p95 is nurse 1.8 cm, crawler 1.4 cm, dog 0.3 cm. Machine-readable aggregate: `test-results/s34-final-metrics/summary.json`. This proves those measured foot-slide rows, not the outstanding full-type visual acceptance.

Expanded after-capture batch completed: 16/16 low-WebGL2 day/night game-camera scenes for suit-l4, native-bbqdad, firefighter, hazmat, riot, civ-man, civ-elderly and guard. All 48 walk/attack/hit strips composed under `test-results/s34-pairs/after-webgl2-low/`. These newly composed strips are not yet reviewed; baseline counterparts and other quality/backend rows remain outstanding.

Visual review of all 48 expanded after strips is complete (low WebGL2, day/night, zoom 1.5). Suit-l4: alternating strides, high arm/chest attack change, backward gun recoil; dark night coat limits fine detail. Native-bbqdad: broad stepping, shoulder/arm attack and backward recoil visible in both presets. Firefighter: alternating boots, axe/arm and chest movement on strike, head/chest gun recoil. Hazmat: alternating steps and arm/chest changes; recoil is smaller and night detail weak. Riot: steps behind shield, asymmetric shield/arm attack, head/chest recoil. Civ-man, civ-elderly and guard: gait changes visible, but attack/flinch changes are small at game zoom; the three captures appear very similar in blue/green clothing. Their intended appearance coverage and action readability remain unresolved; these rows are not accepted solely because their scene checks passed. Baseline counterparts and remaining quality/backend rows still pending.

Appearance check confirms the concern: first drawn appearance in all three `civ-man-day`, `civ-elderly-day`, and `guard-day` metrics is `npc.civilian-woman-a`, rather than the requested distinct models. The fixture/render appearance path must be corrected before claiming those type groups are visually verified.

Fixture coverage correction: Scene Lab now preserves explicit `npc.*` infected appearances before outbreak dressing. The three corrected 90-frame fixtures report their intended man/elderly/guard assets. This changes fixture setup only; production combat and AI are unchanged.

Capture-window correction: walk samples now cover chase frames 132–188 (the previous 84–126 window mostly sampled idle). Separate melee (510–552) and sustained MG (800–842) strips supplement attack and initial bullet-hit strips. The full matrix must use these corrected windows before acceptance.

Standing ordinary melee reactions now select authored `stagger-left` / `stagger-right` by body-relative hit side for the fixed 0.30 s presentation window; moving hits retain the upper-body recoil layer. Kicks/blasts keep their existing knockdown/get-up behavior. Existing render-contract cases cover side selection, one-tick bullet reactions and a changing repeated-hit envelope (14/14 pass); typecheck and lint pass. Foot-slide and scene acceptance must be rerun after this addition.

Corrected civ-man day strips (walk/attack/hit/melee/sustained) opened: chase frames show alternating planted steps and arm raise through approach; attack shows a reach/recovery; initial MG shows chest/head recoil. Bat contact bends the torso and ultimately downs the actor. Late sustained-fire frames show the already downed actor, so this strip cannot prove sustained flinches on a living target. This evidence limitation remains open.
