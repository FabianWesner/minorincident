# rr-a — fresh acceptance row reviews

Reviewed on frozen main `50be7c824705fc3cdbb3a7ab7dd78f72c7bf2001` (2026-11-07). No game source changed. Fresh native acceptance was run with `npm run qa:accept -- --level L1|L2|L3|L4|L5 --tier both --skip-browser`; each level ran low/high complete and stationary policies, controlled fixtures, and checkpoints. Fixture and checkpoint harnesses reported zero errors and checkpoint controls were identical. The commands also refreshed `docs/reports/fix51-verify`; those runner outputs were restored after extracting the per-row snapshots linked below.

The rr-a2 follow-up measured the browser clauses on the same frozen source through the shared headless browser pool, with at most two concurrent contexts and reservations capped at ten minutes. Fixed Luna screen trials used the corrected control legend. Physical L4 routes used real WASD/mouse/E input. Controlled fixtures and production resume replays are identified in each review; they are not passed off as ordinary playthroughs. Every cited capture was opened at its original 1280×720 resolution and described in the review.

P is reserved for the PO's judgment of shooting feedback strength in L4-11. Its requested objective measurements are complete. The acceptance tracker maps this pending PO decision to NOT CHECKED; no skipped measurement is represented by P. The table below and linked JSON decisions contain the current results. **Final result: 8 PASS, 8 FAIL, 1 P (PO taste only); all17 requested rows have fresh reviews.**

| Row | Verdict | Fresh measurements / finding | Review and evidence | Repro for FAIL |
|---|---|---|---|---|
| L1-08 | PASS | Reachability100/95% low/high; stationary100%;32.406/30.996 attacks/min. | [review](../../qa/reviews/L1-08.json) | — |
| L1-16 | FAIL | Fixed Luna low: still Annex95m after60.5667 active seconds;17 action captures. | [review](../../qa/reviews/L1-16.json) | Depot pickup → repeated house/fence/bike loop; fixed Luna controls. |
| L2-11 | PASS | Escape populations29–30 low /34–36 high;4–6 groups of≥4;0–20% chasing. | [review](../../qa/reviews/L2-11.json) | — |
| L3-02 | PASS | Attack5s after pickup; waves15/30/50 low,30/60/100 high; station-door share20%. | [review](../../qa/reviews/L3-02.json) | — |
| L3-06 | FAIL | Calm high physical follow: officer32 at2.471m (<3m);all4 remain alive; no teleport observed. | [review](../../qa/reviews/L3-06.json) | Fallback seed1; isolate calm,wait4s,hold D; sample at0.4s. |
| L3-07 | PASS | Both-tier segment1 mortal fixtures: officers take hits; player damage<100HP. | [review](../../qa/reviews/L3-07.json) | — |
| L3-08 | PASS | S1→S3 live medians19→34 low,72→77 high; caps100/200. Written clause passes. | [review](../../qa/reviews/L3-08.json) | — |
| L3-10 | PASS | After20s idle,30/60 actual admissions in10s; sources15–35m behind; stop on advance. | [review](../../qa/reviews/L3-10.json) | — |
| L3-11 | PASS | Attack-rate votes3/3 low,2/3 high;33 medkits;≤2.32% below20%HP. | [review](../../qa/reviews/L3-11.json) | — |
| L3-12 | FAIL | Fixed Luna low:29.033s at first bus/car blockage;HUD312–314m;25 action captures. | [review](../../qa/reviews/L3-12.json) | Fallback seed1 → bus/car obstruction; screenshot-only route unreadable. |
| L3-13 | FAIL | Both tiers show broad dark ramp-joint wedge near x177;15 opened views plus actual snapshots. | [review](../../qa/reviews/L3-13.json) | Ordinary route to x177,z≈0;inspect close/wide deck joint. |
| L3-14 | FAIL | Nine soldiers,two vehicles,two buses;5s rest clear;visible pullback ring;exact15s wait. Buses lack visible seated civilians. | [review](../../qa/reviews/L3-14.json) | Inspect both bus windows/occupants at checkpoint;E21 §5.10/AC17. |
| L4-07 | FAIL | Low complete reachability85.484% (<90%);high98.214%;stationary100% both. | [review](../../qa/reviews/L4-07.json) | Native L4 low complete reachability check. |
| L4-11 | P | 16m bar visible both tiers;MG front2.183s/flank1.783s;physical pointblank1.75s,player78HP. Visible recoil lasts16.7ms. | [review](../../qa/reviews/L4-11.json) | PO taste only: is the measured chip/recoil strong enough? |
| L4-13 | PASS | Physical gap2400ticks/40s; low final native16 contacts, high final physical≥64. Actual9s admissions minima4/3 low/high. | [review](../../qa/reviews/L4-13.json) | — |
| L4-17 | FAIL | Physical low/high: settled corpse vertices reach1.391/1.308m above source feet;16 opened close/wide views. | [review](../../qa/reviews/L4-17.json) | Low crawler219 tick18630;high fire-Alpha276 tick16207. |
| L5-06 | FAIL | Five-place cue matrix both tiers; ♪ ends with call. Active Mia call still audible at31m on high (RMS0.00329). | [review](../../qa/reviews/L5-06.json) | Start at24.9m,move to31m during call;confirm listener and post-panner PCM. |

## Evidence and limits

Each review records the exact acceptance clause, current source digest, reviewed commit, evidence paths and SHA-256 hashes. Images and raw browser runs remain under `test-results/rr-a2/`; committed native extracts are under `evidence/`. The decision JSON carries the detailed observations, fixture scope and reproduction steps.

- **Screen trials:** L1 low remained around Annex95–107m for60.5667 active seconds. L3 low stalled at the bus/car obstruction for29.0333 active seconds; no numeric60s failure is claimed for L3. Both trials protected the courier, used no model tools or route hints, and ended at deliberate action-count bounds.
- **Physical runs:** L4 low/high completed with12/10 deaths. Their route and corpse observations do not establish a death-budget pass. Handover resets the harness simulation clock; its reported zero duration is not a real level duration.
- **Ramp and compound:** replay inputs are genuine mortal native complete saves, with0 deaths in each tier. Production `loadResume` shifts the tick origin; original crossing ticks are retained in the manifests. No actor placement or health edits were used for these replays.
- **Controlled probes:** high squad following removes infected to isolate calm following; the16m bar fixture isolates and positions a riot; the cue matrix changes courier position and call readiness. Each scope is disclosed. Audio observations use the production voice graph, with a separate downstream host silence sink.
- **Excluded attempts:** the first Luna preview-port collision, the physical ramp controller stall and a replay observer error after level handover are harness failures. They are not game counterexamples. Low31m audio had a stale listener position, so only the confirmed high listener sample establishes that audio failure.
- **Criterion interpretation:** L3-08 passes the written S1→S3 median increase. Its native evaluator additionally demands strict S1<S2<S3, which the written clause does not require. No specification or evaluator was changed.

No game source or protected reference files were changed. Temporary observer tools were archived under `test-results/rr-a2/observers/` and removed from the working source tree. Row decisions were committed individually, followed by this report summary.

Closeout validation: all17 decisions passed schema, evidence-hash and current-source freshness checks; no active browser lease or probe remained. Work completed within the follow-up two-hour limit.
