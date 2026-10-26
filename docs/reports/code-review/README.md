# Codebase simplification review

Reviewed the current `lane/code-review` checkout at `0009f107` (same tree as `main` at review start). This is a read-only review; the only repository addition is this report. Findings are ranked by likely simplification value and safety. Estimates are directional; no behavior changes are proposed without the listed gates.

## Executive summary

1. Remove byte-identical committed evidence copies: ~206 MB checkout savings, low risk, 1–2 h.
2. Retain only selected final receipts and archive bulky traces/captures: potential ~3.2 GB checkout savings, medium risk, 2–4 h per evidence batch.
3. Delete the duplicate 31-line GLB texture stripper; keep `tools/assets/stripGlbTextures.ts`: 31 LOC, low risk, <1 h.
4. Keep test runs from rewriting tracked receipts by default: 0 LOC net, medium risk, 2–3 h.
5. Move five full-campaign simulations (112–240 s each) to nightly; keep level completion gates: 0 LOC deleted, low/medium risk, 2–4 h.
6. Share the repeated player-animation capture/encoding scaffold: ~60–100 LOC, medium risk, 2–4 h.
7. Separate mission constants from render imports: ~10–30 LOC and narrower dependency graph, low/medium risk, 1–2 h.
8. Move CampaignUI progression/world mutations behind campaign commands: ~0 LOC net, medium risk, 2–4 h.
9. Extract focused SceneLab probes from its 1,717-line god class: ~0 LOC net, medium risk, 2–4 h per seam.
10. Split InfectedSystem's 243-line update loop into named phases only after profiling: ~0 LOC net, high risk, 3–4 h per seam.

## 1. Redundancy

### R-01 — Two byte-identical GLB texture strippers

**Evidence:** [`tools/assets/stripGlbTextures.ts`](../../../tools/assets/stripGlbTextures.ts:1) and [`tests/unit/helpers/stripGlbTextures.ts`](../../../tests/unit/helpers/stripGlbTextures.ts:1) are byte-for-byte identical 32-line implementations. The tools copy is used by `tools/crowdfoot/harness.ts:1,18–20`; the test copy is imported by the GLB loader tests under `tests/unit/assets/` and `tests/unit/render/`.

**Simplification:** Keep the tools copy, which already serves the non-test harness; update the tests to import it and delete `tests/unit/helpers/stripGlbTextures.ts` (31 executable LOC plus its comment). Avoid creating a third generic helper layer.

**Risk / effort:** Low / <1 h. **Behavior-neutral verification:** `npm run typecheck`, `npm run test:unit`; run the crowdfoot harness once against its existing fixture.

### R-02 — Player animation capture scripts repeat setup and encoding

**Evidence:** [`tools/playeranim/capture.ts:1–40`](../../../tools/playeranim/capture.ts:1) and [`tools/playeranim/fable-capture.ts:1–40`](../../../tools/playeranim/fable-capture.ts:1) both resolve the same ffmpeg path, open a browser through `../skinpilot/browser`, advance deterministic frames, take image buffers, and encode WebM. `game-capture.ts:1–18,35–62` and `roundhouse-capture.ts:1–17,24–60` repeat the encoder setup as well. Their scenarios and output contracts differ, so deleting one whole script is not safe.

**Simplification:** Keep all scenario-specific entry points; extract only the shared browser-frame collection / ffmpeg encoding routine and options into one player-animation helper. Estimate 60–100 LOC removed across callers.

**Risk / effort:** Medium / 2–4 h. **Behavior-neutral verification:** typecheck and the existing capture scripts for one still-only case and one WebM case; compare frame count, dimensions, and metadata.

### R-03 — 1,610 exact duplicate evidence groups

**Evidence:** A blob-ID scan of tracked `docs/reports/` and `test-results/` found 1,610 groups with identical content. Removing all but one copy would reduce checked-out files by about 205,955,935 bytes (~196 MiB). Examples: `docs/reports/postmerge-10/evidence/pair1-E32-campaign.json` duplicates `docs/reports/verify-sweep/evidence/E32-campaign-seed-1.json` (2.7 MB); `docs/reports/merge-batch12/e18-final/horde/E07/horde-archetypes.png` duplicates `test-results/epics/E18/horde/E07/horde-archetypes.png` (1.7 MB); the same `light-lab-webgl-high.png` is present in four heap-budget evidence directories.

**Simplification:** Keep the canonical final receipt referenced by the report; remove only verified duplicate paths in small batches. Do not deduplicate files whose names differ but whose contents are intentionally presented as before/after evidence without checking provenance.

**Risk / effort:** Low after provenance check / 1–2 h per batch. **Behavior-neutral verification:** blob hashes, report links, `git diff --stat`, and confirm each cited final report still resolves its retained receipt.

### R-04 — Evidence directories contain oversized raw outputs

**Evidence:** `git ls-tree -r -l HEAD` reports 25,600 tracked files / 2,516,886,904 bytes in `docs/reports/` and 6,132 files / 914,441,961 bytes in `test-results/`: about 3.20 GB in the checked-out tree. Large examples include 9.2 MB compressed browser traces under `docs/reports/load-stalls/evidence/diagnostic-population/`, 7.2 MB WAV in `test-results/epics/E23/audio-war-reference.wav`, and 6.9 MB performance JSON under `docs/reports/batch15/` and `batch16/`. This size is current tree content, not a claim that a deleting commit would reclaim already-shared Git history.

**Simplification:** Establish a retention rule: keep concise conclusions and the minimum reproducible/final proof in Git; move raw traces, repeated captures, and transient logs to external run artifacts or ignore them. Work folder by folder; potential checkout reduction is large, but deleting all evidence at once is not safe.

**Risk / effort:** Medium / 2–4 h per reviewed folder. **Behavior-neutral verification:** audit references in Markdown and scripts, verify retained evidence hashes, and confirm `git ls-tree` size falls by the intended amount.

## 2. Separation of concerns

### S-01 — Render imports concrete mission implementations for constants/rules

**Evidence:** [`src/render/InteractionView.ts:1,15–19`](../../../src/render/InteractionView.ts:1) imports `LevelSixSubway` and calls `gateWait()` inside a presentation predicate. [`src/render/L3Props.ts:1–4`](../../../src/render/L3Props.ts:1) imports `L3_GATES` from the large `LevelThreeCollapse` mission module. Render code therefore loads mission logic to obtain view-facing gate data.

**Simplification:** Move the gate geometry/anchor constants and the small gate-position function to a level-data/presentation contract consumed by both mission and render code. Keep progression and state transitions in simulation. Estimate 10–30 LOC removed or relocated, plus less runtime coupling.

**Risk / effort:** Low/medium / 1–2 h. **Behavior-neutral verification:** `npm run typecheck`, focused L3/L6 mission and interaction unit tests, and `npm run test:levels` for L3/L6.

### S-02 — Campaign UI owns simulation/progression operations

**Evidence:** [`src/ui/CampaignUI.ts:1–5,18–27`](../../../src/ui/CampaignUI.ts:1) imports progression operations (`pickUpgrades`, `finishRewards`, etc.) and holds `Game`; `screen()` directly pauses the clock, clears input, and calls `world.clearInput()` at line 22. `showMenu()` also chooses the UI route and mutates campaign state at lines 29–34. The module's comment says the campaign screens are separate from gameplay HUD, but the controller still crosses both presentation and state ownership.

**Simplification:** Keep DOM construction and user-facing text in CampaignUI; expose narrow start/continue/reward commands from the campaign coordinator for state changes and pauses. Do not move every button into a generic UI framework.

**Risk / effort:** Medium / 2–4 h. **Behavior-neutral verification:** `tests/unit/progression/campaign.test.ts`, CampaignUI tests, save/load continuity, and one headless campaign start/continue path.

### S-03 — GameView update is an orchestration god method

**Evidence:** [`src/render/GameView.ts:875–1129`](../../../src/render/GameView.ts:875) is a 255-line `update(alpha)` method. It handles freeze/context early returns, destination markers, player/vehicle/crowd presentation, visibility and culling, interactions, mission UI, lighting and profiling while reading `SimWorld` throughout. The class is 1,276 lines (`wc -l`).

**Simplification:** First extract cohesive update phases already represented by owned view objects (for example destination/interaction markers and presentation diagnostics); keep frame ordering in GameView. Avoid moving stateful systems wholesale or adding a generic update pipeline.

**Risk / effort:** Medium/high / 2–4 h per extraction. **Behavior-neutral verification:** focused render unit tests, `npm run test:e2e -- --grep @smoke`, and the render-contract/PO checklist before and after.

## 3. Over-engineering and oversized modules

### O-01 — SceneLab is a 1,717-line probe, simulation, and renderer controller

**Evidence:** [`src/debug/scenelab/SceneLab.ts:95–228`](../../../src/debug/scenelab/SceneLab.ts:95) owns the `SceneLab` class and setup; `228–913` sets worlds, actors, vehicles, handovers, commands, effects, and camera; `963–1257` steps/records gameplay and probes; `1258–1717` samples geometry, clips, LODs, metrics, and debug controls. The same object has to know about simulation entities and renderer internals.

**Simplification:** Extract one probe family at a time behind narrow read-only inputs (for example clipping/LOD metrics first). Keep scene orchestration in SceneLab. This is code organization, not a promise of LOC deletion.

**Risk / effort:** Medium / 2–4 h per seam. **Behavior-neutral verification:** tooling unit tests, `tests/unit/tooling/scenelab.test.ts`, the matching scene catalog cases, and `npm run typecheck`.

### O-02 — InfectedSystem combines scheduling, attacks, lifecycle, and navigation

**Evidence:** [`src/sim/ai/InfectedSystem.ts:1–25`](../../../src/sim/ai/InfectedSystem.ts:1) imports appearance, multiple level data modules, perception/search, and motion; the class is 1,586 lines. Its `update()` is [`245–487`](../../../src/sim/ai/InfectedSystem.ts:245), 243 lines. Attack resolution and down/recovery/death logic continue at `531–681`; L1-specific initialization and movement continue later in the same class.

**Simplification:** Extract only a cohesive phase with existing state boundaries (for example attack resolution) after mapping its event/order dependencies. Keep the public `InfectedSystem` facade and avoid a rewrite. No behavior/LOC savings are assumed until a seam is proven.

**Risk / effort:** High / 3–4 h for one seam and characterization. **Behavior-neutral verification:** focused AI/combat simulations, level completion seeds, deterministic hash checks, then `npm run test:sim`.

## 4. Smells, dead code, and operational receipts

### D-01 — Test execution writes into tracked report/evidence paths

**Evidence:** `tests/levels/L4-collapse.test.ts:75–77` writes run receipts to `test-results/epics/E22`; `tests/perf/l1-budgets.spec.ts:14–17` does likewise for performance results. In this review, the selected Vitest command modified 39 tracked files under `docs/reports/` and `test-results/` before they were restored from `HEAD`. The broader test tree has 325 test/spec files containing `writeFileSync`, `mkdirSync`, or `appendFileSync`.

**Simplification:** Default test outputs to a temporary run directory; require an explicit output path/flag to refresh committed evidence. Preserve proof-producing lanes that intentionally publish receipts.

**Risk / effort:** Medium / 2–3 h to define shared output configuration, then migrate in batches. **Behavior-neutral verification:** run focused tests with default settings and assert `git status --short` stays clean; run a proof lane with explicit output and compare its schema.

### D-02 — Large generated data is a false-positive dead-code target

**Evidence:** [`src/data/physicsAssets.ts:1`](../../../src/data/physicsAssets.ts:1) is 8,216 lines and explicitly says it is generated from production GLB data by `tools/assets/physics-metadata.ts`. It is the largest TypeScript file, but its size is data, not a handwritten god module.

**Simplification:** Keep it generated and keep its generator as the source of truth. Do not hand-trim, split, or run a dead-code remover against generated entries without checking manifest/runtime references.

**Risk / effort:** Low / no change. **Behavior-neutral verification:** `npm run assets:validate`, typecheck, and generated-output diff after any future generator change.

### D-03 — No unused-export deletion is proven by the available scan

**Evidence:** `knip` and `jscpd` are not installed locally; `npm run typecheck` passes but does not prove that exports/files are unused. A source-text search is insufficient for dynamic registration and test/tool entry points. The only exact code duplication established in this pass is R-01.

**Simplification:** Do not delete exports based on grep alone. Add a permissively licensed dead-code/duplication scan in a separate review lane only if it can run offline and respect dynamic imports and tool entry points; then validate each candidate manually.

**Risk / effort:** Low to defer; 1–2 h to evaluate offline tooling. **Behavior-neutral verification:** dry-run report only, then typecheck/lint and targeted tests for each individually approved removal.

## 5. Tests: duplication, duration, brittleness, and proposed suite

### T-01 — Full campaign simulations dominate the measured tail

**Evidence and command:** `npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --configLoader runner --reporter=json --outputFile=/private/tmp/code-review-vitest.json` exercised 652 files, 730 suites, and 3,882 assertions in about 20 minutes on this host. Result: 3,857 passed, 23 failed, 2 pending; 19 suites failed. The failure mix includes sandbox/tooling constraints (`tests/sim/runner.test.ts` could not open a tsx IPC pipe; `tests/unit/setup.test.ts` could not bind 127.0.0.1:3302; verify-quiet temp receipts were missing) and behavior assertions that need normal-environment triage. Do not interpret this run as a clean baseline.

The 30 slowest assertions from that run:

| # | Duration | Test file | Test |
|---:|---:|---|---|
| 1 | 239.76 s | `tests/levels/L10-campaign.test.ts` | T-E32-32 continuous seed 1 L1 through L10 reaches credits with real campaign handovers |
| 2 | 192.20 s | `tests/levels/L9-campaign.test.ts` | T-E31-20 continuous seed 1 L1 through L9 commits real campaign handovers and axe reset |
| 3 | 112.72 s | `tests/levels/L6-campaign.test.ts` | T-E24-08 continuous complete campaign on one seed with real L5 handover |
| 4 | 111.24 s | `tests/levels/L3.test.ts` | L3 evade-only never attacks and still reaches the army zone |
| 5 | 110.09 s | `tests/levels/L6-campaign.test.ts` | T-E24-08 continuous newbie campaign on one seed with real L5 handover |
| 6 | 69.19 s | `tests/levels/L4-finale-pressure.test.ts` | PO #17 collapse walk preserves sight-driven action, newbie death limit, and E18 cap |
| 7 | 66.20 s | `tests/unit/assets/validate.test.ts` | T-E17-02b production outputs satisfy orientation, palette, LOD, stump, geometry contracts |
| 8 | 63.67 s | `tests/levels/L4.test.ts` | L4 evade-only reaches cellar; low tier finishes too |
| 9 | 54.26 s | `tests/levels/start-checkpoint-clearance.test.ts` | L4 every start/checkpoint has no NPC within 0.8 m |
| 10 | 49.53 s | `tests/levels/start-checkpoint-clearance.test.ts` | L7 every start/checkpoint has no NPC within 0.8 m |
| 11 | 46.29 s | `tests/levels/L4.test.ts` | T-E22-03 newbie bot finishes a single seed with few deaths |
| 12 | 46.05 s | `tests/levels/L4.test.ts` | T-E22-14 live cellar damage remains traceable to run events |
| 13 | 45.57 s | `tests/levels/L4.test.ts` | T-E22-12 infected outgrow kills by line break |
| 14 | 45.40 s | `tests/levels/L4-collapse.test.ts` | T-E22-13 idle-courier breach flood / three-line collapse |
| 15 | 45.14 s | `tests/levels/start-checkpoint-clearance.test.ts` | L10 every start/checkpoint has no NPC within 0.8 m |
| 16 | 42.91 s | `tests/levels/L4.test.ts` | T-E22-13 line breaks after third lost line and helicopter withdraws |
| 17 | 42.57 s | `tests/levels/L10.test.ts` | T-E32-04 one seed completes full L10 route with ordinary inputs |
| 18 | 42.44 s | `tests/levels/L4.test.ts` | T-E22-07 alarm admits 15–25 infected with >=10 humans near alarm |
| 19 | 42.37 s | `tests/sim/missions/l7-audit.test.ts` | T-E29-02 standalone seed boards >=60% of starting group |
| 20 | 38.97 s | `tests/levels/L4-respawn.test.ts` | T-E22-17 three deaths after Fall Back still reach cellar |
| 21 | 37.22 s | `tests/sim/world/solid-registry.test.ts` | natural L4 tank excludes every living Alpha through audit tick 15662 |
| 22 | 36.99 s | `tests/levels/L4.test.ts` | T-E22-02 complete bot finishes a single L4-default seed |
| 23 | 36.89 s | `tests/levels/L4.test.ts` | T-E22-06 machine-gun damage/range/TTK contract |
| 24 | 36.00 s | `tests/sim/missions/L6-protection.test.ts` | T-E24-09 evade courier evacuates at most thirty percent |
| 25 | 33.41 s | `tests/levels/L4.test.ts` | T-E22-17 checkpoints preserve battlefield state across deaths |
| 26 | 32.90 s | `tests/levels/L2.test.ts` | T-E20-21 rescued people never despawn and end at checkpoint |
| 27 | 32.39 s | `tests/unit/static.test.ts` | T-E01-01b typecheck, lint, build exit without warnings |
| 28 | 32.38 s | `tests/levels/L4.test.ts` | T-E22-12 first Alphas use district mouths inside caps |
| 29 | 31.94 s | `tests/levels/L3.test.ts` | T-E21-18 checkpoints restore squad/outbreak/pickup state |
| 30 | 31.93 s | `tests/sim/districts.test.ts` | T-E10-02 deterministic navigation connects objectives at every tier |

**Simplification:** Keep one representative complete-campaign continuity test in the nightly lane; keep short, per-level completion and invariant tests in PR validation. The L1→L10 / L1→L9 cases are 432 seconds together and should not both gate every unrelated UI/render change. Retain seed matrices for scheduled gameplay confidence.

**Risk / effort:** Medium / 2–4 h to classify tags and CI selection. **Behavior-neutral verification:** run the proposed fast gate and nightly full suite on the same commit; compare per-level completion outcomes and core invariant coverage. Estimated all-suite inventory is 968 test/spec files; proposed PR selection is about 700 (402 unit + 162 sim + 88 level + 9 QA + 28 visual + 11 PO/acceptance E2E), with the rest nightly. The measured deterministic 652-file run was ~20 min and non-clean; estimate the selected PR lane at ~25–40 min, with the current full 968-file mix likely 1–3 h. Treat these as planning estimates, not a measured all-suite baseline.

### T-02 — Similar names mark different test layers; avoid deleting by filename

**Evidence:** 968 tracked `*.test.ts` / `*.spec.ts` files span unit (402), sim (162), levels (88), E2E (216), perf (63), QA invariants (9), and visual (28). For example, `tests/unit/levels/continuity.test.ts` checks static layout/save contracts; `tests/levels/continuity.test.ts` runs L1→L2 simulation; `tests/e2e/levels/continuity.spec.ts` checks real-camera presentation. They share a feature name but cover different contracts. Likewise, same-name test modules like `tests/sim/ai/alpha-support.test.ts` and `tests/perf/alpha-support.spec.ts` exercise simulation and browser performance.

**Simplification:** Reduce the routine gate by scheduling layers, not by deleting same-named files. For actual deletion, compare assertion intent and fixtures first; do not claim a test is redundant from its filename. A future assertion-level audit may find more candidates, but this review has no safe deletion list beyond R-01.

**Risk / effort:** Low / 1–2 h to codify the selection; deletion risk is medium until assertion mapping is done. **Behavior-neutral verification:** publish a coverage matrix mapping gameplay invariants, level completion, render contracts, and PO checklist items to retained tests; ensure each required invariant has a retained owner.

### T-03 — Boundary assertions need triage before they become cleanup targets

**Evidence:** The measured run failed `tests/levels/L4-collapse.test.ts:125` with `expected 10 to be less than 10`, and also reported failures in `tests/sim/combat/balance.test.ts:30`, `tests/sim/levels/l10-arrival.test.ts:8`, `tests/sim/performance/l10-finale.test.ts:29`, and other gameplay tests. Some failures are clear behavior mismatches, not proof of brittle tests. The exact threshold at L4 is a review candidate because the test fails at equality; changing it without comparing the PO contract would weaken coverage.

**Simplification:** Triage each failed assertion against its authored requirement and deterministic seed. Replace only accidental pixel/frame/float exactness with a meaningful tolerance; preserve outcome, route, combat, and level-completion invariants. Do not delete these failures to make the suite green.

**Risk / effort:** Medium/high / one lane per cluster. **Behavior-neutral verification:** rerun the focused failing test twice on the same seed, inspect the defining spec/PO criterion, then run its layer gate and campaign completion test.

### T-04 — Top-level suite has no single current, passing timing baseline

**Evidence:** `package.json:19–22,28–33` exposes separate `test:unit`, `test:sim`, `test:levels`, `test:e2e`, `test:visual`, and perf scripts; `vitest.config.ts:3–35` isolates timing files ahead of functional tests and caps workers at four. The run above was not green (23 failures), so its 20-minute duration is a host measurement, not a stable baseline.

**Simplification:** Keep the existing categories but emit one structured duration summary per lane to `/tmp` or ignored `test-results/`, with a baseline date/commit. Use it to select nightly-only slow cases rather than maintaining duplicated scripts/reports.

**Risk / effort:** Low / 1–2 h. **Behavior-neutral verification:** verify the timing JSON does not dirty tracked files; run typecheck and a representative unit/sim/level gate. No new test assertions are needed.

## Proposed order of work

Each batch is independent and sized to one lane (maximum four hours). The order puts mechanical, measurable savings first and high-risk simulation restructuring last.

| Batch | Findings | Work | Effort | Gate |
|---|---|---|---:|---|
| A | R-01 | Remove duplicate GLB helper and repoint test imports to the tools implementation. | <1 h | typecheck + unit tests + crowdfoot harness |
| B | R-03 | Remove only blob-identical non-canonical artifact copies; keep final cited receipts. | 1–2 h | link/hash audit + tree-size comparison |
| C | D-01, T-04 | Make generated test receipts opt-in/out-of-tree and record per-lane timing JSON. | 2–3 h | focused gate + clean `git status` |
| D | T-01, T-02 | Tag fast PR vs nightly tests; preserve level completion, gameplay invariants, render contracts, and PO checks. | 2–4 h | compare fast and nightly outcomes on one commit |
| E | R-02 | Extract player-animation collection/encoding helper, keep specialized capture scripts. | 2–4 h | typecheck + still/WebM metadata comparison |
| F | S-01 | Move L3/L6 view-facing constants to shared level data. | 1–2 h | L3/L6 unit + level checks |
| G | S-02 | Move campaign state transitions behind narrow coordinator commands. | 2–4 h | campaign/save/continue tests + headless path |
| H | R-04 | Review one old evidence directory at a time; retain canonical summaries and necessary proofs. | 2–4 h per directory | references + size/hash audit |
| I | S-03, O-01 | Extract one GameView update phase and one SceneLab probe family as separate lanes. | 2–4 h each | render contracts + scene catalog |
| J | O-02, T-03 | Characterize and triage AI/test failures before any InfectedSystem extraction or threshold edit. | 3–4 h | deterministic seed repeats + sim/level gates |

## Finding cross-reference

| ID | Area | Files | Est. LOC removed | Risk | Batch |
|---|---|---|---:|---|---|
| R-01 | Redundancy | `tools/assets/stripGlbTextures.ts`; `tests/unit/helpers/stripGlbTextures.ts` | 31 | Low | A |
| R-02 | Redundancy | `tools/playeranim/{capture,fable-capture,game-capture,roundhouse-capture}.ts` | 60–100 | Medium | E |
| R-03 | Artifacts | `docs/reports/**`; `test-results/**` duplicate blobs | 0 | Low after provenance | B |
| R-04 | Artifacts | `docs/reports/**`; `test-results/**` raw outputs | 0 | Medium | H |
| S-01 | Separation | `src/render/InteractionView.ts`; `src/render/L3Props.ts`; L3/L6 mission/data modules | 10–30 | Low/medium | F |
| S-02 | Separation | `src/ui/CampaignUI.ts`; campaign coordinator | 0 net | Medium | G |
| S-03 | God method | `src/render/GameView.ts:875–1129` | 0 net | Medium/high | I |
| O-01 | Over-sized tool | `src/debug/scenelab/SceneLab.ts` | 0 net | Medium | I |
| O-02 | Over-sized sim | `src/sim/ai/InfectedSystem.ts:245–487` | 0 net | High | J |
| D-01 | Test output smell | `tests/levels/L4-collapse.test.ts`; `tests/perf/l1-budgets.spec.ts`; 325 writers | 0 net | Medium | C |
| D-02 | Generated data (keep) | `src/data/physicsAssets.ts`; `tools/assets/physics-metadata.ts` | 0 | Low | — |
| D-03 | Dead-code scan gap | `src/`, `tools/`, `tests/` | 0 | Low to defer | — |
| T-01 | Slow suite | campaign/level tests in measured top-30 table | 0 deleted | Medium | D |
| T-02 | Test-layer overlap | `tests/unit`, `tests/sim`, `tests/levels`, `tests/e2e`, `tests/perf`, `tests/visual`, `tests/qa` | 0 proven | Low to schedule; medium to delete | D |
| T-03 | Boundary failures | `tests/levels/L4-collapse.test.ts`; listed sim failures | 0 until triage | Medium/high | J |
| T-04 | Timing baseline | `package.json:19–33`; `vitest.config.ts:3–35` | 0 | Low | C |

## Review checks and limits

- `npm run typecheck`: passed on the reviewed tree.
- Selected Vitest run: completed non-zero with 19 failed suites / 23 failed assertions; failures include both behavior mismatches and sandbox subprocess/port errors. Full details and per-case durations were written only to `/private/tmp/code-review-vitest.json`, not committed.
- The run refreshed tracked proof files; all 39 changed tracked files under `docs/reports/` and `test-results/` were restored from `HEAD`. Worktree contains no source changes.
- `jscpd` and `knip` were absent locally; no network install was attempted. Exact duplicate-content detection was done locally using Git blob IDs. Therefore D-03 is an explicit audit gap, not a claim that the whole repository has no dead code.
- WebGPU, full browser E2E, full visual/performance matrices, and manual gameplay were not run. Batch verification lists the appropriate follow-up gates.
