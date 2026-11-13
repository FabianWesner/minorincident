# s102 L10 finale — PASS

**Goal achieved in native simulation. Browser QA needed.** No browser was run, as requested. Final runtime source: `bd81da83` (implementation `8167c51b`, reservation cleanup `bd81da83`).

Authored service arrivals enter through a visible doorway and follow the platform stairs: one actor every eight seconds, two runners then one firefighter. All use ordinary global archetype stats. Director admission and chunk sleep/wake honor reserved slots and pending turns; downed bodies are excluded from capacity retirement. Service reservations reconcile on restore and release. A live Mega outside the arena can recover through the perimeter; its forced phase-three console return applies only within the authored leash, avoiding the stalled outside return.

## Exact before/after

Unchanged native complete policy, HIGH/LOW seeds 1–3. The unchanged `tools/qa/s101-finale.ts` observes installation through cure release, including head and tail. [Before](before.json) is the exact baseline from main; [after](after.json) is the final source receipt after reservation cleanup. All routes complete.

| Tier | Seed | Before max gap s | After max gap s | Before deaths | After deaths |
| --- | ---: | ---: | ---: | ---: | ---: |
| HIGH | 1 | 16.72 | 14.83 | 3 | 3 |
| HIGH | 2 | 42.17 | 17.02 | 3 | 3 |
| HIGH | 3 | 46.48 | 15.58 | 2 | 2 |
| LOW | 1 | 42.12 | 17.42 | 0 | 0 |
| LOW | 2 | 16.80 | 18.43 | 2 | 0 |
| LOW | 3 | 18.60 | 16.68 | 2 | 0 |

Worst finale gap **18.43 s <=20 s**. Total deaths **8 versus baseline 12** (limit 14); every case is at or below its baseline (individual limit baseline+1).

## Required verification

- `npm run typecheck` and `npm run lint`: pass on final source.
- [Final journey cadence](final-cadence.json): `s89-l10gap.ts`, six cases, exit 0, no flags, worst adjusted adjacent gap 43.28 s <=45 s, zero cap violations.
- [Final L10 threat audit](final-threat.json): `node --import tsx/esm tools/qa/threat-audit.ts --levels L10 --maxWorkers 2 --out /private/tmp/s102-final-threat`. Exact line: `[qa:threat] L10: skilled complete, passive tick-budget, 0 passive flags (37.2s)`. Exit 1 is solely `PARTIAL_LEVEL_SELECTION`, the expected diagnostic-only selection flag.
- [Unchanged remote suite](final-remote.json): `sh tools/remote/run.sh "$PWD" -- npm test`, runner 46.225.66.90, job `s102-l10finale2-b1bfd2-17605-1794607418`, exit 0. Manifest 150/150; 27 files pass, 106 tests pass, one skipped. Vitest 223.80 s, budgeted command 226.3/240 s. No trimming or retry.
- Completion audit recomputed all finale gaps from tick endpoints/starts, checked all six route/death limits and journey flags, and inspected the seven-file runtime diff. No zombie/weapon stat changes, bot-policy or observer changes, shortened charge, corpse removal, forbidden-directory edits, deployment, push or main movement. No check remains running.

All coordinates belong to authored finale anchors. The service-entry approach builds on the preserved rejected s101 `a9fb7339` experiment, replacing hard-coded world positions with authored anchors and completing its reservation/timer cleanup. No specs were edited.

Historical rejected trials and diagnostics are retained as JSON. [Investigation chronology](investigation-history.json) includes intermediate failures; those statements describe earlier candidates and do not supersede this final result.
