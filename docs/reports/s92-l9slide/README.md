# s92 — leaper standing contacts

Work in progress; the campaign gate is not yet green.

The leaper's stationary half-crouch uses the `alpha-pounce` atlas at phase 0.22. That atlas was treated as an ungrounded action even when no special was active. A one-tick stop discarded standing contact handling; resuming shamble displaced the planted sole. The runtime now selects standing contact policy for this idle stance while retaining its pose. Active pounces retain their action policy. No infected stats, corpses, QA limits or threat tools changed.

A stable-source native L9 HIGH run reduced maximum slide from 22.1 cm to 1.8 cm and p95 from 1.5 cm to 1.3 cm. Infected 882's separation window now measures max 0.2 cm. Every motion row passes. [Focused receipt](focused-high.json).

The gate remains false because no collision correction window was observed. LOW and L7/L4 both tiers still require final verification. Typecheck and lint pass. The L9 threat audit reports zero per-level skilled/passive flags; its global diagnostic flag is `PARTIAL_LEVEL_SELECTION`.

The 318 cm lift occurs at frame 6188 with `alpha.pounce` active, phase 0.72, and both rendered soles above 3.1 m. The aggregate track also contains grounded movement. No classifier change has been made. The opened f7504–7509 camera sheet follows the departing APC and leaves 882 out of frame; it cannot establish visual acceptance. A targeted capture and flight review remain open.

## Collision recovery fixture

The unmodified native route produces no final-commit collision corrections in either tier; alternate observers of solid sweeps, navigation and parked-hull projection also found none. Those observer experiments were removed.

The gate now adds one ordinary sprinter after frame 8970, after the original 882 window. It selects a clear nose/rear hull boundary using the normal radius, spawns the actor normally, then proposes an 8 cm inward move from a point 5 cm outside that boundary. The real final collision commit resolves the small overlap. Side boarding is avoided using the nose/rear positions. No stats change or corpse deletion is involved. All native and added rows retain the same checks and limits; receipt metadata identifies the fixture explicitly.

L9 HIGH and LOW now pass with both correction kinds proven. Typecheck and lint pass. [Fixture coverage](collision-coverage.json). Full matrix and targeted visual review remain open.
