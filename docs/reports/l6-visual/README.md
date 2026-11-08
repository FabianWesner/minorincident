# L6 visual/browser review — 2026-11-08

**L6: 14 PASS, 0 failing rows, 0 incomplete rows after all three fixes. The final E24 gate passed. Performance remains open: the valid low-tier minute has five frames over100ms; the high-tier minute has none.** This is L6 acceptance closure, not a campaign UAT GO: the generated global report retains independent failures and unmeasured coverage. No push or deployment.

## Fixes

- `447ea39d` — `CrowdPosePalette` read an absent outgoing palette while interpolating a fractional current frame with blend weight1. Multiplication by zero still produced NaN body bounds, dropping a visible follower's health bar. Both pose paths now skip the unused outgoing palette.
- `c33e20b5` — `HealthBars` discarded compact follower pips when their projected positions overlapped the courier. They now move above the courier, following the existing full-bar placement rule. A living follower1.28m in front reproduced the omission in8/8 matrix cells; after the fix all8 draw.
- `4874fa1b` — both regressions extend existing test families. They were demonstrated red before/green after; the registered suite remains within the150-case/45-file budget. Focused files:15 tests PASS.

- `3d213be3` — separate instanced infected headwear did not receive the body’s underground highlight limit. A complete actor mask measured headwear0.3022 versus eyes0.2616. Headwear now inherits the existing rule per instance; healthy civilians retain their original shading. The same fixture measures non-eye0.0473 versus eyes0.2319; the existing headwear contract is red before/green after.

### Headwear counterexample

Native actor crops enlarged8× for inspection; luminance values come from the original lossless PNGs, not these resized illustrations.

| Before: headwear0.3022 > eyes0.2616 | After: non-eye0.0473 < eyes0.2319 |
|---|---|
| ![Bright headwear before the fix](eye-before-crop.png) | ![Existing infected shading applied to headwear](eye-after-crop.png) |

## Fresh evidence and review

Final game source SHA256: `b4a871065668926e305cab6da2ee36990a9a49e1783fe17bb86e8686d1273711`. The complete source-bound matrix and native ledgers below were regenerated after all three fixes.

All eight **low/high × WebGL2/WebGPU × zoom1/1.5** cells use1280×720 headless browser captures from this worktree. I personally opened36 labeled review sheets:8 shelter/headlamp/ending overviews,8 gate overviews,8 native readability comparisons,4 native actor/body/eye crop sheets, and8 follower sheets. These cover64 presentation frames,48 gate frames,16 native readability scenes,48 native mask/crop frames, and232 follower frames. Nineteen additional full-size original ending/overlap/tunnel frames were opened. [Capture review](capture-review.json) records every opened sheet/original SHA256 and maps each sheet to original captures, crop coordinates, and hashes. The original readability pass retains112 lossless captures and16 raw ledgers.

The review is explicit about fixtures: shelter uses an actual carried mortal L5 save; the headlamp is collected by ordinary directional approach without E. Gate controls use physical keyboard E and pointer clicks after staging the original cohort. Ending pictures stage healthy original survivors beyond the exit immediately after skip commands, then let the production controller close Northgate and run its actual cinematic/result. Follower visibility moves one original identity at a time to unobstructed floor, retaining the29-person roster and its original health/injury. These presentation fixtures do not establish a full physical route or difficulty. Ordinary mortal completion and evade-only ledgers supply those numeric outcomes.

| Rows | Fresh result |
|---|---|
|01 shelter |24+5 carried identities, fullHP, active sit/talk/treat/rest/share, five snapshots over4s; seated/lying guns visually stowed. Stored appearance rifle data is retained, not interpreted as a visible gun. |
|02 headlamp | Position(1.5,-2) unchanged through120 idle ticks;45 ordinary approach ticks collect without E; no new weapon IDs. Movement+X/aim-X gives head yawπ and beam(-1,≈0). |
|03 first breach |33.2s; bangs2s before;8 actual shelter-floor arrivals. |
|04 second breach |+21.0167s;10 arrivals from2 accesses; power off/emergency on at the same tick3253. Native fixtures check first-of15s/3 bitten abandon. |
|05 combat |100% bounded-path reachable share in complete/stationary ledgers; complete11.4195 player windups/min; passive first attacks2.0833s/9.0833s after captions. |
|06 side entries |12/12 admitted bodies reach real track supports,2 each from6 alternating side accesses; bounded-path success≥99%. |
|07 retreat |Current native receipts pass actual player/group attack rate≥4/min, competent damage≥30HP, concurrent cap low30/high60. |
|08 followers |All29 original identities in each tier, including injured, settle at2.1995157–2.19999994m/s.232/232 original PNGs show each pip, minimum54 cyan pixels; overlap8/8 fixed. |
|09 gates |Three2.2m chokes; each holds9.8167s against5 actual runners; movement/sight blocked. Refuses offsets−1.99/0/1.8/2m, allows2.01m. Fixed ring/prompt visible until actual E/click closes. |
|10 markers |Fixed gate/platform anchors; unchanged through3 courier positions and native marker trajectory. |
|11 covering |Both tiers ordinary mortal complete18/29=62.069%; evade-only1/29=3.448%. |
|12 Northgate |Open gate drawn passable; actual Rapier crossing6m when open,1.79494m before collision when closed, at actual4.62m courier height. End shot frames gate/courier with exact “Night. Still alive.” caption. Controlled29out+0lost=29in; ordinary18+11=29. |
|13 fists |Current native ordinary fists-only route completes with only fists/kick offered or used. |
|14 readability |16 shelter/tunnel cells: conservative contrast8.463–11.380≥3:1; eye luminance0.231878 in all16 cells exceeds full-coverage non-eye body0.046423–0.047263; restored native repeat changes0 body pixels. |

### Observer corrections and exclusions

The side-entry observer formerly required nominal track floor height0.6m, rejecting actor101 on actual rail support0.87m. It now compares against production ground support. All12 bodies reach tracks; canonical simulation hashes still match. No gameplay or specification criterion changed.

Readability uses linear-sRGB, `(bodyP90+0.05)/(backgroundMedian+0.05)`, plus the existing0.02 diagnostic. The complete actor mask includes separately instanced hair/headwear and forces a white mask output independent of instance tint. The inherited mask omitted this draw; an initial full-white threshold therefore missed the brightly lit headwear. This was caught by full-size pixel inspection and the preliminary PASS was withdrawn. The corrected before fixture measures0.3022 non-eye versus0.2616 eyes; applying the body’s existing underground shading limit to infected headwear corrects the product cause. Mixed antialias floor edges are excluded by full coverage. [Before](eye-before-fullmask.json), [after](eye-after-fullmask.json), [matrix analysis](readability-analysis.json).

The inherited render sweep's later bar/night setup reactivated already-lost actors and could show stale dead geometry. That diagnostic tail is excluded. Only its fresh shelter/headlamp prefix qualifies; independent `bars-final` and `clean-exit-final` fixtures provide follower and ending evidence. Earlier captures made before the final fixes do not qualify current presentation.

## Qualification and reproduction

[Measured clauses](acceptance-fixtures.json) archive native/browser inputs under [evidence](evidence). `l6-visual-publish.py` checks complete matrices, current source, original hashes, native values and personal capture review before emitting nine measured clauses per tier. The acceptance adapter binds publisher/source/browser/evidence/review hashes. Six tampered adapter inputs are rejected; publisher rejects missing follower/cell/headwear/stale source and emits FAIL for contrast2.99. Analyzer and mask-producer digests are checked explicitly. [Adapter negative checks](adapter-negative-checks.json), [publisher negative checks](publisher-negative-checks.json).

`npm run qa:accept -- --level L6 --skip-browser --reuse` reports **0 fresh failing rows,0 incomplete rows**. Exit1 is from independent global failures; this is not an all-global pass. The14 exact full-row reviews are under `docs/qa/reviews/L6-*.json`; [L6 report](../fix51-verify/L6.json) retains numeric clauses and fixture policy boundaries.

Capture tools accept `L6_VISUAL_BACKEND=webgl2|webgpu`, `L6_VISUAL_ZOOM=1|1.5`, `L6_VISUAL_OUT=<directory>`. `L6_VISUAL_SAVE_DIR=test-results/fix67-b/l6-handover` supplies the carried saves. Run via `sh tools/e2e-lock.sh node --import tsx ...`, with private `SCENE_PORT`4876/4877. Use `L6_VISUAL_PREFIX_ONLY=1` with `sweep-b-l6-render.ts` for the shelter/lamp prefix, `fix67-b-northgate.ts` for clean ending, `sweep-b-l6-readability.ts` for each tier/spot62, and `l6-visual-bars.ts`/`l6-visual-gates.ts` for the full matrix. Then run `python3 tools/qa/l6-visual-analyze.py`, `python3 tools/qa/l6-visual-sheets.py`; personally open fresh output before creating a new capture review, publishing, or writing reviews.

## Validation and real-clock performance

Focused regression files15 tests PASS; the extended headwear contract is red before/green after. `VITEST_MAX_WORKERS=2 npm run verify -- E24` passed against the frozen evidence: typecheck13.357s, lint9.398s, all107 default unit tests/27 files45.480s including collection;150 registered cases/43 files stay within budget. The final measurement-observer change also passed typecheck and lint. [Validation](validation.json). Remote attempts were excluded: a queued file manifest predated newly created tooling; the refreshed remote copy had no Git HEAD and a simulation test exceeded its30s timeout. The final local gate is terminal and passed.

The final-source native Mac WebGPU preview probe completed through `tools/perf/quiet-run.sh`, private port4879, after admission within the20-minute cap. Admission required load<3 and no competing test/build/headless work. Both minutes used the existing ordinary mortal complete bot, normal RAF input processing, time scale1, no actor repositioning, god mode off, no deaths, and active gameplay throughout. Native adapter: Metal3, fallback false.

| Tier | Real elapsed | Frames | Maximum | Frames>100ms | Admission load1 | Highest sampled load1 |
|---|---:|---:|---:|---:|---:|---:|
| Low |60007.9ms|3547|350ms|5|2.864|3.848|
| High |60031.6ms|3598|50ms|0|3.563|4.319|

Low gaps occur at elapsed415.2,648.5,33413.9,33613.9,37980.4ms, lasting350,183.3,116.7,116.7,150ms respectively. Main-thread CPU samples are predominantly idle during every gap; there are no matching long tasks or node-builder notifications. Two gaps coincide with resource/transcoder requests. This does **not** prove a streaming, GPU or host cause; attribution and a demonstrated correction remain outstanding. Recorded node-builder `ms:0` values are not total compiler durations. The initial observer omitted requests begun before the timing window, so in-flight completions are not covered there. High admission was below4, but its sampled host load subsequently reached4.319; low remained below4 throughout.

[Performance analysis](performance/analysis.json), [raw minute receipts](performance/receipt.json.gz), [low CPU profile](performance/low.cpuprofile.json.gz), [high CPU profile](performance/high.cpuprofile.json.gz). The inherited load≈21 hitches are diagnostic only. The earlier pre-headwear attempt failed before timing and supplies no qualifying minute. A subsequent Chrome trace exceeded the JavaScript string limit while saving; the probe now streams compressed trace output and retains all resource timings. Diagnostic trace work is still in progress. **This is a measured low-tier performance failure, not “perf pending” due to lack of quiet admission.**
