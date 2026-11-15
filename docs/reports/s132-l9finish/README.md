# s132-l9finish — incomplete acceptance

Implementation: `6b638cf0`. After eight seconds beyond hatch defense, living stragglers visibly sprint to a reachable truck boarding position; the sit-down animation completes without its timer restarting every tick. Crowd separation yields to this scripted route. Zombies retain their normal attacks and stats; corpses persist.

## Verified

- Focused existing vehicle tests pass, including native s124/s126 saves. These establish evacuation completion, not L10 arrival.
- Typecheck and lint pass.
- Full remote `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 105 passed / 1 skipped, 27 files, 136 seconds; 150-case collection budget unchanged.
- L9 vehicle campaign motion gate: HIGH and LOW pass with identical source hashes (103.941 s / 76.203 s).
- Full threat audit: exit 0, 470.7 seconds, zero fail flags including L9.
- HIGH road twice via headless tools/playtest: both finished; first one P2 frozen-infected observation, second zero issues.

## Unmet requirements and findings

The first road run boarded everyone before defense expired. Actual L10 load occurred about 39 seconds after defense expiry: player-driven bridge travel, mandatory crash, crawl and caption remain after evacuation. The requested literal defense-to-L10 limit is therefore not met by the boarding fallback alone.

HIGH dry-shortcut attempt reached (436.9, -1.7), then remained at the bay approach for 297 seconds. It hit the eight-minute cap without reaching defense, with boarder prompts and multi-second hitches. This is a failed acceptance attempt, not a passing shortcut run. The LOW real-input run remains outstanding.

The archived batch-108 road log confirms 3/4 aboard at tick 10569 (defense complete 8859), but contains no survivor identity/position census. Its specific straggler behavior cannot be reconstructed from that log. The separate shortcut observer records Rosa grabbed by #840, then fleeing/recovering; it cannot establish the identity in the road run. New runs include a read-only per-survivor census.

Raw current logs and captures: `test-results/s132-l9finish/`. Compact receipt: `evidence.json`. Reviewed `road-sheet.jpg` shows hatch defense, wreck/crawl, and L10 loading from the first road run. It does not show fallback activation because this run boarded everyone before defense ended. The final acceptance matrix remains incomplete. No deployment, push, or main movement performed.

## Completed real-input matrix

All four successful runs used headless tools/playtest through the browser pool, standard mortal input, WebGPU, ports 5001/5002, and one browser per reservation. Observer samples are approximately one second apart; delays below are the first observed evacuation-complete sample after the exact defense-end tick.

| Run | Evacuation complete after defense | Result |
| --- | ---: | --- |
| HIGH road 1 | 0.53 s | L10 reached; one P2 observation |
| HIGH road 2 | 1.05 s | L10 reached; zero issues |
| HIGH shortcut retry | 10.28 s | L10 reached; one P2 observation |
| LOW road | 13.87 s | L10 reached; one P1 frame hitch, three P2 observations |

The shortcut retry follows the authored gate side opening using physical keys. The earlier failed shortcut remains preserved separately. These results prove the evacuation timing in this matrix, but do not prove actual L10 arrival within 20 seconds. The ending-scope clarification remains pending. The report's earlier outstanding LOW/shortcut notes describe the initial attempts and are superseded by this matrix.
