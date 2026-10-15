# Gameplay follow-up after e13e9972

## Repair

The existing respawn delay covered enemies near the checkpoint, while an encounter far along the forced detour could reacquire the courier after that delay had expired during the return walk. The new L3-only approach window keeps the same 20-second delay on the distant failed encounter until the courier approaches it. Restored actors and later arrivals use the same deadline. Once the approach starts, the deadline expires normally. Each restore resets the window. No actor is removed or damaged by this change; permanent corpses and recovering bodies retain their state and timers. Existing thinning rules are unchanged.

Existing Boulevard packs now lie before the jam/bus and on the actual corner, cross-street and ramp walking lines. Their count and +40 HP amount are unchanged relative to e13e9972. Production walk-over tests use ordinary navigation on the real level and retain the original sidewalk, spacing, collection and health assertions. Existing Scene Lab travel bounds are retained by framing routes of the corresponding length.

## Evidence

Fresh main-based build: the unmodified T-E21-19 Boulevard route passes with **2 deaths**, limit **5**; `browser-blvd.json` preserves the result, progression and closed-boom timestamps. The final-source complete/newbie bot, T-E22-11 and both ally-feel spot checks pass **5/5**. Distant retry, returning-body and second-retry regressions pass **3/3**. The full requested L3*/L4*/ally-feel/ally-defence rerun passes **119 tests**, with **2 existing probe skips**. The complete snapshot preceded the final per-restore window reset; the reset is covered by the final spot and retry checks. Typecheck, lint and fresh build pass.

The two-worker full L3 browser file was queued, then replaced by the one-worker Boulevard route when shared capacity could not admit two units. A complete final-source two-worker file remains unmeasured. Earlier full-file measurements are recorded in the original lane history; they are not presented as final-source passes.

## Visual QA

The eight changed-area fixtures use the game/follow camera at high/low quality and zoom 1.5/1.0/0.5 on WebGL2 and WebGPU. The retained-body fixture is explicitly a visual proxy; the production controller deadline is covered by Node and the real-input route. WebGPU initially passes 48/48. Final original-bound fixture rechecks and WebGL remained queued behind shared browser capacity and were cancelled at 06:10 UTC as the three-hour lane bound approached. These final cases remain unmeasured; the 48/48 initial WebGPU result is not represented as final-fixture acceptance. Inspected gameplay captures show active street crowds, downed bodies and the courier/corgi at the closed army compound. Pickup sheets show grounded travel and collection on paving. Some paused frame-zero roof occlusion remains in the inherited main renderer; no render change is included here. The retained-body sheet brings a recovering actor into the right of the frame near its end; tighter frames do not show every body simultaneously.

Phone performance was handed to astra-l3-p95. This follow-up contains no render/performance code, threshold or budget changes. No merge or deployment was performed.
