# s190-startsets

## Change

Added one authored start-rack table in `src/data/levelStartWeapons.ts` and made `campaignLoadout()` materialize it without consulting the carried racks, pickups, or owned actions. Applying a level start also grants those authored actions to the live campaign state and selects the first ranged weapon; when a level has no ranged weapon it selects the highest-tier authored melee weapon. L1 keeps fists/kick as unarmed fallbacks, and L10 retains its axe-only crash-site start.

The L8 arrival list includes axe, handgun, army MG, shotgun, and rocket launcher. The existing sanctuary transaction removes only the rocket; a regression asserts the exact post-armory rack. L7-02 now counts the authored L7 start plus its in-level rocket pickup (five), and G-16 requires the exact authored set, with L8 measured after its armory handover.

## Verification

- Focused `tests/engine/save-progression.test.ts`: **PASS** (6 tests).
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- E13 full gate via `node --import tsx/esm tools/verify.ts E13`: 106 tests / 27 files passed (107.5 s); the `tsx` executable itself is blocked by sandbox IPC socket permissions.
- `npm run qa:threat`: **FAIL, 5 flags**. L3-11's QA summary used the outdated 25/min ceiling (aligned to the accepted 40/min PO target in `tools/qa/threat/criteria.ts`). Remaining current flags: L7 moving kiting landed hits below 2/min; L8 skilled route tick-budget/unreachable; L8 follower pace flags for IDs 354, 365, 366. These remain open.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: **not run**; the pool reports no healthy/provisioned Hetzner runner and this command is ineligible for local fallback. Provisioning is reserved for the orchestrator per `docs/tools/remote.md`.

## Scope

No encounter stats, zombie behavior, corpse persistence, or gameplay targets were changed. L10's authored start was read from the PO table and remains axe-only. The objective is incomplete until the remaining threat flags are resolved and the requested remote unit suite runs.

## Follow-up

Saved ability slots now survive the authored weapon reset, including the corgi lure. The focused progression suite, typecheck and lint pass after this change. The requested L10 empty start remains open: changing the table to empty causes the existing `cure-crash` checkpoint validation to fail because the current L10 save contract requires the axe. Lane s176 must provide its crash-site machete/save contract before this can be completed without breaking checkpoint saves. Threat flags and the remote suite remain open as above.

## Acceptance and remote follow-up

Updated G-16, L7-02, L8-01 and L9-08 to cite the 2026-11-19 authored sets. Corrected the L3-11 two-of-three test fixture to use 41/min as the failing seed under the existing 40/min PO ceiling; focused gate-tools passes (8 tests). The remote suite ran 26 passing files and one failing file in 198.9 s: that failure was the stale fixture. After the fix, two unchanged remote attempts both exceeded 240 s under shared runner load; both showed combat and L4 contact test failures before the watchdog ended the runs, with no final assertion detail. The progression file passed in both. The complete remote gate remains open.

The L8-01 arrival receipt evaluator now checks the authored post-armory weapons and selected handgun, while retaining its roster, full-health and control-hash checks. Historical captures remain stale and must be regenerated; typecheck and lint pass. The remaining L10 integration and threat failures remain open.

L8 skilled-route follow-up: the bot now uses its existing private corpse-aware route planner between animal arenas. A focused `qa:threat -- --levels L8 --maxWorkers 1` completed the skilled route and reported zero L8 passive flags in 129.9 s; the command exits 1 for its intentional partial-level flag. Corpse collision and persistence are unchanged. The full ten-level audit remains required.

## L10 integration

Merged current main containing s176 and s177 into this lane. The authored L10 start table is now empty; the crash-site machete and its save contract come from s176. The incoming campaign racks are synchronized with the live boundary snapshot so the cure checkpoint validates. Focused save-progression suite passes (6 tests), as do typecheck and lint. Full threat and remote unit gates remain open on the integrated source.

## Integrated threat audit

On integrated commit `f21f7ecc`, the direct full audit hit its 600 s watchdog under local load. Two deterministic stage shards completed in 406.3 s and 571.9 s, then the audit merger reported all ten skilled routes complete and **one** flag: `L7/KITING_LANDED_HITS_BELOW_2:0.00`. L8 skilled completed with zero passive flags. The L7 sample records 20 s of movement, one rocket attack, one infected windup and zero landed hits. The full zero-flag requirement remains open; no threshold or enemy stat was changed. The remote unit suite also remains open on the integrated source.

## L7 moving-sample diagnosis

A traced unchanged L7 retreat sample starts at tick 31, moves 39.81 m in 20 s, and records one infected windup and zero landed hits. By tick 360 the nearest visible runners are over 11 m away; the query reports no threats for 491 frames. A trial requiring a pursuer within 6 m chose the same sample and still had zero hits. A 3 m trial selected a different encounter at tick 74 (six windups, two hits, 20 s); it was rejected and reverted because selecting a different encounter does not establish that the original escape is unsafe. No gate threshold, enemy stats, or production behavior changed. The L7 issue remains open.

## Remote gate and checkpoint audit

The required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on integrated source: 27 files, 105 tests passed, one skipped, 185.8 s / 240 s. The prior table test's checkpoint fixture only calls `campaignLoadout`; it does not exercise actual checkpoint restoration. `Mission.restore()` reinstates the captured entity weapons, and L10 `loadResume()` also restores its saved arsenal. Therefore fixed racks on actual checkpoint restore are unproven and can differ after a pickup; L8's rocket handover and L10's separately owned pickup/hangar contracts need to be reconciled when implementing that path. L7's moving-hit flag remains open.

The L7 skilled bot's close-combat fallback now selects the authored army MG; its previous shotgun lookup could never match the fixed L7 start rack. A focused L7 threat audit completed skilled and passive routes, with zero follower pace flags over three seeds. Its moving-hit flag remains: zero hits in 20 s (and the command also marks single-level selection partial). This change does not claim the threat gate passes.

A direct L6 checkpoint experiment confirmed the restore gap: after setting a live rack to handgun/MG/shotgun/assault rifle, capturing the first L6 checkpoint, and calling `Mission.restore`, the restored rack still included the assault rifle. The expected authored L6 rack is handgun/MG/shotgun. The temporary failing assertion was removed; no checkpoint behavior was changed. A complete fix must cover actual restores across levels while preserving the L8 rocket handover and the separately authored L10 pickup/hangar flow.

L7 target trace: in the original sample, three early runners were assigned to courier ID 1, but by tick 240 the nearest surviving runners were chasing escort IDs 97/98; by tick 480 they chased escorts 51/98. A trial that counted only courier-targeted infected for the three-body admission began at tick 49 and still yielded zero landed hits; it was reverted. The problem is not resolved by changing sample admission, and the original measurement remains the gate.

Two L7 encounter trials increased the existing opening courier-pressure assignment from six runners to eight and twelve without changing the spawned population or infected stats. The unchanged moving audit still recorded zero hits (one and zero windups respectively); both trials were reverted. The remaining failure requires a different cause or gameplay correction.

G-16's exact-set evaluator now retains the clause identifier used by its coverage manifest and negative control, preventing an otherwise unmeasured row. Typecheck and lint pass. `tools/qa/accept/proof.ts` stopped before its controls because its archived fixture source hash is stale; current receipts must be regenerated for that proof. Two L7 placement trials moving the four close opening runners from 5.5 m lateral offset to 4.5 m and 3.5 m each still produced zero hits; both were reverted.

The finished-save table fixture now owns every catalogued carried weapon (the mounted rotary minigun is not a carried action); the six-test progression file passes. A stronger L7 director focus bias trial produced the identical zero-hit sample and was reverted. Checkpoint restore and the L7 threat gate remain open.

Live initialization checks now assert selection, not just the saved selection. They exposed L6's mission forcing the MG and L8's handover resetting to the axe; L6 now retains its handgun default and L8 restores the retained selected action after removing the rocket. The all-weapons finished-save L6 live replay and all ten initialized selection checks pass, as do typecheck and lint. A focused L6/L8 threat audit reports both skilled routes complete and zero L8 flags, but flags `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`; L7 remains open. The direct full audit and remote suite need reruns on this source.

L6 skilled and early-close bots now select the authored MG through normal input before defending, while the actual level opens with handgun selected as required. Focused L6 threat audit: skilled complete, passive complete, zero L6 flags; its only command-level flag is partial level selection (18.5 s). Typecheck and lint pass. Full threat and remote unit gates remain to be refreshed; L7 remains open.

L7 opening placement trials: shifting the four pre-existing close runners east from `centre.x + 14` to +19 or +21 produced zero moving hits. At +22 the moving sample produced one hit / 20 s but the full L7 audit produced two skilled follower pace flags; +24 produced two hits / 20 s but one skilled follower pace flag. All placements were reverted: no trial met both the moving-hit and follower targets, and the existing gap protecting the arriving party remains intact.

L7 opening correction: two of the four existing close runners now stand farther east; the other pair remains at the prior location. No population or infected stats changed. The unchanged moving probe records one hit / 20 s (3/min). The focused L7 audit reports skilled complete, passive complete, zero L7 flags and zero follower pace flags across all three seeds; its only command-level flag is partial-level selection (76.7 s). The initial production constructor's nearest enemy/follower body clearance was 3.64 m in both requested quality settings. Typecheck and lint pass. Full ten-level threat and remote unit gates require refresh.

## Current gates

On source at `190ece36`, the direct full `npm run qa:threat` passed in 593.1 / 600 s: all ten skilled routes completed, zero fail flags, including L6 and L7. The required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed 27 files / 105 tests, one skipped, in 205.7 / 240 s. The actual checkpoint restore discrepancy and its interaction with the L8 handover and L10 pickup/hangar issue remain unresolved; these gates do not prove that requirement.

The table-driven boundary test now checks exact left/right rack order for each of its fresh, finished and checkpoint-shaped save fixtures, including the L8 rocket before armory handover. The focused six-test file passes. This still does not cover the actual `Mission.restore()` checkpoint path; that requirement remains open pending the checkpoint clarification.

The acceptance report generator and G-16/L8-01/L9-08 checklist prompts now describe the fixed 2026-11-19 sets, including unarmed L10 and the L8 rocket-only handover; they no longer instruct a reviewer to expect an axe at L10. Typecheck passes. Acceptance proof receipts remain stale and require regeneration. Actual checkpoint restore remains unresolved pending the outstanding clarification.

`npm run verify -- E13` on the current Mac completed typecheck and lint but failed its local unit gate: `tests/engine/l4-contact.test.ts` reported two LOW perimeter actors stationary near open west/north entrances for five seconds (IDs 382 and 187); 105 other tests passed. The same test failed again when run alone locally. The remote full unit suite on gameplay source `190ece36` passed the file and all 27 files. This local verification failure remains open; it is not a timing timeout and no gameplay target was changed.

L4 local verifier control: temporarily substituting `main`'s pre-lane progression implementation and rerunning the same isolated L4 contact test on this Mac still fails the LOW perimeter routing assertion. The lane implementation was restored immediately after the test. This narrows the local failure: it does not depend on this lane's `applyCampaign` changes; it is not proof of a clean baseline for every source difference or platform.

Local L4 perimeter follow-up: a wide Alpha stalled 1.07 m from its open-breach waypoint because the existing four-second fallback required a gap larger than its combat clearance. The fallback now uses the existing 0.6 m scripted-waypoint arrival band for L4 breach routing; collision and infected stats are unchanged. The previously failing local `tests/engine/l4-contact.test.ts` passes unchanged (one test, 104.57 s). A focused L4 threat audit reports skilled complete and zero L4 flags (181.4 s; command exits 1 for partial selection). Typecheck and lint pass. Full threat, remote unit and E13 verification need refreshing after this gameplay change.
