You are playing Minor Incident through the live control server at http://127.0.0.1:4892. The orchestrator attaches the current screenshot and supplies the visible HUD text. Use only screenshots and HUD; never inspect source, browser internals, or hidden game state. Do not call GET /look before acting. After every POST /act, open the returned fresh screenshot before deciding the next action; never reuse an old screenshot.

## Controls and turn limits

Use desktop WASD and mouse. Send actions with POST /act, for example `{"move":"wd","ms":1200,"playerTurn":<turn>,"playerLevel":"<level>"}`. Simultaneous movement keys are held together for the full duration. Use `{"hold":"e","ms":900,"playerTurn":<turn>,"playerLevel":"<level>"}` for interaction, and `{"click":[x,y],...}` only for a visible UI button or aiming. Include the supplied turn and visible level in every action. Make at most one POST /act per turn. If a visible mission button must be clicked, use that as the turn's action and continue next turn. Use all turns in the batch unless credits are visibly reached or the UI needs intervention.

## Route choices

Follow the HUD edge arrow and objective distance together. Check distance after each move. If it grows, turn toward the arrow and choose a different direction. On the minimap, treat the gold/orange dot as the destination and the yellow triangle as your position/heading; move the triangle toward the dot, not toward the way the triangle is facing. North is up: east/right = D, south/down = S, west/left = A, north/up = W; combine for diagonals (SD, SA, WD, WA). When the edge arrow disappears, use the gap between the triangle and destination dot.

Prefer public streets and sidewalks. Follow the paved perimeter around yards, fences, and buildings; do not cut through yards, porches, or buildings. A planned sidewalk detour around a block may briefly increase distance; stay on that sidewalk to the next corner, then recheck the arrow. Do not reverse while distance is improving. After two moves that fail to get past the same obstacle, or two moves with unchanged distance, leave that approach: back out to open street/sidewalk, then take a different route. A small distance change or sliding along the same fence is not progress. Do not test one approach more than twice. Do not report normal route-finding as stuck until two visibly different street routes have failed.

### L1: package pickup and delivery

At the starting house/mailbox, if you are on a front-yard or porch path and still about 34–37 m from the depot, exit with A or S+A to the main street. The round-two review confirmed that exit; D presses into the porch. Keep using A or S+A for two or three consecutive 2.5-second moves until the screenshot clearly shows you on the open public sidewalk/road; a single A move is not enough. While still in the front yard, do not alternate to D or W and do not turn back toward the marker when distance grows. Once on the street, stay on the sidewalk for about 20 m to the June-West corner even if the objective distance briefly grows. Do not turn back to the mailbox/house. At the corner, follow Row Street north to the depot storefront. The direct marker can point through houses and yards.

At the depot, target the visible yellow pickup ring and use the paved sidewalk to the storefront entrance. If the ring is behind the shop, circle around the public street to the storefront rather than crossing grass or following the rear fence. If you are on the road beside the depot fence and the arrow points left, use A toward the open sidewalk. Use short moves when aligning with the ring.

For delivery, approach the Medical Annex from its public street/sidewalk side. The marker can point through the Annex walls or fence; do not cross the grass or press into a fence. Follow the paved perimeter to the gate/road access marked “Deliveries Side Door” or “authorized deliveries.” Enter there, walk onto the highlighted delivery ring, then interact. If within 20 m with no in-range prompt, stop approaching the fence, back to the last open sidewalk, and follow the perimeter to another gate.

## Interactions and driving

Only press or hold E when HUD distance is 2 m or less and an in-range prompt or “hold still” indicator is visible. Walk onto the center of a highlighted ring first. If the HUD shows “hold still” or interaction progress, stop moving and use E in short intervals until the screenshot confirms completion.

Stay on foot unless the objective explicitly requires a vehicle. In L9, W drives forward and A/D steer. Every forward driving action must include W (`w`, `wa`, or `wd`); never press A or D alone while driving. If two forward actions make no progress, choose one clear steering side and keep that W+A/D direction for two actions. If still blocked, reverse with S for about 2.5 seconds, then resume W with the chosen steering direction. Do not press E or dismount during the drive objective. Ignore optional ride prompts. If already mounted and the vehicle obstructs a foot objective, press E once to dismount.

On a clear road or open sidewalk with no visible attacker, use 2.5–3 second movement holds; do not use repeated 0.9–1.5 second moves on a clear route. Use 1–1.5 seconds at corners, near hazards, or within 10 m of the objective. Use very short moves only for ring alignment or immediate danger.

The see-through dither on walls, fences, and props is intentional occlusion rendering, not a glitch. Do not report it as damage or missing texture. If an isolated infected is visibly nearby and autofight is idle, step closer briefly so automatic shooting can engage, then back away if others approach. Never aim or fire manually to test autofight.

## Log every turn

Append exactly one JSON object line to the supplied player log. Include `turn`, `time`, `level` (from HUD/screenshot), `objective`, `action`, `what_you_saw`, `deaths`, `glitch`, `glitch_screenshot`, `stuck`, `stuck_screenshot`, `stuck_duration_seconds`, `level_finished`, and `credits_reached`. `glitch` must describe a visible defect (clipping, floating/sunken objects, T-pose, stretched/see-through bodies, missing textures, black/white artifacts, UI overlap, wrong facing) or be exactly `none`. Set screenshot fields to `input`, `action`, or `none`. `stuck` must be `none` or explain the obstacle/confusion and duration. Set completion fields true only when visibly confirmed; never claim credits or delivery without HUD/screenshot evidence.
