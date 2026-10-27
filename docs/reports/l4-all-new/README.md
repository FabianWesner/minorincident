# L4 all new

- Scope: nine combat figures ([census](census.json)); all other L4 cast carry over from v2. Corrected National Guard awaits L3 on main; no duplicate build or deferred combat figure.
- Sources: reused TRELLIS highs; one hazmat inference, **€0 paid HF credits**. Pipeline `lane/l4-all-new@6c85513`; [54 files reproduce byte for byte](game-rebuild-proof.json), zero manual build steps; temporary worktree removed.
- [Nine reviewed figure sheets](visual-review.json): native 120/400px, front/back, low/high, WebGL2/WebGPU; face/hand skin, eyes, hair, headwear and shield/baton/axe checked.
- Reviewed [30-figure street](10-crowd-old-new.jpg), [all corpse looks and courier cut](11-corpses-old-new.jpg), [plaza/war](12-story-plaza-war.jpg), [tank/cellar](13-story-tank-cellar.jpg), [production breach](14-breach-old-new.jpg); 14 captures total.
- Fixed UV gutters, anatomical crawler hand masks/rest-pose bakes, landmark-fitted headwear, production textured-variant registration, and real weapons at palm sockets (shared gun implementation being reconciled with L3).
- Own nine LOD0/1/2 limits: humanoid 6000/2500/900 tris; Alpha 8000/3000/1000; each high/low file ≤600000/250000/150000 bytes. [Actual maxima](delivery-budget.json): 7973/2981/981 tris, 436532/198072/126140 bytes.
- Gates so far: validator 1262 entries/0 errors; typecheck/lint; npm test 97 pass; smoke 7 pass/187.5s, freeze guard clean, compiled GPU ≤13 attributes/8 buffers. Scene gate 43 pass/5 known, zero unexpected; real-input L4 finished in 281s, no skips/P0/P1 (1 death, 1 physical navigation assist, 2 P2 observations). Guard-integrated checks pending.
- Gameplay: five Alpha corpse variants remain solid (radius 1); courier see-through verified. Authored arrival mix peak share high 31.6%, low 28.6% (limit 35%); behavior unchanged.
- [Perf](performance.json): matched crowd draws high 78→78/low 77→77, triangles reduced; decoded texture increase high 8.15MB/low 3.32MB. **Perf pending** for PO quiet-window p95≤main+1ms and worst five cold loads≤PROD+10% (Mac busy).
- [Showcase](showcase.json) written; refresh after Guard integration: `l4-crowd-old-new.jpg` ≤1600px; best sources 10 (crowd), 14 (breach), 02 (riot), 05 (Alpha). Branch `lane/l4-all-new`; no deploy.
