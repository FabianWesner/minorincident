# r2-l7: L7 opening pressure and departure pace

## L7-05 — fixed

Baseline high stationary first player hit was 10.37 s (low: 1.3 s). A nearby survivor sighting discarded the opening infected's courier pressure focus. Preserving that focus and assigning one close high-tier runner to the opening press fixes the targeting cause without moving the courier or spawns.

High stationary first player hit is 9.3 s; first group hit is 1.55 s. Low remains 1.3 s and 2.75 s respectively. Source commit: `e8fd23c`.

## G-13 — fixed in focused high departure seeds 1–3

The affected evacuees were healthy. A turning courier swung the three-column tail across the parked bus, and invalid formation slots fell back to the same courier position. Followers collided and repeatedly changed route around the obstruction. High-tier followers now retain distinct clear targets; in departure, two columns follow the courier's actual walked path through the corner. The bounded path history is saved with checkpoints. Low keeps its existing formation behavior.

Focused native complete routes, seeds 1–3: high finished in 103.35 / 106.25 / 104.45 s with departure group medians 4.600 / 4.577 / 4.535 m/s. Every measured departure follower was at least 0.95 of group pace in every seed. The corresponding low routes also completed, with no departure pace failures.

## Validation

- Focused high and low complete routes: all three seeds completed; no departure follower below 0.95 of group median.
- Typecheck and lint passed before the final tier scoping; final static checks and requested both-tier acceptance / standalone threat audit are being refreshed.
