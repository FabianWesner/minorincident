# s148 escort pace — work in progress

Acceptance is **not achieved**. This checkpoint preserves the native measurements and candidate changes for further work.

Seed 1 native `qa:threat --levels L6,L7,L8` completed all three missions. The JSON contains before/after run outcomes, phase threat rates, follower gaps, stationary far samples, prompts and stuck episodes. The baseline runtime is 5ee3d0a3. Both captures use the added observer; route projection changed between captures, so backtracking totals are not comparable and must not support an acceptance claim. Stationary noncombat time is an estimate, not proof of intentional waiting. Boarding is included.

Candidate changes add distance based catch-up in L6/L7, suppress L7 distance-only warnings, remove bot distance-only pauses, and shorten the L8 boarding queue. Survivor damage and zombie stats are unchanged.

Latest evidence: L7 has no wait/lost prompts, but has `step/departure:SLOW_FOLLOWER:20`. L8 boarding stationary far time fell from 3.63 s to 2.62 s (28%, below target), and its native audit reports an escape reachability flag. L6 noncombat wait estimate increased from 0.75 s to 0.97 s. No acceptance claim follows from these results.

Remaining: correct and rerun comparable backtracking instrumentation; implement and measure the normal-speed marked-route policy; meet the halving target per escort segment; compare group threat; resolve native flags; confirm HIGH then LOW in the headless browser pool and inspect one small sheet. No browser sheet exists yet.

Required remote command was attempted twice: `sh tools/remote/run.sh "$PWD" -- npm test`. Both attempts exited 69: no healthy Hetzner runner, and npm test is ineligible for the local fallback. No remote test process remains live. Focused missions/NPC checks, typecheck and lint passed for this checkpoint (8 focused tests).
