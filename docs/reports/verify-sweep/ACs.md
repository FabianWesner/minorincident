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
| E07-AC05 | met / fixed | All 14 warning/activation/cooldown/real-checkpoint probes pass; opened 168-capture sheets and every boundary overview, including complete 18/20 m roar rings. Restored/paused warning rendering repaired. [Named review and journals](../ac-close-shared/README.md#all-14-move-warning-restore-and-cooldown-review--e07-ac050619). | — |
| E07-AC06 | met | All four Alpha move timing/spatial/wall/restore controls; 12-case shared-bar matrix; actual Alpha 300→240 HP /1→0.8 fill at desktop and both low phone orientations. Opened complete move and phone captures. [Review/proofs](../ac-close-shared/README.md). | — |
| E07-AC07 | met | src/sim/ai/SpawnDirector.ts safe/visible; tests/sim/ai/director.test.ts T-E07-07/07b; navigation.test.ts T-E07-07c | — |
| E07-AC08 | met | src/sim/ai/SpawnDirector.ts queue; tests/sim/ai/director.test.ts T-E07-08/08b/08c | — |
| E07-AC09 | met | src/sim/ai/SpawnDirector.ts migrations; tests/sim/ai/director.test.ts T-E07-09 | — |
| E07-AC10 | met | src/sim/ai/InfectedSystem.ts pool/release/settle; tests/sim/ai/director.test.ts T-E07-10/10b | — |
| E07-AC11 | met | Fresh isolated Hetzner T-E07-11: 5 timing assertions passed, 0 failed; 200-infected sim p95 2.10 ms ≤4 ms (director, Alpha and physical fixtures); evidence/verification-summary.json and E07-verify.log. | — |
| E07-AC12 | met | Final full E07 verify passes all five quiet cases. Exact 185-object live/reset graph includes 44 prewarmed empty corpse pages; independent primary/accessory ownership is complete. Counter now includes headwear: 200 runners cost17 combined draws; mixed200 costs30, confirmed by native renderer profile. Original fixed formula corrected; dog palette sharing and distant headwear batching fix actual excess. [Final proof](../ac-close-shared/evidence/horde-object-audit-final.json.gz), [verify stages](../ac-close-shared/evidence/verify-E07-final-checks.json). | — |
| E07-AC13 | met | Named Checklist D passes5/5 on final runtime df390443a:24 frames, WebGL2/WebGPU × high/low × actual zoom0.5/1/1.5, with warnings and pickups. Matrix/full-size samples opened; actual backend/tier,60/62 actors and zoom validated. [Current signoff](../ac-close-shared/README.md), [frame hashes](../ac-close-shared/evidence/D-final-images.json). | — |
| E07-AC14 | met | src/sim/ai/InfectedSystem.ts settle/release; src/sim/combat/Damage.ts downing/permanence; tests/sim/ai/specials.test.ts T-E07-14; tests/sim/combat/l5-shotgun.test.ts T-E23-12-kill | — |
| E07-AC15 | met | src/sim/combat/Damage.ts; tests/sim/ai/specials.test.ts T-E07-15 | — |
| E07-AC16 | met | src/sim/ai/InfectedSystem.ts animal pack/pounce; tests/sim/ai/animals.test.ts T-E07-16 | — |
| E07-AC17 | met | src/sim/ai/InfectedSystem.ts perch/cling; tests/sim/ai/animals.test.ts T-E07-17/17b/17c | — |
| E07-AC18 | met | src/sim/ai/Flock.ts; tests/sim/ai/animals.test.ts T-E07-18/18b/18c | — |
| E07-AC19 | met (rewrite adopted 2026-10-22) | All ten zoo timing/cooldown/restore and boundary captures reviewed; actual elephant/zebra/flamingo phone bars and shared lion/gorilla bars pass. Corrected clear-lane courier impact plus admitted sedan/barricade control pass. Literal zebra corridor fails (0.76 m outside nominal half-width still hit; 0.88 m control untouched). [Evidence and proposed rewrite](../ac-close-shared/README.md). | User decision on explicitly unadopted 1.5 m nominal cue /0.82 m physical-contact boundary proposal. No gameplay/test threshold changed. |

## E22

Criteria: [epic-22-level-4-the-safe-city-falls.md](../../../specs/epic-22-level-4-the-safe-city-falls.md); original audit: [a.md](../spec-audit/a.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E22-AC01 | met | src/levels/L4/mission.ts; T-E22-01 | — |
| E22-AC02 | met | src/data/l4.ts bots; tools/sim-runner/l4Bots.ts; tests/levels/L4.test.ts T-E22-02 | — |
| E22-AC03 | met | src/data/l4.ts bots; tests/levels/L4.test.ts T-E22-03 | — |
| E22-AC04 | met | Current T-E22-04 mechanics passes in the 142-test Node stage. [Fresh corrected-bus proof](../ac-close-l4-l6/evidence/bus-summary.json): all 17 requested backend/tier/cadence cases pass, actual authored player bus index2 stays on screen, RMS **0.02494–0.10616 px ≤0.6**, 46–182 samples, all wheels rotate ≥19.856 rad. The opened ride frame shows that same bus. | Closed: current actual-bus motion plus 20–35 s ride /≤0.5 s control-return mechanics. The fresh probe additionally records/asserts actual backend/tier for the next full-verifier execution. |
| E22-AC05 | met | LevelFourWar.prepare/populate; T-E22-05; tests/levels/L4-perimeter.test.ts and L4-barricade-prompts.test.ts | — |
| E22-AC06 | met | src/data/actions/catalog.ts army-mg; LevelFourWar.gunshot; tests/levels/L4.test.ts T-E22-06 | — |
| E22-AC07 | met | LevelFourWar.turn/emergeInside; tests/levels/L4.test.ts T-E22-07; L4-po-round.test.ts | — |
| E22-AC08 | met | src/data/l4.ts war/caps; LevelFourWar.armCivilians; T-E22-08 | — |
| E22-AC09 | met | src/sim/outbreak/Allies.ts; LevelFourWar.armCivilians; tests/sim/npc/l4-systems.test.ts; T-E22-09 | — |
| E22-AC10 | met | LevelFourWar.waves/flushEdges/emergeInside; src/data/l4.ts street mouths; T-E22-10 | — |
| E22-AC11 | met | LevelFourWar military/tank/helicopter; tests/levels/L4.test.ts T-E22-11 | — |
| E22-AC12 | met | Current merged L4.test.ts: all 23 tests pass, including high/low Alpha counts, mouths/caps, ≥60 line losses and authored gap. Inherited current 13h [E07 four-move/bar proof](../ac-close-shared/README.md): 14 exact timing/restore/cooldown journals, all Alpha spatial/cover controls, 12-case shared bars and actual phone Alpha HP; sheets reopened in [this review](../ac-close-l4-l6/README.md). | Closed with current level mechanics and inherited shared visual proof. Full epic verification remains separate. |
| E22-AC13 | met | LevelFourWar.checkLineBreak/lineBreak; tests/levels/L4-collapse.test.ts; T-E22-13-authored-gap | — |
| E22-AC14 | met | LevelFourWar.burnCars/populateCollapse; T-E22-14; E07 corpse persistence | — |
| E22-AC15 | met | LevelFourWar.descend/bar/cellarUpdate; src/data/l4.ts finale; tests/levels/L4-finale-pressure.test.ts PO17/17b; T-E22-15/15-carry | — |
| E22-AC16 | met | src/data/timeOfDay.ts; LevelFourWar smoke/collapse state; T-E22-16 | — |
| E22-AC17 | met | LevelFourWar.respawn/campCheckpoint; tests/levels/L4.test.ts T-E22-17; L4-respawn/L4-battlefield-lifecycle tests | — |
| E22-AC18 | met | Fresh T-E22-18 passed in 1.6 min: ordinary keyboard/mouse bus-to-cellar route, all photo spots/pair cameras, zero-console-error fixture. evidence/E22-verify.log; corrected cadence fixture is a separate check. | — |
| E22-AC19 | met | [Production phase review](../ac-close-l4-l6/E22-review.md): safe 8/10, war 7/10, tank 8/10, collapse 8/10; opened full frames and L3 comparison plus current-base E07 high/low temporal VFX proofs. All must and 11/12 should items pass; no P0/P1. Actual campaign phase/tank/Alpha and both-tier capture assertions pass. | None. |
| E22-AC20 | red | [Strict final WebGPU proof](../ac-close-l4-l6/README.md), archived raw quiet reporter and per-tier JSON: ordinary peak budgets pass, but high turn48.5ms has4 cold builds and line-break204.7ms; low turn54.5ms / line-break54.8ms. | **M/B+Q** — Real timing/cold-build defects remain; unchanged50ms/zero-build gates fail. Unprofiled WebGL counterpart and remaining full-verifier browsers unmeasured at final cutoff; runtime fixes assigned by orchestrator to a separate perf lane. |

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
| E23-AC14 | met | src/audio/MusicDirector.ts L5 found trigger; tests/e2e/audio/l5.spec.ts T-E23-14a/14b historical pass: −40.8 vs −14.1 LUFS,26.7 LU contrast (evidence/E23-audio-l5-vs-war.json). Latest2026-10-22 remote14a passes;14b reaches its unchanged900s timeout before a current comparison result. [Raw current receipt](../ac-close-l4-l6/evidence/verify-latest-E23-remote.json.gz). | Current14b repeat is unmeasured, not a new LU pass; full E23 remains in-progress. |
| E23-AC15 | met | LevelFiveAftermath.metro/ingress/shutter/sealEntrance/result; tests/levels/L5-encounters.test.ts; T-E23-15/15b | — |
| E23-AC16 | met | LevelFiveAftermath.restore; T-E23-16/16-shotgun; L5-encounters.test.ts station checkpoint/transfer | — |
| E23-AC17 | met | [Corrected native route](../ac-close-l4-l6/README.md): four-minute keyboard/mouse replay passes cellar→Rosa→Sam→Mia→Okafor→Dale→group photo→Metro shutter→L6. All five sheltered and handed over, all five cues heard, all nine photographs, zero deaths and zero console errors; frozen complete/newbie Node baseline remains green (75 tests). | None. |
| E23-AC18 | met | [Actual four-pair/group review](../ac-close-l4-l6/E23-review.md): plaza 7, Harbor 8, Metro 8, Kessler 7, group 7/10. Production pair test passes original >30% differences; successful real route provides the five-person escort. All must and 8/11 should items pass; three P2 limitations are recorded explicitly. | None. |
| E23-AC19 | met | [Final native matrix and retention](../ac-close-l4-l6/README.md): both backends/tiers and zoom0.5/1/1.5 pass all original peak/counter/draw gates; WebGL p95high8.6ms/low34.9ms and WebGPU7.4/34.7ms. Four original five-load heap/geometry/texture checks pass (heap−6.01%/−2.60% WebGPU,−4.795%/−2.614% WebGL). | None for this AC; full E23 verifier remains independently red. |

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
| E24-AC15 | met | [24-case native matrix](../ac-close-l4-l6/l6-readability-matrix.jpg), [numeric summary](../ac-close-l4-l6/evidence/readability-final-24-summary.json): actual WebGL/WebGPU × high/low × zoom 0.5/1/1.5 × both spots pass, contrast 3.269–5.805:1, ≥11 ring patches, red margin ≥172, brightest pixel inside actual eye geometry; high-only hero shadow confirmed. The original two three-infected default tests also pass. Subway contact shade, infected highlight cap and correct geometry/reveal mask are proved fixes. | None. |
| E24-AC16 | met | src/sim/missions/Mission.ts capture/restore; LevelSixSubway.restore; tests/levels/L6.test.ts T-E24-16 | — |
| E24-AC17 | partial → **met** | tests/e2e/levels/L6.spec.ts T-E24-17; docs/reports/l6-po.md open 3500-iteration real-input failure; newer: [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json), [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json) | — |
| E24-AC18 | red | [Final actual seven-photo review](../ac-close-l4-l6/E24-review.md): v7 route20/29, zero damage/deaths,3 gates,7 photos and exact L7 handover pass; phone96 contexts have zero HUD/courier overlap. | Named scores8/7/**6/5**; two must and5/9 should fail. Retreat courier/MG too small; night yard sparse/washed by purple haze. Final v8 also fails one-death gate (18/29rescued) and was reverted. Coherent criterion; no rewrite proposed. |
| E24-AC19 | red | Approved **CLARIFIED2026-10-22 (orchestrator)** high≥40/low30 rewrite is proved on actual WebGL/WebGPU, both tiers/all3zooms:26moving survivors,40/30live infected,25/22retained dead, lights and tier budgets. Final WebGL breach/abandon18.1ms high/34.6ms low pass literal50ms. [Evidence](../ac-close-l4-l6/README.md). | Original five-load heap remains red: WebGPU+10.5898%/+11.9797%, WebGL low+10.577%; final formal quiet12/12passes; native functional stage unmeasured/admission75. Separate perf lane owns runtime fix. Warmed-baseline proposal is explicitly unadopted. |

## E25

Criteria: [epic-25-lighting-shadows-reflections.md](../../../specs/epic-25-lighting-shadows-reflections.md); original audit: [b.md](../spec-audit/b.md).

| AC | 10-16 → now | Test / evidence | Remaining work |
| --- | --- | --- | --- |
| E25-AC01 | met | Fresh native quiet WebGPU comparison: all6 configs/120samples pass; six frames inspected and canonical decision updated. Dynamic256 queuep95=781.3ms, clustered256=16.6ms; production retains field+shadowed spot. Photometric/timestamp limits explicit. [Report/evidence](../ac-close-l7-l10/README.md#e25-ac01--met). | — |
| E25-AC02 | met | `T-E25-02/02b`, `tests/unit/render/e25-lighting.test.ts`; `tools/assets/lights.ts` validates tokens, intensity, ground intersection and emissive references against baked runtime table. | — |
| E25-AC03 | met | `T-E25-03` pixel probes in `tests/visual/e25-closure.spec.ts`; visibility polygon regressions `T-E25-03u/03b`; `src/render/LightField.ts`. | — |
| E25-AC04 | met | **S fixed:** `T-E25-04` now checks the same 69,825 screen pixels on actual WebGL/WebGPU, high and low; both cases pass. High relative difference 0.0005977%; low 0.0005845%. Captures opened and numerically compared; old fixme removed. | — |
| E25-AC05 | met | `T-E25-05/05l` sixty-second both-tier unit walk; `T-E25-05v` real 3,600-frame pixel walk; `Lighting.setHeroLight` and `LightField.heroAt`. | — |
| E25-AC06 | met | `T-E25-06`, `tests/visual/e25-lighting.spec.ts`, pixel shadow and adjacent-ground masks. | — |
| E25-AC07 | met | `T-E25-07s/07c/07m` sim/checkpoint regressions and `T-E25-07` browser emissive, beam, reflection and field shutdown probes. | — |
| E25-AC08 | met | `T-E25-08s/08p`, `tests/sim/light-power.test.ts`; actual detection/tracking paths use darkness. | — |
| E25-AC09 | met | `T-E25-09` projects the real four-cone intersection and measures gradient; practical beam renderer. | — |
| E25-AC10 | partial | `T-E25-10` wet/dry pixel ratios on high/low; `LightField` reflection splats; `T-E25-10-SSR` remains fixme.; newer: [e25-deferred.spec.ts](../../../tests/visual/e25-deferred.spec.ts) | **Proposed rewrite, not adopted:** move SSR silhouette /≥30% overlap to the overview §6 release-extras gate while retaining both-tier wet streaks. AC remains partial. [Exact wording/reason](../ac-close-l7-l10/README.md#proposed-rewrites--awaiting-po-decision). |
| E25-AC11 | met | `T-E25-11` two-angle shipped-car/bench captures; `T-E25-11s` shipped primitive semantic checks; `src/render/PaletteMaterial.ts` material-class environment shading. | — |
| E25-AC12 | met | Fresh native original test passes: room boundary **43.091px≥4**, glow ratio **9.919>4**, all off emissives zero. Opened both angle/off frames: moving interior stripe, stable mullions, warm spill removed off. [Evidence/review](../ac-close-l7-l10/README.md#e25-ac12--met). | — |
| E25-AC13 | partial → **met** | Fresh `T-E25-13` fails: player/ring contrast **3.1595:1** passes, but eye samples are RGB 141/151/201, 139/149/198, 139/150/199 (red dominance −60 instead of ≥60). Opened `night-street.png`: infected bodies visibly fragmented with pale blue edges/dark gaps.; newer: [ui-night-final-playwright.json](../merge-batch10/evidence/ui-night-final-playwright.json), [browser-ui-night-final.log](../merge-batch10/evidence/browser-ui-night-final.log) | — |
| E25-AC14 | partial | Fresh quiet frame/light/collected-JS cases pass; JS144.737/134.941MB, backing602.198/524.402MB, legacy after-GC747.052/659.460MB. All counters retained. | Memory-domain budget rewrite proposed, unadopted; legacy400/250 interpretation remains red. [Raw audit](../ac-close-l7-l10/README.md#first-native-e25-run--0850-utc). |
| E25-AC15 | met | Current 94 light assets /188 Blender day/night renders, all four sheets reviewed; fresh production turntable night-on/off inspected, five views non-placeholder (15.80–32.27% coverage), batch off-state mean/max pixel difference 0/0. [Hashes and receipts](../ac-close-l7-l10/README.md#e25-ac15--met). | Met 2026-10-22; reference resemblance is not claimed by this lighting-preview proof. |
| E25-AC16 | partial | Final seven G scores7/8/7/8/4/7/6; all28frames inspected. Corrected shadow85.884% passes. Night courier2.899<3, saturation.949579<.95, low infected-blue and mall reflections remain red. | Full must-item review and missing courier-framed pairs remain open; no waiver proposed. [Scored review](../ac-close-l7-l10/README.md#e25-ac16--current-checklist-g-review-not-accepted). |

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
| E27-AC11 | met (fresh repair) | 2026-10-22 final full verify: the initial full verify exposed an empty high sampling patch. Fixed the low-cloud probe at 2 m with unchanged >100-pixel/1.15× gates; complete focused test passes: lower hue 15.80°, lower/top luminance 2.62×, beacon on/off 2.669×. [Opened frames and receipts](../ac-close-shared/README.md). | — |
| E27-AC12 | met (fresh repair) | 2026-10-22 final full verify: repaired isolated survivor-lab compositing and player-ray smoke retention. Existing test passes **2.173:1 ≥2:1**, **30.58% ≤40%**; opened courier/cloud comparison. [Frames and readings](../ac-close-shared/README.md). | — |
| E27-AC13 | met | `T-E27-13`, `tests/visual/e27-landmarks.spec.ts`; actual L5 pair-plaza, projected tops, ≥4 columns/shadow strips and puffs. | — |
| E27-AC14 | met | `T-E27-14` bounded lifecycle; `tests/perf/explosions.spec.ts` native high/phone budgets. | — |
| E27-AC15 | met (fixed) | 2026-10-22: explicit H **4/4 must +3/3 should**, 102 recorded final states with opened seven-spot sheets/full-size controls across medium/car/mega lab, night house-front fire, actual grenade, wind column and production L4 collapse, high/low. Repaired retained-corpse impulse/landing/checkpoint motion; original IDs remain. Pinned grenade repeat excludes earlier blank. Full verify **46 Node +41 functional browsers +2 quiet perf** passes; native max **13.7/29.8 ms**. [Review](../ac-close-shared/README.md#final-source-named-h-review--2026-10-22), [high](../ac-close-shared/h-high.jpg), [low](../ac-close-shared/h-low.jpg). | — |

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
| E28-AC10 | met (clarification adopted 2026-10-22; collected CDP heap 116.68 MB) | 2026-10-22: full verify passes 28 Node +71 functional browsers +6 quiet perf. Real immutable-buffer/unused-vertex repair saves 20.94/22.58 MB backing storage with identical RGB. Native storm frame p95 5.8/6.9 ms; collected JS heap 117.34/116.78 MB. Actual L5 peak ash (0.35), five followers/13 fires/37 corpses, caps and existing frame gates pass. [Readings and proposal](../ac-close-shared/README.md). | Original `perf.heapBytes` still **557.89/523.82 MiB**, above 400/250. Proposed explicit collected-CDP JS-heap contract with separate backing/legacy counters; **not adopted**, no threshold/helper weakened. E28 remains in-progress. |
| E28-AC11 | met | `T-E28-11/11b`, actual HUD label/ray pixels; `WeatherView` shared camera-player ray. | — |
| E28-AC12 | met | 2026-10-22: opened all six moods × WebGL2/WebGPU × high/low, authorized interim reference sheets, full-size storm/facade/settled hero shadow. Explicit G **4/4 must +3/3 should**; fog repaired **3.0349:1**, cast shadow **85.88% /254.7°**, wet glints broken by noise. [Review](../ac-close-shared/README.md#final-source-checklist-g-review--2026-10-22), [matrix](../ac-close-shared/g-moods.jpg), source hashes/readings retained. | — |

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
| E29-AC07 | **met** | Fresh133-pass Node selection includes resistance/scheduler/restore;13 native move cases cover all4 moves at desktop/portrait/landscape,6 day/night Alpha bar cases match actualHP. Actual minimum bar contrast3.086/3.355:1. [Opened current proof](../ac-close-l7-l10/README.md#e29-ac07--met). | Complete current inherited Alpha move/bar proof; no global6m awareness change. |
| E29-AC08 | met | `T-E29-08` high/low, `08-visible/turning`; arrivals/caps/Alphas/emergence asserted. | — |
| E29-AC09 | met | `T-E29-09-contract/validation/scene/district/assets/decay-lod`; Fairhaven landmarks and W0–W6 validation. | — |
| E29-AC10 | met | `T-E29-10-district/fires/corridor`, `10-district-browser`; retained landmark transforms, heavier dressing and two paths. | — |
| E29-AC11 | met | `T-E29-11-roster/stragglers/loss/zero`, `T-E31-20-armed-roster`; bounded movement and systemic losses. | — |
| E29-AC12 | met | `T-E29-12` and `08` final-group fixture; follower traverses actual rocket gap while other infected survive. | — |
| E29-AC13 | partial | Fresh production-camera ID measurement **1.846%→32.204%**, opposite ≥25%→≤10%; boarding/handover simulation passes. | **Real defect:** eastbound departure enters town; settled start camera looks west into fog. Ten camera-only diagnostics did not repair it. Preserve gates; fix the cinematic route/composition. [Current evidence](../ac-close-l7-l10/README.md#native-l7l8-diagnostics--0900-utc). |
| E29-AC14 | **met (fixed)** |24 spot measurements pass6.630–7.732:1, zero clipping/color failures. Fixed L6 exterior subway-darkness leak;8 entry/pickup/retry cases and4 clean world-frame pairs pass both backends/tiers. Same nominal night key, raw weather/intensity retained. [Viewed proof](../ac-close-l7-l10/README.md#e29-ac14--met-fixed). | Complete current night contrast/continuity/cap proof; unchanged3:1 gate. |
| E29-AC15 | partial | Fixed departure intensity: current streamed decks combat→combat→aftermath→combat pass across waiting/boarding/departure/retry. Engine/cab/noise unit coverage in fresh 619-pass selected repeat. | **Partial:** actual real-input cue/caption trace and full voice/mix/focus/pause integration remain. [Trace](../ac-close-l7-l10/evidence/departure-audio.json.gz). |
| E29-AC16 | missing → **met** | `Game.loadLevel` only prepares L7 encounters; `missionIds` omits L7. `T-E29-16-tier` uses a sandbox mission; `16-encounters` manually restores seams.; newer: [l7-checkpoints.test.ts](../../../tests/levels/l7-checkpoints.test.ts), [handover.json](../l7-entry/evidence/handover.json), [README.md](../l7-entry/README.md), [E29-summary.json](evidence/E29-summary.json) | — |
| E29-AC17 | partial | Fresh phone pickup/corridor pass; continuous desktop reaches departure then fixture dereferences absent loading player. Actual route loses entire escort;12 required photos incomplete. [Current audit](../ac-close-l7-l10/README.md). | **M; browser** — Observer transition correction pending; retain boarding/final-horde-after photo requirements and console guard. |
| E29-AC18 | partial | Opened fresh both-tier four-spot W5/W6 and real-input rocket/Alpha/plaza frames. A4 D6 E5 G4, H unmeasured; must failures prevent acceptance. [Current audit](../ac-close-l7-l10/README.md). | **M; browser** — Remove W5 briefing by beginning mission; complete W0/Northgate/followers/skyline/explosion sequence; repair composition/decay/readability. |
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
| E30-AC05 | partial | Fresh high/low zoom1.5 original 60-frame zoo rows both pass: all actor/static/held-prop/gun intersections zero. Opened both frame sheets; staff/visitor silhouettes grounded and props attached. | **Partial:** the two stale clipping rows are closed; complete scored sanctuary signoff. [Review](../ac-close-l7-l10/README.md#0838-utc-checkpoint). |
| E30-AC06 | partial → **met** | `T-E30-06-walls/sight/scene`; healthy animals follow enclosure loops in `T-E30-09-routine`; `LevelEightZoo` calm state.; newer: [calm-high.json](../wave3-sim/evidence/calm-high.json), [calm-low.json](../wave3-sim/evidence/calm-low.json), [review.md](../wave3-sim/evidence/review.md) | — |
| E30-AC07 | met | `T-E30-07-outlets/doors`, high/low `L8.test.ts` first breach timing/point counts and `T-E30-18` browser breach. | — |
| E30-AC08 | met | `T-E30-08-targets`, species bite tests and systemic outbreak case; local perception and protected controls. | — |
| E30-AC09 | met | Five `T-E30-09-*` natural bites/ID/timer/bar eligibility plus browser healthy→infected same-drawn-entity tests. | — |
| E30-AC10 | partial | Shared `tests/sim/ai/zoo-s1/s2/s3.test.ts` and matching browser tests now selected by E30; shared Alpha suite too. | **M; browser** — Close E07 zoo move/bar visual contract and full in-level matrix. Global awareness request in audit C is superseded by explicit L5-only decision. |
| E30-AC11 | met | `T-E30-11`, `09-cap`; mixed systemic turns/Alphas and strict shared capacity. | — |
| E30-AC12 | met | `T-E30-12-district`; D-ZOO public/service loops and enclosure escape connectivity/clearance. | — |
| E30-AC13 | met | Local rotated APC doorway correction passes21 remote regressions and both unchanged native keyboard/phone routes,12/12 survivors transferred in each; same corgi retained. [Proof](../ac-close-l7-l10/README.md#e30-native-boarding-correction--confirmed). | — |
| E30-AC14 | met | `T-E30-14-apc/unarmed/windup/model/loader/browser`, L8 level completion transfer; production campaign callback. | — |
| E30-AC15 | partial | Fresh repeat passes all36 phase/backend/tier/zoom player views, minimum3.097:1, after local heroFill correction; original12 breach failures retained. Shared bars pass current three-size checks, minimum3.0861:1. [Current audit](../ac-close-l7-l10/README.md). | **M; browser** — Current player matrix and bar/occlusion views inspected; all-species photo coverage and performance/light caps remain pending. |
| E30-AC16 | partial | Fresh both-tier streamed calm→tension→combat, sanctuary negative cues, engine700Hz lowpass, captioned pounce and **32/16** saturated voice caps pass. | **Partial:** phase probe is explicitly a presentation adapter; real breach/escape and focus/pause integration remain separately required. [Traces](../ac-close-l7-l10/README.md#native-l7l8-diagnostics--0900-utc). |
| E30-AC17 | met | `T-E30-17`, `17-animal/apc/save`; saved timers/identities, transfer and checkpoint snapshots. | — |
| E30-AC18 | partial | Current native keyboard/phone repeats both pass,12survivors intoL9 and same healthy corgi; original96pass2fail functional receipt retained. Local rotated-hull/navigation trap fixed with21 remote regressions. | All§6 photo spots and exact paired cameras still incomplete; no whole AC acceptance from route completion alone. |
| E30-AC19 | partial | Fresh canonical scoresA5/C5/D6/E4/G5, NOTACCEPTED. All40day/night species frames inspected; pale night fur facets and weak material/environment identity remain. | **M; browser** — Score full calm/outbreak/normal-to-infected/armored-escape A/C/D/E/G pairs ≥7; fix wide-zoom zoo clipping. |
| E30-AC20 | partial | Fresh quiet6pass1fail: desktop high/low11.9/8.0ms framep95,3.8/2.4ms simp95. Both-backend/tier actual breach/conversion probes pass≤50ms (max17.4), all peak caps and collected-JS heap; each records15events. |4xCPU phone fails38.7ms framep95 and8.3ms simp95; retain the existing gates. [Metrics](../ac-close-l7-l10/evidence/l8-native-perf-metrics.json.gz). |

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
| E31-AC08 | met | Fresh9 native HUD cases pass: one-frame/current-max/zero across desktop/portrait/landscape; cumulative8 HP stages × both backends ×3 projects pass original≥3:1 and Home/touch clearance. Remote no-repair500/0HP pass. Opened full/zero desktop/portrait frames. [Proof](../ac-close-l7-l10/README.md#e31-ac08--met). | Separate caption-to-caption overlap is corrected (12px); complete action/text-scale clearance remains an AC16/18 review gap. |
| E31-AC09 | met | `T-E31-09/controls/policy/ram/scope`, terrain-speed high/low, early/late-zero route cases; floor browser. | — |
| E31-AC10 | met | `T-E31-10-bypass/fallback`, all-route zero cases and crash browser input; safe anchors/corgi. | — |
| E31-AC11 | met | `T-E31-11` preserved/early≤20%/late≥80% on three routes and risky-vs-safe comparison. | — |
| E31-AC12 | met | `T-E31-12-S3`, terrain streaming unit/sim/browser; predictive high/low residency bounded 25/9. | — |
| E31-AC13 | met | `T-E31-13-*`, shared chunk-residency/revisit tests and browser retirement scenes; seam/support/IDs/HP state. | — |
| E31-AC14 | met | `T-E31-14-crash/load/legacy`, handover and residency clock/checkpoint tests; migration keeps floor. | — |
| E31-AC15 | met | `T-E31-15-crash/handover` and corresponding keyboard browser cases; axe racks/ownership, abilities/corgi and once-only reset. | — |
| E31-AC16 | partial | Fresh baseline28 completed real routes fail strict3:1. Corrected8landscape routes all reachL10, courier3.038–4.509 and caption12px clear. Isolated22/24 courier views pass; final1.2fill desktop0HP/default2.718–2.722 remains red (22/24 pass). | Navigation≈1.98–2.02 or unmeasured close framing remains below3:1; no clamp/flare substitution. |
| E31-AC17 | partial | All36 route combinations now complete across baseline28 and corrected8 landscape repeats;8 originals had an off-viewport wheel fixture. Real keyboard/touch, both HP states/backends/threezooms andL10 axe handover assertions pass within these red contrast tests. | Complete all§6 route/ram/surrounded/fork/outskirts/seam pairs and zero-error/HUD review; do not count red contrast tests as full AC passes. |
| E31-AC18 | partial | Fresh full-resolution desktop/portrait/landscape start/route/impact/crawl review: A5/D6/F6/G5, must failures and missing pairs. [Canonical review](../../../test-results/epics/E31/review.md). | Navigation/readability/density/lighting and full pair set remain open; ChecklistF wording proposal unadopted. |
| E31-AC19 | partial | Corrected native crash8/8red (cold-load max2747–3081ms); handover2/2pass. Dressed high15/15pass each backend, low7/15each timeout with JS>250MB;16samples unmeasured. Four five-cycle retention cases red: low JS260.111/257.342MB and embedder growth21.36–23.86%. | Original caps and300s limits retained. [Complete native summary](../ac-close-l7-l10/README.md#1548utc--e31-native-continuation-terminal). |
| E31-AC20 | partial | `T-E31-20` continuous seed-1 L1→L9 campaign and armed-roster/continuity regressions.; newer: [final-vitest.json](../postmerge-10/evidence/final-vitest.json), [E31-campaign-seed-1.json](evidence/E31-campaign-seed-1.json) | **Needs PO physical iOS/Android:** device p50≥30 fps remains unproved. A separately labelled 390×844 /4×CPU desktop proxy is proposed; no substitution accepted. [Exact proposal](../ac-close-l7-l10/README.md#proposed-rewrites--awaiting-po-decision). |
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
| E32-AC09 | met | Fresh inherited13move/6bar proofs;4/4 native regular/Mega model/bar cases with all4 PNGs opened. Fresh3 asset LOD checks confirm same nominal body height. Selected Node quotas/specials/resistance/queue/stream/bar contracts pass. [Proof](../ac-close-l7-l10/README.md#e32-ac09--met). | — |
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
| E32-AC29 | missing → **partial** | Fresh native functional repeat88/88 passes: three minigun input modes, checkpoint/terminal/carry, finale and ending across backend/tier/zoom, six live region boundaries and WebGPU smoke. [Receipt](../ac-close-l7-l10/evidence/verify-E32-repeat-functional.json.gz). | **M; browser** — Full mouse-only/touch aggregate and all region/finale pairs plus scored HUD review remain incomplete. |
| E32-AC30 | partial | Opened all7 default region originals and both-backend/tier mist sequence; regionA4/5/6/4/5/4/5,C6/D6/F6/G4,Hunmeasured. [Canonical review](../../../test-results/epics/E32/review.md). |Earlier0.5 target-only photos invalid and retained separately; corrected radius/distance-checked repeat4/4passes,128source frames inspected. Density/identity, shadow/material/telegraph and full finale/ending must items remain open. |
| E32-AC31 | partial | Native Alpha/dog2/2, arena8/8 and mixed-assault8/8pass. Campus8/8red: R6population70/46<80/50; recorded timings fit caps, remaining assertions do not execute. | Later native files and physical iOS/Android remain unmeasured; separately labelled device proxy proposed, unadopted. [Current per-AC ledger](../ac-close-l7-l10/final-ac-status.md). |
| E32-AC32 | met | `T-E32-32` current continuous seed-1 L1→L10 **passes** (L10 **26:10.533**, zero L10 deaths); save/campaign callbacks, roster/abilities, mandatory axe reset and one release/victory.; newer: [E32-campaign-seed-1.json](evidence/E32-campaign-seed-1.json) | — |

### 2026-10-22 extended closure ledger

The current [31-row met/red/unmeasured ledger](../ac-close-l7-l10/final-ac-status.md) supersedes older queued wording for E25/E29–E32. Seven starting partials are met; all five epics remain in-progress. E30-AC13 is restored met by native12/12 keyboard/touch boarding after the local rotated-hull correction. Native completion continues to the extended16:00UTC cutoff; original failures and interrupted receipts are retained.

### Final2026-10-22 cutoff disposition

[All31ACs:7met/15red/9unmeasured](../ac-close-l7-l10/final-ac-status.md). All five epics remain in-progress; all owned checks terminal. E32 WebGL mist4/4passes; campus8population failures;32district/pullout/finale/startup cases unmeasured. E31 low D2 leaves16samples unmeasured; low heap and all-four embedder retention are red. E29 current native performance is unmeasured; old failures remain historical. Original verifier receipts are preserved; no full green verifier or approved rewrite is claimed.
