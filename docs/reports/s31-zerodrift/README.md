# s31-zerodrift

The collision trigger is **e19047c854f4cb17c0bd525a69a2f76b10bfa880**, the intentional removal of corner verge hedges/bushes/fences. It is already included in **fb3dd88c**. There is no introducing commit between fb3dd88c and the original main snapshot: the supposedly good lower endpoint reproduces all five failures exactly. No gameplay code or layout was changed by this lane. The proposed fix below changes gameplay behavior and is left for review, as requested.

## Corrected baseline and bisect

The r29-l9pin report's 325.8 s / zero-failure result belongs to its lane tip **36db8034**, not its merge **fb3dd88c**. Main had meanwhile merged the corner-clearance layout change. Clean checkouts in one disposable worktree (`/tmp/mi-s31-zerodrift-bisect`, prepared with worktree-setup and slim-worktree) reproduce:

| Revision / experiment | Complete | Game seconds | Collision failures | Final state hash |
|---|---|---:|---:|---|
| 36db8034, actual r29 lane tip | yes | 325.816667 | 0 | 2bbcf5c8 |
| fb3dd88c, requested lower endpoint | yes | 412.183333 | 5 | 56a9fa8e |
| 8d729271, batch-66 midpoint | yes | 412.183333 | 5 | 56a9fa8e |
| fb3dd88c + only old D-CROSSING.layout.json | yes | 325.816667 | 0 | 2bbcf5c8 |
| e19047c8 directly, older bot | no (600 s budget) | 600 | 182 | see evidence.json |

Each run used `node --import tsx/esm tools/qa/l9-driving-proof.ts --zero --out <unique /tmp path>`. The old-layout experiment replaces only the JSON with `git show 36db8034:public/assets/layouts/D-CROSSING.layout.json`; it was restored afterward. Its exact matching state hash isolates the layout as the cause, rather than the later NavGrid or checkpoint timer work. The JSON diff removes 15 placements and 14 colliders; all other fields are identical. The headless sim reads this JSON, not the changed visual GLBs.

Because the requested interval has no good endpoint, the bisect was extended to the actual known-good lane tip and limited to the isolated layout path:

```
git bisect start fb3dd88c 36db8034 -- public/assets/layouts/D-CROSSING.layout.json
# selected e19047c8; direct native proof: 182 collision failures
git bisect bad
# first bad commit: e19047c854f4cb17c0bd525a69a2f76b10bfa880
```

[bisect.txt](bisect.txt) preserves Git's result. This path-limited result identifies the layout trigger, not a claim that every intermediate vehicle/bot combination has the same five failures. The r29 vehicle/bot merge reduces the direct e190 run's failure signature to the five reported on main. The original main snapshot for this lane is a0957730; the working branch adds only daa155b1's QA wrapper change. Main was never checked out or modified.

## Exact runtime cause and proposed fix

Removing the low obstacles around (-350, -330) changes the zero-durability bot trajectory and the resulting crowd arrangement. It exposes an existing contact-transaction failure near (373.8, -209), rather than changing infected stats. Read-only instrumentation of `SolidRegistry.auditActor` on this branch, through tick 17200, reproduces exactly:

| Tick | Actor / other | Depth (m) | Last writer |
|---:|---|---:|---|
| 17055 | armored 938 / dog 936 | 0.162257953 | cleanup.separation |
| 17072 | dog 927 / dog 889 | 0.045633847 | cleanup.separation |
| 17193 | dog 878 / dog 940 | 0.020105003 | infected.update |
| 17194 | dog 878 / dog 940 | 0.020657498 | infected.update |
| 17195 | dog 878 / dog 940 | 0.020862976 | infected.update |

These are non-periodic audits of unresolved actors (`SolidRegistry.commit`, around lines 655–729). Four projection passes do not find clearance; the old pose is also invalid and `find(proposed, radius, id, 4, false)` returns null. The code defers only new actors or actors whose radius changed (`!old || proof?.radius !== radius`). Existing same-radius actors therefore fall through to `publish(e)` with `valid === false`, and the audit records their overlaps. `finish` then stores that pose as the next committed pose. Actor 878 has attachment exemption 667 (the APC), radius .3, and y 1.358–1.366 versus the other dog's y .7; the actor-layer check still treats this pair as colliding. Attachment exempts its owner and fellow clingers, not unrelated ground infected.

Proposed fix: retain the corner clearance, and make unresolved same-radius transactions fail safely too. Resolve the conflicting component against reserved valid poses; when no valid pose exists, retain identity in pending admission rather than publishing overlap. Attached actors need an explicit owner policy: either stop/detach/re-admit a blocked boarder or resolve the ground body without violating its reservations. This changes visible crowd/boarding behavior (and potentially temporary actor visibility), so it is deliberately **not implemented**. Do not revert the intentional clearance improvement, loosen the .02 m tolerance, exclude these actors from audits, or alter infected stats. A future implementation must cover exhausted rollback/search and attached-dog conflicts in existing tests, then rerun zero/road/risky/countryside and L9 threat proofs.

## Fresh companion proofs (unchanged gameplay)

| Command suffix | Complete | Game seconds | Collision failures |
|---|---|---:|---:|
| --route road | yes | 200.05 | 0 |
| --risky | yes | 191.75 | 0 |
| --route countryside | yes | 209.283333 | 0 |

`node --import tsx/esm tools/qa/threat-audit.ts --levels L9 --maxWorkers 2 --out /tmp/s31-zerodrift-2-threat`: skilled and passive complete, L9 flags `[]`. Exit 1 is solely `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`. Compact receipts are in [evidence.json](evidence.json); raw captures remain outside Git. All invoked processes finished.

## Local --single routing (previous commit daa155b1)

Previously --single delegated to run-threat-remote.mjs and required remote capacity (reported exit 69). It now invokes `node --import tsx/esm tools/qa/threat-audit.ts` locally, forwarding arguments and exit status; remote sharding is unchanged. The disposable fake-node fixture in tools/remote/check.py verifies exact arguments and exit 7 propagation. `python3 tools/remote/check.py --unit` passed (3 skipped). Typecheck and lint completed in the previous turn. `npm run test:gate` was invoked once and exited 1; another s31 lane overwrote its shared /tmp/s31-gate.log, so its detailed results cannot be reliably attributed. No further code changes were made in this continuation; only this report and compact evidence were added.
