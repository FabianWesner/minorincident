# Batch 46 pre-PROD visual QA (slim body build)

Build under test: `82dd55d85` (`BRANCH=qa` build, WebGPU, headless). A/B baseline: pre-slim main `b0aac03dd` (the batch 45 PROD build), served from a separate QA build with `SCENE_DIST`. Quality high and low, game zoom 0.5 (closest) and 1.5 (farthest), DPR 2.

## Verdict

**NO-GO as is; GO once `inf.bbq-dad` goes back to its pre-slim build** (or gets an apron refit). Everything else in the batch reads cleanly. The male courier (P1 scope) shows no defect at tiers 0–4 in idle, run, aim or melee.

## Glitches

| # | Sev | Where | What | New in batch 46? |
|---|---|---|---|---|
| 1 | P2 | `inf.bbq-dad` (regular infected, L1–L4 hordes, persistent corpses) | The black "GRILL & CHILL" apron bib sinks into the slimmed shirt. Standing at both tiers, only the "CHILL" skirt below the waist shows and "GRILL" is gone. As a corpse the apron turns into a narrow, ragged dark strip with the white shirt around it. Pre-slim main draws a full apron panel. The lane's bind-pose garment crop does not show this; it appears on the posed, skinned figure and on the frozen corpse. Sheets: `P2-bbq-dad-apron-ab.jpg` (rows: main low, slim low, main high, slim high; left standing, right chasing), `P2-bbq-dad-corpse-ab.jpg` (top: frame 0, bottom: frame 600; left main, right slim). Repro: `bbq-dad-scene.json` (Scene Lab, close camera, azimuth 315 for the front view). | **yes** |
| 2 | P3 | L7 Northgate start, male courier at tier 3 | The torso reads as a green/orange smear and the trousers as yellow with teal patches, unlike the tier-3 vest in isolated scenes. | no: identical on pre-slim main (`ab-prod-vs-slim-L1-L7.jpg`) |
| 3 | P3 | L7 survivor crowd at LOD1/2 | Large flat white sole slabs. Bodies overlap the courier when the crowd packs around him. | no: identical on main |
| 4 | P3 | L1/L7 kills | Gib limbs and dark head blobs lie next to corpses. This is the existing dismemberment VFX. | no |

## Checked, no new defect

- **Male courier, tiers 0–4, idle/run/aim/melee, high and low, zoom 0.5/1.5** (`courier-male-low.jpg`, `courier-male-high.jpg`). Catalog `courier-gear-tier*-male` and `tier4-swing` pass at every zoom and tier, including the attachment gap gate. Shirt hem (Q-269) and shoulder rim (Q-274) look the same as in the merge evidence.
- **Heroine next to slimmed and reverted figures**, idle, flee, infected attack, corpses by day and night (`cast-heroine-slim-reverted.jpg`). Left of the heroine: man-a, man-b, woman-b. Right: adult-m, then the reverted woman-a, elderly and adult-f. The reverted women are visibly stockier, but they read as different body types rather than a mismatch. Not jarring.
- **Live levels**: L1, L2, L3, L7, L9 at both tiers, plus an A/B against pre-slim main for L1 and L7 (`ab-prod-vs-slim-L1-L7.jpg`, `levels-crowd-corpses.jpg`). The only differences are the intended slimmer limbs and torsos. Corpse layout probe: no sunk pairs and the courier is clear in every level. 0 console errors.
- **L4**: the follow camera stays on the start bus in the live script, so L4 is covered by the catalog instead: `fight-army-line`, `l4-corpses-persist`, `e18-l4-corpses` and `postmerge2-l4-corpses`, 30/30 pass. A frame-600 A/B against main shows only the bbq-dad apron difference (#1).
- **Scripted NPCs**: depot handover (`door-handover-*`, `qa-handover-depot` low), lab staff exit (`qa-l1-lab-exit` low), bench sitters (`ped-bench-sitter`, `ped-sit-all`, `seat-bench-l1-start`), L2 fire-engine passengers and dismount (`scripted-npcs.jpg`).
- **Catalog**: 68 high rows (the batch hit the 10-min reservation cap at row 69) plus 32 low and 30 L4 rows, all pass. `ped-walk-all` low: foot slide max 2.8 cm, sink 0, clipping 0.

## Stunning?

Mostly yes. Slimmed civilians and infected now share the heroine's proportions, and crowds read lighter and more coherent. The male courier looks clean at close zoom on both tiers. What holds it back:
- the bbq-dad apron (#1);
- the pre-existing L7 courier look (#2);
- chunky white LOD soles in dense crowds (#3).

## Reproduce

```sh
BRANCH=qa npm run build
SCENE_PORT=4892 E2E_PORT=4891 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch46-iso.ts [high|low] [courier|cast]
SCENE_PORT=4892 E2E_PORT=4891 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch46-live.ts [high|low] L1,L3,L7,L9
# A/B: build b0aac03dd elsewhere, then add VQA_OUT=test-results/batch46-vqa/base SCENE_DIST=<that>/dist
npm run scene -- docs/reports/batch46-vqa/bbq-dad-scene.json --tier low --backend webgpu
```
