# r42-alphamix: Alpha mix gaps in L3, L6 and L7 (2026-11-11)

Queue item: "no Alphas in L6/L3 routes; no Screamer in L7 (LevelSevenEncounters hard-codes Brute/Thrower)." PO: each Alpha type
keeps its own moves (r32-alphas), zombies are identical everywhere, difficulty comes from level design. Spec:
docs/design/boss-and-alpha-moves.md (level mix).

## What changed (sim only, no stat or AI tuning)
- **L7** (`LevelSevenEncounters.alphaType`): the hard-coded Brute/Thrower pair is replaced by slots of the shared mix
  (`alphaMixFor('L7')` = brute, thrower, screamer; new helper in `src/data/alphaTypes.ts`). Same five Alphas, same groups and
  counts: opening street Brute, second street Screamer, fourth street Thrower, final corridor Brute + Thrower.
- **L6** (`LevelSixSubway.spawn`, `l6HatchAlphas` in `src/data/l6.ts`): the catalog armored front member of two tunnel hatch
  cohorts is the level's Alpha instead: hatch at x 126 = Screamer, hatch at x 198 = Leaper. They take the armored member's
  cohort and cap slot (cohort sizes, reservations and the telegraphed bang are unchanged), come through the hatch toward the
  tunnel route the courier and the column walk, and are pressed/rushed at her like every hatch arrival.
- **L3** (`LevelThreeCollapse.alphas`, `l3.density.alphas`): one Thrower waits at x 116 (end of S3, before the army line). It is
  admitted only while its point is off screen, once the courier is 36 m short, on the E-W street she is walking on (nearest of
  blvd/commerce/oak, so she meets it by following the corridor), then pressed at her within 40 m. State in
  `state.l3.alphaAt/alphaIds` (the probe saw it re-admitted after a death-restore).
- Test: `tests/engine/infected-ai.test.ts` (existing alpha-type test, no new case) asserts the L7 mix has Screamer and that the L3
  data and L6 hatch Alphas are types of their level mix.
- Probe: `tools/qa/r42/alpha-mix-probe.ts` (complete-policy native route, high and low; `TRACE=1` for positions).

## L3: why one Alpha, and where
Tried against `threat-audit --levels L3` (control with no Alphas reproduces baseline exactly, deterministic):
| Variant | L3-06 squad at army | L3-11 attacks/min |
|---|---|---|
| Brute x 14 + Thrower x 104 | FAIL (1/3) | not measured |
| Thrower x 104 | FAIL (1/3) | not measured |
| Brute x 66 + Thrower x 116 | PASS (2/3) | FAIL (seed 1 26.9/min, limit 25) |
| **Thrower x 116 (shipped)** | PASS (2/3) | PASS (2/3) |
The skilled bot dies repeatedly to a Brute (slam/charge/grab) and the squad pays for it. The Brute stays in the L3 mix
(`levelMix.L3`) for a follow-up with a different lever (e.g. a Brute that appears once the squad is already thinned, or a bot
that kites it) instead of a numbers change. The requested "1 to 2" is met with 1.

## Verification (seed 1, native; Mac, `tools/qa/r42/alpha-mix-probe.ts`)
| Level | Quality | Alphas | Result |
|---|---|---|---|
| L3 | high, low | Thrower at (116,-28) | spawns off screen, engages in ~25 ticks, living-missile / attack, min distance 1-5 m |
| L6 | high, low | Screamer (123,13), Leaper (195,13) | engage within 15 ticks of appearing, min distance 1.2-1.3 m, both killed by the courier |
| L7 | high, low | Brute, Screamer, Thrower, Brute, Thrower | all engage; the opening ones are rocketed before they reach her (rocket kills at range, as before); the final pair attacks (charge, slam, throw) |
Peak alive: L3 130 / cap 140 (high), 97 / 100 (low); L6 30 / 30; L7 199 / 200 (high, was 196), 97 / 100 (low).
Corpses are untouched (no removal code added).

Threat audit `--levels L3,L6,L7` (baseline = main before the change, 12 fail flags): final run has the same flag set
(L3 KITING_LANDED_HITS_BELOW_2; L6 breach2 first attack + entry-2/5/3 count mismatch; L7 KITING x2, SLOW_FOLLOWER 96/98 corridor and
encounters). Earlier variants added L3-06, L3-11 (L3, above) and `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` (L7 passive, boarding
window, when the Screamer was on the fourth street near the boarding; moving it to the second street cleared it).
Receipts are in the lane scratchpad (`r42/base`, `new2`, `newE`, `new3`), not in git.
`sh tools/remote/run.sh $PWD -- npm test`: 27 files, 106 passed, 1 skipped (107 cases, limit 150).
Nightly `waves.test.ts` + `war-waves.test.ts`: see the end of this file.

## Browser QA needed
- L6 high and low, zoom 1.5 and 1: hatch at x 126 (Screamer, thin hoodie Alpha) and x 198 (Leaper, crouched suit Alpha) arriving at
  the telegraphed bang: do they read as Alphas in the tunnel, is the Screamer roar (inhale, called infected) visible, is there room
  to fight in the 6.9 m tunnel, no Alpha stuck behind a closed hatch for more than the 8 s bash.
- L3 high and low, tick ~ x 80..116 on Boulevard, Commerce and Oak: the Thrower appears out of view, walks into the street, throws.
- L7 high and low: the second-street Alpha is now a Screamer (look `inf.alpha-hoodie`), roar and called runners.
