# s212 — L10 finale route

## Time-box handoff

Placed the existing courier bike as a fixed, solid district prop at (2868, -2) on the evacuation approach. Its visual presentation, collision and roadblock rhythm have not been checked in a running scene.

The attempted checkpoint rewrite was removed during review: it suppressed pace checkpoints before the finale and could repeatedly reset later checkpoints. The existing checkpoint behavior remains in place. Migration, named checkpoint triggers after fights and HUD toasts still need implementation and runtime verification.

## Validation

The earlier checkpoint draft passed typecheck, lint and the focused save-progression test; those results do not establish the behavior of the final bike-only change. No runtime or visual verification of the bike was completed.

## Open

- Implement the four named checkpoints, old-save migration and place-named HUD toast without changing earlier recovery points.
- Add beat 0–9 dialogue and discoveries, remaining scenery and the tower searchlight.
- Implement the overpass Mega moment and final gate stand, reusing the existing systems.
- Verify the bike placement, collision and roadblock rhythm in play.
- Measure HIGH and LOW skilled route timing and gaps, verify completion and full qa:threat, and capture and review the ten-frame HIGH sheet.
- Run the required remote unit suite and the remaining release checks.

The full route build and its visual and runtime audit remain incomplete.
