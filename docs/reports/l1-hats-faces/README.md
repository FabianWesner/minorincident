# Q-187–190: candidate 795896ad9 versus PROD 0009f107d

- Q-187/188: hats fit bare brow/skull ≤1.15×, clear eyes/glasses, stay level when infected, and use smooth LOD0 hats; the hair LOD regression was ours and is fixed by limiting that override to hats.
- Q-189: PROD iris landmarks projected onto retained faces; fragment skin tint is smooth; [72-case gate](gates/hat-eye.json) passes with 144 game-camera views, both eyes 100% visible, infected eye peak 99.23% of suit reference.
- Q-190: authored PROD head/helmet retained with a fitted dark neck join; matched L2 [front](matched/05-l2-firefighter-front.jpg) exposes the face and [back](matched/06-l2-firefighter-back.jpg) shows the red shell/yellow bars without an orange face.
- Seed 1, equal actors/ticks/camera: L1 [start](matched/01-l1-start-glasses.jpg) sun hat seated on hair, glasses exposed; [lamp post](matched/02-l1-lamp-hoodie.jpg) hoodie/beanie clears eyes; [crossing](matched/03-l1-crossing-elderly.jpg) elderly hat clears glasses.
- Infected comparisons: actual L1 [street pair](matched/04-l1-infected-pair.jpg), tick 451; controlled Scene Lab [headwear pair](matched/07-infected-headwear-probe.jpg), tick 240, shows upright hats and readable red eyes; [capture receipts](matched/captures.json).
- Checks: [unflagged WebGPU smoke](gates/webgpu-smoke.json) 4/4; render/accessory tests 708/708; [assets](gates/asset-validation.json) 1,262 rows/zero errors; [E17 verification](gates/e17.json) green (106 unit, 52 browser, 371 turntables); final invariants and remote unit+levels pending.
- [Campaign bot](gates/playtest.json): WebGPU low, seed 1, female, zoom 1.5, fresh L1→L3→L4 handover, no skipped levels, zero deaths/P0/P1; one recorded L2 assist.
- Q-191 apron back remains deferred P3. No deployment.
