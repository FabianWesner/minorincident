# s129 L9 evacuation and truck staging

The final HIGH WebGPU real-input matrix completes with all four living evacuees aboard within approximately 20 seconds of Defense complete: road ×2 at +15.42 s and −13.32 s, shortcut at +20.50 s. The shortcut is explicitly half a second beyond an exact 20-second threshold. All three finish L9 without deaths or objective skips. Final gameplay commit: `19b0a91e`.

## Cause and change

A read-only observer on the unchanged physical-input shortcut driver captured Okafor and Mia held in `grabbed` state near the APC after defense, while Dale/Rosa were aboard and the corgi goodbye was complete. At tick 11410, 32.05 s after defense, infected 893/903 still held them. The existing soldier rescue priority covered L7 evacuees but omitted L9. Guards now apply that same priority to infected biting active L9 evacuees.

The old z10 staging row crossed the rendered sandbag blocks and evacuation sign. Trucks now stage at (450,20), (459,20), (468,20). A tested z26 row added unnecessary walking after late discharge; z20 keeps furniture clearance and closes the retained fixture timings. The rejected experiment routing old saves to their old south truck row is absent from final code.

Zombie statistics, damage, corpse persistence and ordinary grab rules are unchanged. No teleport, actor protection, zombie removal or design fallback was added.

## Real-input evidence

| HIGH WebGPU run | Route | Last boarding relative to Defense complete | Wall time | Deaths/skips |
|---|---|---:|---:|---|
| final-road-1 | road | +15.42 s | 235 s | 0/0 |
| final-road-2 | road | −13.32 s | 232 s | 0/0 |
| final-shortcut | dry shortcut | +20.50 s | 209 s | 0/0 |

Every run uses `tools/playtest/play.ts`, normal combat, physical keyboard/mouse, HIGH, zoom1.5, WebGPU, one headless pooled browser, ports4995/4996, reservations capped at10 minutes. Each logs one authored-map navigation assist. A Node launcher preload installs read-only page telemetry; driver files are unchanged. Boarding time is the final sit-down start plus its production45-tick dwell, checked against the subsequent evacuated roster. All four remain alive and aboard. One enemy-frozen P2 diagnostic appears in the shortcut; both road runs have zero issues. These samples do not establish universal timing across all seeds/inputs.

Raw logs, traces, summaries and captures are under `test-results/s129/final-{road-1,road-2,shortcut}/` and their sibling trace JSONL files. Compact current receipts and root-cause trace samples are in [qa.json](./qa.json).

## Placement review

I inspected the final HIGH WebGPU APC-stop capture at follow zoom1.5 and the three-truck overview in [the reviewed sheet](./placement-sheet.jpg). The road between the barrier rows is clear at the stop. All three trucks stand north of the sandbags and evacuation sign, with visible gaps from the light posts, gate-side fence and bridge wall. The placement fixture positions the APC at the stop; it is separate from timing evidence. Existing vehicle-test assertions check all three rotated truck footprints against the bridgehead furniture and active obstacle colliders, plus APC-road clearance.

## Retained fixtures and checks

The six s126 native fixtures all complete with living evacuees aboard: HIGH road15.75 s, HIGH passive road0 s, LOW road17.95 s, LOW passive shortcut0 s, HIGH seed2 road14.60 s, LOW seed2 road0 s. Negative times clamp to0 in the native probe. The actual archived stalled save reaches all four aboard/full health at **19.30 s** after defense (last start444 +45 ticks, defense tick−669); its one-second census first observes completion at20.15 s. These are native fixtures, not real-input qualification.

- Typecheck and lint pass. Existing vehicle tests pass (2 tests,29.33 s); existing NPC tests pass (3 tests), including guard selection of an L9 evacuee biter before a nearer Alpha. No registered cases added.
- Exact required remote `sh tools/remote/run.sh "$PWD" -- npm test` passes on final gameplay code:105 passed/one platform skip,150-case inventory retained,129.6 s within240 s, runner46.225.66.90.
- Final focused L9 threat audit: skilled/passive complete, zero level flags. Its overall nonzero exit is solely `PARTIAL_LEVEL_SELECTION`, since this is intentionally an L9 diagnostic.
- Final vehicle campaign motion gate passes HIGH and LOW, both source-stable and with no failed tracks or correction failures. HIGH has1,302 samples; LOW also passes the full gate.

Final artifacts are this README, compact JSON below200 KB, and one small reviewed sheet. No deployment, push or main-branch move occurred.

The original observer cut actor888 to two airborne frames at its3m hull boundary, producing an unproven result. The sampler now retains approach data up to6m only for actors that enter the original3m window. Actor888 now has29 frames and five planted contacts and passes as grounded. Existing verdict thresholds and fail-unproven behavior are unchanged. The real-input driver is unchanged.

## Completion audit

The requested approximately20-second HIGH matrix, retained s126 fixtures, all-three-truck clearance, existing-test extensions, zero L9 threat flags, HIGH/LOW motion gate, typecheck/lint and final remote suite are verified. Final remote rerun includes the observer correction (105 passed/one platform skip,150-case inventory,129.6 s). The worst real-input result remains explicitly20.50 s, not an exact≤20.00 s claim. The final report is committed with compact receipts and one reviewed sheet.
