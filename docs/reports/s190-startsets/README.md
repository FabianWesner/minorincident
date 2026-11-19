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
