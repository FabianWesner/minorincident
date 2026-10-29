# Q-191 / Q-215

Q-191 restores the clerk's ivory/coral striped rear blouse, crossed teal apron straps, waist tie/bow and denim below the waist. The reconstructed back shared fragmented UV islands; a dedicated continuous patch within its single atlas preserves the original front/sleeves/badge pixels. Body positions, weights, skeleton, outfit shape and simulation are unchanged. All three LODs and both tiers were rebuilt; the standard asset validator passes.

Inspected [low/high depot before/after](depot-comparison.jpg) from the production handover scene at game zoom 1.5 and the [supplemental back comparison](apron-back-comparison.jpg). The stripes and crossed straps read as separate cloth pieces; the front apron/badge remain teal/ivory, the waist bow sits on the body, and no fabric clips or floats. The walking clerk returns through the doorway. The depot scene retains its three pre-existing soft actor contacts (actorHitsMax=0 remains red), with zero console errors, zero body overlap and no closed-door frames. This is visual review of Q-191, not a claim that the inherited scene contact gate is green.

Q-215 baseline full real-input L5 runs recorded Metro-to-shutter waits of 3.00 s and 6.47 s. The second had a later unrelated preview-server fetch failure during handover; its recorded ingress trajectory is retained as diagnostic evidence only. Self-defence preceded updateSurvivor, so armed followers could hold outside and shoot before reaching the Metro route handler. Ingress now owns the follower tick once the courier enters; existing attack/infection/damage rules still apply. L5 tuning is unchanged.

The isolated diagnostic restores the recorded armed follower into the production Metro approach and introduces a standard Alpha inside its authored 14 m territory. On unchanged main 2c391e65f, closure takes **20.13 s**; with ingress priority it takes **3.00 s**. [Before trace](metro-combat-before.json), [after trace](metro-combat-after.json). The fixed-waypoint experiment showed no benefit and was reverted.

Five fresh full real-input routes and final checks are in progress. No new test cases or deployment.
