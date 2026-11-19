# s176-l10machete — L10 opening and machete parity

## Implemented

- The L9→L10 handover now strips the axe and the rest of the combat arsenal, starts with fists only, and preserves the corgi and ordinary health. Save migration, direct L10 initialization, and legacy cure-save handling use the same unarmed start.
- The machete replaces the barn machete at `(552, 0.5)`, 5.025 m from the L10 start `(547, 0)`. It is on open walkable ground with direct line of sight, collects on the eastbound crash-exit path, and has no barn duplicate.
- Machete damage is 45 at a 0.4 s cooldown (112.5 DPS); the axe remains 56 at 0.5 s (112 DPS). That kills a 40 HP runner in one cut. TTK bands were recalculated; combo definitions, sound, and animation data were left intact.
- Acceptance text cites PO 2026-11-19. The L9-08 crossing check expects fists, and the L10-05 controlled fixture now checks the crash-site pickup through collection and respawn absence.

## Evidence

- Native L10-05 fixture, LOW and HIGH: PASS. Both tiers began at 100 HP with fists in both racks; the pickup was visible, walkable, 5.025 m from start, collected at tick 52 (0.867 s) at 1.434 m, and caused no health loss. Exactly one authored machete exists, the pickup did not respawn, and the story found-state was set.
- Focused combat/save progression tests: 13/13 passed. Full local `npm test`: 106 tests across 27 files passed (101.2 s).
- `npm run typecheck` and `npm run lint`: passed after the final fixture edits.
- L9 acceptance (LOW/HIGH): L9-08 passed at both tiers and all five crossing checkpoints passed. Command still exits 1 for the unrelated L9-04 durability-contact row.
- L10 acceptance: both complete routes finished; 81 checkpoint clauses per tier passed; fixture and checkpoint error counts were zero. The run exited 1 with fresh failures in L10-01, L10-02, L10-03, L10-04, L10-07, and L10-11. LOW and HIGH stationary runs reached the harness tick budget. The new L10-05 fixture was separately rerun at both tiers and passed.
- Full `npm run qa:threat`: exit 1. L10 skilled flag: `wave/dispersal-assault:WAVE_NO_ATTACK_WITHIN_20_SECONDS`; L10 passive flag: `step/hold:STUCK_CHASER_OVER_30_SECONDS`. The crash-outskirts machete pickup probe collected before taking damage, but the requested threat audit is not clean.
- The prescribed remote acceptance and remote unit commands could not start because no healthy Hetzner runner is provisioned. Full local unit coverage passed.

## Browser QA needed

Review the machete on the crash-site ground in HIGH and LOW quality. Confirm the pickup prompt appears, collection works with real input, and the three-cut combo animation, sounds, and hit timing feel distinct while matching the axe's heavy-target DPS. Capture and inspect both quality tiers before closing this section.

## Open

- Resolve the L10 threat flags and the existing acceptance failures before claiming a zero-flag L10 gate.
- Run the prescribed remote acceptance for L9 and L10, `npm run qa:threat`, and the remote unit suite on a healthy runner; retain final receipts only outside `docs/reports/fix51-verify`.
- Complete HIGH/LOW browser review.
- Current `main` was merged in commit `78e29faf` after filesystem permissions changed. A fresh L10-only threat run on the merged source reproduces the skilled wave timing and passive stuck-chaser flags. The earlier s165 report identifies the stationary chaser as the Mega cycling slams at close range and documents the finale wave timing sensitivity; the present run still needs a source-level fix and full verification.

The crash machete now collects within 1.5 m, leaving time to see it during the approach. Both LOW and HIGH native fixtures pass without health loss. The unrelated G-10 evaluator relaxation and its observer changes were removed; the original distance criterion is retained. Typecheck passes. An L10-only threat rerun still reports the skilled wave and passive stuck-chaser flags.
