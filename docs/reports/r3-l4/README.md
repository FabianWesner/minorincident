# r3-l4 — L4 breach timing and follower pace

## Fixes

- **G-22, L4:** The first three arrivals at a new breach already owned reserved population slots, but the batch admission precheck also required ordinary headroom. The emergence path then applied the ordinary phase alive-share ceiling, which held those reserved runners back. Fresh spearheads now bypass only those redundant gates and use the same full existing population cap as the opening war-0 spearhead. Cohort sizes, total caps, targets, and the 20-second acceptance limit are unchanged.
  - Commit: `890d3620` (`Fix delayed L4 breach spearheads`).
  - `npm run qa:accept -- --level L4 --skip-browser`: 0 fresh failing rows. High stationary breach-north first attack: **9.08 s**; high complete: **10.33 s**. The acceptance run's high stationary receipt has no breach-north wave flag.
  - High-tier threat hold: first breach at level time **52.72 s**, 70 alive, first attack **8.93 s**. L4 threat breach-west/north/south first attacks: **8.28/12.28/6.88 s**, no wave flags.

- **G-13, L6 companion:** The reported L6 follower ID 15 is the corgi. During the exit it tracked a moving point only 0.25 seconds ahead of the courier, leaving too little distance to maintain pace through turns. The L6 exit lead is now 0.65 seconds; all other companion movement retains its existing lead. Injured survivor pacing and L5 are untouched.
  - Commit: `a61ee021` (`Keep L6 corgi pace through the exit`).
  - Targeted L6 threat rerun: ID 15 median **2.77 m/s** over 12 samples, versus a **2.20 m/s** group median; no L6 level flags.
  - L6 breach cohorts: **8/8** and **10/10**. Each of the six maintenance entries admitted its authored **2/2** members with no entry flags.

- **G-13, L7 follower 66:** No additional L7 code change was warranted on the current `e8eb3492` source. That source already contains commit `2287dbd2`, which gives departure followers separate trail slots. The archived rr-b failure is tied to its older frozen review. A fresh native L7 run measured seed-2 follower 66 at 4.3485 m/s against a 4.5770 m/s group median (27 samples, **95.008%**); the required L7 three-seed threat vote had **0 failed followers**. L5 was not changed.

## Verification

- `npm run typecheck` — passed.
- `npm run qa:accept -- --level L4 --skip-browser` — 0 fresh failing rows.
- `npm run qa:accept -- --level L7 --skip-browser` — completed; fresh L7 pace receipts recorded.
- `npm run qa:threat -- --levels L4,L6,L7 --maxWorkers=2` — L4, L6, and L7 each had **0 level acceptance flags** and **0 passive flags**. L7 skilled follower pace had 0 failures across the three seeds. L4 first breach attack was 8.93 s. L6 breach/entry cohort ledgers matched their authored counts.

The threat-audit command exits 1 for the harness-only top-level flag `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, because this brief intentionally selects only L4, L6, and L7. The selected levels themselves have zero acceptance flags. No deploy or push was performed.
