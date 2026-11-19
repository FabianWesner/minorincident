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
