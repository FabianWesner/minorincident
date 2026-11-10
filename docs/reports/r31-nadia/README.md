# r31-nadia: L8 "Follow Nadia" becomes a guided walk

## PO findings (verbatim, 2026-11-10 UAT)
1. "L8, you see Nadia in top right. She is just running away right from the start and I don't know which way to go. Bad gameplay."
2. "also strange, she is not arriving in the yellow circle"
3. "What is this?" (subtitle "Nadia: Sixteen years old. Grumpiest cat in the state." at the plaza, no lion in view)

## Cause
- Nadia was a scheduled walker (4.6 m/s) on a 265 m tour (start, boulevard, east, far west, plaza) with no regard for the courier.
  She was 40 m away after 13 s. The tracker/arrow pointed at the plaza (59 m), not at her.
- The 265 m tour needs ~58 s at 4.6 m/s and the tunnel breach fires at 60 s, so she barely reached (0,0) before the alarm; the courier and
  the group (which trail the courier) were still on the street outside the 6 m ring.
- L8.nadia-lion fired on "Nadia within 18 m of the lion" at any time, even when she and the courier were nowhere near on screen (it played at the plaza, late).

## Change (src/sim/missions/LevelEightZoo.ts, markerAnchor.ts)
- `guide()`: Nadia stands beside the courier for 4 s and speaks (L8.nadia-path at 3 s), then walks the route
  (24,64) - (24,0) - (40,0) east enclosures - (-38,0) lion stop - plaza (0,0) at 3.4 m/s (< 6 m ahead) or 2.6 m/s (6-10 m);
  at > 10 m she stops, turns to the courier and waits; she resumes below 7 m. The route passes every enclosure (existing tour-animal test).
- Lion stop: she halts 4 s facing the lion and L8.nadia-lion plays only there, only if the courier is within 14 m of her; otherwise the line is dropped.
- Guidance (HUD distance, edge arrow, minimap pin, 3D ring) tracks Nadia herself while she leads (`markerAnchor`); at the plaza it is the ring.
- Plaza: when Nadia arrives the group settles on a ring of slots (r 1.8-4.6) around the plaza centre while the courier is within the ring + 4 m.
- The calm now ends 15 s after Nadia arrives (min 60 s, cap 120 s) instead of a fixed 60 s, so the walk always completes; Hale's greeting waits for her arrival.
  A dead/turned Nadia aborts the guide and restores the old 60 s calm. Debug `advance()` skips the guide.

## Numbers (tools/qa/diag/l8nadia.ts, seeds 1-6, skilled bot; gap measured on ticks where Nadia walked)
| courier | max Nadia gap while she leads | step done | Nadia in ring | group in ring | lion line |
|---|---|---|---|---|---|
| walks | 1.1 m (bot hugs her) | 90 s | yes | 13/13 | ~58 s at the lion stop |
| idles 10 s at start | 10.0 m | 94-95 s | yes | 13/13 | ~63 s |
| wanders off west for 20 s (5-25 s) | 10.0 m (she stops; the courier itself reaches 20+ m) | 129 s | yes | 13/13 | ~97 s |

Identical across seeds 1-6; Nadia never leads further than 10 m.

## Checks
- `npx vitest run tests/engine/missions.test.ts` 6/6. checkL8Story now asserts: lead gap < 12 m, Nadia reached the plaza, group >= 90 % and Nadia inside the ring 10 s after arrival, lion line precedes the Hale greeting. No new test cases.
- tsc and eslint clean on touched files. l8idle-all and threat-audit L8 results are in the lane report.

## Other sanctuary lines
- nadia-path (3 s, courier within 4 m): ok. broadcast (>= 20 s, courier < 25 m from the plaza) and hale-greeting (after broadcast, Nadia arrived, courier < 18 m): both play at the plaza.
- nadia-elephant plays wherever the courier is when the elephant turns (radio line, Nadia alive); unchanged.

## Ghosted soldiers in the plaza (render, not changed)
Not reproducible headlessly. The soldiers (Hale/Reyes) are plain `npc.national-guard` entities with no alpha/fade state in the sim. The likely cause is the
see-through pass (src/render/SeeThrough.ts): the lamp post/bench beside them are solid occluders that dither-cut a disc around the courier, which can overlap a
character standing in or behind it; or the courier-foreground cut firing for them. Needs a browser check at the PO's camera (zoom 1.75).

## Browser QA needed
- L8 seed 1, high + low, zoom 1.75 and 1.0, WebGL and WebGPU: at tick 0 Nadia is within 4 m and on screen; the HUD arrow/pin/distance points at her and shrinks as she walks.
- Idle 10 s at start: she stops and turns back about 10 m away.
- Lion stop at about (-38,0): lion on screen, she faces it, subtitle plays there.
- Plaza at ~90 s: Nadia and the whole group inside the yellow ring; the ring is the objective; Hale's greeting plays inside.
- Soldiers inside the ring in plain lamp light: ghosted or solid?
