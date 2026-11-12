# S74 L9 detour recovery

## Result

The 18-case progress matrix passes: every case finishes in under 5 seconds of maximum no-progress time, with zero position jumps. The L9 threat audit now completes both the skilled and passive policies and reports zero passive flags.

S73’s lateral throw landing change supplied the matrix win, but its L9 threat result was not actually established. Its report cited `0 L9 flags` without recording the passive run. The threat audit also checked `run?.completed` (the skilled run) while constructing `passiveFlags`; a completed skilled run could therefore hide an incomplete passive route. The check now uses `passiveRun` for L9, where the mission has no bounded passive observation window.

The mission trace localized the vehicle stall to the detour’s final bend: the APC drifted more than 12 m from its active route segment while the bot continued targeting the next waypoint and its blocker avoidance could keep it off the route. The bot now steers back to the nearest point on the current segment, clears stale avoidance while recovering, and uses full throttle during that recovery for the complete policy. Evacuation parking targets the north edge of the evacuation radius so the APC does not sit on the survivors’ southbound path. These are ordinary input and route changes; zombie stats, actor health, collision protections, props and corpses are unchanged.

## Progress matrix

`sh tools/qa/l9-progress-regression.sh` on the final source state. “No progress” is the script’s maximum no-progress window. All cases finished and reported an empty position-jump list.

| Path | Route | Seed 1 | Seed 2 | Seed 3 |
|---|---|---:|---:|---:|
| Primary | Road | 3.20 s / 0 | 3.22 s / 0 | 3.27 s / 0 |
| Primary | Countryside | 0.35 s / 0 | 0.35 s / 0 | 0.35 s / 0 |
| Primary | Dry shortcut | 0.45 s / 0 | 1.83 s / 0 | 0.37 s / 0 |
| Detour | Road | 0.37 s / 0 | 0.37 s / 0 | 0.37 s / 0 |
| Detour | Countryside | 0.35 s / 0 | 0.35 s / 0 | 0.35 s / 0 |
| Detour | Dry shortcut | 0.32 s / 0 | 0.32 s / 0 | 0.32 s / 0 |

Each cell is `max no-progress / position jumps`.

## Threat audit

Before the S74 route recovery, using S73’s shoulder landing change with the corrected passive completion check:

```text
[qa:threat] L9: skilled tick-budget, passive mission-failed, 1 passive flags (48.0s)
[qa:threat] 48.4s; 2 fail flags; test-results/qa-threat/README.md
```

After, from `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`:

```text
[qa:threat] L9: skilled complete, passive complete, 0 passive flags (11.7s)
[qa:threat] 12.0s; 1 fail flags; test-results/qa-threat/README.md
```

The one aggregate flag is `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, expected because the command selected only L9. The L9 receipt itself has `flags: []` and `passiveFlags: []`; both native runs completed.

## Validation

- `sh tools/qa/l9-progress-regression.sh` — pass, 18/18, max 3.27 s, zero jumps.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9` — both policies complete, zero L9 passive flags.
- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `sh tools/remote/run.sh "$PWD" -- npm test` — could not start. The runner pool had no healthy runner; the local fallback also refused because its browser/quiet-process admission sample was unavailable. `tools/remote/status.sh` confirmed the pool API was unreachable from this environment. The 240-second unit suite therefore remains unverified here; it was not shortened or run outside the admission guard.
