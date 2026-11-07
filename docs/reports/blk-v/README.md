# blk-v — release blocker fixes and measured failures

Base: `2162727d4c889774f5c2306fb3a82dfc82caf2ec`. Worktree: `lane/blk-v`. No deploy or push.

## Row results

| Row | Change | Result |
| --- | --- | --- |
| G-14 | Remove the circular corpse dissolve; retain the existing living/corpse stencil. | Partial repair: unsupported mask-cut boot/leg fragments disappear. Folded/pointed corpse limbs remain **FAIL**. Ten fixture corpse IDs remain through tick 7320 in both tiers. |
| G-26 | Occupied waiting arms use the existing relaxed look-around clip; idle phone stays at the natural lowered wrist. | Requested zoo-staff tick 60 bag/phone forearm fans repaired in low/high, zoom 0.5/1.5 and close detail. Scoped fixture PASS; the full G-26 tracker row remains **NOT CHECKED** because the complete catalog is not qualified. |
| L4-17 | L4 searches wider lateral rings (up to 10 m) before another vertical layer, with the same candidate budget. | **FAIL** against ~1 m. Matched route vertex maxima low 2.077 → 2.045 m, high 2.139 → 1.825 m; root lift 0.88 → 0.66 m. All 295/351 permanent IDs retained. |

The brief permits measured FAIL where the remaining game repair is not small and understood. Alpha death-back geometry alone reaches about 1.60 m; correcting the remaining baked pose/skin seams needs a separate asset/pose repair. No criterion, body count, timer or cap was reduced.

## Commits

- `48324c8`: archive exact historical bytes for six pre-existing G-25 evidence hash mismatches before acceptance reruns; no verdict change.
- `6b2459a`: corpse mask fragment repair.
- `9c3579b`: correct ID probe materials to retain production stencil state. The old probe falsely measured missing courier pixels; corrected low/high × zoom 0.5/1.5 probes measure zero missing. Evidence of the checker error is retained.
- `00cd9d7`: requested bag/phone forearm fix.
- `a921908`: L4 lateral spread and measured remaining FAIL.

## Evidence and method

`G14-proof.json`, `G26-proof.json`, and `L4-proof.json` retain capture SHA-256 values, what was personally seen, and receipts. All 48 matched L4 before/after route/heap images were viewed: broader body carpet, angular folded raised bodies persist; the cellar follow views clearly show courier and dog. Controlled L4 routes use production bot InputFrames with a survival-protected courier, not physical input or mortal threat qualification. Frozen geometry is measured through actual instance/world matrices relative to local ground; airborne blast bodies are excluded. No performance timing was collected.

`final-visual-proof.json` contains a fresh 20-image final-source matrix (all personally viewed), with sourceHash `c19cffe31403b25dc81d307da8947c42c75496e6f5d21ae7a7e77d02a8ad86a1`. The overlap probe retains every courier ID pixel: 14,388 at zoom 0.5 and 1,435 at zoom 1.5, zero missing in both tiers.

`physical-proof.json` contains two complete physical WASD/mouse/E L4 routes. Both finished with zero objective skips, deaths or navigation assists. Low tracked 229 corpse identities over 261 rendered samples, high 288 over 269; both have zero missing corpse samples. Their independently observed maxima are 1.701 m / 1.924 m, still FAIL. All 24 physical-route images were viewed: raised/folded bodies persist in heap details, dense combat still contains angular panels/dark fragments, cellar courier and dog are visible, and the native result transitions to L5. Survival protection means these runs cannot qualify mortal threat.

Initial captures that missed actors or did not settle zoom are explicitly rejected in the evidence. The requested `docs/reports/fix52-corpse/README.md` is absent. Initial filesystem restrictions were resolved before implementation and checks. The initial corpse CLI diagnostic used the guarded legacy headless launcher; it is excluded from final shared-pool qualification. All later controlled, physical and final capture sessions use the shared pool.

## PO inspection

- P: inspect the phone carried at the lowered wrist during idle, instead of at the chest.
- P: inspect the L4 lateral spread/body carpet, up to 10 m from source deaths. No taste approval is claimed.

## Validation

- Final `npx tsc --noEmit`: PASS.
- Final `npm run lint`: PASS.
- `scene:gate -- --out test-results/blk-v/scene-gate --jobs 1`: PASS, 50/50 rows (27 WebGL2 / 23 WebGPU), 0 known / 0 not run. All 50 sheets personally viewed. Structured metrics and runner identities: `scene-gate.json.gz`; per-image observations: `capture-manifest.json`.
- All 203 raw PNG/JPG images were SHA-256 checked against the personally viewed manifest and deleted. Zero raw images remain in this lane output (`capture-cleanup.json`).
- Initial `npm test`: one review freshness failure while render source was dirty. Retry after row commit: two 30-second test timeouts under concurrent load (L4 contact/gate tools). No test or timeout was changed. Final `npm test -- --maxWorkers=1`: PASS, 27 files / 107 tests in 99.8 seconds against unchanged 240-second budget.
- `npm run qa:accept -- --level all --reuse --skip-browser`: all ten reports completed; exit 1 because FAIL criteria remain. Zero native policy, fixture, or checkpoint errors. All 40 low/high complete/stationary terminal simulation hashes match release base (`native-base-comparison.json`). This is the all-level native group plus targeted browser evidence, not full real-input campaign requalification. `acceptance-summary.json` records row statuses.
- The first final-source acceptance run reached all native checks but stopped during L10 report assembly because the slim worktree omitted two tracked historical physical receipts. Restored exact Git bytes (`hydrated-evidence.json`), then refreshed all reports using matching current receipts. No stale evidence was promoted.
- Final `npm run qa:threat -- --out test-results/blk-v/threat`: PASS, all ten levels, **0 fail flags**, run alone after all other checks; 285.1 s against the unchanged 600 s budget. Complete audit: `threat.json.gz`; readable result: `threat-README.md`.
- Earlier acceptance attempts (G-25 hash mismatch; deliberately superseded older-source run) are retained in `logs/`. `checks.json` retains all final and rejected run outcomes and hashes.

## Reproduction

Use `final` capture mode against this branch; `before` is a baseline-only diagnostic. Use a free dedicated port, e.g. 4834; never 3300. All browser commands are headless through the shared pool.

```sh
SCENE_PORT=4834 BROWSER_POOL_JOB_ID=blk-v node --import tsx tools/qa/blk-v-captures.mjs G14 final low
SCENE_PORT=4834 BROWSER_POOL_JOB_ID=blk-v node --import tsx tools/qa/blk-v-captures.mjs G26 final low
SCENE_PORT=4834 sh tools/e2e-lock.sh node --import tsx tools/qa/blk-v-l4-corpses.ts low after
SCENE_PORT=4834 PLAYTEST_NO_FRAME_TIMING=1 PLAYTEST_GOD=1 PLAYTEST_ACCEPTANCE_LEDGER=1 PLAYTEST_L4_CORPSE_CAPTURES=1 PLAYTEST_REVEAL_AUDIT=1 PLAYTEST_POSE_PROBES=0 sh tools/e2e-lock.sh node --import tsx tools/qa/blk-v-physical.ts low
```

Repeat with high tier (and another free port if running two concurrently). Do not run more than two browser contexts. The physical wrapper bounds the route to 480 seconds.

## Outcome

The bounded brief is complete: three minimal rendering fixes are committed and verified; the requested G-26 fixture defect is repaired. G-14 folded corpse geometry and L4-17 height remain measured release failures. The full G-26 catalog remains NOT CHECKED. No release approval or PO taste approval is claimed.
