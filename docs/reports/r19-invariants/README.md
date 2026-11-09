# r19 — invariant and nightly repair

Base: `c8d4a802`; lane: `lane/r19-invariants`. No browser, deployment or push. Heavy runs use the runner pool with local fallback disabled.

## Status

**Branch validation complete.** Full nightly passes on `c1f5e5af` in **1118.8 / 1200 seconds**, including one continuous L1→credits campaign, all 33 other nightly checks and the final performance budget. Every level records zero collision failures. Full sim is **28/28**; typecheck, lint and 106 unit cases pass (one skipped, two workers). Main integration belongs to the orchestrator; subsequent fixture and report commits stay on `lane/r19-invariants`.

## Findings and changes

| Item | Cause and correction |
| --- | --- |
| L2 actor persistence | Boarding hid firefighters before assigning their passenger ownership. Assign `passengerOf` as soon as boarding hides them, and clear it when they leave. |
| L2 escape census | Fixture queued the route cohort twice. Count one authored route and escape set; low-tier singleton batches still round individually. |
| L9 crash | Fixture predates the driving evacuation bridge. Start its geometry-only sample at the real forced approach/impact state. |
| L4 finite waves | The two-member cohort minimum stranded a final singleton forever. Preserve minimum group admission for fresh cohorts and admit the finite remainder. Count arrival generations, because pool IDs are reused. |
| L4 historical AI comparison | The monkeypatch of `793be6bd3` predates the approved L6/L9 redesigns. Remove its campaign population comparison; retain exact finite wave counts, admission, arrival and the current L5 population contract. |
| L5 rescue fixture | Authored rescue-street singles stand 4.5 m from hiding places; use the production four-metre exclusion instead of the former eight-metre assumption. |
| L5 rendering fixture | PO Q302 removed hiding-place ground rings. Assert their absence instead of dereferencing those removed objects. |
| L6 cap | The approved cap is 30 on both tiers. Filler must leave twelve hatch slots; announced breaches have priority over future unannounced entries. The initial speculative cap increase was reverted. Shelter arrivals retain resident targets; hatch probes retain courier focus, suppress hit/stagger interference and retire measured arrivals after actual contact. |
| L7 census | Pool reuse across distinct encounter groups lost ledger entries. Key the ledger by group and entity ID; rebuild those keys from saved arrivals on restore. |
| L8 service arrival | An exact shared waypoint kept separated bodies circling the north service turn; accept body-sized arrival and finish the full route before native AI takes over. |
| L7/L8/L10 expectations | Current street Alphas, the additional K9, one sustaining arrival per outlet and staggered L10 admission replace old fixture expectations. |
| Vehicles | Decorative hull checks ignored authored scale. Use the installed scaled hull; move the L4 fuel truck clear of its storefront and the L7 parked APC 25 cm clear of its barrier. |
| Recovery contact | An inactive infected retained a pre-knockdown rollback reservation. Discard contact history when an actor leaves the collision mask; recovery validates its current pose. Exact L4 tick 10970 replay is clean and the existing admission test now covers stale recovery history. |
| L4 completion bot | Collapse combat stopped the completion profile for every pursuer. Keep movement while defending, including medkit and detour legs, as the novice profile already did. Ordinary player input and gameplay remain unchanged. |
| L6 completion bot | Combat returned before retreat movement, pinning the courier at the night exit after the survivors were already out. Preserve ordinary retreat movement while defending; follower waiting and gameplay rules stay unchanged. |
| L9 crawl death | Releasing the crash input lock also stopped renewing invulnerability. A one-HP courier died at 61% of the controlled crawl, and the crash update then returned forever. Renew protection through the input-controlled crawl; the existing vehicle fixture now attempts damage every crawl tick and requires the ending. The test fails at that protection assertion when the renewal is removed in a private runner snapshot. |
| L9 handover fixture | The approved bridgehead evacuation permits visible passenger deaths and keeps Sam with the courier. Check the exact living evacuees against the native evacuation ledger, and assert Sam’s research-companion payload separately; original passenger order is not arrival order. |
| L10 objective fixture | The PO story-goal graph has 15 objectives (`farmstead`, `restricted-zone`, `research-hangar`, `delivery-corridor`) instead of the former 16 region-labelled objectives. Require the exact current sequence and retain all seven region receipts. |
| Combat ray cost | A CPU profile attributed 42% of L4 runtime to cover queries. Remove rotated-ray allocations and use four-metre static buckets; 250,000 rays match the previous result exactly. |
| Seated sweep | Split the same twenty worlds and ninety seconds of every-frame actor observation between the existing low-tier actor fixture and a high-tier worker file, with individual level receipts. Seat sampling remains once per second. |
| Rig dimensions | Seven manifest entries retained dimensions from older rigs. Record the delivered LOD0 extents; retain the existing dimension tolerances. |
| Decal atlas | Declare the existing 4×4 atlas grid and reduce the image to 1024×256, retaining the 256 px per-tile maximum. UV layout and one-draw atlas remain. |
| Building z-fighting | Inset coincident pad/floor faces and separate flag/transom/latch faces. The known-overlap baseline stays unchanged. |
| Horizon delivery | The streamed terrain builder exported raw horizon GLBs. Call the existing static packer after export; position precision is retained by that packer's horizon branch. |

## Evidence

Asset validation: **1,533 entries, zero errors**. Typecheck and lint pass. Unit validation: **106 passed, one skipped**, **174.2 s / 240 s**, using two workers. The runner input was given a private snapshot commit because the existing review-tool test requires `git rev-parse HEAD`; the runner cache otherwise has no HEAD. On branch source `da7a1fa5`, the complete sim passed **28/28** in **291.54 s**. Final nightly on `c1f5e5af` passes in **1118.8 seconds**, leaving **81.2 seconds** within the unchanged budget. The complete campaign reaches credits and validates the actual evacuation/research-companion handover and all 15 current story objectives. The recovery regression fails when the history reset is removed and passes with it restored.

An additional four-worker unit run on runner 1 hit the existing 30-second limit in L4 contact, navigation and explosion cases (103 passed, three timed out). Repeating the unchanged 107 cases with two workers passed 106 with one skipped in 178.5 seconds, within the 240-second total budget. The failure log is retained as `unit-timeout.log.gz`; the final main two-worker rerun also passed in 185.8 seconds, and the final branch source passed in 174.2 seconds.

The full L4 carryover replay now completes in 296.9 simulated seconds (zero contact failures). The L6 carryover replay completes in 199.42 seconds with zero deaths, damage or contact failures; the former bot exhausted 1,200 seconds at the night exit after every follower had already left. Both fixes change ordinary bot movement decisions. A captured-save L9→L10 replay completes both levels with zero collision failures. A separate L10 replay passes every remaining nightly L10 assertion, including save validation, seven regions, cure release, epilogue/credits and the exact revised objective sequence.

The suite remains within **150 collected cases / 45 files**. The final tier split uses 44 files and preserves all ninety-second observations.

### Continuous campaign

| Level | Simulated seconds | Deaths | Collision failures |
| --- | ---: | ---: | ---: |
| L1 | 115.07 | 0 | 0 |
| L2 | 144.12 | 0 | 0 |
| L3 | 195.35 | 0 | 0 |
| L4 | 296.90 | 3 | 0 |
| L5 | 272.22 | 1 | 0 |
| L6 | 199.42 | 0 | 0 |
| L7 | 135.47 | 0 | 0 |
| L8 | 302.45 | 2 | 0 |
| L9 | 264.23 | 0 | 0 |
| L10 | 1019.17 | 1 | 0 |

Performance p95: **2.18 ms / 4 ms** at 200 infected; **1.17 ms / 6 ms** at 100 infected. Raw receipts and exact input revisions are stored alongside this report in `nightly-budget.json`, `campaign-seed-1.json.gz`, `sim-budget.json`, `sim.json.gz` and `validation-inputs.json`. Earlier failing receipts are retained for diagnosis.

### Repaired distance assets

| Asset | LOD1 triangles / minimum IoU | LOD2 triangles / minimum IoU |
| --- | ---: | ---: |
| kit.highway-onramp | 21991 / 0.987 | 13997 / 0.978 |
| decay.body-bag | 136 / 0.931 | 60 / 0.850 |
| veg.corn-block | 1500 / 0.979 | 200 / 0.803 |
| prop.farm-scarecrow | 104 / 1.000 | 54 / 0.863 |
| prop.farm-carcass | 104 / 0.869 | 56 / 0.854 |
| prop.tree.dead | 128 / 1.000 | 54 / 0.849 |
| prop.farm-tractor | 468 / 0.943 | 300 / 0.904 |
| prop.farm-irrigator | 140 / 1.000 | 60 / 0.877 |
| prop.l10-cow-carcass | 292 / 0.934 | 57 / 0.828 |
| prop.l10-abandoned-sedan-blue | 2904 / 0.983 | 2000 / 0.970 |

Near geometry is retained. Checked-in source distance GLBs contain the authored refinements; delivery packing uses the existing optimizer. Corn uses canopy cutouts and source leaf surfaces at the far tier. No triangle cap increased.

Absolute acceptance targets in `docs/qa/level-acceptance.md`, LOD IoU 0.8, authored triangle caps and known z-fighting allowances are unchanged.
