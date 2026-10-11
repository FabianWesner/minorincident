1. Gun-raise implemented on lane/gun-raise; committed work only, no merge or deployment; full acceptance remains incomplete.
2. First player gun tap raises smoothly for 100 ms before muzzle discharge; prepared aim, held cadence and NPC timing remain responsive; the bat stays hidden.
3. Final 16-case headless capture replay passes with zero clipping/errors and matches the frame-reviewed sheets byte for byte; see [review](README.md).
4. All six alleged new gun-hold failures reproduce on exact 96dc52d0; all nine failure messages match; police parent and gun-hold sim reports are identical; see [comparison](comparison.md).
5. Typecheck/lint/build, E05 verify (66 remote + 32 browser), remote unit 519/519, gun browser 10/10 and L3 browser 4/4 pass; simulation is 593/594 (pre-existing 4 ms patrol gate red).
6. Final remote L3 is 11/20; its nine failures already fail on starting main, with legacy-rule conflicts and police-range balance debt retained; no tolerances/specs loosened; see [validation](validation.md).
