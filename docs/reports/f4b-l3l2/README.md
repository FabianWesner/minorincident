# L2 / L3 follow-up

The retained game code is commit `3ed2af5b`. Its high/low acceptance measurements are documented in [the previous lane](../f4-l3l2/README.md). L2-08 turns are 0 → 2 on both tiers; L3-11 attack rates are high 56.7/44.2/87.4 → 35.48/14.20/79.15 and low 26.59/14.55/34.56 → 18.95/14.95/14.35 per minute. L3-06 high army-line squad is 1/2/1 → 3/3/0; low is 3/3/3 after. Low calm distance remains 103/108 samples within 3–6 m; high has no calm samples in that retained receipt. L2-12 high remains 31.38/min, above 30; low remains 13.68/min.

## Isolation and rejected variants

- Removing only the ambush admission guard leaves high L2-12 at 31.38/min and L2-08 at 0 turns. Keeping the guard but restoring the original arrival reservation also leaves L2-12 at 31.38/min, with 2 turns. Neither hunk alone explains the bridge rate.
- Restoring the old shared bite logic while keeping the rescue changes gives high L2-12 30.50/min and zero firefighter turns. Restoring all three pre-fix rescue and bite files gives 26.52/min and zero turns. The interaction between those changes alters the route; the precise causal chain remains open.
- Holding two ambush slots for the full 90-second rescue window gives high L2-12 31.38/min and 2 turns; rejected.
- Increasing the L3 moving slot lead to at most 1 m produced high calm samples all in range (two per officer) and L3-11 3/3 in range, but army-line squad counts became 0/3/0, failing the 2/3 threshold. Rejected; the retained formation is unchanged.
- Applying that larger lead only when unthreatened gave the same high 0/3/0 squad result and two calm samples per officer in range. An intermediate 0.75 m maximum gave high army-line 2/3/1 and all 16 calm samples in range, but attack rates 70.44/41.62/80.63 per minute fail all three seeds. Both variants were reverted; the three formation variants in this follow-up are exhausted.

## Verification and remaining work

The full `node --import tsx/esm tools/qa/threat-audit.ts` completed in 479.6 seconds with **zero fail flags**, matching the stated main gate baseline. The retained code is identical to `3ed2af5b`, for which both tiers of L2 and L3 acceptance, typecheck, lint and focused tests were run in the previous lane. The follow-up high acceptance runs above were isolation trials; their generated receipts were discarded and were not committed.

Open: isolate and fix the combined L2 bridge regression while retaining firefighter turns; fix low calm formation without losing squad survival; obtain high calm samples for the retained behavior. Re-run both tiers and the full audit after any resulting code change. No game files changed in this follow-up.
