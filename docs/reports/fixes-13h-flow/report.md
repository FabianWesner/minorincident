# Fixes 13h flow — acceptance pending

- #96: follower, self-defence and guard movement share the walkable-floor return route across actual lane edges; NPC maintenance-room routes remain available.
- #97: early seating shows the breach countdown; E30 departure stays locked until breach plus all living passengers seated; missing names include Corgi.
- #97 HUD: corgi/Armor/objective separation checked at zoom 0.5/1/1.5, desktop and phone landscape; eight reviewed high/low WebGL2/WebGPU captures retained.
- #99: valid fists/kick-only equipped save retains earned ownership; an empty first rendered frame no longer aborts; strict input sessions cannot skip objectives.
- Red-first evidence is committed for navigation, self-defence, boarding/counts, HUD/phone, seeded save validity, empty figures and driver observation/input fixes.
- Local checks: typecheck/lint/build green; complete L6 bot exactly baseline (283.6 s, 23/29, no deaths, peak 45); newbie 275.6 s, 18/29, no deaths.
- Remote: final full suite 2,329 passed (423 files, nine native skips), exit 0; unchanged timeout retries 41 passed; final L6 scope 63 passed; driver checks/typecheck/lint green.
- Browser gates: female weapons and L7→L8 completed with no skips (max pauses 13.2/9.1/7.7 s); smoke 31/31 and HUD 6/6 green. Remaining: male fists and final cleanup.
