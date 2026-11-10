# r31-epilogue: the L10 ending as a payoff (main a0957730)

Fixes the r30-finale-qa epilogue findings (release beat, wave shots, "back to her", pull-out, P3s) against
`docs/design/story-script.md` (Epilogue). Contact sheet (16 frames, story order; images are git-ignored by the archive rule): `contact-sheet.jpg` next to this file locally and the full-size copy below.
Raw captures, logs and the full-size sheet: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r31-epilogue/`
(`run2-high-z1-gl`, `run3-low-z15-gpu`, `contact-sheet-po.jpg`). Old sheet: `.../scratchpad/r30-finale/contact-sheet-po.jpg`.

## Per beat

| Beat | Before (r30) | Now |
|---|---|---|
| 1 Release 0–8 s | no dust column, no tide; empty when the fight ended away from the console | Glowing green column rises from the console (`CureGlow`, one additive instanced draw), a burst, a rolling tide ring that follows the sim cure radius out to ~85 m, settling motes and low haze. The follow camera eases back ×2.3 in the first 2 s so column and ring are in frame (player keeps control). `LevelTenEpilogue.gatherCured()` spawns a small authored cured crowd (7 high / 4 low: civilians, soldiers, a paramedic) around her when fewer are within 14 m; they kneel (`npc-cower`) and stand into the normal cured routine (sit / look around / walk to her). They keep ≥1.8 m from bodies and ≥5 m from the Mega's body; bodies are never moved. The corgi sits after 0.8 s still (was 4 s). |
| 2 Wave 8–28 s | props on flat coloured slabs, tiny figures, flat green disc | Five full-scale sets built from the levels' district assets (corn/burned farm, river + bridge + wrecked APC/truck, zoo gate + reptile house + fences, L7 city block + metro, Medical Annex + depot), each on palette ground/road surfaces that fade into the dawn fog. A rolling wall of green dust crosses each shot; infected (real `inf.*` models) stand and shamble, fold to their knees when the wall reaches them and stand up as people (`npc-*` models). Hard cuts between shots. |
| 3 Survivors 28–45 s | empty-trucks shot when nobody was sheltered | The trucks shot is built only when a named survivor is alive; otherwise the town shot (people walking out) takes the slot. Hangar shot: research hall with Voss, Ruiz and Sam/Reyes walking out. |
| 4 Back to her 45–50 s | she stood in the dark among cured soldiers | She sits on the platform stair (`npc-sit`, seat from `finale.platformStair`, pinned after the pose update; the old override never reached the drawn figure), corgi sitting against her knee, cured people in a loose arc in front, clear of the Mega's body. Sunrise lifts the hemisphere fill (`cureDawn`). "Delivered ✓" as before. |
| 5 Pull-out 50–65 s | flat olive plain, conifer clumps, little green | Steeper camera (≈42° instead of ≈25°) that fits the whole level; the panorama ground now shows the regions: farm parcels (corn gold / plough / pasture), the fenced restricted zone, the hangar apron, the burned corridor, the dark complex. 22 low green dust banks along the route (was 8) and a stronger dust tint from the air; the column grows with the pull so it stays visible at 1 km. |
| P3s | | "Release it. Now." cleared on release; cured never inside the Mega; credits open with text on screen (roll starts at 20 % of the panel instead of below it); the 267 ms pull-out hitch did not reproduce (0 frames > 100 ms in the whole epilogue on low/WebGPU). |

Perf: the montage used to hide every scene child, which changes the light set and recompiles programs; it now draws its
sets 2.6 km south of the level and hides nothing. Before that change the first iteration showed 333–650 ms frames at each
shot start (high/WebGL2); after it: run2 high/z1/WebGL2 0 frames > 100 ms from release to the title, run3 low/z1.5/WebGPU
0 frames > 100 ms in the whole run. The remaining 117–250 ms frames in run2 are after "Skip credits" (thanks card and menu).
Native perf comparison not run (perf pending, orchestrator quiet window).

## Real play (tools/qa/r28-vqa-fixture-play.ts, l10-dispersal-console, `npm run build:qa`, preview :4897)

| run | quality / zoom / backend | result |
|---|---|---|
| run1-high-z1-gl | high / 1 / WebGL2, real fight | 270 s: the script never killed the Mega (2944/3000 HP; the bot keeps targeting escorts). Not an epilogue result. |
| run2-high-z1-gl | high / 1 / WebGL2 | console E → charge → release (real prompt, E) → full epilogue → title → credits → Skip → menu (`phase done`). 0 page errors. |
| run3-low-z15-gpu | low / 1.5 / WebGPU | same, full ending to the menu, 0 page errors, 0 frames > 100 ms. |

Shortcut used in run2/run3 (logged `--setup`): Mega HP set to 1 and charge started at 2700/3600 ticks so the ending is
reached in ~20 s; everything after that is real input (route to the console, hold E, the release prompt with E, the real
Skip-credits button). The Mega fight belongs to r31-megafight. run2 predates the stair-seat fix (frames 41–44 there show
the old position); run3 has the final code for every beat.

## Checks
- `npx tsc --noEmit`, `npx eslint` on all touched files: clean.
- Focused: `npx vitest run tests/engine/l10-camera-framing.test.ts` 3/3 (the release/closing staging assertions are folded
  into the existing L10 case because of the 150-case test budget).
- `npm run test:gate`: see the lane report (first run hit the 240 s budget while the threat audit and a browser ran in parallel; navigation A* passes alone).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L10`: skilled complete, 0 L10 flags (only `PARTIAL_LEVEL_SELECTION`).
- Scene Lab `qa-l10-epilogue`, `qa-l10-title-credits`: pass, bounds unchanged (Scene Lab scenarios do not create the
  ending view, so these do not show the cinematic; real play above does).

## Browser QA still needed
- L10 ending with a real campaign save (survivors sheltered, Sam alive) to see the trucks shot with Mia/Rosa/Dale/Okafor.
- High / zoom 1.5 and low / WebGL2 full endings; portrait aspect of the new sets (cameras scale back by aspect but were not captured).
- The 50–52 s frames where the camera climbs through the green dust banks read as a pale green wash for ~1 s (run3 s044–s045): judge or lower the banks.
- Corgi "head on her knee": it sits against her knee (no head-rest pose exists); the figure reads small at the closing distance.
