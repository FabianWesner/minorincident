# Collision S4 implementation

Source: `3714fe54e`, on `lane/collision-s1`. Main batch 5 (`3883a1679`) was merged first in `5f9c2fef4`; both sides of the L2 policy and Scene Lab fixture conflicts were retained. A following commit corrected an extra merge brace. No deployment or merge back to main.

## Profile and retained optimization

The unchanged Zoo S2 fixture retains 720 ticks, 120 excluded warmup ticks, 600 measured samples, 200/100 registered actors, 20/10 zoo replacements and its original 90-tick special schedule. No fixture, budget, tolerance, AI pass count, damage, health, attack cadence or actor roster was reduced.

The initial measured-window CPU profiles put `SpatialHash.query` at 378–401 ms self time per 600 high-cap ticks. Its callers include separation (163–175 ms), occupancy checks (143–151 ms) and registry commit (69–74 ms). A separate phase probe measured commit at 1.149 ms mean /1.727 ms p95, and separation at .760 /1.086 ms. The scan counter records 21,129,420 separation point scans over three complete profiling rounds. These instrumented values are attribution, not acceptance results.

Because isolated passes did not consistently carry through the full timing project, a second CPU profile ran inside that complete project. Its original 600 measured ticks account for 345.163 ms query self time, 195.332 ms registry commit self time and 152.488 ms separation visitor self time. The inspector adds overhead: that diagnostic's 5.379 ms p95 is retained and is not substituted for an uninstrumented gate. See the full-context profile, measured-window metadata and source hashes in `evidence/full-context-profile/`.

Retained changes:

- `SpatialHash` skips empty retained buckets before computing contact bounds. Empty buckets cannot contain a match or invoke a visitor. Bucket order and the exact circle filter are unchanged.
- `SolidRegistry` reuses live transform references and radii during its final transaction. The committed occupancy visitor avoids repeated traversal of heterogeneous entity records. The existing attachment check remains active when the transaction contains attachments; passengers remain excluded. Known four-field Transform proposal/rollback copies use scalar assignments. Departed/deferred actors and reset clear the cache. Collision arithmetic and the independent 2 cm audits are unchanged.
- Separation refreshes each body's transform reference and numeric X/Z at the beginning of its phase. Every navigation move still operates on the original transform; cached X/Z are refreshed immediately when that move returns. The visitor reads the existing contact-matrix row selected for the active body. This removes repeated entity/transform lookups and repeated row lookup from the profiled scan. No arithmetic is reordered, no query order changes, and all authored separation passes remain intact.

The numeric-coordinate comparison passes all three high trials at 3.497820 /3.337209 /3.644185 ms, versus 3.744874 /3.582139 /3.923940 ms. Caching the active row improves all three matched comparisons again: 3.592129 /3.287999 /3.566241 ms versus 3.844313 /3.300191 /3.592941 ms. The **complete uninstrumented timing project** on retained source measures Zoo high at **3.804490 ms <=4** and low at **1.737080 ms <=6**. The full gate totals are in [gates.md](gates.md).

A final CPU capture of retained371 is saved separately in `evidence/profile-371/`. All three rounds retain 200 actors and 51 activations. This capture is diagnostic; the acceptance number above comes from the complete uninstrumented project.

## Exact behavior and fixture accounting

A separate replay of the final separation change (`231637509` ->`3714fe54e`) hashes the complete simulation state after every tick, across classic and mixed 100/200 actor cases, seeds 1 and 2. All **5,760 tick hashes and all special-event sequences match**. Canonical high/low Zoo activation totals remain **51/27**.

The fixed mixed-200 fixture has an existing transient admission detail: its minimum visible infected count is 199 and maximum pending count is one, while all 200 remain registered. This occurs identically before and after optimization. The replay retains it rather than quietly changing the fixture. All other replay cases keep 100/200 visible, zero pending; all eight cases have zero collision failures. Raw hashes, events and summary are in `evidence/state-compare/`.

## QA corrections exposed by the full matrix

The first complete matrix passed 593/608 rows. The three failing scene families pass 18/18 on a separately built, pinned main archive, so they were addressed on this branch.

**Coarse Mega pursuit.** The registry was committing an off-region Mega, rolling it back at a wall before it could reach the resident scene crop. Its documented coarse contract has no mesh or collider. The pursuit owner now uses the existing infected hidden-body mask and forgets its previous resident contact proof. Detailed re-entry clears that mask and validates the current endpoint. The same entity, HP and director slot remain. A regression crosses a nonresident wall at cruise speed and proves physical occupancy returns on re-entry.

**Drawn paws and measurement.** A game-camera vertex trace found a real toe 3.394 cm below the apron at frame 165. The original fixed contact proxy independently reported 1.224 cm at frame 94, where the actual sole was on the floor. Moving and warning paws now clamp their drawn vertices above the floor; swing clearance remains until touchdown. Scene Lab measures mesh depth separately from the original contact anchor. Mesh depth owns sink when available; the original anchor still owns contact classification, slide and lift. This avoids manufacturing a grounded point from the X/Z of one point and the Y of another. The **1 cm apron limit**, other original limits and all slide rules are unchanged. New tests cover moving mesh vertices, rotated sole measurement, false proxy penetration, missed real penetration and unchanged slide/contact calculations.

**Boss readability.** The old circular boss cutout could erase the entire contact-range Mega. Full-subject and smaller projected-circle trials still failed the 90% Alpha comparison; removing the cutout alone then exposed courier occlusion in arrival (down to 20.1%). The retained solution reuses the existing foreground survivor treatment from faded-building presentation: near a living visible Mega, only courier meshes draw as a foreground silhouette. The Mega remains opaque. The ID probe follows the same depth rule; late gear and restoration are unit-covered. The **60% courier** and **90% Alpha-reference** gates are unchanged, and no model is enlarged.

The new `collision-zoo-s2-mixed-query` game-camera scene is included in the standard matrix. It supplements the 200-actor timing fixture with an elephant charge, gorilla grab/throw and 24 ordinary infected; it does not replace that fixture. Existing corgi and Mega catalog scenes cover the additional QA corrections. See [visual review](visual-review.md).

## Controlled L2 restore fixture

The merged T-E20-17 fixture teleported every infected into the same distant nav cell. The registry correctly rejected those overlaps, preventing its controlled calm window. Relocation now goes through the admission owner around that same anchor, with a 16 m placement search, and asserts every placement succeeds. The rejected 4 m attempt is retained. IDs, health, roster, 70% calm requirement and checkpoint assertions remain unchanged. Full level validation includes this correction.

## Rejected work and scope

Every trial is retained. Cell windows were reverted after a full timing miss at 6.004 ms; empty-bucket-only missed at 4.666 ms. Finer separation cells changed special activations (54 vs 51) and were rejected. Corner culling, a lifted visitor, policy rewrites, distance reuse, branch splitting, numeric bucket arrays, a proposal batch, broader repair caches and query-object reuse were not retained. Later full misses at 4.220, 4.184 and 4.159 ms remain visible alongside the final passing source. Passing isolated trials were never substituted for a failing complete timing result.

L5 difficulty data and `src/assets/staticCollision.ts` match merged main `3883a1679`. No specs, forbidden reference trees or reference PNGs were edited. No dependencies were added.
