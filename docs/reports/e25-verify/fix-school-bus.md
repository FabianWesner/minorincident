# School-bus native LOD references

The full asset gate found four uncovered emissive batches in the two school-bus LODs. Native batching merged marker/headlamp geometry, while the copied anchors retained incomplete references (one headlamp anchor had an empty list). The detailed export already passed its contract.

The native distance exporter now binds school-bus head and brake anchors to all surviving batches of their matching emitter material. The metadata-only repair tool applies the same rule to both authored and shipped LODs. No decorative exemptions were added; light positions/settings and runtime base table are unchanged.

[Binary and metadata proof](evidence/school-bus-glb-identity.json): all four GLB binary payloads identical; only `ss_light.emissiveNodes` changed. [Native-view proof](evidence/school-bus-accepted-identity.json) compares all six levels with fixed node time, deterministic depth tie ordering and 120 simulation ticks to settle pose blends. Final gate results are in the main README.

The initial L5/L6 batch retained moving NPC/health-bar differences. A corrected L5 capture prevents `Clock.reset()` from resuming simulation during asynchronous loading; both pages remain at world tick 0 and differ on **0 / 921,600 pixels**. See [clock-controlled identity](evidence/school-bus-l5-clock-fixed-identity.json). This is a capture-only control; no actor or image region was removed. L1/L2/L4 already compare exactly in the batch.
