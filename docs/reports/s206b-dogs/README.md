# s206b — Faster dogs and vehicle contact

The s206 merge was restored in `2b682b49`: dog run factor is 1.65, 1.5 times the previous 1.1. Its gait, L10 bot and encounter adjustments, and L8 formation correction are retained; see the [s206 report](../s206-dogspeed/README.md).

The L9 high campaign replay initially measured 35.1 cm maximum slide (34.2 cm p95) for Alpha 848. The Alpha retained running velocity during the stationary living-missile heave. `a7c2b28f` clears locomotion for living-missile and barrage windups as the existing grab-throw does. Another witness, a hidden bus passenger, had its exit relocation measured as a 172.8 m/s stride. `ee28ebba` and `7171043b` exclude the relocation from the first visible gait speed for hidden attached passengers. Physical contact and gate thresholds remain unchanged.

## Validation

- `SCENE_PORT=5203 npm run qa:vehicle-campaign-motion`: passed all eight high and low fixtures on revision `7171043b`. L9 high maximum was 4.2 cm, p95 3.0 cm; the bus passenger had a grounded contact.
- `SCENE_PORT=5204 npm run qa:vehicle-motion`: passed.
- `npm run qa:threat:sharded`: both shards and merge passed with zero acceptance fail flags and all ten skilled routes complete. Several passive routes reached their tick budget, as recorded in the audit; none had acceptance flags.
- `npm run typecheck` and `npm run lint`: passed on the final source revision.
- Focused infected AI and vehicle tests passed; vehicle tests passed again after the final scope adjustment.
- `sh tools/remote/run.sh "$PWD" -- npm test`: passed, 27 files, 105 tests passed and one skipped; 193.0 seconds against the 240-second budget.
