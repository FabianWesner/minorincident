# q249 — single-ped pilot review gate

**Mass rollout stopped; awaiting orchestrator/PO review of pilot 2.**

The approved heroine remains unchanged. Only `npc.civilian-man-a` has new anatomy, with dedicated source/LOD/bake paths. All other figure assets, manifest entries and animation bakes are restored to baseline `4698e5aa0`.

See [pilot-2 report and measured before/after table](pilot-2/README.md), [studio sheet](pilot-2/studio-sheet.png), and [high-tier Scene Lab sheet](pilot-2/game-sheet.png). Pilot 1 is [retained as rejected evidence](pilot/README.md).

The all-cast goal is unfinished and must wait for the explicit pilot approval. No further figure rollout is authorized yet. The earlier pipeline PLAYBOOK clarification was committed separately on its local `lane/q249` (`51cf8e3`, refined for the below-chin pilot measurement in `798ccfb`); no figure inference or pipeline rollout was performed.

## Pilot-2 before / after

| Figure | Head / height, before → after | Head width / shoulders, before → after | Legs / height, before → after |
| --- | --- | --- | --- |
| Heroine (unchanged) | 0.2725 → 0.2725 | 0.8719 → 0.8719 | 0.4275 → 0.4275 |
| lod0 (high + low) | 0.2922 → 0.2461 | 1.1381 → 0.8967 | 0.4156 → 0.4431 |
| lod1 (high + low) | 0.2936 → 0.2461 | 1.1677 → 0.9141 | 0.4156 → 0.4439 |
| lod2 (high + low) | 0.2969 → 0.2461 | 1.1721 → 0.9028 | 0.4156 → 0.4460 |

Complete below-chin measurement; see the pilot report for the correction to pilot-1's shoulder slice and the legacy head-joint numbers. Body/shoulder scale is 1.000; head XYZ scale 0.787926 and hands 0.75.
