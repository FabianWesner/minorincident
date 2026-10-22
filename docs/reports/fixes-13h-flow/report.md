# Fixes 13h flow — acceptance pending

- #96: follower, self-defence and guard movement share the walkable-floor return route across actual lane edges; NPC maintenance-room routes remain available.
- #97: early seating shows the breach countdown; E30 departure stays locked until breach plus all living passengers seated; missing names include Corgi.
- #97 HUD: corgi/Armor/objective separation checked at zoom 0.5/1/1.5, desktop and phone landscape; eight reviewed high/low WebGL2/WebGPU captures retained.
- #99: valid fists/kick-only equipped save retains earned ownership; an empty first rendered frame no longer aborts; strict input sessions cannot skip objectives.
- Red-first evidence is committed for navigation, self-defence, boarding/counts, HUD/phone, seeded save validity, empty figures and driver observation/input fixes.
- Local checks: typecheck/lint/build green; complete L6 bot exactly baseline (283.6 s, 23/29, no deaths, peak 45); newbie 275.6 s, 18/29, no deaths.
- Remote: initial full suite 2,302 passed + seven timeouts; unchanged serial retries 41 passed; final L6 scope 63 passed; final tooling 14 passed. Final full serial run active.
- Remaining: completed strict male fists, female weapons and L7→L8 real-input runs, smoke, final evidence cleanup. No real-input attempt is accepted yet.
