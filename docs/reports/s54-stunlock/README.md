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

## Measured rotary-minigun regression probe

The catalog rotary minigun carries stagger 0.1 at 20 shots/s. It is now included in the native 15 m matrix. A temporary run restored the pre-change Damage.ts from `0c0f8fc4^`, omitted only the new poise assertions, and ran the same probe; a shell exit trap restored both source and test afterward. Baseline rotary-minigun landed hits were brute 0, Alpha 0, runner 0. Patched counts were brute 3, Alpha 1 (signature), runner 2. Each window was 600 ticks with tiny damage to isolate AI rather than time-to-kill. Both focused test runs passed 5/5 cases. This is a measured before/after reproduction of continuous-fire stun lock; actual-damage and real-input acceptance remain outstanding.

## Actual-damage contact probe

Using the army MG catalog damage, fire rate, stagger and knockback, a brute starting at 1.5 m landed 2 attacks before dying at tick 193; a butcher landed 14 before dying at tick 577. God mode was off. These assertions are folded into the existing infected-AI test case. This establishes the requested at-contact survival-of-windup behavior with actual damage, separately from the tiny-damage 15 m approach matrix.

Audit trace investigation found allied gunfire in `src/sim/outbreak/Allies.ts` authors positive bullet stagger (normally 0.25), unlike the campaign army-MG catalog. The global poise rule therefore also changes allied suppression, which can affect L3 squad survival and attack-rate acceptance. This is a plausible mechanism, not yet a proven causal attribution for each new flag.

Zoo review found `L8BossArenas.control` returns while `Status.stunned` is true. Arena bosses were initially excluded from poise, leaving them vulnerable to the rotary minigun's positive stagger. They now use the heavy light-firearm cooldown and committed-telegraph rule too; pursuit Mega still uses its authored dedicated path. This is a new source change and invalidates the earlier full-audit receipt as final acceptance evidence; the full audit must be repeated.

## Fresh full audit after zoo-poise change

`node --import tsx/esm tools/qa/threat-audit.ts --maxWorkers 4 --out test-results/s54-final-threat` completed in 822.8 seconds, exit 1, with 18 acceptance flags. Counts remain L1 0, L2 1, L3 3, L4 3, L5 3, L6 4, L7 4, L8 0, L9 0, L10 0. The exact flag list matches the preceding patched run. The zoo change added no flags, but the net +1 against the measured 17-flag baseline remains unresolved. The required remote `npm test` retry was canceled while still queued (exit 130), before test execution; it provides no new test result.

Additional assertions now cover an ordinary infected's committed late windup and an arena elephant's heavy stagger cooldown plus windup preservation. The focused AI suite passed 5/5 cases after adding them; no registered test cases were added. These assertions cover the shared Damage gate, not full zoo authored-move integration.

L4-post-intro setup explicitly began the mission and advanced 3600 native ticks before spawning the butcher. This resolved the inactive-combat setup: the real-input MG reduced the butcher from 1350 HP to 90 by tick 4162 and killed it by tick 4350. It remained in chase about 2.2 m away and courier HP stayed 100, so the run proves shots connect but not an attack reaching contact. No page errors were reported. The authored intro was the reason prior L4 runs showed no combat.

## L4 real-input contact exchange

`L4-contact` used the begun mission after 3600 intro ticks, teleported the courier to the authored clear escape point (-4,16), spawned a butcher 1.5 m away, selected the catalog army MG, god OFF, no kite and burst 6. Combat then ran through real pointer/button input. Burst receipts show butcher attacks at tick 3628 (1350 HP, 1.3 m) and tick 3995 (510 HP, 1.3 m). The courier was dead by tick 4225 while the butcher still had 90 HP, after repeated MG shots. `s003-t4011-b2.jpg` was opened and inspected. This proves a butcher attacks her during the live MG exchange; the previous 2.2 m stand-off was specific to the bus-side placement. L9 on-foot proof and the audit +1 regression remain outstanding.

Regression triage compared raw native receipts: L3 seed-1 route deaths changed 0 → 2 and damage taken 140 → 368.37; L5 deaths remained 0 while damage taken fell 65 → 20. L3 officer-hit counts increased across seeds (167/168/173 → 177/193/192), so the result is not simply fewer allied shots. The global poise change affects their positive-stagger bullets, but further causal tracing is required before changing ally behavior. No audit threshold or level-specific tuning was changed.

## Controlled allied-suppression diagnostic

A temporary diagnostic limited the poise gate to `source.id === 1`, ran the unchanged L3/L5 audit stages, and restored the global source via an EXIT trap. It completed in 241.5 s. L3 returned exactly to baseline deaths/damage (0 / 140), L5 to 0 / 65; their flag list returned to the baseline L3 kiting and L5 skilled-rate flags. The tool additionally emits `PARTIAL_LEVEL_SELECTION` for this diagnostic, yielding 3 reported flags rather than 2 acceptance flags. L3 squad/competent-rate and L5 follower regressions cleared. This causally isolates the changed allied bullet suppression. The player-only condition was not retained: current source still applies the shared poise rule to every shooter. A solution preserving that rule remains required.

## Ally rescue priority candidate

Allied target selection now gives rescue priority to a live infected already executing an attack on a living party member, before distant Alpha priority. This is global and retains the shared poise rule; no damage/HP/fire-rate changes were made. `npcs.test.ts` passed 3/3. The L3/L5 diagnostic completed in 203.8 s: L3 now has 2 acceptance flags (kiting and squad counts/losses), clearing the added competent-rate flag; L5 retains its 3 flags. The sixth listed flag is PARTIAL_LEVEL_SELECTION. This improves those levels by one flag compared with global poise alone; a fresh full audit is required to establish the aggregate and other-level impact.

## Current full acceptance comparison with rescue targeting

The full audit with shared poise and rescue targeting completed in 308.7 seconds, exit 1 due to existing acceptance flags, with **16 flags versus measured baseline 17**. Per-level counts are **0,1,2,4,3,4,2,0,0,0** (L1–L10). All skilled routes completed. Relative to baseline, L3 adds the squad-count/loss criterion (changed allied suppression permits attacks through fire); L5 adds actor-28 pace rows in the look step/search phase (changed combat/route timing); L7 clears all four baseline follower-pace flags. All other per-level counts match baseline. The earlier stuck-chaser and competent-rate additions are absent. No threshold was relaxed. Receipt: `test-results/s54-rescue-full/README.md` and `audit.json`. This satisfies the aggregate “flags not worse” comparison while retaining documented new per-level flags; real-input L9 contact evidence and final suite validation remain outstanding.

L9 phase review confirms on-foot contact is not the authored bridge-fixture state: driving leads into a protected scripted crawl. The exposed hatch is the applicable combat window. The fixture runner now permits burst captures during that hatch state (it previously suppressed every burst whenever `e.driving` was present). `L9-hatch-burst` completed 30 s with god OFF and MG targeting, no page errors. It recorded an attacking runner at tick 681, distance 1.8 m; `s003-t737-b2.jpg` was opened. The capture shows the live MG/hatch exchange and nearby butcher, but its burst trigger was the runner, so a heavy-specific attack receipt is still missing.

## Required remote suite result

The exact required `sh tools/remote/run.sh "$PWD" -- npm test` finally obtained a remote slot and completed in 183.2 s within its 240 s budget. Test budget remained 150/150. Result: 26 files passed, 1 failed; 105 tests passed, 1 failed, 1 skipped. The failure is a gameplay assertion, not a timeout: `tests/helpers/l8Route.ts:77`, flamingo entry gate closed with corgi 354 still outside at (-0.5,-13.0), after 227 ticks. It must be investigated before claiming the final test gate green. AI, L4 contact, NPC, combat, determinism and other default tests passed.

The remote L8 gate failure reproduces locally on current source (focused interaction test failed), while restoring pre-lane Damage/Allies makes it pass. Keeping global poise and restoring only original allied targeting also passes, isolating the rescue-targeting change as the cause. A candidate excluding protected actors and the companion from rescue priority still reproduced the same corgi assertion and was discarded; current source is restored. These controlled runs completed and no test threshold changed. Rescue targeting requires a further correction before final validation.

## L8 gate admission correction

The rescue-targeting timing exposed a gate body-clearance defect: the arena gate could close once a follower's centre entered the zone, while its body remained in the gate's exclusion corridor, pushing it back outside. Excluding arena targets from rescue did not fix the assertion and was discarded. The gate now includes followers within its existing 1.5 m doorway-clearance threshold in `pending`, even if their centres are inside the zone. The same radius was already used for the long-wait doorway guard. This fixes both the initial corgi/flamingo case and a subsequently exposed civilian/zebra case. The exact focused interaction test now passes on shared poise plus rescue targeting (58.67 s); all test expectations remain unchanged. Full remote suite and audit must be refreshed after this correction.
