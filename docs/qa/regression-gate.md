# Regression gate (10-22)

The PO found 14 issues in L1–L4 on PROD 13h that every bot and the Opus QA had passed. Each PO finding becomes a permanent check, automated where possible.

1. **Invariant sweep (`npm run qa:invariants`, every merge, remote).** All levels:
   - **load-time budget (PO P1-107):** for each of L1/L4/L7/L10 × WebGPU/WebGL2 × low/high, measure at least 20 cold loads, each in a fresh browser profile, from the real level-selection click until the loading card closes. Report median, p90 and maximum separately for every configuration, before and after. The **worst of N must be ≤ 6,000 ms**, and the candidate median must not exceed the baseline median under the same delivery and hardware conditions. Use `tools/perf/quiet-run.sh` with one headless browser (`E2E_UNITS=1`); retain the quiet-run conditions, build IDs, raw samples and summaries. `tools/perf/cold-load-time.ts <snapshot-origin> <webgpu|webgl2> <low|high> 20 <level>` records the samples; `LOAD_OUT` chooses the evidence directory. Profiled (`LOAD_TRACE=1`) samples diagnose stalls and are excluded from the distributions. Keep all shader/driver prewarm coverage: no gameplay frame may exceed 200 ms after the card closes, including the first ten seconds of movement (`LOAD_GAMEPLAY_MS=10000`) and the L10 lamp-boundary replay guarding PO #100. Session caches alone do not satisfy this budget;
   - accessory anchors (hats and glasses on the head) for every crowd variant × LOD × tier;
   - every seated NPC has a seat;
   - scripted actors stay visible through their scene;
   - vehicles don't overlap solids (scripted routes, parked, after dismount);
   - wave spawn counts = authored counts;
   - the objective marker is visible within 2 s of every step start;
   - walkable height follows the drawn surface.
2. **Visual A/B against PROD (`npm run qa:ab`).** Per level, a seeded camera tour at the PO's settings (low, zoom 1.5 and 1, WebGPU) through the scripted moments. It is rendered on the PROD build and on the candidate and diffed per frame. Opus judges only the changed frames: improvement, intended or regression.
3. **PO-style QA.** The Opus QA plays L1–L4 at least, at close zoom, low quality and with a progressed save. It works through the PO checklist (docs/qa/po-checklist.md), which gets every PO finding added.
4. **Process:**
   - cross-cutting render/crowd/corpse/prewarm changes need the all-level A/B before they merge;
   - no PROD deploy without green 1 + 2 and a GO from 3.
