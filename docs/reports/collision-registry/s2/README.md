# collision-s2 continuation — stopped at special-contact compatibility

**Deploy gate remains red.** Current main `7cf1b48bf` was merged into this worktree as `b71ed671c`; the nine conflicts retain main's navigation, pet support and mission fixes together with collision admission. `src/assets/staticCollision.ts` is unchanged by this continuation. No deploy or merge back to main.

## Changes retained

- Replace the impossible original `T-E29-06-200` packing with the previously passing admitted 6 m fixture under the original test ID. The test comment records the 72.6 m² / 35 m² contradiction and the PO decision. Visibility, 200 retained bodies, one projectile/explosion, unchanged rocket definition, same-tick permanent kills and recovery assertions remain.
- Extend the existing registry query to sweep its static compounds, rotated vehicle hulls and living circles. Alpha/Mega charges push contacted bodies only into a clear admitted pose; a blocked push stops the mover. Lion pounce stops on body contact. Existing combat walls and destructible-blocker handling remain in the physical resolver. Zebra receives registry solid queries but its actor sweep is stopped pending the decision below; ordinary dog pounce migration remains unfinished.
- Place the courier before spawning the Mega in its fixture. The previous order admitted the boss away from the courier's initial origin, making the nominal 13 m range probe roughly 12 m. All range, timing, damage, cooldown and path assertions remain.
- Smoke interrupts an in-progress attack windup or hearing reaction and prevents hearing from immediately reacquiring the obscured target.
- Remove temporary query/correction allocations from contact checks and use direct writes for the committed pose. This is not a measured E18 pass.
- Add `collision-alpha-charge-registry` to the existing automatic game-camera matrix catalog. Captures have not been run.

## Zebra decision required

The instruction explicitly says to stop and report numerical incompatibilities without changing special assertions. Zebra's actual radius is **.45 m**, and the stationary human probe's radius is **.35 m**. The committed minimum separation is therefore **.45 + .35 − .02 = .78 m**. Its current damage query is centre based, with a **.75 m radius / 1.5 m corridor**. A nonpenetrating actor contact cannot enter that centre-hit radius: the gap is **3 cm** even at maximum permitted penetration.

The unchanged fixture puts a human at `(5, .75)`, expects a locked 15 m path and two 25 HP hits, with an outside control at `(5, −.751)`. In the sweep trial, contact displaced the inside probe before its centre could enter the damage sweep: the path passed but the probe stayed at 100 HP instead of 50. The player case received only one of the required two hits. For a second herd member, the first member's physical push also moves the knocked victim outside the narrow centre-based corridor. This needs a decision on contact/hit semantics or a physically consistent replacement fixture; no assertion, radius, damage or budget has been changed. The unsuccessful zebra actor-push trial was removed.

The first scheduler note accidentally used a .60 m zebra radius; a second note corrected it to .45 m and the resulting .78 m minimum. These are the corrected numbers.

## Validation and rejected trials

`final.json` records the final source's full unit suite plus Alpha physical, Mega moves, explosions/smoke, rocket, registry reproductions and admission selection. Local static checks are recorded separately. The older compact JSON files describe intermediate uncommitted trials, not final-head evidence.

The initial merged-source selection passed L2 repeated-death mercy. It retained L5 intruder progress, L6 siege (13.8667 s versus ≤12 s), encounter balance (10 HP versus ≤5), dog pin expiry and special failures. It also exposed an L6 complete timing miss (272.4167 s versus ≤270 s). L10 high arrival/release has not been rerun here.

A 1 m actor-bucket experiment was rejected after an isolated mixed-special 200-actor p95 of **7.807818 ms**, versus the unchanged **4 ms** gate (`rejected-bucket-perf-200.json`). The 100-actor result is recorded too. A broader stationary-contact hold trial broke the existing isolated sliding test and was removed. A wider-left L5 ingress trial still failed the intruder case and broke the real-input group-photo case, so it was removed. L5 difficulty data was untouched. No failed optimization is presented as a performance fix; E18 relative gates remain unproven/red.

After identifying the zebra compatibility issue, the later timing reservation was cancelled and its remote process group terminated through its own run wrapper. No Mac browser reservation was acquired. Full final sim/levels, L1–L10 invariant completion, paired E18 relative timing, build/browser smoke and fresh APC/tank/courier high/low × zoom .5/1 × WebGL/WebGPU captures remain unmeasured in this continuation. Prior S1 evidence remains historical and is not a final-source QA claim.
