# Police visible engagement

The 2026-10-11 [police reaction update](police-react.md) adds nearby self-defence and hearing exceptions. The captures below document the earlier camera-only rule; longer-range restrictions remain in force.

## Rule

All officers (L3 squad and legacy police shooters) acquire and fire only inside a conservative player-centred volume derived from the shared default follow-camera constants. It combines desktop vertical framing, the 7 m portrait width, a 12% screen margin and a 4.55 m player distance cap. Shooter reach is capped at 6 m. Cached targets, breakout acquisition and pending attacks recheck eligibility; pending shots also recheck line of sight and hidden/rising state. Soldiers and civilians retain their existing rules.

Simulation reads no rendered camera, viewport, smoothing or frame timing. The guarantee concerns default follow framing; manually zoomed-in and cinematic camera poses are not represented in simulation. Scene Lab now applies the same portrait radius adaptation as the game. Its server is spawned directly so teardown owns the Vite process.

## Inspected capture sequence

Fixture: [approach.json](../scenes/police-range/approach.json), L3 lighting, stationary courier and officer, one infected approaching from 12 m, seed 1, 480 ticks. Reproduce through `SCENE_PORT=3387 sh tools/e2e-lock.sh npx tsx tools/scenelab/police-range.ts`.

| Framing | First on-screen position | First police shot | Shots | Capture |
| --- | ---: | ---: | ---: | --- |
| Desktop 960×540 | 111 | 157 | 8 | [sheet](../scenes/police-range/captures/desktop/sheet.jpg) |
| Phone 390×844 | 147 | 157 | 8 | [sheet](../scenes/police-range/captures/phone/sheet.jpg) |
| Landscape 844×390 | 111 | 157 | 8 | [sheet](../scenes/police-range/captures/phone-landscape/sheet.jpg) |

I inspected all three contact sheets and the portrait full-resolution frames 120 and 240. Initial frames contain only courier and officer. Desktop/landscape frame 120 shows the infected entering at lower right with no early firing. Portrait frame 120 still has no infected; frame 150 shows it entering from the right. Frame 180 shows the visible infected taking a hit, frame 240 shows the officer firing at the visible approaching target, and frame 480 shows the body beside the courier. All eight shot endpoints are on screen and within the player distance cap in each saved engagement.json. Capture gates passed with no console errors.

## Validation

- Typecheck, lint and production build passed.
- Full unit suite ran remotely with four workers: 512 tests / 138 files passed, including 14 police regressions and default-framing projection grids for desktop and both phone aspects. Separate Scene Lab tooling checks: 11 passed.
- Smoke: six simulation tests passed remotely; 26 headless browser smoke tests passed across Chromium, phone orientations and WebKit.
- L3 mission graph criterion T-E21-01 passed remotely; the other 19 level criteria were not rerun as a battery.
- L3 browser level spec: four passed (Commerce, Boulevard, Oak, carried-loadout L4 handoff). The mouse helper now flanks dense packs rather than repeatedly retreating into the pressure loop; assertions, arrival tolerances and loop budgets are unchanged.
- One seed-1 complete-bot pass: complete at 277.533 s, two deaths. No seed battery. This proves finishability but exceeds the historical 120–225 s timing band; full E21 balance verification is not claimed.

No specifications changed. No deployment or merge.
