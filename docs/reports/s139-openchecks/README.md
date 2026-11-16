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

## Confirmed tank contact regression

Fresh HIGH WebGPU replay of the existing `alphas-at-the-tank` fixture at zoom 1.5, with the existing 3 cm P95 foot-contact gate applied to all five Alphas, **fails**. Raw spec: `/private/tmp/s139-tank-contact-z15.json`; raw receipt and reviewed sheet: `test-results/s139-openchecks/tank-z15-high/metrics.json` and `sheet.jpg`. Reviewed the complete sheet. Actor alpha-2 has P95 127.1 cm / max 155 cm; its worst contact begins frame 224 during `alpha-strike`, with root fixed at [7.111, -0.102]. This is a presentation contact defect, not frozen navigation. Alpha-1 P95 117.8 cm / max 166.8 cm begins frame 324 in `alpha-strike` while moving at 0.87 m/s. Alpha-3 also exceeds the gate during the shamble-to-lurch transition (P95 5.2 cm, max 30.9 cm).

Precise follow-up: extend the existing Alpha foot-contact fixture with zoom 1.5 and planted-contact windows around stationary `alpha-strike` (frames 224 onward) and moving strike (324 onward), inspect authored soles rather than only contact anchors, then correct the special-pose foot solve in `CrowdLocomotion` / Alpha presentation. Keep charge and pounce airborne exclusions separate; do not tune simulation stats. Re-run HIGH then LOW and inspect contact close-ups. This crosses multiple special-pose/transition paths and has not yet been reduced to a small safe fix.

## Working strike correction (not committed as a fix yet)

`CrowdLocomotion` standing clips omitted `alpha-strike` and `alpha-roar`. Adding them to the existing footwork solve reduced alpha-2 P95 from 127.1 cm to 0.2 cm (max 0.6 cm) on the unchanged HIGH WebGPU zoom-1.5 replay. Raw after receipt: `test-results/s139-openchecks/tank-z15-high-after/metrics.json`; reviewed its complete sheet. Overall gate still fails: alpha-0/1/3 P95 5.3/6.8/5 cm. The two-clip source edit remains a working change pending remaining contact diagnosis, LOW replay and validation. Do not report the tank item fixed.

LOW replay of the two-clip correction matches HIGH exactly (remaining P95 5.3/6.8/5 cm); its sheet was reviewed at `test-results/s139-openchecks/tank-z15-low-after/sheet.jpg`. HIGH worst residual contacts start in `alpha-slam` for alpha-0/3/4 (348/354/408), and alpha-1 starts at strike frame 409 after a preceding special. Added `alpha-slam` to the same working standing-clip correction for the next replay; this third clip is not yet validated.
