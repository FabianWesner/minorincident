# E24 — Level 6: The Subway

Branch: `lane/e24-l6`. No deployment or merge to main. Evidence recorded 2026-10-10.

## Implementation

- Replace the retired helicopter finale with Lakeshore shelter, a 216 m confined subway route and Northgate’s raised night street. Derive the layout from shipped station/tunnel/maintenance/decay assets; retain the existing dead escalator and exit-gate joints. No placeholder or externally licensed asset.
- Carry the actual L5 rescued ids and weapon racks, recording ownership of equipped actions at the handover so the L5 preset’s fire axe remains a valid campaign save. Introduce no weapon pickup. Marcus leads the group and is its only armed civilian.
- Make injuries part of the story: Rosa (or the fallback medic) kneels beside a dressed patient; resting and seated adults have the shipped injury variants. Checkpointed HUD dialogue identifies an ankle wrap, pain on retreat, a lagging injured survivor and help on rejoining; the medic and patient speak five seconds apart so both captions can be read. Injured adults move at 1.4 m/s and need protection while the healthy group moves at 2.2 m/s.
- Add seeded two-stage maintenance breaches, door bangs, synchronous fluorescent-to-emergency power switching, flashlight shadow, identity-preserving infection and legal tier caps. Sound opens with shelter voices/radio/hum and changes to breach screams and tunnel pressure.
- Add three 2.2 m service gates, one-second stand interactions, protection against trapping followers and nearby braceable crates. Infected approach gates using their remembered sightings, then attack the actual barricade. Five attackers break an unbraced gate in 9.82 s.
- Add all four death/respawn snapshots, straggler collection/rejoining, tail-cover waits, zero-survivor completion, the exact ending caption, campaign totals and credits returning to the menu.
- Preload L6 cast/materials, the runner’s close rig and all route LOD batches; prepare frozen corpse shaders during briefing and switch fluorescent/emergency lamp power through resident uniforms. Empty frozen pages hold no fake bodies; the first real death reuses their prepared geometry and material. Retain all existing perf budgets. Cache the exit-gate pose and place elevated street smoke/flames above the actual street surface.
- Update obsolete eight-district L6 navigation, ambient-density, lighting and weather fixtures to the replacement district. Legacy multi-district coverage remains a separate explicit composition. Scene Lab crops use the authored nav geometry and ground height.

## Validation scope

The scheduler explicitly requires single-seed validation and forbids long bot batteries. The epic’s 20-seed AC02/03/09/10 and ten-seed AC08 sampling are therefore replaced for this job by seed 1; these results establish that recorded run, not medians or statistical success rates. No new battery was added. A legacy 20-seed ride-clearance fixture was accidentally selected by a targeted post-merge rerun, and a later unscoped refresh entered legacy `tests/levels` batteries not identified by that name filter. Both were terminated. The final broad command explicitly selects `tests/unit tests/sim` and applies the requested battery filter. No acceptance evidence is taken from the cancelled fixture. The remote unit/sim command excludes existing tests whose titles contain `20 seeds`, `20-seed` or `battery` as requested.

AC19 asks for at least 40 infected on both tiers while AC13 caps phone at 30. The phone fixture measures the maximum legal 30, with at least 25 moving adults. High measures at least 40 infected and 25 moving adults. Caps and budgets are unchanged.

## Acceptance evidence

| AC | Result | Test / evidence |
| --- | --- | --- |
| E24-AC01 | PASS | `T-E24-01` structural graph, no fail timer/survivor-death failure; zero-survivor completion regression. |
| E24-AC02 | PASS (single seed) | [Complete seed 1](complete-seed-1.json): 264.68 s, 28/29 rescued (96.6%), zero deaths, ordinary inputs and no cheats; within 180–270 s. |
| E24-AC03 | PASS (single seed) | [Newbie seed 1](newbie-seed-1.json): 264.48 s, 28/29 rescued, zero deaths; within 195–300 s. |
| E24-AC04 | PASS | Shelter fixture checks both tiers, exact carried ids, all five routine kinds, guard-only firearm, calm/injury beats, no infected or combat before breach. [Shelter](shelter.json). |
| E24-AC05 | PASS | No pickup in layout/mission; start/end racks equal. [Continuous campaign](campaign-seed-1.json) records actual L5 → L6 rack equality. |
| E24-AC06 | PASS | `T-E24-06/07`: seed-3 first breach 30.45 s, second 26.15 s later, legal access origins, multiple doors and ≥1.5 s bang lead. [Breaches](breaches.json). |
| E24-AC07 | PASS | Same seed-3 idle fixture observes abandonment on breach2 because the bite threshold was reached; complete seed 1 takes the +15 s branch at 69.22 s. Power-off occurs on the second-breach tick, emergency and flashlight enabled. |
| E24-AC08 | PASS (single seed) | [Continuous complete campaign, seed 1](campaign-seed-1.json): all six levels complete, zero deaths, escalating racks and all five rescued L5 ids carried. [Continuous newbie campaign](campaign-newbie-seed-1.json) completes all six in 1,365.52 s, inside 870–1,590 s. Single-seed scope as above. |
| E24-AC09 | PASS (single seed) | [Evade-only](evade-only-seed-1.json): 0 rescued by 600 s versus complete 28/29. Tail-threat gate fixture proves group waits for distant protector. No median claim. |
| E24-AC10 | PASS (single seed) | Movement/collection fixture and complete record: four injured stragglers, all four rejoined (100%); newbie also rejoins all four. |
| E24-AC11 | PASS | Three 2.2 m gates, actual sight/movement blocking, survivor refusal, one-second interaction and one-time brace HP. [Gate](gate.json), [five-infected siege](gate-siege.json): 9.82 s, 370 HP. |
| E24-AC12 | PASS | `l6-static.test.ts`: 216 m route, 6.9 m tunnel, three side corridors, two cross-passages, pump/signal rooms, blocker spacing and 30×30 m surface patch. |
| E24-AC13 | PASS | Both tier caps; [infection](infection.json) retains entity identity through 2.5–3.5 s turn. Existing sight-only audit included in remote suite. |
| E24-AC14 | PASS | Night preset/static checks, continuous campaign total sums, and physical ending/counts/visible credits/automatic menu return pass. [Result](real-result.png), [credits](real-credits.png). |
| E24-AC15 | PASS | Actual hero mesh masks: [shelter](l6-shelter-fails-readability.json) 5.32:1; [tunnel](l6-tunnel-retreat-readability.json) 7.52:1. Each sampled infected’s maximum is red eye glow; promoted hero light has shadow. |
| E24-AC16 | PASS | [Four real death/respawn checkpoint restores](checkpoints.json): same ids, positions within .2 m, gates, power and outbreak state. |
| E24-AC17 | PASS | Physical keyboard/mouse, native machine gun and `E`, seed 1: 261.77 s, 28/29 rescued, zero deaths, all four injured stragglers rejoined and all seven photo spots; fixture rejects console errors. [Record](real-input.json). |
| E24-AC18 | PASS | Three Scene Lab sheets and all seven real-game photographs inspected. Required compositions score 7–7.5/10; checklists A/D/G pass and no P0/P1 is visible. [Review](review.md). |
| E24-AC19 | PASS | Four unchanged native-GPU gates pass: high p95 7.4 ms / max 16.6 ms; phone p50 13.6 ms / max 64.0 ms. Breach2/abandon maxima: high 26.2/8.7 ms, phone 34.3/35.0 ms. [High](perf/high.json), [phone](perf/low.json), [high transitions](perf/transitions-high.json), [phone transitions](perf/transitions-low.json), [final gate log](verify-final.log). [Five-load memory/resource gate](memory-playwright.json) also passes: high ≤113.29 MB / 400 MB and phone ≤88.45 MB / 250 MB, with no resource-retention budget violation. Legal phone count exception documented above. |

## E28-AC01 — closed

The redesigned Northgate night exit fixture checks underground weather `none` becoming surface `fog`, zero rain/snow and the actual `L6` night lighting preset. [Weather evidence](exit-weather.json). Night/fog Scene Lab fixture passes, with the raised courier, wreck, crater and persistent fire inspected across four sheet frames.

## Gate results

Final tested source: `a516cd43`, after `git merge main` reported already up to date at `baf1fb5a`. No source changes followed that merge.

- Typecheck, lint and production build: PASS, no build warnings.
- Final remote E24 selection: 26 passed, zero failed; this includes the complete/newbie/campaign single-seed cases and the frozen-corpse/power regressions. [JSON](vitest.json).
- All-level browser suite: 29/29 passed. [JSON](levels-playwright.json), [log](levels-final.log).
- Final E24/browser/smoke selection across desktop, iPhone and WebKit: 31/31 passed. [JSON](playwright-headless.json).
- Five L1/L6 reloads on each tier: 2/2 passed, settled L6 heap high ≤113.29 MB and phone ≤88.45 MB, within unchanged 400/250 MB limits; final L1 heap/geometries/textures remain within 10% of the first load. [High](memory-high.json), [phone](memory-low.json), [log](memory-final.log).
- Broad remote `tests/unit tests/sim` with at most four workers and the requested battery filter: 914 passed, zero failed, 11 excluded ([JSON](unit-sim-final.json), [log](unit-sim-final.log)). A prior refresh hit the existing director timing limit (4.061 ms against 4 ms); its isolated nine-test retry passed unchanged budgets. Temporary CPU diagnostic instrumentation also caused the existing bundle-warning assertion to fail; it was removed before the final-source build. No diagnostic run supplies acceptance evidence.
- Final native-GPU perf gate: 4/4 passed with the unchanged frame, geometry, draw-call and transition budgets. [JSON](playwright-gpu.json).

The full gate command is `MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3666 npm run verify -- E24` ([log](verify-final.log), [checks](checks.json)); every recorded command exits zero. Interrupted browser attempts left two lane-local preview servers; those were removed, and final browser runs use fresh ports.

## Visual review

Three contact sheets, their full-size frame 90, all seven physical-input photographs and ending UI were inspected; findings and scores are in [review.md](review.md). Earlier discarded captures exposed a street-height error hiding the courier and flames below the raised street; the authored-ground teleport/VFX correction is visible in the accepted exit fixtures.
