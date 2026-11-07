# rr-a — fresh acceptance row reviews

Reviewed on frozen main `50be7c824705fc3cdbb3a7ab7dd78f72c7bf2001` (2026-11-07). No game source changed. Fresh native acceptance was run with `npm run qa:accept -- --level L1|L2|L3|L4|L5 --tier both --skip-browser`; each level ran low/high complete and stationary policies, controlled fixtures, and checkpoints. Fixture and checkpoint harnesses reported zero errors and checkpoint controls were identical. The commands also refreshed `docs/reports/fix51-verify`; those runner outputs were restored after extracting the per-row snapshots linked below.

Unmeasured rows are NOT CHECKED and have no active review decision. P is reserved for PO taste decisions. Historical manual observations were not carried forward as current evidence. No fresh browser captures or original-resolution visual inspection were completed in this lane, so rows requiring those checks remain NOT CHECKED.

| Row | Verdict | Fresh measurements / finding | Review and evidence | Repro for FAIL |
|---|---|---|---|---|
| L1-08 | PASS | Reachability: low complete 100%, high complete 95%, stationary 100% both tiers. First stationary attack 2.317 s; complete attacks/min 32.406 low, 30.996 high. All current native clauses PASS. | [review](../../qa/reviews/L1-08.json) · [evidence](evidence/L1-08.json) | — |
| L1-16 | NOT CHECKED | Native acceptance does not measure depot→Annex→garage lost time. No fresh Luna route trial was run. | [evidence](evidence/L1-16.json) | — |
| L2-11 | PASS | Low escape-area population 29/30 and 30/30; groups ≥4: 5–6; chasing 20%/0%; scattered singles 5–6. High population 34/42 and 36/39; groups ≥4: 4; chasing 2.38%/0%; singles 6. All fresh checks PASS. | [review](../../qa/reviews/L2-11.json) · [evidence](evidence/L2-11.json) | — |
| L3-02 | PASS | Attack begins 5 s after pickup; latest attack 9.45 s. Waves low 15/30/50, high 30/60/100; station-door share 20%; visible in 2 s: 5/15 low and 9/30 high. | [review](../../qa/reviews/L3-02.json) · [evidence](evidence/L3-02.json) | — |
| L3-06 | NOT CHECKED | Initial squad 4; low follow samples 4.61–4.82 m; tracked losses have bite/kill causes. High-tier following distance and every-segment no-teleport continuity are not fully covered. | [evidence](evidence/L3-06.json) | — |
| L3-07 | PASS | Fresh low/high mortal segment-1 fixtures record officer hits with player damage below 100 HP. | [review](../../qa/reviews/L3-07.json) · [evidence](evidence/L3-07.json) | — |
| L3-08 | PASS | Median live within 30 m rises S1→S3: low19→34, high72→77. Prepopulation250/600/1030 is within ±20%; max concurrent100 low /200 high meets caps. The runner flags high only because it adds a strict S1<S2<S3 requirement absent from the written criterion. | [review](../../qa/reviews/L3-08.json) · [evidence](evidence/L3-08.json) | — |
| L3-10 | PASS | After 20 s idle, actual 10 s admissions: 30 low / 60 high, from off-screen 15–35 m behind. Admissions stop when the player advances. | [review](../../qa/reviews/L3-10.json) · [evidence](evidence/L3-10.json) | — |
| L3-11 | PASS | Competent attack-rate votes: low 3/3, high 2/3; 33 medkits total (9/15/9 by street); below-20%-HP share ≤2.32% low, 0% high. | [review](../../qa/reviews/L3-11.json) · [evidence](evidence/L3-11.json) | — |
| L3-12 | NOT CHECKED | Fixed `l3-zone` marker at (225,0), zero displacement over 7,995/3,125 low and 9,231/3,979 high complete/stationary samples. No fresh route-readability or HUD-distance screenshot. | [evidence](evidence/L3-12.json) | — |
| L3-13 | NOT CHECKED | No fresh browser inspection of ramp seams, stuck clumps, or bodies on walls. | [evidence](evidence/L3-13.json) | — |
| L3-14 | NOT CHECKED | Nine actual soldiers at army arrival in all four tier/policy runs. Vehicles, buses/civilians, five-second rest, ring visibility and 15 s evacuation wait were not freshly reviewed. | [evidence](evidence/L3-14.json) | — |
| L4-07 | FAIL | Low complete reachability 85.4839% vs ≥90%; high complete 98.2143%; both stationary tiers 100%. | [review](../../qa/reviews/L4-07.json) · [evidence](evidence/L4-07.json) | `npm run qa:accept -- --level L4 --tier both --skip-browser`; inspect low/complete “minimum bounded-path reachable share within30m”. |
| L4-11 | NOT CHECKED | Both tiers frontal MG: 225→0 HP in 2.183 s, 21 hits, positive damage; flank: 225→0 HP in 1.783 s, 17 hits. No fresh visual bar, physical duel, survival, or PO feel review. | [evidence](evidence/L4-11.json) | — |
| L4-13 | NOT CHECKED | Fresh native acceptance did not measure the physical 40 s escape gap, continuous pursuit, or route-contact count. | [evidence](evidence/L4-13.json) | — |
| L4-17 | NOT CHECKED | No fresh close/wide captures or physical route review for corpse-pile height, stretched limbs, or courier occlusion. | [evidence](evidence/L4-17.json) | — |
| L5-06 | NOT CHECKED | Native acceptance does not measure minimap, audio, caption, edge-direction or cue-radius presentation. No fresh visual/cue trial. | [evidence](evidence/L5-06.json) | — |

The reviews carry the exact acceptance clause text, current source digest, main commit, and evidence SHA-256. The checked-in acceptance tracker reflects these verdicts: PASS/FAIL where complete native evidence settled the clause, and NOT CHECKED for unmeasured rows until their uncovered checks are re-reviewed.
