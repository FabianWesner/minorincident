# r34-l8qa: r33-vqa findings for L8 animals, Nadia's lion line, fixtures, L5 (2026-11-11)

Base 7df2bd81. Captures (not in git): `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r34/`.

## 1. Lion pounce marker (red lane)
- Reproduced in Scene Lab (`lion-sheet/sheet.jpg`): the authored `lion.pounce` already drew the amber ring (frames 132, 264, 324), but after the scripted pounces the lion's ordinary windup (special `pin`, no authored move) drew the shared red `charge` lane (frames 396, 492, 588, 696).
- Cause: `Vfx.onTelegraph` only knew `lion.pounce/lion.flank` moves; the ordinary windup event has no `move`.
- Fix (`src/render/vfx/Vfx.ts`): lion/lioness ordinary windups use the same amber landing ring at the target. Proven in Scene Lab (`a1/m1.jpg`, left cell: amber ring under the courier while the lion attacks).
- Real play (`play-lion*/`): the arena path never drew a red lane; the red rings in those sheets belong to ordinary infected. An amber ring did not land inside a captured frame in real play (shots every 1-2 s), so the arena ring stays proven by Scene Lab only.

## 2. Animal night colour
- Cause: coat hue is lost under the cool night key and the s33 luminance ceiling. Fix (`src/render/CrowdView.ts`): luminance-normalised, saturation-boosted coat fill for zoo animal bosses and healthy zoo animals (`animalHue`, species-agnostic because the L8 zoo materials are shared across species; a first per-species flamingo constant turned every L8 animal pink, caught in real play).
- Real play L8 high WebGPU zoom 1.5 (`play-lion4/sheet.jpg`): lion and lioness read tan/orange with a mane. Healthy lion and lioness behind the fence at the Nadia stop are tan (`play-l8-start3/sheet-lionstop.jpg`).
- Flamingo pink: verified only in Scene Lab (before the species-agnostic change, `a3/m.jpg`); re-run through `scene:gate` below, not re-captured in L8 real play. Gorilla, elephant and zebra not re-compared in real play.

## 3. Nadia's lion line
- At the old stop (-38,0) the lion at (-45,-13) was 16 m away: out of frame. New stop (-44,-10) (3 m from the fence, lion ~5 m), then a leg at (-40,3) (keeps the tour-animal test: elephant within 18 m). The line also requires the lion within 10 m of the courier, else it is dropped (`LevelEightZoo.ts`).
- Real play (`play-l8-start3/sheet-lionstop.jpg`): subtitle plays with the tan lion and lioness visible beyond the fence. Bot probe `tools/qa/diag/r34-lionline.ts` seeds 1,2,4: line at 60-61 s, lion 5 m.

## 4. Fixtures
- Elephant HP 1200 and no launcher were already fixed by r33-l8route (rack army-mg/shotgun/handgun). Stale: `l8-before-gorilla` (pre-breach, checkpoint `sanctuary`). Generator (`tools/qa/make-checkpoint.ts`) now saves each arena fixture after the breach and after the previous arena's clear; regenerated lion/gorilla/elephant/elephant-engaged (87-163 KB each), README table updated. `tools/qa/diag/r34-fixture-info.ts` prints contents. The gorilla fixture is `.br` now (old `.json.gz` removed).

## 5. L5
- Marker: after the first survivor follows, `markerAnchor` points at the next route survivor (Okafor, church) until found. Real play (`play-l5c/`): tracker "Look for anyone still alive · 34 m · Survivors found 1/5" with the objective pin.
- Infected on the way: NOT done. I added three far "sentry" infected 9.6-10.5 m off the line (west of Mia's pocket) but none was drawn at zoom 1.5 (`play-l5d/sheet.jpg`): the corridor rule (no infected within 9 m of cellar -> Mia -> Okafor, tested in war-waves) keeps them outside the ~6 m visible band, so I reverted them. Seeing infected on that walk needs a PO/orchestrator decision to relax the corridor (e.g. 1-2 slow infected 12-18 m ahead on the street with a small leash).

## Checks
- Threat audit L5,L8: skilled complete both. Flags: `L5/step/look:SKILLED_BELOW_ATTACKS_PER_MINUTE_3` (known since r31-l5rescue) and `L8/KITING_*` (identical on unmodified main, measured with my LevelEightZoo change reverted).
- L8 bot seeds 1-6 (`l8carrier`): all end, 343-377 s.
- tsc, eslint clean; `tests/engine/missions.test.ts` 6/6.
- scene:gate, test:gate, test:smoke: see the lane report.
