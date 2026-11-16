# s142-l3hit · L3 point-blank damage

## Finding

Product defect reproduced with a real infected spawn: at X=169.65, Z=-0.94 the L3 bridge walking surface is Y=5.7 and the courier body is Y=6.42, but an XZ-only infected spawn was placed at Y=0.7 and remained there after three seconds. The original #793 diagnostic likewise records Y=0.7. A horizontal handgun ray from the deck cannot intersect that body's vertical hit range.

The spawn path defaulted an omitted height to ground-level support. XZ-only encounter spawns now use the authored walking surface; explicitly supplied heights still use support below that height for stacked routes. The existing combat battery now spawns a real runner on the bridge without manually changing its height and verifies handgun damage over eight seconds. The provisional driver axe fallback was removed. No infected stats or corpse lifecycle changed.

The original shot-by-shot log is unavailable; the native reproduction establishes the height failure directly. The earlier manually elevated dummy probe hid this defect.

## Evidence

- `tests/fixtures/saves/qa/s142-l3-bridge-pointblank.json.gz` is a native mission-resume fixture at tick 10900 on the L3 bridge, with the courier and a live target within 1 m. It is a constructed reproduction fixture, not a recovered save from B112.
- `tests/engine/combat.test.ts` records each weapon, aim, ray-selected target, hit IDs, and a no-damage classification in the eight-second point-blank test trace. It tests handgun and axe at 0.1 m, the authored L3 bridge, and on-foot starts in L1–L8/L10.
- [`l3-bridge-crowd.jpg`](l3-bridge-crowd.jpg) is the B112 screenshot reviewed for this report.
- The fixture was restored natively and the target was killed by two handgun attacks (one hit event). Restore clearance moves the target from the overlapping capture position to about 0.5 m away.

## Validation

- Regression merged into the existing gun test to keep collection at 150/150 cases. Full remote suite passed: 27 files, 105 passed and 1 skipped, 174.5 s within the 240 s budget.
- TypeScript and lint passed after the final all-level probe and trace edits.
- QA build passed.
- Direct headless WebGL2 bridge confirmation passed HIGH then LOW: real runner spawned at Y=6.4 and took three 20-point handgun hits (60→0 HP), with no browser errors. The closer fixture dummy intercepted the first three shots; the runner then took damage. See `browserConfirmation` in evidence.json.
- Remote suite completed successfully on runner 46.225.66.90.
- The archived B112 attack-level ray trace is missing; the real-spawn native regression proves the product height defect and its correction.

## Final scope audit

Real infected.runner production-spawn probes now pass in L1, L2, L4, L5, L6, L7, L8 and L10 with aim tracking the target each tick for three seconds. The existing L3 real-runner bridge test covers eight seconds. These are controlled contact probes, not full campaign scans. L9 on-foot crash combat, a live-encounter replacement fixture and a persisted complete attack trace remain open.
