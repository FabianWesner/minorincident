# s103 — batch 95 L10 finale browser QA: FAIL (P2 visual)

Checked batch 95 merge **7a2d031e** in headless Chromium, WebGL2 / ANGLE Metal, 1280×720, DPR 1, seed 1. Optimized production-mode bundle built with `MI_BUILD_CACHE=off npm run build:qa`; QA hooks enabled. No gameplay changes. Initial HIGH runs preceded LOW; a final direct-door comparison repeated HIGH then LOW. Started from the supplied installed-cure `cure-disperse-ready` fixture.

Evidence: [machine-readable traces, metrics, probe sources and remote receipt](browser-qa.json), [contact sheet](contact-sheet.jpg). Full local captures/traces remain under `test-results/s103-*`.

| Requested check | Result | Evidence |
| --- | --- | --- |
| 1. Doorway visible, grounded, clear of platform/tanks; HIGH/LOW, zoom 1/1.5 | **FAIL — P2 readability** | Prop is present and grounded, with visible clearance to the stairs. From the console/west approach its visible face reads as a large unlit black block rather than a doorway. During emergence the cutaway exposes a large black region. Same on both tiers; sheet top row. No floating or tank/platform intersection observed in these views. |
| 2. Arrivals emerge, follow stairs and reach player | **PASS, with the visual issue above** | Direct 1-second captures: first runner at tick 362, x=4009.85, y=0.7; moves west continuously, reaches stair x=3999.15/y=1.4 at tick 902, x=3996.65/y=3.2 at tick 1022. HIGH/LOW identical in this diagnostic. Live gun observations show service actors reaching y=3.78 and within about 1 m of the gun, then attacking. No sampled floating, sinking, route crossing through platform walls, or exposed spawn jump found. |
| 3. Mega approaches/attacks; no outside stall or teleport | **PASS in sampled runs** | Live mortal HIGH play continued the fight for 480 sim seconds, including movement away and return. Fixed-console and gun views show approach and close attacks; no consecutive rendered Mega displacement >0.5 m in any focused HIGH/LOW sample. Gun screenshots show the boss attacking on deck. This is sampled browser QA, not exhaustive phase/leash coverage. |
| 4. Cure release + epilogue | **PASS — assisted gate check** | Both tiers charged normally, then the boss was killed through the combat damage pipeline and a real E press released the cure. `cure-released=true`; after 900 stepped ticks the epilogue is `playable`, with approaching cured actors and authored groups. LOW epilogue visible in sheet. No mission flags were edited. |
| 5. Finale frame time p95 | **PASS — measured** | **16.8 ms HIGH, 16.8 ms LOW**, at zoom 1 and 1.5; detailed counts below. No page errors. Diagnostic samples on this Mac, capped near 60 Hz; not an exclusive performance qualification. |
| Other level: HIGH L4 alarm/breach reserved-slot sanity | **PASS** | 32 real seconds after `turn`, complete bot, god mode: tick 238→1924; infected 59→92; reserved slots 21–23. Nearby visible infected rise 0→30. No live infected observed disappearing within 15 m between 4-second samples; simulation and wave continue. Sheet bottom right. |

## Frame samples

Each cell is a 32-second real-time window. Screenshots and paused stepping are outside measured windows. God mode keeps the fixed observer alive; actors, AI and rendering run normally.

| Position | HIGH z1 | HIGH z1.5 | LOW z1 | LOW z1.5 |
| --- | --- | --- | --- | --- |
| Console: samples / p95 ms | 1887 / 16.8 | 1919 / 16.8 | 1896 / 16.8 | 1919 / 16.8 |
| Gun: samples / p95 ms | 1886 / 16.7 | 1919 / 16.8 | 1898 / 16.8 | 1919 / 16.8 |

## PO findings

**Glitches:** P2 `door-readability`: the service entrance reads as a large black wall/block, then a broad black cutout reveals the emerging runner. Reproduce on HIGH or LOW: load the installed-cure checkpoint, activate console, stand around **(4010, -28)**, inspect the service prop at **(4012, -33)** at zoom 1 and 1.5, wait five seconds. See sheet top row and `directEmergence` in JSON. Grounding and stair traversal work; the entrance's visual explanation is weak. **No P1 established.**

**Boring, harmless or babysitting?** The observed finale is not harmless: the mortal device-input HIGH driver died **13 times in 481 wall seconds** and did not kill the Mega. This is an automation outcome, not a human difficulty estimate or a new balance defect. Static god-mode gun observations accumulated attackers around the player; the gun position is not a safe idle spot. The release gate remains explicit and worked after the boss died. No new babysitting requirement was observed. Successful unassisted fight completion was not established by this lane.

## Validation and scope

- Production-mode QA build, `npm run typecheck`, `npm run lint`: pass on unchanged gameplay source.
- Unchanged remote command `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, runner `46.225.66.90`, job `s103-b95qa-e95419-57152-1794613720`; manifest 150/150, 27 files pass, 106 tests pass, one skipped; 225.1/240 seconds. No test trimming/retry.
- Browser work used `tools/e2e-lock.sh` and browser pool, one headless browser at a time, reservations below ten minutes, preview port 4931 and SCENE_PORT 4932. Temporary probes are preserved as text in JSON. No deploy, push, main movement, gameplay/stat/corpse changes, or forbidden-directory edits.
- Earlier sandbox/port failures are superseded by these completed observations. All requested checks now have a reported verdict; the P2 is reported only, not fixed.
