# Campaign continuity

**Decision: hold for E20 simulation fixes.** Implementation and requested visual/browser/performance gates pass; the broader `verify E20` gate fails. No tests or budgets were loosened. No deployment or merge to main.

Merged `lane/campaign-continuity` into `lane/continuity` from main `baf1fb5a`, then merged main `4970fa9e` (E24). Final `git merge main` was already up to date.

## Landed

- L2 burned Medical Annex twin, forecourt rubble/glass/scorch, and outbreak-house blood/belongings. Corrected stale IDs to annex `822`, house `bld.house-a:405`, door `30`, gate x≈5. The old x≈23 house was unrelated.
- Optional `CampaignSave.world.L1` captures moved E26 props, dumpsters, closed gates, up to 12 civilian bodies, and parked bicycle; L2 restores them outside current script keep-outs. Old saves load without a record.
- Preserved main’s L1 route, L2 truck route, escape checkpoints, E26 props and E28 weather. Lighting/VFX and L6 source remain main’s.
- Reused main’s assets/loaders/clearance. Baked missing rubble compound collision as a placement opt-in so ordinary L5 rubble retains main’s behavior. Fitted the heaps beside the annex slab, clear of doors, gate and lamp bases.
- Fixed existing station bench floor height/divider intersection and seated-character height. Strengthened the overlap unit gate to include carryovers and station benches.
- Browser helpers consume projected clicks before camera follow; L1 uses L5’s unobstructed ground-click selection. Original assertions, routes and time limits remain.
- Corrected E20 AC15’s blanket generic-W1 destruction prohibition to allow the explicitly requested local L1 aftermath; generic W1 counts/bans remain enforced.

## Dropped

Branch rubble generator/exports/physics: main already owns the integrated asset. Duplicate renderer variant helpers and station-opening code: superseded by main. Old keep-outs and placement IDs: superseded by current routes. Lingering smoke emitter/helper edits: excluded by the lighting/VFX boundary.

## Evidence and gates

Inspected [before/after game cameras](continuity/comparison.jpg), near/far views and all burned-annex LODs. The intact bright annex becomes sooted, with damaged doors/awning, charred planting and two debris heaps; access stays clear. Blood follows the actual outbreak-house gate, with belongings outside. Roof damage remains recognizable across LODs.

Green: typecheck, lint, build; **445 unit + 2 continuity simulations**; **31/31 levels browser tests**; smoke **6 simulation + 26 browser checks**; annex asset validation; Scene Lab **12/12**, zero static overlaps/console errors and no new exclusions.

Exclusive headless Chrome/Metal comparison: high p95 **8.9→8.6 ms**, draws **278→276**, triangles **1,090,165→851,839**; phone (4× CPU) p50 **21.5→23.3 ms**, draws **222→223**, triangles **373,869→431,985**. Both pass unchanged 14/33.33 ms, 600/300-draw, 1.5M/500K-triangle and 50 ms hitch limits. [Measurements](continuity/evidence.json).

`verify E20`: **32 passed, 3 failed**; truck-clearance checks pass. Complete bot finishes 20/20, median 164.7 s. Failures:

- `T-E20-03`: newbie median deaths 3 > 1; pinned main reproduces 3. Continuity also exceeds the 240 s median (276.83 s versus main 222.08 s).
- `T-E20-12`: seed 20 has 13/60 chasing at radio, above 20%. Unresolved; the sampled main seed has 10/60.
- `T-E20-13`: seed 7 cluster has 10, below 12; pinned main reproduces a 10-member cluster on seed 20.

These prevent an all-green closeout. Raw captures and runs remain under `test-results/epics/continuity/` and `test-results/continuity/`.

## Stale worktree

Inspected `/Users/wesner/Workspace/minorincident/.claude/worktrees/agent-aade96e6f801e8b19` (`0cbf2662`). Its three uncommitted files are generated measurements: `test-results/epics/E07/crowd-feel/feet.json`, `test-results/epics/E19/provenance.json`, `test-results/epics/E19/respawn-world.json`. No implementation to retain; all three are excluded from this lane and future continuity consideration. The worktree/files remain for the orchestrator to remove.
