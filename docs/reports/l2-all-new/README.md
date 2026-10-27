# L2 all new figures

- Scope: [spawn/story census](census.json) finds 11 authored body IDs including both couriers; child + officer converted, nine v2 bodies retained. No batch-3 exclusions; [100 runtime files](coverage.json) across 18 authored/carryover identities decode with skins.
- Source pipeline `lane/l2-all-new` commits `9c870fc` / `a4c9d84`: reused child high, one officer reconstruction, plain ray bake, whole closed bodies. [HF debit €0](inference-receipt.json), included PRO quota; [12 deliveries, zero manual steps](build-integrity.json).
- [Skin correction](skin-tone-fix.md): face-led skin classes preserve per-person tones; fixed atlas cleanup erasing pupils; scripted rocket/backpack-star and POLICE marks plus brim/fringe clearance. Existing rigs, sockets, clips and uniform colours retained.
- [Visual review](visual-review.json): all 10 sheets inspected, including 64 native old/new views at 120/400px, low/high, WebGL2/WebGPU, [30-figure crowd](03-l2-crowd-old-new.jpg), six story sequences and healthy/turned/corpse motion. Tiny tailoring remains softer than old.
- L2 low/high scripted scenes: 12/12 pass; state fixtures 4/4 pass. [Real-input playthrough](gates/playthrough-summary.json) finished in 133 s, no skipped steps or issues, one death; navigation assist uses physical WASD only.
- [Gates](gates/summary.json): validator 1262 rows/0 errors; npm test 87 pass; typecheck/lint/verify E20 pass; smoke 7 pass, freeze and GPU limits pass; scene:gate exits 0 (42 pass + 6 unchanged known exceptions, no new failures).
- LOD0/1/2 limits: 6000/2500/4000 triangles, 600/250/150 kB; maxima 5507/2295/2295 triangles and 401384/189164/142524 bytes. Far LOD retains LOD1 anatomy as in L1.
- [Matched L2 resources](performance.json): draws 99→99, triangles max 238060→227332; decoded scene texture payload 287.29→288.97 MiB (+1.68), excluding driver padding.
- [Pre-correction timing](performance.json): shared native low p95 16.8→16.7 ms (refresh-capped); worst of 5 native WebGPU cold loads PROD 3.54 s→local 2.91 s (≤+10%). Final uncapped/matched-host perf pending the PO quiet window; network and browser/device caches differ.
- Showcase source updated: `img/l2-crowd-old-new.jpg` (1360×1406); best capture 03, supporting close-ups 02 then 01. Game branch `lane/l2-all-new`; source/evidence committed separately, no deploy or merge.
