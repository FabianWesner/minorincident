# Remaining measured reds

Final game source `0caecab8d`; matched main `68f83ae44`. All assertions and limits retained.

| Case | Red on main | Candidate | Main control |
| --- | --- | --- | --- |
| wave3-zoo-routines@high-z1.5-webgpu | **Yes** | clipping 2 > 0 ([result](evidence/gate-final-matrix-index.json)) | clipping 2 > 0 ([result](matrix/main-zoo-final/index.json)) |
| wave3-zoo-routines@low-z1.5-webgpu | **Yes** | clipping 2 > 0 ([result](evidence/gate-final-matrix-index.json)) | clipping 2 > 0 ([result](matrix/main-zoo-final/index.json)) |
| T-E15-lifecycle | **Yes** | 5 textures, expected 2; both attempts ([result](evidence/selected-final-playwright.json)) | 5 textures, expected 2; both attempts ([result](evidence/main-lifecycle-final-playwright.json)) |
| Scene Lab reload isolates courier gear webgl high | **No** | 32 draw calls > 30; both attempts; gear resets 4→0 ([result](evidence/selected-final-playwright.json)) | passes; independent profile: 29 total draws ([result](evidence/main-gear-final-playwright.json)) |
| Scene Lab reload isolates courier gear webgpu high | **No** | 32 draw calls > 30; both attempts; gear resets 4→0 ([result](evidence/selected-final-playwright.json)) | passes ([result](evidence/main-gear-final-playwright.json)) |

## Gear draw cost

Read-only matched WebGL2 high probes show **candidate 18 view + 14 shadow = 32** draws; **main 15 + 14 = 29**. Three visible `ambient-gpu-life` meshes add **64 triangles** to the view pass; shadows are unchanged. Both cold gate loads and gear→gate reloads have the same cost. Gear is zero after the load and all blast particle/debris counts are zero. This traces to inherited atmosphere `e3b6138e7`, present in supplied tip `5a2ea113c`; those source files are unchanged by this job. The catalog profiling path reports view draws separately from shadows; the unprofiled e2e counter includes both. The scene-specific 30-draw cap remains red; the measured E18 blast/L6 budgets pass unchanged.

[Candidate probe](evidence/candidate-gear-probe.json), [main probe](evidence/main-gear-probe.json), [replay script](evidence/gear-probe.mts). These diagnostics use headless Metal, one browser per locked command, no uncapped flags.

## Controls and scope

The zoo fixture is absent from main, so its unchanged JSON was copied into the sole temporary worktree and replayed against the fresh main build. [Control manifest](evidence/main-control-manifest.json). The initial missing-fixture lookup and aborted mis-rooted attempt provide no comparison; only `main-zoo-matched.log` and its index are used.

The superseded remote SwiftShader S-02 timeout is not a current red. Both final local smoke runs pass S-02; final smoke is 16/16. The asset-query `ENOBUFS` and candidate-only cure-mist failure are fixed and retain historical failure evidence in [QA](QA.md).

## Historical observations outside the permitted browser subset

These are carried from the supplied inventory, not claimed as freshly rerun: elephant-charge browser, touch-APC ACTION/HUD, manual phone gate-HUD overlap, and the two WebGL2 zoo rows were **red on main: Yes** in the [prior matched controls](../merge-batch10/red-tests.md). The old storm-street native timing reds had **no matched main control** and remain unmeasured in this restricted browser run. The L1 nine-photo case now passes. The six old L1 grade/look tests are pre-existing `fixme` skips for the retired diner flow; they are not passing measurements. All [66 prior cases](historical-red-dispositions.json) remain inventoried.
