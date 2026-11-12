# Batch 87 HIGH real-input QA — s72-b87high

## Status: incomplete; HIGH play now available, no final GO/HOLD verdict

The current worktree is `9704a489` (2026-11-12 11:00 CET). No game code, specs, deployment, push, or main worktree changes were made. The requested HIGH-quality real-input run did not reach browser startup, so this report does not claim a HIGH visual verdict and has no current-run capture sheet.

## Current verdict table

All panels in the [opened contact sheet](contact-sheet.jpg) are from this lane's real-input runs. Raw images remain in `test-results/s72-b87high/`.

| Check | Verdict | Current evidence |
|---|---|---|
| L9 rail countdown, restart, hatch | FIXED within sample | Sheet top row: upper torso visible, 19-second countdown and restart cue; W then reduces 83→62 m. |
| L9 onward progress | NOT FIXED for sampled objective progress; precise chassis blockage UNVERIFIED | 11.55-second HUD window, ticks 3682–4375; one second released W for handbrake. See input audit. Blockage class already exists on PROD per s67. |
| L9 hull/wheels/flame | UNVERIFIED for temporal flicker/depth and ramp | Driving views show hull and wheels; sheet middle-left shows ambiguous flame overlap near bay. |
| L9 bus telegraph | UNVERIFIED | Bus present in opened rail/restart panel, but warning not caught. |
| L8 Phase 2 count | FIXED | Sheet middle-right: 3 left; retry counts 8→7→6→5. |
| L8 corpse column | FIXED within sampled frames | Sheet bottom-left: several fallen birds horizontal and spread across ground; no tall column in these views. Whole-fight persistence not proven. |
| L8 flock gait | UNVERIFIED | Opened still frames show distinct limb poses; step-mode captures do not prove continuous gait. |
| L4 armored kill count | UNVERIFIED in real-input encounter | Sheet bottom-right: shield strain and active MG exchange; allied fire prevents isolated front/rear counts. s70 native measurements remain separate evidence. |
| L4 heavies under fire | UNVERIFIED for isolated attribution | Health falls during sustained firing, with butchers and other attackers overlapping. See tick/HP ledger below. |
| New P1/regression vs PROD | None established in observed samples | Flame overlap and bay survivor 3/4 are unresolved, not established new regressions. |

No final release decision is supported yet because the requested evidence gaps remain. The stipulated HOLD rule requires a new P1 or regression versus PROD; this lane has not established one.

## Live HIGH progress after listener access was restored

The initial listener blocker was resolved. A single pooled headless WebGL2/Metal live driver ran at HIGH, 1280×720, god OFF (`LUNA_MORTAL=1`), starting each level through the normal menu with its standard campaign level-start save. No onward fixture or teleport was used. Keyboard/mouse actions were chosen from opened screenshots and HUD. The driver explicitly selects WebGL2; WebGPU was not attempted by this live driver. Step mode pauses between actions, so still captures cannot establish continuous gait or temporal flicker. Raw frames and input/tick ledgers are in `test-results/s72-b87high/l9/` and `l8/`.

- L9: normal start 1007 m → rail countdown at 86 m → restart at 83 m → bay, then 3/4 survivors at trucks. Opened turn 30 shows upper torso at hatch and explicit 19-second countdown; turn 35 shows restart instruction; turn 36 shows onward movement to 62 m. Thus rail cue/restart and hatch presentation are FIXED in this observed HIGH run. Hull and near-side wheels remain present in opened driving captures. Flame overlaps the side in bay views; depth/flicker remains UNVERIFIED. Bus warning was not caught. No precise >10 s held-W stall is established; HUD fluctuated around 561–566 m before steering recovered progress. This is not proof that the known PROD blockage class is fixed. Bay 4/4 remains UNVERIFIED.
- L8: normal start → escort → plaza attack → real-input pond fight. Opened turn 50 shows Phase 2 / 3 left. A subsequent health/reset and return to Phase 1 indicate a retry, not a clear. Opened retry turns 53–58 show 8 → 7 → 6 → 5 left. Remaining-count text is FIXED. Multiple opened frames show horizontal fallen flamingos with no tall column in the sampled views; corpse placement is FIXED within that visual sample, while full-fight persistence remains unverified. Physical wheel input -300 was issued on turn 54 for a closer view; exact magnification was not measured. Continuous flock gait remains UNVERIFIED. The fight is dangerous (18 HP at last view), not harmless. The escort felt passive with a dense following crowd. The live session terminated with exit 124 at the reservation's 595-second limit, with 5 birds still left.
- L4: fresh HIGH normal-start session is being started after the L8 browser closed.

These observations supersede the earlier statement that no browser launched; the final verdict, contact sheet and checks remain pending.

### L4 HIGH observed exchange

Normal campaign start → quartermaster → defence, MG granted by the game. At turn 20 (ticks 3780–4026), a four-second firing hold ended with HP 90→80. Subsequent four-second holds: turn 21 HP 80→89 (healing), turn 22 HP 89→97 (healing), turn 23 ticks 4520–4770 HP 97→76, turn 24 ticks 4770–5016 HP 76→65, turn 25 HP 65→35. Opened images show butchers approaching in attack poses, shield strain/break text, and several armored bodies on the ground. This confirms the encounter remains dangerous under firing; isolated butcher damage and rear/front landed-shot counts are UNVERIFIED because army fire, multiple attackers and healing overlap. s70's native ≈4× rear-HP measurements remain the numerical evidence, not these screenshots.

Opened [contact sheet](contact-sheet.jpg): top row rail hatch/countdown and restart; middle row bay flame overlap and L8 remaining count; bottom row horizontal fallen flamingos and L4 firing/shield strain. These are real-input HIGH frames. The sheet does not prove continuous gait or exact zoom.

Typecheck and lint passed after this QA. Remote full suite is running; its terminal result will be recorded before closing. No browser remains running.

Remote full suite terminal receipt: first attempt timed out at 246.0 s; exact unchanged rerun **passed**, 27 files, 106 passed / 1 skipped, 150/150 registered cases, 208.03 s Vitest / 210.6 s budget wrapper (240 s limit), runner 46.225.66.90. No tests trimmed.

### Saved-input audit

[Input/tick receipt](input-audit.json) preserves every L9 action with its measured simulated duration. Requested `ms:8000` movement/wait actions are capped by the live driver to 4000 ms; actions combining movement and a hold execute them sequentially. Thus turn 11 includes a 1-second W+A interval followed by a separate 1-second handbrake hold with W released. The HUD did not beat 561 m between ticks 3682 and 4375 (11.55 simulated seconds; endpoints 561→564→566→561→566). This supports **NOT FIXED** for a sampled loss of onward objective progress, but does not prove continuous-held-W chassis blockage: no positions were recorded and a brief handbrake interval released W. s67's exact-PROD comparison establishes that the blockage class already exists on PROD; an exact-location regression remains unverified. The prior statement that no >10-second progress-loss interval was established is superseded by this ledger audit, with these measurement limits.

### Explicit presentation rerun

A temporary copy of the live driver set HIGH and API zoom 1 after normal L8 startup, and recorded presentation settings after each real input. [Presentation audit](presentation-audit.json) summarizes the receipts. This rerun reached the opened pond-gate objective but ended at the 595-second reservation cap before entering the fight. It verifies HIGH/zoom 1 during the escort and plaza defence, not the previous fight capture zoom or continuous gait. The temporary driver was removed; no runtime game source changed.
