# fix71-b — L4/L6 acceptance repairs

Historical fix71-b result below. The subsequent [fix71-b2 follow-up](../fix71-b2/README.md) repairs the L6-05 regression and refreshes L6 protection evidence after merging main. Its report records the new source and gate result.

Timeboxed result: three scoped proofs pass; three L4 rows remain measured FAIL. A new L6-05 regression also remains open. **NO-GO for blanket acceptance.** No push or deployment. Final runtime source hash: `33b75918004edef0694d1fd7173b665ebadfe310d3ee58d4204d4211f7b3be25` (last game change `b12a49c`). Criteria, counts, attack clocks, caps and performance targets were not relaxed.

## Requested rows

| Row | Final evidence | Remaining work |
| --- | --- | --- |
| L6-06 | PASS in dedicated low/high proof: six alternating entries admit exactly two each; all12 identities reach tracks and are downed.381/381 near-player path samples pass per tier; independent canonical world hashes match. [Trajectories](L6-06-release-trajectories.json.gz). | Dedicated review is recorded; stock qa:accept does not register these custom clauses and still says NOT CHECKED. |
| L6-11 | PASS for E24-AC09 named mortal native bots, both tiers: complete26/29 (89.66%),0 deaths; evade-only1/29 (3.45%),9 deaths. [Native results](L6-11-release-native.json). | Stock qa:accept coverage remains NOT CHECKED. This does not establish general physical-controller rescue quality; see qualification limits below. |
| L4-13 | Requested first9s window repaired: low2/2/2 at tick12889, high3/3/3 at12925. **Whole row FAIL:** later cap saturation misses23/56 low windows and5/9 high windows. [Native census](L4-release-native.json). | Sustained admission planning under unchanged80/120 live caps. First later low miss28009:1/1/1; high15085:edge6 zero. |
| L4-12 | **FAIL:** every-tick nearest20 war census has minimum3 looks in both tiers (10,679 low /10,715 high checks). [Full trace](L4-release-native.json.gz). | Local balancing retained, original six-role roster restored. Added brute failed existing contact fixture; armored variants worsened mortal escape and were rejected. Improve visual diversity without stronger combat mix. |
| L4-16 | PASS in dedicated live decoded matrix: low zoom0.5/1.5 gives6.917/6.850s; high6.867/6.917s of <=750Hz battle audio under ordinary-voice stress. Both tiers bar in60ticks with E false; only courier+corgi at bar; actual L5 starts1m from cellar entry. [Summary](L4-16-release-summary.json). | Stock qa:accept measures timing but leaves other custom audio/handover clauses NOT CHECKED. Review and immutable PCM evidence are recorded. |
| L4-17 | Remeasurement complete, **FAIL:** actual settled frozen vertex tops1.746m low /1.920m high; root lift0.66m both. [Measurement](L4-17-release-measurement.json). |184 rendered samples and8 reviewed frames per tier during first150s of war; not a whole-route maximum. P: seated riot shields and angular folded gray Alpha death poses. No universal limb-stretch or continuous pixel-order PASS. |

## Retained changes and commits

- `fe30ed0`: L6 side-entry quota; `454ef66`: final track-trajectory evidence.
- `d5147ae`: elevated-floor MG origin/cover-height correction and follower protection; `3e5e612`: final named-bot qualification.
- `49c6ef7`, `ebc1ebf`: collapse demand conservation, rotating edge admission, authored alternative mouths and future-cohort capacity reservation; `b755388`: final quota evidence.
- `de46a29`, `b12a49c`: local archetype/clothing balancing, then restore original six roles after rejected combat regressions; `86bab6b`: final census FAIL.
- `3883c41`: filtered battle voice priority110 above ordinary MG100/explosions95; caps16/32 and7s interval unchanged; `c53bd4f`: decoded four-cell qualification.
- `060891c`: final actual frozen-geometry remeasurement.
- `42f5938`: explicitly record new L6-05 regression and rejected opening candidate.

MG projectiles now originate at source.y+0.45 and retain height in cover queries, so rifle-clear shots on raised subway floors no longer collide with low cover due to an absolute birth height. Throwables are unchanged. The existing combat unit case was extended for elevated low/full cover.

The complete L6 bot uses rifle visibility and immediate group-bite priority. Unarmed L6 followers retain formation pace rather than generic fast panic flight. The head waits for covering fire when the courier falls behind an exposed column. Population, weapons and enemy stats remain unchanged.

Collapse quotas now count actual admissions and preserve pending demand at full caps. The last defensive line reserves the first cohorts. This fixes the requested initial window but does not overcome later saturation. Rejected brute/armored trials are retained as labelled historical evidence, not final-source qualification.

## Regressions and qualification limits

**New L6-05 FAIL:** final complete bots have0 player-targeted windups during the21.017s opening, both tiers, versus baseline about5/min. Ten group-targeted windups do not satisfy the unchanged player-target criterion. [Regression](L6-05-release-regression.json). An in-memory opening-anchor candidate still produced0 player windups while saving26/29; it was not applied. Next: restore opening courier pressure while preserving follower protection/rescue.

**L5-08 FAIL is preexisting:** calm straight-walk follower formation tolerance remains outside its criterion. L4 mortality also limits playability claims: canonical complete low takes719.45s with24 deaths; high301.95s with6 deaths. Independent instrumentation preserves both canonical hashes (`c3184e26` / `0bef7d9f`).

Dedicated L6 native complete saves26/29; earlier mortal physical attempts saved only low2/high1, each with one death ([physical scope](L6-11-physical.json)). Final physical browser route checks use GOD1 and save low1/high3; these establish route/console coverage only. They cannot qualify mortal rescue success. L6 native complete canonical hashes are `4a1802d3` / `10d0a475`.

## Final-source validation

- `npx tsc --noEmit`: PASS; `npm run lint`: PASS.
- `npm test`: PASS107/107 tests in27 files,43.2s, within unchanged240s budget (`test-results/fix71-b/unit-release.log`). Earlier loaded-host timeout/reservation failures remain diagnostic records.
- `npm run build:qa`: PASS,23.39s.
- Fresh L4/L5/L6 low/high native acceptance: all fixtures and checkpoint cases complete,0 fixture errors; independent controls identical. L4 fixtures10/checkpoints6 per tier; L5 same; L6 fixtures8/checkpoints7. Final per-level JSON/receipts are under [fix51-verify](../fix51-verify/L4.json). Reports exit1 because measured FAILs remain, plus incomplete clauses. Dedicated PASS proofs above do not silently override stock automation gaps.
- Final headless shared-pool physical WASD/mouse WebGL2 zoom1.5 routes:6/6 finish,0 console/page errors, GOD1 explicitly enabled. No objective skips. Temporary navigation diagnostics recovered; a L4 high frozen-enemy diagnostic is retained as a P observation, not a lasting-immobility finding.
- Whole-game threat gate: BLOCKED by lack of an isolated host-load<6 window; see gate section below. No zero-flag release sign-off.

Global acceptance indexes were restored because this run covers only L4–L6; regenerating the whole-game index requires all levels. Per-level reports retain this run's actual receipts.

## Threat gate

An isolated full attempt on rejected candidate `a49ce66` started at load5.71, with all four owned native runs suspended. L1–L4 reported0 passive flags; the unchanged600s budget expired during L5. This is incomplete and is not final-source evidence. Comparison used the committed candidate revision and normal source equality checks; no SOURCE_MATCHES_MAIN override. Historical log: `test-results/fix71-b/threat-final.log`.

**BLOCKED: final-source retry requires a quiet window.** All owned native/browser checks have finished; other worktrees still run threat/browser jobs. Recorded host load is10.29–10.89. [Window record](threat-release-window.json). [Earlier timed-out candidate log](threat-incomplete-candidate.log), [isolation record](threat-incomplete-candidate-isolation.json). No final-source full threat run was launched above the required load threshold. Coordinate a quiet window, then rerun `npm run qa:threat` alone with its unchanged600s limit;0 flags is still required.

## Evidence handling

All captures were personally viewed, recorded with SHA256 and concrete observations, then deleted. [Full review manifest](capture-review.json); final corpse and audio manifests are linked from their release summaries. Earlier follow-camera-blend corpse views were excluded; corrected measurement completes the camera blend and uses actual instance/world-transformed frozen vertices, including equipment and excluding airborne blast flights. Root/layer envelopes are separate measurements. The L5 briefing partly occludes actors in handover frames; roster/coordinates independently establish the same basement.

No specs, reference repository, reference images or performance targets were edited. No deployment or push was performed. Open acceptance findings and the threat validation gap require follow-up before merge.
