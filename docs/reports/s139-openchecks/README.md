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

## Validated Alpha contact fix

The working correction is now validated: include `alpha-strike`, `alpha-roar`, and `alpha-slam` in the existing standing footwork solve. HIGH then LOW WebGPU zoom-1.5 replays pass the unchanged 3 cm P95 gate for every Alpha. Both corrected sheets were reviewed (`tank-z15-high-slam` / `tank-z15-low-slam`). Extended the existing `alphas-at-the-tank` catalog fixture with zoom 1.5 and per-actor slip gates. Typecheck and lint pass. Prescribed remote npm test passes 27 files, 105 passed / 1 skipped, 129.0 seconds, complete 150-case collection. No statistics or corpse rules changed. Previous experiment sections describe intermediate results; this supersedes their unvalidated-source status.

## Archived S136 identity tracks

Parsed the actual `observation.enemies` rows from both archived `log-campaign.jsonl` files, matching all seven flagged IDs. Each later changes position substantially while alive: run 1b #946 30.80 m, #947 30.47 m, #943 21.13 m; run 2 #960 13.68 m, #959 8.50 m, #956 25.12 m, #958 21.23 m. Exact ticks/positions/HP are retained in `qa.json.stationaryArchiveTracks`. This rules out permanently frozen identities in these runs. It does not attribute the five-second intervals to hull attack: observation records lack attack ledger, target and path state. The 450-HP #947/#960 may be scripted Alphas but HP alone is not role proof. Their precise follow-up remains a read-only identity/role/vehicle-contact observer at the evacuation hold, retaining `apcContacts`, special timers, blocked path and target IDs rather than suppressing the flags.

## Fresh HIGH evacuation audit

Ordinary mortal real-input road run completed L9 with no skips in 216 seconds, zero issues. Raw: `test-results/playtest/s139-l9-audit-high/`. Expanded observer ran successfully: 28 evacuation-hold samples, 81 nearby-infected records, 34 with native APC contact-ledger entries. Thus hull contacts are directly observed during the hold; the fresh run emits no stationary flags. This validates the added read-only audit but cannot retroactively assign the seven original identities to an attack ledger. LOW replay and archived-interval attribution remain outstanding.

## Production wreck inventory

Loaded all ten production campaign worlds with the existing `loadLevel(level, 1)` loader and inspected assembled district placements, including level-specific overrides. Wrecked/burned or `veh.wreck` counts: L1 0, L2 1, L3 23, L4 0, L5 25, L6 1, L7 38, L8 5, L9 84, L10 344 (521 total). Full placement identities, district, asset, variant, coordinates and yaw are in `qa.json.campaignWreckInventory`. This is a renderer-independent census, not a visual grounding result. It supersedes raw-layout-only counts. Scripted destruction remains outside the at-load placement census and needs its own renderer samples. Next comparison must include campaign variants and placement supports, especially L9 raised roads and L10 streamed regions.

## Campaign crop probe limitations discovered

Generated one crop per affected level from production inventory and ran HIGH WebGPU. First batch had invalid L7–L10 lighting preset names; discarded. Corrected diagnostic batch at `test-results/s139-openchecks/campaign-wreck-high-webgpu-valid/` loads all eight scenes with zero scene-gate errors. Opened and reviewed all eight sheets. L2/L5/L7 targets are obscured by buildings, L8 is absent (Scene Lab omits its level-specific layout transform), L9 target is dark, L3/L6 sedan wrecks and L10 APC are visible. Therefore the crop batch is not grounding proof and no campaign-wide pass is claimed. Next probe must use full registered level loading with camera-only positioning and identity-checked rendered placement matrices; Scene Lab isolated crops cannot faithfully cover all layout overrides. Correct lighting presets are L6-subway, L6 (L7), L8-zoo, L9-crossing and L10-night. No new gameplay defect is established by this diagnostic batch.

LOW real-input road audit completed in 231 seconds, zero skips/issues (`test-results/playtest/s139-l9-audit-low/`). Expanded observer receipt is retained in `qa.json.l9AuditLow`. Neither fresh tier reproduced a stationary flag; original interval attribution remains unproven.

## Wreck census correction

Full-level L2 probe revealed that the prior census included every burned placement, including buildings. Corrected `qa.json.campaignWreckInventory` to require `veh.*` assets. Vehicle-only counts: L1 0, L2 0, L3 23, L4 0, L5 25, L6 1, L7 38, L8 5, L9 84, L10 238: **414 total**. The previous 521 total is invalid and superseded. L2's crop target was a burned clinic, explaining the building-only view. The full-level probe also exposed an origin-coordinate shape error (null x/z), corrected in the temporary probe before any grounding claim. No rendered grounding conclusion relies on that failed probe.
