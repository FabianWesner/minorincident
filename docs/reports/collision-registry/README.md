# Collision registry — S and vehicle/admission M1

Source decision: `epics-pipeline/reports/astra-collision/README.md`; PO 2026-10-15:
“We always havbe the problem that objects are overlapping, but shouldn't happen by design (eg alphas locked in a tank)”.
The courier/corgi and APC contact additions follow the L1–L4 and L5–L9 visual audits.

## Implementation

- `SimWorld.solids` extends the existing static NavGrid compound bake. Vehicles use the existing circle/OBB contact primitive and spatial hash. Parked route blockers alias the canonical hull, so admission uses its exact footprint.
- E09 vehicles, traffic, convoy, tank and fuel/setpiece hulls register by entity ID, including restore. Explicit passengers and attachments exempt only their owner relationships. Dead cosmetics have no actor mask.
- One radius/height-aware occupancy query serves infected/civilian admission, checkpoint restore/respawn, vehicle exits and scripted relocation. Blocked requests retain their ID and encounter slot; they retry instead of accepting a blocked fallback. Scripted doorway walks retain their authored path until they clear the footprint.
- Final contact commit follows actor grounding and vehicle movement and precedes published animation displacement. It includes the courier and corgi. Conflicting motion components reserve their previous valid poses; independent formations keep moving.
- The guard checks moved/new actors each tick and independently audits the full population every 60 ticks. Its 64-entry offender ring records tick, actor, solid/actor, depth and last writer. Level completion fails on any penetration invariant failure; Scene Lab exposes the same counters. Deferred requests remain reported separately: L8 can finish while its authored tunnel arrivals are still walking to clear ground. Their identities and encounter slots remain retained. Available-space repro scenes and E18 horde fixtures additionally require zero pending requests.
- Combat reach is unchanged. Soft presentation spacing accounts for large bodies and hull attack poses. Normal attack windup faces the victim and holds that heading while automatic movement stops, preventing residual steering from turning attackers into neighbours.

## Evidence and current limits

This report is in progress; passing subsets do **not** establish a green deploy gate.

| Check | Source | Result |
| --- | --- | --- |
| Four audit reproductions, five cases | unmodified source plus regression tests (`d9743890d`) | All five fail, including the natural L4 tank/Alpha case. |
| Same reproductions through L4 tick 15700 | earlier registry snapshots, including `45cdd3e04` | All five pass; no actor lost. |
| L1–L10 opening 300-tick invariant battery | `45cdd3e04` | All ten pass. |
| Full unit/sim/level sweep | `45cdd3e04` | 2727 passed, 114 failed, 9 skipped. Later movement/admission fixes require a new full result. |
| APC healthy/floor, WebGL, high/low, zoom 1.5/1/.5 | attack-facing preview | 12/12 pass, zero physical failures/pending; torso and attack-arm penetration gates ≤2 cm. [Rows](apc-gates.json). |
| Courier/corgi with eight real attackers; Butcher game camera | preceding frozen high/WebGL preview | Both numeric gates pass; broader final matrix pending. |
| Isolated Node E18, 200 actors | `45cdd3e04` | p95 1.264 ms vs 1.707 ms baseline (−26%); 200 retained, zero failures/pending. |
| Isolated Node E18, 100 actors | `45cdd3e04` | p95 .808 ms vs .968 ms baseline (−17%); 100 retained, zero failures/pending. [Earlier measurement](sim-performance-earlier.json). |

The final source still needs its queued full suite, completion battery, both backend matrices and performance result. Existing scene expectations are retained; the added contact gates tighten overlap to 2 cm. The new eight-runner fixture uses the production 60 HP toughness-adjusted value.

### Game-camera inspection

Opened both [high](apc-high-z1.jpg) and [low](apc-low-z1.jpg) APC contact sheets. The four attackers remain visibly outside the side panels, with distinct heads and feet during approach and windup. Headlights illuminate the dry ground and the courier remains seated. Cyan attack wedges appear at the authored attack beats. These are visual observations in addition to numeric contact gates.

### Compatibility issues requiring an explicit scope decision

- `T-E29-06-200` creates 200 living radius-.35 m infected within 3 m of one blast and explicitly freezes their overlap. Its unchanged `positions <=3 m` precondition cannot coexist with the physical nonpenetration invariant; even the sum of their footprint areas exceeds the disk area. The registry retains the encounters and admits them apart, so this fixture fails. Its assertions have not been relaxed.
- The zebra stampede tests require a locked path at 10 m/s through an occupied actor footprint, while their point-distance hit threshold is smaller than the summed body radii. Resolving that special attack belongs to the deferred specials lane. No special collision exemption has been added to hide this conflict.

No specs, reference assets, collision bake output or forbidden directories changed. No deploy or merge performed.
