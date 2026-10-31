# Final end-to-end campaign playtest

## Status

**In progress — L1 completed by real input; L2 is live.** The QA game build is from `b98aaa604`; later branch commits change playtest tools/reporting only. No game difficulty or camera code has changed. L3–L10, credits and the progressed-save checks remain outstanding.

The headless shared-pool driver uses the player-facing title → Start game → character → level flow, normal handovers, keyboard/mouse input, low rendering quality, the default camera and `--no-skip`. Visible-guidance mode disables authored street routes and hidden navigation-grid steering. Manual interventions also use physical input. Sessions release the pool at handovers; the same campaign profile continues through the menu.

## Per-level record

`—` means unobserved; it does not mean a pass or zero. Times distinguish successful attempts from aborted driver attempts.

| Level | Time | Deaths / retries | Stuck or confusing moments | Objective gives destination? | Weapons start → story | Load to Begin | Frames >200 ms | Console errors | Carry-over (weapons / survivors / corgi) | Result cards add up? |
|---|---:|---:|---|---|---|---|---|---|---|---|
| L1 | 166 s wall / 163.8 s card; earlier attempts also disclosed below | 1 death; 2 menu restarts after driver aborts | Opening fence: 90 s stalled in first driver attempt; later weapon-route detour before driver error | Depot/Annex/fire station named; weapon objective generic, supported by marker/story bubble | Unarmed → bat, matches story | 1.72 s in successful opening sample | 0 | 0 | Bat and following corgi reach L2; no rescued human group | [Reviewed card](fresh/captures/fresh-03-L1-result.jpg): stats match mission result |
| L2 | Three incomplete attempts: 1,740 s wall / 889.4 s sim; completion pending | 11 deaths (9 + 1 + 1); 3 menu retries pending next attempt | Bridge route: fenced-yard detours, blocked vehicles and manual-input failures | Bridge destination named; arrow is a bearing rather than a street route | Bat start → axe collected; correct | 3.97 s first menu sample; first handover ~5.5 s upper bound | 0 across recorded attempts | 0 across recorded attempts | Corgi follows; final handover pending | Not reached |
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

### P3 · F01 — L2 fire engine temporarily hides the courier

At the market exit, the HUD says **“Reach the police checkpoint at the bridge · 139 m”**, but the engine fills the central view and hides the courier at approximately `(-43.6, -33.9)`. The reviewed [capture](fresh/captures/fresh-05-L2-bridge-route-ready.jpg) shows the occlusion. A ground click onto visible pavement clears the vehicle; this is not a permanent soft-lock. The camera is unchanged.

### Driver limitations and historical preflight

- The initial sandbox startup restriction was resolved when unrestricted execution was provided. See [preflight evidence](evidence/preflight.md).
- `fresh-01` aborted after 90 s at a fence, without advancing the objective. Its [capture](fresh/captures/fresh-01-L1-6009-cannot-finish.jpg) was reviewed. This is an input-driver navigation failure, not proof of a game soft-lock.
- `fresh-02` reached the outbreak and weapon search, then a partially written command file caused the driver to exit. Its profile cleanup ran; L1 restarted through the normal menu because that save did not retain the in-level checkpoint. The command-file race is fixed in `b994b8ce0`; no objective was skipped.
- `fresh-03` completed L1 and used Continue → L2 → Begin mission. [Raw run](fresh/runs-fresh-03.json), [observed text/results](fresh/fresh-03-audit.json), [frame intervals](fresh/fresh-03-frames.json), and [input/progress log](fresh/log-fresh-03.jsonl) are retained. Its one death is also shown on the result card. No console error occurred.
- `fresh-04` reached L2's bridge objective without any skip, then recorded **9 deaths** while manual steering/planning left the game running. The [mission counters](fresh/fresh-04-completion.json) establish those deaths even when the driver was not sampling its own death counter. The reviewed [alley capture](fresh/captures/fresh-04-L2-follow-visible-alley.jpg) shows approaching infected behind the courier. This attempt stopped through a normal save/menu yield; it is not counted as completion. Subsequent manual actions use the normal pause menu between decisions and real held attacks while moving.
- `fresh-05` and `fresh-06` each recorded one further death before yielding without completion. Their mission counters, captures and observer records are retained. The manual helper now focuses the canvas after Resume (keyboard events on buttons are ignored by the game's keyboard device) and aims keyboard attacks at visible feet rather than the chest point used for mouse target selection. These are driver corrections, not game changes.
- The initial observer misread fixed-position loading cards because their `offsetParent` is null. Its 171 s L2 handover load value is invalid and is excluded. The valid menu sample is 3.97 s; the preceding L1 result/handover timestamps bound that first L2 handover by about 5.5 s. The observer now reads client rectangles and watches loading-card visibility independently of mission construction.

### Story observations so far

L1 connects the cold-chain delivery to the Annex bang explicitly, then directs the unarmed courier to obtain a bat and reach the fire station. The station's result card confirms the delivery while saying the outbreak is not contained. The normal L2 handover starts with the retained bat and a fire-axe pickup objective. Later story continuity remains unreviewed.

## Required follow-up

1. Run the fresh-save L1 → L10 → credits campaign by real input; record each row above and preserve reviewed captures.
2. Start progressed saves from level select at L2, L5 and L9; check each opening state.
3. Review the story for player-facing clarity and logical continuity; report any P1–P3 findings with captures.
4. For any trivially safe blocker fixed, commit each fix separately, inspect its capture, then run `npm test` and `npm run test:smoke`.

No game change has been made. No debug skip, god mode or teleport has been used.
