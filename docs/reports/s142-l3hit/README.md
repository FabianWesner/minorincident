# s142-l3hit · L3 point-blank damage

## Finding

The B112 observation is not evidence of infected invulnerability. The raw issue diagnostic for infected #793 records the handgun selected, `mouseAttack: true`, an aim point exactly at #793, and a rendered-body pick of #793. The capture shows the courier surrounded by a dense group on the bridge. The archived run did not retain a L3 save or per-shot ray/hit events, so it cannot identify which body each of the eight seconds of shots actually struck.

Native combat probes found no point-blank or damage-system rejection. A held handgun and fire axe both damage a living target at 0.1 m in an eight-second trace. The same handgun probe on the authored raised L3 bridge damages its target; the target must be placed at the bridge deck height. Native three-second probes also hit at player start in L1–L8 and L10. L9 begins with the courier inside the APC and has no on-foot carried-weapon attack before its forced crash, so it is outside that scan.

The evidence points to a playtest-driver targeting failure in the crowd: it kept selecting one overlapping body and did not change tactics when the gun's ray could be intercepted by another infected. The driver now switches to the fire axe when an L3 target is within 1.25 m while the handgun is selected. No combat or infected stats changed.

## Evidence

- `tests/fixtures/saves/qa/s142-l3-bridge-pointblank.json.gz` is a native mission-resume fixture at tick 10900 on the L3 bridge, with the courier and a live target within 1 m. It is a constructed reproduction fixture, not a recovered save from B112.
- `tests/engine/combat.test.ts` records each weapon, aim, ray-selected target, hit IDs, and a no-damage classification in the eight-second point-blank test trace. It tests handgun and axe at 0.1 m, the authored L3 bridge, and on-foot starts in L1–L8/L10.
- [`l3-bridge-crowd.jpg`](l3-bridge-crowd.jpg) is the B112 screenshot reviewed for this report.
- The fixture was restored natively and the target was killed by two handgun attacks (one hit event). Restore clearance moves the target from the overlapping capture position to about 0.5 m away.

## Validation

- Focused combat suite: 8 tests passed.
- TypeScript and lint passed after the final all-level probe and trace edits.
- QA build passed.
- HIGH browser confirmation could not start: the managed sandbox returned `listen EPERM` for `127.0.0.1:5021`. LOW was not attempted. The browser confirmation remains open.
- The mandated remote unit suite was unavailable because `tools/remote/run.sh` found no healthy Hetzner runner; its local Mac slot does not admit `npm test`.
- The archived B112 attack-level ray trace is missing, so the exact intercept for #793 remains unproven even though the point-blank product path passes native tests.
