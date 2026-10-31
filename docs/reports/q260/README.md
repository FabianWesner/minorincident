# q260 — crawler head restored

The crawler again has a complete head at game zoom 1.5 on both quality tiers. Restored the PROD `fd8f56ca3` head/neck geometry and bind pose in the source mesh, all three LODs and both texture tiers, then regenerated the three GPU bakes used by living figures and corpses. q249’s 0.75 hand scale is retained. The q257 height code and every other figure’s geometry, atlas, dimensions and bake mapping are unchanged.

The fault was applying a standing head/height limit to the crouched crawler. That pushed its head between the shoulders. The explicit crawler rebuild in `assets/inf.crawler/restore-head.ts` keeps the full production head instead. No spec criterion was edited. The old q249 standing-ratio audit is not a valid acceptance test for this pose; [the crawler audit](audit.json) verifies exact PROD head vertices, exact main hand vertices and unchanged texture bytes across all seven meshes, with **zero errors**. [Build receipts](geometry.json) also record zero body displacement.

## Visual review

Opened the supplied VQA 41b failure comparison and its original full PROD high/low game captures and close views ([copied originals](visual/prod-vqa41b/)). Fresh captures compare **before = main `c7e1c130c`**, **after = this branch**, and **PROD crawler assets = `fd8f56ca3`** in the same q257 runtime. Only the crawler GLBs, baked files and its manifest entry are substituted for the two baselines. This controlled comparison preserves q257 normalization and the other figures. Each baseline receipt records the exact historical file hashes served to Chromium.

| Requirement | Evidence and review |
|---|---|
| Head at game zoom 1.5, high | PASS: [before](visual/before-high/game15.jpg), [after](visual/after-high/game15.jpg), [PROD assets](visual/prod-high/game15.jpg). The thin hair strip becomes a full brown head above the shirt shoulders; its volume reads alongside standing infected. |
| Head at game zoom 1.5, low | PASS: [before](visual/before-low/game15.jpg), [after](visual/after-low/game15.jpg), [PROD assets](visual/prod-low/game15.jpg). The same head silhouette is retained on low. |
| Close orbit, high and low | PASS: opened all six final orbit sheets. The tracking target is lowered to the crawler’s body so the full face, hair and neck remain visible through a complete rotation. [High after](visual/after-high/orbit.jpg), [low after](visual/after-low/orbit.jpg). |
| Crawl, attack and death, both tiers | PASS: opened the six motion sheets. Each fixture travels 4.45 m, lands two attacks, then dies at frame 300; samples extend to the settled corpse at frame 480. The complete head follows the crawl, raised-arm attack and death pose as on PROD. [High after](visual/after-high/crawl-attack-death.jpg), [low after](visual/after-low/crawl-attack-death.jpg). |
| Other figures and q257 normalization | PASS: delivered asset diff contains only `inf.crawler` files. JSON registry edits affect only its dimensions and three bake entries; no height, renderer or sim code changed. |
| Palette/texture and continuity | PASS: texture bytes are identical, the face retains its glowing eyes and snarl, and no head/neck seam or detached head appears in the reviewed frames. |

## Checks

- `npm test`: **110/110**, 26 files, 34.1 s; case budget **150/150** ([log](qa/npm-test.log)).
- `npm run typecheck` and `npm run lint`: pass ([typecheck](qa/typecheck.log), [lint](qa/lint.log)).
- `npm run verify -- E17`: pass; typecheck/lint/test all exit 0 ([receipt](qa/verify-E17.json), [log](qa/verify-E17.log)).
- `npm run test:smoke`: **6 QA cases + 1 public case pass**, 179.5 s / 240 s ([log](qa/smoke.log)).
- `npm run scene:gate`: **48/48**, 0 known failures, 0 not run, WebGL2/WebGPU and high/low ([summary](qa/scene-gate/summary.md), [log](qa/scene-gate.log)).
- All six capture receipts contain zero browser errors and confirm two landed attacks and the dead final state. Headless Chromium ran through the shared pool with Metal. No port 3300, deployment or GitHub operation was used.

## Reproduce

```sh
node --import tsx assets/inf.crawler/restore-head.ts
node --import tsx assets/inf.crawler/audit-head.ts
# Run each phase (before / after / prod) and quality (high / low):
SCENE_PORT=3378 node --import tsx assets/inf.crawler/capture.ts after low
npm test
E2E_PORT=3377 npm run test:smoke
SCENE_PORT=3376 npm run scene:gate -- --out docs/reports/q260/qa/scene-gate --jobs 2
```

The geometry step is committed as `beb240480` on `lane/q260`; the follow-up evidence commit includes this report and captures.
