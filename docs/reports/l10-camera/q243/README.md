# Q-243–245 · L10 framing and solid aftermath

The [before/after sheet](before-after.jpg) was inspected at full source resolution: R4 high zoom 1 and 1.5, R4 low zoom 1, the console, and an empty R4 road stretch. Seed 32, production L10, 28 deterministic permanent bodies per location, shared headless browser pool. The source PNGs and full counters are in `test-results/q243/`; the retained [evidence](evidence.json) records camera samples, body persistence and render costs.

- **Q-243:** load already had a reset path, but same-position checkpoint flag changes and explicit short teleports could present the old framing. Checkpoint restore and respawn now queue a presentation snap, consumed after the full sim restore; both debug teleport entry points do the same. Normal walking retains its eased region blend. A new case in `tests/engine/l10-camera-framing.test.ts` covers both framing directions, short poses, automatic long teleports and interpolation history; the two prior spatial cases were consolidated to keep the 150-case suite budget. The real-browser probe confirms exact target scale on frame zero and after 120 ticks (1.3 road, 1 finale, 1.0464284888 at the sampled terminal approach).
- **Q-244:** the bodies are opaque (`transparent=false`, opacity/fade 1); removing fog did not change the pale appearance. Frozen bodies inherited the living crowd's additive night surface fill, rim and atlas self-fill. The frozen shader now uses 25% of those fills and 20% of the rim, preserving the authored colours and directional shading. This applies equally to near/far corpse pages; no LOD substitution or body deletion. Both tiers retained all 28 R4 body IDs after streaming away and returning. Creating the body fields and widening the camera produced **zero new corpse shader builds after warm-up**. All changes use the existing prewarmed frozen-material path.
- **Q-245:** the unsupported black polygons were generated `oil-stain` surface overlays, not shadow maps/AO/pothole meshes. They are omitted from the L10 surface build; their random draws are still consumed to preserve all other seeded dressing. Skids, cracks, drains and manholes remain. Rebuilding D-CURE left placements, collision, routes, navigation, anchors, chunk bounds and level bounds byte-for-byte equal as parsed JSON. The empty-road pair shows the polygon removed.

The inspected after views show shaded bodies with solid clothing/skin masses instead of pale outlines; the wider R4 view retains the same silhouettes and body count. The console remains legible. Maximum sampled high-tier cost was 104 draws / 156,970 triangles (budget 300 / 500,000). `tools/qa/l10-arrival-check.ts` is unchanged from the starting commit.

Reproduce through the shared pool (ports are job-specific):

```sh
SCENE_PORT=3431 node --import tsx tools/qa/q243-review.ts after high
SCENE_PORT=3431 node --import tsx tools/qa/q243-review.ts after low
SCENE_PORT=3432 node --import tsx tools/qa/q243-camera.ts
```

Validation receipts are recorded in `checks.json` after all checks complete.

Final validation: `npm test` **110 passed**, typecheck/lint clean, `npm run verify -- E32` passed; `E2E_PORT=3434 npm run test:smoke` **6 QA + 1 public passed** in 126.7 s; `SCENE_PORT=3433 npm run scene:gate` **48/48**, no known failures or skipped rows. [Receipts](checks.json). An earlier smoke run overlapping the gate hit a 1.7 s frame gap; the full rerun after the gate passed without changing tests or thresholds. The default smoke port was occupied by another job, hence the isolated port.
