# L10-Q1 Scene Lab

Scope: E32-AC07/09–11/13–16 visual fixtures, seven region pairs supporting AC29/30, and unchanged E18 renderer budgets. No gameplay or asset changes. Q2 owns the charge/release/mist/ending fixtures; Q6 owns complete performance and device acceptance.

## Catalog

`npm run scene:matrix` now includes `l10-q1-*`. Most of the 31 fixtures reuse the earlier systems/encounter lanes through relative `extends`, including their production mission checkpoints, encounter populations, seeded coats and Mega scheduler. All have game/follow cameras, so the catalog runs high/low at zoom 0.5, 1 and 1.5 without scaling props.

- Dog idle/coats/pack/pounce: live non-corgi dogs, healthy coat controls, protected corgi and courier scale.
- Mega pursuit: obstructed running loop and coarse-to-detailed residency handoff, cruise error ≤2% and resident step ≤0.25 m.
- Mega charge/slam/grab: production windup, impact and recovery timelines from L10-S4, plus wall and real-input dodge controls. Open/dodge fixtures require their named move to activate; dodge fixtures require all 100 HP.
- Audio/ring: 250/120/40/20 m and confirmed death with the production HUD. Canvas captures do not claim offline audio loudness measurements. Gates require band text, player-centered ring and no exact entity pin or coordinates.
- Cure carry: male/female courier rigs at the real `cure-research` checkpoint, with the mission item's backpack attachment.
- R1–R7: production district crops and authored region encounters; all retain the zero placeholder gate and 300 draws/500k triangles limits.
- `l10-q1-alpha-silhouette-known-low-defect`: isolated regular Alpha at the center of the game camera. The canvas gate `alphaSilhouetteBlackWhiteEdgeNoise` reports abrupt black/white edge share inside the normalized actor crop. It fails on insufficient visible edges as well as excessive noise; existing canvas/visibility gates also remain. This is a diagnostic for the reported jagged triangles, not general silhouette approval. It changes no asset and has no expected-failure exemption.

Every run records requested and actual tier, and a `requestedQuality` gate alongside the existing requested-backend gate. Runs use `--query ui=1`, exercising the existing session quality pin after UI settings and level load.

## Reproduction

After `npm run build`, use a unique private preview port and the shared browser lock:

```sh
SCENE_PORT=34871 SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --matrix --jobs 1 --query ui=1 --backend webgl2 --filter 'l10-q1-*' --out test-results/l10-q1/webgl2
SCENE_PORT=34871 SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --matrix --jobs 1 --query ui=1 --backend webgpu --filter 'l10-q1-*' --out test-results/l10-q1/webgpu
```

Split large captures into region, dog/carry/scale and Mega/ring batches to release the shared lock. Native performance uses `tools/perf/quiet-run.sh` with a maximum 20-minute reservation; do not chain reservations. WebGPU captures are headless visual checks, not manual device acceptance.

## Validation and visual review

- Fresh `npm run build`, `npm run typecheck`, `npm run lint`, and `git diff --check`: pass.
- Hetzner focused Scene Lab suites: **18 tests pass** (six new catalog/edge controls plus twelve existing Scene Lab tests). The final run includes the two-unit matrix reservation and named-move assertions.
- Full unit/sim/`tests/levels` sweep completed on Hetzner with four workers: **2,639 passed, 5 failed, 9 skipped**, 386 files, 3,271 s. Four timing failures are in untouched L1, crossing-residency, Alpha-support and zoo-S2 tests; the untouched production asset validator timed out at its existing 300 s limit. Exact diagnostics are in `full-sweep-failures.txt`. An isolated single-worker rerun reserved both runner slots: **all five pass**, asset validation 174 s, total 190 s. This supports contention as the cause of the broad-run failures. No limits or tests changed; both original failures and the isolated results are retained in `full-sweep-failures.txt` and `isolated-rerun.txt`.
- `npm run verify -- E32` passed its static checks, then waited for the shared browser lock before build. It was stopped before building to avoid rebuilding this worktree during the queued capture job; full verify is **not green**.
- **Browser QA blocked:** after a fresh build, the headless WebGL2 Alpha pilot waited **30 min 40 s** without admission. The queued job was stopped under the binding 30-minute cutoff. There were no live browsers owned by this lane and no quiet-run reservation. See `browser-admission.json`. Fresh high/low × zoom 0.5/1/1.5 WebGL/WebGPU sheets, `ui=1` tier-pin execution, actual Alpha pixel-threshold calibration and native E18 timing are **unmeasured**. Numeric gates and visual acceptance are not claimed.

### Opened existing game-camera evidence

These sheets were already present from the encounter/audio lanes; they are prior evidence, rather than fresh Q1 captures.

- [R5 quarantine high, zoom 1](../l10-e2/webgl2/l10-e2-quarantine@high-z1/sheet.jpg): readable olive human torso, orange eyes, attached arms/legs and a stock world bar among regular infected. The cyan special shape spans the road after windup.
- [R5 quarantine low, zoom 1](../l10-e2/webgl2/l10-e2-quarantine@low-z1/sheet.jpg): **FAIL — known regular Alpha silhouette defect**. Pale fragmented triangles spread through the torso and legs beneath a valid health bar; regular humans/dogs around it retain their silhouettes. This is the asset issue named by the orchestrator, unchanged by Q1.
- [20 m audio/ring low, zoom 1](../l10-mega-audio/webgl2/l10-mega-audio-20@low-z1/sheet.jpg): the small courier remains clear on the open slab; the amber ring is centered in the upper-right minimap, with readable `Mega Alpha: near` text. No separate exact boss dot is visible through frames 0/30/60.

The isolated Alpha fixture and edge gate provide a named regression target. Its 10% edge-share threshold passes the continuous dark synthetic control and rejects the jagged black/white synthetic control; **real-canvas calibration remains blocked**. Do not treat that unit result as visual approval. E18 renderer caps and the zero-placeholder gates remain strict; native frame/heap/device acceptance needs the queued QA recipe when slots become available.
