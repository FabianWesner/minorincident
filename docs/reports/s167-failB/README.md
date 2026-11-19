# s167-failB — fresh acceptance FAIL rows: triage and fix

Base: main `5edb62ea` (the sheet's FAIL values were measured from fresh native receipts at that head;
the committed `fix51-verify` receipts were stale from Nov 7, so every failing clause was re-derived
locally and then re-measured on the remote runner at this lane's head, one level per run:
`npm run qa:accept -- --level L4|L5|L6 --skip-browser`). Regenerated receipts were restored
(`git checkout -- docs/reports/fix51-verify`) and are not committed; the exact fresh values are in
[evidence.json](evidence.json).

Verdict classes: **1** real gameplay defect, **2** probe/measurement defect, **3** target outdated by a
later decision (quoted from `/Users/wesner/Workspace/minorincident/epics-pipeline/po-decisions.md`;
targets NOT changed here).

| Row | Class | What changed / why | Before → after |
|---|---|---|---|
| L4-04 | 3 | No change. HIGH caps were deliberately raised to 160 infected / 230 characters (batch 99); the sheet still checks ≤120/≤190. | high/stationary 130 (target ≤120) → 130, within the accepted 160 cap |
| L4-06 | 3 | No change. Failing clauses are LOW-only; the PO accepted the composition and the row is judged on HIGH (which passes). | low/stationary 41 / 13 (targets ≥60 / ≥40) → unchanged by design; high passes 62 / 46 |
| L4-07 | 2 + 3 | Probe fixed: the worst-tick 2.5×-bounded share counted infected whose legal unbounded route merely detours (breach funnels, yard strips) as unreachable; the observer now proves the legal ground/vault/barrier route and counts only routeless infected. The remaining high/complete reading is the accepted HIGH horde pour (class 3). | low/complete 75 → **93.75 PASS**, low/stationary 86.96 → **100 PASS**, high/stationary 90.9 → **100 PASS**; high/complete 58.62 → 58.62 (still FAIL, class 3) |
| L5-05 | 2 + 3 | Reach clause fixed by the same probe fix (the two "blocked" infected were tailing through an adjacent yard strip with a legal detour; sustained-lock criteria recorded 0 s). The attack-rate / first-attack clauses are outdated by the PO's quiet first-rescue decision (quotes below). | low/complete reach 84.6 → **100 PASS**; stationary 0 windups in 228.35 s and high/complete 2.256 windups/min unchanged — by the accepted design |
| L5-08 | 1 (OPEN) | Real follower-band defect, not fixed in this box. Fresh: low/complete in-band mia (id 31) 91.60 %, dale (id 28) 89.85 % (target ≥95 %; worst run 90 ticks = 1.5 s ≤ 2 s); high/complete look pace dale 0.8823 / 0.9152 (seeds 1/3; every-ratio ≥0.95 vote fails). Diagnosis: the rear follower falls out of the calm-escort branch at corners/wrecks and rides the 3.8 m/s base pace (dale's look median 3.69 m/s vs a 4.10 group median inflated by fix53-b catch-up runners), drifting out of the 2–5 m band. Needs a follower-controller lane in `src/sim/outbreak/Survivors.ts`. | low band 92.12/89.22/85.26 (sheet) → 91.60/89.85 (fresh, still FAIL); high pace ratios still FAIL |
| L5-09 | 2 (FIXED) | The `complete` LevelFiveBot never responded to a following survivor being grabbed: its rescue branch only triggers for *cowering* followers, and victims go calm → flee → grabbed without ever cowering (okafor and mia died at full HP 4.6–7.7 m behind the courier while the in-game "Survivor under attack!" alarm fired and the free-on-hit window stayed open). The driver now turns back and strikes the grabber inside that window — the protection the policy is defined to model. | low/complete rescued 3 → **4 (PASS, target 4–5)**; high/complete rescued 5 → 5 |
| L6-07 | 3 | No change. The ≤30 low concurrent cap was authored with the PO's 2026-11-08 "3-infected cohorts every 40 s" pacing; batch94 deployed tier-independent 4-per-14 s pressure, which exceeds 30 concurrent on a normal no-kill retreat. Fresh: every other L6-07 clause passes (windups 16.2/min ≥ 4, retreat damage 55 ≥ 30). | low/complete retreat concurrent 56 (target ≤30) → 56 unchanged |
| L6-08 | 3 | No change. The failing row is okafor (id 42, a healthy L5-carried survivor) at 0.9268× of the step/exit group median over an 8.4 s / 11-sample exit dash; the 2.26 m/s median is inflated by s148 catch-up runners (up to 1.26×) while okafor walks near the authored 2.2 m/s (2.09). Injured followers pass (0.9726–1.0) and the sustained 126 s retreat walk passes for everyone (min ratio 0.9948). | step/exit okafor 0.9268 (unchanged); retreat rows ≥0.9948 |
| L6-10 | 3 | No change. The offenders are exactly the fixed `l6-stair` waypoint at the escalator foot (250, 15) during exit ticks 11198–11233; all 12 gate-branch checks pass and the gate/platform/night-exit anchors all hold. That waypoint is the recorded 2026-11-17 exit-guidance decision — the marker is fixed and never walks ahead of the group; the fixture's allowed-anchor list predates it. | offenders: l6-stair rows only, unchanged |

Code changes (commit `qa(l5/l4)`): `src/debug/bot/LevelFiveBot.ts` (grab rescue for the complete
driver — L5-09), `tools/qa/threat/observer.ts` (prove the legal route before counting an infected
against the reachable share — L4-07/L5-05), `tools/qa/accept/evaluate.ts` (clause label states what is
measured). **No gameplay, level, encounter, AI, mission code, zombie stats or targets changed.**

## Class 3 quotes and proposed targets (orchestrator to decide; targets left untouched)

- **L4-04** — po-decisions 2026-11-14 ~16:50: *"s110/s111 restored the L4 alarm horde (cohort 36, caps
  HIGH 160 / LOW 144)… Decision: LOW caps back to pre-s110 (80/120); **HIGH keeps 160/230** and
  cohort 36… Implemented in lane s113-l4tank. Tell the PO."* Deployed as batch 99. The code confirms
  `caps: { infected: { high: 160, low: 80 }, characters: { high: 230, low: 120 } }` (src/data/l4.ts).
  Proposed target: high war living infected + reserved slots ≤ **160**, living characters ≤ **230**;
  low unchanged (80/120). Fresh high/stationary 130 ≤ 160.
- **L4-06** — po-decisions 2026-11-12 ~20:30: *"Played L4 + L5 both accepted"… **L4-06 population
  audit flags (first-breach alive / plaza density) are no longer a release blocker; the L4 composition
  stays as it is.*** Plus 2026-11-14: *"**L4-06 is judged on HIGH** (the tier the PO plays, the original
  audit scope), LOW census reported for information."* Both failing clauses are low/stationary (41 vs
  ≥60 at first breach; 13 vs ≥40 sustained plaza minimum); high passes (62 / 46 fresh).
  Proposed: judge L4-06 on HIGH; report the LOW census informationally.
- **L4-07 (high/complete remainder)** — the same 2026-11-14 horde decision (cohort 36, batch 99,
  *"horde reads as a fight 8/10"*). At the worst tick 12 of 29 nearby infected are genuinely routeless
  while queued at the north breach funnel, yet the war lands 218 player windups/min (target ≥6/min) and
  the audit's lock criteria stay green (no STUCK_CHASER; `qa:threat` 0 flags). The instantaneous
  worst-tick floor cannot hold for the accepted pour composition. Proposed: replace the worst-tick
  ≥90 % floor with the accepted lock criterion — zero STUCK_CHASER flags and no routeless share >30 %
  sustained beyond the cohort arrival cadence — keeping first-attack ≤10 s and ≥6/min (both pass).
- **L5-05 (attack clauses)** — po-decisions 2026-11-10: *"**L5 is still too hard. I cannot rescue my
  1st survivor. Too many Zombies***" → authored quiet first-rescue pocket + corridor (f3798bba:
  28 m pocket at Mia, 22 m at Okafor, 9 m corridor from the cellar); and 2026-11-12 ~20:30:
  *"Played L4 + L5 both accepted"* on batch 87, which contained that composition. The passive courier
  stands inside that corridor at the cellar exit: 0 windups for 228.35 s (was 200/min on Nov 7), and
  the competent route's look phase reads 2.26 windups/min on high. Proposed: measure passive
  first-attack ≤20 s and ≥3 windups/min outside the quiet first-rescue corridor (e.g. from the second
  ring onward), or a PO-decided explicit expectation for the corridor.
- **L6-07** — po-decisions 2026-11-13 15:50: *"batch94 deployed (0bb6a649) with **L6 compromise
  4/14 s** + breach-2 offsets 9,14,20"* (tier-independent pressure; the s97 12→8 s and s99 4/20 s
  variants were rejected for making the route harmless). With ~4 admissions every 14 s a no-kill
  retreat accumulates 56 concurrent (fresh) against the 30 authored for 3-per-40 s; the courier's own
  damage/protection clauses all pass. Proposed: low concurrent cap ≤ **60** (aligned with high and the
  deployed pacing), or re-split the pacing per tier as an explicit orchestrator decision.
- **L6-08** — po-decisions 2026-11-16: *"L6/L7/L8 escorts — **followers get catch-up pacing** and
  fewer 'wait for us' prompts so escorts are fighting, not waiting (lane s148-escortpace…)"*. Catch-up
  runners (up to 1.26×) now inflate short transition-window medians (2.26 m/s) above the authored 2.2
  m/s walk, so a rear in-band follower reads 0.927× without being a straggler (no regroup/wait
  triggered, injured followers pass, the sustained 126 s retreat walk passes at ≥0.9948). Proposed:
  compare injured/rear follower pace against the authored 2.2 m/s base (≥0.95× = 2.09 m/s floor), or
  restrict the ratio clause to sustained walk phases.
- **L6-10** — po-decisions 2026-11-17 08:45: *"Exit guidance now leads to the escalator foot."*
  (cc1f961d/19581f49; the stair waypoint hands back to the night-exit past x 249.4, and to the street
  ring when nobody is following). The marker stays at fixed anchors and never moves with the group;
  the fixture's allowed set (gate wait spots / exit-platform / night-exit) predates the decision.
  Proposed: accept the fixed `l6-stair` escalator-lane waypoint (x 244/250, z 15) as a valid
  retreat/exit marker.

## Re-measurement and validation

- `sh tools/remote/run.sh $PWD --pull docs/reports/fix51-verify -- npm run qa:accept -- --level L5 --skip-browser` → "L5: 2 fresh failing rows" (L5-05, L5-08 remain; **L5-09 fixed**).
- `-- --level L4 --skip-browser` (re-run after a parallel-pull race) → "L4: 3 fresh failing rows" (L4-04, L4-06 unchanged class 3; L4-07 now fails only on high/complete).
- `-- --level L6 --skip-browser` → "L6: 3 fresh failing rows" (L6-07, L6-08, L6-10 — all class 3, values unchanged: 56 / 0.9268 / l6-stair offenders).
- `npm run typecheck`, `npm run lint`, `npm test` (106/106, 104.6 s of a 240 s budget) — all pass.
- `npm run qa:threat` → **0 fail flags**, 253.6 s (L4 hold census, L5/L7 follower pace seeds, all
  level audits green). No gameplay code was changed, so this run is a guard, not a requirement.

## Open items

1. **L5-08 (class 1, open)**: rear-follower band/pace — the only defect row without a fix in this box.
   Evidence and diagnosis above; the fix belongs in the shared follower controller
   (`src/sim/outbreak/Survivors.ts`, calm-escort branch selection at corners/wrecks).
2. **L4-07 high/complete (58.62)** and the L5-05 attack clauses remain measured FAILs pending the
   orchestrator's target decisions (class 3 quotes above).
3. All six class-3 rows keep their current targets; the sheet will stay FAIL until the orchestrator
   updates `docs/qa/level-acceptance.md` (nothing was loosened here).
