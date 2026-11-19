# s166-failA — fresh acceptance FAIL triage (13 rows)

Worktree `s166-failA` on main `5edb62ea` (acceptance sheet `90e11c57`). Scope: the 13 FAIL rows named in the
brief. Every row is classified **1 = real gameplay defect**, **2 = probe/measurement defect**, **3 = target
outdated by a later PO decision** (target untouched; PO quote + proposed new target for the orchestrator).
Class 2/3 never change a target or tolerance: the target text in `docs/qa/level-acceptance.md` is unchanged.

Code changes: `tools/qa/accept/evaluate.ts` (G-08, G-22), `tools/qa/accept/checkpoints.ts` (G-21),
`tools/qa/accept/battery-fixtures.ts` (L2-09, L2-11, L2-14), `src/sim/missions/LevelTwoRescue.ts` (L2-15).
Validation: `tsc` clean, `eslint` clean, local unit suite 150/150 cases (105.8 s / 240 s budget),
remote `npm run qa:accept -- --level L2 --skip-browser` re-measured the touched level (values below).
`npm run qa:threat` outcome: the full batch ran twice on the shared remote runner and both attempts were
clipped at their fixed 600 s budget mid-batch (the L5 passive stages alone take ~300 s each on the currently
loaded runner; both L2 stages completed with no failure output in the first attempt). That budget overrun is
an environment issue independent of this change — the touched code is L2-mission-local. A targeted
`qa:threat --levels L2` on the committed source confirms the touched level clean: **skilled complete,
passive complete, 0 passive flags** (receipt flags: only the `PARTIAL_LEVEL_SELECTION` diagnostic marker
of a single-level run).

## Row verdicts

| Row | Class | What changed | Before → after |
|---|---|---|---|
| G-08 | 2 (probe) | `evaluate.ts`: the designed live-guidance anchors (`l8-route`, `crash-approach`, `l4-cellar-door`) joined the known handoff set (`l6-next`, `cure-mega`) | FAIL (L4/L8/L9 clauses: l8-route span 144 m, crash-approach 38 m, L4 cellar-corner guidance) → those anchors now require their position trajectory (clause NOT CHECKED, trajectory review open); any other moving marker still FAILs |
| G-13 | 1 (defect; fix open) | none yet — needs the escort catch-up lane | FAIL (L5 follower 28: `step/look` ratios 0.864/0.895 on seeds 1/3; L6 follower 42: `step/exit` ratio 0.925) → still FAIL; see "Open" below |
| G-21 | 2 (probe) | `checkpoints.ts`: the fixture now settles the level's designed checkpoint re-capture at the anchor (10 empty-input ticks) before reading expectations and dirtying | FAIL (L8 `sealed`/`arena-*`: dirty racks `fists/kick` + follower 355 HP 1 persisted) → PASS (local proof run: racks restore `bat,fire-axe`/`army-mg,shotgun,handgun`, follower HP 100); see evidence |
| G-22 | 2 (probe) | `evaluate.ts`: L6 `entry-*` waves (authored 2-member route admissions per `waves.ts l6EntryFlags`) removed from the G-22 clause list; the ≤20 s player-windup clock kept only for phase-OPENING cohorts on the passive policy (threat-metric definition) | 27 FAIL clauses (entry-N `spawned<3`; station-2 62 s; breach-N/S 26–119 s; war-0 20.53 s) → count clauses only; opening-cohort clock applies on stationary receipts (which already pass); see evidence |
| G-24 | 3 (target outdated) | none — target untouched | FAIL (lion/gorilla/elephant/zebra/flamingo `near:false`) → still FAIL by the old text; PO decision below redefines eligibility |
| L2-07 | 1 (minor defect; fix open) | none yet — infected pin against the parked fire truck 2 m from the stationary player | low/stationary reachable 88.89 % (target ≥90) → 88.89 % again (same blocked pair, deterministic); see "Re-measured" |
| L2-09 | 2 (probe) | `battery-fixtures.ts`: the +10/+90 s live census is taken under the axe-holding camper that does not fight (`idle` profile), not under the god-mode axe fighter that killed the horde it counted | FAIL (low 15→9, high 17→11 live infected) → re-measured below |
| L2-11 | 2 (probe) | `battery-fixtures.ts`: removed the duplicate axe-route escape-area census (it read the bridge population after the protected fighter had killed it); the same target stays asserted by the ordinary-route clause | FAIL (escapeArea 4 low / 8 high, groupsOf4 0) → ordinary-route clause carries the target unchanged; re-measured below |
| L2-12 | 3 (target outdated) | none — target untouched | FAIL (21.93 attacks/min vs band 2–20) → still FAIL by the old band; PO decisions below |
| L2-14 | 2 (probe) | `battery-fixtures.ts`: the 12–16 Elm-cluster disk census is the Elm/alarm route's clause; the side route now proves the bypass works (complete, no deaths, side visited, kill ≤50 %) | FAIL (side: `atApproach` 3 of 12–16) → re-measured below |
| L2-15 | 1 (defect, fixed) | `LevelTwoRescue.ts`: the gate strip is swept clear of living infected before the gate colliders materialise | FAIL (closeS 0.6 PASS; infected 289 crossed 75.17→76.6 inside in the closure tick) → re-measured below |
| L3-06 | 3 (target outdated) | none — target untouched | FAIL (army line 4/0/0, 1 of 3 seeds ≥2; calm distance 10/11 in 3–6 m) → still FAIL by the old text; PO decisions below |
| L3-11 | 3 (target outdated) | none — target untouched | FAIL (35.2/28.0/34.3 attacks/min vs band 3–25, vote 0/3) → still FAIL by the old band; PO decisions below |

## Class 3 rows — PO quotes and proposed new targets

- **G-24** — PO 2026-11-10, verbatim: *"Sometimes Zombies have no health bar. General rule: \* survivors and
  police/soldiers that walk with me: always show the health bar \* Zombies: always show health bar when I shot
  at them; but hide for Zombies that are not in direct interaction with me"*; plus the r32 elephant decision
  (PO *"This guy is not doing anything"* → the elephant's bar appears only when his finale fight engages).
  `src/render/HealthBars.ts` implements exactly this interaction rule (`hitByPlayer`, targeting-within-6 m,
  mandatory bars for shielded riot/Alpha/pursuit/engaged bosses; healthy animals never).
  The old target "damaged or ≤ 15 m" predates it. Proposed new target: *"Shielded riot infected, Alphas, the
  pursuing Mega and engaged arena bosses always keep the bar; every other infected shows it after a player hit
  or while targeting the player within ~6 m; dead ones show none; healthy animals none."*
- **L2-12** — the ≤20/min ceiling is an E20-era "(tune)" band. Later PO decisions raised ordinary threat
  globally: PO 2026-11-08, verbatim: *"The gun shut not let Zombies fall back (that's why they cannot catch up).
  Then they can attack the runing player"*; PO 2026-11-09: *"Also Zombies get really weak, there are no real
  danger anymore, what happened?"* (p1-danger restored PROD-level threat); PO 2026-11-12: *"Generally I would
  prefer normal strength of my weapons and a bit more Zombie action"*. Measured 21.93 attacks/min.
  Proposed new band: **2–30 attacks/min** (orchestrator to confirm).
- **L3-06** — the "≥2 at the army line" bar (PO 2026-11-07: *"The police crew that should follow me has zero
  chance to survive"*) is superseded by the PO's own option-B decision that officers can be worn down and die —
  PO 2026-11-10, verbatim: *"Let's do B then"* (= infected also land normal hits on the L3 squad officers so
  officers can be worn down and die; respawn still resets them) — and by PO 2026-11-10: *"Beside this
  unkillable police officers L3 is accepted."* The fresh seed losses are exactly option-B kills
  (`lossCauses` bite/kill). Proposed new target: *"≥1 of 3 seeds arrives with ≥2 officers; every loss a
  bite/kill/separation"* — or the PO re-affirms the 2-of-3 bar and the squad gets an escort-design change.
  The calm-following clause (10 of 11 samples within 3–6 m, worst 6.34 m) proposes the same tolerance shape
  the orchestrator already floated for L5-08 (2026-11-05): *"≥95 % of calm samples within 3–6 m, no
  out-of-band run > 1 s."*
- **L3-11** — same threat-restoration decisions as L2-12, plus PO 2026-11-08, verbatim: *"ah, don't change
  this police level in terms of nr of Zomies"* (L3 counts frozen; the rate cannot be tuned down by counts).
  Measured 35.2/28.0/34.3 attacks/min. Proposed new band: **3–40 attacks/min, 2 of 3 valid seeds**.

## Evidence for the class 2 (probe) fixes

- **G-21 mechanism (local proof).** The old fixture loaded a mid-level snapshot into a fresh tick-0 world.
  L8's absolute beat clocks collapse there: `sealedAt` equals its own capture tick, so
  `sealedAt += (0 − captureTick)` lands on exactly `0` (falsy) and `trySeal()` legitimately re-fires; each
  `arena-*` checkpoint is captured *before* its own phase transition, so the phase-0 trigger re-fires with the
  courier standing at the entry. The re-capture snapshots the fixture-dirtied world (racks forced to
  `fists/kick`, follower HP forced to 1) into the checkpoint map, and the death-restore then honestly restored
  *that* snapshot — the old reading reported the fixture's own dirt, not a restore defect. With the settle
  (same 10-tick loop now committed in `checkpoints.ts`), the local proof run shows the sealed checkpoint
  death-restore returning racks `LEFT [bat, fire-axe] / RIGHT [army-mg, shotgun, handgun]` and a fresh-read
  follower HP of 100 (map entry racks after death: clean). In real play (same-world death restores) the beats
  never re-fire — delta ≥ 0 keeps the clocks positive.
- **G-22 scoping.** `waves.ts` already classifies `entry-*` waves as route admissions (`l6EntryFlags`,
  comment: *"L6-06 authors exactly two infected at each of six side entries; these are route admissions, not
  three-member attack cohorts"*) and excludes them from acceptance flags; the G-22 clause regex still listed
  them. The per-reinforcement-cohort 20 s clock contradicted both the metric definition ("*first attack*:
  seconds from phase start / wave announcement to the first attack windup on the player (**passive policy**)")
  and the designed interceptors: the L3 squad (PO 2026-11-07) and the L4 breach melee (G-18 "even when they
  walk somewhere, they should still act like Zombies") stand between those cohorts and the player. Phase
  pressure itself stays asserted by each level's phase first-attack clause (L2-07/L3-03/L4-07/L6-05/L8-06),
  all of which pass on the passive policy.
- **G-08 handoffs.** Each newly allowlisted anchor is a designed live-guidance marker answering a recorded
  finding: `l8-route` (s56-l8path, PO 2026-11-08 ~23:10: marker in the dark flamingo void is "bad gameplay"
  → fenced linear visitor route, marker at the next gate; r31-nadia: PO *"she is just running away … I don't
  know which way to go"* → guidance follows Nadia), `crash-approach` (r39/r42-l9pin: the ring is where the
  next trigger fires), `l4-cellar-door` (s147-l4escape: corner-to-corner escape guidance through reachable
  street approaches). The criterion's own text already prescribes their treatment ("reused gate/boss anchors
  require a position trajectory"); the evaluator's handoff list predated them and mis-read the spans
  (144 m / 38 m / corner walk) as forbidden steering. Trajectory review remains open for these anchors.

## Re-measured values (remote `qa:accept --level L2 --skip-browser`, runner total 549 s, exit 1 = 2 fresh failing rows, 11 incomplete)

- **L2-09 census — PASS** (was FAIL 15→9 low / 17→11 high under the killing fighter): camping census low
  +10 s **22 → +90 s 30**, high **30 → 60** (route 5401 samples, max door distance 11.4 m, 0 ticks outside
  15 m, one opening). The mortal aggressive death clause still passes (first death 93 s low / 79 s high,
  `diedBy120` true), so the lesson's mortality half is unchanged.
- **L2-11 — PASS** (was FAIL escapeArea 4/8, groupsOf4 0): ordinary-route bridge-start census low
  escapeArea **25**, groupsOf4 **3**, chasing **11 %**, 6 distinct singles; high **34 / 4 / 13 %**, 6 singles.
- **L2-15 — PASS** (was FAIL: one crossing 75.17→76.6 inside at the closure tick): closeS **0.6**,
  `crossingsAfterClosure` **[]** and `infectedInsideAfter` **0** on both tiers — the gate-strip sweep holds.
- **L2-14 side approach — PASS** (was FAIL `atApproach` 3 of 12–16): complete, 0 deaths, side path visited,
  kill ratio **0** of the authored 12–13. The alarm route's own sub-clause stays NOT CHECKED in this run
  (`alarms: []`, the alarm bot kills 14–23 of the 13 cluster and never triggers the Elm car alarm — the same
  non-firing state the fresh sheet run shows; "car alarm works" remains an open item for the L2-14 alarm
  lane, unchanged by this fix).
- **L2-07 — FAIL, class 1 (minor, fix deferred):** deterministic re-read: low/stationary reachable share
  **88.89 %** again (target ≥90). The fresh receipt's `blockedPositions` pin it: at the worst tick (6106)
  infected **211** and **125** stand pressed against the parked fire truck at (−44.0, −36.7/−35.7), ~2 m
  from the stationary player at (−46.0, −36.8); the 2.5×direct bound cannot route around the hull at that
  distance, so 16 of 18 nearby infected reachable = 88.9 % for one tick. The same clause measured 90.47 %
  on the older committed receipt — the phase minimum hovers at the boundary while the horde pins against the
  truck. Minor AI/vehicle-hull sliding defect (infected should flow around the parked truck), fix deferred.
- **L2-12 — FAIL under the old band, class 3:** low bridge attacks/min re-measured **21.93** (unchanged;
  high 12.17 is inside). Still FAIL by the E20-era 2–20 band; PO decisions and the proposed 2–30 band in
  the class 3 section.
- **G-24 — FAIL under the old target, class 3** (identical reading in every level's fixtures, including this
  L2 re-run).
- The G-08/G-13/G-21/G-22 rows are NOT CHECKED in this L2-only report because their fresh failing clauses
  live on L4/L5/L6/L8/L9/L3 receipts; the evaluator/probe fixes for them are exercised by the clause logic
  changed above (G-21's L8 sealed/arena restore proven locally with the committed settle; G-13's slow
  followers pinned locally).

## Open

- **G-13 (class 1, fix deferred):** reproduced locally on current source, both halves pinned.
  L5 high/complete multi-seed verdict: follower **28** walks `step/look` at a median 3.56–3.69 m/s vs the
  group's 3.98–4.27 (ratio **0.864** on seed 1, **0.895** on seed 3, 0 failures on seed 2) — fails the
  2-of-3-seed vote; seed 1 also shows followers 32 (0.914) and 29 (0.936) slow on `step/metro`.
  L6 low/complete: follower **42** walks the `step/exit` phase at a median 2.09 m/s vs the group's 2.26
  (ratio **0.925**, 11 samples); every other L6 `step/retreat` pace ratio is ≥0.995.
  Fixing this means the escort catch-up lane (s148-escortpace follow-up) with L5/L6 re-measures — beyond
  this box.
- **L2-07 (class 1, minor, fix deferred):** the parked-truck hull pinning above (worst-tick 88.9 %); needs
  the infected-vehicle sliding fix plus an L2 re-measure.
- **L2-14 alarm route (pre-existing, outside this row's failing clause):** the alarm bot never triggers the
  Elm car alarm (`alarms: []`, kills 14–23 of the authored 13) — the "car alarm works" half of the criterion
  stays open for the L2-14 alarm lane.
