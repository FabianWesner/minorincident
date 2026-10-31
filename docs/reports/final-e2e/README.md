# Final end-to-end campaign playtest

## Status

**Incomplete — live gameplay could not start in this execution environment.** This report contains no campaign-play claims. The build was produced from `lane/final-e2e` at `b98aaa604` with QA hooks. The requested real-input fresh campaign, progressed-save starts, in-game captures, story review and result-card audit remain outstanding.

The playtest driver was configured for a new L1 campaign through L10, low quality, 20 minutes per level, `--no-skip`, using the player-facing title → Start game → character → L1 flow and the driver's real keyboard/mouse controls. It failed before opening a browser or selecting a character.

## Per-level record

No level was entered. `—` means unobserved; it does not mean a pass or zero.

| Level | Time | Deaths / retries | Stuck or confusing moments | Objective gives destination? | Weapons start → story | Load to Begin | Frames >200 ms | Console errors | Carry-over (weapons / survivors / corgi) | Result cards add up? |
|---|---:|---:|---|---|---|---|---|---|---|---|
| L1 | — | — | Not played | — | — | — | — | — | — | — |
| L2 | — | — | Not played | — | — | — | — | — | — | — |
| L3 | — | — | Not played | — | — | — | — | — | — | — |
| L4 | — | — | Not played | — | — | — | — | — | — | — |
| L5 | — | — | Not played | — | — | — | — | — | — | — |
| L6 | — | — | Not played | — | — | — | — | — | — | — |
| L7 | — | — | Not played | — | — | — | — | — | — | — |
| L8 | — | — | Not played | — | — | — | — | — | — | — |
| L9 | — | — | Not played | — | — | — | — | — | — | — |
| L10 | — | — | Not played | — | — | — | — | — | — | — |
| Credits | — | — | Not reached | — | — | — | — | — | — | — |

## Findings

No gameplay findings can be assigned P1–P3 until the game is played and the relevant screen is captured. The following execution blocker is environmental, not a game defect:

- **Playtest blocked before game entry:** QA build succeeded, but the local preview could not bind to `127.0.0.1:4761` (`listen EPERM`); the shared browser-pool status endpoint at `127.0.0.1:4329` was unavailable; and the in-app browser reported `No browser is available`. No game screenshot exists, and no browser profile was created. See [preflight evidence](evidence/preflight.md).

## Required follow-up

1. Run the fresh-save L1 → L10 → credits campaign by real input; record each row above and preserve reviewed captures.
2. Start progressed saves from level select at L2, L5 and L9; check each opening state.
3. Review the story for player-facing clarity and logical continuity; report any P1–P3 findings with captures.
4. For any trivially safe blocker fixed, commit each fix separately, inspect its capture, then run `npm test` and `npm run test:smoke`.

No game change was made. The fresh campaign did not start; no debug skip, god mode or teleport was used.
