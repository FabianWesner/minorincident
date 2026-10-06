# E19 — Milestone 1 playable slice (segments 1–3 only)

The real title → character selection → L1 flow ends at “Milestone 1 complete — thanks for playing”. Restart returns to the unarmed morning. This delivers the product-owner playtest boundary; the full E19 epic remains unfinished.

## Playable behavior

The survivor starts on the path in front of her house in D-RES, with one corgi, nearby walking neighbors, porches, fences, hedges, mailboxes, sidewalks and parked cars in the residential district. The movement hint follows the mouse/keyboard/touch scheme. At Joe’s Diner the healthy delivery driver becomes the named delivery-driver infected, with three runners chasing and civilians fleeing. The objective directs the player to the hardware store.

The store entrance restores health and captures the segment-3 checkpoint. The display offers bat, crowbar or machete; standing in its ring for three seconds, F/E, middle-click or touch ACTION equips LEFT and unlocks RIGHT kick. Four runners and one crawler then activate. Hit flash, knockback, blood, sound and persistent/fading corpses use the existing combat/VFX/audio services. Player death restores the checkpoint and the chosen weapon, with the infected pool rebound to restored entity records. The living cap is 15.

## Integrated review fixes

Main was initially up to date and merged once more after the orchestrator authorized integration 64bb466 (merge 5c77140). E08’s real combat/navigation/NPC ownership is preserved; its extra diner incident is excluded from the slice. A third main merge, explicitly authorized when l1-assets landed, is 2078457. It includes the final hardware/civilian/car/prop models, portraits and procedural blood decals. The residential layout was regenerated without losing the porch start. The D-MAIN hardware placement was then bound to bld.maple-hardware and regenerated against its real dimensions.

The slice replaces ambient pet corgi copies with a small authored neighborhood and a single companion. Civilian crowd batches load npc.civilian-man-a / npc.civilian-woman-a, with LOD1 near and LOD2 beyond 30 m. The player’s effective loadout is empty until pickup, including campaign starts; held assets and attack indicators disappear while unarmed. Development Controls/Sound panels require ?debug; player settings remain under Pause → Settings. Touch slots use manifest weapon icons instead of empty image boxes; fist, boot, bat, crowbar and machete drawings are distinct. The stray cropped panel does not appear in the reviewed portrait frames.

The owner-authorized E02 change replaces the portrait 9 m floor with 7 m and records the ≥12% survivor requirement. At the unchanged camera angles, the 7 m floor alone gives about 10% height; a 1.25× portrait hero presentation scale supplies readability while simulation collision sizes and desktop framing stay unchanged. No E19 criterion or epic status was altered.

## Validation

Final checks and performance numbers are recorded in checks.json, summary.json, *-perf.json and *-pixels.json. Typecheck, lint and production build pass. `npm run verify -- E19`: 10 selected sim/unit checks and 29 browser checks pass. Standalone `npm run test:smoke`: 3 sim checks and 22 browser checks pass. Unit suite: 136/136. Simulation suite: 282/282, including 20/20 evade-only and 20/20 normal slice completion seeds. The continuous browser routes use actual mouse/touch adapters from menus through pickup, both attacks, result and restart; desktop also takes real AI damage, dies and respawns. F pickup and an additional physical middle-click crowbar check are covered. Performance setup is separate from the continuous playthrough so an idle FPS measurement cannot interrupt evasion.

All browsers run headless through tools/e2e-lock.sh with ≤2 workers, E2E_PORT=3338 and native Metal WebGL2. The FPS measurements remove frame-rate/vsync limits and use the Apple M1 Max GPU; mobile results are emulation on that GPU, not physical-phone evidence. Pixel-mask checks measure player height; portrait HUD union coverage is asserted ≤25%, and interactive controls are checked for overlap. Screenshots were inspected at 1600×900, 390×844 and 844×390 and deleted after review, as requested.

Native unthrottled median FPS (incident / store): desktop 322.58 / 370.37, portrait emulation 400.00 / 588.24, landscape emulation 454.55 / 555.56. Measured player heights: desktop 19.78%, portrait 13.51%, landscape 19.49%. The final visual pass confirms distinct fist/boot/machete/crowbar icons, actual Maple Hardware, transient hit flash and blood, visible real infected, one companion, readable end/restart and no production dev panel.

## Acceptance boundary

| AC | Slice evidence / deferred work |
| --- | --- |
| E19-AC01 | Slice graph reaches result; the unchanged full campaign graph retains its structural tests. |
| E19-AC02 | Slice policy completes 20/20 seeds; full L1 complete-bot run deferred with segments 4–6. |
| E19-AC03 | Full newbie profile and 5–10 minute balance band deferred. |
| E19-AC04 | Empty effective loadout and no pre-pickup player attack/hit; physical desktop/touch checks included. |
| E19-AC05 | Evade-only reaches hardware with no deaths on 20/20 seeds. |
| E19-AC06 | W0→W1 and civilian flee work; traffic swerving is deferred. The slice keeps parked cars. |
| E19-AC07 | Patient Zero and its telegraph/fight timing deferred. |
| E19-AC08 | Twist and permanent weapon-choice screen deferred; slice result/restart implemented. |
| E19-AC09 | Scheme-aware hints work; the full exact-once four-prompt criterion is not certified. |
| E19-AC10 | Physical desktop/touch segment-1–3 flow covered; all eight full-L1 photo spots deferred. |
| E19-AC11 | Morning, incident, display, fight, respawn and end reviewed; Patient Zero/twist spots deferred. |
| E19-AC12 | Integrated close-camera native desktop/mobile-emulation performance meets the requested slice budgets; see summary.json. |
| E19-AC13 | Segment-4 physics prop tutorial and store back-door barricade deferred. |

## Remaining art/flow boundaries

The l1-assets lane is included. Maple Hardware, real male/female civilians, cars, props, portraits and textured blood decals are present. Integrated GLBs render without visible magenta placeholders. The weapon display/fight is staged at the hardware entrance for this simplified slice. Driver transformation is immediate rather than a cinematic collapse. Ambient traffic swerving and onward progression/reward screens are outside this playtest. Full E13 menu-to-reward tests that expect L1’s original Continue flow are outside this stop-at-M1 boundary; save/reload smoke still runs against L5.
