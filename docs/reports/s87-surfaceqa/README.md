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

## HIGH zoom-1 capture sweep

[Contact sheet](surface-contact-sheet.jpg) contains the opened PO before image and 60 fresh headless captures: 53 unique remaining placements and the seven fixed L10 crop positions. [Capture index](capture-index.json) retains coordinates, requested HIGH quality, and camera state for each image. The L2/L3 rows show blood/scorch and rubble near entrances, pavements and roads; L7 shows debris beside the ruined city lanes. The seven L10 rows show clear asphalt or verges at the removed crop positions, including the R2–R3 seam. I opened the complete sheet and an individual L2 capture. L5 rows have black world geometry and are explicitly **unqualified**; they must be retaken before this evidence can close the task. Historical before images for the six other cleared crop tiles also remain open.

## Runtime road exclusion

`DistrictWorld` now clears the full AABB footprint of every crop, vegetation/grass patch, decal, rubble field and parking/plaza tile placement from authored road lanes before decay, collision and pushable assembly. Owned colliders and building records are removed with the visual placement. The independent nightly intersection observer reports **zero road intersections** across all ten prepared levels; 26 intersections against broader paving polygons remain in [the current report](current-ground-cover-roads.json). These include non-road pavement and entrance surfaces and remain ratcheted for review. The old 85-finding JSON is retained as the pre-filter audit and capture-location source.

The opened contact sheet now pairs the previous HIGH zoom-1 captures with a fresh 60-image run after runtime road exclusion. Visible road blood patches in L2/L3 and road rubble in L7 disappear while surrounding structures remain. The L5 black-geometry captures remain unqualified. The sheet labels “before” and “after” refer to this runtime filter; both runs already include the earlier seven-crop fix, whose original before evidence is the supplied PO image only.

Validation of the runtime filter: typecheck, lint and the focused nightly observer pass. The requested remote unit command passed on 94.130.181.173: 27 files, 106 passed / one skipped, 228.1 s within the 240 s budget.

## L5 capture correction

The black L5 captures retained the mission cellar post-process mask while the fixture teleported onto the street. The capture helper now completes the cellar-exit objective before taking street photos. All 13 L5 locations were retaken at HIGH zoom 1; [the index](l5-capture-index.json) records their coordinates. I opened the first corrected image: the rubble at (-36,20.6) is visible beside a tiled plaza edge and bench, clear of a marked road lane. The sheet now uses these valid L5 after images and keeps the invalid before images explicitly labelled. The remaining 26 paving findings are non-road plaza/entrance/pavement intersections: the independent full-lane observer finds zero road overlaps, and each remaining coordinate now has a rendered capture. Historical before proof for L5 fixes and six earlier L10 crop removals remains open.
