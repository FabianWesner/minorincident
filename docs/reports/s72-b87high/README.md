# Batch 87 HIGH real-input QA — s72-b87high

## Status: incomplete; HIGH play now available, no final GO/HOLD verdict

The current worktree is `9704a489` (2026-11-12 11:00 CET). No game code, specs, deployment, push, or main worktree changes were made. The requested HIGH-quality real-input run did not reach browser startup, so this report does not claim a HIGH visual verdict and has no current-run capture sheet.

## Attempt and blocker

- QA build: `MI_BUILD_CACHE=off npm run build:qa` **passed** (Vite 6.4.3, 7.44 s). The default build first failed because its shared cache lock is outside this worktree and not writable; the uncached path succeeded.
- Planned run: `E2E_PORT=4917 PLAYTEST_BACKEND=webgpu node --import tsx tools/playtest/play.ts --levels L1-L9 --mode continue --quality high --zoom 1.5 --level-minutes 85 --no-skip --out test-results/s72-b87high`. This starts at a normal new L1 campaign and would use the playtest driver's keyboard/mouse inputs to reach L4, L8 and L9.
- The runner's Vite preview did not start. Direct preview failed with `listen EPERM: operation not permitted 127.0.0.1:4917`. Retrying preview through `tools/e2e-lock.sh` also failed before Vite startup because the browser pool service could not bind its loopback listener (`listen EPERM` on `127.0.0.1:4329`). `ps` inspection is also denied by this sandbox. No browser, preview, or QA command remains running.
- Since no page loaded, neither WebGPU selection nor WebGL2 fallback was observed. There are no s72 screenshots to open; no contact sheet was made. Existing image references in the s66 README are absent from this worktree, and older scratchpad captures are not current-run evidence.

## Requested checks — evidence and limits

| Area | Current verdict | Evidence / next check |
|---|---|---|
| L9 start → rail stall → bay; unintended held-W stalls >10 s; APC hull, wheels, flame, hatch, bus telegraph | **UNVERIFIED at HIGH** | The prior s66 run was LOW and reported a 12.23 simulated-second driving block plus a later bus/roadside trap. s67 later compared the blockage class against exact PROD `0b650749` and found it reproduced there, so those historical blockages are not evidence of a new regression. s66's countdown, hatch and warning observations were LOW, with the warning's clean dodge still unverified. Re-run the normal-start route at HIGH and open fresh captures before assigning this batch a visual verdict.
| L8 flamingo corpses, Phase 2 remaining count, flock gait close-up | **UNVERIFIED at HIGH** | s68's deterministic corpse/layout and mission-text assertions passed, and its LOW controlled fixture showed ground-settled bodies. That is not a real-input HIGH pond fight. Open a fresh HIGH fight capture for the ground pile/count and continuous close gait.
| L4 armored shots-to-kill and heavy attacks during sustained fire | **UNVERIFIED in the requested real-input fight** | s70's native centered-hit measurements after the HP change gave rear ratios of 4× handgun, 3.33× assault rifle, 3.6× MG and 1× shotgun versus a runner; s69's native firing fixture observed brute/butcher attacks landing during continuous fire. These support expected tuning but do not replace the requested normal-campaign L4 encounter at HIGH. Capture the exchange and report hit counts/damage.
| New glitch vs PROD; harmless/babysitting impression | **UNVERIFIED** | No s72 runtime observation was possible. Historical s66 described the L9 driving block as babysitting; s67 found its class on PROD. Do not treat that historical issue as a newly introduced regression.

## Validation and closeout

No typecheck, lint, or test suite was run: no game files changed, and the browser QA stopped before runtime. The uncached QA build is the only passing check in this lane. A valid final GO/HOLD cannot be issued from the evidence gathered here: the run produced neither new-regression evidence nor the requested high-quality captures needed to verify the fixes. Resume the same normal-start HIGH run once this environment can start a local preview/browser-pool listener; keep the 1280×720 viewport, attempt WebGPU first, and record the actual selected backend.


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
