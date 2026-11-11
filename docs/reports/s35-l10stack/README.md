# s35-l10stack — L10 console armor readability

## Result

The console's pale hard-edged surfaces are reproduced on a single living armored football infected with no overlapping figures. Full-strength additive moon fill flattens its broad armor panels. Reducing that asset's figureFill from 1 to .25 restores darker directional shading while retaining its .25 silhouette rim. This is a render uniform change only; simulation, stats, positions, corpse membership and persistence are untouched.

The initial clumping hypothesis was not supported as a necessary cause: the real fixture replay shows the appearance with only one drawn corpse, and the isolated actor reproduces it. The synthetic corpse investigation below was diagnostic and did not prove the original cause.

## Acceptance evidence

- Source-level baseline/candidate console matrix: WebGL2/WebGPU × low/high × zoom1/1.5, living and downed armor present. All 16 captures opened. Candidate reduces pale blue wash and retains individual silhouettes. Changed-pixel mean Rec709 brightness falls from 59.5–63.1 to 45.5–50.4 (threshold RGB L1>=12). Raw captures remain outside Git in `/private/tmp/s35-matrix-{baseline,candidate}/`.
- Real fixture baseline/candidate captures opened at `/private/tmp/s35-fixture-console-{before,candidate}/probe-state.jpg`. Native probes establish body positions/counts. Real-time crowd arrangements differ, so the controlled source-level matrix supplies the visual A/B.
- scene:gate: **62/62**, 0 known, 0 not run, exit0, 10.9 min. `/private/tmp/s35-scene-gate.log`.
- test:smoke: **6 QA + 1 public checks pass**, exit0, 173.9 s. `/private/tmp/s35-smoke.log`.
- Typecheck, lint, focused render-contract tests (14/14) pass. Full test gate initially 106/107 due to the intentional HEAD-vs-modified-source freshness assertion; committed-state validation passes: **107/107 tests, 27/27 files**, exit0 in112.3s (`/private/tmp/s35-committed-test-gate.log`). No tolerances changed.

## Investigation record

The following preserves rejected hypotheses and evidence limits. No rejected diagnostic source changes remain.

## Evidence collected

- Opened the supplied r30 `l10-probe12/zoom.jpg`: a tightly overlapped crowd and prone bodies show broad gray-blue patches near the console. The image alone does not establish z-fighting.
- Native restoration of `tests/fixtures/saves/qa/l10-dispersal-console.json.gz` contains 14 living infected and zero dead bodies. A 120-second stationary hold probe (immortal courier, movement to console, interact held) brings 12 living infected within 14 m, spanning roughly 5.4 × 5.0 m; no infected die. This is a crowd-density observation, not proof of the artifact's cause.
- Scene Lab diagnostic `/private/tmp/s35-l10-console-probe.json` stages the sampled console positions, with five actors explicitly downed. This is a controlled diagnostic, not a faithful replay of the original crop.
- Opened `/private/tmp/s35-l10-before-webgl2-high-z15/shot-0000.png`: broad flat patches on prone bodies, including bodies spatially separated from neighbors. The inherited travel assertions failed because this diagnostic is stationary.
- Removed inherited travel/script expectations from the temporary diagnostic. Both matched 120-frame captures pass their console-error check:
  - `/private/tmp/s35-l10-before-webgl2-low-z15/shot-0120.png`
  - `/private/tmp/s35-l10-before-webgl2-high-settled-z15/shot-0120.png`
- Opened both matched captures: separate prone silhouettes have shaded body detail on both tiers. The initial high-versus-low comparison was confounded by frame count. The change across time warrants tracing animated death versus frozen corpse drawing before altering spacing or shading.

## Remaining acceptance work

Identify the exact drawing mechanism with a controlled comparison; implement a render-only fix; capture and open before/after at low/high, zoom 1/1.5, WebGL2/WebGPU; run tsc, lint, focused tests, test:gate once, scene:gate 62/62 and smoke; commit explicit paths. Raw captures stay outside Git.

## Environment

Initial sandbox prevented sparse-checkout config writes and browser admission. After the environment became unrestricted, the mandated slim command succeeded and Scene Lab runs through `tools/e2e-lock.sh` on SCENE_PORT=4934, E2E_PORT=4933 with one headless browser.

## Matched transition probe

`/private/tmp/s35-l10-transition/` captures frames 0, 1, 30, 60, 90, 120 in one high/WebGL2 run (pass). Opened frame 1: flat surfaces seen at frame 0 disappear immediately while body locations remain nearly unchanged. These diagnostic actors start at death age 120 ticks; `InfectedSystem.settleBodies()` freezes them on the first sim update. This isolates the diagnostic difference to animated versus frozen corpse rendering, rather than a high/low or long settling difference. It still needs an A/B render-path intervention and a faithful console replay to establish the original crop's cause.

## Figure-fill isolation

Temporarily set CrowdView's figureFill uniform to zero, captured frame 0 at high/WebGL2/zoom1.5 (`/private/tmp/s35-l10-no-fill/shot-0000.png`, opened, console-error check passed), then restored the exact original source. Body brightness changes, but broad surface shapes remain. Disabling fill alone is not a sufficient fix. No render modification from this experiment remains.

## Procedural-pose isolation

Temporarily bypassed CrowdLocomotion's procedural solve for dead actors (`pose.procedural = b.state !== 'dead'`). The high/WebGL2/zoom1.5 frame-0 capture `/private/tmp/s35-l10-death-baked/shot-0000.png` passes and was opened. Broad surfaces remain, with no clear silhouette improvement. Restored original code; this is not the fix. Next isolation should compare the live and frozen surface/normal graphs using identical posed geometry.

## Figure-rim isolation

Temporarily zeroed CrowdView's figureRim uniform. The high/WebGL2/zoom1.5 frame-0 capture `/private/tmp/s35-l10-no-rim/shot-0000.png` passed and was opened. Broad flat surfaces remain. Restored original source. Neither figure rim alone nor figure fill alone explains the artifact.

## Normal normalization isolation

Temporarily normalized `varying(normal, 'skinnedCrowdNormal')` before assigning the animated normalNode. `/private/tmp/s35-l10-normalized/shot-0000.png` (high/WebGL2/zoom1.5, console-error check pass) was opened: broad patches remain. Restored original code. This tests normalization only, not face normals or complete normal-graph replacement.

## Face-normal isolation

Replaced the animated material normalNode with `normalFlat` temporarily. `/private/tmp/s35-l10-flatnormal/shot-0000.png` (high/WebGL2/zoom1.5, check pass) was opened; broad surfaces remain. Original source restored. The near-identical result warrants checking whether PaletteMaterial's custom output reads geometric normals independently of normalNode.

## Shader-path proof

Temporarily assigned solid red outputNode at the animated CrowdView shader setup. `/private/tmp/s35-l10-red-proof/shot-0000.png` passed and was opened: downed bodies become red, standing figures retain normal shading. This confirms the edited CrowdView material draws the diagnostic patches; the earlier substitutions were not hidden by a stale capture server. Original source restored.

## LOD-path finding

Source review finds an explicit forced LOD2 for dead animated bodies at high quality; only L4 had a close-body LOD1 exception. The diagnostic uses Scene Lab's synthetic scenario, so extending the scenario condition to L10 alone did not exercise it (`/private/tmp/s35-l10-near-dead/shot-0000.png`, pass/opened, unchanged). Current unverified candidate removes the scenario condition from the existing close downed-body LOD1 rule. Next action: capture that candidate and inspect actual selected LODs, then check permanent corpse near-detail policy.

## Close-LOD candidate result

The scenario-independent close-down rule captured at `/private/tmp/s35-l10-dead-lod1/shot-0000.png` passes and was opened, but broad patches remain. Metrics report lod1 after frame 1 (the frozen transition), not the animated frame-0 LOD, so this is insufficient evidence for an animated LOD fix. Reverted the candidate. A direct frame-0 draw probe is required before selecting an LOD change.

## Forced animated LOD1 result

Forced `lod1` after all ordinary LOD selection for `health.current <= 0 && !corpse`. `/private/tmp/s35-l10-force-lod1/shot-0000.png` passed and was opened; broad patches persist. Reverted. This does not prove the selected draw was animated: readiness may already have installed a static corpse. Before further material/LOD intervention, inspect entity `corpse` flags and submitted draw geometry at the exact screenshot-ready frame, not only sim timeline labels.

## Exact-frame state probe

Added `tools/scenelab/s35-l10-probe.ts` as an investigation helper. It opens one locked SceneSession, loads the temporary diagnostic, waits for the same readiness barrier, then reads entity flags and draw geometry without a simulation step. Output `/private/tmp/s35-exact-frame.json` proves tick 0, five health-zero entities with deadAt -120 and no corpse flag; the live standing entities have pedestrian appearances. This confirms that the diagnostic's initial downed bodies are animated native CrowdView bodies, while standing actors use pedestrian presentation.

## Exact-frame submitted geometry

Corrected the helper to take a screenshot first and include unnamed active meshes. At tick 0 the five downed bodies draw as native LOD2: inf.jogger (1 × 4828 vertices), inf.suburban-mom (1 × 4965), inf.bbq-dad (2 × 3630), inf.cashier (1 × 4751). Standing figures are unnamed pedestrian LOD1 batches. `/private/tmp/s35-exact-frame.json` now records these compact draw facts. This proves the baseline submitted LOD; future LOD intervention must verify a changed submitted mesh rather than relying on requested tier or frame-1 metrics.

## Verified LOD1 submission

Forced animated LOD1, waited for readiness, explicitly refreshed the view without stepping simulation, then captured and inspected submitted meshes. `/private/tmp/s35-forced-lod1-submission.json` proves tick-0 native inf.jogger/suburban-mom/bbq-dad/cashier draws all report lod1. Opened `/private/tmp/s35-forced-lod1-ready.png`: broad patches remain. Restored source and helper. This is stronger evidence that changing LOD alone does not resolve the controlled diagnostic.

## Original capture replay recovered

The source capture directory contains `log.jsonl` and the tracked harness is `tools/qa/r30-ghost-probe.ts`. Original log confirms fixture l10-dispersal-console, WebGL2 high, zoom 1, god-mode setup, probes at ~130 s after loading (18:46:49 to 18:48:59). Neighbor `probes12.json` toggles only CrowdView.flashStrength off/on. Source screenshot is not the synthetic corpse diagnostic. Reproduce with this harness through the single browser lock on ports 4933/4934, then add position/draw-state probes to its existing probe mechanism. This is the next evidence path; prior synthetic exclusions apply only to that controlled scene.

## Real replay alignment

First replay attempt with harness defaults kited away (119 m from console by tick 2131), unlike the original log's final courier position (4002.5,-27.6), army-mg, HP100. Stopped both owned processes (browser job exit130 and Vite exit130). Next replay must add explicit route `4002.5,-27.6`, `--no-kite`, and console interaction as needed; defaults are not a faithful original input sequence. Partial evidence in `/private/tmp/s35-fixture-before/` is not acceptance evidence.

## Corrected real-fixture replay

Ran r30-ghost-probe with explicit console route, no-kite, hold-e, army MG, god mode, WebGL2 high/zoom1 for the 130 s observation. Completed normally with no page errors. Opened `/private/tmp/s35-fixture-console-before/probe-state.jpg`: broad gray-blue patches are plainly present on living armored infected around the Mega; only one prone body is nearby. Probe tick7828 reports one drawn corpse (id165 at 4002.916,-28.468) and living armored/firefighter/Mega entities. Thus this appearance occurs without a large corpse pile; next isolate armored football rendering at identical pose/LOD in the real fixture. Owned Vite stopped after replay; no check remains running.

## Isolated living armored figure

Captured one living infected.armored at the production console with no adjacent crowd or corpses (`/private/tmp/s35-armored-isolated/shot-0000.png`, high/WebGL2/zoom1, pass, opened). Its helmet and torso still show broad gray-blue surfaces. Overlapping figures are not necessary for that appearance. Temporary spec `/private/tmp/s35-armored-isolated.json` isolates the football asset's rendering for further material/geometry diagnosis.

## Armored lighting intervention

For the isolated living football armor only, temporarily zeroed both figureFill and figureRim. Opened `/private/tmp/s35-armored-no-light/shot-0000.png` (pass): armor becomes substantially darker and surface shading is easier to distinguish; pale blue patches are strongly reduced. Original source restored. This identifies a lighting contribution on the relevant asset, unlike earlier corpse-only probes. It is not yet an accepted fix: test a restrained fill/rim value and verify the real fixture plus both tiers/backends/zooms.

## Candidate retained for validation

Current render-only candidate applies figureFill .25 to inf.armored-football (the same amount already used for Alpha/zoo bosses), retaining figureRim .25. Opened `/private/tmp/s35-armored-fill-quarter/shot-0000.png` (high/WebGL2/zoom1, pass): armor remains visible with less washed-out blue fill. This remains a candidate pending real-fixture and full matrix review. Lint passes. Typecheck result is in `/private/tmp/s35-typecheck.log`.

## Candidate validation so far

Typecheck and lint pass. Focused `npx vitest run tests/shared/render-contracts.test.ts --maxWorkers=2 --configLoader runner`: 14/14 pass. Ran test:gate once with --maxWorkers=2: 106 pass, 1 fails, 27 files; 67.2 s within 240 s budget. Failure is tests/tools/gate-tools.test.ts:74, reviewFreshness expected FRESH but received STALE for a review without sourceDigest. Log `/private/tmp/s35-test-gate.log`. Must investigate before claiming acceptance; do not loosen assertion or tolerances.

## Candidate matrix

`tools/scenelab/s35-l10-matrix.ts` captured eight console scenes in one sequential locked job: WebGL2/WebGPU × low/high × zoom1/1.5, with a living armored actor and one downed armored actor retained. Output `/private/tmp/s35-matrix-candidate/`. Opened all eight shot-0000.png files: both bodies remain visible, standing armor is dark blue with restrained highlights, prone silhouette remains intact; backends look consistent, low console loses panel detail as expected, zoom1.5 widens framing. This is isolated-console candidate evidence, not the full real crowd replay or a complete before/after matrix. Need collect baseline matrix and real replay comparison before acceptance.

Review-freshness failure traced to intentional working-source vs HEAD comparison in tools/qa/accept/reviews.ts. The test without sourceDigest expects HEAD source to equal working source; a modified CrowdView makes it STALE. Do not weaken that check; re-evaluate after an accepted change is committed.

## Matching baseline matrix

Captured all eight baseline combinations with original CrowdView source, then restored candidate. Every row passes. Opened all eight baseline shots under `/private/tmp/s35-matrix-baseline/`: pale blue armor surfaces are stronger than matching candidate, on living and prone bodies. Candidate retains distinct silhouettes with reduced wash across both backends/tiers/zooms. Pixel comparison is `/private/tmp/s35-matrix-pixel-summary.txt` (changed pixels threshold RGB L1>=12, mean Rec709 luma before/after over those pixels); this is a descriptive measure, not a loosened acceptance threshold. Real crowded fixture candidate replay and full scene/smoke gates remain required.

## Real candidate replay

Corrected real fixture replay completed without page errors at `/private/tmp/s35-fixture-console-candidate/`. Opened probe-state.jpg: armored figures are darker but the crowd is denser and differently arranged than baseline because real-time input timing changes combat. Both runs stay near console, but they are not an identical-state A/B. Cannot use them to prove improved figure separation; capture a frozen identical crowd state with in-page uniform toggles for the decisive comparison. Candidate remains provisional. Owned Vite stopped; browser job terminal exit0.

## Full scene gate

`E2E_PORT=4933 SCENE_PORT=4934 E2E_UNITS=1 npm run scene:gate -- --jobs 1 --out /private/tmp/s35-scene-gate` completed exit0 on the candidate. Full log `/private/tmp/s35-scene-gate.log`; machine results under `/private/tmp/s35-scene-gate/`. This includes corpse-placement-pile and close-corpse rows, both backends and quality tiers. No gate process remains running.

## Smoke gate

`E2E_PORT=4933 SCENE_PORT=4934 E2E_UNITS=1 npm run test:smoke` completed exit0 in 173.9 s (240 s budget), including QA and public builds. Both backend portable crowd/corpse/accessory GPU limit checks pass; public build has no escaping QA globals. Full log `/private/tmp/s35-smoke.log`. No smoke process remains running.

## Paused real-crowd uniform probe

Replay `/private/tmp/s35-same-state/` completed exit0/no page errors. At tick7845, toggled figureFill on three armored batch materials from1 to.25; probe records prove identical entity IDs/HP/XZ and two drawn corpses in both captures. Opened both probe-baseline.jpg and probe-candidate.jpg: they look nearly identical. This does NOT establish successful same-state intervention; material copies may expose a uniform that the captured output closure does not read. Must locate the bound uniform before treating this as decisive A/B. Source-code baseline/candidate matrix remains valid because source graph construction differs there.

## Completion audit

Render source changes only the football armor fill uniform and explanatory comment. Corpse persistence, count, simulation positions and infected stats are untouched. All eight before and eight after controlled console captures were opened and described; original crop and real-fixture captures were opened. scene:gate62/62, smoke7/7, typecheck/lint and committed test:gate107/107 pass. Investigation-only helpers were removed before commit; captures remain outside Git. The source-level matrix is the decisive controlled comparison; the in-page uniform experiment is explicitly inconclusive.
