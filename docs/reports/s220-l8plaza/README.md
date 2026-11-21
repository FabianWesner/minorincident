# s220 · L8 flamingo plaza

## Change record

| Area | Change | Evidence / status |
|---|---|---|
| Flamingo landing pads | Pads are reduced to 46% scale and muted, with low opacity. They render only during the active flamingo fight and brighten/fade on the assigned bird’s dive telegraph. Flock behavior is unchanged. | Source updated; native scene review is still required. |
| Black plaza ellipse | The authored `flamingo-water` flattened sphere at (0, -32) rendered as an almost black solid patch over the paving. It was removed along with its walkability exclusion. The earlier contact-shadow opacity hypothesis was disproved and the normal opacity restored. | Inspected [plaza sheet](plaza-sheet.jpg): HIGH zoom 1 and LOW at zoom 1 both show the black oval before and uninterrupted paving after. These are controlled seed 1 captures at tick 120, with the courier teleported to the plaza during Follow Nadia; they do not reproduce the original group's position or establish the cause of the reported trembling. |
| Nadia route and ring | The route follows outer public paths in one direction to the ticket-gate approach. The destination ring remains at that endpoint while Nadia and the player move. L8 arena-stage node movement is retained internally for steering; it does not move the ring. Arena destinations sit just inside their entry gates so arrival starts the fight. Old in-progress guide states map to the nearest node of route version 6. | LOW complete-bot trace: Nadia reached the endpoint in **76.3 s** (seed 1). The complete L8 bot now finishes the whole level in **527.5 s** (seed 1), with zero deaths. |
| Animal remarks | Nadia gives urgent, short subtitle/radio lines while passing zebra and elephant fence lines. The new lines use the existing subtitle/radio pipeline; no matching L8 voice recordings were available. | Implemented; the full native scene remains unreviewed. |
| Resident pickups | Visible, living zoo civilians and guards within 8 m join automatically; weapons are retained through `readyCarriedAlly`. A rate-limited radio cue confirms a join. | Implemented; the complete-bot audit records new followers but flags high wait time and slow followers. Keep this item open. |
| Perimeter breach | The sanctuary ends at the accessible ticket-gate approach. Four authored perimeter openings use solid outer gates, staggered break events, and outside safe spawns. Service-tunnel outlets no longer emit infected. | Implemented in source/layout. The latest threat audit still fails: see below. Native gate-breach frames remain unreviewed. |
| Optional zoo residents | Visible living civilians and guards within 8 m join automatically, keep their weapon, enter the normal survivor roster, and trigger a rate-limited join cue. | Implemented. Current complete-bot run exposes a follower-wait failure after roster growth; this behavior is not accepted until `FOLLOWER_WAIT` returns within threshold. |

## Route sketch

The current route uses the north, west, south, and east sides of the public path loop and finishes at the ticket-gate approach. No edge is walked twice. The LOW complete bot reached it in 76.3 seconds; the later 15-second settle hold is separate from that walk.

```text
                         entry approach (0,70)
                                  ▲
                           north path (0,64)
                                  ◀──── east path (24,64)
                                  │             │
                           west path      south path
                                  │             │
                               (-24,0) ──────► (24,0)
```

Waypoint/route-node grep: L8 was the only mission that advanced a route node from player proximity and reused it as the destination ring. L3 computes a nearby walkable point inside its bot/navigation route, while the player marker remains on the checkpoint; L4 can shift the cellar approach around an obstruction. Both are unchanged and recorded for follow-up review.

## Current validation

- `npm run typecheck`: passed after the final arena marker update.
- `npm run lint`: passed after the final arena marker update.
- `npm run qa:threat -- --levels L8`: latest run completed the full L8 bot in **527.5 s**, zero deaths. The breach audit records 12 arrivals with **3 from each of four gates**, with first attack at **7.18 s**. It still reports `KITING_LANDED_HITS_BELOW_2:0.00`, two `SLOW_FOLLOWER` flags, `BELOW_ATTACKS_PER_MINUTE_4` (3.70/min), `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` (44.1%), plus the diagnostic-only `PARTIAL_LEVEL_SELECTION`. The large boarding window contributes most stationary-far ticks; the optional pickup roster growth is a plausible contributor, not yet proven as the cause. A fix and full sharded audit remain open.
- `sh tools/remote/run.sh "$PWD" -- npm test`: runner dispatch failed with exit 69 because the remote pool had no healthy/provisioned runner. Provisioning is reserved for the orchestrator.
- `E2E_PORT=5227 SCENE_PORT=5228 E2E_UNITS=1 npm run scene:gate -- --filter '*zoo*'`: after the sandbox restriction was removed, 7/8 rows passed. `night-boss-zoo-lineup@low-z1.5` failed on WebGL2 with flat silhouette luminance measurements for zebra, lion, lioness, gorilla and elephant (6.7 versus threshold 14). This catalog filter does not establish the requested plaza captures or all L8 scene rows.
- `npm run layouts:build -- D-ZOO`: Blender crashed during Metal startup. The authored layout and generated collider/mesh assets were updated directly from the same gate openings; this needs the normal layout build and scene review on a working renderer.

## Required before closure

1. Inspect the plaza in motion with the survivor group, and capture HIGH frames of the entry gate and one other gate breaking.
2. Reduce follower wait and complete the no-hit kiting/attack-rate criteria; run the full sharded threat audit and require zero flags.
3. Rerun `scene:gate` for L8 and verify all four outside waves enter through their opened gates.
4. Run the remote `npm test`, typecheck, lint, and scene gate successfully.
5. Record any remaining scope here, then commit with explicit file paths once the repository index is writable.

## Follow-up left open

- Task 5: diagnose why recruited/boarding followers raise the wait metric, correct the behavior without changing follower rules or weakening the acceptance threshold, and rerun the complete bot plus the full threat audit. The automatic pickup implementation is present, but its acceptance check is not met yet.
- Inspect the plaza in motion and capture the two requested gate frames; run the scene gate, remote unit suite, and a full sharded zero-flag threat audit when their runners are available.

## s220b continuation (2026-11-21)

- The route endpoint is now the zoo entry gate, with its fixed ring and urgent animal-pass lines. The east outer opening is at `(116, 80)`; the elephant drive-out barrier now releases on the same east-gate break tick. The north/east outside cohorts receive authored entry approaches, and L8 hearing no longer diverts an active `l8-*` approach before it reaches its gate route.
- Follower catch-up and the complete-bot 20-second hold at the actual entry stop reduced the observed moving wait from 44.1% to 6.1–8.4% in focused LOW runs. That metric passed in those runs. They still failed on breach contact/attack: the latest pre-guard `qa:threat -- --levels L8` recorded `WAVE_NO_ATTACK_WITHIN_20_SECONDS` and `KITING_LANDED_HITS_BELOW_2`; the bounded escape reachability flag also remained. A post-guard snapshot still showed east arrivals short of the outer gate path and the north group stopping near the plaza approach, so these changes are not accepted as complete.
- `npm run typecheck` and `npm run lint` pass after the latest code change. `git diff --check` passes. The full sharded threat audit, remote `npm test`, L8 scene gate, scene-row comparison against main, HIGH native frames, and `npm run layouts:build -- D-ZOO` were not completed in this continuation. The earlier report's 7/8 filtered scene result and Blender Metal crash remain unverified against main / a headless rerun.
- The initial commit attempt was denied by the sandbox while creating the shared worktree index lock; the subsequent session has index access. Do not treat L8 as green: continue the breach path/contact diagnosis, capture and review the required frames, complete every requested validation, then update this report.
- Headless `npm run layouts:build -- D-ZOO` was retried: Blender started successfully but failed importing the absent `assets/kit.river-terrain/model.glb` at `layouts/D-ZOO/layout.py:406` ("Please select a file"). The incomplete generated physics file was restored; direct layout edits remain. The asset must be built or supplied before retrying the layout build.
- The missing river GLB was tracked but omitted by sparse checkout; restoring it from HEAD allowed a subsequent headless `npm run layouts:build -- D-ZOO` to succeed (source hash `b1e09807e1a11d3a148c5f9f5dbf5d4729b1b1648b11a2d7173132e0668bfb71`). The resulting layout JSON differs only in geometry hash, while the base mesh shrank from 2,062,876 to 1,359,020 bytes. The generated outputs and unrelated physics metadata changes were restored to the existing direct edits pending visual comparison of the rebuilt mesh.
- A complete focused audit of the hearing guard (`test-results/s220b-l8-guard-current`) showed a regression: moving wait 14.21%, multiple slow followers, both kiting flags, sustained unreachable infected, and no skilled opening-cohort attack. The passive opening cohort did attack at 6.90 s. The guard was removed; the preceding north-ingress run had 8.40% wait but still had kiting and skilled breach-contact failures. Further path and contact work is required.
- A disposable LOW kiting trace sampled nearby living infected every two seconds after the native policy selected its first horde. At +2 s none remained within 30 m; later gate arrivals appeared near the courier in `attracted` mode, and none attacked during the 20 s sample. The courier moved roughly 40 m during that sample. This identifies the route-to-perception handoff and sustained arrival pressure as the next behavior to inspect; the trace alone does not establish why the first group disappeared.
- A finer trace showed the last nearby runner dropping from 60 HP at +0.25 s to zero at +0.75 s, while chasing the courier. The requested remote `npm test` completed in 174.5 s with 104 passed, one skipped and one failure: `vehicles.test.ts:758` expects the sanctuary ring to follow Nadia, contrary to the fixed destination. An attempted fixture update reached a later boarding failure after simulating the plaza hold; that unverified edit was reverted. A second full remote run with the partial update also failed, on its outdated plaza objective expectation. The fixture needs a complete, verified update and the full remote suite remains red.
- The vehicle fixture now checks the fixed gate ring and boards a resident who joins during its final wait. Both vehicle tests pass locally and on the remote runner. Two unchanged full remote `npm test` runs after that fix timed out at 241.5 s and 241.3 s against the 240 s budget under elevated load; neither completed the suite, so the remote gate remains open.
- Corrected a scripted movement edge case where a stunned infected could advance an L8 gate waypoint before reaching it. Focused `qa:threat -- --levels L8 --out test-results/s220b-l8-stun-route` still reports the two kiting failures, sustained escape disconnection, and no skilled opening-cohort attack; follower wait remains 8.40%. This correction does not resolve the threat gate. Typecheck and lint pass after the change.
