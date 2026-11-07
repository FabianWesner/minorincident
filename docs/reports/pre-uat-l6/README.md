# pre-uat-l6 — PO pre-UAT pass

**Status: in progress; no UAT GO yet.** Source checkout started at `f4bba5cf` (lane worktree `lane/pre-uat-l6`). The first normal-clock mortal WebGL2 route is complete; the remaining save/gear/backend matrix and presentation review are continuing. One shared dialogue layout defect is fixed and visually verified.

## Findings so far

| Severity | Finding | Evidence / cause | Fix and before/after |
|---|---|---|---|
| P2, fixed | An offscreen shelter patient's dialogue was hidden behind the health panel at close zoom. | `Hud.updateStory` clamped the speaker anchor rather than the whole bubble; the bubble also shrank and rewrapped near a screen edge. Personally opened all three [before captures](../../../test-results/pre-uat-l6/dialogue-before3/receipt.json), zoom 0.5/1/1.5: the close frame loses most of the patient's sentence behind the portrait and HP bar. | Reuse the existing prompt placement solver, measure a stable bubble width, and avoid fixed HUD panels. All three [after captures](../../../test-results/pre-uat-l6/dialogue-after/receipt.json) are personally opened: the close bubble sits below the companion card; at 1/1.5 the full sentence is readable at bottom right. Each measured bubble has zero overlap with fixed HUD panels. Shared L1/L2/L6 presentation fix; no level tuning changed. |
| P2, fixed | A shelter breach warning can disappear under dense weapon audio. | The real physical WebGPU route recorded eight `l6.bang` events but no admitted door voice for the second shelter breach. The warning inherited prop priority40, below weapon100. This stepped route reveals a risk; it is not a subjective listening verdict. | Level-scoped mapper priority110. Audio-only replay of that actual event through the production mapper/limiter with all available voices occupied by weapon-priority100 rejects it before and admits it after at both low/high. [Before](evidence/audio-priority-before.json), [after](evidence/audio-priority-after.json). No voice-limit or mix gain change. |
| P3, taste | L6 survivor faces could read more clearly in the shelter and tunnel. | The 2026-11-07 `rr-b` review describes subdued low-tier crowd detail in darkness and asks for more readable survivor faces. Its L6 review is a narrow eight-view sample, not a fresh PO matrix; it did not establish a missing or clipped body. | None yet. Recheck at low/high, both backends, zoom 1/1.5 and close views before deciding whether a level-scoped lighting/readability change is warranted. |
| P3, resolved evidence gap | L6-05 and L6-07 had current native clauses passing but displayed `FAIL` because the numeric reviews were tied to an older source digest. | Initial run: L6-05 `100%` reachable, complete `11.42` player/group windups per minute, stationary first attacks `2.08s` / `9.08s`; L6-07 complete routes had `19` player/group windups per minute, `160` HP damage, and peak `19` infected at both tiers. All 18 L6-05 and 8 L6-07 current clauses passed. | Updated [L6-05 review](../../qa/reviews/L6-05.json) and [L6-07 review](../../qa/reviews/L6-07.json) against current-source low/high receipts. Re-ran with `--reuse`: both rows now `PASS`, review `FRESH`, receipt hashes match. This closes only the measured numeric criteria; the L6-14 visual review remains stale. |

## Fresh checks

- `npm run qa:accept -- --level L6 --skip-browser`: completed; 0 fresh failing clauses, 9 incomplete L6 rows. Fresh native passes include L6-03 breach timing/admissions, L6-05 combat/reachability, L6-07 retreat pressure/damage/cap, L6-10 fixed marker trajectory, and L6-13 fists-only completion. A second `--reuse` run confirms L6-05/07 are `PASS` with fresh reviews; the command exits 1 because those 9 L6 rows remain incomplete.
- `npm run build:qa`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `node tools/qa/test-budget.mjs --name pre-uat-l6-unit --max-seconds 150 -- node node_modules/vitest/vitest.mjs run --project default --configLoader runner --maxWorkers=4`: passed, 107 tests across 27 files in 38.5 seconds.
- `npm run qa:threat -- --levels L6 --maxWorkers=2`: completed in 12.2 seconds. L6 skilled route completed; passive route reached its 110-second cap during retreat. L6-05 recorded 100% reachability and 139.89 passive attacks/min; L6-06 recorded 100% reachable in the observed retreat window; both breach cohorts were admitted (8 and 10) with first attacks at 2.08s and 9.08s. There were no L6 threat flags. Exit 1 is the harness's `PARTIAL_LEVEL_SELECTION` flag for selecting L6 alone, not a level defect.
- Normal-clock mortal WebGL2 low run from fresh browser storage: completed without skips in 420 wall seconds / 394.67 sim seconds, eight deaths, 2/29 out, 27 lost, zero console/page errors. The sole driver issue is its false `stuck-navigating` warning during the authored calm. Its 2,736 attacks all use the MG despite carrying a shotgun and axe, so the poor rescue/death result is not promoted to a competent-balance verdict. Reviewed result card shows the correct 2/29/27 counts. Evidence: `test-results/playtest/pre-uat-l6-fresh-low-gl/summary.json` and `log-campaign.jsonl`.

## Still open

- Real-input L6 on fresh and progressed saves; gear tiers 0–4; low/high; zoom 1/1.5; WebGL2 and WebGPU spot checks. Keep browser automation headless and use `--use-angle=metal` for local WebGL2 where the runner permits it.
- Open and describe every relied-on capture. Check shelter faces, headlamp pickup/prompt and opposing movement/aim, wave entries and combat readability, injured follower pace, fixed gate markers and prompts, Northgate/end shot, sound cues, and visible hitches.
- Fresh visual review for L6-14 and the full physical route/capture matrix remain open.
- Continue investigating the mortal driver's weapon-selection limitation without changing accepted level tuning.

## Verdict

**Is it stunning?** Not decided. The existing review calls the warm shelter versus dark emergency tunnel a strong contrast, while asking for more readable faces; that is provisional, not this pass's signoff.

**Boring / harmless / babysitting?** Not decided from current real-input evidence. The new native route measurements show combat pressure and completion, but they do not substitute for the requested playthrough.

**UAT recommendation:** Hold. This README is a progress report, not the final PO acceptance report.
