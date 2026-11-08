# E31 / L9 driving rebuild progress

Lane: `eg-l9`  
Date: 2026-11-08  
Story source: [`docs/design/story-script.md`](../../design/story-script.md), copied verbatim from the current `main` commit `c1af927e` because this worktree cannot update its Git metadata.

## Implemented in this worktree

- L9 route encounter admission waits until groups are more than 100 m from the APC and resident, selects mixed route-specific archetypes, and orders them to pursue instead of standing idle.
- APC hull boarders attach visibly, climb for three seconds, bite at one-second intervals, and release on a sharp turn/handbrake; low durability permits two extra boarders.
- The forced crash approach now follows the APC's starting forward heading and speed-derived travel duration rather than lerping toward a fixed world-space yaw and lip.
- The L9 opening and closing caption use the exact story-script lines. The L10 opening radio line replaces the superseded story briefing. The L9 crash objective no longer adds unscripted dialogue.
- L9 acceptance rows include PO 2026-11-08 and identify the currently unimplemented gameplay expectations.

## Remaining work

This is not yet a complete driving-level rebuild. In particular, implement and verify: damage-induced stall/hatch defense and restart, repair bay, destructible and solid route barriers, the three route set pieces, school-bus chase, timed evacuation and visible passenger transfer with Sam staying, Mega hull landing, sectional bridge collapse and falling weapons, controlled crawl/axe continuity, and complete L9/L10 handover. Extend simulation coverage for these beats and re-run the full required gates. Browser QA is explicitly out of scope for this lane and should be listed under Browser QA needed.

The current bridge approach still uses the authored x threshold and a straight heading projection; route-aware trigger and crash-motion integration need simulation coverage before calling it final.

## Verification so far

- `npm run typecheck` passed locally before the runner instruction arrived; a remote rerun is queued.
- `npm run lint` passed.
- Targeted `npm test -- --maxWorkers=1 tests/engine/vehicles.test.ts` passed before the story-alignment edits. The subsequent full local suite had 106 passing tests and one unrelated failure in `tests/tools/gate-tools.test.ts`: `reviewFreshness` expected `FRESH` but returned `STALE`. Remote rerun is pending.
- Earlier `npm run qa:accept -- --level L9 --skip-browser` reported 0 fresh failing rows and 8 incomplete rows. A rerun was stopped when the PO moved heavy checks to the remote runners; generated report output was restored.
- `npm run qa:threat -- --levels L9` measured 0 L9-specific passive threats and reported the L9-03 harness gap; the command exits nonzero for partial-level selection and the unrelated L8 matrix row.
- Browser QA was not run, per lane instructions.
- After the PO's runner instruction, I stopped the local acceptance run and restored its generated reports. A remote typecheck was queued but cancelled after >4 minutes without admission: six other jobs remained ahead, local admission was held by a GPU/browser reservation, and the status probe could not resolve the Hetzner API hostname in this sandbox. Rerun all heavy checks remotely when admission is available.

## Branch integration constraint

The requested `git merge main` failed when Git attempted to create `.git/worktrees/eg-l9/ORIG_HEAD.lock`; that metadata directory is outside the writable worktree. At inspection, `main` differed from the lane only by `docs/design/story-script.md`, so the exact committed file was copied into the worktree. No other main changes were pending at that point.
