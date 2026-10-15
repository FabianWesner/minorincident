# Collision registry — S and vehicle/admission M1

Source decision: `epics-pipeline/reports/astra-collision/README.md`; PO 2026-10-15:
“We always havbe the problem that objects are overlapping, but shouldn't happen by design (eg alphas locked in a tank)”.
The courier/corgi and APC contact additions follow the L1–L4 and L5–L9 visual audits.

**The success bar is not fully met.** The implemented contact/admission gates pass. The low-count relative performance gate, mixed-special budget, remaining regression checks and final browser coverage keep the deploy gate red.

## Implementation

- `SimWorld.solids` extends the existing static NavGrid compound bake. Vehicle contact shares the existing circle/OBB primitive and spatial hash. Parked route blockers alias the canonical hull.
- E09 vehicles, traffic, convoy, tank and fuel/setpiece hulls register by stable entity ID, including restore. Passengers/attachments exempt only their explicit owner. The legacy L4 seated/roster state resolves to its actual bus ID; being hidden alone grants no hull exemption. Dead cosmetics have no actor mask.
- One radius/height-aware occupancy query serves infected/civilian admission, checkpoint restore/respawn, vehicle exits and scripted relocation. Blocked requests retain their ID and concurrency/encounter slot and retry; no blocked fallback is accepted.
- Final contact commit follows grounding and vehicle movement and precedes published animation displacement. It includes the courier and corgi. Conflicting components reserve prior valid poses; independent formations keep moving. Courier corrections sweep the existing Rapier capsule, and its collider is published with its final pose.
- The guard validates moved/new actors each tick, independently audits the complete population every 60 ticks, and retains a 64-entry offender ring with tick, IDs, depth and writer. Level runners fail on invariant violations; Scene Lab exposes the same counters. Pending authored arrivals are reported separately, with identity/slot retained.
- Combat damage and reach are unchanged. Attack windup faces its victim and holds that heading while movement stops. Soft pose spacing handles large bodies and stationary driven hulls; moving-vehicle ram contacts remain active.
- Existing convoy posed clearance remains part of the shared query. Traffic braking includes pedestrian radii. A stalled L7 follower can sidestep a courier blocking the queue using the same occupancy query; normal queue cadence is retained.

## Validation

Sources are recorded because the broad runs preceded later focused fixes. Passing subsets do not establish a green deploy gate.

| Check | Result and boundary |
| --- | --- |
| Four audit reproductions, five cases, unmodified `d9743890d` source | All five fail, including natural L4 tank/Alpha contact. |
| Final contact/admission/reproduction/convoy/boarding/traffic selection | **59/59 pass** at `2aeda4f07`, including natural L4 through tick 15700, courier/corgi eight-attacker cases, blocked admission/restore, collider publication, changed radii and original convoy/boarding/traffic assertions. |
| Legacy L4 owner isolation | Additional focused check passes: the seated courier exempts her own bus and still rejects a tank. Together these are **60 distinct passing checks**. |
| Full unit suite | **1,463 passed, zero failed, seven skipped**. Latest full snapshot precedes the final rollback-bucket, boarding and publication refinements; their focused runs are recorded separately. |
| Full sim/level sweep at `e6a2c6aac` | 1,346 passed, 45 failed, two skipped. Later focused fixes supersede parts of this result. |
| Rerun of failing files at `2de827be6` | 118 passed, 25 failed. Nine failures subsequently pass focused reruns; **16 remain unresolved from that selection**. [Exact list and sources](remaining-gates.json). |
| Matching unmodified-source selection | 140 passed; one L10 high-arrival test timed out at its unchanged 120 s wall-clock limit. This selection excludes the two zoo timing cases. |
| L1–L10 three-seed completion battery | Zero invariant failures in all 30 runs; 29 complete. Its L7 seed-2 failure was subsequently fixed and rerun successfully (579.22 s, zero failures/pending). L8 retained 1/1/2 authored tunnel arrivals. |
| Real campaign handover chain | The actual completed L1–L6 save was replayed through L7–L10 after the queue fix. **All ten levels complete, zero deaths and zero invariant failures in every report**. The single-process full test previously stalled; the successful prefix/tail replay is recorded explicitly. |
| L1 original timing gates | Complete 136.9 s; newbie 111.1 s/zero deaths. Original timing assertions retained. |
| L4 original alarm and tank gates | Original timing, count, group, emergence-source and 7.9–12.8 s shot-gap assertions pass. |
| Weather/checkpoint replay and L6 stress fixture | 43/43 pass; 100 visible infected retained, zero failures/pending. |
| Five-seed pursuit train | Original finite-arrival, deterministic repeat and ≥2 s spread assertions pass after synchronizing the scripted and physical courier. |
| 24-target rocket fixture | Original count/radius/blast-tick/recovery assertions pass with clear actor positions. |
| Additional safe 200-body rocket fixture | **Passes**: 200 visible, admitted full footprints, one unchanged 6 m rocket blast, 200 permanent kills in its blast tick, zero failures/pending. The incompatible original 3 m fixture remains unchanged. |

[Compact completed evidence](validation-current.json) includes the campaign reports and source boundaries. `admitted` counts successful API operations, including repeated scripted placements; it is not a unique spawn count. Raw, larger run outputs are under `test-results/collision-s1/`.

L1 timing was traced to repeated standing fights: complete stopped against each pursuer while novice already moved and struck. [The test concept](../../../specs/90-test-concept.md) defines novice as complete plus handicaps, and E19-AC14 requires movement against packs. Both now share the existing normal-input moving-strike policy; novice reaction, miss and detour handicaps remain. Damage/reach and authored counts are unchanged.

The L6 handover stall came from a courier correction crossing a stair/riser to a clear endpoint; the real capsule sweep fixes it (272.55 s, zero deaths/failures/pending). L7 also needed the existing L6 finished-civilian loss rule and a local queue detour around the courier. Entity and roster identities remain retained.

## Performance — remaining blocker

Final three-pair measurement source: `9d6934be0`; baseline: unmodified `d9743890d` source. Each sample measures 3,600 ticks after 120 warmup ticks, with both Hetzner runner slots held. The later L4 passenger adapter is outside these fixtures' empty-hull path.

| Living/visible actors | Baseline median p95 | Changed median p95 | Change | ≤5% gate |
| --- | --- | --- | --- | --- |
| 200 | 1.791121 ms | 1.643316 ms | −8.25% | pass |
| 100 | .921470 ms | 1.012389 ms | **+9.87%** | **fail** |

Every changed sample retains the full visible population with zero invariant failures/pending. The separate mixed-special 200-actor probe is also **red: 4.951107 ms p95 against 4 ms**; its 100-actor 6 ms gate passes. A broader special-contact cache trial was slower and was reverted. [All three pairs](sim-performance-final.json) retain the variation; earlier passing single-pair results are historical evidence.

## Browser evidence and unmeasured final work

- Preceding frozen WebGPU build: **94/94 pass**, both quality tiers and zoom 1.5/1/.5.
- Frozen WebGL build at `e6a2c6aac`: **100/106 pass**. Every requested combat/APC/eight-attacker/get-up row passes. Six L5 ingress rows fail the unchanged 2 cm shin-clearance gate (measured 1.3 cm); the 5 cm lane correction is committed and unmeasured. [Rows](webgl-gates.json).
- APC healthy/floor attack-facing preview: **12/12 WebGL rows pass**, both tiers and all three zooms, including ≤2 cm torso/arm contact gates. [Rows](apc-gates.json).
- Native GPU desktop/horde budgets and all **17** bus-ride configurations pass on the preceding frozen build. Both emulated-mobile L6 probes failed during setup because mission initialization overwrote the stress cap. The cap fix has its green sim proof; native mobile remeasurement is outstanding. Physical-device/manual checks remain skipped.

After roughly 30 minutes of cumulative shared-slot waiting, the bounded final WebGPU batch stopped without acquiring a browser. Final backend matrices, repaired mobile measurements, adjusted L5/get-up captures and the new L6 stair/L7 courier-queue scenes remain **unmeasured**. The final catalog adds both new game-camera scenes to the automatic quality/zoom matrix. No final green browser/deploy-gate claim is made.

### Game-camera inspection

Opened both [high](apc-high-z1.jpg) and [low](apc-low-z1.jpg) APC contact sheets. Attackers remain outside the side panels with distinct heads and feet during approach/windup. Headlights illuminate the ground and the courier stays seated. Cyan wedges appear at the authored attack beats.

Also opened the [eight-attacker/corgi camera](courier-corgi-high-z1.jpg), [close Butcher camera](butcher-high-close.jpg), and [low-tier damaged APC](apc-floor-low-z1.jpg). The corgi stays outside the attack cluster; separate heads/feet remain visible despite the crowded isometric projection. The Butcher forearm stays alongside the torso/backpack silhouette while cyan wedges overlap the image plane. Its numeric forearm gate uses a torso/backpack capsule envelope, not an exact mesh-intersection proof. The damaged APC retains four attackers outside the hull. The original close get-up view cropped the courier; its camera now follows her and awaits capture rerun.

## Unresolved compatibility and gameplay gates

- `T-E29-06-200` freezes 200 radius-.35 m living bodies inside 3 m. Even with 2 cm permitted pair penetration, disjoint effective radius-.34 m disks require 72.6 m² inside an enclosing radius-3.34 m disk of 35.0 m². The registry retains all actors and admits them apart, so the original ≤3 m precondition fails. Its assertion is unchanged. The additional 6 m blast proof passes; an explicit decision on replacing the invalid fixture is pending under the no-loosening instruction.
- Eight special-attack checks remain red (Alpha charge, dog pounce, four Mega cases, two zebra cases). After fixing the charge observer's initial overlap, the unchanged locked-path assertion now exposes x=11.4598 versus 12 at its deadline. Special swept-contact migration remains in the later lane; no exemption hides these conflicts.
- L2 repeated-death mercy, L5 intruder/shutter progress, L6 siege timing, smoke targeting, encounter balance and L10 high-arrival release remain unresolved, in addition to the performance gates. The L1 world-preserving respawn and L2 calm-health boundary now pass.

No specs, reference assets, generated static-collision bake or forbidden directories changed. No baseline worktrees or extra build copies were created; temporary source archives/helpers were removed. No deploy or merge performed.
