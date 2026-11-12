# S67 — L9 APC driving blockage: HOLD

The full goal is **not achieved**. The committed changes fix retained-prop response and remove driving-pose recovery, but four primary-path native runs still lose onward progress for more than 5 seconds. Do not release this lane as a completed P1 fix.

## Implemented

- Held APC throttle can push retained obstacles and authored movable props from rest; the former impact-speed gates left already-stopped hulls unable to trigger a shove.
- Continued contact pushes airborne retained props horizontally. Repeated pushes preserve vertical motion rather than relaunching a barrier into the chassis.
- Jersey barriers roll around their long axis with no initial upward launch, avoiding the end-over-end ramp shape that beaches the APC.
- A beached APC can use the existing mass-scaled physical lift and held-steering torque. The old 6–18 m driving relocation fallback is removed. No invulnerability, infected-stat changes, corpse deletion, bus removal, or barrier deletion was added.
- Stationary evacuation approaches retry alternate truck spots even when navigation reports a reachable nearby cell.

Focused assertions cover persistent barrier identity/health, initial and repeated launch motion, pushing props from rest, and physical beached recovery without assigning a pose. The old sealed-pocket test incorrectly required teleport escape from four enclosing walls. All three variants and 900-tick budgets remain; they now check confinement, pose continuity and physical penetration instead. No specs or protected reference folders were changed.

## Final native regression

Run `sh tools/qa/l9-progress-regression.sh`. It covers primary and detour lines on all three route choices, seeds 1–3, using held W with route steering. Authored holds use normal hatch/interact/combat input. The harness writes no actor poses, HP or mission progress. Completion, ≤300 active-driving ticks without meaningful route advance, and no >2 m driving position discontinuity are required. Scripted mission holds/crash phases are explicitly distinguished from unintended driving stalls.

All 18 runs complete with zero position discontinuities. The command correctly returns **exit 1** because four progress windows fail. Full canonical receipts: [native-current.json](native-current.json).

| Path | Maximum no-progress seconds, seeds 1 / 2 / 3 | Result |
|---|---|---|
| primary road | 12.23 / 12.17 / 12.15 | **FAIL** |
| primary countryside | 1.23 / 14.28 / 0.35 | **FAIL** |
| primary dry-shortcut | 0.57 / 0.32 / 0.52 | PASS |
| detour road | 4.58 / 0.63 / 0.37 | PASS |
| detour countryside | 0.70 / 0.35 / 0.98 | PASS |
| detour dry-shortcut | 0.33 / 0.75 / 4.55 | PASS |

The remaining primary-road gap occurs around the first bend, with a roadside tree contact and subsequent steering recovery. The primary-country gap still needs a driver/geometry/contact diagnosis. Passing detours are not a substitute for these cases. Numerous mechanical/controller trials were rejected after full-matrix regressions; none of those uncommitted experiments remains.

## Baseline / regression classification

Starting main was `43c79eb1` (the QA finding references `91199b68`). The same blockage class was reproduced natively there and on exact PROD `0b650749`. The finalized detour driver on PROD completed seeds 1–3 but recorded 12.80 / 12.75 / 12.72 s gaps, so this class predates current main. [native-comparison.json](native-comparison.json) preserves that earlier same-policy road comparison; its fixed-side receipts predate the final primary-path audit and must not be read as full acceptance.

The original manual steering trace was unavailable; its README was used as instructed. Native reproduction establishes the blockage class, not an exact replay of every QA input. One temporary PROD clone was used because the initial sandbox could not create shared worktree metadata; its status/processes were checked, receipts preserved, and the clone removed. No baseline checkout remains.

## Final gates

- `npm run verify -- E31`: **pass**, including typecheck/lint; 27 files / 107 tests, 91.65 s Vitest, 92.8 s budget wrapper.
- Exact `sh tools/remote/run.sh "$PWD" -- npm test`: **pass** on 46.225.66.90; 27 files, 106 passed / 1 skipped, 198.38 s Vitest, 200.8 s against unchanged 240 s budget. No tests were trimmed.
- L9 threat audit on the final production implementation: skilled complete, passive tick-budget, **0 L9 flags**. Exit 1 is the documented `PARTIAL_LEVEL_SELECTION` marker. This is not proof of the separate progress invariant.
- Full native route regression: **FAIL**, as above. The goal remains open despite green unit/static gates.

## Browser QA needed

For the QA lane: LOW, god off, W with ordinary steering. Recheck original HUD 632–639 m / ticks 8195–8929 and the later HUD 121–122 m bus/roadside trap. The source finding is `docs/reports/s66-b87qa/README.md`. Inspect retained furniture, wheel contact and actual displacement rather than the ram-inflated speed field alone. No visual-fix or opened-capture claim is made by this lane.

Current failing native windows for targeted observation:
- primary countryside seed 2: ticks 7859–8716, [456.3248596191406, 243.7224578857422] → [391.025634765625, 202.26853942871094].
- primary road seed 1: ticks 1757–2491, [-327.5335388183594, -344.0426330566406] → [-326.9681396484375, -341.3550109863281].
- primary road seed 2: ticks 1757–2487, [-327.5335388183594, -344.0426330566406] → [-326.905029296875, -341.2874450683594].
- primary road seed 3: ticks 1757–2486, [-327.5335388183594, -344.0426330566406] → [-326.924560546875, -341.3748474121094].

## Open work

Resolve all four primary-path progress failures without weakening the 5-second criterion, dropping route choices, removing retained actors/props, adding invulnerability, or reintroducing pose relocation. Repeat the full native matrix and required gates after the next production change. Refresh the baseline comparison if the driver policy changes. The current worktree is committed for review; no push, deploy, merge or main movement was performed.
