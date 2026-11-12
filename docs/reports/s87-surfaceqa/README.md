# s87: ground cover and road surface QA

## Finding and fix

The PO capture at L10 (1235.57, 24.22) shows the R2–R3 asphalt lane and white markings visible through a corn tile. The tile was `decor-cure-route-corn-4813`, centered at (1241.91, 28.03); its rendered footprint is about 10.8 m wide and reached the 6 m road at the region seam. The farm decoration generator checked only the crop center against its intended roadside offset, so a wide tile could still extend over asphalt.

L10 now removes crop tiles when their full rendered footprint intersects any authored regional road, detour, or measured walking crossing. This keeps the farm on its field side and preserves the authored route. The same rule clears six other crop tiles found at route and paving intersections. The detailed remaining level findings and coordinates are recorded in [ground-cover-roads.json](ground-cover-roads.json).

## Deploy gate

`tests/nightly/content-invariants.test.ts` now checks ground-cover placements in the prepared layouts of all ten levels against road lanes and asphalt/tile paving, and verifies each adjacent D-CURE region handoff has coincident route endpoints. The check writes `test-results/ground-cover-roads.json` and is part of the existing `npm run test:nightly:remote` placement and decoration gate. A checked-in baseline ratchets known findings; new findings fail. See [the deploy gate](../../qa/deploy-gate.md).

The first sweep found 103 placement/surface pairs; removing the seven L10 corn placements reduced the current baseline to 85 findings (one additional broad-phase false positive was removed by exact segment intersection). Most remaining items are older road blood decals and Fairhaven rubble placements. The baseline retains exact placement IDs, road/surface IDs, and coordinates; those existing items remain visible backlog rather than being silently accepted as clean.

## Visual evidence and validation

I opened the PO's original screenshot at `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/reports/po-l10-cornroad.webp`: a large crop tile covers the asphalt at the region seam while lane markings show through. The requested after capture and contact sheet are still open: Scene Lab could not start the browser pool because binding `127.0.0.1:4329` failed with `EPERM`; the legacy headless path also failed because the macOS GPU guard could not launch `ps` (`EPERM`). No after image is claimed.

Checks: `npm run typecheck`, `npm run lint`, and the focused nightly ground-cover test pass. `npm test` passes all 27 files / 107 executed tests; its enforced inventory is exactly 150/150 and it completed in 170.5 s. The requested remote command (`sh tools/remote/run.sh "$PWD" -- npm test`) could not start because there is no healthy Hetzner runner; the wrapper also rejected the budget-wrapped test command for its Mac fallback. This local pass is recorded separately and is not a remote pass.

The report and code are ready for commit. The required after image/contact sheet and remote unit result remain open because of the environment failures above.

## Follow-up with unrestricted access

Commit `4d0c65fb` preserves the validated code and coordinate report. Headless Scene Lab successfully captured `test-results/s87-surfaceqa/seam-after/anchor-0.png` at `D-CURE/r2-r3-seam`. I opened it: the asphalt, crosswalk and lane markings are clear of corn. This inspector framing is not yet the requested matched HIGH zoom-1 capture. The requested remote unit run passed on runner 46.225.66.90: 27 files, 106 tests passed / one skipped, 150/150 inventory, 203.9 s against the 240 s budget.

## Regional paving continuity

The gate now samples all six L10 region handoffs at 0.05, 0.5 and 1 m on each side, with five lateral positions spanning the 6 m lane. Each of the 180 samples must belong to exactly one asphalt polygon, detecting paving gaps and overlaps independently of coincident route endpoints. The focused nightly decoration/ground-cover gate passes with these assertions.
