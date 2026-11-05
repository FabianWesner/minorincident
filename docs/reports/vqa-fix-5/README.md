# vqa-fix-5 — L4–L6 findings

Six focused game fixes implemented with measured verification below. **Corgi route separation remains PARTIAL / P1 open. PO taste review remains for corpse poses, the gold silhouette treatment and the broad truck cut. This is not whole-level acceptance approval.**

Base: `f701c8dce`. Final game-source hash: `df69f53c8d7c8ce323055ebdabdecb9b606b16e954fa53c0e9d585df33106866`. Main was replaced by the orchestrator during this job; this lane stayed on its original branch and did not merge main. Capture receipts retain their actual revisions and hashes.

## Findings and changes

| vqa-2 finding | Cause and fix | Scoped result / remaining work |
|---|---|---|
| #1 L4 courier lost at zoom 1.5; bar wall | The custom palette output bypassed the old emissive contour. Apply the gold edge inside that output, scaled by camera distance. Budget six bars, retaining required riot/Alpha bars. Large bodies also overlapped her before five centres entered the 3 m foreground trigger; L4 now uses 4.5 m. | Full-size frames at both qualities, zooms and backends show a readable courier. The recorded-distance regression passes. Mandatory bars can exceed six; the recorded final maximum is 15, inspected at full size. Ordinary bar clutter is capped; mandatory special bars can still stack. **P:** judge the gold treatment and remaining mandatory-bar clutter. |
| #5 L5 corgi absent while HUD says following | Route L5 through body-clear corners with actual-footprint waypoints and short-waypoint braking. The renderer intentionally hides a courage-recovering dog, but HUD checked only entity.hidden; it now reads the companion hide state too. A later trace exposed a 51 m / 48 s crowd trap: courage-hidden pets were still collision bodies despite their follow-without-contact contract. They now leave dynamic crowd contact while retaining static navigation. | **PARTIAL / P1 route separation still open.** Final eight-cell traces: max separation 45.47 m; longest continuous sample above 10 m 9.5 s. Every sampled courage-hide state records the correct hiding HUD. Root absence, root visibility and parent visibility are checked separately from pixel occlusion. The exact low/WebGPU recipe improved from 51.06 m / 48 s above 10 m to 8.12 m / 0 s above 10 m. Other cells still take long spatial detours; see [remaining corgi diagnostic and NEXT](corgi-remaining.json). Longest non-hide invisible sample run is 0.0 s; no missing root or outside-hide invisible parent was sampled. Maximum sampled presentation-position offset from the simulated pet is 0.43 m. No multi-minute unexplained dropout was reproduced. [Failing intermediate trace](corgi-counterexample.json) and [static isolation probe](corgi-static-probe.json) retain the reason for the final contact fix. |
| #3 L5 rescue fragility; #7 L6 silent follower loss | L5 gets a 10 s regrouping window through the shared story-protection predicate, covering fatal bites/grabs as well as HP. L5/L6 attacks, grabs and losses use L7's directional cue and dry audio event. Urgent text is fully opaque immediately; expired alarms yield to discovery cues. | Native proof passes both tiers, including a lethal expired-grace control. Physical mortal guards kept Mia at 60/60 for 30 s at both qualities with zero courier deaths during the guard. Actual attack/loss captions were inspected. Later abandonment can still kill followers; this is a limited rescue window. |
| #6 L6 riot-cop ledge pin | Reuse L4's finite shield strain, front chips, recoil, break opening and contact counter in L6. HP, cohorts and population caps retain their values. | Isolated actual-MG fixture: 1.73 s at 1 m; 3.70 s at 6 m, both tiers. Real-input logs also show positive frontal shield-glance damage, break openings and recoverable cop downs. Fresh physical runs visited within 2 m of the reported ledge in 1/8 cells; longest sampled stay there 11.5 s. See the trajectory table below; unvisited cells do not qualify the exact pin point. |
| #2 L4 corpse mosaics / P1-117 | Low-quality settled bodies used far sources; recoverable downed bodies were also forced into far geometry. Keep close L4 human bodies in their normal detailed band and prepare detailed frozen sources on both tiers. | Detailed LODs are observed on both tiers. Exposed firefighter clothing is coherent rather than the earlier red/yellow/black patchwork. **P / still open:** dark folded poses remain jagged; PO must judge P1-117 on the corpse sheet. No blanket corpse-row PASS is claimed. |
| #4 L5 Metro truck fills close view | Static vehicles were omitted from placement-cut eligibility while suppressing the courier foreground. Give them placement cuts and the existing lens cut when they enclose the camera. | The physically reached final rescue / Metro handoff opens the truck foreground at zoom 0.5. The courier and rescued follower remain visible; the dog may be intentionally hiding with a matching HUD. **P:** judge the broad open foreground; the truck surface supporting figures disappears with the cut. |

[Full-size inspection notes and SHA-256 values](visual-observations.json), [L4 detector counterexample](foreground-counterexample.json), [sheet sources / crops / hashes](sheets.json), [mechanics proof](mechanics-proof.json), [guard results](guard-results.json), [observer provenance](provenance.json).

## Browser coverage

The 16 L4/L6 cells use the preceding 6bdba4b source; the final eight L5 cells use the final game-source hash above (the only later game change excludes courage-hidden pets from crowd collision): low/high × zoom 0.5/1.5 × WebGPU/WebGL2 for each level. All primary captures are unpaused. The actual fallback reports `webgl`; it is the renderer's WebGL2 backend. At most two owned headless shared-pool contexts were active, on private preview ports. No performance frame timing was collected.

| Level | Cells sampled | Driver finished level | Driver diagnostics (not waived) |
|---|---:|---:|---|
| L4 | 8 | 6/8 | enemy-frozen×8 |
| L5 | 8 | 4/8 | stuck-navigating×4; cannot-finish×1; stuck-at-ring×1 |
| L6 | 8 | 4/8 | stuck-navigating×10 |

A successful bounded cell process is not a whole-level completion claim. The tour courier uses god mode; followers remain mortal. L5 uses the logged authored hiding-place order through physical WASD/mouse, with Dale last to exercise the truck. This is not a caption-only discovery test. L6 uses fresh entry to exercise the platform route.

[Cell exits and source identities](browser-cells.json), [concise run/trace summary](browser-summary.json), [all capture metadata](browser-metrics.json.gz). Metadata is read immediately after each live JPEG and can differ by a few simulation ticks. Traces sample every 30 ticks; run durations inferred from them have 0.5 s granularity.

### L5 corgi route separation — partial / P1 open

| Cell | Max separation | Longest sampled run above 10 m | Final separation |
|---|---:|---:|---:|
| L5-webgl2-high-z0.5 | 16.52 m | 3.5 s | 2.48 m |
| L5-webgl2-high-z1.5 | 25.18 m | 3.0 s | 0.99 m |
| L5-webgl2-low-z0.5 | 14.14 m | 2.5 s | 1.18 m |
| L5-webgl2-low-z1.5 | 45.47 m | 9.5 s | 0.90 m |
| L5-webgpu-high-z0.5 | 9.83 m | 0.0 s | 0.83 m |
| L5-webgpu-high-z1.5 | 9.90 m | 0.0 s | 3.48 m |
| L5-webgpu-low-z0.5 | 7.33 m | 0.0 s | 1.51 m |
| L5-webgpu-low-z1.5 | 8.12 m | 0.0 s | 1.83 m |

The low/WebGPU improvement compares the same tour recipe, not identical recorded input streams. WebGL2 still takes a large brief detour. The trace and inspected after-peak frame are retained; that frame alone is not evidence for the 45 m peak. No threshold was relaxed to call this a pass.

### L6 reported platform location (−1.1, −28)

| Cell | Closest to reported ledge | Longest sampled stay within 2 m | Final courier x, z |
|---|---:|---:|---|
| L6-webgl2-high-z0.5 | 16.57 m | 0.0 s | 30.0, -28.0 |
| L6-webgl2-high-z1.5 | 28.08 m | 0.0 s | 264.8, 10.4 |
| L6-webgl2-low-z0.5 | 18.63 m | 0.0 s | 95.6, 14.3 |
| L6-webgl2-low-z1.5 | 28.14 m | 0.0 s | 266.6, 13.6 |
| L6-webgpu-high-z0.5 | 28.07 m | 0.0 s | 216.9, 17.6 |
| L6-webgpu-high-z1.5 | 28.16 m | 0.0 s | 273.4, 15.5 |
| L6-webgpu-low-z0.5 | 0.24 m | 11.5 s | 248.6, 18.4 |
| L6-webgpu-low-z1.5 | 28.10 m | 0.0 s | 263.8, 11.5 |

The finite shield fixture is a controlled mechanics supplement with isolated AI. The physical runs and their actual hit/trajectory records establish the observed route behavior; neither is substituted for the other.

### Small sheets

Images remain only in ignored `test-results/`, as requested. Identical ignored sheets are also copied to the main workspace for the orchestrator’s cherry-pick review ([copy hashes](sheet-copies.json)). Each sheet uses frames inspected at full size; corpse crops are recorded in the source manifest. Raw captures are removed after extraction.

- [Courier](../../../test-results/vqa-fix-5/courier.jpg)
- [Corpse detail — P](../../../test-results/vqa-fix-5/corpses.jpg)
- [Corgi status](../../../test-results/vqa-fix-5/corgi.jpg)
- [Escort feedback / guard](../../../test-results/vqa-fix-5/escort.jpg)
- [Riot-cop route](../../../test-results/vqa-fix-5/riot.jpg)
- [Truck framing — P](../../../test-results/vqa-fix-5/truck.jpg)

## Reproduce the checks

```sh
npm run build:qa
node --import tsx tools/qa/vqa-fix-5-proof.ts
node --import tsx tools/qa/vqa-fix-5-matrix.ts vf5-review L4,L5,L6
```

The matrix embeds the logged tour, unpaused captures, backend settings and two-context limit. Mortal first-rescue guards use the same run wrapper with `PLAYTEST_GOD=0` and `PLAYTEST_L5_GUARD_FIRST=1`.

## Repository validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS: 107 tests, 27 files; capped worker configuration |
| Render contract file | PASS: 14 tests, including the recorded L4 overlap distances; also included in the final default suite |
| `npm run build:qa` | PASS |
| Focused mechanics | PASS: 10 cases, low/high |
| `qa:accept` L4–L6, both tiers | Each command exited 1 after writing its level JSON: shared-index generation throws `Review L3-07 has no clause matching its exact criterion text`. Native complete policies all complete; fixtures and checkpoint replays have zero errors. |
| `npm run qa:threat` | PASS: 0 flags, all 10 levels, run alone after the browser/native/static/unit/build work. 347.0 s. |

The first overlapping default-unit attempt hit 30 s timeouts in the L4 contact and spawn-pooling tests (105 passed, 2 timed out). The final default suite ran after all owned browser/native/build work, with the repository timeout and four-worker cap unchanged; its exit is retained separately.

The acceptance commands use `--skip-browser`; the separate 24-cell real-input matrix supplies this job's browser evidence. Current native failures are L4-06 (idle first-breach living count 58, required 60) and L5-08 (follower spacing). Both are already failures at the assigned base. L6 has no current failing clause. Whole rows with incomplete evidence and historical PO findings retain their statuses. The partial shared global index was restored; criteria/checkers were not relaxed to bypass these results.

[Acceptance summary and base comparison](acceptance-summary.json), [gate exits/logs](gates/), [complete threat receipt](threat-audit.json.gz).

## Limits and open review

The brief limits game work to small, established fixes in about three working hours and permits measured open findings. The later crowd-contact fix was verified; the remaining route detour is recorded with a concrete NEXT. Required final checks were allowed to finish after that investigation window.

- **P1 open:** corgi route detours still produce large brief separation on WebGL2, despite the shorter crowd trap and corrected hiding HUD. Follow the recorded tick/position diagnostic in `corgi-remaining.json`; a further small route fix is not established within the brief’s timebox.
- **P:** inspect full courier contour at wide zoom, the dark folded corpse poses for P1-117, and the broad truck lens cut and remaining mandatory-bar clutter. The detailed corpse surface change does not close subjective pose quality.
- The mortal guard proves the first rescue can survive 30 s with nearby ordinary fire. Both longer 150 s mortal sessions later recorded two courier deaths; whole-level mortal balance is not qualified by that guard. Those guards use the earlier 315ba38c source; later game changes affect L4's foreground radius and courage-hidden pet crowd contact. The focused mechanics proof and final L5 cells use the final source. L4/L6 visuals retain their actual preceding 6bdba4b source.
- Earlier source-bound passes and the L4 foreground counterexample remain labeled by their actual hashes. The [initial corgi position diagnostic](initial-corgi-diagnostic.json) had no launch manifest or render trace; it is not an exact before/after or dropout proof.
- Visual claims apply to the SHA-bound frames listed in `visual-observations.json`; retained automatic intermediate metadata is not a whole-route pixel review.
- Render-root visibility is not a pixel-occlusion guarantee. In the inspected high-quality close L5 horde frame the courier is clear but the dog cannot be distinguished among bodies; the trace separately measures proximity and root state.
- P3 findings 8–14 remain open. The shield label overlapping the corgi HUD is visible in a final-source frame. Distance jumps, porthole/alley framing, hovering medkit and Rosa's arm pose retain their original review status.

## Commits and cleanup

Implementation is separated by finding, with QA tooling, final native receipts and this evidence report in their own commits. The private lane's fixups are consolidated after checks finish; [history record](history-rewrite.json) records byte-identical tree verification. Capture provenance is retained across the history rewrite.

Raw capture/profile directories owned by this job are removed after review; the six small sheets and committed compressed traces/metadata remain. No deployment or push was performed. Performance remains outside this job's scope.

### Consolidated commits

- `757555530` — fix(escort): protect newly rescued survivors and warn of attacks and losses
- `d9329537c` — fix(l4): broaden courier contour and declutter nearby enemy bars
- `4abbfc899` — fix(l6): reuse finite riot shield strain and contact counters
- `a2bc7a2e4` — fix(l4): retain detailed settled bodies on low quality
- `c4d939f55` — fix(view): clear static wrecks that block the courier and lens
- `db6cc4cda` — qa(vqa): trace corgi positions and escort alarms through real input
- `464148146` — fix(l5): route the corgi through body-clear corners without orbiting
- `5e4220047` — qa(vqa): refresh both-tier L4-L6 native acceptance receipts

The final documentation commit also contains this history receipt; its own SHA is intentionally not embedded in itself.
