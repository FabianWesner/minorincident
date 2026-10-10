# E23 vision review — 2026-10-10

Final `843e8002` browser-level run: 24/24 passed. Re-inspected its group, closed-shutter shelter and all four real-game recognition pairs; all five followers are visible in the group and enter L6. Reviewed with the image-reading tool: all 17 `scenes/qa-l5-*/sheet.jpg` contact sheets; the four real-game `recognition-pair-*.png` comparisons; the real-input group capture. Scene Lab lamp power differs from W5 gameplay, so blackout and lighting contrast are judged from the real-game comparisons.

## Pair comparisons — checklist E and A

| Pair | Same place [must] | Worse condition [must] | Varied decay | Mood | Score |
| --- | --- | --- | --- | --- | --- |
| Plaza | PASS: the square, paving and vehicle-staging area retain the same camera and placement. | PASS: ruined frontages, wrecked military column, fire and bodies replace orderly safety. | PASS: craters, vehicles and shells have different shapes. | PASS: red dusk replaces warm daylight. | 8/10 |
| Harbor Street | PASS: identical road, paving, lamps and left frontage. | PASS: broken frontage and burned truck replace intact windows and parked SUV. | PASS: glass, shell damage and wreck. | PASS: dead lamps/windows and violet road shadows. | 8/10 |
| Metro entrance | PASS: recognizable canopy, pillars, sign frame and stairs. | PASS: fractured storefront and burned vehicles, dark entrance. | PASS: varied rubble and wreckage. | PASS: red/violet gloom. | 8/10 |
| Kessler Lane | PASS: brick building, steps and yard fencing match exactly. | PASS: broken dark windows and bodies in the escape lane. | PASS: different corpses and damaged openings. | PASS: strong red sunset and dead windows. | 7/10 |

Checklist A: warm saturated palette PASS; tinted violet shadows PASS; fire/player light provides emissive glow PASS (street lights intentionally unpowered); high three-quarter camera PASS; chunky beveled proportions PASS; clutter density PASS. Rounded lush foliage is not the visual priority of the damaged city. Final group framing looks along Harbor Street from the west, with the courier stopped in the open lane. It avoids the foreground roof and HUD that obscured the rejected intermediate captures.

## Scene Lab sequences

- **Emergence:** courier appears by the familiar brick Kessler frontage. Roof occlusion partly hides the approach, then the outside lane opens; damaged windows and red dusk are clear.
- **Five hiding places:** Dale appears behind the blackened military truck; Rosa is at the damaged pharmacy; Okafor is by the church; Mia occupies the apartment entry; Sam is by the bus. The props give distinct locations without adding placeholder artwork. Static cues do not establish an animated flashlight flicker.
- **Group:** frames 0–420 show the armed courier moving first and five differently dressed adults following in staggered slots. The unarmed group and the distance behind the courier communicate vulnerability; bodies remain visible through turns.
- **Metro arrival:** entrance landmarks and follower approach are visible around the wreck. The sheet establishes approach composition, not the final shutter animation.
- **Sparse infected:** the wide ruined plaza has empty space between wandering figures, with craters, cars, corpses and fires. The scene metrics report five actor clipping hits/four piercing frames; this is recorded rather than treated as a clean clipping gate. The contact sheet alone does not identify a sustained P1 intersection.
- **Eight paired scenes:** the L4/L5 views retain landmark footprints and roads. Damage is strongest at the plaza and Metro, subtler at Kessler; the real-game pairs establish the lamp blackout that Scene Lab does not.

## Checklist D — group protection

Scene Lab group: player identifiable PASS (hat, backpack and weapons); figures separable PASS (different silhouettes and clothing); unarmed followers behind the only armed lead PASS. Combat telegraphs are not exercised by this scene. Final real-input group: PASS. All five followers have distinct visible heads and bodies; white/grey hair, red clothing, blue clothing and the brown hat distinguish the group. The armed green-clad courier stands to their left, with the corgi between them. Damaged frontage and corpses make the street feel unsafe. Figures are clear of roofs and HUD; no P0/P1 observed in this capture. The final photo advances only the existing render clock to expire paused muzzle/tracer effects; the five silhouettes remain clear. Score 8/10.

## Checklist G — sunset/gloom

PASS: orange/red surfaces and violet shadows; player remains readable against dark streets; dead windows and lamps contrast with L4 safety. PASS: sources visible in fire/flashlight captures, geometry retains shadows. Monotone gloom and 50% sun reduction are established by `gloom.json`; screenshots support the mood, not the numerical monotonicity. Reflections are subdued on dry damaged roads. Score: 8/10 for the E23 dusk mood.

No blanket claim of every vision checklist or every runtime collision being exercised. The final shelter frame shows the courier at the Metro ring, the grey closed shutter behind the canopy pillars and the surviving group at the street edge. The subtitle announces closure. It does not show the followers descending the interior stairs; the sim and campaign evidence establish shelter/handover. The group image and all recognition pairs have been inspected directly.

## Sign-of-life photo

The final capture was taken from the bus approach, before Sam was found, and the browser assertion records a Sam cue within the preceding second. The bus, shattered front and wreck remain recognizable; the courier is nearby. The static flashlight prop is not evidence of an animated blink. The positioned cue and fresh caption/ping establish the sign of life.

## Final escort replay review

The western-approach replay was inspected again: all five living follower silhouettes are visible in the open road, with clear space around the armed courier. Their saved health values are all 60. The shelter frame shows the closed grey shutter and the group to the left; the nearest foreground pillar partly crops the leftmost follower. The bus approach retains Sam’s fresh subtitle. These images support the earlier 8/10 group score; the shelter crop is a composition limitation, not proof of an interior descent.

The four recognition pairs were inspected again after the final `9d60a918` verification: plaza and Harbor Street show wrecked vehicles and broken facades; Metro retains its canopy/sign/stair landmarks with dead lights; Kessler retains the yard and brick frontage with broken dark windows and corpses. The earlier scores (8/8/8/7) remain supported.

The final 24/24 levels run on `21dc6300` produced another inspected set: all five group silhouettes remain visible, the closed shelter shutter and foreground-pillar crop are unchanged, and all four recognition scores remain supported.
