# L6 visual/browser review — 2026-11-08

**L6: 14 PASS, 0 failing rows, 0 incomplete rows. Performance admission and E24 verification are still running.** This is L6 acceptance closure, not a campaign UAT GO: the generated global report retains independent failures and unmeasured coverage. No push or deployment.

## Fixes

- `447ea39d` — `CrowdPosePalette` read an absent outgoing palette while interpolating a fractional current frame with blend weight1. Multiplication by zero still produced NaN body bounds, dropping a visible follower's health bar. Both pose paths now skip the unused outgoing palette.
- `c33e20b5` — `HealthBars` discarded compact follower pips when their projected positions overlapped the courier. They now move above the courier, following the existing full-bar placement rule. A living follower1.28m in front reproduced the omission in8/8 matrix cells; after the fix all8 draw.
- `4874fa1b` — both regressions extend existing test families. They were demonstrated red before/green after; the registered suite remains150 cases/45 files. Focused files:15 tests PASS.

## Fresh evidence and review

Final game source SHA256: `b37cc44168c6fe41f416dc7f4af0dbaf63cb8cb1fe019ae8678bc0458d35af4c`. The product source is unchanged after the two rendering fixes.

All eight **low/high × WebGL2/WebGPU × zoom1/1.5** cells use1280×720 headless browser captures from this worktree. I personally opened36 labeled review sheets:8 shelter/headlamp/ending overviews,8 gate overviews,8 native readability comparisons,4 native actor/body/eye crop sheets, and8 follower sheets. These cover64 presentation frames,48 gate frames,16 native readability scenes,48 native mask/crop frames, and232 follower frames. Four additional full-size original ending/overlap frames were opened. [Capture review](capture-review.json) records every opened sheet/original SHA256 and maps each sheet to original captures, crop coordinates, and hashes. The original readability pass retains112 lossless captures and16 raw ledgers.

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
|14 readability |16 shelter/tunnel cells: conservative contrast8.463–11.380≥3:1; eye luminance0.231878–0.26156 exceeds full-coverage non-eye body0.046423–0.047263; restored native repeat changes0 body pixels. |

### Observer corrections and exclusions

The side-entry observer formerly required nominal track floor height0.6m, rejecting actor101 on actual rail support0.87m. It now compares against production ground support. All12 bodies reach tracks; canonical simulation hashes still match. No gameplay or specification criterion changed.

Readability uses linear-sRGB, `(bodyP90+0.05)/(backgroundMedian+0.05)`, plus the existing0.02 diagnostic. The white body mask requires RGB≥240 for full coverage. Mixed antialias edges contain warm camp-floor light; including that background as “body” yielded a false eye-brightness failure. Eye separation and native repeats are checked explicitly. This is an observer correction; the infected brightness was not changed. [Analysis](readability-analysis.json) and [raw ledgers](readability) retain the measurements.

The inherited render sweep's later bar/night setup reactivated already-lost actors and could show stale dead geometry. That diagnostic tail is excluded. Only its fresh shelter/headlamp prefix qualifies; independent `bars-final` and `clean-exit-final` fixtures provide follower and ending evidence. Earlier captures made before the final fixes do not qualify current presentation.

## Qualification and reproduction

[Measured clauses](acceptance-fixtures.json) archive native/browser inputs under [evidence](evidence). `l6-visual-publish.py` checks complete matrices, current source, original hashes, native values and personal capture review before emitting nine measured clauses per tier. The acceptance adapter binds publisher/source/browser/evidence/review hashes. Six tampered adapter inputs are rejected; publisher rejects missing follower/cell/stale source and emits FAIL for contrast2.99. [Adapter negative checks](adapter-negative-checks.json), [publisher negative checks](publisher-negative-checks.json).

`npm run qa:accept -- --level L6 --skip-browser --reuse` reports **0 fresh failing rows,0 incomplete rows**. Exit1 is from independent global failures; this is not an all-global pass. The14 exact full-row reviews are under `docs/qa/reviews/L6-*.json`; [L6 report](../fix51-verify/L6.json) retains numeric clauses and fixture policy boundaries.

Capture tools accept `L6_VISUAL_BACKEND=webgl2|webgpu`, `L6_VISUAL_ZOOM=1|1.5`, `L6_VISUAL_OUT=<directory>`. `L6_VISUAL_SAVE_DIR=test-results/fix67-b/l6-handover` supplies the carried saves. Run via `sh tools/e2e-lock.sh node --import tsx ...`, with private `SCENE_PORT`4876/4877. Use `sweep-b-l6-render.ts` for the shelter/lamp prefix, `fix67-b-northgate.ts` for clean ending, `sweep-b-l6-readability.ts` for each tier/spot62, and `l6-visual-bars.ts`/`l6-visual-gates.ts` for the full matrix. Then run `python3 tools/qa/l6-visual-analyze.py`, `python3 tools/qa/l6-visual-sheets.py`; personally open fresh output before creating a new capture review, publishing, or writing reviews.

## Validation and real-clock performance

Typecheck and lint PASS. Focused regression files15 tests PASS. Final `npm run verify -- E24` remains queued through the shared CPU runner; results will be recorded here when terminal.

A native Mac WebGPU preview run is waiting through `tools/perf/quiet-run.sh` with both admission timeouts1200s (20-minute cap), private preview port4879. The wrapper requires load<3, stricter than the requested<4, and excludes other test/build/headless work. The prepared probe uses ordinary mortal gameplay, normal RAF, physical WASD/LMB,60s per tier, CPU profiles, frame/system costs, material builds and long tasks. The inherited load≈21 hitches are diagnostic only. No fresh performance claim is made before quiet admission and terminal measurement.
