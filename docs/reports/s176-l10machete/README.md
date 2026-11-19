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

A native finale trace identified passive stuck ID 119 as the Mega repeatedly telegraphing ground slams at the courier while retaining `chase` state. The stationary-chaser observer now resets that actor's timer on a real attack start aimed at the courier, while retaining the 30-second and 0.5 m thresholds. An L10-only rerun reports zero passive flags; the skilled wave still has no cohort attack within 20 seconds, so the overall audit remains failing. The threat red-fixture proof and typecheck pass.

A skilled-finale trace showed service walkers circling the stair foot. The route was offset 2 m east because stair coordinates relative to the assembly origin were added to the console anchor. The route now uses the authored foot, top and gun world anchors directly. Typecheck passes. The L10-only threat rerun still reports the skilled wave missing its first attack, with zero passive flags; the offset correction alone did not close the gate and the stair traversal needs further tracing.

The service walker was slept during its door animation by chunk excess trimming, so its route controller discarded the temporarily absent entity. Emerging walkers are now protected from that excess trim, and the finale route uses a 1.7 m/s scripted walking pace. On the complete local threat audit L10's first wave attack is 19.43 s and the whole audit reports **0 fail flags** (328.5 s); no infected stats were changed. Typecheck and lint pass.

The requested remote L10 acceptance run completed both native route observations, fixtures (17 clauses per tier, zero errors), and all checkpoint checks (81 clauses per tier, identical controls). Report construction failed with `Missing historical criterion: G-28` after main added difficulty criteria without corresponding historical entries; therefore no L10 acceptance verdict was produced. The pulled fix51 receipts were restored. The acceptance harness must recognize the new criteria and the run must be repeated.

The acceptance report reader now recognizes G-28 and G-29 as unqualified new global criteria, with a reconciled 180-row inventory. The remote L10 rerun generated its report and exited 1: L10-01, -02, -03, -04, -07 and -11 failed; six rows remain incomplete, and global G-08 and G-10 also failed. The `L10-05` crash-site fixture was found to be missing from the fixture runner's level dispatch; it is now registered. Direct LOW/HIGH fixture runs pass the new pickup clause with no fixture errors. Further L10-05 clauses and the failing acceptance rows remain open. Typecheck passes; the pulled fix51 reports were restored.

Acceptance triage: the `L10-02` fixture's zero-damage requirement is inconsistent with the actual row, which requires the pre-finale Mega not be killed, and with PO 2026-11-12 in commit `8bf78527`: it can be hurt and regenerates, with a 35% health floor. The fixture currently fails after twenty rockets because HP reaches 1050/3000. It must be reconciled with the newer decision before treating that failure as a gameplay defect; this task was directed to edit only L9-08/L10-05 acceptance clauses.

The 40 HP ordinary runner is a design-table value. Production spawns it at 60 HP because `INFECTED_TOUGHNESS = 1.5` applies globally. With the requested 45 damage and 0.4 s timing, the machete kills a literal 40 HP target in one cut but requires two cuts against the current spawned runner; the axe's 56 damage also requires two. The existing test checks the 40 HP design table, not a production spawn. No infected stats were changed. This distinction requires product clarification if one-hit kills of the actual spawned runner are intended together with the specified example and equal DPS.

Current-source remote validation: `sh tools/remote/run.sh "$PWD" -- npm test` passed in 162.2 s (105 passed, 1 skipped, 27 files; the test-budget inventory remains 150/150). Remote L9 `qa:accept -- --level L9 --skip-browser` recorded L9-08 PASS for LOW and HIGH: both initial racks contain fists only, player health is 100, and the corgi is safe; all five checkpoint checks per tier passed. The L9 command exited 1 on L9-04 and has 16 incomplete rows. Pulled `fix51-verify` receipts were restored.

An additional L10-05 controlled comparison grants all six story weapons at the crash start and compares 240 ticks of infected census and encounter ledger against an unarmed same-seed control. LOW and HIGH match exactly; typecheck and lint pass. This proves only the opening case; the broader inventory-only and all-six physical pickup clauses remain open.
