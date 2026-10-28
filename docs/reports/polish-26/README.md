# polish-26 · batches 20–25

All six findings fixed on `lane/polish-26`, based on main `e8be46ebd`. Each finding has a separate implementation commit and viewed before/after captures. No deployment.

| Finding | Cause and result | Evidence |
|---|---|---|
| Q-205 | Fixed handle origins ignored native hand width; fit to measured fingertips. All four original rows have zero held-prop intersections. | [Report and captures](q205.md), `2ffeac7a3`; floor contract `384003631` |
| Q-206 | Skinned pet used rigid-leg contacts; authored soles, ankle support and reachable landings reduce slide 8.2 → 0.1 cm. | [Report and captures](q206.md), `60afe9da7` |
| Q-214 | A blocked courier grid cell left the shared chase BFS empty; seed the nearest walkable cell. Matched 240-second hold: seven nearby freezes → zero. | [Report and captures](q214.md), `a890e409c` |
| Q-216 | Added hair inherited an oversized skull envelope without the hat size cap; fit against bare brow, shared with corpses. | [Report and captures](q216.md), `5df0cea8e` |
| Q-218 | High, distant static end camera framed empty pink pavement; lower it and translate the shot onto the actual courier. | [Report and captures](q218.md), `be003d807` |
| Q-221 | Trees occupied the maneuvering strip between APC route and detour; remove full footprints and rebake. Matched drive passes former trunk. | [Report and captures](q221.md), `b9b467846` |

## Checks

| Check | Result |
|---|---|
| `npm test` | [104/104 pass](checks/test.log), 24 files; [144/150 total cases, 40/45 files](checks/test-budget.json), unchanged case count; 60.8 s under shared load. |
| `npm run test:smoke` | [6 QA tests + 1 public test pass](checks/smoke.log), both WebGL2/WebGPU program limits; public build exposes no QA hooks. [178.6 s](checks/smoke-budget.json). Private ports 4336/4337; initial attempt encountered occupied default 3301. |
| `npm run scene:gate` | [48/48 pass, 0 known, 0 not run](checks/scene-gate.md), versus baseline 43/48 pass and 5 known; 7.4 min. |
| Dog regression matrix | [26/26 pass](checks/dog-matrix.md), both tiers and every catalog zoom; 900-frame turn/stop scene retains attached limbs and zero sink. |
| `npm run typecheck`, `npm run lint`, `git diff --check` | Pass. |

The gate's five known exceptions were removed as explicitly requested. No scene threshold was relaxed; the existing cane floor contract was updated to its new fitted grip. No new unit or browser test cases were added.

## Real input and reproduction limits

[Menu-entered real-input summaries](checks/real-input.json): L4 low/zoom 1.5 twice for 90 s, L6 high/zoom 1.5 for 90 s, L9 high/zoom 1.5 twice for 90 s. Zero reported issues or objective skips in these accepted bounded samples. L4 logs one weapon-related assist per sample; L6/L9 have none. L9 drives about 750 m toward the city. L6 reaches the retreat phase. The bounded driver exits 1 because the level is intentionally unfinished; these samples are not campaign completion claims.

The matched L4 freeze check stages the war phase with the bot, sends actual movement/Space input, then observes the stationary courier for 240 sim seconds in god mode. Its per-second trace demonstrates the cause independently of corpses. The L6 exit check stages the column near the platform, then follows real mouse input through the normal exit and cinematic controllers. The matched L9 obstruction check sets the seated APC at the QA tree and drives with the real W key. Each report documents its setup and limits.

The additional full real-input L4 run completed in 327 s, with zero deaths, no skips, one weapon-related assist and zero frozen-enemy reports. It covers 83.4 sim seconds at the west breach. Its one late `enemy-unhittable` warning is explained by frontal riot-shield blocking: [warning](checks/l4-late-issue.json), [capture](checks/l4-late-issue.jpg), [damage events and shield rule](checks/l4-shield-receipt.json). The target took 112 damage before the blocked frontal shots; the level still completed normally. The driver's final `simSeconds: 0` is a handover-reset artifact; the retained per-tick observations give the actual breach duration.

All browser work used headless shared pool jobs. Owned private Vite servers and contexts close after the scripts; port 3300 was never used. The read-only reference trees and deployment were untouched.
