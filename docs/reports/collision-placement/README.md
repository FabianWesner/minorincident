# PO 2026-10-19 — collision and placement

Worktree/job: `collision-placement`. Base: `2d5e0fb84`. No deploy or merge.

**Gate status: not approved.** L4 real-input still fails; native E18 timing remains uncertified. Final camera revalidation used one GPU slot per batch under the orchestrator’s allocation. Native timing needs a completely quiet reservation. CPU source stages, captures and open gates are recorded below.

## Changes and PO decisions

- L4's visible military perimeter now enters the shared contact registry for every actor, including soldiers and pedestrians. Its old `playerOnly` flag is removed. The existing infected assault approaches the fixed boundary and vaults above the 1.12 m wire, lifting before horizontal travel and landing beyond the far face, under the same contact guard. The wall opens at line break; the inside-building outbreak remains. E22 clarifies the solid-ground and above-wire traversal criteria.
- NPC spawn admission reserves 0.8 m at the active player start/checkpoint while the courier remains there. Later combat spawns retain their existing rules. Starts and restored checkpoints reconcile nearby living NPCs without deleting identities or reducing counts. Vehicle seats retain their explicit owner relationship.
- Closing mission gates, ordinary doors and L2/L5/L6 shutters admit the trailing companion to a clear interior point first. It disappears for 12 fixed ticks during the relocation. A blocked admission keeps the door open. L1 physics and navigation now use the same shutter orientation, including checkpoint restoration.
- Loose weapon markers draw immediately while their GLB loads. Weapon, health and mission pickup rings render over occluders, without depth writes, fog or tone mapping. The L2 rack highlight is a border, so the axe remains readable inside it.
- The ramp asset has two integral concrete joint caps at every LOD, with matching highway colliders (four joints across the two L3 ramps). Shared district assembly closes small (2–16 cm) barrier/fence endpoint seams; it preserves actor-sized gate openings and does not mutate cached layouts. The original repeated fence gap was 3.94 cm.

Spec updates: E08-AC04 (spawn/companion), E11-AC09 (pickup visibility), E21-AC11 (joints), E22-AC05/18 and the 10-19 decision note (solid perimeter), E23-AC15 (companion admission and queue clearance), E29-AC11 (L7 initial formation), and the test plan. Budgets are unchanged. `src/assets/staticCollision.ts` was not changed.

- The corgi has a capsule footprint (0.44 m radius, 0.4 m spine half length), checked against solids and other actors, including its head/rear and turns. L3 uses the existing companion/squad obstacle route.
- Companion rollback reserves its complete capsule, and animation facing changes run before the final contact check. Static contact uses the dog’s own vertical span so its supporting floor is not mistaken for a wall. Metro queue spacing uses the dog’s actual width while the full capsule protects its head/rear; the idle pet faces along the shaft and yields to entering walkers. The idle courier also yields to the companion in this narrow queue. The lookout stands beyond the arrival queue, leaving the interior right lane free; the unchanged-base placement leaves only 0.10 m where the dog needs 0.79 m ([regression](baseline-lookout.txt)). Followers settle at least 1 m beyond the leaf before closure. The Metro cannot complete while the real shutter is still waiting for companion admission.
- Routes reserve the complete capsule around posts when the actual goal has room. A goal beside a bench/wall and narrow-door fallback use its body width; L3 retains its shared follower field. A corgi already ahead walks on after the courier’s actual progress stalls, rather than stopping inside its normal two-metre follow band and sealing the player’s route. Normal movement retains the existing follow behavior. This fixes the L5 newbie stall without changing combat stats or its frozen limits.
- L7 survivors spawn directly in their three-column following formation behind the courier, retaining incoming identities and counts. This prevents the initial group converging through her at tick 66.

## Regression evidence

[Unchanged-base failure log](baseline-focused.txt): all seven initial focused probes fail on `2d5e0fb84`: the perimeter is accepted as clear, an NPC remains 0.72 m from the courier, the dog remains 2 m outside the shutter, all four visible rail caps are missing, a fence seam is 3.94 cm, and both weapon/mission rings retain background render state. The [final four ring regressions](baseline-rings.txt) also all fail on the base, adding proof for the unloaded-weapon marker and non-covering rack border (nine distinct focused regressions across the two logs). Ground pickups retain a full-size ring even when their support height is explicitly zero.

`tests/levels/start-checkpoint-clearance.test.ts` runs one natural complete route per campaign level, requires every declared checkpoint to have been saved, then restores each actual saved anchor and checks the 0.8 m clearance. This avoids using the debug graph walk to invent spatial checkpoints. `tests/levels/L4-perimeter.test.ts` retains its one-metre plaza walk audit and requires blocked ground movement and above-wire infected traversal without collision exemptions.

## Game-camera review

Scene catalog: thirteen `collision-placement-*` scenes, included by the matrix’s `collision-*` filter. All thirteen have fresh reviewed captures on both backends (156 rows). All use the game camera. Reviewed rows include high/low quality and zoom 1.5, 1.0 and 0.5 on both renderers; captures were opened and described below.

- L3 east/west: the concrete corner caps meet the span and curved ramp rails on both sides. Close zoom shows closed corners; zoom 1 shows the caps in context with the deck, wreck and lamp.
- L4 perimeter: concrete and wire meet continuously at the corner; the courier remains on the inside while pushing toward the boundary. The warning ring and MILITARY ZONE signs remain readable.
- L1 start: courier and corgi have separate positions beside the road. Shutter: the courier is 1.2 m behind the closed bay leaf on the authored raised bay floor; the dog is admitted to the same interior side and begins drawing at tick 12. The shutter occludes the dog from this particular close camera; the interior position is independently asserted by the sim regression.
- L2 axe: the outlined highlight and complete ground ring remain visible at both zooms, with the station sign/bollards/lamps retained as occluders.
- Pickup occluder probe: the gold weapon ring and teal health ring remain readable in front of the barrier/sign, from frame 12 onward. Frame 0 precedes both pickup views being drawn; the unloaded-marker unit regression covers creation before GLB completion.

- PO #27: the road companion/courier capture shows separate heads and bodies in both tiers and zooms. The replacement fence camera follows the dog: frames 0/30 show its feet on the ground between the fences; the red garden wall occludes it in later frames. The wreck probe shows the dog beside a gray armored vehicle, then on the road. It is a hull-contact probe at the supplied coordinates, not a pixel-exact recreation of the reported red wreck. The original Opus reference JPEGs were unavailable in this checkout. Independent sim regressions check the full capsule against solids and actors.
- PO #37: at tick 66, the high-tier 24-person and low-tier 15-person groups retain visible three-column spacing, with separate bodies and distributed health bars. Adjacent projected bars can still overlap. Zoom 0.5 shows the front rows; zoom 1 shows the whole formation.

## Validation status

### CPU checks and source stages

Typecheck, lint and the production build pass on the final goal-aware route/yield source. Heavy unit, simulation and campaign tests use Hetzner with at most four workers; there are no local Vitest sweeps.

| Run | Result | Source coverage |
| --- | --- | --- |
| Fresh complete unit sweep on final source | **1,657 passed, 9 skipped, 0 failed** | [1,666-case summary](validation/unit-goal-final.json), [runner record](validation/unit-goal-final.txt); 294 files passed, one skipped |
| Complete functional sweep before full-body routing | 2,996 passed, 6 failed, 11 skipped | [3,013-case summary](validation/functional-before-routing.json); all six failures have later passing targeted reruns |
| Complete functional sweep with full-body routing | 2,995 passed, 11 failed, 9 skipped | [3,015-case summary](validation/functional-routed-snapshot.json), [log](validation/functional-routed-snapshot.txt). Snapshot precedes final goal-aware routing/yield; failures include L3 profiles/checkpoint audit/campaign handovers, L5 newbie, zoo handovers and infected liveness. All eleven failures now have passing targeted reruns on the corrected source/unchanged L3 branch; records are listed separately |
| Complete isolated timing project after full-body routing | **206/206 passed**, 27 files | [Log](validation/timing-routed-final.txt), [summary](validation/timing-routed-final.json); includes all zoo and E18 Node simulation budgets; precedes the last yield change |
| Final forward-yield regression and L5 newbie profile | **2/2 passed** | [Log](validation/courier-yield-final.txt) |
| Broad companion/campaign checks with turn-only route clearance | 159 passed, 2 failed | [Superseded prototype](validation/turn-only-prototype.json): L2 pressure and L6 newbie failed; both pass after goal-aware routing |
| L3 profiles and placement batch after restoring shared field clearance | **38/38 passed** | [Log](validation/l3-field-clearance-final.txt): entire L3 file including complete/newbie/army, three-seed evade and checkpoint restoration; plus the then-current 17 placement probes. The final non-L3 goal selection does not alter this L3 branch |
| Final continuous campaigns and L3 anchor audit | **3/3 passed** | [Log](validation/l3-campaign-anchors-final.txt): complete and newbie L1–L6 with actual handovers, and all seven reached/restored L3 start/checkpoint anchors |
| Final infected liveness compatibility | **1/1 passed** | [Log](validation/infected-clearance-final.txt); unchanged 5 s maximum and 1% sample limits |
| Final collision/placement regressions | **18/18 passed** | [Log](validation/core18-final.txt); includes the added bench-goal approach |
| Final goal-aware routing compatibility | **11/11 passed** | [Log](validation/goal-clearance-final.txt): L2 pressure, L4 respawn, L5 newbie, L6 rescue/protection, continuity, zoo handovers and route/yield regressions |
| Final isolated NPC campaign timing | **5/5 passed** | [Log](validation/npc-timing-goal-final.txt). Both runner slots held throughout measurement; L1–L5 high/low patrols, density, immunity and pet lifecycle. Earlier queued attempts were cancelled before measurement |

Final isolated NPC patrol simulation p95 peaks at 2.30 ms high (limit 4) and 1.81 ms low (limit 6). These source stages are kept explicit; this is not presented as a fresh full green sweep. The initial 3,204-case run had 15 failures and is retained as historical evidence. An earlier 1,666-case unit run had one inventory-validation timeout; its isolated retry passed all 17 inventory checks without changing the deadline.

Passing compatibility evidence after full-body routing includes [L2 pressure and L6 rescue](validation/full-body-routing-final.txt), [L4 repeated-death escape, L1-to-L2 aftermath continuity and L5 closure](validation/routes-shutter-final.txt), [35 complete companion/placement checks](validation/routed-companion-final.txt), [30 fetch/toy checks](validation/routed-fetch-final.txt), and [all twelve L6 level/protection checks](validation/l6-routed-final.txt). On the latest goal-aware route, L2 high has zero deaths and 10.00 street encounters/min (minimum 8); low has one death and 8.73/min (minimum 5). No population cap, health, damage, encounter threshold or time band changed.

The earlier complete [anchor/geometry/L4 batch](validation/anchors-final.txt) passed 30/30: ten natural campaign routes, all 55 start/checkpoint anchors, eleven collapse/pressure/PO-round checks, seams, pickups and L3 joint navigation. The 3,013-case snapshot also passed the complete anchor suite. Those runs predate the final companion routing/yield correction. The later 3,015-case routing snapshot failed the L3 audit; its dedicated final-source rerun passes all seven L3 start/checkpoint anchors.

New regressions fail on unchanged `2d5e0fb84`: [eight added PO probes](baseline-additions.txt), [three seam probes](baseline-joints.txt), the ring/focused evidence above, [Metro lookout placement](baseline-lookout.txt), [full-body routing](baseline-route-footprint.txt), and [forward yielding](baseline-courier-yield.txt). The added [bench-goal approach](baseline-goal-and-infected.txt) fails numerically on the base; that same base run passes the unchanged infected-liveness check. The last probe leaves the base corgi stationary at 1.2 m; the corrected companion walks on while keeping its full capsule clear. The full L5 newbie profile also passes after this fix. Failed shallow-projection experiments were removed.

### Browser and camera gate — one-slot revalidation

Fresh final-source matrices: **78/78 WebGL2 + 78/78 WebGPU = 156/156 rows pass**. Each backend uses one headless browser and releases its slot after about eight minutes, with a review break between batches. Records: [WebGL2](webgl2-reviewed/index.md), [WebGPU](webgpu-reviewed/index.md). I opened the WebGL2 [high](review-webgl2-high-current.jpg)/[low](review-webgl2-low-current.jpg) and WebGPU [high](review-webgpu-high-current.jpg)/[low](review-webgpu-low-current.jpg) montages, covering every scene at zooms 1 and 0.5, plus the full yield, pickup and Metro sheets. Both backends show the same separate courier/corgi bodies, closed rail caps, spaced L7 ranks and foreground pickup rings. The fence/wreck/shutter camera limitations described above remain visible.

The yield scene shows separate bodies while the background advances. The Metro camera shows the narrow queue and corgi by the rail; the rail and people hide some feet, so geometry checks establish clearance. The updated [E18 scene draw/triangle summary](validation/scene-budgets.json) independently applies high/low limits to all 156 rows. These deterministic counters do not substitute for native frame timing.

`collision-placement-l5-metro` reuses the recorded five-survivor production ingress fixture. `collision-placement-corgi-yield` uses ordinary courier keyboard walking toward a pet already in front. Both now have fresh captures on both renderers at every tier/zoom; the 600-tick Metro scene is an ingress/spacing probe, not proof of completed shutter closure (covered by the campaign tests).

Earlier browser batch A passed 35/35; B passed 61/63. The final **14-case batch passes 13 and fails 1**, with the failed check repeated once: [log](validation/browser-current-final.txt), [summary](validation/browser-current-final.json). All twelve remaining smoke checks pass, including WebGPU level transitions. This run uses a fresh production build, port 3551, one headless worker, the shared lock and a 20-minute cap, then releases its slot after about four minutes of execution.

Kessler WebGL viewport now passes on this run: maximum dominant-colour share **0.396/0.40**, minimum luminance spread 27.7. I opened [the final game-camera frame](validation/browser-final-kessler.png): the courier is beside a fading wooden fence over dark paving, with shadows and curb/grass variation. [Measured samples](validation/browser-final-kessler.json) retain every sampled position. The earlier 0.41 failures remain in the older B record; this is a narrow passing margin.

**L4 real-input remains unresolved.** The final attempt and retry fail during the war medkit walk at `L4.spec.ts:172`, when the mouse-click helper calls `step(1)` and the game reports `step requires pause()`: [first error](validation/browser-final-l4-first.md), [retry](validation/browser-final-l4-retry.md). The DOM record shows a mission briefing. This run does not reach the escape route and does not establish that the older four-death escape failure is fixed. Passing CPU escape/campaign checks do not replace this browser gate. No assertion or deadline was weakened.

### Native E18 gate — not certified

The native reservation held all quiet slots for about six minutes and released them. Measurements below precede the final companion changes. Desktop high passed on both renderers; strict low checks missed one criterion each:

| Renderer | High war/collapse frame p95 | Low simulation p95 | Low first-turn hitch | Result |
| --- | --- | --- | --- | --- |
| WebGL2 | 10.6 / 11.9 ms | 6.2 ms (limit 6) | 70.2 ms (limit 80) | low fails |
| WebGPU | 9.4 / 9.1 ms | 5.4 ms | 81.4 ms (limit 80) | low fails |

I opened the [native capture montage](review-native.jpg): both high views show the active plaza and smoking line break; low portrait views show the courtyard and escape-side building, which occludes part of the collapse. They are timing-scene records, not proof that every combatant is visible. Renderer-tagged measurements and captures are in [native-webgl](native-webgl/) and [native-webgpu](native-webgpu/).

Earlier zoo measurements exceeded 4 ms on both base and candidate; the later fully isolated 206-case timing run supersedes those CPU results. It does not replace native GPU timing. **E18 remains unapproved**, with all budgets and thresholds unchanged. The current one-slot allocation cannot provide the full quiet isolation required for the final native rerun.
