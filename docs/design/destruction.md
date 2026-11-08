# World destruction

World damage uses fixed-tick simulation state and the same authored weapon damage as combat. `src/data/destruction.ts` maps weapon IDs to material response multipliers (glass, wood, metal, brick, concrete); unspecified weapons use a conservative material default. This layer scales environment damage only and does not change infected damage or weapon balance. Existing environmental explosion curves keep their authored prop and vehicle damage so chain reactions remain intact.

When extending the system, add a material to `DestructionMaterial`, give each weapon family an explicit response, and map new destructible archetypes in `materialByArchetype`. Keep changes deterministic: damage and state transitions belong in the sim; render updates consume events and must not choose outcomes. Story-critical placements need an explicit protection flag before they can become destructible. Static batches must be split lazily on first damage, and collision/nav changes must be committed in the same sim tick as a breach.

The current implementation establishes the per-weapon material response table. Placement-addressable building breaches, variant swaps, detached debris, and district presentation remain follow-on work.
