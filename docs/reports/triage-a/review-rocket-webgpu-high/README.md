# Q-143 — red squares around corpses

Reproduced with real launcher damage, fixed seed, high WebGPU and the L6 night preset used by L7 (`compositions.ts`). The apparent square blood marks are generic gibs: `GibPool` used full-bright red boxes. Ordinary ground blood already has irregular alpha edges (see the separate heavy-hit diagnostics).

Replace only generic gib geometry with small faceted clots and use a dark red Lambert material so scene lighting applies. Existing bodies, collider sizes, velocities, cap, lifetime and random sequence remain. Full corpses persist. Viewed matched `../review-rocket-webgpu-high-before/L6/shot-0180.png` and `L6/shot-0180.png`: bright rectangular cards become shaded irregular clots; body and blast position match. Draw maxima remain 33→33 and all scene checks/console checks pass. Before source: 92bba92ff; after source is the accompanying Q-143 commit.

Reproduce: `SCENE_PORT=4383 sh tools/e2e-lock.sh npx tsx tools/qa/triage-a-review.ts rocket --webgpu`.
