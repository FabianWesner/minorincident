# L9-Q2 regression report

Scope is the L9-Q2 row only. Reused the existing route/HP fixtures, LevelNineBot, level bots, campaign commit/save path and Scene Lab. No dependencies, asset edits, budget reductions or specification changes.

The revised test map is [coverage.md](coverage.md). Existing all-route runs now assert the actual post-crash owned/racked arsenal, a single explosion, unchanged crash phases, early ≤20% / late ≥80% progress and non-increasing vehicle durability. Missing start, healthy/floor firing, brake/reverse/steer, road/rough speed and continuous campaign tests were added. The campaign uses the real L1 aftermath, L6/L7/L8 survivor payloads and exact zoo APC, then commits the L9 reset using the same function as Game. L7 is driven through its direct encounter/departure system because it has no mission graph.

Three gameplay defects were found and fixed: rough terrain had no APC speed cap, armed shelter survivors retained old held-post behavior in L7, and an L1 displaced bin blocked L2 departure. Details and regression IDs are in [bugs.md](bugs.md).

## Campaign result

**Yes: seed 1 finishes L1→L9.** All nine production completion callbacks committed valid saves and advanced the unlock boundary. Total: 2,139.6 simulation seconds (35.66 minutes), one L4 death, 23 living APC passengers preserved in crash history, L10 unlocked and axe-only combat inventory. Final E31 verification repeated this same seed successfully. See [campaign-seed-1.json](campaign-seed-1.json).

## Validation

| Gate | Result |
| --- | --- |
| Typecheck / lint / fresh production build | Pass through `MI_VERIFY_REMOTE_SIM=1 E2E_PORT=33919 npm run verify -- E31`. |
| Full unit suite on Hetzner | 1,387 passed; seven platform skips. Final run reserves both existing runner slots, two workers. |
| E31 functional unit/sim/levels on Hetzner | 109 passed, including every route fixture and the continuous campaign. Final AC03 driving-fire tightening also passes the complete 12-case durability suite, with typecheck/lint repeated. |
| E31 S4 timing on Hetzner | Both pass: 200-infected p95 2.845 ms ≤4 ms; 100-infected p95 1.474 ms ≤6 ms. |
| Nearby carryover systems | All 21 L7 encounter/departure and exact L1→L2 obstruction tests pass. Existing L2 road/checkpoint tests also pass in the full unit suite. |
| Static QA support-seam guard | All 14 tests pass on Hetzner. Asset LOD and decoration-surface guards pass in the full unit suite. |
| Smoke | Six sim/unit smoke tests on Hetzner; all 31 browser smoke tests pass on the Mac. |
| L1/L2 and L4 bus ride | All 11 L1/L2 checks pass. Full 17-case ride matrix passes under native quiet-run (one worker), all tiers/backends/cadences; initial concurrent run had one failure. See `ride-quiet.json`. |
| E31 browser / native E18 performance | All 55 browser checks and all six native E18 performance cases pass. `verify -- E31` completes with exit 0. See `native-perf.json`. |
| Scene Lab | All seven scenes / 84 configurations pass, WebGL2/WebGPU × high/low × zoom 0.5/1/1.5. Twenty-eight representative sheets and both real L10 start captures inspected; see [review.md](review.md). |

Heavy runs stayed on Hetzner. Browser runs use a fresh production build, unique ports, headless Metal and shared browser reservations. Native timing uses `quiet-run`; budgets and assertions are unchanged. No multi-seed bot batteries were run.

## Known limits and run history

The broader existing `T-CONT-01S` pose assertion fails identically on the starting PropSystem and the changed one (1.753 m against 0.25 m). It is outside the E31 tagged gate; the baseline reproduction and focused checkpoint/road regressions were retained as evidence. Full historical level suites are not claimed green.

A shared-runner asset validation timeout passed on isolation (158 s), and the final full unit suite passed. An intervening unit run caught a road-reset regression in the first prop clearance change; ordering was corrected and both road/checkpoint tests pass. An initial E31 wall-clock case exceeded 4 ms during concurrent runner work; the final verify reserves both existing slots for those two timing fixtures and passes without changing their limits. A later ordered-lock check still measured 4.017 ms against 4 ms despite low host load; this Linux wall-clock variance is retained. The ordered-lock repeat on another runner (including allocator slot 1) passes both unchanged cases; native E18 gates also pass. The first concurrent ride check exceeded its unchanged 0.6 px RMS budget in one configuration; the full isolated matrix passes unchanged. Raw final counts and historical outcomes: [validation.json](validation.json).

Q3/Q4 own the complete input/photo/vision and full-route/hitch/five-cycle gates. Real-device performance and full focus/contrast checks remain explicit subchecks in [coverage.md](coverage.md). The camera review records existing close-zoom cropping, foliage occlusion and Home/minimap overlap in the real 390 px L10 opening (Q3 follow-up); this lane changes no visual assets.

## Native E18 measurements

Maxima across 15 region/zoom views per row; low tier is a 390×844 viewport with 4× CPU throttling. All original frame/sim/draw/triangle/heap/infected/chunk assertions pass.

| Backend / tier | Frame p95 ms | Sim p95 ms | Draws | Triangles | Heap MB | Chunks / infected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WebGL high | 5.9 | 1.2 | 65 | 239,946 | 159.82 | 25 / 200 |
| WebGL low | 14.3 | 2.8 | 56 | 53,016 | 115.24 | 9 / 100 |
| WebGPU high | 4.4 | 0.9 | 65 | 239,946 | 155.73 | 25 / 200 |
| WebGPU low | 9.7 | 2.5 | 56 | 53,016 | 111.91 | 9 / 100 |

The real axe-only opening passes high/low too: frame p95 5.5/4.7 ms, sim p95 0.6/0.6 ms, draws 169/162, triangles 96,789/41,265 and heap 162.92/126.76 MB. These are the existing D2/S7 gates, not the future Q4 live-route/five-cycle sweep.

## Route fixtures (seed 31)

All rows finish the authored crash/crawl with one explosion and both racks containing only `weapon.fire-axe`. Time includes the finale.

| Route | Safe HP | Risky HP | Early zero time | Late zero time |
| --- | ---: | ---: | ---: | ---: |
| road | 1000 | 970 | 150.3 s | 120.1 s |
| countryside | 1000 | 990 | 180.2 s | 127.4 s |
| dry-shortcut | 1000 | 910 | 146.2 s | 103.2 s |

Measured zero progress is 15.005–15.014% for the early fixtures and 85.004–85.013% for the late fixtures. The low-quality shortcut also completes, inside its 100-infected/9-chunk limits. Raw records: [routes.json](routes.json).
