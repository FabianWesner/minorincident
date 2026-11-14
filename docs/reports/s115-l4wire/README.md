# s115 — L4 exterior stationary census

## Result

The full native alarm-hold census in the current `e7aab4aa` worktree passes the requested stationary ceiling:

| Tier | s112 reported peak | Current native peak | L4-06 plaza minimum | First breach alive |
| --- | ---: | ---: | ---: | ---: |
| HIGH | 2 | **2** | 42 | 72 |
| LOW | 3 | **1** | 16 | 47 |

The stationary metric samples living, visible, admitted infected once per simulation second from the L4 war/alarm start through line break. A person counts outside when outside the authored `l4.map.plaza` bounds. Their position must remain within 0.5 m of the first position in the uninterrupted window for at least 30 consecutive samples. Every consecutive 30-sample window is checked, including windows starting during a longer stationary run. The maximum concurrent count is reported with IDs, positions and approach state in the native receipt. The HIGH hold completed at +190 s; its sustained plaza minimum remained above the L4-06 floor of 40.

## Routing finding

The stranded-state evidence points to long single-waypoint A* searches around the perimeter. Multiple outside infected retain the west breach target `(-37.2, 6.1)` while far north or south of it; `seek()` retries unsuccessful army-approach paths at 15-tick intervals. That leaves a small number moving too slowly or remaining stationary outside, even though the current full-hold peak is within the requested ceiling.

A corner-waypoint prototype was evaluated and removed. It did not reliably clear the residual outside actors and one HIGH run reduced the L4-06 plaza minimum to 38, below its required 40. The accepted work therefore adds native visibility into the metric without retaining a routing change that breaks the L4-06 gate. A safe route correction remains open; the current measured state meets the numeric goal.

## Validation

- Native L4 HIGH and LOW holds: complete; stationary peaks 2 / 1. L4-06 first breach and sustained plaza checks pass on HIGH.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Full `npm run qa:threat -- --maxWorkers 4`: one flag, `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`; no new flags. L4-06 passes (first breach 72 alive, plaza minimum 42).
- Remote unit suite: PASS on runner 46.225.66.90; 27 files, 106 passed / 1 skipped, manifest 150/150, 221.6 s within 240 s.
- Vehicle campaign motion: PASS, all eight HIGH/LOW cases (L9, L7 bus, L4 parked and tank), one headless serial reservation through e2e-lock with ports 4951/4952.
- **Browser QA needed.**

No zombie/weapon stats, caps, cohorts, living actors, audit thresholds, or corpse behavior were changed. No deployment or push.

Follow-up measurement audit: corrected the observer to inspect every sliding 30-sample window. Fresh native HIGH/LOW holds confirm peaks 2 / 1. Typecheck and lint pass. The routing correction remains unfinished; this report does not claim that the requested route fix has shipped.

Native navigation trace: HIGH seed1 actors 298 and 325 have admission-grid connectivity to the west breach, but repeatedly empty path arrays at +27/+37/+47 seconds. Actor 298 remains living and fixed through +67 seconds. Connectivity alone does not prove physical clearance; this narrows the next investigation to path search completion/scheduling and grid selection. Compact trace is retained in evidence.json.

Search interruption confirmed by wrapping the existing nav.path call read-only: actor 298 requests at ticks 3011/3071/3132/3192 exhaust 1516/2000/2000/2000 expansions with pendingAfter=true and pendingBefore=false each time. The shared A* workspace is replaced between retries, preventing this long route from resuming. This is direct evidence of starvation; a fix must preserve search progress while retaining fair scheduling and the current per-tick budget.
