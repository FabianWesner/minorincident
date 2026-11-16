# s139-openchecks — investigation in progress

| Item | Verdict | Evidence path | Fix / follow-up |
| --- | --- | --- | --- |
| L4 tank sole slide | Open; isolated Brute walking control passes HIGH WebGPU | test-results/s139-openchecks/high-webgpu/foot-slide-brute-webgpu/metrics.json | Still requires L4 walking and attacking contact capture at zoom 1.5, then LOW. |
| Outside-wire standstill | Open broad claim; isolated open-breach route passes | tests/engine/l4-contact.test.ts, checkOutsideWireRouting | Added regression, folded into existing test; inspect real perimeter actors before closure. |
| WebGPU wreck grounding | Isolated HIGH sedan wreck comparison passes both backends; all-level scope open | test-results/s139-openchecks/high-webgpu/veh-wreck-compare-webgpu/; test-results/s139-openchecks/high-webgl2-wreck/ | Reviewed WebGPU shot-0001.png and WebGL2 sheet.jpg. Need level placements and LOW. |
| Stationary-infected flags | B110 LOW #763 attributed to scripted thrower cooldown; seven S136 chase flags remain open | Archived B110 observer near tick 4144; original issue captures reviewed in prior turn | B110 HIGH attack-state hull contact is plausible; obtain target/path/event evidence for all flagged IDs. |

Reviewed small sheet: [wreck-sheet.jpg](wreck-sheet.jpg). Its isolated road comparison does not prove every campaign wreck is grounded.

## Validation

Remote prescribed npm test: 27 files, 105 passed / 1 skipped, 134.8 s, complete 150-case budget. Typecheck and lint passed before the test helper consolidation. Focused HIGH WebGPU Brute and wreck scenes and HIGH WebGL2 wreck scene pass. No production code changes. Goal remains active.

## Focused controls continued

LOW WebGPU Brute pursuit and isolated wreck comparison pass. Reviewed the LOW Brute sheet and wreck shot-0001.png. HIGH WebGPU `alphas-at-the-tank` and `collision-placement-l4-perimeter` also pass their declared gates; both sheets were opened and reviewed. The tank fixture shows Alphas moving around the hull, then pursuing and attacking the courier. The perimeter fixture shows an Alpha attacking across the boundary. These sheets do not resolve sole slip quantitatively: the tank fixture is zoom 1 and its pass gates do not measure planted sole displacement; its clipping diagnostic reports 42 actor hits / 40 piercing observations. Keep the original zoom-1.5 sole question open rather than treating its green result as proof.

Raw paths: `test-results/s139-openchecks/low-webgpu/`, `test-results/s139-openchecks/l4-high/`. No browser/check process remains running after these batches.
