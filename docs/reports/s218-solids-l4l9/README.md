# s218 — L4–L9 solid props

Northgate metro exit now has collision on its side walls and gate pillars in L6, and on its exposed gate pillars in L7. The L7 street surface at the exit is at 3.9 m, above the lower stair walls (whose tops are at 2.05 m in world space). The stair and swinging gate passage remain open. Other campaign districts already passed the placement audit.

| Level | District | Placements | Eligible | Before | After |
| --- | --- | ---: | ---: | ---: | ---: |
| L4 | D-FAIR | 835 | 779 | 0 | 0 |
| L5 | D-FAIR | 889 | 757 | 0 | 0 |
| L6 | D-SUBWAY | 91 | 61 | 1 | 0 |
| L7 | D-FAIR | 937 | 783 | 1 | 0 |
| L8 | D-ZOO | 2,349 | 1,901 | 0 | 0 |
| L9 | D-CROSSING | 3,385 | 3,097 | 0 | 0 |

The s211c audit classifies placements at least 0.4 m² in footprint and 0.5 m high, using the solid manifest flag or substantial baked geometry. It checks for a non-physics-only collider at every active tier. This is a collider-presence measure, not proof of complete visual hull fidelity or physical contact across every surface. Counts and method are in [audit.json](audit.json).

The initial L7 side-wall candidate produced a departure follower flag, and was reverted. The exposed pillars preserve the visible gate structure without adding the buried lower walls to L7 navigation. The L7 diagnostic and subsequent full audit passed.

## Verification

- Full local two-shard threat audit: **0 flags**, all ten skilled routes complete; receipt `test-results/s218-final-threat/audit.json`. Remote shards were unavailable, so both shards ran locally and were merged.
- Source district audit: zero offenders for D-FAIR, D-SUBWAY, D-ZOO and D-CROSSING. Generated L7 audit: zero offenders; generated counts for the remaining levels are in the table.
- `npm run typecheck` and `npm run lint` passed.
- Focused collision and player tests: 7 passed.
- Local `npm test`: 27 files, 106 passed, 113.6 seconds / 240-second budget. Remote runner unavailable.
