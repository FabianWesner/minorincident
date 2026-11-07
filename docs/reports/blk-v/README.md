# blk-v — release blocker pass

Base: `2162727d4c889774f5c2306fb3a82dfc82caf2ec`. Worktree: `lane/blk-v`. No deploy or push.

## Row results

| Row | Change | Result |
| --- | --- | --- |
| G-14 | Remove the circular corpse dissolve; retain the existing living/corpse stencil. | Partial repair: unsupported mask-cut boot/leg fragments disappear. Folded/pointed corpse limbs remain **FAIL**. Ten fixture corpse IDs remain through tick7320 in both tiers. |
| G-26 | Occupied waiting arms use the existing relaxed look-around clip; idle phone stays at the natural lowered wrist. | Requested zoo-staff tick60 bag/phone forearm fans repaired in low/high, zoom0.5/1.5 and close detail. This is a scoped fixture PASS, not whole-row catalog qualification. |
| L4-17 | L4 searches wider lateral rings (up to10m) before another vertical layer, with the same candidate budget. | **FAIL** against ~1m. Matched route vertex maxima low2.077→2.045m, high2.139→1.825m; root lift.88→.66m. All295/351 permanent IDs retained. |

The brief permits measured FAIL where the remaining game repair is not small and understood. Alpha death-back geometry alone reaches about1.60m; correcting the remaining baked pose/skin seams needs a separate asset/pose repair. No criterion, body count, timer or cap was reduced.

## Commits

- `48324c8`: archive exact historical bytes for six pre-existing G-25 evidence hash mismatches before acceptance reruns; no verdict change.
- `6b2459a`: corpse mask fragment repair.
- `9c3579b`: correct ID probe materials to retain production stencil state. The old probe falsely measured missing courier pixels; corrected low/high × zoom0.5/1.5 probes measure zero missing. Evidence of the checker error is retained.
- `00cd9d7`: requested bag/phone forearm fix.
- `a921908`: L4 lateral spread and measured remaining FAIL.

## Evidence and method

`G14-proof.json`, `G26-proof.json`, and `L4-proof.json` retain capture SHA-256 values, what was personally seen, and receipts. All48 matched L4 before/after route/heap images were viewed: broader body carpet, angular folded raised bodies persist; the cellar follow views clearly show courier and dog. Controlled L4 routes use production bot InputFrames with a survival-protected courier, not physical input or mortal threat qualification. Frozen geometry is measured through actual instance/world matrices relative to local ground; airborne blast bodies are excluded. No performance timing was collected.

`final-visual-proof.json` contains a fresh20-image final-source matrix (all personally viewed), with sourceHash `c19cffe31403b25dc81d307da8947c42c75496e6f5d21ae7a7e77d02a8ad86a1`. The overlap probe retains every courier ID pixel: 14,388 at zoom0.5 and1,435 at zoom1.5, zero missing in both tiers.

`physical-proof.json` contains two complete physical WASD/mouse/E L4 routes. Both finished with zero objective skips, deaths or navigation assists. Low tracked229 corpse identities over261 rendered samples, high288 over269; both have zero missing corpse samples. Their independently observed maxima are1.701m/1.924m, still FAIL. All24 physical-route images were viewed: raised/folded bodies persist in heap details, dense combat still contains angular panels/dark fragments, cellar courier and dog are visible, and the native result transitions toL5. Survival protection means these runs cannot qualify mortal threat.

Initial captures that missed actors or did not settle zoom are explicitly rejected in the evidence. The requested `docs/reports/fix52-corpse/README.md` is absent. Initial filesystem restrictions were resolved before implementation and checks. The initial corpse CLI diagnostic used the guarded legacy headless launcher; it is excluded from final shared-pool qualification. All later controlled, physical and final capture sessions use the shared pool.

## PO inspection

- P: inspect the phone carried at the lowered wrist during idle, instead of at the chest.
- P: inspect the L4 lateral spread/body carpet, up to10m from source deaths. No taste approval is claimed.

## Validation

- Final `npx tsc --noEmit`: PASS.
- Final `npm run lint`: PASS.
- `scene:gate -- --out test-results/blk-v/scene-gate --jobs 1`: PASS,50/50 rows (27WebGL2/23WebGPU),0known/0not run. All50 sheets personally viewed. Structured metrics and runner identities: `scene-gate.json.gz`; per-image observations: `capture-manifest.json`.
- All203 raw PNG/JPG images were SHA-256 checked against the personally viewed manifest and deleted. Zero raw images remain in this lane output (`capture-cleanup.json`).
- Initial `npm test`: one review freshness failure while render source was dirty. Retry after row commit: two30-second test timeouts under concurrent load (L4contact/gate tools). No test or timeout was changed. Serial rerun is in progress.
- Whole-group acceptance and the final solitary threat audit are in progress; final results will be recorded before the lane ends.

## Reproduction

Use a free dedicated port, e.g.4834; never3300. All browser commands are headless through the shared pool.

```sh
SCENE_PORT=4834 BROWSER_POOL_JOB_ID=blk-v node --import tsx tools/qa/blk-v-captures.mjs G14 final low
SCENE_PORT=4834 BROWSER_POOL_JOB_ID=blk-v node --import tsx tools/qa/blk-v-captures.mjs G26 final low
SCENE_PORT=4834 sh tools/e2e-lock.sh node --import tsx tools/qa/blk-v-l4-corpses.ts low after
SCENE_PORT=4834 PLAYTEST_NO_FRAME_TIMING=1 PLAYTEST_GOD=1 PLAYTEST_ACCEPTANCE_LEDGER=1 PLAYTEST_L4_CORPSE_CAPTURES=1 PLAYTEST_REVEAL_AUDIT=1 PLAYTEST_POSE_PROBES=0 sh tools/e2e-lock.sh node --import tsx tools/qa/blk-v-physical.ts low
```

Repeat with high tier (and another free port if running two concurrently). Do not run more than two browser contexts. The physical wrapper bounds the route to480seconds.
