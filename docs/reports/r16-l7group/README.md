# R16 — L7 group movement handoff

**L7 opt-out retained. Natural L7 movement is unfinished and disabled.** At the orchestrator’s timebox, `6c069d47` restored all runtime code, tests and public assets to pinned main `8622b6d1`. The branch adds investigation reports and a read-only route diagnostic. Experimental fixes remain in commit history; none are shipped.

## Current L7 result versus main

Ordinary mortal `runLevel('L7', 'complete', seed)` with default observation windows, original presets, populations and policies:

| Tier | Seed | Main | Final opt-out branch | Matching native hash |
| --- | ---: | --- | --- | --- |
| low | 1 | complete, 116.37 s | complete, 116.37 s | `7531f27e` |
| low | 2 | fail, 74.78 s | fail, 74.78 s | `02602b10` |
| low | 3 | complete, 120.12 s | complete, 120.12 s | `66622d3c` |
| high | 1 | fail, 105.32 s | fail, 105.32 s | `f303c8ff` |
| high | 2 | fail, 64.52 s | fail, 64.52 s | `470e45ff` |
| high | 3 | fail, 101.13 s | fail, 101.13 s | `e2128f94` |

**Main itself completes 2/6.** Fresh baseline runs reproduce R12’s archived hashes exactly; the brief’s assumed six-completion main baseline is incorrect. The four failures are courier deaths. Fresh runs after restoration reproduce all six outcomes, native hashes, entire observations and raw pace votes; [verification receipt](evidence/fallback-verification.json) records native hashes and full observer equality.

## Follower flags versus main

With identical runtime, the opt-out branch retains main’s five known G-13 identities; no experimental follower improvement is claimed:

- `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT`
- `step/corridor:SLOW_FOLLOWER:71`
- `phase/encounters:SLOW_FOLLOWER:71`
- `phase/encounters:FOLLOWER_PACE_UNOBSERVED:60`
- `phase/encounters:FOLLOWER_PACE_UNOBSERVED:63`

The focused standard audit uses low quality and all three skilled seeds. Its additional `PARTIAL_LEVEL_SELECTION` flag and exit 1 identify a diagnostic run, not a passing campaign gate. Supplemental high-tier pace votes are compared separately; qualification and thresholds remain unchanged. [Final focused audit](evidence/fallback-focused-threat.json.gz) exactly reproduces baseline observations, votes and flags, excluding elapsed wall-clock time. It adds zero flag identities.

| Supplemental pace vote | Main | Final opt-out branch | Added identities |
| --- | --- | --- | ---: |
| low, seeds 1–3 | four pace flags listed above (wait is separate) | identical flags and raw phase samples | 0 |
| high, seeds 1–3 | required followers 60 and 63 unobserved in encounters | identical flags and raw phase samples | 0 |

All three main high-tier runs fail, so their pace votes lack qualifying completed seeds. Identical unqualified evidence establishes parity, not passing high-tier pace. [Both-tier parity receipt](evidence/fallback-verification.json).

## What the experiment achieved, and why it is disabled

Candidate `5e475879` (restored experimentally as `fd46bbed`) completed **all six mortal cases**, with zero collision invariant failures and zero boarding assists/recoveries. Its standard low-tier audit removed the five known flags. However, unchanged supplemental high-tier voting added **four identities**:

- `step/corridor:SLOW_FOLLOWER:74`
- `phase/encounters:SLOW_FOLLOWER:74`
- `step/departure:SLOW_FOLLOWER:63`
- `step/departure:SLOW_FOLLOWER:70`

Completion therefore did not satisfy the requested follower constraint. Later slot/path experiments traded these flags for courier deaths, new low-tier flags or group waiting deadlocks. The final branch restores main rather than enabling that candidate. [Six-route experimental table, metrics and checks](experimental-six-route.md).

## What we learned

- Alpha stun can drop the courier through Northgate’s raised road because logical support is sampled only with controls enabled. Sampling support during stun fixes the height loss; unsupported bodies still fall. This fix is experimental and reverted here.
- Casualties preserve original follower slots. Computing bot wait distance from survivor count can strand a tail slot just beyond the wait threshold. Occupied rows plus normal two-abreast tracking room resolved that experimental deadlock without changing the mission’s 18 m condition.
- High-tier slots can rotate across frontage during courier dodges. Follower 74 supplies too few useful walking samples before dying. Connected slot checks improve the opening but alter combat and later route behavior.
- A solid Alpha corpse can block the route bot indefinitely. Activating existing corpse avoidance after actual contact solves one reproduced stall; it does not solve the entire seed matrix.
- L7’s departure speed clamp can leave the motion motor reporting velocity above actual displacement. Feeding resolved velocity back passes a focused regression but did not satisfy native completion and follower checks together.
- Caching a fixed safe world target creates a wait deadlock when the leader stops. Transporting a relative safe target needs connectivity and teleport reset handling; those variants still introduced failures or new flags.

[Detailed investigation](investigation.md), [continuation findings](continuation.md), and checksummed raw receipts under [evidence](evidence/manifest.json) preserve the useful work. `selected-*` files always describe the reverted six-route experiment; `fallback-*` files describe the final opt-out branch.

## What remains open

Keep the far tail on a connected road path through courier dodges and corridor turns, resolve high-tier departure pace, and preserve ordinary mortal combat and boarding. Before removing the opt-out, rerun seeds 1–3 on both tiers with unchanged evaluation and show six completions without added follower identities. The original natural-movement goal is **not achieved**.

Two earlier complete ten-level audits exhausted the unchanged 600-second budget without aggregate receipts. No complete campaign-gate pass is claimed.

## Final verification

On restored runtime `6c069d47`, `npm run verify -- E29` passes **typecheck, lint and 106 tests / 27 files**, with one existing platform skip. Vitest takes 132.79 seconds; its wrapper takes 138.2 seconds within the unchanged 240-second budget. Collection remains 150/150 cases and 43/45 files. [Final gate receipt](evidence/fallback-gate-checks.json.gz).

All six native receipts match main’s entire observations, combat events, final roster and hashes; both tiers’ raw pace votes are identical. [Parity receipt](evidence/fallback-verification.json), [handoff audit](evidence/completion-audit.json). The focused L7 audit returns the same five G-13 flags plus `PARTIAL_LEVEL_SELECTION` (exit 1); it is not a campaign-gate pass.

## Reproduce

Run heavy commands on runners:

```sh
sh tools/remote/run.sh "$PWD" -- node --import tsx/esm tools/qa/r16-l7group-route.ts low reproduce
sh tools/remote/run.sh "$PWD" -- node --import tsx/esm tools/qa/r16-l7group-route.ts high reproduce
sh tools/remote/run.sh "$PWD" -- node --import tsx/esm tools/qa/threat-audit.ts --levels L7 --out test-results/r16-l7group-reproduce --maxWorkers 4
```

The route diagnostic observes ordinary movement and events; it does not alter setup, health, ammunition, policies, qualification or thresholds. Repository verification uses `npm run verify -- E29` with at most two Vitest workers on an isolated runner. A disposable commit in the runner snapshot supplies Git history required by existing tool tests.

No dependencies, specs or protected reference files changed. No push or deployment was performed. **Browser QA needed.** No browser was used, as required by the brief.
