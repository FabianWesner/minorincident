# Collision registry — S and vehicle/admission M1

Source decision: `epics-pipeline/reports/astra-collision/README.md`; PO 2026-10-15:
“We always havbe the problem that objects are overlapping, but shouldn't happen by design (eg alphas locked in a tank)”.
The courier/corgi and APC contact additions follow the L1–L4 and L5–L9 visual audits.

## Implementation

- `SimWorld.solids` extends the existing static NavGrid compound bake. Vehicles use the existing circle/OBB contact primitive and spatial hash. Parked route blockers alias the canonical hull, so admission uses its exact footprint.
- E09 vehicles, traffic, convoy, tank and fuel/setpiece hulls register by entity ID, including restore. Explicit passenger entry/seated animations have no free actor footprint; attachments exempt contact only with their owner or other attachments on that owner. Dead cosmetics have no actor mask.
- One radius/height-aware occupancy query serves infected/civilian admission, checkpoint restore/respawn, vehicle exits and scripted relocation. Blocked requests retain their ID and encounter slot; they retry instead of accepting a blocked fallback. Scripted doorway walks retain their authored path until they clear the footprint.
- Final contact commit follows actor grounding and vehicle movement and precedes published animation displacement. It includes the courier and corgi. Conflicting motion components reserve their previous valid poses; independent formations keep moving.
- The guard checks moved/new actors each tick and independently audits the full population every 60 ticks. Its 64-entry offender ring records tick, actor, solid/actor, depth and last writer. Level completion fails on any penetration invariant failure; Scene Lab exposes the same counters. Deferred requests remain reported separately: L8 can finish while its authored tunnel arrivals are still walking to clear ground. Their identities and encounter slots remain retained. Available-space repro scenes and E18 horde fixtures additionally require zero pending requests.
- Combat reach is unchanged. Soft presentation spacing accounts for large bodies and hull attack poses. Normal attack windup faces the victim and holds that heading while automatic movement stops, preventing residual steering from turning attackers into neighbours.

## Evidence and current limits

This report is in progress; passing subsets do **not** establish a green deploy gate.

| Check | Source | Result |
| --- | --- | --- |
| Four audit reproductions, five cases | unmodified source plus regression tests (`d9743890d`) | All five fail, including the natural L4 tank/Alpha case. |
| Same reproductions through L4 tick 15700 | current density/contact snapshot before `57cb0e8aa` | All five pass; all 33 admission/contact/regression tests pass. No actor lost. |
| L1–L10 opening 300-tick invariant battery | `45cdd3e04` | All ten pass. |
| Fresh full unit suite | `a9ea26f10` plus `9257f65a9`/`b79dff6d6` | 1,463 passed, zero failed, seven skipped. The three earlier failures also pass their focused rerun. |
| L1–L10 campaign completion | latest completion battery before `cb4783d1f` | 10/10 complete; zero penetration invariant failures in every level. L8 retains three pending authored tunnel arrivals; all other levels have none. |
| Three-seed L1–L10 completion battery | `e9e36b938`/`fd1303095` | 29/30 complete; zero invariant failures in all 30 runs. L7 seed 2 times out with one straggler; investigation continues. L8 retains 1/1/2 authored tunnel arrivals. |
| Final contact/reproduction suite | `a9ea26f10` | 35/35 pass. |
| Existing convoy posed clearance | `b79dff6d6` | 10/10 pass, including both tiers and three seeds, yields and woman/pet clearance. |
| Moving APC/road/countryside ram gates | `2de827be6` | 4/4 selected gates pass; stationary hull pose spacing is retained. |
| L5 ingress/checkpoints and L7 departure | `f8f6e41ac` | 16/16 selected tests pass, including the unchanged L5 newbie time limit and all 35 passengers boarding. |
| WebGPU collision/combat matrix | preceding frozen build | 94/94 pass, both quality tiers and zoom 1.5/1/.5. Final source adds 12 station/boarding rows still awaiting validation. |
| Native GPU desktop/horde and bus rides | preceding frozen build | Desktop/horde budgets pass and all 17 ride configurations pass. Both emulated mobile L6 probes fail during fixture setup; mission initialization cap fix committed, measurements pending. Physical-device/manual checks remain skipped. |
| Full sim/level sweep | `e6a2c6aac` | 1,346 passed, 45 failed, two skipped. Predates the later convoy/ram, L1 timing, L4, pursuit fixture and checkpoint replay fixes; passing targeted reruns are recorded separately. |
| APC healthy/floor, WebGL, high/low, zoom 1.5/1/.5 | attack-facing preview | 12/12 pass, zero physical failures/pending; torso and attack-arm penetration gates ≤2 cm. [Rows](apc-gates.json). |
| WebGL collision/combat/vehicle matrix | `e6a2c6aac` frozen build | 100/106 pass. Every requested combat/APC/eight-attacker/get-up row passes, both tiers and zoom 1.5/1/.5. Six L5 ingress rows fail the unchanged stair-clearance gate; a 5 cm lane correction awaits browser rerun. [Rows](webgl-gates.json). |
| L1 original timing gates | `b00f5be1b`, confirmed with `d3d195b78` | Complete 136.9 s; newbie 111.1 s/zero deaths. Both original timing assertions pass with normal inputs. |
| L4 original alarm count/location and tank cadence gates | `a9ea26f10` / `d3d195b78` | Both pass: alarm timing/count/group/source assertions retained; tank shot gaps retain the original 7.9–12.8 s gate. |
| Contact cache, same-ID corner conversion and eight-actor player/corgi checks | `d3d195b78` | All pass, including classic and real L1 brains. Natural L4 through tick 15700 also passes. |
| Weather/checkpoint replay and L6 stress fixture | `7350c7990` | 43/43 pass; the L6 fixture retains 100 visible infected, zero failures/pending. |
| Five-seed pursuit arrival train | `1cc2f375f` | Original finite-arrival, deterministic repeat and ≥2 s spread assertions pass after synchronizing the scripted and physical courier. |
| Isolated Node E18, 200 actors | `45cdd3e04` | p95 1.264 ms vs 1.707 ms baseline (−26%); 200 retained, zero failures/pending. |
| Isolated Node E18, 100 actors | `45cdd3e04` | p95 .808 ms vs .968 ms baseline (−17%); 100 retained, zero failures/pending. [Earlier measurement](sim-performance-earlier.json). |

The final isolated paired E18 comparison passes the requested 5% limit: **1.8621 → 1.9298 ms (+3.64%)** at 200 and **1.0826 → 1.1323 ms (+4.59%)** at 100, with every actor retained and zero failures/pending. It measures 3,600 ticks after 120 warmup ticks on both sources. [Raw samples and source boundaries](sim-performance-final.json). The final backend matrices remain unmeasured, and the broad sim/level suite is not green. The L1 timing regression was traced to repeated standing fights: the complete profile stopped against every pursuer while the novice already moved and struck. [The test concept](../../../specs/90-test-concept.md) defines novice as complete plus handicaps, and E19-AC14 requires using movement against packs. Both profiles now share the existing normal-input moving-strike base policy; novice reaction, miss and detour handicaps remain. The unchanged timing gates pass at 136.9/111.1 s. Attack damage/reach and authored encounter counts are unchanged. [Compact completed evidence](validation-current.json). Existing scene expectations are retained; the added contact gates tighten overlap to 2 cm. The new eight-runner fixture uses the production 60 HP toughness-adjusted value.

### Unmeasured final browser work

After roughly 30 minutes of cumulative shared-slot waiting, the bounded final WebGPU batch stopped without acquiring a browser. The adjusted L5 lane and courier-follow get-up camera therefore lack final captures/backend matrix results. The repaired mobile E18 fixture has its green sim proof, but native mobile measurements and the remaining deploy browser gate were not rerun. No final green deploy-gate claim is made. The optional fourth CPU runner could not be provisioned because of Hetzner IP quota/capacity; the paired CPU comparison subsequently completed on the existing pool and passed.

### Game-camera inspection

Opened both [high](apc-high-z1.jpg) and [low](apc-low-z1.jpg) APC contact sheets. The four attackers remain visibly outside the side panels, with distinct heads and feet during approach and windup. Headlights illuminate the dry ground and the courier remains seated. Cyan attack wedges appear at the authored attack beats. These are visual observations in addition to numeric contact gates.

Also opened the latest [eight-attacker/corgi game camera](courier-corgi-high-z1.jpg), [close Butcher game camera](butcher-high-close.jpg), and [low-tier damaged APC](apc-floor-low-z1.jpg) sheets. The corgi remains outside the attack cluster; separate heads and feet remain visible, although the isometric projection is crowded. The close Butcher sequence keeps the forearm alongside the courier’s torso/backpack silhouette while cyan attack wedges overlap the image plane. The numeric forearm gate uses a torso/backpack capsule envelope, not an exact mesh intersection proof. The damaged APC retains four attackers outside the hull with lit ground beneath the headlights. The get-up close view originally cropped the courier; its camera now follows her and awaits capture rerun.

### Compatibility issues requiring an explicit scope decision

- `T-E29-06-200` creates 200 living radius-.35 m infected within 3 m of one blast and explicitly freezes their overlap. Its unchanged `positions <=3 m` precondition cannot coexist with the physical nonpenetration invariant; even allowing 2 cm pair penetration, 200 disjoint effective radius-.34 m disks require 72.6 m²; all disks whose centres fit within 3 m would have to fit in the radius-3.34 m disk (35.0 m²). The registry retains the encounters and admits them apart, so this fixture fails. Its assertions have not been relaxed.
- The zebra stampede tests require a locked path at 10 m/s through an occupied actor footprint, while their point-distance hit threshold is smaller than the summed body radii. Resolving that special attack belongs to the deferred specials lane. No special collision exemption has been added to hide this conflict.

No specs, reference assets, collision bake output or forbidden directories changed. No deploy or merge performed.
