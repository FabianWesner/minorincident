# final-b — frozen-head L4–L6 acceptance review

Frozen source: `4e570db8499bd1d76dcc17f9d13d1949d5cf2096`. Game source remains unchanged. The native receipts were generated on that source at both tiers. Historical reviews have their original provenance; an older review is not refreshed merely by inserting the current source digest.

This report is in progress (42/46 rows have current measured reviews). Table verdicts refer to the explicit reviews; the tracker separately retains any missing machine coverage, including rows with no implemented full-row machine binding. A FRESH review is not a claim that automatedComplete is true.

 Each OPEN row still needs current evidence for at least one objective clause. It has no final verdict yet. The former blanket digest refresh and superseded historical failures have been removed.

| Row | Verdict | Numbers | Evidence | P-note |
|---|---|---|---|---|
| L4-01 | PASS | 5 vehicles; 30.483 s; control restored at stop tick; full bus hull inside perimeter. | [review](../../qa/reviews/L4-01.json) · [native report](../fix51-verify/L4.json) | — |
| L4-02 | PASS | 32/64 civilians; minimum centre separation0.714/0.703m; zero pre-pickup combat/infected/decals. | [review](../../qa/reviews/L4-02.json) · [proof](L4-02-proof.json) | — |
| L4-03 | PASS | Pickup, klaxon, first turn and18 admissions share tick2197/2231. Game audio running/unlocked/unmuted. | [review](../../qa/reviews/L4-03.json) · [proof](L4-03-proof.json) | — |
| L4-04 | PASS | 10/20 soldiers; 32/64 civilians; armed share 50%/45.3125%; all living/reserved caps pass. | [review](../../qa/reviews/L4-04.json) · [native report](../fix51-verify/L4.json) | — |
| L4-05 | PASS | 67/40 actual cohorts, each2–5;162/110 births outside65 building envelopes;13/7 actual ground wall-slot crossings. | [review](../../qa/reviews/L4-05.json) · [proof](L4-05-proof.json) | — |
| L4-06 | PASS | First breach 52.717 s; 67/65 living; sustained plaza minima 52/54 (low/high). | [review](../../qa/reviews/L4-06.json) · [native report](../fix51-verify/L4.json) | — |
| L4-07 | FAIL | High every-body legal-path share96.43%/97.01%.515/516 independently disconnected at10129/10729; same-grid349 positive. Repro: high complete seed1 tick10129. | [review](../../qa/reviews/L4-07.json) · [proof](L4-07-proof.json) | — |
| L4-08 | PASS | 6/8 actual Alphas,6/8 distinct anchors/ticks; all offscreen,≥30.57m;4/3 distinct Alphas damage line. | [review](../../qa/reviews/L4-08.json) · [proof](L4-08-proof.json) | — |
| L4-09 | PASS | Line 1 52.317/60.333 s; nests 124 s; armour 170/170.6 s; camera skip/timing fixtures pass. | [review](../../qa/reviews/L4-09.json) · [native report](../fix51-verify/L4.json) | — |
| L4-10 | PASS | 2 HMGs; tank+22s,8.0167–11.7333s cadence; clearance≥15.1449m;0 concrete/wire intersections. Decorative sign contacts disclosed. | [review](../../qa/reviews/L4-10.json) · [proof](L4-10-proof.json) | — |
| L4-11 | OPEN | Current whole-row measurement pending; historical observations are not a frozen-head verdict. | [review](../../qa/reviews/L4-11.json) · [native report](../fix51-verify/L4.json) | — |
| L4-12 | PASS | Minimum4 visible model looks across10679/10715 nearest20 living-infected ticks; current physical frames reviewed. | [review](../../qa/reviews/L4-12.json) · [native report](../fix51-verify/L4.json) | — |
| L4-13 | FAIL | Low ticks36109–36649:0 admissions; high17245–17785:1 admission in9s, below3. No death/respawn/checkpoint in either interval. Repro: native complete collapse census. | [review](../../qa/reviews/L4-13.json) · [native report](../fix51-verify/L4.json) | — |
| L4-14 | PASS | Cellar entry4 live fires,3 burning wrecks,10 windows; actual scorch21/20. | [review](../../qa/reviews/L4-14.json) · [proof](L4-14-proof.json) | — |
| L4-15 | PASS | 60/60 actual walls block courier capsule at each tier; follow/cinematic pitch36–41.85°. Four hide frames reviewed at both zooms; continuous ground. | [review](../../qa/reviews/L4-15.json) · [proof](L4-15-proof.json) | — |
| L4-16 | PASS | Only courier+corgi enter; brace60ticks; battle audio6.7–6.883s, gap≤.984s,≤750Hz; same L5 cellar. | [review](../../qa/reviews/L4-16.json) · [proof](L4-16-proof.json) | — |
| L4-17 | FAIL | Ground-relative frozen vertex tops2.141m low/1.919m high; independent mortal low1.704m versus≈1m. Repro: renderer complete cellar-entry vertex census. | [review](../../qa/reviews/L4-17.json) · [proof](L4-17-proof.json) | — |
| L4-18 | P | Authored safe scene80 both tiers; physical war low8489/high5930; heroine identifiable. Living global76/72 versus corpses100/58 near those times. | [review](../../qa/reviews/L4-18.json) · [native report](../fix51-verify/L4.json) | PO: do the retained exact frames in [proof](L4-war-review.json) read as huge mixed war? |
| L5-01 | PASS | Shotgun starts 2.962 m away; pickup without E; regular 1 shell/0.1 s; Alpha 2 shells/0.6 s. | [review](../../qa/reviews/L5-01.json) · [native report](../fix51-verify/L5.json) | — |
| L5-02 | PASS | Current whole-row measurement pending; historical observations are not a frozen-head verdict. | [review](../../qa/reviews/L5-02.json) · [proof](L5-02-proof.json) | — |
| L5-03 | PASS | Actual initial100/150 living IDs; accepted groups≤2; all8 row bands/11 columns populated. | [review](../../qa/reviews/L5-03.json) · [native report](../fix51-verify/L5.json) | — |
| L5-04 | PASS | 2 initial Alphas in every native cell; both have proven accessible paths. | [review](../../qa/reviews/L5-04.json) · [native report](../fix51-verify/L5.json) | — |
| L5-05 | PASS | Both-tier reachability/encounter/pressure checks pass; low competent 4.377 player windups/min. | [review](../../qa/reviews/L5-05.json) · [native report](../fix51-verify/L5.json) | PO: does rescue still feel too easy? Numeric pressure is measured; taste is pending. |
| L5-06 | FAIL | Mia actual voice ended32.336s; ♪ still visible33.157333s (+0.821333s). Repro: physical L5 tour approaches Mia; compare actual ended listener and minimap DOM. | [review](../../qa/reviews/L5-06.json) · [proof](L5-06-proof.json) | — |
| L5-07 | OPEN | Current campaign-qualified muted screen-only trial foundMia1/5, followed pharmacy caption; continued actual save preserved. Incomplete trial is not a FAIL. | [trial review](supplemental-capture-review.json) | Caption cue interpretation pending. |
| L5-08 | FAIL | Low straight-walk in-band shares 92.12%/89.22%/85.26%, below 95%. Repro: run native complete L5 and inspect calm straight-walk formation ledger. | [review](../../qa/reviews/L5-08.json) · [native report](../fix51-verify/L5.json) | — |
| L5-09 | OPEN | Current whole-row measurement pending; historical observations are not a frozen-head verdict. | [native report](../fix51-verify/L5.json) | — |
| L5-10 | PASS | 4 production gun types held idle/walking;8 street weapons stay put20s. Exact mortal routes:9 initial weapon births,0 later;0 street-weapon fetches. | [review](../../qa/reviews/L5-10.json) · [proof](L5-10-proof.json) | — |
| L5-11 | OPEN | Current whole-row measurement pending; historical observations are not a frozen-head verdict. | [review](../../qa/reviews/L5-11.json) · [native report](../fix51-verify/L5.json) | — |
| L5-12 | P | 24 inside;20/21 heads in viewport at peak. All5 followers+corgi inside at shutter185/230; pair separation≥.7459/.7476m. | [review](../../qa/reviews/L5-12.json) · [proof](L5-12-proof.json) | PO: natural ending composition on exact14-frame sheet in proof. |
| L5-13 | PASS | Zero-survivor controlled routes complete at both tiers and report rescued=0. | [review](../../qa/reviews/L5-13.json) · [native report](../fix51-verify/L5.json) | — |
| L5-14 | P | 4 exact camera pairs×2 tiers; matching positions/targets. Actual sun multiplier0.5 at metro/end,50% fall. | [review](../../qa/reviews/L5-14.json) · [proof](L5-14-proof.json) | PO: do the16 exact matched frames read as same place, fallen? |
| L6-01 | PASS | Actual carried29 IDs, fullHP;11 posture samples/5s. Stored seated rifle stowed in actual renderer; empty hands. | [review](../../qa/reviews/L6-01.json) · [proof](L6-01-proof.json) | — |
| L6-02 | PASS | Approach pickup139; unchanged uncollected after120ticks. Beam/movement dot−.9713/−.9957 under actual opposed pointer input;0 new weapons. | [review](../../qa/reviews/L6-02.json) · [proof](L6-02-proof.json) | — |
| L6-03 | PASS | Breach 1 at 33.2 s; 8 admitted bodies reach shelter floor; bang timing passes both tiers. | [review](../../qa/reviews/L6-03.json) · [native report](../fix51-verify/L6.json) | — |
| L6-04 | PASS | Breach2 +21.016667s;10 actual arrivals/2 accesses;56 main lights off,46 red emergency on in same tick; abandon with≥3 infected. | [review](../../qa/reviews/L6-04.json) · [proof](L6-04-proof.json) | — |
| L6-05 | PASS | Both-tier complete/stationary reachability and player windup clauses pass. | [review](../../qa/reviews/L6-05.json) · [native report](../fix51-verify/L6.json) | — |
| L6-06 | PASS | 6 actual side-entry pairs. Independent passive controls: all24 actors across6doors×2tiers reach track within143ticks. | [review](../../qa/reviews/L6-06.json) · [proof](L6-06-proof.json) | — |
| L6-07 | PASS | Both-tier retreat pressure and >=30 HP loss pass; concurrent peaks below 30/60 caps. | [review](../../qa/reviews/L6-07.json) · [native report](../fix51-verify/L6.json) | — |
| L6-08 | PASS | 29×2 original followers2.19952–2.2m/s, including4 injured/tier; all58 visible pips54pixels each. | [review](../../qa/reviews/L6-08.json) · [proof](L6-08-proof.json) | — |
| L6-09 | PASS | 3 gates×2 tiers:2.2m wide; movement/sight blocked;9.816667s vs5 runners; refusal≤2m. E and one click each close in60ticks. | [review](../../qa/reviews/L6-09.json) · [proof](L6-09-proof.json) | — |
| L6-10 | PASS | Every active retreat/exit marker tick matches fixed gate/platform; all 3 gates ×4 courier poses pass. | [review](../../qa/reviews/L6-10.json) · [native report](../fix51-verify/L6.json) | — |
| L6-11 | PASS | Both tiers: complete20/29=68.97%; evade1/29=3.45%. Complete hashes match current controls; all rosters balance. | [review](../../qa/reviews/L6-11.json) · [native report](../fix51-verify/L6.json) | — |
| L6-12 | PASS | Actual reached save + physical exit: open/closed gate, night caption; result20+9=29. Closed capsule blocks at4.62m. | [review](../../qa/reviews/L6-12.json) · [proof](L6-12-proof.json) | — |
| L6-13 | PASS | Both mortal fists-only routes complete in236.6167s,3 retries each; only fists/kick offered and fists used. [Proof](L6-13-proof.json). | [review](../../qa/reviews/L6-13.json) · [proof](L6-13-proof.json) | — |
| L6-14 | FAIL | Forehead luminance.246630 > eye.244870/.234644; native-repeat body pixels0 changed. Repro: emergency tunnel actor62 face pixel772,384. | [review](../../qa/reviews/L6-14.json) · [proof](L6-14-proof.json) | — |

The required native acceptance commands ran earlier for L4, L5, and L6 with `--tier both --skip-browser`; final exact reruns completed for all three levels (exit1: measured failures/incomplete coverage). [Command status](final-command-status.json) records their exact commands and exit codes. Referenced earlier current native receipts are preserved byte-for-byte in [archive manifest](native-archive-manifest.json). Further row probes are underway. Table figures summarize the underlying reviews; complete values and SHA-256 evidence links are in each current review. No push, merge or deployment.

QA tooling correction: [report display proof](review-display-proof.json) demonstrates that `report.ts` suppressed provenance metadata for reviewed numeric PASS rows. The one-line metadata fix leaves all46 statuses, completeness flags and machine check arrays unchanged; it does not loosen acceptance. Game source is unchanged. Typecheck and lint passed after that tooling fix.

## Time-box handoff

The3-hour brief limit is reached with42/46 current measured reviews (36 objective PASS,6 FAIL; P decisions remain explicit in the table). Four rows stay OPEN: L4-11 long-range physical recoil/bar retake; L5-07 muted caption-only discovery≥4/5; L5-09 actual evade-only endpoint; L5-11 corrected standard-camera bus/fog photo. An extension is requested; no missing objective evidence is labelled PASS or P.

Owned queued visual workers were stopped at the time box. Resume drivers: `test-results/final-b/riot-long-final.ts` (4401) and `bus-final.ts` (4400). Muted actual reached save: `docs/reports/final-b/muted-low-qualified2-last-progress.json.gz`; use `muted-screen-qualified.ts` with a unique SCREEN_OUT and zoom0.5 for a wider visible route. No actor/anchor coordinates may inform that route. L5-09 evidence and the null-result caveat are in [unqualified benchmark](L5-09-unqualified.json). Current exact short-range riot frames/values and rejected off-canvas long setup are in [partial riot review](L4-11-unqualified.json).

The final required native commands completed; a supplementary receipt-reuse index refresh completed (all exit1). L5-02 was written after its level refresh began, so its generated tracker metadata still needs a refresh on resume; the independent production audit verifies all42 current review files. Independent production review validation checks each current content digest and present evidence SHA in [audit](current-review-audit.json). Game-source diff against frozen head is empty. Raw cleanup currently records311 captures/93.8MiB, plus subsequent row-specific cleanup. Remaining full-resolution matched-camera and short-duel frames are retained only for the explicit PO questions.
