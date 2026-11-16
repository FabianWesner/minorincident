s140-wreckground fixes campaign wreck support and L4 routes through the military wire. Work stays on `lane/s140-wreckground`; nothing was pushed, deployed, or moved on main. Candidate base: `cc2f7476` (PROD batch 112).

All 414 source wrecks are accounted for. The registered campaign renders 409 at load; five L8 wrecks have minimum decay tiers 1–5 while registered L8 uses tier 0. Those five have no rendered instance. Their production asset contacts were checked natively against their authored transforms: each gap is +0.500 cm. They are explicitly distinguished from rendered matrix evidence in [qa.json](qa.json).

The native audit loads registered levels and production asset prototypes, uses `InstancedGroup.contactPoints()`, and replays the identity-checked renderer placement matrices. Ground triangles include layout layers, L9 raised roads, and L10 chunk origins. It queries support below the level paving ceiling to avoid choosing roofs. Every rendered wreck has supported contact samples. Native raw-layout gaps range from −2.921 to +1.903 cm; final rendered support gaps range from −1.401 to +4.303 cm. The native raw layout includes surfaces that runtime filters or offsets, so these two measurements are retained separately.

Full registered-level HIGH sweeps completed on both explicitly selected WebGL2 and WebGPU backends. Camera positioning brought every wreck into residence, including all 238 L10 wrecks. All 409 matrices match between backends within 1e-7; both backends return identical gaps and zero offenders (>8 cm float or >10 cm sink).

| Level | Source wrecks | Rendered audited per backend | Rendered gap range, cm |
| --- | ---: | ---: | ---: |
| L1 / L2 / L4 | 0 | 0 | — |
| L3 | 23 | 23 | 0 |
| L5 | 25 | 25 | 0 |
| L6 | 1 | 1 | 0 |
| L7 | 38 | 38 | 0 |
| L8 | 5 | 0, tier-filtered | source contacts +0.500 |
| L9 | 84 | 84 | −1.401 to +1.794 |
| L10 | 238 | 238 | 0 to +4.303 |

The baseline offenders were `D-FAIR/l7-military-1` (−15.001 cm), `l7-military-3` (−194.002 cm), and `l7-military-4` (−16.468 cm). Two causes were fixed: L7 military wreck heights sampled only the footprint center rather than an overlapping raised road terrace, and sleeping vehicle props settled against the old low-only ground field. L7 placements now use the highest overlapping road terrace; vehicle settling and diagnostics share a ceiling-bounded triangle support query. Baked placement references also retain their placement identity. The three rendered gaps are now zero.

The existing Scene Lab placement gate now checks `wreckGroundOffendersMax = 0`; missing/nonfinite support also fails. Existing render-contract and gate-tools tests cover stacked support/roof selection, exact threshold boundaries, missing support, and nonfinite values. The gate covers resident instances; full campaign identity/completeness comes from the sweep, not an empty isolated crop.

Ten worst baseline candidates and five seeded OK candidates (seed 140) were captured at HIGH, zoom 1.5, on both backends in the registered levels with camera-only positioning. All 30 images were inspected. Opposite-angle recaptures resolved an obstructed L3 roadblock view. L6 was recaptured twice per backend: its truck silhouette is visible, but night lighting still prevents confident visual judgement of wheel contact; both measured gaps are zero. No lighting or actor placement was changed for captures. The selected IDs, matrices, gaps, backend identities, local capture paths, and review notes are in `campaignCloseupPairs`, `visualRecaptures`, and `l6DetailReview` in the JSON. Raw captures remain under `test-results/s140-wreckground/` rather than being committed.

The one retained small sheet was inspected: [wreck-fix-sheet.jpg](wreck-fix-sheet.jpg). It shows the L7 truck before and after support correction.

L4 had real navigation failures: a late crawler retained its outside waypoint after collapse retired the fence registry; Alpha provocation could erase a necessary breach route; generic arrival tolerance stopped an Alpha just beyond rail attack reach; and radial snapping around a parked hull put an open-breach alignment waypoint beyond the opening. Fixes advance/release collapse routes, preserve a blocked provocation route, tighten arrival only for an assigned closed L4 breach, constrain crossing/alignment points to usable body clearance, and choose another open entrance when a hull blocks the approach. These changes affect navigation only. No infected catalog stats or corpse lifecycle were changed.

The final native seed-1 full L4 completion runs inspect every eligible real actor every tick: alive, visible, emerged, outside the perimeter, within 2 m of the wire, with an independently found route to the courier. A rolling 302-tick window flags cumulative travel below 0.1 m, strictly longer than five seconds. LOW completes in 18,025 ticks with 8,990 eligible windows and zero stationary flags. HIGH completes in 18,499 ticks with 11,130 windows and one stationary actor (#345, ticks 4253–4554). Its event ledger records six 100-HP rail hits at ticks 4253, 4313, 4373, 4433, 4493, and 4553, opening the north breach: active obstacle combat, zero navigation freezes. The existing `checkOutsideWireRouting` now includes the full LOW replay as well as the focused runner/crawler checks, and distinguishes repeated rail damage from a lost route.

Other registered fence-bearing levels were checked with three native valid-path, blocked-visibility runner approaches each: L1, L2, L3, L5, L7, L8, L9, and L10. All actors moved; maximum stationary interval was 1.083 seconds. Long detours need more than the ten-second observation window to arrive, and these are representative navigation probes rather than full campaign runs. L6 has no resident fence/wire placements. Exact samples and the L4 reproduction recipe are in the JSON.

Validation passed at source revision `cfa63fbe`: `npm run typecheck`, `npm run lint`, the extended local L4 regression (50.93 s), and the prescribed `sh tools/remote/run.sh "$PWD" -- npm test`. The complete remote suite passed 27 files / 105 tests, with one existing skipped test, in 170.2 s under the unchanged 240 s / 150-case budget. An earlier remote replay failure exposed active rail attackers being classified as idle; the regression now records obstacle damage and distinguishes combat, with no test cases removed. The JSON is below 200 KB. No checks remain running; no specs or protected reference directories were edited.

The goal is met: campaign wreck contacts pass on both backends, and the full L4 scans show no navigation standstill. The L6 visual-confidence limitation and representative scope of other-level fence probes remain documented above.
