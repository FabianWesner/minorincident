# s46-pockets — shop contact and zebra fence

## Result

L4's stationary courier at `(5.9,36.4)` takes damage within 10 seconds on high and low. Turned L8 zebras remain dispersed in the paddock while she is outside; ordinary input through the gate still starts the fight. No combat stats changed and no corpse-removal behavior changed. Threat flags remain L4 4 / L8 0.

## Causes and changes

The supermarket checkout excluded Brute's 0.6 m body from strike positions in the rear pocket. A native clearance scan found its nearest clear center 1.73 m away, beyond its 1.35 m stationary reach plus 0.15 m resolution tolerance. Repeated charges collided with the furniture. Moving the checkout and all its fixtures 0.7 m along local X opens the aisle. All interior and roofed supermarket tiers were rebuilt and packed; production collision was rebaked from the delivered GLB. Visual and collision geometry agree. An earlier civilian-contact hypothesis was disproved (the courier has no civilian component); that experimental guard and test were removed.

Dormant converted zebras chased healthy herd mates while a carrier turned the remaining animals, or orbited a shared center. They now return to separated central home points. An engaged herd also clears its attack/staging lane and returns home when the courier leaves the authored enclosure zone. Encounter state and combat stats are preserved.

## Native and regression evidence

The corrected `tools/qa/r42/l4-pocket-probe.ts` uses the original line-break checkpoint, normal pressure, god OFF, and the same teleport API as the reference capture. It samples the shop floor: actual pose `(5.89655,36.38879)`, y1.0774. The old probe reused start height and enabled god mode. Before the geometry change the corrected probe stayed at100HP. Afterward both `QUALITY=low` and `QUALITY=high` reach80HP by tick200 and50HP by tick600, without the diagnostic collision override.

The existing L8 route test includes a turned zebra with healthy herd mates while the courier waits5m outside the gate. It verifies phase0, positions away from both fences and no stacked turned bodies, then normal engagement and gate closure after entry. Assertions were folded into existing cases.

Final geometry checks:

- Typecheck and lint pass.
- Requested remote `npm test`: 27 files,106 passed/1 skipped;150/150 case budget;162.4s within240s.
- Requested remote nightly war-waves: both tests pass; all high/low authored wave and collapse cohorts spawn, admit and reach their goal areas.
- Refreshed native threat audit: both skilled routes complete; L4 4 flags/L8 0, equal to supplied baseline. The additional partial-level-selection diagnostic flag is expected.

## Opened headless browser evidence

One browser at a time through `tools/e2e-lock.sh`, WebGL2 Metal, zoom1.5, god OFF, preview4941. Raw captures remain outside Git. Owned preview servers were stopped.

- High shop: `/private/tmp/s46-final-l4-high/s003-t615-idle.jpg`. Brute beside courier in the opened checkout aisle, visible hit reaction, HUD50/100. Logs:80HP tick267,50HP tick634.
- Low shop: `/private/tmp/s46-final-l4-low/s003-t621-idle.jpg`. Same contact, hit blood and HUD50/100; checkout and fixtures coherent at low detail. Logs:70HP tick435,50HP tick621.
- Outside zebra: `/private/tmp/s46-zebra-observed/s003-t982.jpg`. Explicit logged setup turns the native same-ID herd while courier waits `(60,57)`. Four distinct zebras stand across the central paddock with clear ground between them. After20s: phase0,150HP each,x54.08/58.10/62.13/66.14,z32.14–32.19. Camera-only observation logs positions; actor positions/stats were not rewritten.
- Real-input zebra entry: `/private/tmp/s46-zebra-real-entry/s005-t1587.jpg`. Unmodified `l8-before-zebra` fixture, WASD route via `(40,64),(60,64),(60,48),(60,35)` and ordinary gun input. Arena remains phase0 on the outside path, enters phase1 after crossing, and progresses to phase2. Opened capture shows the active herd telegraph, courier firing inside, HUD68/100; later logs retain dead zebra entities while surviving members move and take damage. No page errors.

## Browser QA needed

No additional browser coverage is required for this lane's acceptance. WebGPU remains the repository's manual check. No push, deployment or merge was performed.
