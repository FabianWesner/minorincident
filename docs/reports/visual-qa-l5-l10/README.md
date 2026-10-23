# Visual QA L5–L10, PO style (PROD 13k)

**Verdict: three P1s, all older than 13k.** The 13j→13k A/B shows no regression in L5–L10; the only large diffs are the intended L9 verge dressing and night lighting. Two of the P1s are the player vehicle in L9 (01, 02). The third, in L6, is the headlamp prompt riding on the courier because of the corgi fetch (03). L5–L10 had never been checked this way, and none of the findings below was on the PO checklist.

Build: main `3b7e4deda`. That is PROD 13k (`d851909d3`) plus the browser-pool tooling merge, with no game changes. Local preview on port 3998 for the playtests and repros; `qa:ab` used its own `dist` preview. Settings: WebGPU, low quality, 1280×720, zoom 1.5 and zoom 1, headless, one browser unit at a time.

## Tools
- Both invariant halves are green, so none of their reds apply to L5–L10.
- `npm run qa:invariants:sim:remote`: **8 files / 27 tests green**.
- `npm run qa:invariants:render`: **11/11 green** on the second attempt. The first aborted with exit 75 (`fetch failed`) because the shared browser pool went down during exclusive admission.
  - Single cold load, level click → playable, local dist vs PROD, in ms: L5 4666/5108, L6 2348/2832, L7 3761/4043, L8 4277/4511, L9 8726/9259, L10 6298/6774.
  - L9 and L10 are still over the separate 6 s absolute budget. That budget needs 20 loads and was not part of this run.
- `npm run qa:ab -- --baseline https://00a9db56.minor-incident.pages.dev --candidate dist --levels L5-L10`: **48/48 stops measured, 0 errors.** Above 2 %:
  - L9 start, gate and handover (35–100 %): the intended 13k verge dressing, billboards, fewer pale streaks and a red flare.
  - L9 finale (14 %): the same dressing.
  - L8 finale at zoom 1 (27 %): sim drift in survivor positions.
  - Everything else is 0–3.6 %. I looked at every changed sheet and at the candidate stills of all quiet L5–L8 and L10 stops.
  - Several stops have no scripted content at their anchor (L8 gate: an empty street with a hut).
- Real-input playtest, WebGPU, low:
  - Continue campaign from a seeded L5-default save (female), zoom 1.5: L5 152 s, L6 244 s, L7 120 s, L8 74 s and L9 146 s, all finished with 0 skips. L10 hit the 15 min cap. The driver could not hold the console, then looped mega↔hold through debug skips (Q-128 again). I stopped it.
  - Debug entry at zoom 1, L7–L10: L8 finished in 139 s. L7's session hung on a closed page after the bus departure. L9 is Q-139. L10 did not run because the harness threw "Crossing handover requires completed crawl".
  - Frames over 200 ms appeared only while the loading card was up (L5 317 ms, L6 250 ms). No gameplay frame went over 200 ms.
- Own bot tour, L5–L6, zoom 1.5, a shot every 8 s: about 70 frames, plus two probes (L6 headlamp, L9 APC spot). L7+ cannot run `bot.start` (E19 NotImplemented).

## Per level: glitches / stunning (1–10)
- **L5 · 6.** No P1.
  - The bus hiding-place ring sits behind the wreck and is hidden at zoom 1.5; the driver lost 37 s there (Q-140).
  - Survivors pile into each other at the Metro shutter (Q-145).
  - The street dressing (shops, tank, fires) is the richest of L5–L10.
- **L6 · 7.** P1: the headlamp prompt follows the courier (Q-138).
  - The end shot is a blank maroon roof (Q-144).
  - The tunnel crowd and lighting read well.
- **L7 · 5.**
  - The exit truck is a black silhouette (Q-142).
  - Red gore squares look like confetti (Q-143).
  - A point-blank rocket whites out the whole screen (Q-148).
  - The ground is a flat dark purple.
- **L8 · 6.** The boarding wait shows nobody coming (Q-141). The zoo crowd at the start is good.
- **L9 · 5.**
  - P1: the APC body vanishes at the collapse and its wheels float (Q-136).
  - P1: the corgi is inside the APC hull at the start (Q-137).
  - The APC stuck off-road in one run (Q-139).
  - A giant flat white arrow (Q-146).
  - 13k dressing helps, but the bridge deck is a bare slab.
- **L10 · 5.**
  - The slam telegraph reads as debug lines (Q-147).
  - Kilometres of empty flat ground between beats (Q-150).
  - Unhittable infected at the console (Q-149).
  - Alphas and the Mega Alpha are not judged (under rework).

## New findings (Q-136 onward, ready to paste)
- Q-136. P1 L9 bridge collapse (finale): mid-fall the APC body disappears and its six wheels hang in the air; at +0.6 s two wheels already float above the falling hull. Same on 13j and 13k. Capture 01 (A/B `l9-finale`, +0.6 s / +1.2 s).
- Q-137. P1 L9 drive start: for the first ~0.5 s the corgi stands inside the APC's side hull between the wheels before it boards. Same on 13j and 13k. Capture 02 (+0.0 s motion frame).
- Q-138. P1 L6 shelter: if the courier does not pick up the headlamp, the corgi keeps "fetching" it. `Companion.canFetch` accepts `pickup.headlamp`, which only the E hold collects, and the fetch teleports it to the courier. The "Pick up headlamp · Stand here · E" panel and its dark pickup disc then ride on the courier and survivors for ~2 min, out to x≈68 in the tunnel. Probe: the lamp entity moves from (1.5, −2) to the courier's position at tick 600 and tracks her until tick 7200. Capture 03.
- Q-139. P2 L9 drive (debug entry, real input, zoom 1): the APC left the road and stopped dead at (402, −16.8), 70 m before the bridge trigger. It did not move for 7 min until the level cap. Probe: `solids.clear((402, −16.8), 1.6)` is false, so it is wedged against a solid off the road. The campaign-entry run drove through. Capture 04.
- Q-140. P2 L5 "Search a wrecked bus on Lakeshore Avenue": the ring (−45, 42.6) is on the far side of the bus wreck. At zoom 1.5 the bus hides the ring and the courier's feet, so she reads as standing on the bus roof. The driver stood there 37 s. The pharmacy back-room ring took another 23 s. Capture 05.
- Q-141. P2 L8 boarding: "Wait for everyone to board · 6/13 aboard · Survivor 2, Survivor 3 missing (+5 others)" ran 20+ s with no survivor on screen, on the minimap or marked. Capture 06.
- Q-142. P3 L7 start and rocket handover: the evacuation truck by the exit renders as an unlit black silhouette (lighting void), on featureless dark purple ground with a stair-stepped edge. Capture 07.
- Q-143. P3 L7 gore: flat bright-red squares scattered round corpses read as confetti, not blood. Capture 08.
- Q-144. P3 L6 end shot: the camera frames a blank maroon flat roof. The result card says "Survivors out 15 / Survivors in 28" while the step said "0/16 out" and the summary "Rescued 19". Check the numbers. Capture 09.
- Q-145. P3 L5 Metro finale: three survivors merge into one another at the shutter, and the camera looks down a bare red shaft. Capture 10.
- Q-146. P3 L9 outskirts approach: a huge flat white 3D arrow overlaps the APC and reads as debug geometry. Same on 13j. Capture 11.
- Q-147. P3 L10 console and research: the Alpha slam telegraph draws straight red line segments that look like debug lines. Capture 12. Not judged as Alpha art.
- Q-148. P3 L7: a rocket fired point-blank at the truck whites out the whole frame at zoom 1. Capture 13.
- Q-149. P2 (unconfirmed) L10 hold: the driver flagged infected #624 at 1.1 m that took no damage from 8 s of attacks (hp 60/60) at the console.
- Q-150. P3 stunning: the L9 bridge deck (a bare slab with black crack lines, capture 14) and the L10 walk (hundreds of metres of plain flat ground, capture 15) look cheap at zoom 1.5.
- Q-151. P3 tooling:
  - The playtest L7 session loops "Target page closed" for 10 min after the bus departure (browser pool up).
  - The debug-entry L9 handover throws "Crossing handover requires completed crawl".
  - The test API `bot.start` is NotImplemented for L7–L10, so the bot tour cannot cover them.

## Captures kept (15)
01 L9 collapse · 02 L9 corgi in hull · 03 L6 headlamp prompt · 04 L9 APC stuck · 05 L5 bus ring · 06 L8 boarding wait · 07 L7 black truck · 08 L7 gore squares · 09 L6 end shot · 10 L5 shutter pile · 11 L9 arrow · 12 L10 telegraph · 13 L7 whiteout · 14 L9 deck · 15 L10 plain. The A/B sheets (01, 02, 11, 14) show 13j on the left and 13k in the middle.
