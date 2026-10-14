# L4 Alpha, recovery and corpse lifecycle — 2026-10-14

Scope: the three PO reports about Alphas standing at the tank, regular infected not getting up, and corpses disappearing. The final PO instruction is whole-level corpse persistence with no time, count, pile or off-screen removal. L10 R5/R6 reuse the shared Alpha brain. Alpha geometry and materials are untouched.

## Causes and changes

- `f2fa932f` assigned Alphas a tank staging point indefinitely. `InfectedSystem` deliberately suppresses combat while `scripted` is set, including after the Alpha arrives. Tank staging now ends on human perception, arrival, or tank silence/removal. The normal human perception and combat scheduler then resume.
- Shared `seek()` selected the courier flow field for crowds above twenty even when the infected's actual target was a soldier or an investigation point. Only courier goals now share that field; other targets use the existing grid route.
- `ee451675` reclaimed downed infected after two seconds under spawn pressure by calling `settle()`, which replaced their recover timer with `-1`. Recoverable bodies now keep their timers and slots. Shared settlement refuses recoverable bodies; L3 retirement also respects this invariant. Permanently killed bodies still use the existing frozen instanced renderer.
- `ee451675` / `db245ae7` deleted corpses for population and per-cell pile limits, including bodies on screen. L4 cleanup and its obsolete cap settings are removed. No corpse deletion replaces them.
- The complete/newbie bots now react to Alpha charge telegraphs at their actual range, keep running from nearby Alphas during the escape, and start the slower newbie backing away before multiple infected are already in melee range. War detours now finish or time out before replanning, as the collapse policy already does; constantly replacing them made the courier oscillate instead of escaping. The newbie retains its 250 ms reaction, skipped attacks and occasional wrong turns. They use ordinary input; gameplay damage, resistance and budgets are unchanged.

The October 14 `cbd67250` battlefield-preserving respawn change was inspected; these causes predate it. The escape-window `nearM` rule only applies to the regular L1 brain and does not hold an Alpha at the tank.

## Specification correction

E22 §5.6's old replenishment and visible corpse-pile removal text directly contradicted the new PO instructions. Only those two statements were corrected. E22-AC14 already requires corpse persistence. The old pile-limit assertion in `L4-collapse.test.ts` was replaced by an identity-persistence assertion over the entire live war trace, with timing/combat/cap assertions retained.

## Reproduction and validation

The original source was restored in a private Hetzner job: **14 of the 16 new regressions fail**, while both L10 controls pass. The fixed regression set passes all sixteen tests. Coverage includes L4 war seeds 1–3 at high/low, recovery at the configured tick, permanent corpse identity through 120 seconds, L1/L3/L4 settlement invariants, a soldier chase around a parked hull with the courier flow active, and L10 research/corridor controls.

- Full remote unit suite: **1,401 passed, 7 platform skips**.
- Typecheck and lint: final repeat passed.
- Full remote sim: 1,008 passed, 13 timing failures under concurrent runner load. All 13 were rerun with the existing two-slot timing isolation wrapper: 34 passed (including all 16 new regressions), 27 filtered skips. The final full L4 rerun: 46 passed, 2 failed, 2 skips. All six new battlefield tests and all four collapse traces passed (including low-tier whole-war persistence). Its two failures were the legacy arrival count and the previous newbie policy. After fixing detour replanning, the final focused complete/newbie rerun passed both: complete 0 deaths / 307.63 s; newbie 1 death / 297.52 s. The death limit remains two.
- `verify E32` with `MI_VERIFY_REMOTE_SIM=1`: 111 selected remote tests passed. E32 now reuses the existing remote timing isolation wrapper; 49 browser tests and all eight native district performance combinations passed (WebGL2/WebGPU × high/low × zoom 1/0.5). The quiet reservation completed within twenty minutes, then released.

## Scene Lab review

Catalog entries: `alphas-at-the-tank`, `l4-corpses-persist`, `l4-infected-get-up` under `tests/scenes/catalog/`. All captures are headless at the game camera. The three fixtures pass **36/36** combinations: WebGL2/WebGPU × high/low × zoom 0.5/1/1.5.

I opened the contact sheets from both tiers/backends and all three zooms, including the assembled review sheets. The five Alphas start behind the tank, split around its sides, reach the courier and repeatedly telegraph/attack. At close zoom the tank fills the initial crop; the Alphas enter the foreground as they round it. At 1 and 1.5 the whole approach is visible. The same ten corpses remain on the ground from frame 0 to 7200 at every tier/zoom, with no fading or disappearing pile. WebGL2 and WebGPU show the same paths, attack areas and persistent bodies. The get-up sheets show regular infected down at frame 600, rising between frames 720 and 1080, then pursuing/attacking from frame 1200 onward.

Evidence (kept in ignored `test-results/alpha-idle/`): `webgl2/index.md`, `webgpu/index.md`, each scene's `sheet.jpg` and `metrics.json`, and `review-<backend>-<scene>.jpg`. The corpse fixture gates at least ten drawn bodies at the final frame. Production-world assertions are in `tools/scenelab/l4-battlefield.ts`: track the same ten permanent corpses every fixed tick through 120 seconds and require each ID in the renderer's actually submitted crowd figures before/after; high/low draw/triangle limits also apply. All four production combinations passed with the same ten corpse IDs present and submitted before and after 120.033 seconds: high 151 draws / 338,220 triangles; low 102 / 190,640. Every fixed tick is checked, and the live-war trace checks persistence through the whole phase.

An initial scene gate incorrectly used a regular-L1 windup counter for Alphas; it was replaced with the existing landed-infected-attack counter. One initial capture overlapped a build and recorded asset 404s; it was discarded and the complete matrix rerun against the finished build.

## Performance and remaining checks

No tests or performance thresholds were reduced. Native timing uses `tools/perf/quiet-run.sh`, one headless worker, ANGLE/Metal and a maximum twenty-minute batch including admission wait. L10 mixed Alpha/dog native high and low gates passed. The final L4 native runs passed both unchanged gates:

| Tier | War / collapse frame p95 | Sim p95 | Turn / tank / break hitches | War / collapse draws | War / collapse triangles |
| --- | --- | --- | --- | --- | --- |
| High | 11.8 / 10.6 ms | 2.3 ms | 18.7 / 15.2 / 13.6 ms | 311 / 328 | 581,504 / 885,052 |
| Low | 30.7 / 33.3 ms | 5.6 ms | 61.6 / 34.6 / 46.6 ms | 178 / 218 | 273,007 / 339,803 |

An initial high collapse capture failed 14 ms (16.4 ms); the final isolated batch above passed. The low setup initially captured before any soldier had fallen, failing its battlefield-state assertion. Setup now waits for actual soldier loss as well as tank hold, helicopter orbit and three Alphas, preserving every assertion and timing threshold. Final evidence is in `test-results/alpha-idle/perf-final/`. I opened both final war captures: high shows soldiers firing and an Alpha engaged beside the left sandbag line, with bodies around the tents; low shows a nearby Alpha with a yellow attack telegraph and firing soldiers.

## Unresolved acceptance conflict

`T-E22-po-3` still requires more than 100 **new arrivals**. With recoverable bodies retaining their slots under the unchanged strict 120-agent cap, seed 2 admits 94 new arrivals alongside 18 initial turns and eight Alphas. Direction, small-group, Alpha engagement and beat assertions pass. The prior implementation manufactured more arrivals by permanently settling recoverable bodies; restoring that would reintroduce the PO bug.

The assertion was left unchanged and the orchestrator was asked whether it should count total distinct threats (including the initial turns) with the same >100 threshold. No approval arrived during this run. Thus the full L4 gate is **not green**, despite the lifecycle regressions, final bots and performance gates passing. No population cap, damage value, test threshold or performance budget was loosened.

No deployment or merge was performed.
