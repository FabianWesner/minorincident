# S67 — L9 APC blockage: HOLD / timeboxed handoff

The whole-route goal is **not achieved**. This is a partial investigation and regression harness, not a completed P1 fix. The final runtime is `37fe81eb`. Worsening obstacle impulses, barrier launch/roll changes and replacement recovery were reverted. No push, deploy, merge or movement of main was performed.

## Retained changes

- Authored movable props can be pushed from rest by an active floor-policy APC with held forward throttle. The old `speed > .35` gate prevented that contact from becoming dynamic once the chassis stopped. The focused test measures zero prop velocity with released throttle, positive velocity with held throttle, and preserved entity health. Existing driving/ram/reverse tests remain.
- A stationary evacuation approach retries another truck spot even when navigation reports a reachable nearby cell short of the actual target. This prevents a false-success navigation result from leaving the civilian stationary indefinitely.
- A native regression drives all three L9 route choices, both primary and detour lines, seeds 1–3. It asserts completion, ≤300 active-driving ticks without meaningful route advance and no >2 m driving pose discontinuity. It deliberately remains red where the game still fails.

No new pose relocation, invulnerability, infected-stat changes, actor removal or prop/corpse deletion is retained. **Starting main's legacy `breakFree`/`placeCar` fallback remains unchanged**: attempts to replace it made detour stalls dramatically worse. Therefore the no-teleport requirement is still open. Beached recovery and sealed-pocket assertion changes were reverted together; original test cases/budgets are restored. No specs or protected reference directories were edited.

## Reproduction and regression classification

**The blockage class is not new to current main: PROD `0b650749` reproduces it.** This does not prove an exact replay of both original manual traps: the original steering trace/raw captures were unavailable, so the s66 README and native fixtures were used. Bus, crowds, barriers and roadside actors remain present.

The closing comparison uses the same held-W route driver on exact PROD `0b650749`, starting main `43c79eb1` (the s66 report references `91199b68`), and final source `37fe81eb`. Only measurement tools were copied into the baseline checkout; tracked runtime files were clean. One temporary worktree was used serially for both baseline revisions, setup was run, receipts were preserved and the worktree was removed. No baseline checkout remains.

- PROD: 17/18 complete; 4/18 progress windows ≤5 s; 49 position jumps.
- Starting main: 18/18 complete; 12/18 progress windows ≤5 s; 3 position jumps.
- Final retained source: 18/18 complete; 12/18 progress windows ≤5 s; 3 position jumps.

No material whole-route window reduction over starting main is retained (the 0.04 s shortcut-seed-2 change is not an acceptance improvement). The retained prop fix is a local from-rest improvement only.

Several rejected S67 implementations introduced primary-road/country regressions despite passing the detours. Those changes are out. The table below is the authoritative before/after result; do not infer whole-route improvement from isolated green cases. `native-comparison.json` is an older three-seed detour comparison, retained as historical evidence only.

## Before / after maximum no-progress matrix

All values are simulated seconds. Bold failures and exact positions are in the detailed tables. Raw receipts: [baselines](native-before.json), [final source](native-current.json).

| Path / route | Seed | PROD 0b650749 (s) | Starting main 43c79eb1 (s) | Final 37fe81eb (s) |
|---|---:|---:|---:|---:|
| primary / road | 1 | 3.18 | 3.2 | 3.2 |
| primary / road | 2 | 3.17 | 3.22 | 3.22 |
| primary / road | 3 | 3.18 | 3.27 | 3.27 |
| primary / countryside | 1 | 16.68 | 0.35 | 0.35 |
| primary / countryside | 2 | 1.27 | 0.35 | 0.35 |
| primary / countryside | 3 | 12.22 | 0.35 | 0.35 |
| primary / dry-shortcut | 1 | 195.72 | 0.45 | 0.45 |
| primary / dry-shortcut | 2 | 12.9 | 1.83 | 1.83 |
| primary / dry-shortcut | 3 | 61.62 | 0.37 | 0.37 |
| detour / road | 1 | 12.8 | 9 | 9 |
| detour / road | 2 | 12.75 | 9.73 | 9.73 |
| detour / road | 3 | 12.72 | 9.37 | 9.37 |
| detour / countryside | 1 | 16.85 | 0.37 | 0.37 |
| detour / countryside | 2 | 18.25 | 0.35 | 0.35 |
| detour / countryside | 3 | 16.9 | 0.35 | 0.35 |
| detour / dry-shortcut | 1 | 14.42 | 5.42 | 5.42 |
| detour / dry-shortcut | 2 | 14.42 | 13.37 | 13.33 |
| detour / dry-shortcut | 3 | 13.1 | 6.05 | 6.05 |

The driver holds W and uses ordinary bounded steering. Authored mission holds use normal hatch/interact/combat inputs and are excluded from unintended-stall timing. Route advance is ≥0.04% of route length (roughly 0.6 m); the no-progress limit is unchanged at 5 s. The harness writes no actor poses, HP or mission progress. It separately records legacy/runtime pose jumps. `L9_DRIVER_TRACE=1` and `L9_CONTACT_TICK=<tick>` expose targets, heading, input, wheels and contact identities for diagnosis. Maximum-window positions are now saved for passing cases too; that measurement change does not change input policy.

## Final-source windows and positions

| Path / route | Seed | Max gap (s) | Ticks | Position start → end (x, z m) | Finished / jumps |
|---|---:|---:|---|---|---|
| primary / road | 1 | 3.2 | 2744–2936 | (-29.79, -330.00) → (-29.16, -329.96) | yes / 0 |
| primary / road | 2 | 3.22 | 2744–2937 | (-29.81, -330.00) → (-29.17, -330.09) | yes / 0 |
| primary / road | 3 | 3.27 | 2747–2943 | (-29.34, -330.00) → (-28.77, -330.10) | yes / 0 |
| primary / countryside | 1 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| primary / countryside | 2 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| primary / countryside | 3 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| primary / dry-shortcut | 1 | 0.45 | 6801–6828 | (383.06, -10.33) → (383.48, -10.28) | yes / 0 |
| primary / dry-shortcut | 2 | 1.83 | 6961–7071 | (418.38, -19.37) → (420.10, -27.90) | yes / 0 |
| primary / dry-shortcut | 3 | 0.37 | 6715–6737 | (383.04, -9.72) → (383.46, -9.64) | yes / 0 |
| detour / road | 1 | **9** | 3783–4323 | (-8.25, -305.01) → (-7.71, -310.43) | yes / 1 |
| detour / road | 2 | **9.73** | 3743–4327 | (-8.87, -304.66) → (-8.38, -309.28) | yes / 1 |
| detour / road | 3 | **9.37** | 3736–4298 | (-8.71, -305.03) → (-8.20, -298.70) | yes / 1 |
| detour / countryside | 1 | 0.37 | 3728–3750 | (1.50, 265.18) → (2.04, 265.15) | yes / 0 |
| detour / countryside | 2 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| detour / countryside | 3 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| detour / dry-shortcut | 1 | **5.42** | 4784–5109 | (290.74, 7.96) → (291.09, 7.37) | yes / 0 |
| detour / dry-shortcut | 2 | **13.33** | 8365–9165 | (480.93, -21.56) → (481.32, -11.58) | yes / 0 |
| detour / dry-shortcut | 3 | **6.05** | 6610–6973 | (446.15, 11.43) → (445.45, -9.40) | yes / 0 |

## Starting-main windows and positions

| Path / route | Seed | Max gap (s) | Ticks | Position start → end (x, z m) | Finished / jumps |
|---|---:|---:|---|---|---|
| primary / road | 1 | 3.2 | 2744–2936 | (-29.79, -330.00) → (-29.16, -329.96) | yes / 0 |
| primary / road | 2 | 3.22 | 2744–2937 | (-29.81, -330.00) → (-29.17, -330.09) | yes / 0 |
| primary / road | 3 | 3.27 | 2747–2943 | (-29.34, -330.00) → (-28.77, -330.10) | yes / 0 |
| primary / countryside | 1 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| primary / countryside | 2 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| primary / countryside | 3 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| primary / dry-shortcut | 1 | 0.45 | 6801–6828 | (383.06, -10.33) → (383.48, -10.28) | yes / 0 |
| primary / dry-shortcut | 2 | 1.83 | 6961–7071 | (418.38, -19.37) → (420.10, -27.90) | yes / 0 |
| primary / dry-shortcut | 3 | 0.37 | 6715–6737 | (383.04, -9.72) → (383.46, -9.64) | yes / 0 |
| detour / road | 1 | **9** | 3783–4323 | (-8.25, -305.01) → (-7.71, -310.43) | yes / 1 |
| detour / road | 2 | **9.73** | 3743–4327 | (-8.87, -304.66) → (-8.38, -309.28) | yes / 1 |
| detour / road | 3 | **9.37** | 3736–4298 | (-8.71, -305.03) → (-8.20, -298.70) | yes / 1 |
| detour / countryside | 1 | 0.37 | 3728–3750 | (1.50, 265.18) → (2.04, 265.15) | yes / 0 |
| detour / countryside | 2 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| detour / countryside | 3 | 0.35 | 0–21 | (-550.00, 0.00) → (-549.48, 0.00) | yes / 0 |
| detour / dry-shortcut | 1 | **5.42** | 4784–5109 | (290.74, 7.96) → (291.09, 7.37) | yes / 0 |
| detour / dry-shortcut | 2 | **13.37** | 8365–9167 | (480.93, -21.56) → (481.33, -11.37) | yes / 0 |
| detour / dry-shortcut | 3 | **6.05** | 6610–6973 | (446.15, 11.43) → (445.45, -9.40) | yes / 0 |

## PROD windows and positions

| Path / route | Seed | Max gap (s) | Ticks | Position start → end (x, z m) | Finished / jumps |
|---|---:|---:|---|---|---|
| primary / road | 1 | 3.18 | 3075–3266 | (-29.58, -330.00) → (-28.96, -330.03) | yes / 0 |
| primary / road | 2 | 3.17 | 3075–3265 | (-29.60, -330.00) → (-28.98, -329.46) | yes / 0 |
| primary / road | 3 | 3.18 | 3075–3266 | (-29.59, -330.00) → (-28.96, -330.02) | yes / 0 |
| primary / countryside | 1 | **16.68** | 3668–4669 | (-10.46, 240.00) → (-9.99, 235.44) | yes / 1 |
| primary / countryside | 2 | 1.27 | 9480–9556 | (422.72, 43.65) → (423.00, 43.20) | yes / 0 |
| primary / countryside | 3 | **12.22** | 3676–4409 | (-10.21, 240.00) → (-9.76, 244.30) | yes / 1 |
| primary / dry-shortcut | 1 | **195.72** | 15801–27544 | (437.04, 8.13) → (437.37, 8.92) | NO / 21 |
| primary / dry-shortcut | 2 | **12.9** | 3190–3964 | (-46.71, -29.98) → (-46.31, -34.53) | yes / 3 |
| primary / dry-shortcut | 3 | **61.62** | 11418–15115 | (436.84, -0.99) → (438.58, -9.97) | yes / 7 |
| detour / road | 1 | **12.8** | 3932–4700 | (-41.82, -305.01) → (-41.30, -309.51) | yes / 2 |
| detour / road | 2 | **12.75** | 3929–4694 | (-42.27, -305.01) → (-41.67, -309.66) | yes / 2 |
| detour / road | 3 | **12.72** | 3938–4701 | (-42.38, -305.01) → (-41.83, -309.70) | yes / 2 |
| detour / countryside | 1 | **16.85** | 3555–4566 | (-53.92, 265.00) → (-53.38, 269.82) | yes / 1 |
| detour / countryside | 2 | **18.25** | 3555–4650 | (-53.92, 265.00) → (-53.41, 269.51) | yes / 1 |
| detour / countryside | 3 | **16.9** | 3555–4569 | (-53.92, 265.00) → (-53.46, 269.77) | yes / 1 |
| detour / dry-shortcut | 1 | **14.42** | 10626–11491 | (436.51, 0.79) → (436.05, -16.49) | yes / 3 |
| detour / dry-shortcut | 2 | **14.42** | 10625–11490 | (436.51, 0.71) → (436.05, -16.50) | yes / 3 |
| detour / dry-shortcut | 3 | **13.1** | 3019–3805 | (-42.80, 9.99) → (-42.39, 5.62) | yes / 1 |

## Root causes and limits of the evidence

1. **Confirmed from-rest prop gate:** authored movable props were ignored below .35 m/s even with W held against them. The retained change fixes that local deadlock and has a direct before/after velocity assertion. It is not proof that every route trap is fixed.
2. **Retained furniture can collect as a moving sled at the bumper:** in a rejected implementation, countryside seed 2 at tick 6120 was at `(307.76, 240.24)`, yaw .010, full steer +1, with a jersey barrier, trash can and barricade moving against the front. The APC barely changed heading for hundreds of ticks. Repeated purely forward impulses sustained that pile; they are not retained.
3. **Static roadside contact and steering overshoot are separate:** primary-road trials contacted tree `prop.tree:2671/geometry-0` near `(-341, -341)`. A shortcut trial contacted `prop.garden-bush-small:653/geometry-0` at `(389.29, -21.31)` while recovering from a wide turn. The problem is not isolated to infected impacts. These trial coordinates are diagnosis anchors, not final-source acceptance receipts.
4. **Reported speed can conceal lack of travel:** `keepRamMomentum` restores a forward velocity floor after infected contact, so the speed field can remain high while physical chassis displacement is tiny. Diagnose actual movement, contact normals, wheel support and route projection; speed alone is insufficient.
5. **Bus/prop enclosure and recovery remain unresolved:** a lift-only replacement for the legacy pose fallback preserved primary passes but created 267.25 s and 195.45 s detour-road windows. That replacement was reverted. An enclosed pocket cannot honestly be declared physically solved by weakening its test.
6. **Stationary reachable evacuation paths:** navigation can return a nearby reachable cell while the actor does not advance to the truck. The retained retry handles that local failure, separately from vehicle driving.

A lateral prop-ejection trial passed 17/18 progress windows but introduced a 16.68 s shortcut gap and failed the L9 threat audit. Gentler ejection produced road gaps up to 96.88 s. Rear counter-steering passed road corners but created a 512.20 s countryside failure. Preview-driver changes also failed the complete matrix. None is retained. There is no safe, verified whole-route replacement recovery in this lane.

## Validation

- Focused vehicle file on the final retained source: **pass**, 1 file / 2 existing compound tests, 24.42 s. The added from-rest assertion does not remove any existing case.
- Closing L9 threat command: `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: skilled **complete**, passive **complete**, **0 L9 flags**, 15.5 s. Exit 1 is solely `PARTIAL_LEVEL_SELECTION: diagnostic run, not a complete gate`.
- Native full-route command: `sh tools/qa/l9-progress-regression.sh`: **FAIL**, with every one of the 18 cases run to its terminal receipt; see the matrix and pose-jump counts above. No route, seed, threshold or completion requirement was dropped.
- `npm run typecheck`: **pass**; `npm run lint`: **pass**, on final runtime `37fe81eb`.
- Exact `sh tools/remote/run.sh "$PWD" -- npm test`: **pass**, 27 files, 106 passed / 1 skipped (107 total), 187.67 s Vitest / 190.0 s budget wrapper on runner 46.225.66.90. Unchanged 240 s budget; no test cases trimmed. The committed report handoff is checked again after publication to this local branch; the final response records those terminal results.

## Browser QA needed

LOW, god off, real W plus ordinary steering: recheck original HUD **632–639 m, ticks 8195–8929**, and the later **121–122 m bus/roadside trap** from `docs/reports/s66-b87qa/README.md`. Use the final-source detour windows above as additional capture targets. Record actual chassis displacement, bumper contacts, wheel support and held input throughout the >5 s interval. No browser capture was opened in this closing pass and no visual-fix claim is made. Browser work must use the headless pool/e2e lock, one browser, 10-minute reservations and a unique 49xx port.

## Follow-up lane

Start from this handoff, keep the full 18-case native gate and reproduce the final detour-road windows before tuning. Capture contact identities through the bus/retained-prop enclosure and compare body displacement with the ram-floor velocity. Replace the legacy pose relocation with a physical maneuver that clears both bus and retained props, then prove zero jumps and ≤5 s for every case. Avoid recreating a continuously pushed prop sled or changing a steering driver merely to hide a physical trap. Recheck infected threat/navigation after moving props; a progress pass that adds threat flags is unacceptable. Finish with real-input browser QA at both original locations, tsc/lint, exact remote suite and the L9 threat audit. Do not release the P1 as fixed until all of those requirements pass.

The orchestrator requested a timeboxed stop after this report and final checks. The objective remains unachieved; further implementation belongs in the follow-up lane.
