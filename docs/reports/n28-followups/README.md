# N28 follow-ups

- Metro and cane: **6/6** high/low zoom rows pass with **clipping 0**, body overlap 0 and collision failures/pending 0 ([receipts](evidence/matrix.json), [sheet](evidence/metro-wide.jpg)).
- L5 difficulty: tuning tables/timers are unchanged; the queue retains its front slot and corgi lane. Arrival/shutter/completion ticks remain **306/486/666** across all [41 before/after samples](evidence/metro-timing.json); [source hashes and placement changes](evidence/sources.json).
- Lens: **12/12 WebGPU** rows and **4/4 WebGL2** controls pass with zero pixels outside the exact placement mask; **4/4 injected cuts are rejected**. The original 226-pixel compositor residue has zero surface cuts ([proof](evidence/lens-proof.json), [review](evidence/visual-review.json)).
- Checks: `npm test` **104/104**, no new cases (144 budgeted); smoke **passed**; `scene:gate` **48/48**; typecheck, lint and `verify E23` pass. Code commits: `7af355e4f`, `f2d96e9e5`, `a5a96c23b` ([checks](checks/summary.json)).
