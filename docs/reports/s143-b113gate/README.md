# Batch 113 gate corrections

Base `7fb95a91`; merged requested main `792dde65` in `b0666c70`. No push, deployment or main movement was performed.

## Root causes and fixes

- **LOW tank slide:** the changed L4 routes exposed existing far-LOD foot contact defects. Actor 225 turned after recovery while its stance held too long (9.8 cm P95); releasing the turn step at 0.2 rather than 0.5 radians fixes this. The corrected population then exposed actor 241: a rotating hull pushed an idle actor while requested stride remained zero. Reach recovery must also lift these idle plants. Final focused tank HIGH/LOW pass; LOW maximum 3.1 cm, P95 3.0 cm. Existing render-contract coverage now includes a zero-stride shove beyond leg reach.
- **L2-12:** the full baseline `cc2f7476` audit reproduces exactly 21.93 attacks/min in the same 3.08-second sample and exits 0 with zero fail flags. This is existing short-sample matrix reporting; no L2 behavior or criterion was changed. The single disposable baseline checkout was removed.
- **Actual threat gate failure:** north breach owes three admissions, but LOW's cap was full before opening: 48 recovering infected, 30 nearby ordinary infected and two Alphas. Two arrivals eventually entered; the third remained pending. Restoring only baseline `L4Collapse.ts` removed the regression, identifying the changed routing trajectory that exposed this capacity fault. LOW now reserves each authored opening cohort before the camp fills, independently of the ordinary pending reinforcement queue. Quotas, cap, roster, damage and speed are unchanged; recovering bodies and corpses persist. All s140 wire-routing, L7 grounding and wreck-gate changes remain.
- Merged `tools/qa/s142-scan.ts` needed an explicit event discriminator for TypeScript union narrowing.

## Validation

- Full `qa:threat`: exit 0, zero flags across L1–L10, 436.5 seconds. Simulation source is unchanged since this pass.
- L4 contact regression: passes, including the LOW real-route outside-wire check.
- Final focused HIGH/LOW tank gate: passes.
- Final complete vehicle gate: all eight HIGH/LOW rows pass, each child exits 0.
- Final remote `npm test`: exit 0, 182.2 s within 240 s; 27 files, 105 tests pass, one existing skip. The earlier runner timeout was retried unchanged.
- Typecheck and lint: exit 0.
- Existing render-contract suite: 14 tests pass.

The JSON receipt records comparisons, rejected/reverted experiments and validation. No specs, zombie stats, corpse lifetime, L7 wreck grounding or wreck gate were changed.
