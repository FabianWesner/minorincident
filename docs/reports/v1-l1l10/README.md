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
