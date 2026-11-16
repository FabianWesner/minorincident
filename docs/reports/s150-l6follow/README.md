# s150 — L6 follower follow-through

## Result

The complete `npm run qa:threat` audit passed with **0 acceptance fail flags** (150/150 test inventory; 364.1 s). L6 retreat no longer records the two stationary-follower failures. The full receipt is in the ignored `test-results/qa-threat/` output; a compact, committed summary is in [report.json](report.json).

## Change

The L6 retreat follower controller held every injured survivor stationary while the leader was before x=25 m. That left IDs 26 and 36 on the side platform while the retreat moved. Injured survivors now use the same formation and catch-up movement as the rest of the column; no zombie health, damage, speed, or population cap changed.

The full audit also exposed a late hatch reopen behind the completed column: the hatch at x=198 m broke when the retreat leader was over 40 m ahead, with the director already at its 66-infected cap. A reopened cohort there could not join the encounter and produced `L6_HATCH_REOPEN_COUNT_MISMATCH`. The mission now skips that reopen when the retreat or exit has passed the hatch by more than 40 m. Hatches ahead or near the column keep the existing reopen behavior. Corpses and ordinary survivor deaths are unchanged.

## Pace and route evidence

- Skilled native L6 retreat: ID 36 recorded 217 walking samples at 2.2275 m/s; the group median was 2.2311 m/s, so ID 36 achieved 99.84% of group pace (above the 95% floor).
- ID 26 was bitten during the skilled route and marked turned at tick 3,900 (65 s); it reached 0 HP and `finished` at tick 4,200 (70 s). Its later stationary ticks are not walking samples. The passive retreat captured six pre-incapacitation samples at 4.251 m/s against a 2.235 m/s group median. The compact JSON preserves the sample counts and the per-tick status evidence.
- The passive route also recorded ID 36 at 5.110 m/s over six samples against the same 2.235 m/s group median; both passive sample counts are below the ten-sample reporting minimum.
- Independent L6 normal-walk completed in 200.40 s. Retreat waiting was 0 ticks (s148 ceiling: 11); backtracking was 0 ticks.

## Validation

- `npm run qa:threat` — passed, 0 fail flags.
- `npm test` — passed locally, 106 tests / 27 files; test-budget inventory 150/150 and wall time 134.9 s of 240 s. The prescribed remote wrapper could not dispatch because no Hetzner runner was healthy. `scale.sh add` also could not reach the Hetzner API (DNS unavailable), so no runner was created.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
