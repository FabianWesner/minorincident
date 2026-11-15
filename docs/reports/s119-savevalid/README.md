# s119-savevalid — campaign save validation during L9

## Finding

The s117 browser report retained no rejected live campaign snapshot. The current worktree reproduces the call chain: changing a persisted setting calls `Game.campaignSettings()` and then `saveCampaign()`; L9's live mission state is copied into `l9Crash` before `SaveStore.write()` validates it. Mission signals and other autosave hooks use the same write path. Native snapshots from the available L9 bridge and rail-stall save fixtures validate after restore, after a settings change, and after the bridge death/retry. A native L1–L10 sweep also validates campaign saves at each authored mission checkpoint; the L9 crash payload validates in driving, approach, fall, impact, crawl, and done phases.

This does not identify the exact field in the s117 transient snapshot. That evidence is unavailable, and the current authored native states do not trigger the rejection. No validator rule was relaxed.

## Fix

`Game.saveCampaign()` now catches validation and storage exceptions at the game boundary, logs the failed write, returns `false`, and lets gameplay continue. `SaveStore.write()` validates before writing, so an invalid candidate does not replace the previous stored campaign. This protects settings changes and all autosave callers from an exception escaping into gameplay. The in-memory run continues; a failed candidate is not persisted.

## Production impact

Yes. In production, changing any persisted in-game setting during L9 reaches this autosave path; L9 mission autosaves also reach it without a settings change. Therefore the reported validation rejection was reachable in production and could block the interaction that initiated the settings update on the affected build. With this fix, a failed save is logged and play continues, while the previous valid browser save remains stored.

## Verification

- Focused native tests: `npx vitest run tests/engine/save-progression.test.ts tests/engine/vehicles.test.ts` — 2 files, 9 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- The exact s117 snapshot was not retained, so reproducing its invalid field and proving the candidate becomes valid remain open. Browser QA is not needed to verify the nonfatal exception boundary; no browser run was performed.

## Native death-interval reproduction

A native L9 world now reproduces rejection immediately after `Player.damage` kills the courier: `l9Crash.player.health.current` is zero and `validCrash` requires a living player. A settings change previously captured this dead live player. The Game save path now retains its previous living L9 resume while health is zero, preserving settings without writing a dead-player resume. The validator remains strict. This is a proven production-reachable cause; the unavailable s117 snapshot prevents attribution of that exact occurrence. The focused progression test passes (6 cases after merging the sweep into the existing case). Full remote validation remains pending.
