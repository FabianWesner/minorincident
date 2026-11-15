# s119-savevalid — L9 campaign save validation

## Root cause and fix

Native simulation reproduces a rejected save immediately after lethal `Player.damage`: `l9Crash.player.health.current` is zero, while `validCrash` requires a living player. In-game settings previously captured this transient dead player before checkpoint restore. `Game.saveCampaign` now retains the previous living L9 resume during the death interval, allowing settings persistence without storing an unusable dead-player resume. Validation remains strict.

The exact s117 rejected snapshot was not retained. This reproduction proves a reachable cause of the reported exception, but cannot establish that the missing snapshot failed for the same field.

Snapshot capture, validation and write exceptions are caught at the Game boundary, logged, and return false. They cannot escape settings or mission autosave callbacks. SaveStore validates before writing, so rejected candidates preserve the previous browser save. No pause or clock operation is performed by the failure handler.

## Production impact

Yes: persisted in-game settings and L9 mission signals use this same autosave path in production. A settings change during death/retry could previously throw. The fix keeps playing and preserves the previous living resume. Autosave failures remain nonfatal even for unexpected invalid candidates or storage errors.

## Coverage

The existing campaign progression test sweeps every authored checkpoint in native L1–L10 worlds through the actual Game.saveCampaign method and validateSave. L9 coverage includes driving/approach/fall/impact/crawl/done snapshots, native lethal damage and retained living resume, and a throwing writer. Existing bridge/rail-stall fixtures additionally validate live resume snapshots and bridge death/checkpoint restore. Phase snapshots set the phase and matching vehicle flags directly; this is schema coverage, not a physical playthrough of each phase. The sweep explicitly captures authored checkpoints; it is not a full campaign bot run.

## Verification

- Typecheck and lint pass, including direct Game method assertions.
- Focused progression test: 6 cases pass. Vehicle checks passed in the full remote suite.
- Remote suite on f49315c7: 27 files, 106 passed, 1 skipped; 233.3 seconds within the 240-second budget, 150/150 cases.
- Final remote suite with direct Game method assertions: all completed files passed, including direct Game save tests, but the runner timed out at 240.6 seconds (exit 124) before the last tool test completed. An unchanged rerun is required.

## Browser QA needed

No browser run was required for the native reproduction or synchronous save exception boundary. Optional physical confirmation: change quality with the L9 hatch open, immediately after lethal damage, after retry, and after L10 handover; confirm play resumes normally and Continue retains a valid save. The missing s117 snapshot remains an attribution limitation.

Final unchanged remote rerun passed (exit 0): 27 files, 106 passed, 1 skipped, 240.0 s reported within budget. `npm run verify -- E13` and `npm run verify -- E31` both passed typecheck, lint and 107 local tests. Final audit is checking ordinary false-return storage failures as well as exceptions.
