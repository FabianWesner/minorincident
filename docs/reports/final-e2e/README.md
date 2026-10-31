# Final end-to-end campaign playtest

## Status

**In progress — L1 completed by real input; L2 is live.** The QA game build is from `b98aaa604`; later branch commits change playtest tools/reporting only. No game difficulty or camera code has changed. L3–L10, credits and the progressed-save checks remain outstanding.

The headless shared-pool driver uses the player-facing title → Start game → character → level flow, normal handovers, keyboard/mouse input, low rendering quality, the default camera and `--no-skip`. Visible-guidance mode disables authored street routes and hidden navigation-grid steering. Manual interventions also use physical input. Sessions release the pool at handovers; the same campaign profile continues through the menu.

## Per-level record

`—` means unobserved; it does not mean a pass or zero. Times distinguish successful attempts from aborted driver attempts.

| Level | Time | Deaths / retries | Stuck or confusing moments | Objective gives destination? | Weapons start → story | Load to Begin | Frames >200 ms | Console errors | Carry-over (weapons / survivors / corgi) | Result cards add up? |
|---|---:|---:|---|---|---|---|---|---|---|---|
| L1 | 166 s wall / 163.8 s card; earlier attempts also disclosed below | 1 death; 2 menu restarts after driver aborts | Opening fence: 90 s stalled in first driver attempt; later weapon-route detour before driver error | Depot/Annex/fire station named; weapon objective generic, supported by marker/story bubble | Unarmed → bat, matches story | 1.72 s in successful opening sample | 0 | 0 | Bat and following corgi reach L2; no rescued human group | [Reviewed card](fresh/captures/fresh-03-L1-result.jpg): stats match mission result |
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

### Driver limitations and historical preflight

- The initial sandbox startup restriction was resolved when unrestricted execution was provided. See [preflight evidence](evidence/preflight.md).
- `fresh-01` aborted after 90 s at a fence, without advancing the objective. Its [capture](fresh/captures/fresh-01-L1-6009-cannot-finish.jpg) was reviewed. This is an input-driver navigation failure, not proof of a game soft-lock.
- `fresh-02` reached the outbreak and weapon search, then a partially written command file caused the driver to exit. Its profile cleanup ran; L1 restarted through the normal menu because that save did not retain the in-level checkpoint. The command-file race is fixed in `b994b8ce0`; no objective was skipped.
- `fresh-03` completed L1 and used Continue → L2 → Begin mission. [Raw run](fresh/runs-fresh-03.json), [observed text/results](fresh/fresh-03-audit.json), [frame intervals](fresh/fresh-03-frames.json), and [input/progress log](fresh/log-fresh-03.jsonl) are retained. Its one death is also shown on the result card. No console error occurred.

### Story observations so far

L1 connects the cold-chain delivery to the Annex bang explicitly, then directs the unarmed courier to obtain a bat and reach the fire station. The station's result card confirms the delivery while saying the outbreak is not contained. The normal L2 handover starts with the retained bat and a fire-axe pickup objective. Later story continuity remains unreviewed.

## Required follow-up

1. Run the fresh-save L1 → L10 → credits campaign by real input; record each row above and preserve reviewed captures.
2. Start progressed saves from level select at L2, L5 and L9; check each opening state.
3. Review the story for player-facing clarity and logical continuity; report any P1–P3 findings with captures.
4. For any trivially safe blocker fixed, commit each fix separately, inspect its capture, then run `npm test` and `npm run test:smoke`.

No game change has been made. No debug skip, god mode or teleport has been used.
