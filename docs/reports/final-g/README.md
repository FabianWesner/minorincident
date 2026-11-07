# final-g — frozen release review

Frozen game source: `4e570db8499bd1d76dcc17f9d13d1949d5cf2096`. **8/22 rows reviewed with a fresh content digest.** Pending entries remain unfinished; they are not passing decisions. Game source, public assets and layouts are unchanged.

| row | verdict | numbers | evidence | P-note |
|---|---|---|---|---|
| G-06 | pending | Current measurement/review still required. | — | — |
| G-07 | pending | Current measurement/review still required. | — | — |
| G-08 | pending | Current measurement/review still required. | — | — |
| G-09 | pending | Current measurement/review still required. | — | — |
| G-10 | PASS | Both qualities: moving approach fixtures collect exactly once with interact=false and mouseButtons=false. Ground contacts at 1.4949994m (≤1.5m); shelf at 2.1699998m (≤2.2m). Every fixture effect is applied while moving 0.075m; weapon, medkit and lamp classes included. Native approach-only observations with no pickup are inconclusive and are supplemented by the deliberate moving fixtures. | [review](../../qa/reviews/G-10.json); [G-10-native.json](G-10-native.json) | — |
| G-11 | pending | Current measurement/review still required. | — | — |
| G-12 | pending | Current measurement/review still required. | — | — |
| G-13 | FAIL | Fresh ordinary L7 high seed1 completion: departure followers62/65/74 median/group ratios0.9137348293/0.8780749680/0.8707108993, each with>=10 walking samples and a valid completed route; all are below0.95. The existing majority-of-three vote passes these IDs, but does not erase these concrete violations of the unchanged every-follower criterion. L5 high seed3 follower28 also reaches0.8945363771. L6 exact empty-input waiting is39/16082 ticks=0.242507% at both tiers (canonical final hashes identical), so its48.3% stationary upper bound is not classified as an actual wait failure. | [review](../../qa/reviews/G-13.json); [G-13-native.json](G-13-native.json); [G-13-L6-wait.json](G-13-L6-wait.json) | — |
| G-14 | pending | Current measurement/review still required. | — | — |
| G-15 | PASS | Fresh physical WASD/mouse matrix: bat, handgun, rocket × low/high, six cases and30 reviewed pose captures. Click-only displacement0m; no moveTarget in any sampled frame;24 actual attacks match input aim to vector error<=1.34e-15. At0.45s after release and through0.767s, resolved movement-facing error is0° in every case; prior71.1° late-facing defect no longer reproduces. Initial turn easing is retained in the raw trace, rather than mistaken for click steering. Labelled500×500 body crops of every capture were inspected at both qualities. | [review](../../qa/reviews/G-15.json); [G-15-controls.json](G-15-controls.json); [G-15-reviewed.json](G-15-reviewed.json) | — |
| G-16 | PASS | All20 ordinary level/quality starts inspected in current completion receipts. Zero forbidden initial offers; L1 empty; L10 exactly weapon.fire-axe. The maximum story inventory is checked at each level, preserving prior acquired weapons in L6/L8 and the L9 carried inventory. | [review](../../qa/reviews/G-16.json); [G-16-native.json](G-16-native.json) | — |
| G-17 | pending | Current measurement/review still required. | — | — |
| G-18 | PASS | Fresh controlled production-world matrix:520 human scripted player/escort contacts across every level/quality plus64 animal contacts in L8/L10;584/584 scripts interrupt for nearby human targets, no setup errors. The separate540-case finite-focus/companion matrix rechecks every human role:278 supported escort cases acquire the nearby escort, including prior L3/L4/L6/L8 focus failures. Two L9 rush calls have no L1 brain and do not establish a supported rush setup; direct scripted and focus contacts cover L9 separately. Support-role approach/attention is distinguished from a damaging strike (screamers/nurses need not emit a normal attack). All260 companion samples retain100 HP; the corgi is immune/non-prey under G-19. No AI, perception, director count or timers are changed after disclosed fixture setup. | [review](../../qa/reviews/G-18.json); [G-18-contact.json](G-18-contact.json); [G-18-animal-contact.json](G-18-animal-contact.json); [G-18-party-perception.json.gz](G-18-party-perception.json.gz) | — |
| G-19 | pending | Current measurement/review still required. | — | — |
| G-20 | PASS | 20/20 final-predicate fixtures across L1–L10 low/high delay transition exactly300 native ticks (5s), with invulnerability retained through the deadline. The prior zero-runout L7/L9 counterexamples no longer reproduce. Original L5 spawn setup rejected twice at the intact population cap; a separate explicit fixture reuses an existing runner and passes both qualities. No world count, timer or finish implementation is altered. | [review](../../qa/reviews/G-20.json); [G-20-runout.json](G-20-runout.json); [G-20-L5-runout.json](G-20-L5-runout.json) | — |
| G-21 | PASS | All95 mortal checkpoint checks at both qualities PASS, across naturally reached L1–L10 checkpoints; independent route controls match. Checkpoint IDs, position, racks, roster HP and pickup/gate membership match the documented contract. L1 and the L4 war/collapse retry preserve live world changes under the stated PO exception; remaining levels restore snapshots. This is a numeric controlled-death review, with no visual claim. | [review](../../qa/reviews/G-21.json); [G-21-native.json](G-21-native.json) | — |
| G-22 | FAIL | Current frozen-source native counterexample: L4 high complete war-0 cohort (announced at tick1969, not1969seconds) spawns48; first actual player attack occurs20.933333s later, exceeding20s. L6 low/high entry-5 first attack79.8s with2 admitted members; entry-4 first attack87.833333s. No timing/count threshold is changed. | [review](../../qa/reviews/G-22.json); [G-22-native.json](G-22-native.json) | — |
| G-23 | pending | Current measurement/review still required. | — | — |
| G-24 | pending | Current measurement/review still required. | — | — |
| G-25 | pending | Current measurement/review still required. | — | — |
| G-26 | pending | Current measurement/review still required. | — | — |
| G-27 | pending | Current measurement/review still required. | — | — |

## Measurement and qualification

Both-tier native acceptance was freshly run for every level. The initial L10 report assembly stopped because this sparse checkout omitted a tracked compressed epilogue input. Missing compressed report inputs were restored byte-for-byte from the frozen Git tree; the reused all-level run then reached the end and exited 1 for measured acceptance failures. This is receipt restoration, with no checker or criterion bypass. Final acceptance is rerun after all row reviews.

Visual/route work uses the shared headless pool on4329 and private preview ports4993/4994. Captures stay under ignored test-results/final-g; each reviewed capture retains SHA256 and concrete observations. Owned raw captures are deleted once their row review is saved.

## QA tooling corrections

[Before receipt](review-metadata-before.json) proves that numeric PASS reviews were omitted from tracker metadata and the schema rejected P taste decisions. [After proof](review-metadata-proof.json) proves fresh metadata is exposed while the measured numeric verdict is unchanged and P cannot qualify a visual row. Only QA review metadata/schema changed. The L5 run-out fixture reused an existing live runner after the original extra spawn was rejected at the intact concurrency cap; both original setup rejections remain in its receipt.

## Reproduction

G-22: run the ordinary L4 high complete policy with the acceptance attack-start observer; war-0 announces at tick1969 and its first player attack is20.933333s later (>20s). The receipt also retains the L6 low/high late or two-member cohorts.
