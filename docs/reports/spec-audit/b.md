# E25–E28 acceptance audit — 2026-10-16

Audited main **8718d0fb1fbc4c46ee4eda34860955345eed2ea6** in the isolated `spec-audit-b` worktree. Main and worktree HEAD were identical at start. Decisions: `specs/po-levels-{2-6,4-9,9-10}-*.md`, the supplied 2026-10-15 PO intake, and the later decision commits identified below. `met` means the complete criterion has implementation evidence; a named test alone does not establish visual approval or unmeasured performance. `partial` includes incomplete acceptance evidence. Sizes: S ≤1 h; M ≤half a day; L larger. Every AC is listed; no staging decision is treated as cancellation.

## Verification

Exact per-epic command: `MI_VERIFY_REMOTE_SIM=1 E2E_PORT=4385 SCENE_PORT=4386 npm run verify -- E25` (then E26, E27, E28). The verifier runs typecheck/lint, a fresh locked production build, selected Vitest on Hetzner (one worker), then locked headless Mac browsers (one Playwright worker). Full unit runs separately on Hetzner with four workers. Logs and process results are in [b-evidence](b-evidence/). Quiet reservations are bounded to 19 minutes including queue time; ordinary browser lock waits are bounded to 30 minutes. No local Vitest sweep, deployment, merge, protected asset change or collision source edit.

Full Hetzner units: **1,539 passed / 7 skipped** (267 passing files), plus **4/4** focused verifier CLI tests. Final local typecheck and lint exit **0**; Playwright collection finds all four storm tests. The added native storm cases have **not executed**. Raw command output (`*.txt`), per-command checks, selected Node assertions, browser reporters and [validation summary](b-evidence/validation-summary.json) are retained.

| Epic | Exact verifier result | Fresh selected Node | Fresh browser | Native performance / closure |
|---|---|---:|---|---|
| E25 | **exit 1** | 32 passed | 42 passed, 2 failed, 3 deferred in the initial run | Window sampling and infected-eye checks fail. Later parity gate **2/2 passes** and removes one deferral. Native lighting unmeasured; supplementary run cancelled at queue cap. |
| E26 | **initial exit 1** (audit test collection error, corrected) | 31 passed | Corrected functional rerun **34/34 passes** | Native barricade stress/final full repeat unmeasured; queued repeat cancelled at queue cap. This is not attributed to a production E26 assertion failure. |
| E27 | **exit 0** | 27 passed | **41/41 passes** | Native **2/2 passes**, with the 170/81 ms maxima disclosed below. Required full current vision set remains incomplete. |
| E28 | **exit 1 after fairness termination**, not a failed perf assertion | 25 passed | **52/52 passes** | Quiet command was still waiting when stopped; L5/storm native budgets and added storm timing cases are unmeasured. No stale GPU report remains. |

**Fairness stop:** cumulative browser-slot/quiet-window waits exceeded 30 minutes. The conservative recorded lower bound is over 33 minutes (details in [fairness-stop.json](b-evidence/fairness-stop.json)); the final E28 wait alone was about ten minutes. Its pending quiet process and this job's queued E26-repeat, E25-perf and extra storm-matrix helpers were terminated. Every individual quiet attempt was bounded below 20 minutes. The additional full storm backend matrix is **unmeasured**; the completed nine-scene matrix is **108/108**, not a claim to have run that extra matrix. Native performance evidence here is headless Metal WebGL on an M4; WebGPU matrix/parity proves rendering, not WebGPU frame budgets or physical-phone performance.

**Status decision:** all four entries remain `in-progress` in `specs/status.json`. E25 has seven partial ACs; E26 two; E27 one; E28 two (and one obsolete). No epic meets the requested close condition.

## E25 — Lighting, shadows and reflections

[Acceptance text](../../../specs/epic-25-lighting-shadows-reflections.md). The remaining comparative WebGPU lighting spike and SSR are real gaps; quantitative backend pool parity is now proved. Release staging in `specs/04` §6 changes order, not scope.

| AC | Criterion | Status | Evidence on audited source | Gap / size |
|---|---|---|---|---|
| E25-AC01 | Comparative lighting/tone spike and implemented decision | partial | `test-results/epics/E25/spike.md`; `T-E25-01` in `tests/visual/e25-closure.spec.ts`; production `src/render/Lighting.ts` follows field + promoted spotlight decision. | DynamicLighting/ClusteredLighting comparative WebGPU screenshots and GPU counters explicitly deferred by `T-E25-01-GPU`. **M** |
| E25-AC02 | All exported anchors validate §6 | met | `T-E25-02/02b`, `tests/unit/render/e25-lighting.test.ts`; `tools/assets/lights.ts` validates tokens, intensity, ground intersection and emissive references against baked runtime table. | — |
| E25-AC03 | Trailer pool ≥4× ambient, fence ≤1.3× | met | `T-E25-03` pixel probes in `tests/visual/e25-closure.spec.ts`; visibility polygon regressions `T-E25-03u/03b`; `src/render/LightField.ts`. | — |
| E25-AC04 | WebGL2/WebGPU pool luminance within ±10% | met | **S fixed:** `T-E25-04` now checks the same 69,825 screen pixels on actual WebGL/WebGPU, high and low; both cases pass. High relative difference 0.0005977%; low 0.0005845%. Captures opened and numerically compared; old fixme removed. | — |
| E25-AC05 | Tier caps, ≤2 promotions/s, 0.3 s fades, ≤15% pixel jumps | met | `T-E25-05/05l` sixty-second both-tier unit walk; `T-E25-05v` real 3,600-frame pixel walk; `Lighting.setHeroLight` and `LightField.heroAt`. | — |
| E25-AC06 | Hero shadow ≥35% darker, hue 230–290° | met | `T-E25-06`, `tests/visual/e25-lighting.spec.ts`, pixel shadow and adjacent-ground masks. | — |
| E25-AC07 | Generator startup flicker and one-frame shutdown | met | `T-E25-07s/07c/07m` sim/checkpoint regressions and `T-E25-07` browser emissive, beam, reflection and field shutdown probes. | — |
| E25-AC08 | Pistol breaks lamp, sparks, darkness sight −40% | met | `T-E25-08s/08p`, `tests/sim/light-power.test.ts`; actual detection/tracking paths use darkness. | — |
| E25-AC09 | Beam ground-intersection gradient ≤25%/pixel | met | `T-E25-09` projects the real four-cone intersection and measures gradient; practical beam renderer. | — |
| E25-AC10 | Wet streaks both tiers + high SSR car overlap ≥30% | partial | `T-E25-10` wet/dry pixel ratios on high/low; `LightField` reflection splats; `T-E25-10-SSR` remains fixme. | Implement SSR and car ID-mask overlap proof; staged extras remain required. **L** |
| E25-AC11 | Camera-moving gloss highlights, matte and metal classes | met | `T-E25-11` two-angle shipped-car/bench captures; `T-E25-11s` shipped primitive semantic checks; `src/render/PaletteMaterial.ts` material-class environment shading. | — |
| E25-AC12 | Window parallax ≥4 px at 15°, powered glow | partial | `T-E25-12` measures normalized window boundary movement and on/off glow ratio; `T-E25-12s` checks all house LOD semantic channels. Fresh combined browser check fails before measurement: expected 200 front-window samples, received zero. Retained surfaces.json is stale and is not fresh evidence. | Repair/diagnose the current window-probe path, then re-establish the unchanged ≥4 px and powered/unpowered checks. **M** |
| E25-AC13 | Night player ≥3:1, infected eyes brightest | partial | Fresh `T-E25-13` fails: player/ring contrast **3.1595:1** passes, but eye samples are RGB 141/151/201, 139/149/198, 139/150/199 (red dominance −60 instead of ≥60). Opened `night-street.png`: infected bodies visibly fragmented with pale blue edges/dark gaps. | Diagnose fixture facing/pose versus production material/geometry, then re-establish eye readability at the unchanged thresholds. The screenshot alone does not establish the cause. **M** |
| E25-AC14 | light-lab/night-street E18 budgets and counters | partial | `tests/perf/e25-lighting.spec.ts`, `e25-light-lab.spec.ts`; light-field/shadow/hero counters exist. | **Unmeasured at fairness stop**: light-lab/night-street quiet frame gates. No pass inferred from draw counters or historical samples. **M** QA |
| E25-AC15 | Every light asset day/night previews and night on/off turntable | partial | `tools/blender/{render_preview,light_preview}.py` implements all-light-assets; retained `previews/coverage.json`: 91 assets, 182 renders, no missing contacts (historical source 4970fa9e); `T-E25-15` exercises production turntable night pair. | Current table has **94** assets; historical index covers **91**, missing **bld.gym, bld.pharmacy, bld.supermarket**. Regenerate/review current preview coverage (including changed older exports). **M** |
| E25-AC16 | Checklist G at seven production locations/references | partial | `T-E25-16` captures L2/L3/L4/L5/mall; trailer probes, existing review, current L6 headlamp code and PO captures. | Named lighting keyframes absent; complete current production/reference checklist, including PO-dark L6. **M** |

**PO text correction:** E25 AC16 now links the binding PO 2026-10-15 L6 headlamp/darkness design, with all three verbatim quotes from intake #31. Only its older emergency-only reference mood is superseded; the other six locations and checklist stay required. Implemented code is `Lighting.subwayDarkness/headlampOn`, E24 pickup/checkpoint logic and the existing beam. No old visual result is promoted to a new review.

## E26 — Physics props and barricades

[Acceptance text](../../../specs/epic-26-physics-props-and-barricades.md). Main has the full barricade system. Two important distinctions are the ten-seed gate and the difference between authored resets and the unflagged recovery fallback.

| AC | Criterion | Status | Evidence on audited source | Gap / size |
|---|---|---|---|---|
| E26-AC01 | Movable ss_physics mass/bounds/COM/explosion validation | met | `T-E26-01`, `tests/unit/physics-prop-contract.test.ts`; shipped GLB extraction, class bands, collider bounds ±15%, COM and explosion refs; vehicles retain the epic's explicit E09 exception. | — |
| E26-AC02 | 300 props asleep at 1 s, zero matrix uploads | met | `T-E26-02` sim and `T-E26-02-browser`; `PropSystem.postPhysics` / awake-only view uploads. | — |
| E26-AC03 | 35 kg cart push at 55% ±5%, heavy upgrade | met | `T-E26-03/03b` exercise authored cart displacement, locomotion and heavy upgrade gate. | — |
| E26-AC04 | Kick cone 6 ±0.5 m/s, momentum hit and knockdown | met | `T-E26-04`, actual kick/contact event and combat reaction in `tests/sim/barricades.test.ts`. | — |
| E26-AC05 | Upward linear blast impulse at +1 tick, radius excludes | met | `T-E26-05` and `T-E27-02b`; queued physics body impulse. | — |
| E26-AC06 | 250 wake requests ≤150/60, farthest freeze | met | `T-E26-06/06b`; `PropSystem` ranks squared distance; actual cap is lower than allowed (budgets are upper limits). | — |
| E26-AC07 | Below −5 reset home or remove by flag within 1 s | partial | `PropSystem.postPhysics` supports `reset:'spawn'/'remove'`; `T-E26-07b` proves removal. `T-E26-07` explicitly expects displaced-position recovery when reset is absent. | 22/33 production movable definitions lack reset flags and preserve displaced x/z, contrary to the literal home/remove criterion. Resolve authored contract and add home-reset regression with collision lane. **M**; forbidden collision code left untouched. |
| E26-AC08 | Dumpster nav ≤0.5 s, short detour/long attack | met | `T-E26-08`; 30-tick nav update and `BarricadeSystem.attackTarget` route ratio/reach checks. | — |
| E26-AC09 | ≥80% union coverage, 1.5 s brace, summed HP/nav pin | met | `T-E26-09/09b`; overlapping footprints do not double-count, sub-threshold interaction disabled. | — |
| E26-AC10 | Ten-runner DPS ±5%, Brute ×5, break same tick/inward | met | `T-E26-10` verifies scheduled repeated damage, multiplier, dynamic release, inward/upward velocity and immediate nav reopen. | — |
| E26-AC11 | Runner vault <0.9 m in 1.2 s, cover, excluded classes | met | `T-E26-11/11b` actual vault timing, crawler/Brute exclusion, pooled-state reset and front bullet/projectile immunity. | — |
| E26-AC12 | Board-up 2 s / 200 HP; repair 25% per 2 s | met | `T-E26-12`, movement interruption included. | — |
| E26-AC13 | Parked car 100% coverage and 2× HP | met | `T-E26-13` creates, braces and breaks a real sedan. | — |
| E26-AC14 | Complete bot braces ≥2, survives, ≥40% fewer core arrivals over ten seeds | met | `BarricadeBot` is the test API's complete policy for barricade-lab; `T-E26-14` formerly defaulted to one seed. | **S fixed, commit a1453dcb1:** remote ten-seed run passes in 5.4 s: every seed two braces, HP100, arrivals 0 vs 8 (100% reduction). |
| E26-AC15 | 60 s Node/browser push-kick-blast hash parity | met | `T-E26-15`, `T-E26-15-browser`, `src/debug/scenarios/propSequence.ts`. | — |
| E26-AC16 | W0/W5 ghost, coverage, overlay/damage and airborne break | partial | `T-E26-16-browser` build/repair/break captures; existing `barricade-ui-W0/W5` Scene Lab sequences include frames 0/90/101/116. | Fresh WebGL sheets show the progress panel clipped at the top at zoom 1 and absent at zoom 0.5, despite numeric scene gates passing. `InteractionView` projects the panel at y=2.8 without viewport clamping. Repair/review placement and readable damage states across the matrix. **M** |

**PO clarification:** E26 now quotes intake #5 and #34 verbatim and preserves their campaign requirements alongside the lab criteria. The L1 required bike route must stay open despite intentional prop nav blocking elsewhere. `PropSystem.clearGarageExit` and `tests/levels/l1-bench-exit.test.ts` implement a clearance guard, but `docs/reports/l1-bat-forecourt/README.md` says its final QA was blocked. L6 gate clarity is implemented by the PO lane (`docs/reports/l6-po.md`, commit 1d66cfd5d): one bar, highlighted crates/line, next crate marker, hint and see-through. These are campaign acceptance obligations, not reasons to delete coverage or change the bracing threshold.

## E27 — Explosions, fire and smoke

[Acceptance text](../../../specs/epic-27-explosions-fire-smoke.md). The original core report's toxic gas/extinguisher/lit smoke/landmark deferrals have since been implemented.

| AC | Criterion | Status | Evidence on audited source | Gap / size |
|---|---|---|---|---|
| E27-AC01 | All explosion/FX definitions and source refs validate | met | `T-E27-01`, `tests/unit/data/explosions.test.ts`; source enumeration covers props, throwables, scripted blasts. | — |
| E27-AC02 | Per-class damage ±2% at 0/50/100%, upward +1 tick impulse | met | `T-E27-02/02b/02c`, real `ExplosionSystem` damage, cover and queued impulses. | — |
| E27-AC03 | Seven-beat fixed-frame detectors at 0/2/6/15/40/180/900 | met | `T-E27-03` in `tests/e2e/explosions.spec.ts`; fixed-step captures plus flash/fire/ring/debris/smoke/scorch detectors; `T-E27-03p` handles jumped fixed ticks. | — |
| E27-AC04 | Five 3 m tanks, 0.15–0.3 s links, ≤8 links/s | met | `T-E27-04` sim checks five-tank chain and denser cap case. | — |
| E27-AC05 | Body ≥0.5 m rise, ≥2 detached parts, burned swap, ≥20 s smoke | met | `T-E27-05/05v`; asset/wreck regressions tagged AC05 preserve wheels/seats and disable lamps; pooled doors/hood in `src/render/vfx/Blasts.ts`. | — |
| E27-AC06 | L4 fuel-truck order, ≥80% kills/12 m, 5 s tint, gated slowmo | met | `T-E27-06` gas-station/fuel-truck variants; `T-E27-06v/06d` light-field TTL and setting; `T-E27-15` real L4 production sequence. | — |
| E27-AC07 | Flash-reduced full-screen per-frame luminance Δ ≤20% | met | `T-E27-07` exercises every blast class with pixel detector. | — |
| E27-AC08 | 6 m smoke loses targets ≤0.5 s; lasts 12 s ±1 tick | met | `T-E27-08/08v`; real target-loss events, blocked attacks, exact expiry and visible cloud. | — |
| E27-AC09 | Toxic DoT/Hazmat exclusion; tear gas −30%/−15% | met | `T-E27-09/09b`, `tests/sim/explosion-gas.test.ts`; hazard expiry clears slow. | — |
| E27-AC10 | Shot/kick extinguisher: fire radius 3 m, cone stun 1 s | met | `T-E27-10-bullet/-melee`, `tests/sim/explosion-extinguisher.test.ts`; `Hazards.spawn` creates a combat hitbox, `Combat.hit` routes real kicks through damage for this non-PropSystem entity, and the hit listener vents once. `InteractionView` maps it to the extinguisher model. No ordinary campaign placement is claimed. | — |
| E27-AC11 | Fire-lit lower smoke hue 15–45°, ≥2× upper, siren sync | met | `T-E27-11`, `tests/visual/e27-smoke.spec.ts`; background-subtracted column bands and real police beacon phase samples. | — |
| E27-AC12 | Smoke player silhouette ≥2:1, near-ray opacity ≤40% | met | `T-E27-12` image/mask/ring proof; `Blasts` shares camera/player hole for capped smoke. | — |
| E27-AC13 | L5 ≥4 visible columns above rooftops and shadow strips | met | `T-E27-13`, `tests/visual/e27-landmarks.spec.ts`; actual L5 pair-plaza, projected tops, ≥4 columns/shadow strips and puffs. | — |
| E27-AC14 | Particle/debris caps, recovery and E18 frame budgets | met | `T-E27-14` bounded lifecycle; `tests/perf/explosions.spec.ts` native high/phone budgets. | Fresh quiet native high/low tests pass: frame p95 **6.7/11.3 ms**, sim p95 **0.5/1.9 ms**, puffs **400/120**, particles **2048/512**. Maximum frames are **170.3/81.2 ms**; the p95-only test does not gate these hitches. Separate **M** hitch diagnosis remains, with no invented threshold applied to AC14. |
| E27-AC15 | Checklist H for medium/car/mega, night fire, smoke and L4 | partial | `T-E27-15` production collapse captures; `T-E27-15f` pooled embers; existing review and focused pixel tests. | Current medium/car, lit-column, smoke-player and L4 captures support H. The full required current review still lacks refreshed lab-mega and building-fire-at-night coverage. `fire-lab` is absent from the runtime fixture map, but the retained `building-fire-night` Scene Lab JSON can be reused; no new system is required. Complete the required scene set/review. **M** |

## E28 — Weather

[Acceptance text](../../../specs/epic-28-weather.md). E23/E24 dependencies are built: `T-E28-L6` tests the actual Northgate exit, and `tests/perf/l5-budgets.spec.ts` tags AC10. Earlier dependency notes do not describe current main.

| AC | Criterion | Status | Evidence on audited source | Gap / size |
|---|---|---|---|---|
| E28-AC01 | Deterministic timeline in Node/browser and campaign scripts | met | `T-E28-01/01b`, `src/data/weather.ts`; `T-E28-L6` actual underground→night/ground-fog exit; implemented L5 timeline retains ash while fog rises. | Old E23/E24 dependency note is stale; later in-level transition decision provenance is described below. |
| E28-AC02 | Rain noise ×0.8, Molotov ×0.6, grip ×0.85 | met | `T-E28-02` exercises real pistol noise, Molotov duration and Rapier wheel friction. | — |
| E28-AC03 | Wetness ≥0.8/60 s, dry half-life 90 s, streak threshold | met | `T-E28-03/03b`, real weather state and wet/dry material masks. | — |
| E28-AC04 | Positioned lightning, 40 m/0.5 s ping, delayed thunder, reduced flash | met | `T-E28-04/04b/04c`; tests include a scripted fire/blackout. | — |
| E28-AC05 | Fog sight ×0.6 and player contrast ≥3:1 | met | `T-E28-05/05b`, production perception and player/ring pixel mask. | — |
| E28-AC06 | ≥60% downwind/20 trials, gust props, smoke ±20° | met | `T-E28-06/06b/06c`; actual fire spread, Rapier prop motion and column axis. | — |
| E28-AC07 | Player/infected tracks, ≥60% roof/car accumulation, grip | met | `T-E28-07/07b`, plus stride/airborne/bridge tracking regressions in `tests/sim/weather.test.ts`. | — |
| E28-AC08 | Player replay weather selector | obsolete | PO 2026-10-10 provenance: commit **57df1c8c633f860542bd5a1b1a6bfed31a1b5d3e**, title “fix(ui): remove the player weather selector from level select, campaign and pause menus (PO 10-10); debug override kept”; `T-E28-08b/08c` now require hidden selectors/story weather. `T-E28-08` still proves debug override graph invariance. | The supplied PO addenda/intake lack the original verbatim selector quote. The spec now marks this PO 2026-10-10 change and quotes the exact commit title as a secondary record, explicitly not the original PO words. |
| E28-AC09 | Rain gain follows intensity, shorter fog/snow RT60, gust cues | met | `T-E28-09/09b`, offline audio and runtime event→cue log. | — |
| E28-AC10 | Storm and L5 ash E18/20k–6k budgets | partial | `T-E28-10` structural storm caps; `T-E23-19` is tagged `@E28-AC10` in `tests/perf/l5-budgets.spec.ts`. | **S fixed in audit:** E28 now splits timing into quiet-run and adds native storm p95 frame/sim/heap checks (high and throttled low, real GPU assertion, ≥600 samples/12 s). **Native L5/storm unmeasured at fairness stop**; new timing cases collected successfully but did not run. **M** QA remains. |
| E28-AC11 | 6 m precipitation dither and HUD state | met | `T-E28-11/11b`, actual HUD label/ray pixels; `WeatherView` shared camera-player ray. | — |
| E28-AC12 | Six weather moods pass checklist G/reference | partial | `T-E28-12-*` mood captures and `T-E28-12-wall`; `docs/reports/integrate-e26-e28.md` supersedes the original failed review with shafts/facade fixes. | Fresh six-mood captures and protected reference were opened. Clear/overcast brightness, amber shafts, dark storm, blue fog and sparse snow/tracks are distinct. Checklist G night-threat readability is **FAIL**: storm/fog/snow show fragmented dark bodies with pale edges, matching the unresolved E25 night evidence. Complete fixture/model/material diagnosis and re-review. **M** |

The later in-level weather decision is recorded in commit **52d8b0a43** and `/Users/wesner/Workspace/minorincident/epics-pipeline/backlog.md` (PO 10-10, weather changes during play). Current L1 blends to clouds, L3 haze→ash, L5 ash→fog with ash retained. It is a later PO change; the backlog is a paraphrase, not a verbatim PO quote. No weather scope is cut to make the audit green.

## Small fixes and spec corrections

- **S — E26 AC14 (a1453dcb1):** change the existing A/B test from one seed by default to an unconditional ten seeds. The same test retains two braces, survival, nonzero baseline arrivals and ≥40% reduction for every seed; no thresholds, timeouts or mechanics change. Remote final run passes all ten seeds.
- **S — E28 AC10:** retain structural storm caps and add separate native E18 frame/sim/heap tests, with real-GPU identity, ≥600 frames over ≥12 s and low 4× CPU throttle. Commit **01280db1b** adds only tests; typecheck/lint/collection pass. The native result is explicitly **unmeasured** after the fairness stop; AC10 is not closed.
- **S — E25 AC04 (7cd29302a):** replace the skipped parity placeholder with real renderer assertions and a common pool mask including the bright core/falloff; two cases pass (both tiers). Actual backend is asserted, with no fallback/skip. Both high-backend captures were opened and show matching fence, beams, pool and courier.
- **S — verifier timing isolation (b9b68e7c9):** E26/E28 functional browsers now exclude `@perf`; the existing timing tests run in a separate quiet reservation, with separate result files. Three remote CLI tests pass, including a forced timing exit 42 remaining red. No timing test is removed.
- **S — verifier evidence freshness (3ec6e7a00):** clear the shared browser reporter before each E25–E28 browser stage and remove stale per-stage artifacts if no fresh reporter appears. A refusal-before-Playwright test proves old functional/GPU results cannot be reused. All four focused CLI checks pass remotely.
- **Spec — E25:** replace only the outdated L6 reference mood with the quoted PO darkness/headlamp design.
- **Spec — E28:** obsolete player-facing override wording is annotated with the later PO decision record; debug graph invariance remains required. Original PO wording is unavailable in supplied sources. Historical missing-fixture/exit and absent-shaft deviations are corrected against current code and passing checks; native budgets and visual approval remain open.
- **Spec — E26:** quote the later PO campaign readability/required-route decisions alongside existing lab ACs; no collision source change.
- New Scene Lab catalog scene: `tests/scenes/catalog/spec-audit-b-light-lab.json`, game camera, trailer/fence/pool/beam/courier. Existing barricade, weather, FX and PO campaign scenes are reused for the matrix.

## Captures and performance

Fresh E27 images opened: tick 6 has bright yellow/white noisy spheres, tick 40 an expanded dissolving orange volume and ground ring; the night column has bright orange lower puffs and cool dark upper puffs; the smoke grenade leaves the courier clearly visible through ordered dither. Pixel checks pass: lower smoke hue **23.57°**, lower/top luminance **14.02×**. These do not complete the current lab-mega/night-building review set; retained Scene Lab JSON can be reused for that work.

Fresh E25 captures opened: the trailer has four glowing heads and tapered beams; the pool terminates at the fence. The current house capture shows warm windows and dark inset panes, but its automated front-window geometry probe fails, so no parallax pass is claimed. L5 pair-plaza is strongly veiled in red/purple haze with visible orange fires and grey round smoke puffs; it does not earn an automatic lighting checklist pass. Night-street keeps the courier clear, while the three infected show fragmented dark bodies/pale edges and fail red-eye dominance. Both backend matrices now pass **54/54** cases each (**108/108**, zero console errors), including actual-backend and actual-tier checks: high/low × zoom 0.5/1/1.5, nine scenes. Opened representative sheets from both backends and both tiers; the numerical pass does not approve the clipped barricade UI. Historical reports above are implementation provenance, not fresh audit pass claims. Both actual backends, high/low, zoom 1/0.5 are required; the standard matrix additionally includes zoom 1.5. No frame result measured during shared GPU activity will be called an E18 pass.

### E28 checklist G and mood review

Opened all six fresh `E28-mood-*.png` captures and `initial-drafts/weather-and-time-of-day-moods.png` without editing the reference. Clear has bright neutral paving and short shadows; overcast is dimmer with softer shadows; haze is amber with long violet shadows and diagonal shafts. Storm has dense cool streaks, warm window/lamp pools and wet streaks. Fog retains cool dark ground, warm spill and a bright courier. Snow adds sparse flakes, roof/car coating and visible footprints; the ground stays considerably darker than the reference's snowy street. The sparse fixture does not claim the reference's town dressing density.

| G item | Review | Evidence |
|---|---|---|
| Must: glowing sources cast visible spill | PASS | Night windows and lamp have distinct warm floor pools in storm/fog/snow. |
| Must: geometry occlusion and hero shadows | PASS | Fresh facade-spill `T-E28-12-wall`, E25 fence/hero-shadow probes and dark building shadows; no parity inference from scene names. |
| Must: coloured, appropriate shadows | PASS | Purple/blue shadows soften in overcast and lengthen in haze. |
| Must: night player and threats readable | **FAIL / unresolved** | Courier is clear and the fog numeric contrast passes, but the infected in storm/fog/snow have fragmented dark bodies/pale edges. The current images do not establish clean threat readability comparable to the reference; investigate fixture facing/pose versus rendering. |
| Should: atmosphere without washing out | PASS | Warm haze shafts and cool rain/fog are distinct; the courier remains visible. |
| Should: appropriate reflections | PASS | Wet ground carries warm streaks below sources; car/glass differ from matte dry paving. Streaks are stylized and regular. |
| Should: script/weather mood | PASS | All six states are identifiable, with the snow darkness/coarse tracks retained as appearance limitations. |

**Overall FAIL:** 3/4 must and 3/3 should; AC12 remains partial. Screenshot-generation assertions passing do not override this review. This supersedes the historical integration review for this audited source, without asserting the underlying cause.

### Native E27 performance

Exact E27 verifier exits **0**: Node **27/27**, functional browser **41/41**, native perf **2/2**, headless Chrome / ANGLE Metal / Apple M4. Quiet preflight recorded load below 3, no other headless browser/local Vitest, all browser locks held. High/low frame p95 is **6.7/11.3 ms** and sim p95 **0.5/1.9 ms**, within unchanged 16.7/33.4 and 4/6 ms gates. However maxima are **170.3/81.2 ms**, around 1.97 s after the blast; these are raw retained samples, not discarded warm-up. No hard maximum is asserted by this E27 test, so a green verifier does not close this player-visible hitch. The similar timing in the old core report does not prove the same cause. **M** diagnosis, no source fix attempted.

### Matrix observations

| Scene / source | Inspected appearance | Acceptance implication |
|---|---|---|
| `barricade-ui-W0/W5`, both backends/tiers | Dashed slot ghost, orange bench/brace overlay and released bench are visible. The progress panel is cut by the top edge at zoom 1 and offscreen at 0.5. | AC16 remains partial; numeric catalog gates do not test panel bounds or prove subtle damage cracks. |
| `qa-l6-po-headlamp`, WebGL high / WebGPU low | Warm facing cone lights the floor, surroundings remain grey/dark, cap lens glows, isolated warm pools remain. | Supports the implemented PO #31 design; no new light system was introduced. |
| `qa-l6-po-gate`, both backends, zoom 0.5 | Courier remains visible by the cyan target line; raised rails and HUD/group panels remain. The generic projected interaction panel needs the viewport fix above. | Do not treat the existing generic lab pass as full PO #34 campaign readability approval. |
| `l1-bat-forecourt-bench`, WebGL high | Open picket-fence gap, courier and corgi, bicycle beyond the opening; no bench closes the visible gap. | Visual support for the clearance guard; not a fresh ordinary-input escape test. |
| `weather-fog/haze`, both tiers/backends | Fog gives cool dark ground and a very bright courier fill; haze is amber with long violet shadows and diagonal shafts. Warm windows and the red car remain distinct. | Both matrix moods reviewed; the separate six-mood review above fails night-threat readability. |
| `fx-fire-smoke` | Short blurred orange bursts fade; bench/bin remain. | This legacy generic effect scene does **not** establish persistent E27 building fire at night. |
| `spec-audit-b-light-lab` | Bright ground pool, sharp occlusion wedge and readable courier; close zoom crops the trailer/fence. Original wide photo capture retains the full fence/pool proof. | Numeric same-mask parity is measured separately at the same wide photo spot, not inferred from these crops. |

## Remaining work — ranked by player impact

All items below are **M/L**; no implementation of them was started. QA-only items identify missing evidence rather than an assumed production failure.

1. **M — E25 AC13 / E28 AC12, night threats:** diagnose fixture facing/pose versus material/geometry. The current night eye check fails and storm/fog/snow threats have fragmented dark bodies/pale edges. Restore/prove clean threat readability and repeat the unchanged pixel/checklist requirements.
2. **M — E27 hitch:** diagnose the **170.3 ms high / 81.2 ms low** frames about two seconds after the blast; retain the passing p95 evidence and these maxima. Cause and baseline attribution are not established.
3. **M — E26 AC16 / PO #34, interaction UI:** keep the coverage/brace panel inside the viewport at zoom 1/0.5, then check W0/W5 and the L6 gate on both tiers/backends, including damage and break states. The current projection has no panel-size/viewport clamping.
4. **M — E26 AC07, fallen-prop contract:** resolve the 22 unflagged movable definitions' displaced-position recovery against the literal home/remove criterion; add the home-reset/real-placement regression with the collision owner. Preserve required bike-route access; collision code was excluded from this lane.
5. **M — E25 AC12, parallax proof:** diagnose zero front-window samples, distinguish fixture/power-index/geometry issues, and re-establish ≥4 px parallax plus powered/unpowered glow without weakening the original assertions.
6. **M — reserved QA:** run E25 light-lab/night-street, E26 barricade stress and E28 L5/storm native gates, including the new fully wet storm tests; complete the extra storm backend/quality/zoom matrix. These were left unmeasured under the binding queue limit; do not assume E18 passes.
7. **M — E25 AC16, full lighting approval:** complete all seven current production/reference comparisons, including PO-dark L6. Restore the named missing lighting keyframes or obtain an explicit PO replacement; other reference requirements were preserved.
8. **M — E27 AC15, full current vision set:** refresh/review lab mega and building fire at night alongside current medium/car/smoke/L4 evidence. Reuse the retained Scene Lab fixtures; a new system is unnecessary.
9. **M — E25 AC15, preview inventory:** regenerate/review coverage for all **94** current light-bearing assets; the retained 91-asset index omits `bld.gym`, `bld.pharmacy`, `bld.supermarket` and is tied to historical source.
10. **M — E25 AC01, lighting comparison:** add comparative WebGPU DynamicLighting/ClusteredLighting GPU counters and screenshots to the existing candid source-inspection/tone report.
11. **L — E25 AC10, SSR:** implement the staged high-tier reflected-car silhouette and ≥30% ID-mask overlap proof while preserving cheap reflections on both tiers.

Documentation limitation: the original verbatim PO 10-10 selector/live-weather requests were not present in the supplied primary sources. The spec quotes the exact decision commit title as a secondary record and identifies the backlog paraphrase; neither is represented as the PO's original words.
