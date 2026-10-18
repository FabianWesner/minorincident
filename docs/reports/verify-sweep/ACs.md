# Acceptance ledger — 2026-10-18

Source: main `c31833b2539bf74c0d5ff80402a0a13ba36d93de`. All 230 numbered ACs retained. `partial` includes missing proof; `missing` means no meaningful implementation. Browser evidence is committed historical evidence, never a fresh run in this sweep. No criterion, test, timeout or budget was relaxed.

Every row inherits its original code/test evidence from the linked 10-16 report. Paths inside that original evidence text are relative to that baseline report. Newer evidence below supersedes only the specific subcheck it measures. Fresh selected Vitest execution is indexed separately in [verification.md](verification.md); browser stages are explicitly omitted.

## E07

Criteria: [epic-07-infected-ai-and-hordes.md](../../../specs/epic-07-infected-ai-and-hordes.md); original audit: [a.md](../spec-audit/a.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E07-AC01 | met | src/data/infected.ts; InfectedSystem.spawn; T-E07-01, T-E07-01-alpha, tests/levels/L4.test.ts T-E22-12-alphas-{high,low} | — |
| E07-AC02 | met | src/sim/ai/Perception.ts: closeAwareness, hears; tests/sim/ai/navigation.test.ts T-E07-02; tests/levels/l5-po-2.test.ts PO #25 | — |
| E07-AC03 | met | src/sim/ai/NavGrid.ts; DistrictNavigation.ts; tests/sim/ai/navigation.test.ts T-E07-03/03b/03c | — |
| E07-AC04 | met | src/sim/ai/CharacterSeparation.ts; tests/sim/ai/navigation.test.ts T-E07-04 and larger-infected contact fixture | — |
| E07-AC05 | partial | src/sim/ai/InfectedSystem.ts special scheduler; tests/sim/ai/alpha.test.ts T-E07-05-scheduler/checkpoint; zoo-s1/s2/s3.test.ts; tests/scenes/alpha-s2, alpha-s3, zoo-s1…s3 | **M; browser** — Capture boundary, second activation/cooldown and restore for all 14 named moves; charge/slam still end at frame 150, gorilla pound at 100. |
| E07-AC06 | partial | src/data/infected.ts alphaDamageMultiplier; InfectedSystem.ts; AlphaSupportMoves.ts; tests/sim/ai/alpha.test.ts T-E07-06-alpha-live-*; alpha-physical/alpha-support tests; src/render/HealthBars.ts | **M; browser** — Close AC05 move captures and shared bar phone/occlusion matrix; resistance and four moves are implemented. |
| E07-AC07 | met | src/sim/ai/SpawnDirector.ts safe/visible; tests/sim/ai/director.test.ts T-E07-07/07b; navigation.test.ts T-E07-07c | — |
| E07-AC08 | met | src/sim/ai/SpawnDirector.ts queue; tests/sim/ai/director.test.ts T-E07-08/08b/08c | — |
| E07-AC09 | met | src/sim/ai/SpawnDirector.ts migrations; tests/sim/ai/director.test.ts T-E07-09 | — |
| E07-AC10 | met | src/sim/ai/InfectedSystem.ts pool/release/settle; tests/sim/ai/director.test.ts T-E07-10/10b | — |
| E07-AC11 | met | Fresh isolated Hetzner T-E07-11: 5 timing assertions passed, 0 failed; 200-infected sim p95 2.10 ms ≤4 ms (director, Alpha and physical fixtures); evidence/verification-summary.json and E07-verify.log. | — |
| E07-AC12 | met | Fresh corrected quiet T-E07-12 passes: 200 active, ≤30 crowd draws, zero non-instanced meshes, exact fixed object count, offscreen culling, retained 200 corpses, empty reset and mixed archetypes. evidence/E07-render-perf.json and E07-mixed-render.json. | — |
| E07-AC13 | partial | tests/perf/horde.spec.ts T-E07-13; src/render/CrowdView.ts; historical docs/reports/alpha-look/review.md; newer: [README.md](../ui-night/README.md), [audit.md](../merge-batch10/audit.md) | **M; browser** — Shading repaired; refresh and score horde-readability Checklist D on both tiers/backends/zooms. Generic night captures do not close this spot. |
| E07-AC14 | met | src/sim/ai/InfectedSystem.ts settle/release; src/sim/combat/Damage.ts downing/permanence; tests/sim/ai/specials.test.ts T-E07-14; tests/sim/combat/l5-shotgun.test.ts T-E23-12-kill | — |
| E07-AC15 | met | src/sim/combat/Damage.ts; tests/sim/ai/specials.test.ts T-E07-15 | — |
| E07-AC16 | met | src/sim/ai/InfectedSystem.ts animal pack/pounce; tests/sim/ai/animals.test.ts T-E07-16 | — |
| E07-AC17 | met | src/sim/ai/InfectedSystem.ts perch/cling; tests/sim/ai/animals.test.ts T-E07-17/17b/17c | — |
| E07-AC18 | met | src/sim/ai/Flock.ts; tests/sim/ai/animals.test.ts T-E07-18/18b/18c | — |
| E07-AC19 | partial | src/sim/ai/InfectedSystem.ts; AlphaSupportMoves.ts; tests/sim/ai/zoo-s1.test.ts, zoo-s2.test.ts, zoo-s3.test.ts; tests/e2e/health-bars.spec.ts; tests/scenes/zoo-s1…s3 | **M; browser** — Close all ten zoo move cooldown/restore/boundary captures and shared bar matrix (AC05). |

## E22

Criteria: [epic-22-level-4-the-safe-city-falls.md](../../../specs/epic-22-level-4-the-safe-city-falls.md); original audit: [a.md](../spec-audit/a.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E22-AC01 | met | src/levels/L4/mission.ts; T-E22-01 | — |
| E22-AC02 | met | src/data/l4.ts bots; tools/sim-runner/l4Bots.ts; tests/levels/L4.test.ts T-E22-02 | — |
| E22-AC03 | met | src/data/l4.ts bots; tests/levels/L4.test.ts T-E22-03 | — |
| E22-AC04 | partial | Mechanical T-E22-04 sim passes; LevelFourWar.playerBus/carry use authored player bus. Corrected T-E22-ride-smooth-* quiet probes keep the actual player bus on screen but measure 0.719–7.539 px RMS across all 17 configs against ≤0.6 px (evidence/E22-native-followup.log).; newer: [E22-native-followup.json](../spec-audit/evidence/E22-native-followup.json), [QA.md](../postmerge-10/QA.md) | **M; browser** — Latest corrected actual-bus smoothness rerun on 10-16 still fails 17 cases. The 10-14 17-case pass is older; postmerge-10 explicitly leaves the battery unmeasured. Re-prove/repair interpolation without loosening 0.6 px RMS. |
| E22-AC05 | met | LevelFourWar.prepare/populate; T-E22-05; tests/levels/L4-perimeter.test.ts and L4-barricade-prompts.test.ts | — |
| E22-AC06 | met | src/data/actions/catalog.ts army-mg; LevelFourWar.gunshot; tests/levels/L4.test.ts T-E22-06 | — |
| E22-AC07 | met | LevelFourWar.turn/emergeInside; tests/levels/L4.test.ts T-E22-07; L4-po-round.test.ts | — |
| E22-AC08 | met | src/data/l4.ts war/caps; LevelFourWar.armCivilians; T-E22-08 | — |
| E22-AC09 | met | src/sim/outbreak/Allies.ts; LevelFourWar.armCivilians; tests/sim/npc/l4-systems.test.ts; T-E22-09 | — |
| E22-AC10 | met | LevelFourWar.waves/flushEdges/emergeInside; src/data/l4.ts street mouths; T-E22-10 | — |
| E22-AC11 | met | LevelFourWar military/tank/helicopter; tests/levels/L4.test.ts T-E22-11 | — |
| E22-AC12 | partial | LevelFourWar.alphas; tests/levels/L4.test.ts T-E22-12-alphas-high/low and authored-gap; tests/sim/npc/l4-systems.test.ts | **M; browser** — Close inherited E07 four-move and phone/bar proof; count, line, resistance and damage mechanics remain covered. |
| E22-AC13 | met | LevelFourWar.checkLineBreak/lineBreak; tests/levels/L4-collapse.test.ts; T-E22-13-authored-gap | — |
| E22-AC14 | met | LevelFourWar.burnCars/populateCollapse; T-E22-14; E07 corpse persistence | — |
| E22-AC15 | met | LevelFourWar.descend/bar/cellarUpdate; src/data/l4.ts finale; tests/levels/L4-finale-pressure.test.ts PO17/17b; T-E22-15/15-carry | — |
| E22-AC16 | met | src/data/timeOfDay.ts; LevelFourWar smoke/collapse state; T-E22-16 | — |
| E22-AC17 | met | LevelFourWar.respawn/campCheckpoint; tests/levels/L4.test.ts T-E22-17; L4-respawn/L4-battlefield-lifecycle tests | — |
| E22-AC18 | met | Fresh T-E22-18 passed in 1.6 min: ordinary keyboard/mouse bus-to-cellar route, all photo spots/pair cameras, zero-console-error fixture. evidence/E22-verify.log; corrected cadence fixture is a separate check. | — |
| E22-AC19 | partial | Fresh T-E22-18 captures opened: E22-boot-plaza.png, E22-war-line.png, E22-tank.png, E22-collapse.png in evidence; four current pair frames also generated.; newer: [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json) | **M; browser** — Score safe/war/tank/collapse A/D/G/H pairs ≥7 with all must items; passing route photos are not the scored review. |
| E22-AC20 | partial | Quiet native high: war/collapse p95 9.3/10.0 ms, sim p95 2.3 ms; low: 29.9/34.7 ms, sim 5.2 ms. Both native tests pass their own high/low gates; draws/triangles within caps. See E22-perf-high/low.json and quiet-conditions.jsonl.; newer: [E22-native-followup.json](../spec-audit/evidence/E22-native-followup.json), [E22-perf-low.json](../spec-audit/evidence/E22-perf-low.json) | **M; browser + quiet perf** — Latest 10-16 low first-turn maximum 60.7 ms exceeds literal ≤50 ms; current test permits 80 ms low. Repeat quiet peak/beat trace after repair. Older 10-14/15 passes do not supersede it. |

## E23

Criteria: [epic-23-level-5-aftermath.md](../../../specs/epic-23-level-5-aftermath.md); original audit: [a.md](../spec-audit/a.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E23-AC01 | met | src/levels/L5/mission.ts; LevelFiveAftermath.checkAccounted; tests/levels/L5.test.ts T-E23-01 | — |
| E23-AC02 | met | src/data/l5.ts; tools/sim-runner/l5Bots.ts; T-E23-02; l5-po-2-balance.test.ts PO29 | — |
| E23-AC03 | met | tools/sim-runner/l5Bots.ts; T-E23-03; l5-po-2-balance.test.ts PO29 | — |
| E23-AC04 | met | LevelFiveAftermath.prepare/spawnStation/spawnWanderers; T-E23-04; L5-encounters.test.ts both-tier station fixtures | — |
| E23-AC05 | met | src/levels/L5/layout.ts; tests/unit/levels/l5-footprints.test.ts; tests/unit/levels/l5-static.test.ts | — |
| E23-AC06 | met | src/levels/L5/layout.ts; LevelFiveAftermath.spawnCorpses/spawnFires; tests/unit/levels/l5-static.test.ts T-E23-06 | — |
| E23-AC07 | met | LevelFiveAftermath.spawnWanderers/gunshot; T-E23-07; L5-encounters.test.ts Alpha gunfire fixture | — |
| E23-AC08 | met | LevelFiveAftermath.cues; src/data/l5.ts survivor anchors; tests/levels/l5-po-1015.test.ts; tests/e2e/levels/l5-po-2.spec.ts PO21b | — |
| E23-AC09 | met | src/sim/outbreak/Survivors.ts; src/sim/interact/Pickups.ts; src/ui/Hud.ts; src/render/HealthBars.ts; tests/levels/l5-po-2.test.ts PO26; tests/e2e/levels/l5-po-survivors.spec.ts | — |
| E23-AC10 | met | src/sim/outbreak/Outbreak.ts; Survivors.ts; tests/levels/L5.test.ts T-E23-10 | — |
| E23-AC11 | met | LevelFiveAftermath.losses/result; T-E23-11; L5-encounters.test.ts turning-during-shutter | — |
| E23-AC12 | met | src/data/actions/catalog.ts shotgun; LevelFiveAftermath.prepare; src/sim/combat/Damage.ts; tests/sim/combat/l5-shotgun.test.ts T-E23-12-kill/role/group; tests/e2e/levels/l5-shotgun.spec.ts | — |
| E23-AC13 | met | src/data/timeOfDay.ts; LevelFiveAftermath.gloom; T-E23-13 | — |
| E23-AC14 | met | src/audio/MusicDirector.ts L5 found trigger; tests/e2e/audio/l5.spec.ts T-E23-14a/14b fresh pass: −40.8 vs −14.1 LUFS, 26.7 LU contrast (evidence/E23-audio-l5-vs-war.json) | — |
| E23-AC15 | met | LevelFiveAftermath.metro/ingress/shutter/sealEntrance/result; tests/levels/L5-encounters.test.ts; T-E23-15/15b | — |
| E23-AC16 | met | LevelFiveAftermath.restore; T-E23-16/16-shotgun; L5-encounters.test.ts station checkpoint/transfer | — |
| E23-AC17 | partial | tests/e2e/levels/L5.spec.ts T-E23-17; l5-po-2.spec.ts PO21b; l5-po-survivors.spec.ts | **M; browser** — Re-prove ordinary Sam→Mia route and all five finds→shutter. Latest complete AC17 evidence remains the 10-16 failure; later partial route/exit shots do not supersede it. |
| E23-AC18 | partial | tests/e2e/levels/L5.spec.ts T-E23-18 pair captures; docs/reports/l5-district historical reviews; newer: [batch10](../atmosphere/batch10), [audit.md](../merge-batch10/audit.md) | **M; browser** — Refresh same-place plaza recognition after atmosphere changes and score all four pairs plus vulnerable five-person group ≥7. |
| E23-AC19 | partial | tests/perf/l5-budgets.spec.ts; docs/reports/postmerge-2/perf/E23-l5-high.json and low historical; newer: [perf](../postmerge-2/perf), [E18-memory-high.json](../spec-audit/evidence/E18-memory-high.json), [E18-memory-low.json](../spec-audit/evidence/E18-memory-low.json) | **M; browser + quiet perf** — Repeat peak backend/zoom proof and five warmed heap/GPU cycles ≤10%; historical retention +21.21/+26.07% remains unclosed. |

## E24

Criteria: [epic-24-level-6-the-subway.md](../../../specs/epic-24-level-6-the-subway.md); original audit: [a.md](../spec-audit/a.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E24-AC01 | met | src/levels/L6/mission.ts; tests/levels/L6.test.ts T-E24-01/zero | — |
| E24-AC02 | met | src/debug/bot/LevelSixBot.ts; tools/sim-runner/l6Bots.ts; T-E24-02 | — |
| E24-AC03 | met | LevelSixBot.ts newbie; tests/levels/L6.test.ts T-E24-03 | — |
| E24-AC04 | met | src/data/l6.ts shelter; LevelSixSubway.prepare; tests/levels/L5-encounters.test.ts both-tier identity transfer; T-E24-04 | — |
| E24-AC05 | met | LevelSixSubway.prepare; tests/levels/L6.test.ts T-E24-04; tests/levels/L6-campaign.test.ts | — |
| E24-AC06 | partial → **met** | LevelSixSubway.spawn/breach/retreat; tests/levels/l6-side-entries.test.ts PO35; T-E24-06; newer: [browser-wave3.log](../merge-batch10/evidence/browser-wave3.log), [wave3-sim.spec.ts](../../../tests/e2e/levels/wave3-sim.spec.ts) | — |
| E24-AC07 | met | LevelSixSubway.breach/abandon/power; tests/levels/L6.test.ts T-E24-06; tests/levels/l6-headlamp.test.ts PO31 | — |
| E24-AC08 | met | tools/l6/campaignRun.ts; tests/levels/L6-campaign.test.ts T-E24-08; tests/levels/L5-encounters.test.ts exact-id carry | — |
| E24-AC09 | met | LevelSixSubway.retreat; fresh T-E24-09 pause and T-E24-02 ≥60% protected rescue pass; new tests/levels/L6-protection.test.ts T-E24-09-evade passed remotely: 24/29 turned, 0 escaped, 0 player attacks, only 5 potentially rescuable. | — |
| E24-AC10 | met | LevelSixSubway.follower/retreat; T-E24-02/10 straggler ratio and position logic | — |
| E24-AC11 | met | LevelSixSubway.retreat service gates; tests/levels/L6.test.ts T-E24-11/11-siege; tests/e2e/l6-po-gate.spec.ts | — |
| E24-AC12 | met | tools/l6/build-layout.ts; public/assets/layouts/D-SUBWAY.layout.json; tests/unit/levels/l6-static.test.ts T-E24-12/seam | — |
| E24-AC13 | met | LevelSixSubway.spawn; src/sim/outbreak/Outbreak.ts; tests/levels/L6.test.ts T-E24-06/13 | — |
| E24-AC14 | partial → **met** | Mission.ts/MissionUI.ts result/Continue and night-weather test pass; fresh T-E24-17 reaches Continue but L7 composition throws “No clear pickup placement near (276, 15) in L7”.; newer: [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json), [browser-webgl2.json](../l7-entry/evidence/browser-webgl2.json), [browser-webgpu.json](../l7-entry/evidence/browser-webgpu.json) | — |
| E24-AC15 | partial | src/render/Lighting.ts / GameView.ts headlamp; tests/e2e/levels/L6.spec.ts T-E24-15; docs/reports/l6-po.md; newer: [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json), [l6-shelter-fails-readability.json](../merge-batch10/evidence/priority-final/l6-shelter-fails-readability.json) | **S; browser** — The two default high-tier pixel probes now pass after excluding health-bar raster edges. Finish the low-tier/required backend/zoom spot measurements, including high-only flashlight shadow; generic matrix visibility is not numeric 3:1/eye proof. |
| E24-AC16 | met | src/sim/missions/Mission.ts capture/restore; LevelSixSubway.restore; tests/levels/L6.test.ts T-E24-16 | — |
| E24-AC17 | partial → **met** | tests/e2e/levels/L6.spec.ts T-E24-17; docs/reports/l6-po.md open 3500-iteration real-input failure; newer: [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json), [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json) | — |
| E24-AC18 | partial | tests/e2e/levels/L6.spec.ts T-E24-18 photographs; docs/reports/l6-po.md; new cohort matrix; newer: [QA.md](../postmerge-10/QA.md), [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json) | **M; browser** — Score all seven corrected route photos A/D/G ≥7, including retreat framing; fix phone gate prompt overlap with roster/objective (still recorded in batch10). |
| E24-AC19 | partial | tests/perf/l6-budgets.spec.ts; tests/perf/l6-po-scream.spec.ts; docs/reports/l6-po.md retained-heap limitation; newer: [QA.md](../postmerge-10/QA.md), [native-final](../postmerge-10/evidence/native-final) | **M; browser + quiet perf** — Resolve AC13 low cap 30 vs AC19 ≥40 stress-population conflict explicitly; remeasure warmed retention ≤10%. Latest tunnel/breach/abandon timings pass. |

## E25

Criteria: [epic-25-lighting-shadows-reflections.md](../../../specs/epic-25-lighting-shadows-reflections.md); original audit: [b.md](../spec-audit/b.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E25-AC01 | partial | `test-results/epics/E25/spike.md`; `T-E25-01` in `tests/visual/e25-closure.spec.ts`; production `src/render/Lighting.ts` follows field + promoted spotlight decision.; newer: [e25-deferred.spec.ts](../../../tests/visual/e25-deferred.spec.ts) | **M; browser + quiet perf** — Complete comparative WebGPU DynamicLighting/ClusteredLighting screenshots and counters; T-E25-01-GPU still fixme. |
| E25-AC02 | met | `T-E25-02/02b`, `tests/unit/render/e25-lighting.test.ts`; `tools/assets/lights.ts` validates tokens, intensity, ground intersection and emissive references against baked runtime table. | — |
| E25-AC03 | met | `T-E25-03` pixel probes in `tests/visual/e25-closure.spec.ts`; visibility polygon regressions `T-E25-03u/03b`; `src/render/LightField.ts`. | — |
| E25-AC04 | met | **S fixed:** `T-E25-04` now checks the same 69,825 screen pixels on actual WebGL/WebGPU, high and low; both cases pass. High relative difference 0.0005977%; low 0.0005845%. Captures opened and numerically compared; old fixme removed. | — |
| E25-AC05 | met | `T-E25-05/05l` sixty-second both-tier unit walk; `T-E25-05v` real 3,600-frame pixel walk; `Lighting.setHeroLight` and `LightField.heroAt`. | — |
| E25-AC06 | met | `T-E25-06`, `tests/visual/e25-lighting.spec.ts`, pixel shadow and adjacent-ground masks. | — |
| E25-AC07 | met | `T-E25-07s/07c/07m` sim/checkpoint regressions and `T-E25-07` browser emissive, beam, reflection and field shutdown probes. | — |
| E25-AC08 | met | `T-E25-08s/08p`, `tests/sim/light-power.test.ts`; actual detection/tracking paths use darkness. | — |
| E25-AC09 | met | `T-E25-09` projects the real four-cone intersection and measures gradient; practical beam renderer. | — |
| E25-AC10 | partial | `T-E25-10` wet/dry pixel ratios on high/low; `LightField` reflection splats; `T-E25-10-SSR` remains fixme.; newer: [e25-deferred.spec.ts](../../../tests/visual/e25-deferred.spec.ts) | **L; browser + quiet perf** — Implement high-tier SSR reflected-car silhouette and ID overlap ≥30%; retain both-tier cheap wet streaks. |
| E25-AC11 | met | `T-E25-11` two-angle shipped-car/bench captures; `T-E25-11s` shipped primitive semantic checks; `src/render/PaletteMaterial.ts` material-class environment shading. | — |
| E25-AC12 | partial | `T-E25-12` measures normalized window boundary movement and on/off glow ratio; `T-E25-12s` checks all house LOD semantic channels. Fresh combined browser check fails before measurement: expected 200 front-window samples, received zero. Retained surfaces.json is stale and is not fresh evidence. | **M; browser** — Repair/re-prove powered/unpowered interior windows and ≥4 px back-wall parallax; latest committed acceptance probe remains red. |
| E25-AC13 | partial → **met** | Fresh `T-E25-13` fails: player/ring contrast **3.1595:1** passes, but eye samples are RGB 141/151/201, 139/149/198, 139/150/199 (red dominance −60 instead of ≥60). Opened `night-street.png`: infected bodies visibly fragmented with pale blue edges/dark gaps.; newer: [ui-night-final-playwright.json](../merge-batch10/evidence/ui-night-final-playwright.json), [browser-ui-night-final.log](../merge-batch10/evidence/browser-ui-night-final.log) | — |
| E25-AC14 | partial | `tests/perf/e25-lighting.spec.ts`, `e25-light-lab.spec.ts`; light-field/shadow/hero counters exist.; newer: [perf-light-lab-high.json](../merge-batch10/perf/final/lighting/perf-light-lab-high.json), [perf-light-lab-low.json](../merge-batch10/perf/final/lighting/perf-light-lab-low.json), [native-final.log](../merge-batch10/evidence/native-final.log) | **M; browser + quiet perf** — Native frame/light counters pass; raw uncollected light-lab heap is 775.60/571.06 MB versus E18 400/250. Close warmed/collected heap proof and reconcile the readings; stock lighting tests omit a heap assertion. Low p95 34.3 ms is diagnostic, not an additional E25 gate (low p50 passes). |
| E25-AC15 | partial | `tools/blender/{render_preview,light_preview}.py` implements all-light-assets; retained `previews/coverage.json`: 91 assets, 182 renders, no missing contacts (historical source 4970fa9e); `T-E25-15` exercises production turntable night pair. | **M; browser** — Regenerate/review current day/night Blender previews and night on/off turntable coverage; old 91-asset set omits gym, pharmacy and supermarket. |
| E25-AC16 | partial | `T-E25-16` captures L2/L3/L4/L5/mall; trailer probes, existing review, current L6 headlamp code and PO captures. | **M; browser** — Create/reference named lighting keyframes and complete Checklist G for all seven required spots, including PO-dark L6. |

## E26

Criteria: [epic-26-physics-props-and-barricades.md](../../../specs/epic-26-physics-props-and-barricades.md); original audit: [b.md](../spec-audit/b.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E26-AC01 | met | `T-E26-01`, `tests/unit/physics-prop-contract.test.ts`; shipped GLB extraction, class bands, collider bounds ±15%, COM and explosion refs; vehicles retain the epic's explicit E09 exception. | — |
| E26-AC02 | met | `T-E26-02` sim and `T-E26-02-browser`; `PropSystem.postPhysics` / awake-only view uploads. | — |
| E26-AC03 | met | `T-E26-03/03b` exercise authored cart displacement, locomotion and heavy upgrade gate. | — |
| E26-AC04 | met | `T-E26-04`, actual kick/contact event and combat reaction in `tests/sim/barricades.test.ts`. | — |
| E26-AC05 | met | `T-E26-05` and `T-E27-02b`; queued physics body impulse. | — |
| E26-AC06 | met | `T-E26-06/06b`; `PropSystem` ranks squared distance; actual cap is lower than allowed (budgets are upper limits). | — |
| E26-AC07 | partial → **met** | `PropSystem.postPhysics` supports `reset:'spawn'/'remove'`; `T-E26-07b` proves removal. `T-E26-07` explicitly expects displaced-position recovery when reset is absent.; newer: [targeted-sim.json](../wave3-sim/evidence/targeted-sim.json), [review.md](../wave3-sim/evidence/review.md), [E26-summary.json](evidence/E26-summary.json) | — |
| E26-AC08 | met | `T-E26-08`; 30-tick nav update and `BarricadeSystem.attackTarget` route ratio/reach checks. | — |
| E26-AC09 | met | `T-E26-09/09b`; overlapping footprints do not double-count, sub-threshold interaction disabled. | — |
| E26-AC10 | met | `T-E26-10` verifies scheduled repeated damage, multiplier, dynamic release, inward/upward velocity and immediate nav reopen. | — |
| E26-AC11 | met | `T-E26-11/11b` actual vault timing, crawler/Brute exclusion, pooled-state reset and front bullet/projectile immunity. | — |
| E26-AC12 | met | `T-E26-12`, movement interruption included. | — |
| E26-AC13 | met | `T-E26-13` creates, braces and breaks a real sedan. | — |
| E26-AC14 | met | `BarricadeBot` is the test API's complete policy for barricade-lab; `T-E26-14` formerly defaulted to one seed. | — |
| E26-AC15 | met | `T-E26-15`, `T-E26-15-browser`, `src/debug/scenarios/propSequence.ts`. | — |
| E26-AC16 | partial → **met** | `T-E26-16-browser` build/repair/break captures; existing `barricade-ui-W0/W5` Scene Lab sequences include frames 0/90/101/116.; newer: [ui-staging-final-playwright.json](../merge-batch10/evidence/ui-staging-final-playwright.json), [phone-webgpu](../merge-batch10/matrix/phone-webgpu), [phone-webgl2](../merge-batch10/matrix/phone-webgl2), [audit.md](../merge-batch10/audit.md), [review.md](review.md) | — |

## E27

Criteria: [epic-27-explosions-fire-smoke.md](../../../specs/epic-27-explosions-fire-smoke.md); original audit: [b.md](../spec-audit/b.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E27-AC01 | met | `T-E27-01`, `tests/unit/data/explosions.test.ts`; source enumeration covers props, throwables, scripted blasts. | — |
| E27-AC02 | met | `T-E27-02/02b/02c`, real `ExplosionSystem` damage, cover and queued impulses. | — |
| E27-AC03 | met | `T-E27-03` in `tests/e2e/explosions.spec.ts`; fixed-step captures plus flash/fire/ring/debris/smoke/scorch detectors; `T-E27-03p` handles jumped fixed ticks. | — |
| E27-AC04 | met | `T-E27-04` sim checks five-tank chain and denser cap case. | — |
| E27-AC05 | met | `T-E27-05/05v`; asset/wreck regressions tagged AC05 preserve wheels/seats and disable lamps; pooled doors/hood in `src/render/vfx/Blasts.ts`. | — |
| E27-AC06 | met | `T-E27-06` gas-station/fuel-truck variants; `T-E27-06v/06d` light-field TTL and setting; `T-E27-15` real L4 production sequence. | — |
| E27-AC07 | met | `T-E27-07` exercises every blast class with pixel detector. | — |
| E27-AC08 | met | `T-E27-08/08v`; real target-loss events, blocked attacks, exact expiry and visible cloud. | — |
| E27-AC09 | met | `T-E27-09/09b`, `tests/sim/explosion-gas.test.ts`; hazard expiry clears slow. | — |
| E27-AC10 | met | `T-E27-10-bullet/-melee`, `tests/sim/explosion-extinguisher.test.ts`; `Hazards.spawn` creates a combat hitbox, `Combat.hit` routes real kicks through damage for this non-PropSystem entity, and the hit listener vents once. `InteractionView` maps it to the extinguisher model. No ordinary campaign placement is claimed. | — |
| E27-AC11 | met | `T-E27-11`, `tests/visual/e27-smoke.spec.ts`; background-subtracted column bands and real police beacon phase samples. | — |
| E27-AC12 | met | `T-E27-12` image/mask/ring proof; `Blasts` shares camera/player hole for capped smoke. | — |
| E27-AC13 | met | `T-E27-13`, `tests/visual/e27-landmarks.spec.ts`; actual L5 pair-plaza, projected tops, ≥4 columns/shadow strips and puffs. | — |
| E27-AC14 | met | `T-E27-14` bounded lifecycle; `tests/perf/explosions.spec.ts` native high/phone budgets. | — |
| E27-AC15 | partial | `T-E27-15` production collapse captures; `T-E27-15f` pooled embers; existing review and focused pixel tests.; newer: [QA.md](../postmerge-10/QA.md), [README.md](../vfx-stunning-2/README.md) | **M; browser** — Finish explicit Checklist H for lab medium/car/mega, building fire at night, grenade/column and L4 collapse; modern blast/Molotov sheets do not cover the whole required set. |

## E28

Criteria: [epic-28-weather.md](../../../specs/epic-28-weather.md); original audit: [b.md](../spec-audit/b.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E28-AC01 | met | `T-E28-01/01b`, `src/data/weather.ts`; `T-E28-L6` actual underground→night/ground-fog exit; implemented L5 timeline retains ash while fog rises. | — |
| E28-AC02 | met | `T-E28-02` exercises real pistol noise, Molotov duration and Rapier wheel friction. | — |
| E28-AC03 | met | `T-E28-03/03b`, real weather state and wet/dry material masks. | — |
| E28-AC04 | met | `T-E28-04/04b/04c`; tests include a scripted fire/blackout. | — |
| E28-AC05 | met | `T-E28-05/05b`, production perception and player/ring pixel mask. | — |
| E28-AC06 | met | `T-E28-06/06b/06c`; actual fire spread, Rapier prop motion and column axis. | — |
| E28-AC07 | met | `T-E28-07/07b`, plus stride/airborne/bridge tracking regressions in `tests/sim/weather.test.ts`. | — |
| E28-AC08 | obsolete | PO 2026-10-10 provenance: commit **57df1c8c633f860542bd5a1b1a6bfed31a1b5d3e**, title “fix(ui): remove the player weather selector from level select, campaign and pause menus (PO 10-10); debug override kept”; `T-E28-08b/08c` now require hidden selectors/story weather. `T-E28-08` still proves debug override graph invariance. | PO 2026-10-10: player-facing replay weather selector retired; story weather remains, debug override only. Existing one-line spec decision retained. |
| E28-AC09 | met | `T-E28-09/09b`, offline audio and runtime event→cue log. | — |
| E28-AC10 | partial | `T-E28-10` structural storm caps; `T-E23-19` is tagged `@E28-AC10` in `tests/perf/l5-budgets.spec.ts`.; newer: [storm-native-high.json](../merge-batch10/perf/final/weather/storm-native-high.json), [storm-native-low.json](../merge-batch10/perf/final/weather/storm-native-low.json) | **M; browser + quiet perf** — Profile/fix storm heap high 547.66 MiB >400 / low 263.78 >250; frame/sim pass. Recheck actual L5 ash peak and all caps. |
| E28-AC11 | met | `T-E28-11/11b`, actual HUD label/ray pixels; `WeatherView` shared camera-player ray. | — |
| E28-AC12 | partial | `T-E28-12-*` mood captures and `T-E28-12-wall`; `docs/reports/integrate-e26-e28.md` supersedes the original failed review with shafts/facade fixes.; newer: [ui-night-final-playwright.json](../merge-batch10/evidence/ui-night-final-playwright.json), [audit.md](../merge-batch10/audit.md) | **M; browser** — All six moods now pass pixel tests and repaired clothing is reviewed; finish explicit reference Checklist G/weather-mood signoff across required matrix. |

## E29

Criteria: [epic-29-level-7-the-ruined-city.md](../../../specs/epic-29-level-7-the-ruined-city.md); original audit: [c.md](../spec-audit/c.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E29-AC01 | met | `LevelSevenEncounters.prepare/update`, `LevelSevenDeparture.update`; `T-E29-11-roster`, `13-zero/35/wait`. | — |
| E29-AC02 | met | `T-E29-02` plus `02-preset/02-cli`: current literal `L7-default` run, seed 1, 8:39.917, 23/24 boarded, no cheats/player deaths; explicit/all CLI registration is tested. | — |
| E29-AC03 | partial → **met** | `Game.loadLevel` passes L6 results and applies campaign; `T-E29-11-roster`, `T-E31-20`; L7 composition uses shared Northgate.; newer: [browser-webgl2.json](../l7-entry/evidence/browser-webgl2.json), [browser-webgpu.json](../l7-entry/evidence/browser-webgpu.json), [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json) | — |
| E29-AC04 | met | `T-E29-04`, `04-browser`; `src/levels/L7/rocket.ts` equips once and retains optional ownership. | — |
| E29-AC05 | met | `T-E29-05`, `05-browser`; 600 attacks, 75-tick cadence, Ready HUD. | — |
| E29-AC06 | met | `T-E29-06-24/200/los`; real projectiles, permanent kills and empty splash query; mirrored explosion definition. | — |
| E29-AC07 | partial | `T-E29-07-rocket`; shared `T-E07-06-alpha-*`, scheduler/selection cases now selected by E29; shared health-bar code/tests. | **M; browser** — Close E07 move/bar phone proof. Remove old audit C request for global 6 m awareness: PO #25 is L5-only (audit A/orchestrator decision). |
| E29-AC08 | met | `T-E29-08` high/low, `08-visible/turning`; arrivals/caps/Alphas/emergence asserted. | — |
| E29-AC09 | met | `T-E29-09-contract/validation/scene/district/assets/decay-lod`; Fairhaven landmarks and W0–W6 validation. | — |
| E29-AC10 | met | `T-E29-10-district/fires/corridor`, `10-district-browser`; retained landmark transforms, heavier dressing and two paths. | — |
| E29-AC11 | met | `T-E29-11-roster/stragglers/loss/zero`, `T-E31-20-armed-roster`; bounded movement and systemic losses. | — |
| E29-AC12 | met | `T-E29-12` and `08` final-group fixture; follower traverses actual rocket gap while other infected survive. | — |
| E29-AC13 | partial | `T-E29-13-board/wait/zero/35/handover/lane`; `LevelSevenDeparture.cameraPose/drive/finish`.; newer: [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json) | **M; browser** — Measure skyline frame area ≥25%→≤10% and complete departure pairs/roster proof; physical desktop bus→L8 now passes. |
| E29-AC14 | partial | L7 lighting/composition; `docs/reports/l7-district/capture-review.md`; warm fires, night preset and renderer caps.; newer: [l7-night.spec.ts](../../../tests/visual/l7-night.spec.ts), [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json) | **M; browser** — Run committed 3:1 rocket/horde contrast tests and verify L6 exit-light continuity both tiers/backends; API tags alone are insufficient. |
| E29-AC15 | partial | `T-E29-15-bus` now verifies engine position/speed/cab updates and one stop before handover; shared `MusicDirector`/noise/caption systems remain. | **M; browser** — Record combat→departure audio/captions and rocket/fire/bus mix/voice 32/16, focus/pause checks. |
| E29-AC16 | missing → **met** | `Game.loadLevel` only prepares L7 encounters; `missionIds` omits L7. `T-E29-16-tier` uses a sandbox mission; `16-encounters` manually restores seams.; newer: [l7-checkpoints.test.ts](../../../tests/levels/l7-checkpoints.test.ts), [handover.json](../l7-entry/evidence/handover.json), [README.md](../l7-entry/README.md), [E29-summary.json](evidence/E29-summary.json) | — |
| E29-AC17 | missing → **partial** | Focused rocket input tests exist; no `tests/e2e/levels/L7.spec.ts` or E29-AC17 tag on audited main.; newer: [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json), [l7-real-input.spec.ts](../../../tests/e2e/levels/l7-real-input.spec.ts) | **M; browser** — Desktop through L8 and touch pickup/corridor pass; capture the remaining §6 rocket-crowd/Alpha/plaza/corridor/boarding pairs with console guard. |
| E29-AC18 | partial | Existing l7-district/perf capture reviews cover destruction/horde/Northgate; no E29-AC18 test or complete scored ending review.; newer: [l7-pairs.spec.ts](../../../tests/visual/l7-pairs.spec.ts) | **M; browser** — Score new fixed W0/W5/W6/Northgate and rocket/horde/skyline pairs A/D/E/G/H ≥7 with all must items. |
| E29-AC19 | partial | Current native Metal run: **4 pass / 2 fail**. Low horde frame/sim p95 **33.7/6.9 ms** vs **33.3/6**; high rocket heap **420.17 MiB** vs 400. District high/low and high horde/low rocket pass. Rocket/district use legacy `perf().heapBytes`/MiB; horde uses CDP JS `usedSize`/MB, so the figures are not directly interchangeable.; newer: [native-results.json](../l7-entry/evidence/native-results.json) | **M; browser + quiet perf** — Fix measured high horde frame18.1>16.7, low sim6.8>6 and rocket heaps425.53/268.25>400/250; repeat native cap sweep. |
| E29-AC20 | partial | Current low horde **33.7 ms** misses its 33.3 ms frame p95; other native L7 cases pass frame limits. No E29-AC20 fixture covers the full disposal/settings contract.; newer: [l7-lifecycle.spec.ts](../../../tests/perf/l7-lifecycle.spec.ts), [README.md](../l7-entry/README.md) | **M; browser + quiet perf** — Run native peak/≤50 ms transition-blast and ≤10% resource lifecycle/accessibility tests; latest complete epic performance gate is red. |

## E30

Criteria: [epic-30-level-8-the-zoo.md](../../../specs/epic-30-level-8-the-zoo.md); original audit: [c.md](../spec-audit/c.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E30-AC01 | met | `T-E30-01` in `tests/levels/L8.test.ts` at 0/12/35 carried survivors; `src/levels/L8/mission.ts`. | — |
| E30-AC02 | met | `T-E30-02` same real bot cases: no deaths, progression reached, rescued ≥ceil(count×.6). | — |
| E30-AC03 | met | `T-E30-03` campaign preset test; `T-E30-13/14-apc`, L8/L9 transfer tests; `Game.loadLevel`, `LevelEightZoo.prepare`. | — |
| E30-AC04 | met | `T-E30-04` high/low active-time calm; `T-E30-18` checks hidden objective/UI while moving/selecting weapons. | — |
| E30-AC05 | partial | `T-E30-05-district/staff`, level high/low fixtures and L8 composition/healthy animals.; newer: [red-tests.md](../postmerge-10/red-tests.md) | **M; browser** — Close sanctuary visual signoff; wave3-zoo-routines z1.5 clips two occupants on both tiers (reproduced on main). |
| E30-AC06 | partial → **met** | `T-E30-06-walls/sight/scene`; healthy animals follow enclosure loops in `T-E30-09-routine`; `LevelEightZoo` calm state.; newer: [calm-high.json](../wave3-sim/evidence/calm-high.json), [calm-low.json](../wave3-sim/evidence/calm-low.json), [review.md](../wave3-sim/evidence/review.md) | — |
| E30-AC07 | met | `T-E30-07-outlets/doors`, high/low `L8.test.ts` first breach timing/point counts and `T-E30-18` browser breach. | — |
| E30-AC08 | met | `T-E30-08-targets`, species bite tests and systemic outbreak case; local perception and protected controls. | — |
| E30-AC09 | met | Five `T-E30-09-*` natural bites/ID/timer/bar eligibility plus browser healthy→infected same-drawn-entity tests. | — |
| E30-AC10 | partial | Shared `tests/sim/ai/zoo-s1/s2/s3.test.ts` and matching browser tests now selected by E30; shared Alpha suite too. | **M; browser** — Close E07 zoo move/bar visual contract and full in-level matrix. Global awareness request in audit C is superseded by explicit L5-only decision. |
| E30-AC11 | met | `T-E30-11`, `09-cap`; mixed systemic turns/Alphas and strict shared capacity. | — |
| E30-AC12 | met | `T-E30-12-district`; D-ZOO public/service loops and enclosure escape connectivity/clearance. | — |
| E30-AC13 | met | `T-E30-13` 0/12/35/losses, APC motion/exit/companion tests; all living occupants physically board. | — |
| E30-AC14 | met | `T-E30-14-apc/unarmed/windup/model/loader/browser`, L8 level completion transfer; production campaign callback. | — |
| E30-AC15 | partial | `T-E07-19-bars`, `T-E30-09-*-browser`, shared `health-bars.spec.ts`; L8 lighting preset. | **M; browser** — Measure whole-level player ≥3:1 and all infected bars/occlusion/phone/accessibility in required matrix. |
| E30-AC16 | partial | `tests/unit/audio/music-beats.test.ts` L8 calm/breach selection; shared voice/noise/pause systems. | **M; browser** — Record calm→breach→battle→engine audio/caption trace, pre-infection negative cues, voice caps/mix/focus. |
| E30-AC17 | met | `T-E30-17`, `17-animal/apc/save`; saved timers/identities, transfer and checkpoint snapshots. | — |
| E30-AC18 | partial | `T-E30-18` now passes the full real-input keyboard→L9 route after fixture corrections, with 12 rescued and the same healthy corgi aboard; original mobile ACTION test passes, with console guard/screenshots. | **M; browser** — Full route/touch escape passes historically; complete every §6 pair/backend/tier/zoom with zero-error/HUD guard. |
| E30-AC19 | partial | `T-E30-19` captures; `docs/reports/l8-level/visual-review.md` explicitly declines full epic vision acceptance. | **M; browser** — Score full calm/outbreak/normal-to-infected/armored-escape A/C/D/E/G pairs ≥7; fix wide-zoom zoo clipping. |
| E30-AC20 | partial | `tests/perf/l8-budgets.spec.ts` high/low/4× phone; existing systems/district reports have native within-budget samples. | **M; browser + quiet perf** — Measure native mixed outbreak both tiers/backends, ≤50 ms breach/conversion and all light/prop/particle/voice/heap caps. |

## E31

Criteria: [epic-31-level-9-the-crossing.md](../../../specs/epic-31-level-9-the-crossing.md); original audit: [c.md](../spec-audit/c.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E31-AC01 | met | `T-E31-11-*` all routes and `15-crash` full/zero HP; mandatory crash/crawl and input policy. | — |
| E31-AC02 | met | `T-E31-02` 730/0 HP production L9 start; shared transfer and real browser handover code. | — |
| E31-AC03 | met | `T-E31-03-model`, shared APC browser suppression; durability and zero-HP ram sims. | — |
| E31-AC04 | met | `T-E31-04/04-ground/04-dress` and D-CROSSING route/sightline data; l9-dress review. | — |
| E31-AC05 | met | `T-E31-05-*` physics route/detour, shortcut distance/risk and avoidable groups. | — |
| E31-AC06 | met | `T-E31-06/repeat/checkpoint/attack/07-hull`, actual stopped-hull browser case. | — |
| E31-AC07 | met | `T-E31-07/surrounded/cancel/driver` and `07-browser`; windup, repeated attackers and reach exit. | — |
| E31-AC08 | partial | `T-E31-08`, zero-no-repair sims; responsive actual input HUD cases. | **M; browser** — Measure durability HUD ≥3:1 on desktop/phone, including zero-HP text and touch overlap, in current matrix. |
| E31-AC09 | met | `T-E31-09/controls/policy/ram/scope`, terrain-speed high/low, early/late-zero route cases; floor browser. | — |
| E31-AC10 | met | `T-E31-10-bypass/fallback`, all-route zero cases and crash browser input; safe anchors/corgi. | — |
| E31-AC11 | met | `T-E31-11` preserved/early≤20%/late≥80% on three routes and risky-vs-safe comparison. | — |
| E31-AC12 | met | `T-E31-12-S3`, terrain streaming unit/sim/browser; predictive high/low residency bounded 25/9. | — |
| E31-AC13 | met | `T-E31-13-*`, shared chunk-residency/revisit tests and browser retirement scenes; seam/support/IDs/HP state. | — |
| E31-AC14 | met | `T-E31-14-crash/load/legacy`, handover and residency clock/checkpoint tests; migration keeps floor. | — |
| E31-AC15 | met | `T-E31-15-crash/handover` and corresponding keyboard browser cases; axe racks/ownership, abilities/corgi and once-only reset. | — |
| E31-AC16 | partial | `T-E31-16` night-read data, `22-engine/22-audio`, Q3 real driving captions and night-read catalog. | **M; browser** — Measure player/navigation ≥3:1 at floor/crawl and complete caption/voice/focus/pause proof; 2.0/2.5 scene gates are insufficient. |
| E31-AC17 | partial | `tests/e2e/levels/l9-browser-input.spec.ts`: real keyboard/touch healthy/floor, road departure, crash/crawl/axe; prior Q3 only partly executed. | **M; browser** — Finish current desktop/mobile route/backend/zoom matrix and all §6 healthy/floor/crash/crawl/axe pairs under console guard. |
| E31-AC18 | partial | `docs/reports/l9-q3/review.md` scores scoped pairs 7–8/10; retirement/input caveats remain; no E31-AC18 tag. | **M; browser** — Score all required route/stage/crash pairs A/D/F/G ≥7; tag coverage and generic matrix passes are insufficient. |
| E31-AC19 | partial | `tests/perf/l9-{dress,handover-budgets}.spec.ts`; `T-E31-19-S4`, streaming units; Q3 native six cases previously pass.; newer: [idle-crossing-200.json](../postmerge-10/evidence/idle-crossing-200.json) | **M; browser + quiet perf** — Node residency timing now passes; finish live route/floor/crash high/low frames, ≤50 ms hitches and five warmed heap/GPU round trips ≤10%. |
| E31-AC20 | partial | `T-E31-20` continuous seed-1 L1→L9 campaign and armed-roster/continuity regressions.; newer: [final-vitest.json](../postmerge-10/evidence/final-vitest.json), [E31-campaign-seed-1.json](evidence/E31-campaign-seed-1.json) | **M; browser** — Continuous L1→L9 passes; record physical iOS and Android crossing p50≥30 fps. Emulation does not replace devices. |
| E31-AC21 | met | `T-E31-21` obstacle/wreck onset, collider aliases, contact IDs and floor clamps. | — |
| E31-AC22 | met | `T-E31-22-art/engine/budget/smoke`, all durability boundaries and `22-audio` browser; cumulative restore. | — |

## E32

Criteria: [epic-32-level-10-the-cure.md](../../../specs/epic-32-level-10-the-cure.md); original audit: [c.md](../spec-audit/c.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E32-AC01 | met | `T-E32-01-data/01`, mission graph and `T-E32-32` all fifteen objectives through once-only credits. | — |
| E32-AC02 | met | `T-E32-02`, `02-minute-high/low`, crash handover, standalone selection browser; first minute asserted tick-by-tick. | — |
| E32-AC03 | met | `T-E32-03-D1/D2/D3`, `17-D4`, geometry/route/seam units; production seven-region D-CURE. | — |
| E32-AC04 | partial → **obsolete** | `T-E32-04-complete` ordinary input, seven timing rows/150 s epilogue; prior complete run 26:10.017; existing shotgun report also has an uncalibrated newbie L10 run at 26:12.183, not 45–50 min. | PO 2026-10-09 no long bot batteries; scheduler/orchestrator explicitly drops the novice 45–50 min proof as an acceptance gate. Complete campaign regression remains AC32. |
| E32-AC05 | met | `T-E32-05/ammo`, progression/cure transaction tests and checkpoint input browser; ten real rockets. | — |
| E32-AC06 | met | `T-E32-06-E2/D3`, `21-E3-overlap` and production route-depth encounters/caps, no inventory-driven spawn. | — |
| E32-AC07 | partial → **met** | `T-E32-07-*`, dog wall/stagger/death/coat controls and authored pounce fixtures; non-corgi quadruped models.; newer: [l10-dogs.test.ts](../../../tests/sim/ai/l10-dogs.test.ts), [a.md](../spec-audit/a.md), [README.md](../postmerge-3/README.md) | — |
| E32-AC08 | met | `T-E32-08a`, cure exclusions/species/flag fixtures; all cure phases and protected historical pet paths. | — |
| E32-AC09 | partial | `T-E32-09a/bars/scale`, shared Alpha scheduling/resistance tests now included; later PO same-size stronger Mega design is in main. | **M; browser** — Close inherited E07 four-move/bar visual proof and regular/Mega distinction; L5-only awareness decision removes the audit C global-awareness defect. |
| E32-AC10 | met | `T-E32-10-production-*`, `l10-mega-cruise.test.ts`, persistent coarse/detailed residency tests; `MegaPursuit.coarse` uses unchanged 3.15 m/s. | — |
| E32-AC11 | met | `T-E32-11-*` charge/slam/grab windup/one-hit/wall/dodge/release controls and move catalog scenes. | — |
| E32-AC12 | met | `T-E32-12a` nine survive/tenth kills; rocket ledger/splash and conventional floor tests, assault route ten-hit kill. | — |
| E32-AC13 | met | `T-E32-13-audio/live` actual offline RMS/voice priority and unit gain bands; alive/off-region warnings/caption/focus handling. | — |
| E32-AC14 | met | `T-E32-14-ring` and audio browser HUD; centered band without exact Mega pin, responsive text. | — |
| E32-AC15 | met | `T-E32-15-recording`, `03-D3`, `15/16/27-E2` and terminal input browser; licensed stock and subtitles. | — |
| E32-AC16 | met | `T-E32-16-*`, carry-speed/racks/checkpoint tests; male/female carried catalog, terminal retry browser. | — |
| E32-AC17 | met | `T-E32-17-D4` nav/console/mount/dodge lanes, `17-D4-browser`, installed-ready checkpoint capture. | — |
| E32-AC18 | partial → **met** | `T-E32-18*` minigun cadence/TTK/dismount/no-Mega-kill and real E mount browser exist.; newer: [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json), [l10-minigun-input.spec.ts](../../../tests/e2e/levels/l10-minigun-input.spec.ts) | — |
| E32-AC19 | met | `T-E32-19-heat*`, save/remount locks/cooling and Scene Lab heat-HUD negative controls. | — |
| E32-AC20 | met | `T-E32-20/27` exact 3600 ticks, radius/pause/ready death state and real E defend browser matrix. | — |
| E32-AC21 | partial → **met** | `T-E32-21-E3b` current production-route seed 32 confirms **143.150/141.967 s high/low**; close-start `21-E3` retains 10–40 s. Same-ID/charge gate/caps persist.; newer: [epic-32-level-10-the-cure.md](../../../specs/epic-32-level-10-the-cure.md), [l10-arrival.test.ts](../../../tests/sim/levels/l10-arrival.test.ts), [c-e32-E3-calibration-seed-32.json](../spec-audit/evidence/c-e32-E3-calibration-seed-32.json), [README.md](../merge-batch9/README.md), [E32-summary.json](evidence/E32-summary.json) | — |
| E32-AC22 | met | All eight `T-E32-22` truth-table cases; live boss/held input/console presence and explicit once-only release browser. | — |
| E32-AC23 | met | `T-E32-23-S8/exclusions/flag`, all infected species and permanent deaths, pooled mist/fan render fixtures. | — |
| E32-AC24 | met | `T-E32-24-unloaded/zoo/fresh-clock`, five revisits and campaign cure state; no all-region loading. | — |
| E32-AC25 | met | `T-E32-25/26-S9`, `25-cast/pending`, movement/150 s reversal, bounded emerging survivors and no attacks/spawns. | — |
| E32-AC26 | met | `T-E32-26-camera/resume-S9`, real browser pull/title/credits/reload; last 36 s pull and once-only completion. | — |
| E32-AC27 | met | `T-E32-27-*`, actual death/save/death-save and region checkpoints, ready boss/heat ledger and canister state. | — |
| E32-AC28 | partial → **met** | `T-E32-28-cure/lods/D1/S4`, production predictive reversal/five revisits, 25/9 chunks and baked ≤2 cm seams; shared browser streamer.; newer: [browser-wave3.log](../merge-batch10/evidence/browser-wave3.log), [wave3-sim.spec.ts](../../../tests/e2e/levels/wave3-sim.spec.ts), [l10-regression.test.ts](../../../tests/sim/levels/l10-regression.test.ts), [E32-summary.json](evidence/E32-summary.json) | — |
| E32-AC29 | missing → **partial** | No E32-AC29 test. Focused region/terminal/minigun/finale/epilogue browser tests exist; no complete mouse-only/touch acceptance aggregate.; newer: [l10-minigun-input.spec.ts](../../../tests/e2e/levels/l10-minigun-input.spec.ts), [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json), [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json) | **M; browser** — Tagged checkpoint/carry/heat/charge/ending tests now exist; finish mouse-only/touch aggregate, all region/finale pairs and HUD non-overlap review. |
| E32-AC30 | partial | Q1/Q2/Q3/Q4 catalogs/reviews, same-size Alpha-look fixes and extensive backend sheets; catalog unit tags check fixtures, not whole-epic visual scores.; newer: [gate-final-matrix-index.json](../postmerge-10/evidence/gate-final-matrix-index.json), [QA.md](../postmerge-10/QA.md) | **M; browser** — Score all seven regions and ending A/C/D/F/G/H ≥7/all must; full matrix and corrected title/credits now pass but are not the scored review. |
| E32-AC31 | partial | Nine E32 native suites now selected after verifier fix; current isolated Mega-special 200-infected sim p95 **4.196 ms > 4 ms**, low tier passes; sim/LOD/cure counters and prior native samples do not erase this failure.; newer: [final-vitest.json](../postmerge-10/evidence/final-vitest.json) | **L; browser + quiet perf** — Complete native regions/assault/mist/pullout high/low caps, ≤50 ms transitions and five-cycle retention; physical iOS/Android ≥30 fps still required. |
| E32-AC32 | met | `T-E32-32` current continuous seed-1 L1→L10 **passes** (L10 **26:10.533**, zero L10 deaths); save/campaign callbacks, roster/abilities, mandatory axe reset and one release/victory.; newer: [E32-campaign-seed-1.json](evidence/E32-campaign-seed-1.json) | — |
