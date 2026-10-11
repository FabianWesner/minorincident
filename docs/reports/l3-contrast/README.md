# L3 courier contrast — 2026-10-11

## Cause and change

The hero-only fog fill added a constant pale colour at L3’s modest fog density. Independently, ash used the same full surface coating as snow, eventually replacing cap, skin, shirt and corgi colours with pale grey. Clear L3 retained L1 saturation, ruling out the mood exposure as the main cause. Pause was not causal: both live and paused frames reproduce the issue.

Moving character, gear and NPC materials now cap ash coating at 3%; static world ash and all snow coating are unchanged. The hero fog fill ramps in only for dense fog (0.4–0.8), keeping L3 dark colours while preserving E28 fog readability. Existing night rim/fill, mood, exposure, practical lights and weather particles remain active. The night-readability fixture moves its infected slightly closer: the original placement projected outside the viewport (NDC x ≈ 1.002), preventing the eye check from sampling the actor; they remain outside the courier’s 2 m contrast ring.

## Capture review

[Game camera](game.jpg) and [close camera](close.jpg) compare original worktree base `5a9d2682` and patched production builds at 90 s (transition start), 112.5 s (midpoint), 135 s (end), and 240 s (sustained ash). Each sheet contains live and actual pause-menu captures at the L3 station yard, with the courier holding a handgun and the corgi nearby. The game framing uses the standard 19 m follow-camera position; the close view remains fixed. No weather is removed from colour captures.

Before: start already lifts dark shirt/cap edges; midpoint loses skin and cap colour; end and sustained ash produce the milky courier and corgi from the PO images. After: dark seams and shadows remain distinct, skin and cap colour persist, and the corgi keeps its brown/cream coat. Haze and falling ash remain visible, as does ash on the world. The pause menu preserves the same change. The close view makes restored skin/cap separation clearest; game view restores the character silhouette.

## Numeric gate

[Measurements](metrics.json) use linear sRGB luminance inside an eroded courier ID mask. The gate compares p5–p95 Michelson contrast with L1 (±15%), checks saturation against the lower L1/L2 daylight saturation (at least 95%), and limits the p5 black-level increase to 0.025. Weather quads are hidden only while extracting the ID mask, because replacing their vertex/opacity graph in the ID pass creates opaque raw quads; all weather remains visible in the measured colour image. Baseline mask coverage must exceed 95%.

L3 retains 97–100% of L1 contrast after the patch, versus 76–81% before. At sustained ash, close-camera p5 falls from 0.074 to 0.003, contrast rises from 0.767 to 0.981, and saturation rises from 0.231 to 0.521 (L1: 0.550; L2: 0.451). Clear L3, L1 and L2 are also captured. Dense fog contrast remains 3.077; night readability is 3.159 against its 3:1 requirement.

## Validation

Typecheck, lint and production build pass. Remote unit run: 811 pass, four static bake parity failures (clinic annex/police station lod1/lod2); the same four failures reproduce with original material code. All 29 courier render unit checks and 28 E25/smoke unit/simulation checks pass. The numeric L3 gate, night readability and dense fog visual checks pass.

L3 simulation spec: 11 pass, nine fail (pacing, medkit HP, ranged spacing, squad outcomes, Oak completion, pressure/emergence, checkpoint identity). L3 follow checks: eight pass. Browser level suite: Boulevard, Oak and campaign handoff pass; Commerce fails after seven deaths. No simulation/gameplay code is changed, and these broader checks remain unresolved.

Full E25 verification: 36 browser checks pass, three deferred checks skip; save/reload (restored loadout mismatch) and window-depth (zero probe samples instead of 200) fail identically on the original build. The forty-lamp check was accidentally interrupted after misreading its 900 s timeout; its separate retry passes all 3,600 frame samples in seven minutes, giving 37 confirmed browser passes overall. Full acceptance is therefore not green; perf verification is not reached after the browser failures. All browser work is headless and uses the shared four-slot lock; Vitest runs remotely. Nothing is merged or deployed.
