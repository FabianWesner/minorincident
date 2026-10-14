L10-S2 game-camera review — 2026-10-14

Reviewed every required high/low × zoom 1/0.5 contact sheet for all four scenes on both WebGL2 and WebGPU (32 sheets). The catalog also executed zoom 1.5: 24/24 rows passed per backend, requested backend confirmed, zero console errors and zero missed in-view actor frames.

| Scene | Visual findings in both tiers/backends | Score |
| --- | --- | --- |
| l10-dog-coats | Brown, cream and black are distinct in both healthy and infected rows. Six actual seed-22 spawns retain a low quadruped silhouette and planted feet; the courier and the separate backpack corgi provide scale. At zoom 1 the dogs are small but their coat values remain distinct; close zoom resolves faces and ribs. | 8/10 |
| l10-dog-pounce | A cream dog runs in from the edge, with a broad flat amber arrow visible at f108/f126 before contact at f144. The warning remains conspicuous at zoom 1 and 0.5, high and low. It lies on the ground and points toward the courier. The subsequent frames show the bite/contact and a pause. | 8/10 |
| l10-dog-pack | Low dog bodies are distinct from four upright runners. Amber pounce warnings from multiple directions at f126–162 stay readable beside the existing cyan combat markers. The corgi remains visibly separate and unharmed. At the last crowded frames bodies overlap naturally, after their attack warnings have already been clear. | 8/10 |
| l10-alpha-scale | The regular Alpha has a smaller, spiny silhouette and short HP bar beside the heavy red/black Mega. Both bars remain visible at zoom 0.5; the Mega's bar clamps to the top edge when its large head/shoulder extends beyond the frame. Low LOD remains angular but preserves mass, eyes and the spine ridge. | 8/10 |

A/C/D/F/G/H must items relevant to this lane pass: threat hierarchy, attack warnings, coat variety, stable draw/feet, readable scale and the existing visual language. No P0/P1 observed in the final lane scenes. At the closest camera the Mega intentionally fills more than the frame; the visible bar now remains readable. This review covers the S2 fixtures, not the unfinished seven-region/finale vision gate.

Native M4 WebGL2 stress test: 200/100 infected including 12 dogs and 3/2 Alphas; all three infected coat batches draw real GLBs. High/low frame p95 6.6/5.2 ms, sim p95 1.1/0.9 ms, retained heap 107.43/73.24 MB, peak draws 70/51, triangles 1,178,604/219,222. Existing limits retained; no claim of physical phone-device FPS.

Initial review found a clipped Mega bar at closest zoom and a Scene Lab probe that ignored healthy pets. Both were fixed and the full backend/tier/zoom matrix re-captured. Generic pets are excluded from human crowd preloading; their NPC quadruped roots now participate in draw/feet probes.
