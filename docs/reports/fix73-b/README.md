# fix73-b — L4 crowd/admission/corpses and L5 high follower pace

Base: `5a7f84b`. Final game source: `166205b`; source hash `d97192f688d1e72561fb49f26eb4afff8d84d9f6cc4dabfe56bd373cd1bfb0b5`.

L4-12 is fixed and passes six full-war censuses (seeds 1–3, both tiers). The L5 high G-13 pace/wait scope passes the existing canonical evaluator. L4-13 and L4-17 remain measured FAILs; the compound L5-08 row also retains a low-tier formation failure. These outcomes use the brief's permitted measured-FAIL path and do not claim release acceptance.

## Game changes

`166205b` balances two existing firefighter body assets at admission: the original bulky infected firefighter and the slimmer registered firefighter NPC body with the infected material. Both keep the firefighter archetype, HP, speed, fire immunity, attacks and population slot. The L4 renderer registers both real assets. No asset files or dependencies were added.

The full-rate native census now has at least **4 looks on all 66,270 eligible war ticks** across seeds 1–3 and both tiers (seed 3 high has minimum 5). [Six-route census](L4-look-seeds.json). For seed 1, a before/after comparison deletes only cosmetic `infected.model` from cloned final states before applying the production state hash: low `17026cfd` and high `1995724f` are identical. Route results, wave events, admission ledgers, populations and every recorded nearest-20 actor ID/archetype/position are deeply identical. [Full equivalence proof](L4-look-equivalence.json) and compressed before/after observer receipts are retained.

`58a3280`, scoped to L4 by `cdcc781`, makes corpse placement search farther for a ground-level footprint before accepting a pile (`feet + .05`, previously `.45`), within the existing search budget. Other levels keep the previous threshold. This is an improvement attempt, not a closed L4-17 fix: actual frozen geometry still exceeds the target.

An earlier player-centered archetype-balancing trial was rejected and reverted after it still missed high-tier variety and caused a fresh L4-06 breach-count failure plus a stationary mission failure. That roster trial is absent from the final source. Counts, caps, stats, timers, criteria and checker thresholds were not lowered.

## Row outcomes

| Row | Outcome | Evidence and remaining work |
|---|---|---|
| L4-12 | PASS in row review | Six full-war every-tick nearest-20 censuses, all at least 4 looks, with seed-1 gameplay equivalence. Both actual firefighter body batches draw together in 130 low / 139 high renderer samples. All 16 frames were personally inspected; the slim yellow-coated red-helmet body is visibly distinct from the bulky pale-faced responder. |
| L4-13 | FAIL | First collapse windows meet low 2/2/2 and high 3/3/3. Later misses remain low 23/56 and high 5/9. Samples before the first miss already show 79/80 living low and 120/120 high. All quotas/admissions are unchanged by the appearance fix. Sustained admission needs capacity turnover and combat qualification within the existing caps. |
| L4-17 | FAIL | Shared-pool headless Metal WebGL2: 184 renderer samples per tier through the first 150.183 seconds of war. Frozen-vertex tops reach 1.699 m low and 1.505 m high; root lift peaks .49/.44 m. A ground-level Alpha pose itself reaches about 1.48 m. Spreading alone does not establish the approximately 1 m requirement. |
| G-13, L5 high scope | PASS | Production `followerPaceVerdict` with `stepsOnly:true`, `humansOnly:true`: every measured follower/phase passes the existing seed rule. Follower 28 search ratios are 1.0119 / .9873 / .8945 with 47/46/46 samples. Only one of three valid seeds is below .95; the rule flags at least two. Waiting upper bound is 0%. This is not an all-level global-row approval. |
| L5-08, whole row | FAIL | Canonical acceptance retains a low-tier calm straight-walk formation counterexample. High G-13 passing does not qualify every formation, rendered bar or absolute combat-speed clause. |

The generic `qa:accept` tracker still shows L4-12 as NOT CHECKED because the plain S row has no wired completion rule. The permitted exact-criterion review JSON records PASS with the full measured evidence; no reporter/checker gate was loosened.

[L4 native census/quota summary](L4-native-summary.json), [current L4 render measurements and capture observations](L4-17-render-review.json), [L5 high pace verdict](G13-high-summary.json). Hashed review decisions are in `docs/qa/reviews/L4-12.json`, `L4-13.json`, `L4-17.json`, and `G-13.json`.

The reviewed follow frames keep the courier visible. Later detail frames show dense body fields, raised limbs, and angular strips on surrounding figures without isolating a corpse-only cause. No continuous pixel-depth or universal limb-stretch PASS is claimed. The renderer samples are a 150-second war counterexample, not complete-route visual qualification. Every one of the 16 current captures was inspected; hashes and observations are retained, and the raw JPEGs were deleted.

## Validation

The final isolated `npx tsc --noEmit && npm run verify -- E22` passes: both TypeScript configurations, lint, and all 107 tests in 27 files. This includes the supplemental seed observer. Earlier sandbox cleanup and concurrent process-exit failures are superseded by this isolated green gate. [Check receipt](E22-checks.json).

Final-source `qa:accept` ran L4, L5 and L6 at both tiers, including complete/stationary native routes, fixtures, checkpoints and the physical browser stages. Each level command exits 1 because measured failures or incomplete clauses remain: L4 has 2 fresh FAIL / 12 incomplete rows, L5 1 / 9, and L6 0 / 10. The L4-12 reporting gap described above remains explicit.

All six G-25 browser cells PASS: completed ordinary WASD/mouse routes, no objective skips, no console/page errors. These are shared-pool headless Metal WebGL2 runs at zoom 1.5 with the standard immortal setting and no frame timing. They do not qualify every visual or survival criterion. The L5-low receipt retains a recovered 21-second navigation stall; both L6 receipts retain the shelter-introduction wait warning. L5 frames show survivor-loss/under-attack warnings. Both L6 result panels show 1 survivor out from 29, with 28 lost or turned.

All **46 browser-route captures**, plus the **16 mortal L4 row-specific captures**, were personally inspected, hashed and deleted. [Per-frame browser observations](browser-capture-reviews/) and the L4 render review retain what was seen. No raw JPEGs are committed.

Final-source `npm run qa:threat` ran alone, started at load 5.89 (< 6), and passes all 10 levels with **0 flags**. [Compressed full audit](threat-audit.json.gz) and [validation manifest](validation.json) retain the revision, source identity, receipt hashes and capture counts. The audited lane differs from the moving main branch; its production source is exactly `166205b`.

No L5 game change was needed to requalify the scoped high-tier pace result under the existing production evaluator. Acceptance failures and incomplete clauses remain visible; they are not waived by green engine gates. No performance timing, deploy or push is performed.

## Environment and follow-up

Initial sandbox restrictions blocked the shared browser pool and slim-worktree setup. After permissions changed, the prescribed slim command succeeded and the shared headless browser pool completed both tiers. The referenced `fix52-corpse` and `fix51-r9i` report directories are absent on this base; current review schemas and retained evidence were used.

Remaining game work is the sustained L4 admission plan, actual-geometry-aware corpse settling/pose review, and the separate L5 formation clauses. Broader speculative combat or rig changes are not claimed as fixes under this lane's brief.
