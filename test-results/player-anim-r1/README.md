# Courier round-one correction evidence

[Full report](../../docs/reports/player-anim-r1.md). Paired stills: **before left / after right**, same recorded scenario and tick. Before is merged round one `fd1a3560`; after body poses are `9560c3eb`. Camera matches the production 25° FOV / 0.30π polar / π/4 azimuth, zoomed for review. These comparisons use neutral studio lighting.

| State | Female | Male |
| --- | --- | --- |
| idle | [female](compare-female-idle.png) | [male](compare-male-idle.png) |
| walk | [female](compare-female-walk.png) | [male](compare-male-walk.png) |
| run | [female](compare-female-run.png) | [male](compare-male-run.png) |
| stop | [female](compare-female-stop.png) | [male](compare-male-stop.png) |
| turn180 | [female](compare-female-turn180.png) | [male](compare-male-turn180.png) |
| bat | [female](compare-female-bat.png) | [male](compare-male-bat.png) |
| ride | [female](compare-female-ride.png) | [male](compare-male-ride.png) |

Actual L1 captures use production lighting/materials and the game camera at an 8 m review radius. Final gameplay source is `ca68bf9a`; capture harness is `500c9a22`. Dialogue overlays are hidden only in the capture page. The four videos are 800×600, 20 fps, with all intervening poses evaluated at 60 Hz:

| Sequence | Female | Male | Duration |
| --- | --- | --- | --- |
| Idle, walk, stop | [video](game-female-idle-walk-stop.webm) | [video](game-male-idle-walk-stop.webm) | 6 s |
| Run, 180° turn, fast-click fists/bat | [video](game-female-run-turn-fight.webm) | [video](game-male-run-turn-fight.webm) | 10.75 s |

`game-*.png` adds final L1 stills for all seven requested states plus hurt, mounting and dismounting. The mounted bicycle is moved from the authored parking space into the open street between the mount and ride stills; no bike video disguises that reset. `media-validation.json` verifies PNG widths ≤1600 and video durations ≤15 s.

`metrics.json` contains anatomical before/after measurements; `cpu-profile.json` contains the isolation timing probe. `capture-summary.json` lists observed clips, fast-click attacks and zero console errors. Full gameplay samples and before/after recorded joint transforms are retained as gzip JSON for reproduction. The tools read the compressed pose files directly.

See the report for exact validation results and remaining limitations: brisk short-legged run, fast knee windup, blended mount/exit, and strap stretching during extreme bat poses. Screenshots document the improvement; they are not a claim of flawless animation.
