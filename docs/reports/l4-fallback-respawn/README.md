# L4 checkpoint respawn follow-up

Merged `main` into `lane/l4-fallback-respawn` before the fix. The merged baseline reproduced `T-E22-02` with four deaths, all at the south camp checkpoint near (-11, 20). The checkpoint was beside the tank swarm and parked convoy, and player route searches could plan retreats through the camp perimeter even though physics stopped the courier there.

Camp checkpoints now sit behind the north reception and convoy defenders. A falling line selects the nearest authored post with a clear threat radius, or the post with the most clearance when all are threatened. The reception post uses the existing medical-supply location; no supplies were added. Player route searches respect the active physics perimeter until the gate opens. NPC pathfinding remains open across that boundary.

The shared respawn clear ring also had an obstruction defect: if all points on the outward ray hit cover, the infected stayed beside the courier. It now tries neighboring bearings, using each body's collision radius. A regression reproduced the old behavior with a runner 1.25 m from the anchor and now checks both live and recovering infected.

The checkpoint rule, two-second invulnerability, four-second pursuit delay, infected combat, bot policy and acceptance limits retain their existing values. The previous commit's collapse-clock and lost-line preservation stays in use.

Focused result: unchanged `T-E22-02`, seed 3, completes in 296.83 sim seconds with one death (209 s, war). New regressions cover obstructed clearing, safe camp-post selection and player-only perimeter routing. Validation summaries are recorded in `validation.txt`.

Final validation: 40 L4 tests, 1,311 unit tests and 15 shared all-level respawn tests passed on Hetzner. E22 verify passed 76 selected sim/smoke tests and all 44 native browser tests, including every L4.spec.ts case. The final native PO-round/bat rerun and E22 performance stage remained queued behind shared GPU locks until the job time limit and were cancelled; full E22 verification is therefore incomplete. Earlier fresh native browser runs passed all ten requested cases, before the final camp/navigation refinement.
