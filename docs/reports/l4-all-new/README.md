# L4 all new

- Scope: nine old combat figures converted; all other L4 cast retain v2 bodies. Corrected National Guard inherited from main `82b4a2664`; no duplicate build or deferrals ([census](census.json)).
- Sources: TRELLIS highs reused; one hazmat inference, **€0 paid HF credits**. Pipeline `lane/l4-all-new@6c85513`; [54 deliveries reproduce byte for byte](game-rebuild-proof.json), zero manual steps; temporary worktree removed.
- [Nine figure sheets reviewed](visual-review.json): native 120/400px, front/back, low/high WebGL2/WebGPU; exposed face/hand tones, eyes, hair, headwear and shield/baton/axe checked.
- Reviewed street/corpses, seven scripted scenes × four configurations, production breach and 80 gun views; [14 captures](capture-index.json), including [street](10-crowd-old-new.jpg), [weapons/story](12-story-plaza-war.jpg) and [breach](14-breach-old-new.jpg).
- Fixed UV gutters, crawler wrist masks/rest-pose bakes, fitted headwear and textured-variant registration. One shared authored grip/muzzle path for rifle/HMG/hunting rifle/shotgun/pistol; retained L3 neck and atlas-identity fixes.
- Own nine LOD0/1/2 caps: humanoid 6000/2500/900 tris; Alpha 8000/3000/1000; files ≤600000/250000/150000 bytes. [Actual maxima](delivery-budget.json): 7973/2981/981 tris, 436532/198072/126140 bytes; inherited Guard far anatomy 2344≤4000 tris (L1 policy).
- [Gates](gates/summary.json): validator 1262/0 errors; typecheck/lint; npm test 99 pass; smoke 7 pass/204.8s, zero warm builds/max17ms, GPU ≤13 attributes/14 varyings/8 buffers. Scene gate 43 pass/5 known/0 unexpected; L4 input finished 279s, no skips/P0/P1 (0 deaths, 0 counted assists, 4 P2 observations).
- Gameplay: all five Alpha corpse variants remain solid (radius1), courier cut verified; [16 physical-state hashes identical](gameplay-comparison.json). Authored arrival mix peak high31.6%/low28.6%, within35%.
- [Perf](performance.json): matched street draws high78→78/low77→77; triangles −12200/−11896; decoded textures +8.15MB/+3.32MB. **Perf pending** PO quiet-window low p95≤main+1ms and worst five cold loads≤PROD+10%; refresh-capped shared-host diagnostics remain separate.
- [Showcase](showcase.json): `l4-crowd-old-new.jpg`, 1343×1600, written to the requested source folder. Best: 10 crowd, 14 breach, 02 riot, 05 Alpha. Branch `lane/l4-all-new`.
