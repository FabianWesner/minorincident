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

## Current machine defects with repros

These are fresh FAILs from the scoped L10 acceptance run (they are listed separately from the six NOT CHECKED target rows). A FAIL is retained as measured evidence; it does not close the other clauses of that row.

| Row | Before → after numbers | Cause / repro | Evidence |
|---|---|---|---|
| L10-02 | Remaining Mega HP `3000` → `1780.0997` before cure installation (loss `1219.9003`, both tiers; target zero loss). | Fresh controlled L10 fixture: apply direct-rocket immunity probe before installing cure; Mega loses HP. | [low fixture](../fix51-verify/receipts/L10-low-fixtures.json), [high fixture](../fix51-verify/receipts/L10-high-fixtures.json) |
| L10-03 | Route `1259.3833 s` low / `1414.3667 s` high → target `600–1200 s`. | Execute the canonical complete route; both tiers exceed the upper bound by `59.38 s` / `214.37 s`. The simultaneous census proof also records `fresh:false` for both tiers. | [low complete](../fix51-verify/receipts/L10-low-complete.json), [high complete](../fix51-verify/receipts/L10-high-complete.json), [census](../fix72-c/L10-03/simultaneous-census.json) |
| L10-04 | Concurrent ordinary-route peak `44/57` low, `68/68` high → target `≤15`. | Run complete and stationary acceptance policies at each tier; peaks are beyond the bound in all four cases. | [L10 receipts](../fix51-verify/receipts/) |
| L10-05 | Initial racks include `weapon.kick`; expected fists-only. | Fresh unarmed start at `(547,0)`, machete at `(552,0.5)`. Walk east along crash-site exit for ≤1 s: pickup occurs at tick 52 / 1.4344 m, health stays 100, no respawn, but initial racks violate fists-only. | [low fixture](../fix51-verify/receipts/L10-low-fixtures.json), [high fixture](../fix51-verify/receipts/L10-high-fixtures.json) |
| L10-06 | Dog run-speed ratio `1.65×` → target `1.1×`, both tiers. | Controlled native dog-speed fixture against player run speed. | [low fixture](../fix51-verify/receipts/L10-low-fixtures.json), [high fixture](../fix51-verify/receipts/L10-high-fixtures.json) |
| L10-07 | Maximum Mega step `203.92–372.85 m/tick` across tier/policy runs → target `≤1 m/tick`. | Run the full native route and stationary hold while recording consecutive Mega positions; observed maximum step exceeds the limit in all four runs. | [L10 native receipts](../fix51-verify/receipts/) |
| L10-15 | `cure-disperse-ready` expected boss alive at `1116 HP` low / `1072.8151 HP` high; death-control result is dead at `0 HP` in both. | Replay the checkpoint death-control fixture and compare restored boss snapshot after the ordinary courier death; location and racks match, boss state does not. Five named L10 checkpoint fixtures also throw `Cannot read properties of undefined (reading 'id')` per tier. | [low checkpoints](../fix51-verify/receipts/L10-low-checkpoints.json), [high checkpoints](../fix51-verify/receipts/L10-high-checkpoints.json) |

## Open work and constraints

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
