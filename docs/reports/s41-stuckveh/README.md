# L9 parked APC chasers and STUCK_CHASER

## Finding

The passive native L9 route ended with the APC parked at `(471.56, 2.67)`. Before this change, `threat-audit --levels L9` flagged `step/approach` and `phase/driving` for the same five chasers: 919, 925, 934, 920 and 922. The chasers were in `chase`, within the observer's 2.8–6 m player-centred window, and had not moved 0.5 m for 30 seconds.

At the flag threshold, all five were within the APC's configured 3 m `apcDurability.surroundReach`, measured from the actual hull: dog 919 at 0.75 m, runner 925 at 0.80 m, dog 934 at 1.20 m, screamer 920 at 1.85 m and runner 922 at 2.62 m. The first three had active APC contact/attack cooldown records; the last two had no contact record, so a ledger-only exclusion would have left false positives. These were hull attackers, not infected trapped outside attack reach.

## Change

`ThreatObserver.observeChasers` now keeps the existing player-centred rule for on-foot actors. In L9, when the player occupies an active vehicle, a chaser is treated as engaging the vehicle if the vehicle has a living non-infected occupant and the chaser is aware, visible to the hull, not incapacitated, and within the APC's existing hull `surroundReach`. Those conditions mirror the vehicle attack candidate checks in `Vehicles.apcInfected`; no gameplay or AI behavior changed.

The 2.8–6 m on-foot window is unchanged and extracted as a small pure predicate for proof. Synthetic proof covers an L4-style 5 m pocket, both range boundaries, active hull engagement, out-of-range cases, and visibility/incapacitation exclusions.

## Evidence

- Before: `node --import tsx/esm tools/qa/threat-audit.ts --levels L9` reported two passive flags, both `STUCK_CHASER_OVER_30_SECONDS`, with the five IDs above.
- After: full `node --import tsx/esm tools/qa/threat-audit.ts` completed in 345.0 s. L9 skilled and passive routes completed with **0 passive flags**.
- Full-run passive flag counts match the stated baseline: L2 1, L3 1, L4 4, L5 1, L6 4, L7 6, L8 0, L10 0. No other level's passive flag count changed.
- A final focused `--levels L9` run completed skilled and passive routes with 0 passive flags (the command exits 1 because partial-level runs are diagnostic and add `PARTIAL_LEVEL_SELECTION`).
- `npm run typecheck`: passed.
- `npx eslint tools/qa/threat/observer.ts tools/qa/threat/proof.ts`: passed.
- `node --import tsx/esm tools/qa/threat-audit.ts --proof`: passed, including the on-foot synthetic pocket and vehicle hull checks.

The requested sparse-checkout setup was attempted first but Git could not write the shared worktree metadata at `.git/worktrees/s41-stuckveh/config.worktree` under this sandbox. The existing `node_modules` was present; no runtime source files were changed.

On resumption with filesystem access restored, the required sparse-checkout setup completed successfully and the changes were staged for commit.
