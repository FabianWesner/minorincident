# E08 visual review

Reviewed with image-reading tools: the five original `turning-*.png` captures, the four `corgi-*.png` views, both escort-order captures, `corgi-warning.png`, the S01 concept sheet, and `compare/turning-sequence.png` / `compare/corgi-S01-front.png`. Chromium, SwiftShader WebGL2, 1600×900, DPR 1, high quality, seed 42 for turning. Simulation ticks and state are in `frames.json`.

## E08-AC16: civilian turning — PASS

| Required visual check | Result | Observation |
| --- | --- | --- |
| Lying body | PASS | The first frame has the full body horizontal on the floor, with feet, arms and head intact. |
| Veins darken during down | PASS | Purple branching marks appear on the cheek and exposed forearms in the veins frame and remain visible in later frames. |
| Eyes glow red near the end | PASS | The down/veins frames have dark eyes; the eyes frame has two clearly emissive red eyes. |
| Get-up motion | PASS | The rising frame lifts the body off the floor and the final frame stands vertically at the same body location. |
| Civilian turning, rather than an infected corpse | PASS | The cream cashier shirt, brown trousers, shoes, intact skin and lack of gore remain consistent across the sequence; only the veins and eyes change before standing. |
| Adult readability / no gore (checklist C) | PASS | The figure uses the adult survivor proportions, with no removed limbs or blood. |

All required AC16 items pass. The midpoint of the get-up is a low lift, followed by upright standing; these are the reversed E07 rigid-part collapse frames, not a new animation system. The frames are a diagnostic close-up on uncluttered ground; district composition/foliage checklist A does not apply to this isolated lifecycle probe.

## E08-AC10: corgi placeholder

`char.corgi` is at `reference` status, so the code placeholder is the authorized runtime model. The final-art S01 checklist B, including its ±10% head/body ratio criterion, is conditional on final art and is **not certified** by these captures. Required nodes, joints, socket and +X front pass the unit and runtime tests.

| Placeholder identity check | Result | Observation |
| --- | --- | --- |
| Low, long dog silhouette with upright ears | PASS | Front, back and side views show the short legs, long orange body and two upright ears. |
| S01 identity colors | PASS | Orange/cream coat, teal pack, red collar and gold tag match the S01 cues. |
| Key accessory present | PASS | The pack is attached to `packSocket` above the body. |
| Face reads in the close-up | PASS | Dark eyes/nose, cream muzzle and blaze distinguish the front from the back. |

The current box/capsule shapes remain visibly placeholder art. Re-run the complete checklist B and four-view comparison when E17 promotes a final corgi model; do not treat this review as approval of final character proportions.

## E08-AC05 / AC08: directional warning and orders — PASS

| Required UI check | Result | Observation |
| --- | --- | --- |
| Directional bark warning visible | PASS | The warning capture shows the paw marker and arrow near the screen edge; the test also checks the direction emitted from the real camera frustum. |
| Wait/follow order readable above the escort | PASS | The high-contrast circular badge switches from `Ⅱ` to `↑` over the same escort after stand interaction. |
| Badge does not cover the character | PASS | The icon sits above the head, leaving both the player and escort visible. |

No visual failures in the required current-placeholder/lifecycle checks. Final-art character review is the explicitly conditional follow-up above.
