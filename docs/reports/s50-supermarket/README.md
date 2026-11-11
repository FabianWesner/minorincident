# s50 — remove the legacy supermarket collision

## Change

Removed the `bld.supermarket.legacy` collision entry and all runtime selection of it. Every supermarket placement now uses the current model and collision.

The new checkout collider extends 0.7 m along local X. For the L3 north Commerce row at yaw +90°, that moves the world collider toward -Z and closes part of the approach. The L3-06 loss reproduction identified the eastern north-row supermarkets (`bld.supermarket:301`, `:305`, `:314`) as the relevant placements. Moving those placements +0.7 m in Z keeps the passage open while keeping the rendered model and collision together. L3 army losses are 0, 2, 4 over seeds 1–3 (2/3 within the target), and the campaign audit reports the L3 baseline flag count of 1.

In L5, the stuck chaser was observed at approximately `(37.74, -51.41)`, by the metro entrance. A/B isolation identified `bld.supermarket:8` as the placement whose current checkout collider caused the obstruction; shifting only that placement cleared the stuck flag but hurt follower pace. Moving the two 180° row placements (`:8` and `:12`) +0.7 m in X preserves the approach and follower paths. L5 has no stuck-chaser flags and returns to its baseline count of 1.

The same current collider caused the high L2 market ambush wave test to lose one admitted infected before its goal. Moving the L2 market west by 0.7 m, with its doors, walls, rescue anchors, crew and trapped civilians, restored the wave test. This also cleared L2's pre-existing kiting flag; see the audit-count note below.

## Validation

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx vitest run tests/qa/invariants/waves.test.ts --maxWorkers=4` — 4/4 pass.
- `npx vitest run tests/qa/invariants/war-waves.test.ts --maxWorkers=4` — 2/2 pass.
- `npm test` — 107 tests passed; 150/150 cases collected, 131.5 s. The requested `sh tools/remote/run.sh "$PWD" -- npm test` could not start because there was no healthy Hetzner runner and the Mac fallback rejected this queued command.
- Full `node --import tsx/esm tools/qa/threat-audit.ts` — completed in 448.9 s. Results: L1 0, L2 0, L3 1, L4 4, L5 1, L6 4, L7 6, L8 0, L9 0, L10 0 (16 total). L3/L5 are at baseline. The requested table calls for L2 1 and 17 total; the additional L2 flag is absent because the market fix also restored landed hits in the L2 kiting probe. No flag was introduced artificially to preserve the count.
- `tools/qa/r42/l4-pocket-probe.ts` high and low — both retain the courier at `(5.8966, 36.3888)`; a brute reaches about 1.3 m and damages the courier within 10 s.
- Browser QA needed. No browser automation was run, per lane instructions.

## Worktree notes

`sh tools/ops/slim-worktree.sh "$PWD" --no-assets` could not write the shared Git worktree config under the sandbox. The existing `node_modules` was present and used. Regenerating the complete static collision registry changed unrelated cache records, so the tracked registry was restored from `HEAD` and only the obsolete legacy entry was removed.

Continuation: with filesystem restrictions removed, the required slim-worktree command completed successfully.
The remote test command was retried after permissions changed. It remained queued without starting a test process; that retry was cancelled cleanly (exit 130). The earlier direct local green test receipt remains the completed suite evidence. The exact requested audit count (17) remains unmet; the implementation's full audit has one fewer L2 failure.

Final remote retry: `sh tools/remote/run.sh "$PWD" -- npm test` completed on runner 94.130.181.173 with exit 0: 27 files passed, 106 tests passed and 1 skipped, 150/150 cases collected, 228.8 s within the 240 s budget. Acceptance of the improved L2 count (16 total instead of 17) was requested explicitly and remains pending.
