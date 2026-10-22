# Regression gate (10-22)

The PO found 14 issues in L1–L4 on PROD 13h that every bot and the Opus QA had passed. Each PO finding becomes a permanent check, automated where possible.

1. **Invariant sweep (`npm run qa:invariants`, every merge, remote).** All levels:
   - load-time budget against the previous PROD;
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
