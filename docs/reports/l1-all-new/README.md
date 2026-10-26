# L1 all new — final gates in progress

- Branch `lane/l1-all-new`: skinned-prod `5e008d4a0` plus main `0009f107d`; no deploy.
- Every L1 ped, named NPC, dog coat and corgi uses v2; couriers retain main’s new tier gear. [Zero-manual builds](builds/) and [pipeline decisions](pipeline-decisions.json).
- Corgi retains the old detailed teal backpack as a rigid socket part; tongue, collar, tail, locomotion, sit, bark and [vehicle seating](gates/corgi-transport.json) reviewed.
- Native 120/400 px old/new: [peds/couriers](01-pedestrians.jpg), [clerk](02-npc.depot-clerk.jpg), [tech A](03-npc.lab-tech-a.jpg), [tech B](04-npc.lab-tech-b.jpg), [guard](05-npc.lab-guard.jpg), [firefighter](06-npc.firefighter-alive.jpg), [corgi](07-corgi.jpg), [dogs](08-dogs.jpg).
- Reviewed [PROD crowd](09-crowd-before.jpg), [v2 crowd](10-crowd-after.jpg), [depot](11-depot-scene.jpg), [lab](12-lab-scene.jpg), [firefighter scene](13-firefighter-scene.jpg) and [states/motion](14-states-and-motion.jpg); [14-capture review](visual-review.json).
- [Scene receipts](gates/scenes.json): 38 native passes; depot retains PROD’s three soft contacts, no new contacts or piercing. [Crowd](gates/crowd.json): 30/30 figures, zero GPU errors.
- Targeted checks: 135 passed; typecheck/lint/build passed. [Validator](gates/validator.json): 1262 rows, zero errors.
- [Quiet ABBA timing](performance-summary.json): all six Mac/phone comparisons pass (+1 ms limit), 24 samples, zero GPU errors/overlap; WebGPU crowd draws 339→145, decoded texture data 285.10→287.22 MiB (RGBA upper bound 289.76→332.90 MiB). [Worst of five cold loads](cold-loads/summary.json): 2.307 s vs PROD 2.326 s; both limits pass.
- [Remote unit+levels](gates/remote-unit-levels-release.json): 2774 passed, zero failures, nine existing skips. [Invariants](gates/invariants-run.json): 28 simulations + 12 native WebGPU pass. [E17](gates/e17-checks.json): 103 unit + 51 browser checks, 316 photo views and 371 turntables pass; [four unflagged WebGPU cases](gates/unflagged-webgpu.json) pass. Standalone smoke and male L1 remain pending.
- [No-skip campaign](campaign/summary.json): L1–L10 complete, no skipped steps, P0/P1 zero; seven P2 observations retained. [Initial L3 stall](gate-attempts/campaign-first.json.gz) did not recur in focused/full reruns.
