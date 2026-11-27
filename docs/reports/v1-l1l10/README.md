# v1-l1l10 — current-main acceptance sweep

Head: `2f7ee5f06bf5562305e17b787d3573d2ef9f4efd` (`main`). No game source was changed. The lane began clean.

## Scoped native refresh

Executed the required commands after the initial all-level diagnostic refresh:

- `npm run qa:accept -- --level L1 --skip-browser --reuse` — exit 1; 0 fresh failing rows, 12 incomplete rows.
- `npm run qa:accept -- --level L10 --skip-browser --reuse` — exit 1; 7 fresh failing rows, 6 incomplete rows. Both low/high checkpoint replays completed; each reported five fixture errors for the `cure-disperse-ready` boss snapshot.

The commands emitted refreshed L1/L10 aggregate outputs and used receipt inputs under [receipts](../fix51-verify/receipts/). The skip-browser command rewrites the aggregate without preserving browser-policy records, so I restored the committed aggregate JSON after recording the current run results here. The existing aggregate JSON therefore remains the committed baseline; it is not presented as the output of this run. No browser captures were produced. All 18 in-scope review files already present in `docs/qa/reviews/` are STALE according to `reviewFreshness` on this head. Prior verdicts below are therefore context only, not fresh decisions.

| Row | Before (saved review) | After on current head | Numbers / evidence | P-note |
|---|---|---|---|---|
| L1-02 | PASS, stale | NOT CHECKED | Current acceptance: native clauses pass; 12 L1 rows remain incomplete. [L1 report](../fix51-verify/L1.json) | No new visual review. |
| L1-03 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | No current handover frames inspected. |
| L1-04 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | No current handover frames inspected. |
| L1-05 | PASS, stale | NOT CHECKED | Current native acceptance has six passing checks; row remains incomplete pending full current browser/input clauses. [L1 report](../fix51-verify/L1.json) | No current blast frames inspected. |
| L1-06 | PASS, stale | NOT CHECKED | Current native acceptance has ten passing checks; row remains incomplete pending full current browser clauses. [L1 report](../fix51-verify/L1.json) | No current emergence frames inspected. |
| L1-10 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | No current encounter frames inspected. |
| L1-11 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | No current physical-input review. |
| L1-12 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | No current traversal frames inspected. |
| L1-14 | PASS, stale | NOT CHECKED | Two native checks PASS and two remain NOT CHECKED; [L1 report](../fix51-verify/L1.json) | No current garage frames inspected. |
| L1-15 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | No current extraction frames inspected. |
| L1-16 | FAIL, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | Required fresh screenshot-only route review not run. |
| L1-17 | PASS, stale | NOT CHECKED | Current acceptance: 12 L1 rows incomplete. [L1 report](../fix51-verify/L1.json) | Requires PO taste review of current morning/outbreak frames. |
| L10-01 | PASS, stale | NOT CHECKED | Current native report contains 12 PASS checks; real-input census remains unqualified. [L10 report](../fix51-verify/L10.json) | No current capture sheets inspected. |
| L10-08 | PASS, stale | NOT CHECKED | Current report has no complete row decision. [L10 report](../fix51-verify/L10.json) | No current road/crowd/telegraph frames inspected. |
| L10-09 | PASS, stale | NOT CHECKED | Two native checks PASS and two remain NOT CHECKED. [L10 report](../fix51-verify/L10.json) | No current research/canister frames inspected. |
| L10-11 | PASS, stale | NOT CHECKED | Current native report has 16 PASS and 2 NOT CHECKED clauses. [L10 report](../fix51-verify/L10.json) | Skilled-route and arrival criteria remain open. |
| L10-12 | PASS, stale | NOT CHECKED | Current native report has four PASS checks; no current physical fight/death review. [L10 report](../fix51-verify/L10.json) | No current boss/corpse frames inspected. |
| L10-14 | PASS, stale | NOT CHECKED | Current native report has six PASS and four NOT CHECKED clauses. [L10 report](../fix51-verify/L10.json) | No current cure mist/ending frames inspected. |

## Initial machine flags (qualification updated)

The initial evaluator reported the following flags. Subsequent review confirmed L10-06 and L10-15 as defects; the other flags below are diagnostic leads, not established acceptance failures. In particular, the immunity criterion prohibits killing rather than any HP loss; duration is approximate; the crowd bound says normally rather than peak; the current starting-weapon criterion permits kick; and the Mega position jump needs attribution. The fixture receipts cited here predate the latest head; see the current row entries below for fresh evidence.

| Row | Before → after numbers | Cause / repro | Evidence |
|---|---|---|---|
| L10-02 | Remaining Mega HP `3000` → `1780.0997` before cure installation (loss `1219.9003`, both tiers; target zero loss). | Fresh controlled L10 fixture: apply direct-rocket immunity probe before installing cure; Mega loses HP. | [low fixture](../fix51-verify/receipts/L10-low-fixtures.json), [high fixture](../fix51-verify/receipts/L10-high-fixtures.json) |
| L10-03 | Route `1259.3833 s` low / `1414.3667 s` high → target `600–1200 s`. | Execute the canonical complete route; both tiers exceed the upper bound by `59.38 s` / `214.37 s`. The simultaneous census proof also records `fresh:false` for both tiers. | [low complete](../fix51-verify/receipts/L10-low-complete.json), [high complete](../fix51-verify/receipts/L10-high-complete.json), [census](../fix72-c/L10-03/simultaneous-census.json) |
| L10-04 | Concurrent ordinary-route peak `44/57` low, `68/68` high → target `≤15`. | Run complete and stationary acceptance policies at each tier; peaks are beyond the bound in all four cases. | [L10 receipts](../fix51-verify/receipts/) |
| L10-05 | Initial racks include `weapon.kick`; expected fists-only. | Fresh unarmed start at `(547,0)`, machete at `(552,0.5)`. Walk east along crash-site exit for ≤1 s: pickup occurs at tick 52 / 1.4344 m, health stays 100, no respawn, but initial racks violate fists-only. | [low fixture](../fix51-verify/receipts/L10-low-fixtures.json), [high fixture](../fix51-verify/receipts/L10-high-fixtures.json) |
| L10-06 | Dog run-speed ratio `1.65×` → target `1.1×`, both tiers. | Controlled native dog-speed fixture against player run speed. | [low fixture](../fix51-verify/receipts/L10-low-fixtures.json), [high fixture](../fix51-verify/receipts/L10-high-fixtures.json) |
| L10-07 | Maximum Mega step `203.92–372.85 m/tick` across tier/policy runs → target `≤1 m/tick`. | Run the full native route and stationary hold while recording consecutive Mega positions; observed maximum step exceeds the limit in all four runs. | [L10 native receipts](../fix51-verify/receipts/) |
| L10-15 | `cure-disperse-ready` expected boss alive at `1116 HP` low / `1072.8151 HP` high; death-control result is dead at `0 HP` in both. | Replay the checkpoint death-control fixture and compare restored boss snapshot after the ordinary courier death; location and racks match, boss state does not. Five named L10 checkpoint fixtures also throw `Cannot read properties of undefined (reading 'id')` per tier. | [low checkpoints](../fix51-verify/receipts/L10-low-checkpoints.json), [high checkpoints](../fix51-verify/receipts/L10-high-checkpoints.json) |

## Initial open work and constraints (historical)

The fresh headless real-input route, high then low, zoom 1.5 and default, and manual inspection of every cited capture have not been performed. Consequently no PASS/FAIL/P JSON was written for the 18 target rows; writing one would overstate evidence. Current source has extensive changes since the frozen source named in the saved reviews, so merely rebasing their digest would be invalid.

The required per-row commits are currently unavailable: this worktree's Git index is at `/Users/wesner/Workspace/minorincident/.git/worktrees/v1-l1l10/index`, outside the writable root. `git restore` failed with `Unable to create ... index.lock: Operation not permitted`. An attempted restore of the initial all-level diagnostic output used read-only `git show` plus writes inside this worktree; the final diff must still be checked before any commit is attempted again.

The only remaining worktree change from this turn is this lane report. L1/L10 aggregate JSON was restored after the scoped commands because `--skip-browser` removes the stored browser-policy entries. No game code, specs, browser captures, or review JSON were changed. No browser reservation was started.

## L1 mortal real-input runs (continuation)

On the same head, the pooled headless playtest ran HIGH first, then LOW on port 5401, each with `--levels L1 --zoom 1.5 --capture-zooms 1,1.5 --level-minutes 8 --no-skip`. Both finished without skips: high 156 s with 1 death, low 148 s with 0 deaths. The driver reported zero issues and one assist in each run. Logs and captures are retained under `test-results/v1-l1l10/l1-high/` and `l1-low/`; captures have not yet been inspected, so they support no visual verdict. These runs do not establish the full clauses of any acceptance row. L10 mortal run remains open.

## L10 high mortal run

On the same source, `E2E_PORT=5402 npx tsx tools/playtest/play.ts --levels L10 --quality high --zoom 1.5 --capture-zooms 1,1.5 --level-minutes 18 --session-seconds 480 --no-skip --out test-results/v1-l1l10/l10-high` completed three bounded segments and exited 1: no level completion, no skips, 29 deaths (7 + 6 + 16), zero assists. The 18-minute deadline is checked between segments, so the third completed at 24 minutes of sampled time. The driver reported two P2 navigation stalls at farm objective distances 111 m and 183 m. These are observations of the driver, not yet diagnosed game defects. Logs, summaries and captures remain in the named ignored output directory. The low run and visual inspection remain open.

Four L1 frames were opened: high/low `campaign-L1-t12.jpg` show warm pavement, courier, corgi and a seated civilian; high `campaign-L1-t5458.jpg` and low `campaign-L1-t5503.jpg` show the Annex under a large smoke plume obscuring much of its entrance. These frames alone do not establish the crowd or complete visual-tone criterion. Other captures remain unreviewed.

## L10 low mortal run

The matching low-tier command (`E2E_PORT=5402 npx tsx tools/playtest/play.ts --levels L10 --quality low --zoom 1.5 --capture-zooms 1,1.5 --level-minutes 18 --session-seconds 480 --no-skip --out test-results/v1-l1l10/l10-low`) exited 1 without completion after four segments, 1490 sampled seconds total. Segment deaths were 3 + 8 + 0 + 4 = 15; no skips or assists. The driver recorded four P2 navigation warnings and two P0 stops after 90.3 s without visible progress, near `(1809.3,-2.3)` and `(1764.1,-16.1)`. As with high, this is a failed driver run, not yet proof that a player cannot proceed. The logs and captures remain in the named ignored directory; captures have not been reviewed. Both-tier mortal runs are incomplete and fairness remains unqualified.

## L10-06 review

Fresh **FAIL** replaces the stale PASS: the high and low controlled dog fixtures each report speed ratio `1.65` versus the `1.1` requirement. Repro: `npm run qa:accept -- --level L10 --skip-browser --reuse`, then inspect `native dog speed ratio` in each fixture receipt. The fixture divides spawned dog `infected.speed` by `survivor.speed`; the source of the changed ratio is not isolated. The other clauses and current dog/corgi appearance remain unreviewed. [Review JSON](../../qa/reviews/L10-06.json) records both receipt hashes and the observation.

## L10-15 review

Fresh **FAIL**: the checkpoint death fixture saves a living Mega at 1116 HP low / 1072.8151 HP high, kills it, then applies ordinary lethal player damage; respawn reports the boss dead at 0 HP in both tiers. Repro: `npm run qa:accept -- --level L10 --skip-browser --reuse`; inspect the `cure-disperse-ready` boss snapshot comparisons in both checkpoint receipts. The source of the restore mismatch is unisolated. Five other named checkpoint fixtures error per tier, so complete regional coverage remains open. [Review JSON](../../qa/reviews/L10-15.json) records the hashes and observation.

## L1-07 review

Fresh **PASS**: remote idle spread starts at 5, reaches 30/30 low and 44/50 high at +120/+240 s; all additional turns follow bites and the observer takes no damage or action. The controlled probe uses an ordinary opening and one remote observer relocation. [Review JSON](../../qa/reviews/L1-07.json) records both fixture hashes. No game source changed; no regression cause or open clause was found for this row.

## L10-10 review

Fresh **PASS**: both complete native routes record 3600 eligible increments, zero invalid increments; high includes 120 dead ticks. Both tiers' controlled boundary probe pauses at 40.01 m with instruction, holds while dead and resumes inside. The minigun yields 20 rounds/s and 0.125 heat/s, locks at 1.0, remains locked at 0.4 and unlocks at 0.396667. [Review JSON](../../qa/reviews/L10-10.json) records four current receipt hashes. No game change or open numeric clause for this row.

## Main advanced and L1-01 refresh

Main advanced from `2f7ee5f0` to `540ab32a`; the lane was rebased. Earlier source-dependent reviews and playtests must be requalified on the new head. Fresh native L1 complete routes both finish, with null initial deadline and no offered starting weapons: **L1-01 PASS**. [Review](../../qa/reviews/L1-01.json), [high receipt](L1-01/high-complete.json), [low receipt](L1-01/low-complete.json). The scoped native run exited 1 for 12 incomplete L1 rows. No game source changed; no cause or open numeric clause for L1-01.

## L1-07 current-main refresh

On `540ab32a`, the new both-tier fixture retains the preceding result: 5 initially, low 30/30 and high 44/50 at +120/+240 s, bite provenance for all additional turns, and zero observer damage/deaths/knockdowns/kills. Fresh **PASS**: [review](../../qa/reviews/L1-07.json), [high fixture](L1-07/high-fixtures.json), [low fixture](L1-07/low-fixtures.json). The controlled probe relocates the observer after the ordinary opening. No game changes; no open numeric clause for this row. Scoped command exit 1 reflects 12 incomplete L1 rows.

## L1-09 current-main review

**PASS** on both qualities: 300 production runner spawns per fixture, 100 per speed tier, all within 4.4 m/s and their tier's 1.04× upper bound; observed range 4.40697–5.82185 m/s. 274/300 (91.33%) exceed 4.5 m/s versus ≥85%. This is a deterministic equal-tier sample. [Review](../../qa/reviews/L1-09.json) hashes the retained L1-07 fixture receipts. No game changes; no open measured clause for this row.

## L10 current-main refresh

On `540ab32a`, the scoped native run finished with seven machine FAIL rows and six incomplete rows; five checkpoint fixture errors per tier remain. **L10-06 FAIL** persists: dog speed ratio 1.65 vs 1.1 at both tiers. Repro: run `npm run qa:accept -- --level L10 --skip-browser --reuse`, inspect native dog speed ratio in the fixture receipts. Cause not isolated; appearance and other clauses remain open. [Review](../../qa/reviews/L10-06.json), [high fixture](L10-native/L10-high-fixtures.json), [low fixture](L10-native/L10-low-fixtures.json).

## L10-15 on current main

Fresh **FAIL**: on `a72c2770`, the checkpoint fixture again saved a living boss at 1116 HP low / 1072.8151 high and observed dead/0 HP on respawn after the fixture killed it and caused ordinary player death. Five other checkpoint fixtures error per tier. Repro: `npm run qa:accept -- --level L10 --skip-browser --reuse`, inspect cure-disperse-ready boss snapshot. The cause is unisolated. Main advanced to `92c233e2` during the run; its intervening commits change reports only, with no `src`, `public`, `layouts` or acceptance-tool changes. [Review](../../qa/reviews/L10-15.json), [high](L10-native/L10-high-checkpoints.json), [low](L10-native/L10-low-checkpoints.json).

## L10-06 refresh at 92c233e2

Both current controlled fixtures reproduce **FAIL**: dog run-speed ratio 1.65 vs 1.1. Attack observations pass: 0.65 s telegraph, 1.08 m reach, 10 HP bite, 2 s cooldown. Repro: run L10 acceptance fixtures and inspect native dog speed ratio; appearance remains unreviewed and cause unisolated. [Review](../../qa/reviews/L10-06.json), [high fixture](L10-native/current-high-fixtures.json), [low fixture](L10-native/current-low-fixtures.json). The previously copied route receipts are from the preceding source and do not establish current L10-10 charge behavior.

## L1-07 refresh at 92c233e2

Current controlled fixtures: **PASS**, 5 initial; low 30/30 and high 44/50 at +120/+240 s, all additional turns from bites and observer undisturbed. Ordinary opening then remote observer relocation. [Review](../../qa/reviews/L1-07.json), [high](L1-07/current-high-fixtures.json), [low](L1-07/current-low-fixtures.json). No game change; no open numeric clause.

## L1-09 refresh at 92c233e2

**PASS** in both quality fixtures: 300 deterministic equal-tier spawns, all within tier bounds, range 4.40697–5.82185 m/s; 274/300 (91.33%) faster than 4.5 m/s. [Review](../../qa/reviews/L1-09.json) hashes the current L1-07 fixture receipts. No game change; no open sampled numeric clause.

## L1-01 refresh at 92c233e2

**PASS**: both current native complete policies finish. Initial deadline is null, racks absent and owned actions contain only fists/kick (unarmed). [Review](../../qa/reviews/L1-01.json), [high](L1-01/current-high-complete.json), [low](L1-01/current-low-complete.json). This is a native run, not current physical-input evidence. No game change or open numeric clause.

## L1-08 at 92c233e2

**PASS** in current native policies: both stationary tiers first player windup at 2.3167 s and 330.18 windups/min over 290.57 s; bounded-path minimum 100% across 147 samples each. Complete low/high rates 27.93/19.20 per minute and minimum 100% across 23 samples each. The rate counts player-target windup events, not damage; reachability samples actors within 30 m with path ≤2.5× direct. [Review](../../qa/reviews/L1-08.json), [high stationary](L1-08/high-stationary.json), [low stationary](L1-08/low-stationary.json), complete receipts under L1-01. No game change; no open native clause.

## L10-10 refresh at 92c233e2

**PASS**: both current native routes record 3600 eligible increments and zero invalid increments, high with 120 dead ticks. Both controlled fixtures pause outside 40 m with instruction, hold while dead and resume inside; minigun 20 rounds/s, 0.125 heat/s, lock at 1.0 and unlock below 0.4 (0.396667). [Review](../../qa/reviews/L10-10.json), [high route](L10-native/current-high-complete.json), [low route](L10-native/current-low-complete.json), current fixture receipts in the L10-06 entry. No game change; no open numeric clause.

The same current routes released with prerequisites at 1.989 m high / 1.916 m low and the fixture rejects each missing prerequisite; L10-13 remains open for its requested physical-input release.

## L10-13 physical release at 92c233e2

**PASS**: both controlled prerequisite matrices reject missing charge, cure installation, boss death, console proximity or fresh input, and accept the complete control. Physical WASD/E from native progressed saves released at 1.565 m high / 1.385 m low, with god disabled before E. The approach was protected; the native prefix is not a physical whole-campaign run. Four cited zoom 1.5 frames were opened: prompt visible before E, green glow after; low console area is obscured by a large corpse/effect. [Review](../../qa/reviews/L10-13.json), [high physical](L10-13/high-physical.json.gz), [low physical](L10-13/low-physical.json.gz). The first low attempt correctly refused release because the inherited prefix captured boss death before charging (0 ticks, release pending); [diagnostic receipt](L10-13/low-first-attempt.json.gz). The low prefix producer was corrected to capture the actual active release step; no game changes. No open prerequisite clause.

## L10-14 partial evidence and observer limitation

The current physical release ledgers in L10-13 reach title at front elapsed 3900 ticks (65 s), credits at 4200 ticks and thanks at 9600 ticks (90 s of credits) in both tiers; this is one-second render sampling, not a visual continuity or frame-rate proof. Both `epilogue-5-z1.5.jpg` captures were opened: high (`ae3c959e811d657c8e55a9a573b4b5ead7387359a0b10873c869fe4fdfc1909f`) shows a bright green plume above the console, small figures scattered around it and a fire at left; low (`10feafd2a78610604526fe4acb649c1da4f935d14709fd2ff3e568d25027c750`) shows a similar plume and scattered figures, with a dark large body near the centre. Paths are in the respective physical receipts. These two frames do not prove same-ID recovery or the full cinematic.

The inherited physical producer calls a touch `dead` when either HP is zero **or the ID appears in `affectedIds`**. Current `CureFront.apply` places cured survivors in that list; therefore the `dead` field in these receipts is a misleading legacy label and does not establish that the subject died. The separate current controlled fixture records eight species as healthy after reaching the front, but full current browser identity, corpse retention, skip behavior, credits readability, and PO taste remain unqualified. L10-14 stays NOT CHECKED. No checker or game code changed.

## Current-main L1 mortal routes

On `92c233e2`, high then low real-input runs completed without skips: high 142 s, 0 deaths; low 168 s, 1 death. Each reports one assist. Low recorded a 4150 ms frame at tick 250; this was not a quiet performance run and is diagnostic, not a performance verdict. Outputs are under `test-results/v1-l1l10/l1-current-{high,low}/`. Opened high `captures/campaign-L1-t5436.jpg` (SHA-256 `67ed3b7d27e2b80afcdf9a306fff3228b81c8f2d680a97a3bb1104511a8fd388`): courier near bike racks, a figure outside the smoke-obscured Annex. Opened low `captures/campaign-L1-t5433.jpg` (SHA-256 `56bf8b4df0ed52235dd8ec5bc2c1a3db1ac7265ae8066ae0b8d22cdf68604304`): courier and corgi crossing the street, Annex mostly outside the frame and red minimap contacts. These periodic stills do not establish five exits or their order; L1-06 visual burst remains open. No game changes.

## L1-06 at 92c233e2

**PASS**: current native fixtures measure five actual door crossings, technician first (154 high / 147 low). Three measured departure headings are 26.82/109.25/171.43° high and 26.49/105.54/170.48° low; minimum pairwise separation 62.18° / 64.95°. All 14 captured frames opened: the first light-coated figure emerges from the Annex, then four others pass the door and disperse across the forecourt. [Review](../../qa/reviews/L1-06.json), [browser ledger](L1-06/browser-receipt.json.gz), current native fixture receipts in L1-07. The browser burst used native bot input and a fixed inspection camera with no protection or actor relocation; separate current mortal physical runs completed both qualities but did not capture the whole sequence. No game changes; no open measured clause.

## L10-01 opening sample at 92c233e2

High then low physical-input opening samples ran 60 wall seconds (54/53 simulation seconds), ending at the sample cap without skips: high 1 death, low 0; no driver issues. The separate current native complete routes census all 3600 first-minute ticks: regular peak 8 high / 7 low, dogs 0 and Alphas 0 in both. Physical output is under `test-results/v1-l1l10/l10-opening-{high,low}/`. Four frames opened: high `campaign-L10-t9.jpg` (`ba06a7188fd28aeb6696996069c2cdfe4d510f15c297dc5765338f847f2995e3`) and low `campaign-L10-t10.jpg` (`91fd0a3d4394d330cb4a5742a9f48136bb53f62d4ce25a785dfe80860b059797`) show courier/corgi on a dark grey diagonal surface, a partly cropped truck at top and dark angular shapes; neither establishes the full wreck/farm/livestock composition. High `campaign-L10-t2725.jpg` (`990664285f6d87b862332d937753624efbc5487b9ae033ebed28114d6e19fadb`) shows a red vehicle, pale and dark animal bodies, sparse dark ground and grey surfaces; low `campaign-L10-t2714.jpg` (`00e8aabd3df1c86ac3572b22ced3e4646ed1e54b4781476dca3e9f3049489f8b`) shows corn at upper right, fence and machinery at left, and a wide dark empty foreground. The physical samples fall short of 60 active seconds and these frames do not establish the complete visual clause, so L10-01 remains NOT CHECKED. Need full opening tour at default and 1.5 zoom, with the entire composition visible, and an active-time physical census. No game change.

## L10-01 review at 92c233e2

**P** for PO composition: native 3600-tick census regular peak 8 high / 7 low, zero dogs and Alphas both. Four physical samples at quality high/low and requested zoom 1/1.5 covered 83–84 simulation seconds in each first segment. Eight cited start/~45 s frames opened: initial views show courier/corgi on broad grey surface, cropped truck and dark angular shapes; later views show sparse dark ground, corn at edge or barriers. PO: do these exact frames communicate a wreck beside dry corn, broken farms and dead livestock? The driver logs do not supply a full per-tick physical census, and visual composition remains open. [Review](../../qa/reviews/L10-01.json) has exact frame paths/hashes and summaries. No game change.

## L1-17 at 92c233e2

**P**: PO to inspect 12 cited morning/start, Annex and outbreak frames at both qualities and requested zooms 1/1.5. Morning views show a seated civilian or a pedestrian with a dog on warm streets; outbreak views show several pursuers, red attack rings and minimap contacts, including a tight group at the fire station. Do these convey an inhabited suburb and too many infected to fight? Morning samples show few nearby figures; the older failed-driver crowd frame is not current evidence. Physical mortal routes completed: zoom1.5 high/low deaths 0/1; zoom1 high/low 2/1, one assist each. [Review](../../qa/reviews/L1-17.json) records exact inspected frames and hashes. No game change; PO taste remains open.

## L1-03 depot handover at 92c233e2

**PASS**: 321 sampled ticks each quality, same clerk ID 155 high / 148 low, 94 transfer ticks with zero hidden transfer ticks, parcel ownership transfers, clerk walks back inside to z −39.34 before removal, door latch closes. All 22 frames opened: clerk carries, offers and waves; later the open then closed shop door remains while courier holds the parcel. Return inside is partly occluded by wall. The native bot reached onset, then idle capture; separate current physical routes completed both tiers. Seven proof mutations reject after reordering the high-first receipt to low-first for the existing proof script's duplicate-tier control. [Review](../../qa/reviews/L1-03.json), [ledger](L1-03/browser-ledger.json.gz), [proof](L1-03/L1-03-story-proof.json). No game changes; no open measured clause.

## L1-04 Annex handover at 92c233e2

**P** for PO quality comparison: both tiers retain same technician ID (154 high / 147 low) across 707 ticks, 364 transfer ticks with zero hidden transfer ticks, parcel transfer and return inside to z −16.5; six broken-data controls reject. Twelve selected frames and the archived labelled PROD comparison were opened. Current coat, goggles, gloves and parcel are visible; parcel appears offset from the hand in the selected signing/carry view and the return is partly occluded. PO: do the exact cited frames meet PROD quality? [Review](../../qa/reviews/L1-04.json), [ledger](L1-04/browser-ledger.json.gz), [proof](L1-04/L1-04-story-proof.json). Native bot reaches onset, then idle sequence; separate physical L1 routes completed both tiers. No game changes.

## L1-02 at 92c233e2

**PASS**: untouched stationary 3600-tick native census: 58 high / 51 low civilians, zero living infected and combat events, maximum unfaced idle 133 ticks (2.2167 s) each. Four broken/boundary controls pass. The facing measure uses authored target ahead and resets after >0.1 m travel; hidden interiors excluded. Two cited current physical opening frames opened: courier, corgi and seated civilian on warm street. [Review](../../qa/reviews/L1-02.json), [summary](L1-02/L1-02-current-review.json), [ledger](L1-02/L1-02-current-ledger.json.gz). No game change; no open measured clause.

## L1-10 at 92c233e2

**PASS** in production-camera native complete-input trials: same-ID warning before first offscreen actor appearance 10/10 high and 9/10 low, against ≥80%; low seed10 had no qualifying warning, and low seed5 warning preceded appearance by only 2 ticks. Seven proof controls pass. The selection excludes visible-first actors and offscreen candidates that never appear; this is an event/camera sample, not audio audibility or physical input. [Review](../../qa/reviews/L1-10.json), [ledger](L1-10/native.json.gz), [proof](L1-10/measurement.json). No game change; no open measured event clause.

## L1-11 high partial input trial

Current high WebGL2 physical WASD/E after native parcel pickup: depot-wall dismount leaves player z −37.007 and bike z −37.007 on the same side of wall max z −38.5. Forward displacement peaked at 7.5 m/s for 28 consecutive ticks before encountering nearby geometry; steering headings changed 1.572→1.093 rad under W+A and 1.081→1.819 under W+D. Reverse displacement peaked at 1.8 m/s in this attempt; its relation to the current criterion remains open. The captured [ledger](L1-11/high-partial.json.gz) includes explicit coordinate assistance and no actor relocation/protection. Opened `03-wall-dismount.png` (SHA-256 `e9b36de4d483ac79fb4e0f235dd0da90c9f656a85d22166512a0023b1d095b00`): courier and bicycle outside depot wall. Opened `07-forward.png` (`a06cc1a3fcad718457ca5c2d5efc5df2375877b0e758d57b754d269035580079`): bicycle reaches a white fence/house frontage. This is partial: clear-road sustained speed, fence-side dismount and low tier remain open. No game source changed; L1-11 remains NOT CHECKED.

## L1-11 continuation

Low repeats the high depot-wall result: player and bicycle z −37.007 after physical E, wall max z −38.5; forward reaches 7.5 m/s for 28 consecutive ticks before frontage interference, and headings change 1.572→1.093 under W+A and 1.081→1.819 under W+D. [Low ledger](L1-11/low-partial.json.gz). The opened low wall frame `test-results/v1-l1l10/bike-low/captures/03-wall-dismount.png` (SHA-256 `66e85f89c9d620117c671b6d54c34bbdc3594fa574e87fdbcfe55fd7b694602f`) shows bicycle/courier outside depot.

A second high route attempted a clearer lane but hit a hydrant and then frontage; its longest forward streak was below the intended 60-tick qualification. [High second ledger](L1-11/high-r2.json.gz). Opened `02-road-approach.png` (`affaa796393da9bebf7b98d33c7050ef022368597f054b0cfa2e52444a44f7dc`) shows bike against hydrant; `13-lane-reposition.png` (`95cf62e537669038eba6b49102b049cd2b7c0c1b491451bf9a499db4257918e7`) shows bike at residential frontage. These are driver-route limitations, not diagnosed game defects. Sustained clear-lane speed and actual fence dismount remain open; L1-11 remains NOT CHECKED. No game change.

### Latest aggregate diagnostic

On main `92c233e2`, `npm run qa:accept -- --level L1 --skip-browser --reuse` exited 2 with 0 fresh machine-failing rows and 8 incomplete rows. The L10 command was stopped after low/complete finished and low/stationary began, because the sweep's three-hour time box had already been exceeded; it has no aggregate verdict. Both commands regenerated shared aggregate files, which were restored to their previous tracked contents so an incomplete `--skip-browser` run does not overwrite existing browser-policy data. L1-05's former quiet timing producer was not found among the preserved QA scripts; the ordinary accident script explicitly excludes frame performance. Its old timing measurements cannot establish performance on this head.

## L1-13 on main 233eab90

| Row | Before → after | Numbers (high / low) | Evidence | P-note |
|---|---|---|---|---|
| L1-13 | stale PASS → fresh PASS | Bat absent at start, first acquired at tick 5132, 0.992 m from the garage anchor (2 m radius); fists 7 hits, bat 2 hits against a 60 HP regular, both tiers. | [Review](../../qa/reviews/L1-13.json), [high fixture](L1-07/current-high-fixtures.json), [low fixture](L1-07/current-low-fixtures.json); L1 mission and district source establish the weapon objective and bat placement at the garage anchor. | — |

Native bot route and isolated combat fixture, with separate mortal real-input L1 runs documented above. The L8-only source changes between the receipt's `92c233e2` and current main `233eab90` do not alter L1. No game change; no remaining measured clause.

## L1-14 on main 233eab90

| Row | Before → after | Numbers (high / low) | Evidence | P-note |
|---|---|---|---|---|
| L1-14 | stale PASS → fresh PASS | 10 / 10 admitted; maximum first nonhidden distance from refuge door 0.9 / 0.9 m; at most 3 / 3 courier pursuers within 20 m; settled waiting minimum 17.467 / 17.454 m over 36,000 samples each. | [Review](../../qa/reviews/L1-14.json), [measurement](L1-14/measurement.json); raw ledger and 20 inspected captures are hashed in the review. | — |

The existing native bot reached pickup at tick 5132, then empty input and damage suppression permitted a 150-second mechanical observation. Waiting distances are measured after the initial approach, from +90 seconds onward, and to both player and garage. Browser inspection used a fixed close camera: the opened captures show figures on the porch and pavement, though several sampled moments miss the doorway crossing. The 0.9 m is the logical first nonhidden position, not a pixel-onset measurement. Existing mortal physical L1 routes are documented above. The native script wrote its full ledger but its optional comparison step exited 1 because the older baseline file is absent; the new ledger was independently summarized. No game change.

## L1-15 on main 233eab90

| Row | Before → after | Numbers (high / low) | Evidence | P-note |
|---|---|---|---|---|
| L1-15 | stale PASS → fresh FAIL | Three invitations at ticks 6408/6648/6888; ≥50 / 25 living infected before entry; 187 / 187 physical input ticks; gate state closes at tick 7107 with corgi 1.05 / 1.05 m inside. In 3 / 3 sampled post-entry frames per tier, the shutter is not visible. | [Review](../../qa/reviews/L1-15.json), [measurement and controls](L1-15/L1-15-measurement.json); 16 opened captures and full browser receipt are hashed in the review. | — |

**Defect and repro:** Play to the fire station at default follow zoom, wait near the bay, and enter with WASD. On entry and one second later, the gate state says closed, but the station facade is represented by large dark triangular cutaway surfaces and no closing shutter is visible. Reproduced on both qualities. The rendering/camera cause is not yet isolated; the appearance suggests a cutaway issue. Mechanics otherwise pass: repeated on-screen text, living moving infected, gate open before entry, and corgi inside at closure. Native bot input and damage protection were used to reach the approach; final entry used physical keyboard input with read-only trigger/camera guidance. The eight-second wait is protected, so this is not a mortality or voice-audibility claim. No game change.
