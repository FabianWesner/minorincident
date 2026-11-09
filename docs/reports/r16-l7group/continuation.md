# Later investigation — all changes reverted

The orchestrator requested a final safe handoff within twenty minutes. Commit `6c069d47` restores runtime, tests and public assets to `8622b6d1`. The following observations describe discarded experiments; they are follow-up leads, not fixes in the final branch.

## Connected slots and corpse contact

High-tier opening movement used a slot or snapped point even when frontage separated it from the courier. Requiring a connected goal improved follower 74's opening walking median to approximately 4.5 m/s, but changed the combat sequence. One high/1 route then stalled at approximately `(-50.59, 40.12)` with full courier health against dead Alpha body 75, with live Alpha 197 behind the wreck. A generic circumferential corpse detour found no clear route through the clutter.

Reusing existing `Walker.step` corpse avoidance after actual body contact completed that high/1 case in 153.17 seconds. The elevated navigation grid also needed its existing console-specific behavior restricted to the console area; L7 raised roads otherwise selected it. This candidate still failed high/2 at 100.03 seconds and added low-tier departure pace identities. Source `dec4e8d3`, diagnostic tag `contact-route`.

## Departure clamp and motor state

The departure clamp can limit actual speed to 4.6 m/s while leaving the motion motor at 8 m/s. A focused regression reproduced the mismatch. Feeding resolved velocity into the motor and clearing accumulated acceleration after the L7 clamp passed seven focused unit cases. Source `a3e3a535`, tag `resolved-pace`, still failed high/1 at 99.77 seconds and added departure identities. It is not an independently verified safe fix to retain in this timebox.

## Cached target failures

A fixed world-space last-safe goal stranded the high/1 tail near x=148.2 while the courier waited near x=130.6, approximately 17.7 m apart. With the leader stationary, the target never moved inward. All six `steady-slots` cases exhausted the 240-second diagnostic window. This candidate is invalid.

Transporting a safe relative offset avoids a fixed world goal, but requires clearing it after large teleports (the pharmacy regression otherwise moved 0.117 m against a 0.1 m limit). The reset version passed seven focused tests but left high/1's tail routed through another disconnected space and exhausted its 240-second window. Sources `c75ec57c` / `carried-reset`.

Finally, requiring a transported goal to connect back to the courier while allowing the follower to route toward that goal passed seven focused tests but did not restore the complete matrix:

| Tier | Seed | Outcome | Seconds | Native hash |
| --- | ---: | --- | ---: | --- |
| high | 1 | mission-failed | 71.28 | `e5f09a29` |
| high | 2 | complete | 124.57 | `9c9cd8da` |
| high | 3 | mission-failed | 104.27 | `a69e911d` |
| low | 1 | complete | 122.00 | `b82b10ee` |
| low | 2 | complete | 122.95 | `c68af5cb` |
| low | 3 | complete | 120.00 | `dfd12923` |

This final experiment (`97499f0b`, `connected-carried`) adds low-tier `step/departure:SLOW_FOLLOWER:65`; its high-tier vote has the known required-follower unobserved identities for 60 and 63 and only one completed seed. Such an underqualified vote does not establish success. Raw route and pace receipts are retained under `evidence/rejected-connected-carried-*`.

## Follow-up order

Start from the opt-out branch and reproduce each issue independently. Keep connected road slots stable through leader turns, preserve pace at departure, then resolve ordinary combat and route contact together. Run the full six-case matrix and unchanged follower evaluator after each coherent candidate. Fixed-target caching and completion-only selection were insufficient. The six-completion candidate remains useful evidence, but its four new high-tier identities must be resolved before L7 natural movement is enabled.
