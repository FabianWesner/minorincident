# s132-l9finish — incomplete acceptance

Implementation: `6b638cf0`. After eight seconds beyond hatch defense, living stragglers visibly sprint to a reachable truck boarding position; the sit-down animation completes without its timer restarting every tick. Crowd separation yields to this scripted route. Zombies retain their normal attacks and stats; corpses persist.

## Verified

- Focused existing vehicle tests pass, including native s124/s126 saves. These establish evacuation completion, not L10 arrival.
- Typecheck and lint pass.
- Full remote `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 105 passed / 1 skipped, 27 files, 136 seconds; 150-case collection budget unchanged.
- Full threat audit: exit 0, 470.7 seconds, zero fail flags including L9.
- HIGH road twice via headless tools/playtest: both finished; first one P2 frozen-infected observation, second zero issues.

## Unmet requirements and findings

The first road run boarded everyone before defense expired. Actual L10 load occurred about 39 seconds after defense expiry: player-driven bridge travel, mandatory crash, crawl and caption remain after evacuation. The requested literal defense-to-L10 limit is therefore not met by the boarding fallback alone.

HIGH dry-shortcut attempt reached (436.9, -1.7), then remained at the bay approach for 297 seconds. It hit the eight-minute cap without reaching defense, with boarder prompts and multi-second hitches. This is a failed acceptance attempt, not a passing shortcut run. LOW and vehicle-motion gates remain outstanding.

The archived batch-108 road log confirms 3/4 aboard at tick 10569 (defense complete 8859), but contains no survivor identity/position census. Its specific straggler behavior cannot be reconstructed from that log. The separate shortcut observer records Rosa grabbed by #840, then fleeing/recovering; it cannot establish the identity in the road run. New runs include a read-only per-survivor census.

Raw current logs and captures: `test-results/s132-l9finish/`. Compact receipt: `evidence.json`. A reviewed report sheet and final acceptance matrix remain to be produced. No deployment, push, or main movement performed.
