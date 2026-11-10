# r30-finale-qa: the L10 ending in real play (main acdd976c)

First real-input play of the whole L10 ending: from the `l10-dispersal-console` fixture through the console charge, the Mega
fight, "Release the cure", the epilogue, the pull-out, the title, credits, "Thanks for playing" and back to the menu.
One headless GPU Chrome at a time through `tools/e2e-lock.sh` (port 4897, preview server on `npm run build:qa`, stopped afterwards).

**Contact sheet for the PO:** `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r30-finale/contact-sheet-po.jpg`
(16 frames, in story order). Raw captures and logs: the same `r30-finale/` folder (`run1`…`run4`, `sheet-*.jpg`). Not in git.

## Runs

| run | quality | zoom | backend | reached | notes |
|---|---|---|---|---|---|
| run1-low-z15-gpu | low | 1.5 | WebGPU | charge, Mega killed, stood at the console 3 min | "Release the cure · 1 m" never shows a prompt; my script only pressed E on a prompt, so it stood there (finding 1). Stopped. |
| run2-high-z1-gl | high | 1 (default) | WebGL2 | **full ending to the menu**, credits left to run all 90 s | 0 frames > 100 ms, 0 page errors |
| run3-low-z15-gpu | low | 1.5 | WebGPU | **full ending to the menu**, "Skip credits" clicked after 22 s | one 267 ms frame at tick 9439 (start of the pull-out), 0 page errors |
| run4-high-z15-gpu-gate | high | 1.5 | WebGPU | gate-switch detour, then **full ending**, "Skip credits" after 7 s | 0 frames > 100 ms, 0 page errors |

All runs used `--god` (the brief allows it). **No damage shortcut was used:** the Mega's HP was never changed. With the army MG
it fell in 34–36 s of real fighting in every run (3000 HP; phase 2 at ~2000 HP, phase 3 at ~1000 HP).
Not covered: low + WebGL2, and a real (non-god) fight. Audio was muted (headless), so the hymn and the phone buzz are not judged.

Tooling (QA only, no game code): `tools/qa/r28-vqa-fixture-play.ts` got `--tap-e-when <regex>` (tap E while the tracker matches),
`--dwell <s>` (stand at a route point), `--skip-credits-after <s>` (click the real "Skip credits" button), plus logs of the ending
phase, camera height, cinematic-HUD class, campaign heading, and the Mega's HP/phase every 2–3 s. It also keeps taking screenshots
after the player entity is gone (title/credits/menu). `tools/qa/r30-finale-arena-probe.ts` is a native probe that lists the arena
devices and the Mega's special moves.

Timeline in real play (run2): charge 60/60 at tick 3818 → Mega dead at 5955 → release at 5968 → wave shots 8–45 s
(camera height 28 m) → back at the complex 45–50 s (23 m) → pull-out 50–65 s (camera height 28 → 1024 m) → title at 65 s →
credits 90 s → "Thanks for playing" 6 s → title menu (`uiScreen=title`). The whole post-release sequence is 166 s. With Skip it is about 80 s.

## Per beat

### 1. Console charge
- Works. "Activate the dispersal console · 2 m · Press E or tap the console action" → "Defend the dispersal console · Charge N/60 s". The Mega arrives during the charge (r29 fix confirmed in real play): it stands 2–4 m from the courier for the whole 60 s.
- **P3 boring/harmless (god caveat):** during the charge the Mega takes no damage (2986/3000 for 60 s) and mostly stands next to the courier. With god on I cannot say how hard it hits. In run2 it held its stagger and sat beside the console for most of the charge (`run2-high-z1-gl/s010-t1926.jpg`, `s019-t3587.jpg`). Its telegraphed charge is readable (red lane with chevrons, `run4-high-z15-gpu-gate/s004-t798.jpg`).

### 2. Mega fight (phases, machinery, fuel tanks, gate, weak spots, health bar)
- Phases happen (log: phase 1 → 2 at ~2000 HP → 3 at ~1000 HP). The native probe shows charge, ground slam and grab-throw special moves. The fight is **34–36 s** with the MG in every run.
- **P2 the boss is drawn as a see-through ghost.** Whenever the courier is behind it, the Mega gets the dithered occluder treatment and reads as a purple smear. The escort is ghosted too. (high, zoom 1, WebGL2: `run2-high-z1-gl/s024-t4509.jpg`, `s029-t5430.jpg`; low, zoom 1.5, WebGPU: `run1-low-z15-gpu/s028-t5221.jpg`.) This is the r28 P3, now on the final boss.
- **P2 the fight leaves the arena.** In all four runs the Mega and the courier ended up 55–80 m from the console, on flat dark ground with no machinery, tanks or gate in view. The HUD then read "Back to the dispersal arena · Kill the Mega Alpha · 2 m" while the Mega was still in melee range (run1 t4941–5814, run2 t4699, run3 t4803, run4 t5716 and t6719). The "Back to the arena" text contradicts the fight itself, and the arena's set pieces are not part of it (`run1-low-z15-gpu/s026-t4859.jpg`, `s028-t5221.jpg`). This is script-driven (the courier walks toward the marker, and the marker is the Mega), but nothing holds the boss in the yard.
- **P2 the arena tools are not discoverable.** At the authored gate switch (console +10, +28 = 4012, 1) there is one unlabelled dark-blue box. No "Electrify the gate" prompt showed in 4 s of standing ~1.5 m from it, and no gate or fence is visible (`run4-high-z15-gpu-gate/s003-t616.jpg`, `s004-t798.jpg`, high, zoom 1.5, WebGPU). Natively the switch exists (label "Electrify the gate", radius 2) and completes on E, and both propane tanks exist at (4026,-31) and (3984,-17) (`r30-finale-arena-probe.ts`). `gate-spent` stayed false in every run, and no tank went off on the Mega. The design's "machinery stun / fuel tanks / electrified gate" are therefore **not exercised by real play** here, and a player has no visual cue to use them.
- Weak spot: `megaWeakTicks` was > 0 once (run2, during the charge). No glowing weak spot was visible in any capture. Not verified.
- Health bar: only the small overhead bar above the Mega (plus the yellow marker). There is no boss-name / screen-wide bar. At high/zoom 1 a second, wider bar crossed the Mega's chest (an escort's bar overlapping, `run2-high-z1-gl/s029-t5430.jpg`). **P3.**
- Boring/harmless: with god mode the Mega never pressured the courier. A 35 s MG fight with no use of the arena feels like a big regular Alpha, not a finale. Needs a non-god human play to judge the threat.

### 3. "Release the cure"
- **P2 (P1 candidate on touch): no prompt, no ring, no touch button for the release.** After the kill the tracker reads "Release the cure · 1 m" with no "Press E" hint (`run1-low-z15-gpu/s094-t17499.jpg`, low, zoom 1.5, WebGPU, t17499, still the same after 3 min at the console). Cause in code: the `release` step completes on `flag('cure-released')`, not an `interact` trigger. So `interactStepInRange()` never returns it, the HUD hint and the `dispersal-action` button ("Release cure") never show, and no ground ring is drawn. E does work: `LevelTenFinale` checks the press directly (runs 2–4 released on the first tap within 2 m). A touch player has no visible way to finish the game unless a generic interact gesture exists. Not tested on touch.
- P3: the subtitle "Dr. Voss (radio): 'Release it. Now.'" stays on screen for ~5 s after the release (`run2-high-z1-gl/s033-t6152.jpg`).

### 4. Release beat (0–8 s): green dust, infected kneel and stand up, corgi sits
- The HUD hides at once (`cinematic-ui` from the release on). **The r28 "full HUD stays on" does not happen in real play.**
- If living infected are near: they turn into people at once (civilians, soldiers) and crowd around her (`run2-high-z1-gl/s033-t6152.jpg`, `s034-t6332.jpg`). No kneel-and-stand transition was seen at a 3 s sampling. At low the cured soldiers walk to her single-file with arms out, which still reads like infected (`run3-low-z15-gpu/s035-t6512.jpg`).
- **P2 boring: when the fight ended away from the console, the beat is empty.** run4: courier and corgi alone at the console on flat grey-olive ground for the whole 8 s. No dust column, no visible tide, no cured people (`run4-high-z15-gpu-gate/s044-t8179.jpg`, high, zoom 1.5, WebGPU). Story: "a column of glowing green dust rises from the complex and rolls outward over the ground like a tide". **No dust column is visible in any run**; the ground only tints slightly green.
- The corgi stands next to her. It is not seen sitting.
- P3: the dead Mega lies folded over the platform stair (`run2-high-z1-gl/s034-t6332.jpg`).

### 5. The wave (8–30 s)
- Plays: farm/corn, bridge + APC, zoo, city/metro, Medical Annex + box truck, each 4 s, with a green disc sweeping across.
- **P2 not stunning, reads as placeholder dioramas.** Each shot is a few low-LOD props on a flat coloured slab floating in a flat salmon/olive void. The "corn" is two square patches of sticks. The green dust is a flat translucent disc with a hard edge. The cured people are 4 tiny figures (`run2-high-z1-gl/s036-t6658.jpg`, `s038-t7020.jpg`, `s041-t7573.jpg`, high/zoom 1/WebGL2; the same at low/WebGPU `run3-low-z15-gpu/s037-t6879.jpg`, `s039-t7246.jpg`). The zoo shot is one small building and two fence pieces. Nadia's cap (a 0.45 m box) is not readable. Nothing kneels or stands at this scale. It is the right idea (PO: "Make sure the storyline also shows what happens after the final win") but far below the look of the levels.

### 6. Survivor vignettes (30–50 s)
- Rosa "Look — it's over.": **not shown.** The fixture's campaign has `shelteredPassengers: []` and no L8 results, so the survivors shot is two empty army trucks on a green disc for 6 s (`run2-high-z1-gl/s042-t7759.jpg`, `s043-t7940.jpg`). **P3:** nothing replaces the missing survivors. A player who lost them gets 6 s of parked trucks.
- Sam: the fixture has `sam-alive=false`, so "Private Reyes (radio): 'Delivery confirmed. …Show-off.'" played (continuity rule OK) over a bare shelter on grey ground with three tiny figures (`run2-high-z1-gl/s045-t8311.jpg`). Story: "The hangar doors open; Dr. Voss and Sgt. Ruiz help Sam outside". Not readable as that.
- Town shot (depot + house, 6 people walking): plays (`run2-high-z1-gl/s046-t8493.jpg`).
- **QA gap:** a fixture at `cure-disperse-ready` with a real campaign (L8/L9 survivors sheltered, Sam alive, toy found) is needed to check Rosa, Sam, the credits survivor lines and the corgi-toy post-credits shot. This fixture cannot show them.

### 7. Back to her, "Delivered ✓" (45–65 s)
- "Delivered ✓" shows as a caption box at ~51 s, over the start of the pull-out (`run2-high-z1-gl/s049-t9047.jpg`).
- **P2 not as scripted:** she stands among a loose grid of cured soldiers in the dark. She does not sit on the platform steps, there is no corgi head on her knee, and there is no sunrise (`run2-high-z1-gl/s048-t8860.jpg`, `run3-low-z15-gpu/s049-t9086.jpg`).
- P3: at high/WebGL2 and at low/WebGPU the courier draws pale/see-through under the tank shadow (same frames). In run3 a cured civilian stands inside the Mega's corpse (`run3-low-z15-gpu/s049-t9086.jpg`, right).

### 8. Pull-out (~15 s)
- **Works in real play.** The camera goes from 23 m to 1024 m over 15 s (logged every 2 s, both backends), and the HUD stays hidden. The r28 Scene Lab "camera never pulls out" was a fixture artefact. The courier does not walk out of frame (she is under story lock).
- **P2 not stunning / only partly the PO ask:** at full height the level is a thin band in the middle of a huge flat olive plain, framed by big dark low-poly conifer clumps in the foreground. Corn, farms, restricted zone and hangar cannot be told apart. The green dust is a few faint patches, not "spreading over the whole level" (`run2-high-z1-gl/s053-t9779.jpg`; low/WebGPU `run3-low-z15-gpu/s053-t9815.jpg`). The r28 "ground is flat olive" is true here. PO: "could even zoom higher, so the entire level can be overseen": it is high, but the level does not read.
- P3: one 267 ms frame at the start of the pull-out (low, WebGPU, tick 9439).

### 9. Title, credits, Thanks, menu
- Title "Minor Incident" (5 s) over the pull-out vista (`run2-high-z1-gl/s054-t9969.jpg`). Good.
- Credits: 90 s of scrolling, readable at 1280×720 (`run2-high-z1-gl/s057-t10538.jpg`), with "Pause credits" and "Skip credits". **Skip works** (runs 3 and 4 → Thanks → menu). PO ask "at least ~60–90 s, skippable" met.
- P3: the first ~3 s show an empty credits panel (`run2-high-z1-gl/s055-t10159.jpg`). The panel covers most of the vista. About 60 of the 90 s are a dependency/licence list (tsx, zod, ws, vite …), which is honest but dull as end credits.
- "Thanks for playing" (6 s) over a dark night shot of the complex: the camera snaps from 1024 m back down to 23 m (`run2-high-z1-gl/s084-t15762.jpg`). Then the title menu (`s085-t15918.jpg`). Return to menu works.
- Post-credits corgi-with-toy shot: not seen (the fixture's toy is not collected).

## Is it stunning?
No. The structure is complete and robust: every beat plays in order on both backends, with no page errors, a working pull-out, credits and Skip, and a clean return to the menu. But the visual payoff is missing: no dust column or tide, placeholder diorama shots, an empty release beat when the fight ended elsewhere, and a vista of a flat olive plain. Compared to the PO quotes ("the cured crowd is the thing to see", "final zoom out is amazing … entire level can be overseen") the ending is clear but not moving.

## Boring / harmless / babysitting?
- Boring: the release beat when no infected are near (8 s of nothing), the 6 s empty-trucks shot, and ~60 s of library licences in the credits.
- Harmless (with the god caveat): a 35 s MG fight that never uses the arena; the Mega stands next to the console during the charge.
- Babysitting: none. Nothing waits on followers.

## Findings list (for the orchestrator)
| # | sev | beat | finding | evidence |
|---|---|---|---|---|
| 1 | P2 (P1 candidate on touch) | release | no prompt/ring/touch button for "Release the cure" (`release` step has no interact trigger) | run1 s094-t17499, low z1.5 WebGPU |
| 2 | P2 | fight | Mega drawn see-through when the courier is behind it | run2 s024-t4509, s029-t5430 (high z1 GL); run1 s028-t5221 (low z1.5 GPU) |
| 3 | P2 | fight | fight drifts 55–80 m out of the arena, "Back to the dispersal arena" shown while in melee | run1 s026/s028, run2 t4699, run3 t4803, run4 t5716/t6719 |
| 4 | P2 | fight | gate switch is an unlabelled box, no gate visible, no prompt seen; tanks/gate never used | run4 s003-t616, s004-t798 (high z1.5 GPU); native probe |
| 5 | P2 | release | no dust column or tide; empty beat when the fight ended away from the console | run4 s044-t8179 (high z1.5 GPU); run2 s033 |
| 6 | P2 | wave | placeholder dioramas on flat void slabs, tiny figures, flat disc as dust | run2 s036, s038, s041 (high z1 GL); run3 s037, s039 (low z1.5 GPU) |
| 7 | P2 | back to her | she stands in the dark; no steps, no sunrise, no corgi head on knee | run2 s048-t8860; run3 s049-t9086 |
| 8 | P2 | pull-out | vista is a flat olive plain with conifer clumps; the level does not read; little green | run2 s053-t9779; run3 s053-t9815 |
| 9 | P3 | survivors | empty-trucks shot when no survivors; needs a fallback | run2 s042-t7759 |
| 10 | P3 | fight | no boss bar; an escort bar crosses the Mega | run2 s029-t5430 |
| 11 | P3 | release | "Release it. Now." subtitle lingers ~5 s after release | run2 s033-t6152 |
| 12 | P3 | back to her | courier pale/see-through under shadow; cured civilian inside the Mega corpse | run3 s049-t9086 |
| 13 | P3 | credits | first 3 s empty panel; ~60 s of package licences | run2 s055-t10159 |
| 14 | P3 | pull-out | 267 ms hitch at pull-out start (low, WebGPU) | run3 log tick 9439 |
| — | gap | survivors | Rosa/Sam/survivor credits/corgi-toy unverifiable with this fixture | fixture `shelteredPassengers: []`, `sam-alive=false` |

## Browser QA still needed
- A human (or touch-emulated) check of finding 1 on a touch device.
- A non-god fight to judge the Mega's threat and whether the arena tools can be used.
- A fixture at `cure-disperse-ready` from a real campaign (survivors sheltered, Sam alive, toy found) to cover Rosa, Sam, the survivor credits and the post-credits shot.
- Low + WebGL2 (not run).
