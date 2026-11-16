# s148 escort pace — work in progress

Acceptance is **not achieved**. This checkpoint preserves the native measurements and candidate changes for further work.

Seed 1 native `qa:threat --levels L6,L7,L8` completed all three missions. The JSON contains before/after run outcomes, phase threat rates, follower gaps, stationary far samples, prompts and stuck episodes. The baseline runtime is 5ee3d0a3. Both captures use the added observer; route projection changed between captures, so backtracking totals are not comparable and must not support an acceptance claim. Stationary noncombat time is an estimate, not proof of intentional waiting. Boarding is included.

Candidate changes add distance based catch-up in L6/L7, suppress L7 distance-only warnings, remove bot distance-only pauses, and shorten the L8 boarding queue. Survivor damage and zombie stats are unchanged.

Latest evidence: L7 has no wait/lost prompts, but has `step/departure:SLOW_FOLLOWER:20`. L8 boarding stationary far time fell from 3.63 s to 2.62 s (28%, below target), and its native audit reports an escape reachability flag. L6 noncombat wait estimate increased from 0.75 s to 0.97 s. No acceptance claim follows from these results.

Remaining: correct and rerun comparable backtracking instrumentation; implement and measure the normal-speed marked-route policy; meet the halving target per escort segment; compare group threat; resolve native flags; confirm HIGH then LOW in the headless browser pool and inspect one small sheet. No browser sheet exists yet.

Required remote command was attempted twice: `sh tools/remote/run.sh "$PWD" -- npm test`. Both attempts exited 69: no healthy Hetzner runner, and npm test is ineligible for the local fallback. No remote test process remains live. Focused missions/NPC checks, typecheck and lint passed for this checkpoint (8 focused tests).

Follow-up experiment (native `/private/tmp/s148-final5`): removing L6's remaining tail-distance stop completed 4.98 s sooner, but increased retreat noncombat stationary-far ticks from 58 to 159, p90 gap from 7.36 m to 11.91 m, and damage from 70 to 125. Group threat in step/stop stayed 56.59 attacks/min. The experiment was reverted: removing the bot stop alone does not satisfy the follower behavior target. The next L6 change must improve the column's movement rather than merely advancing the courier faster. Audit terminated normally with exit 1; no check remains live.

L6 early catch-up candidate: start the distance ramp at 1 m from the formation slot instead of 10 m, retaining the same 5.2 m/s cap. Native skilled seed 1 completed in 197.83 s without skilled flags. Against the prior candidate, retreat waiting ticks fell 58→11 and backtracking ticks 151→86; stuck episodes shortened (largest 0.42 s vs 1.87 s). Five lost prompts remain. The audit still exits 1 with passive/partial-selection flags. Typecheck, lint and 8 focused mission/NPC tests passed. This improvement does not establish full acceptance.

Normal-walk speed comparison: `node --import tsx/esm tools/qa/escort-walk.ts /private/tmp/s148-walk` completed seed 1 at LOW: L6 209.78 s, L7 207.43 s, L8 799.03 s. L7/L8 emitted no wait/lost prompts; L6 emitted six lost and fifteen attack prompts. Source inspection confirms lost alarms are tied to a follower dying/turning, not distance alone. This probe forces `walk: true` on shared route inputs; it retains combat/objective holds and is explicitly **not** the required independent straight-line policy. Results are included in the compact JSON (under 200 KB). Typecheck and lint passed for the new probe; native process exited 0.

L8 boarding-speed experiment: retaining the 6.4 m/s catch-up cap throughout boarding completed at 424.35 s with 39 kills and 80 damage, but increased boarding noncombat waiting from 157 to 185 ticks and p90 gap from 12.68 to 13.44 m. Reverted. Typecheck, lint and 8 focused tests passed before the revert. This isolates queue placement/formation depth as the next issue; speeding up short queue advances alone does not help. Native process completed normally; raw diagnostic is `/private/tmp/s148-l8-boardingpace.json`.
