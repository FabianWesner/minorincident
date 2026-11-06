# sweep-c6 — L7–L10 acceptance follow-up

Base `0991b9d`; work list is **sweep-c5**, per the user correction. L7-09 belongs to fix70-s and was skipped. No push/deploy. The only game change is `src/sim/ai/MegaPursuit.ts`.

## Scoped results

**Eight of ten rows have current decisions: six PASS, two measured FAIL. Two rows remain unchecked. The goal is not complete.**

| Row | Current decision | Evidence / remaining work |
|---|---|---|
| L7-01 | NOT CHECKED: timing | Actual carried campaign at both tiers: launcher3m from exit, moving auto-pickup tick14 without E/mouse, first physical rocket tick22.20paired frames inspected, raw digests verified/deleted. Only ≤50ms pickup/first-shot gate remains; brief prohibits perf timing, clarification and quiet window requested. `L7-01/`; `3e54c5e`, `645c32e`. |
| L7-06 | PASS, qualified | Both physical Harbor/alley and Lakeshore routes at both tiers; screenshot-only wrong-turn recovery reaches corridor.106qualification+54exploration frames inspected. Current Rapier perimeter:129walk/95drive probes per tier,0escapes.23semantic controls reject. Screenshot reviewer had prior map knowledge, so no blinded first-exposure claim. `L7-06/`; `e6f4b4f`. |
| L7-11 | PASS, qualified | Physical progressed L5/L6 campaign,540consecutive departure ticks/9s, same1000HP bus travels118.5m with original1/4humans aboard.48frames inspected;20semantic controls reject. Native cinematic overrides requested zoom and sometimes crops bus. `L7-11/`; `eb38285`. |
| L7-12 | PASS quantitative; P taste |28same-tick player-ID/projected2m-ring cells, both tiers/zooms: rocket/horde/city-fire motion, minimum contrast3.8787:1.84images inspected;27faults reject. No PO approval for destruction/Alpha-human taste claimed. `L7-12/`; `02abad3`. |
| L8-11 | P: Opus verdict pending | Fresh physical sanctuary tour and naturally converted original elephant mixed with runners/Alphas.56frames inspected at both tiers/zooms. Dark sparse elephant ground and HP-bar overlap noted. Required Opus “is it stunning?”≥7 verdict requested, not invented. `L8-11/`; `2b292be`. |
| L10-03 | Measured FAIL retained | Current same-tick census has no required joint count/species witness for low industrial, low campus, high industrial or high destroyed corridor. Spawn experiments regressed low completion and were reverted; no safe single game fix established. `../sweep-c5/L10-03/simultaneous-census.json`; `dae0fe5`. |
| L10-08 | PASS, qualified | Five roadregions physically sampled, both tiers/zooms; roadbase1.3/finale1.0, actual productionView maxcombined2.0.82frames inspected, including native same-attack groundslam0/6/12 strip;27semantic faults reject. Sparse hard verge seams/body overlap documented. `L10-08/`; `d668fc3`. |
| L10-11 | PASS, game fixed | Hidden final approach6× speed replaced with1.15×low/1.35×high. Current240s holds: arena arrival150.45s/132.45s, capped95/190peaks,100%bounded reachability, attacks, persistent same Mega ID and no scheduled relocation. `../fix51-r10c/l10-hold-proof.json`; `8ebb570`, `cd87b95`, follow-up immutable-evidence commits. |
| L10-12 | Measured visual FAIL | Current native conventional90%floor and direct rocket9/10 thresholds PASS. Physical fights kill same Mega119/122; natural slam/charge begin within12m.196images inspected/hash verified/deleted. Settled body marked drawn death-back/phase1, but no complete creature silhouette reads after physical approach to1.8m; black blast marks/cropping/remnant dominate. Render-layout/surface/severance cause unisolated, no safe single fix established. ≤200ms timing and grab/boundary matrix still unchecked; no full-clause PASS claimed. `L10-12/`; `b4f80af`. |
| L10-14 | PASS objective; P ending taste |150s actual physical epilogue, god off before release,10m/s front, all actual touched runner/dog/Alpha deaths same tick, healthy/player/corgi100HP unchanged. Independent current eight-species fixture covers zoo mortality. Last36s camera pullback, visible mist/title/readable mid-roll credits/menu, no skip.68qualification+66exploration images inspected;27semantic faults reject. One-second render-clock sampling, no live FPS/performance claim. `L10-14/`; `28293f6`. |

A measured FAIL records the observed defect; it does not imply every other clause passed. L10-03 and L10-12 remain game findings. L10-11 is the repaired prior FAIL.

## Blockers and P questions

- **L7-01:** confirm the narrow required frame gate is authorized despite the brief’s “no perf timing,” and provide a quiet window. L10-12’s ≤200ms gate has the same restriction. No timing run was started.
- **L8-11:** required Opus verdict from `test-results/sweep-c6/L8-11/opus-low.jpg` and `opus-high.jpg`: “is it stunning?”≥7. My noted concerns are the nearly black sparse elephant enclosure and heavy battle HP-bar overlap.
- **L7-12 P:** `test-results/sweep-c6/L7-12/po-{low,high}.jpg`: does this read as the worst destruction so far, and do enlarged Alphas still read as human?
- **L10-14 P:** derived `test-results/sweep-c6/L10-14/{low,high}-fresh-*.jpg`: does sparse playable mist and the wide ending feel satisfying? Objective ending sequence passed; no taste approval claimed.

Every produced raw capture was inspected, its SHA recorded and verified, then deleted. Derived review sheets remain ignored in test-results. Exact producers and physical input/observation receipts are committed per row.

## Final validation

Final L7–L10 both-tier/both-policy native/fixture/checkpoint refresh completed. L7/L10 reused matching current native receipts after the full game-change reruns; L8/L9 reran native routes. All fixture/checkpoint receipts report zero errors and matching controls. Acceptance exits1 because measured failures and incomplete browser qualifications remain.

| Level | Current PASS | Current FAIL | NOT CHECKED |
|---|---:|---:|---:|
| L7 |6|1|5|
| L8 |1|0|10|
| L9 |1|0|8|
| L10 |7|2|6|

These are full-group **current** statuses, not the ten-row scope count. The L10-only game change changes the global source hash; prior browser evidence for other rows therefore becomes stale. It was not relabeled current. L7 old/new native states and observations match at both policies/tiers, retained as a diagnostic in L7-11, not a browser requalification. L7’s FAIL is the untouched L7-09 lane finding.

`final-acceptance-summary.json` records exact final report digests/statuses. `final-validation.json` and `validation/` retain commands, exit codes, complete logs and log digests. All lane-owned browser/native/check processes have exited.

- `npx tsc --noEmit` — PASS.
- `npm run lint` — PASS.
- `npm test` — FAIL,105/107. Baseline `Save.ts` fflate import violates the architecture checker; L4 contact test also hit30s timeout. Save/checker/L4 test bytes are unchanged from base; no definitive timeout cause claimed. Earlier default run106/107 failed only architecture. See `final-unit-diagnostic.json`.
- `npm run qa:threat` — final attempt FAIL: zero flags throughL7, processingL8 when597s reservation/600s budget stopped it (601.1s wallclock). No flags or budget changes passed. Earlier same-game-source attempt passed474.9s; this final attempt is not called PASS.

**BLOCKED:** the goal remains incomplete pending the timing exception/quiet window and required Opus verdict above. The recorded L10-03/L10-12 game findings remain FAIL. No criteria/specs, test limits or checkers were weakened.
