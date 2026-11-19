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
