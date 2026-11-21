# s220 · L8 flamingo plaza

## Change record

| Area | Change | Evidence / status |
|---|---|---|
| Flamingo landing pads | Pads are reduced to 46% scale and muted, with low opacity. They render only during the active flamingo fight and brighten/fade on the assigned bird’s dive telegraph. Flock behavior is unchanged. | Source updated; native scene review is still required. |
| Black plaza ellipse | The leading source found in code is overlapping transparent contact-shadow planes beneath the clustered survivors/crowd. Their opacity compounded to a nearly black ragged patch that shimmered as figures moved. L8 footprint opacity is now 0.065; other levels retain 0.30. | This is a source-based diagnosis, not a visually verified reproduction. HIGH zoom 1 and LOW before/after frames could not be captured in this sandbox. |
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
- `E2E_PORT=5227 SCENE_PORT=5228 E2E_UNITS=1 npm run scene:gate -- --filter '*zoo*'`: blocked before launch when the sandbox denied the required `tsx` IPC socket with `EPERM`.
- `npm run layouts:build -- D-ZOO`: Blender crashed during Metal startup. The authored layout and generated collider/mesh assets were updated directly from the same gate openings; this needs the normal layout build and scene review on a working renderer.

## Required before closure

1. Capture and personally inspect plaza before/after frames at HIGH zoom 1 and LOW, plus HIGH frames of the entry gate and one other gate breaking. Put one small contact sheet here.
2. Reduce follower wait and complete the no-hit kiting/attack-rate criteria; run the full sharded threat audit and require zero flags.
3. Rerun `scene:gate` for L8 and verify all four outside waves enter through their opened gates.
4. Run the remote `npm test`, typecheck, lint, and scene gate successfully.
5. Record any remaining scope here, then commit with explicit file paths once the repository index is writable.

## Follow-up left open

- Task 5: diagnose why recruited/boarding followers raise the wait metric, correct the behavior without changing follower rules or weakening the acceptance threshold, and rerun the complete bot plus the full threat audit. The automatic pickup implementation is present, but its acceptance check is not met yet.
- Capture and inspect the requested native HIGH/LOW frames and commit the small contact sheet; run the scene gate, remote unit suite, and a full sharded zero-flag threat audit when their runners are available.
