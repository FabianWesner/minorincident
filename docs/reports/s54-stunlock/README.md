# S54: heavy infected poise under continuous fire

## Cause

`Damage.apply` turns each positive `Hit.stagger` into `combat.staggerUntil` and clears `combat.attacking`. `InfectedSystem.update` sees the stun, changes the brain state to `stagger`, and returns before completing the attack. Repeated stagger-bearing hits can therefore repeatedly reset the attack cycle.

The campaign handgun, SMG, hunting rifle, assault rifle, and army MG catalog actions currently author `stagger: 0`. The screenshot symptom under plain rifle/MG fire is not reproduced by those catalog hit values alone. The focused simulation probe shows their attacks landing under fire both before and after the poise change (see below). The poise rule protects against authored light firearm/projectile hits that do carry stagger; heavy hits retain their intended interrupt behavior.

## Rule implemented

`Damage.apply` now applies a shared poise timer to infected outside the pursuit and arena-boss paths. Brutes, butchers, armored/armoured footballs, bloated infected, screamers, and Alphas cannot have an existing attack/telegraph cancelled by a light firearm hit and receive a 90-tick (1.5 s) stagger cooldown otherwise. Ordinary infected receive a 48-tick (0.8 s) cooldown, and attacks in their final half-windup are committed. Suppressed reactions keep the hit event and damage but clear stagger/knockback/knockdown. Shotguns, rocket launchers, explosions and melee are excluded. Mega's authored `megaStaggerReady` path remains separate. The timer is reset with pooled brains and rebased across restored tick offsets.

## Probe results

The native 15 m simulation probe used catalog fire intervals and continuous hits for 600 ticks, with tiny damage to isolate attack behavior. Counts below are landed player-hit events; “before” equals “after” for the three campaign guns because their catalog stagger is zero and the pre-change code therefore never entered the stagger branch.

| Target | Handgun | Assault rifle | Army MG | Flamethrower light-stagger control |
|---|---:|---:|---:|---:|
| Brute | 4 / 4 | 4 / 4 | 4 / 4 | 3 after |
| Alpha (brute signature) | 2 / 2 | 2 / 2 | 2 / 2 | 1 after |
| Runner | 5 / 5 | 5 / 5 | 5 / 5 | 2 after |

Each paired entry is before / after. The control weapon carries `stagger: 0.15`; after the patch, the heavy/Alpha attack remains active through continuous control hits, ordinary stagger is capped at one per 48 ticks, and heavy stagger is capped at one per 90 ticks. The assertions live in the existing `infected-ai` test to keep the suite at its 150-case budget. Alpha rows also assert a landed `alpha.*` signature move.

## Threat audit

A baseline run temporarily restored only `Damage.ts` from `HEAD`, saved the output under `/private/tmp/s54-threat-before`, and restored the working copy on exit. Both runs used the full `tools/qa/threat-audit.ts` command.

| Level | Supplied baseline | Measured before | Patched after |
|---|---:|---:|---:|
| L1 | 0 | 0 | 0 |
| L2 | 1 | 1 | 1 |
| L3 | 1 | 1 | 3 |
| L4 | 4 | 4 | 3 |
| L5 | 1 | 1 | 3 |
| L6 | 4 | 4 | 4 |
| L7 | 6 | 6 | 4 |
| L8 | 0 | 0 | 0 |
| L9 | 0 | 0 | 0 |
| L10 | 0 | 0 | 0 |
| **Total** | **17** | **17** | **18** |

The post-change run improved L4 by one and L7 by two, but added two L3 flags and two L5 flags, for a net increase of one. The added L3 flags were L3-06 squad counts/losses and L3-11 native competent rate; L5 added slow-follower checks for actor 28 in both the look step and search phase. L7’s two remaining flags are stuck-chaser checks; its four baseline slow-follower rows cleared. This does not meet the “threat flags not worse” requirement. The audit outputs are `test-results/qa-threat/README.md` (after) and `/private/tmp/s54-threat-before/README.md` (before).

## Validation and outstanding checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused `infected-ai.test.ts`: 5/5 passed; full default test files were run in smaller batches and passed. The monolithic `npm test` exceeded its local 240 s cap; the requested remote runner returned exit 69 because no healthy runner was available and its local fallback rejected the aggregate script.
- `tests/qa/invariants/war-waves.test.ts`: 2/2 passed in isolation. The full nightly command hit its 1200 s cap; other nightly suites included unrelated existing failures (campaign lost rocket-launcher handover, wave census, and content asset inventory timeout/errors).
- `npm run build:qa`: passed.
- Fixture-play captures for L4 and L9 were not obtained. The required browser-pool path failed to bind its daemon port with `listen EPERM`; the legacy `e2e-lock` path failed because sandbox policy denies `ps`. No browser was launched by either failed attempt. The development server on port 4949 was stopped.
- Initial `slim-worktree.sh` could not lock the common Git worktree config outside the writable worktree.

The implementation is not ready to count as complete: the threat-audit aggregate is worse by one flag, and real-input fixture validation is still outstanding.

## Continuation evidence

After sandbox restrictions were removed, `slim-worktree.sh` succeeded and the browser pool admitted headless L4 fixture-play runs. The first lacked the MG; the second explicitly set the loadout and logged `weapon.army-mg`, but the butcher remained at 2.9 m in chase with unchanged HP, so neither run proves an attack under fire. These runs completed with no page errors. A capture from the first was opened. A clear contact-position fixture is still needed.

The fixture runner's on-foot attack used Space after moving the pointer. InputSystem documents that keyboard attacks use keyboard facing, so the runner now holds LMB for pointer-targeted fire. ESLint for the modified tool passed. The L4-pointer run completed with no page errors but still recorded unchanged butcher HP at 2.9 m; this reveals an additional setup/input/path issue and is not accepted as combat proof.

The L9 `l9-before-rail-stall` real-input fixture completed (15 s, god off, burst enabled, no page errors); `L9/s004-t860.jpg` was opened. This fixture is in the vehicle hatch sequence and does not yet prove a heavy landed an attack on foot. Direct L4 `nests` loading was rejected as an unknown stored checkpoint, so that attempted run produced no combat evidence.
