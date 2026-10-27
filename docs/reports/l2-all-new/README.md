# L2 all new figures

Status: in progress; no rollout verdict yet.
Source roster: `src/data/crowdAppearance.ts` supplies seven regular infected variants; `src/data/npcs.ts` supplies five recurring civilian models.
L2 volume: 30 trapped civilians (20 low), 24 ambush infected, 13 bridge infected, four seated civilians, seven static corpses, six firefighters, four police, plus two child appearances.
Batch 2 target (12): the seven regular infected variants and five recurring civilian models; batch 3 candidates: child, firefighter and police models.
Already skinned at base: `inf.common-worker`, `npc.civilian-man-a/b`, `npc.civilian-woman-a/b`, `npc.civilian-elderly`.
Build finding: passing `assets/inf.jogger` silently skinned old rigid geometry (38,661 triangles, 1 influence/vertex); that output was removed.
Pipeline-cast rebuild from durable `cast/wave1/inf.jogger` reached Blender surface reconstruction, which exited 245; no new model was integrated.
The build now refuses game asset directories without `source/manifest.json`; this guard was verified to reject `assets/inf.jogger` before writes.
`npm test`: pass, 85 tests; `node --import tsx tools/assets/validate.ts`: pass, zero errors across the validated assets.
Capture blocker: loopback bind/connect is denied (`EPERM`) for Scene Lab ports; no game-camera sheet is reviewable yet.
Pending: old/new 120px and 400px low/high sheets, 30-figure crowd, scripted scenes, smoke, scene gate, L2 playthrough, perf and showcase image.
L1 per-LOD triangle/file limits apply: 6k/2.5k/900 humans and 600/250/150 kB; infected archetypes use their manifest triangle budgets.
