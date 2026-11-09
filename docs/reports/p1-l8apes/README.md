# L8 healthy habitats and monkey readability

The calm zoo population stays in its enclosures. Seven healthy monkeys occupy the fenced, lit yard behind the Primate House, with individual walking/resting, grooming, climbing and bounded noise-scatter routines. They have no escort or survivor role. The courier's public tour no longer carries a monkey parade.

The monkey derivative keeps the shipped rig and weighted semantic owners. Continuous limb thinning preserves seams; pale round ears, warm two-tone fur and a curled tail distinguish the head and silhouette. Healthy idle/walk/run, grooming and climbing actions are embedded in the asset's existing crowd slots. All high/low GLBs and the six production crowd bakes are rebuilt by `tools/assets/build-l8-monkeys.ts`.

The visual pass also repaired two delivery issues: L8's runtime layout placements now render from the same data used by collision, and zoo crowd draws bind their own atlas and pose in the existing per-object node update phase. This makes the habitat geometry and monkey presentation visible in the shipped path.

| Requirement | Current evidence |
| --- | --- |
| Every healthy zoo species remains in its enclosure before breach | [Low native audit](native-low.json), [high native audit](native-high.json): all 22 animals checked each tick of the 3,600-tick calm minute, including a controlled local-noise stimulus; no health/infection/follower-role violation. Species counts: lion 1, gorilla 1, elephant 1, zebra 4, flamingo 7, monkey 7, lioness 1. |
| Monkeys move independently | Both tiers: 3144 ticks with a mixture of moving and resting monkeys; individual continuous travel, grooming, climbing and scatter observed. Climb support rises gradually by 1.15 m and descends at the breach. |
| Breach and monkey contact route work | The real breach remains at tick 3,600. An isolated runner starts outside the east service opening, physically enters and bites the original monkey. Same-ID turn delays are 162 ticks low and 178 ticks high, within 150–210. |
| Monkey pack fight remains playable | [Mortal arena fixture](monkey-arena.json): complete in 55.57 s, zero deaths, 7 same-ID turns, 24 telegraphs and 8 thrown props. Fixture infection preparation is separate from its ordinary-input mortal fight; entrance reachability is proved separately above. |
| Model contracts and LOD budgets | [Asset validation](assets.json): 12/12 high/low variants pass, including weighted semantic owners. Healthy triangles 7,612 / 2,943 / 1,077; infected 7,644 / 2,975 / 1,074 against 8,250 / 3,160 / 1,100 limits. |
| Requested game-camera review | [Capture manifest](captures.json), [vision review](review.md): eight captures, low/high × zoom 1/1.5 × tour/yard, zero browser errors. Requests prove the new crowd deliveries were consumed. |
| Repository gate | [E30 gate](gate.json): typecheck, lint and all 107 tests in 27 files pass on implementation commit `e2d48e4d`. |

The capture uses one pooled, headless Metal WebGL2 browser, seed 1808 and the production complete-policy input through calm tick 3211. Yard views move only the paused courier/camera; animal positions and state are preserved. WebGPU remains the repository's manual validation path. Screenshot counter maxima are 126 draws / 139,850 triangles low and 139 draws / 198,578 triangles high; these are frame counters, not a cadence benchmark.

Native and browser evidence match source content hash `9d6da3afbedd430f35953435f079efca220121704135d64b73a96baa324ef229`. The capture manifest additionally records SHA-256 hashes for the six delivered monkey bakes. Evidence was generated from the implementation worktree before its commit; `e2d48e4d` contains that same source content.

The change keeps the monkey arena's original center/entry. `L8BossArenas.prepare()` changes are confined to healthy monkey setup. Arena route/ammo/finale work belongs to `p1-l8rework`. No specification changes, dependency additions, deploy or push.

Reproduce the offline and browser packet with:

```sh
MI_SLUG=p1-l8apes E2E_SERIAL=1 BASIS=/path/to/basis-encoder-2.1 sh tools/e2e-lock.sh node --import tsx tools/qa/l8-habitat-capture.ts --prepare
npm run verify -- E30
```
