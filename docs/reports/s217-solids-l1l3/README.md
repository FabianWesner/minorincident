# s217 — L1–L3 solid props

The s211c solid-placement mechanism already covers the L1–L3 districts. No placement edits were needed: every substantial placement in the source districts and each level's generated layout has a blocking collider at every active tier. The L2 dressing manifest and L3 W2/W3 dressing are included in the generated-layout check.

PO request: make objects and buildings solid so the player cannot walk through them. This check uses the s211c threshold (at least 0.4 m² footprint and 0.5 m height) and checks for a non-physics-only placement collider covering every active tier (0–6). It verifies collider presence, not visual hull quality or physical movement contacts.

## Before → after

“Before” is the s211c source-district audit's unbacked-placement count; “after” is its missing-collider count. The generated level copies are separately audited below because they include level-specific dressing.

| Level | District | Source before | Source after | Generated placements | Generated eligible | Generated offenders |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| L1 | D-GROVE | 0 | 0 | 1,321 | 1,212 | 0 |
| L2 | D-GROVE | 0 | 0 | 1,368 | 1,234 | 0 |
| L3 | D-CORRIDOR | 0 | 0 | 1,475 | 1,398 | 0 |

L1–L3 collectively: **0 source offenders before, 0 after; 0 generated-layout offenders**. The same-level opposite districts are not used by the campaign, but were also checked: L1 D-CORRIDOR (1,247 placements), L2 D-CORRIDOR (1,247), and L3 D-GROVE (1,314) each had zero generated offenders.

Machine-readable counts and method are in [audit.json](audit.json). The committed source mechanism and global audit are from s211c; this report adds the level-copy audit to verify generated dressing.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused `tests/engine/world-systems.test.ts` — 5 passed.
- Full two-shard threat audit, run locally after remote runner unavailability — passed, 0 flags; L1–L3 skilled routes complete. Receipt: `test-results/qa-threat/README.md` and `audit.json`.
- Remote unit runner was unavailable (no healthy Hetzner runner); local `npm test` — 27 files, 106 passed, 170.39 s (150/150 case budget).
