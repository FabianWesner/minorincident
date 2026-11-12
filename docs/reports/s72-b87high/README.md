# Batch 87 HIGH real-input QA — s72-b87high

## Status: incomplete; no GO/HOLD verdict

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

