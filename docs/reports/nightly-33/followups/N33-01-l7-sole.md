# N33-01: L7 elderly survivor sole penetrates the floor

**Classification: real render grounding defect; filed locally.** Base main `165e05cd2`, native WebGPU, 960×540, seed 29. All 7 rows below passed in nightly-28 and now fail the unchanged `footSinkMaxCm: 0` assertion with reported depth **0.1 cm**. Every other check in each row passes.

The offender is consistently `follower-4` / entity 7 / `npc.civilian-elderly`. An independent observation reran every failed row on the untouched base revision. It reads the actual production skinned support vertices through `PickBodies.bounds`, filters to `footL`/`footR`, and compares world-space shoe Y against the same ground floor. Each row has real shoe geometry below the floor, not only a legacy heel/toe-anchor discrepancy.

| New failing row | Peak actual foot sink (cm) | Fixed frame | Foot | Vertex evidence |
| --- | ---: | ---: | --- | --- |
| `collision-l7-departure@high-z1.5` | 0.05281654 | 349 | footR | [trace](../evidence/collision-l7-departure@high-z1.5-vertex-depth.json) |
| `collision-l7-departure@low-z1.5` | 0.05281654 | 349 | footR | [trace](../evidence/collision-l7-departure@low-z1.5-vertex-depth.json) |
| `qa-l7-entry-bus@high-z1.5` | 0.05281654 | 349 | footR | [trace](../evidence/qa-l7-entry-bus@high-z1.5-vertex-depth.json) |
| `qa-l7-entry-bus@low-z1` | 0.05281654 | 349 | footR | [trace](../evidence/qa-l7-entry-bus@low-z1-vertex-depth.json) |
| `qa-l7-entry-bus@low-z1.5` | 0.05281654 | 349 | footR | [trace](../evidence/qa-l7-entry-bus@low-z1.5-vertex-depth.json) |
| `qa-late-bus-departure@high-z1.5` | 0.05281654 | 349 | footR | [trace](../evidence/qa-late-bus-departure@high-z1.5-vertex-depth.json) |
| `qa-late-bus-departure@low-z1.5` | 0.05281654 | 349 | footR | [trace](../evidence/qa-late-bus-departure@low-z1.5-vertex-depth.json) |

Every failed grounding row reproduced twice with the same strict check: [high rerun 1](../checks/repro1.json), [high rerun 2](../checks/repro2.json), [low rerun 1](../checks/low-repro1.json), [low rerun 2](../checks/low-repro2.json). The independent per-row observations preserve the raw failed checks and identify the actual shoe vertex and skin weights at each below-floor sample. [Initial whole-body trace](../evidence/l7-mesh-depth.json) independently found mesh Y −0.0005281654 m at frame 349, while the legacy anchor was −0.0007713651 m (floor 0). The table above uses the stronger foot-only proof.

**Repair investigation:** inspect posed/baked sole grounding for the elderly v2 figure across gait, LOD presentation and weighted skinning. The trace isolates real geometry penetration but has not isolated the cause within those stages. A global lift would alter every body contact and requires broader grounding validation; no arbitrary offset or assertion relaxation is made. This is a submillimetre rendering defect, not a campaign or bus-boarding completion failure.

Reproduce in the shared headless pool (both qualities; exact failed rows):

```sh
SCENE_PORT=3343 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgpu --only collision-l7-departure@high-z1.5,collision-l7-departure@low-z1.5,qa-l7-entry-bus@high-z1.5,qa-l7-entry-bus@low-z1,qa-l7-entry-bus@low-z1.5,qa-late-bus-departure@high-z1.5,qa-late-bus-departure@low-z1.5 --out test-results/nightly-33/repro-l7
```

Raw metrics and contact sheets for each row are retained under `../failures/`; all row identities, original checks and evidence hashes are recorded in [matrix audit](../checks/matrix-final.json).
