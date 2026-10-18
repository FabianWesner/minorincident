# Changes since the 10-16 audit

The original 230-AC baseline is 167 met / 59 partial / 3 missing / 1 obsolete. The current ledger is 180 met / 48 partial / 0 missing / 2 obsolete. These are criterion counts, not test counts.

| AC | Change | New proof / decision |
| --- | --- | --- |
| E24-AC06 | partial → met | [browser-wave3.log](../merge-batch10/evidence/browser-wave3.log), [wave3-sim.spec.ts](../../../tests/e2e/levels/wave3-sim.spec.ts) |
| E24-AC14 | partial → met | [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json), [browser-webgl2.json](../l7-entry/evidence/browser-webgl2.json), [browser-webgpu.json](../l7-entry/evidence/browser-webgpu.json) |
| E24-AC17 | partial → met | [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json), [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json) |
| E25-AC13 | partial → met | [ui-night-final-playwright.json](../merge-batch10/evidence/ui-night-final-playwright.json), [browser-ui-night-final.log](../merge-batch10/evidence/browser-ui-night-final.log) |
| E26-AC07 | partial → met | [targeted-sim.json](../wave3-sim/evidence/targeted-sim.json), [review.md](../wave3-sim/evidence/review.md), [E26-summary.json](evidence/E26-summary.json) |
| E26-AC16 | partial → met | [ui-staging-final-playwright.json](../merge-batch10/evidence/ui-staging-final-playwright.json), [phone-webgpu](../merge-batch10/matrix/phone-webgpu), [phone-webgl2](../merge-batch10/matrix/phone-webgl2), [audit.md](../merge-batch10/audit.md), [review.md](review.md) |
| E29-AC03 | partial → met | [browser-webgl2.json](../l7-entry/evidence/browser-webgl2.json), [browser-webgpu.json](../l7-entry/evidence/browser-webgpu.json), [real-input.json](../postmerge-10/evidence/l6-after-rng/real-input.json) |
| E29-AC16 | missing → met | [l7-checkpoints.test.ts](../../../tests/levels/l7-checkpoints.test.ts), [handover.json](../l7-entry/evidence/handover.json), [README.md](../l7-entry/README.md), [E29-summary.json](evidence/E29-summary.json) |
| E29-AC17 | missing → partial | [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json), [l7-real-input.spec.ts](../../../tests/e2e/levels/l7-real-input.spec.ts) |
| E30-AC06 | partial → met | [calm-high.json](../wave3-sim/evidence/calm-high.json), [calm-low.json](../wave3-sim/evidence/calm-low.json), [review.md](../wave3-sim/evidence/review.md) |
| E32-AC04 | partial → obsolete | PO 2026-10-09 no long bot batteries; scheduler/orchestrator explicitly drops the novice 45–50 min proof as an acceptance gate. Complete campaign regression remains AC32. |
| E32-AC07 | partial → met | [l10-dogs.test.ts](../../../tests/sim/ai/l10-dogs.test.ts), [a.md](../spec-audit/a.md), [README.md](../postmerge-3/README.md) |
| E32-AC18 | partial → met | [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json), [l10-minigun-input.spec.ts](../../../tests/e2e/levels/l10-minigun-input.spec.ts) |
| E32-AC21 | partial → met | [epic-32-level-10-the-cure.md](../../../specs/epic-32-level-10-the-cure.md), [l10-arrival.test.ts](../../../tests/sim/levels/l10-arrival.test.ts), [c-e32-E3-calibration-seed-32.json](../spec-audit/evidence/c-e32-E3-calibration-seed-32.json), [README.md](../merge-batch9/README.md), [E32-summary.json](evidence/E32-summary.json) |
| E32-AC28 | partial → met | [browser-wave3.log](../merge-batch10/evidence/browser-wave3.log), [wave3-sim.spec.ts](../../../tests/e2e/levels/wave3-sim.spec.ts), [l10-regression.test.ts](../../../tests/sim/levels/l10-regression.test.ts), [E32-summary.json](evidence/E32-summary.json) |
| E32-AC29 | missing → partial | [l10-minigun-input.spec.ts](../../../tests/e2e/levels/l10-minigun-input.spec.ts), [playwright.json](../merge-batch10/evidence/priority-initial/playwright.json), [selected-final-playwright.json](../postmerge-10/evidence/selected-final-playwright.json) |

Evidence chronology: the 10-14 L4 convoy/lighting report is older than the 10-16 corrected actual-bus failures and cannot supersede them. Postmerge-10 explicitly did not repeat the optional 17-case ride battery. E22-AC04 remains partial; the latest 60.7 ms low first-turn failure also remains AC20.

Unchanged partials with material progress: E24-15 default eye/player probes now pass, full required matrix still needs proof; E07-13 shading repaired but its named Checklist D remains unscored; E24-18 strict route repaired but the full vision review and phone gate overlap remain; E25-14 lighting now measured, native frame tests pass but raw light-lab heaps need budget closure; E27 blast hitch repaired but AC15 full Checklist H remains; E28-10 is now a measured heap failure; E29-14/18/20 gained real tests but incomplete current proof; E32-30 title/credits mist regression fixed, full scored review pending. See [ACs.md](ACs.md).

Audit C’s requests to extend PO #25 awareness beyond L5 conflict with the explicit orchestrator decision recorded in audit A and the merged reconciliation in postmerge-3. E32-07 is therefore met without changing perception. E29-07/E30-10/E32-09 retain their independent shared E07 move/bar proof gaps.

E32-AC04: this job explicitly accepts the PO 10-09 no-long-bot-batteries decision and retires the novice 45–50 minute proof as a gate. Its one-line note is added beside the AC table; no test or timing budget changes. E32-AC32’s continuous complete-policy campaign remains mandatory. E32-AC21 already carries the PO 10-16 ~143-second decision in the spec; the old audit’s 10–40-second objection is obsolete. E28-AC08’s existing selector-retirement spec note is retained.
