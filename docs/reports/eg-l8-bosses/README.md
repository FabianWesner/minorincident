# eg-l8-bosses — L8 animal arenas

**Original lane goal met. Post-merge verification is in progress.**

Original pre-merge runtime source: `dea0efbb`. The original results are retained below; current integration status follows. The binding design is `docs/design/boss-and-alpha-moves.md` (L8 table/common rules), `docs/design/story-script.md` L8 beat 3, and the lane brief.

## Main integration — in progress

Merged main `1141d078` into the L8 arena branch. Conflict resolution preserves Alpha type moves and Rapier throws, moving-hit lead/glancing and height guards, Mega lope and animal gaits, Alpha range eligibility and engaged arena bars, L10 layout/story changes, and paced zoo evacuees alongside the arena story actors. L8 elevated throws retain their trajectory/landing owner while Alpha throws retain Rapier and object reservation. Nearby evacuees use courier-relative pacing; distant catch-up retains the arena branch's 6.4 m/s cap.

First [merged skilled matrix](evidence/post-merge/initial-low-skilled.json) at `16fa7889`: flamingo 42.82 s, zebra 48.83 s, monkey 57.55 s, lion 73.52 s, gorilla 161.90 s, elephant 60.68 s; all zero deaths. Flamingo and gorilla miss the 45–120 s band. All 16 [merged lifecycle controls](evidence/post-merge/initial-low-controls.json) pass. Flamingo HP is now 780 (was 700); gorilla now abandons an immobile scavenging route after two seconds and returns to its pound/chest-beat cycle. The trace showed it stuck at (57.24, -30.25) pursuing a hose reel at (79, -32).

Focused corrected runs pass: flamingo **47.47 s**, gorilla **72.02 s**, both zero deaths. The production-tour bot also now returns to the public elephant entry before regrouping with the followers waiting outside the yard; the tour verifier requires actual APC completion.

The merged high-tier escape exposed one rooftop monkey without a ground return route (88.89% bounded reach). Monkeys now physically descend to the doorway when the courier leaves their arena; the unchanged path bound counts that real, currently active descent, as it already counts native vault/tunnel legs. A new native control covers the descent and retained melee height guard.

The control matrix also exposed a stationary-fire monkey win after main integration. A held monkey now continues close, visible contact bites every 0.5 s during its existing two-second grip; the melee shake-off stops them. This uses normal damage/height guards and does not change the grab duration or weapon rules.

**Open:** post-merge typecheck, lint, unit tests and corrected six-arena matrix on runners. The receipts below describe the original lane source until the post-merge results are committed. **Browser QA needed** remains open; no browsers are launched.

## Done and open items

- **Done:** all six arenas, native combat/lifecycle/control checks, required L8 route acceptance items, assets/audio validation and repository gates.
- **Open — Browser QA needed:** rendered visuals, audio presentation and performance at both quality tiers/backends; the brief prohibits browser launches in this lane.
- **Open outside the requested speed item:** G-13's separate far-follower waiting-time bound remains inconclusive, as detailed below.

## Final combat results

[Final matrix receipts](evidence/arena-final/) use the same final runtime for every row. Low and high skilled results agree; each fight is within 45–120 s. All passive, standing-fire and constant-circle policies die without clearing their arena.

| Arena | Skilled seconds, low / high | Courier deaths, low / high | Passive death (s) | Standing death (s) | Circle-kiting death (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Flamingo | 49.98 / 49.98 | 0 / 0 | 9.30 | 16.30 | 23.48 |
| Zebra | 58.83 / 58.83 | 0 / 0 | 20.92 | 41.05 | 41.57 |
| Monkey | 56.03 / 56.03 | 0 / 0 | 142.50 | 16.97 | 66.33 |
| Lion/lioness | 69.58 / 69.58 | 0 / 0 | 11.57 | 27.92 | 100.73 |
| Gorilla | 66.62 / 66.62 | 0 / 0 | 38.75 | 49.42 | 73.00 |
| Elephant | 76.10 / 76.10 | 0 / 0 | 9.55 | 9.55 | 9.23 |

The [production tour](evidence/production-tour-low.json) clears all six arenas and reaches APC departure/campaign progression in **699.87 s**, with **zero courier deaths, 12 rescued and zero collision failures**. No setup mutations or protected combat are used. Its engagement durations are 52.55 / 56.78 / 51.10 / 61.75 / 64.15 / 105.05 s, also all in band. Two monkeys scatter alive after their leader dies.

## Implemented and verified

| Requirement | Result / evidence |
| --- | --- |
| Flamingo flock | Seven real animals; circling, rotating three-bird 0.6 s marked dives, faster half-flock phase and landing recovery. |
| Zebra herd | Four animals; full one-second dust/rumble cue, staged lanes from opposite sides, close rear kick, physical fence/body contact and recovery. |
| Monkey pack | Seven healthy/infected monkeys; actual roof climbs/drops, roof/world debris, ropes and doorway choke, two-second swap lock, real melee shake-off, larger half-pack leader and scatter. |
| Lion/lioness | Real cover-stalking/growl, 0.6 s pounce and pin, recovery, and phase-two lioness flank while the lion roars. |
| Gorilla | Interruptible exposed one-second/8 m chest beat, real scavenged props/corpses/live infected, three-light-throw barrage, pound, faster rage throws and real destructible pillars. The matrix collapses a pillar during combat and follows with throws. |
| Elephant | 0.9 s charge, close trunk sweep, two-second exposure and damage victory or three actual wall/fence/truck impacts. Bushes and hose reels cannot earn counter credit. |
| Shared arena contract | Engaged bars, entry checkpoints, checkpointed phases/timers/cover and at most one local rocket pickup/stock. Ordinary weapons can finish bosses permanently. |
| Story continuity | Original sanctuary/keeper/K9/flamingo opening and APC escape retained. Nadia's elephant line requires a living, uninfected Nadia; the courier's “I'm sorry.” follows permanent elephant death. |
| Healthy → infected continuity | Real bites and the shared 2.5–3.5 s same-ID turn owner; no replacement boss spawn. Healthy animals have no enemy bars. |
| Runtime lifecycle | All 16 [final controls](evidence/controls-final-low.json) pass, including real death/retry, cover/ammo restoration, bars, grab/swap/melee inputs, chest interruption, permanent kills and conditional dialogue. |

The no-fire elephant control records three actual fence IDs (`189`, `207`, `179`) and ends with 97 courier HP. The gorilla's living missile retains the actual infected ID and HP, lands 2 m from the locked target, receives a 36-tick rolling/down recovery and resumes its ordinary pursuit. A native VFX pool contract verifies its circular landing marker at the actual shortened endpoint.

The [natural lifecycle observation](evidence/natural-infection-final-low.json) transforms all 22 animals through real tunnel walks, grabs and timers. The [interrupted-carrier proof](evidence/carrier-retry-low.json) kills the opening carrier after its first flock bite through the damage owner; a distinct replacement walks out of a real tunnel, and all 22 animals still turn by tick 6066. The keeper opening is retained. Only the courier is protected in these lifecycle observations; they are not combat-victory receipts.

## Closed L8 acceptance items

[Final low/high route receipts](evidence/route-final/) retain the original observer thresholds and denominators.

| Check | Low stationary / complete | High stationary / complete |
| --- | --- | --- |
| L8-06 bounded-path reachable share | 100% / 100% | 100% / 100% |
| G-22 first real courier windup | 17.88 s / 18.93 s | 19.35 s / 19.35 s |
| G-22 real outlet cohorts | 3 / 3 / 4 / 3 | 6 / 6 / 7 / 6 |
| G-13 every follower median / phase-group median | Minimum 0.999958 | Minimum 0.999613 |

Both competent escape policies complete with zero courier deaths. G-13's separate far-follower waiting-time upper bound remains **NOT CHECKED**; the bound is inconclusive and is not claimed passed. The brief's requested speed-ratio item is closed.

## Assets, audio and integration

- Twelve healthy/infected monkey/lioness model tiers pass the [asset validator](evidence/animal-assets.json) with zero errors. The monkey derivative uses the shipped gorilla skins at 55% scale with a hip-skinned tail; lioness removes the mane. Rigs, animation clips and healthy/infected eye distinctions are retained. `tools/assets/build-l8-monkeys.ts` reproduces them.
- Arena cover is installed through the existing L8 layout adapter before physics/destruction and rendering assembly. Pillars use the shared destruction owner; throws borrow actual world bodies and leave them where they land. [Roof control](evidence/monkey-roof-control.json) records continuous climbs and real elevated throws.
- The rebuilt telegraph sprites pass [both-codec audits](evidence/audio-final.json): 13 cue pools with four takes each, 52 non-silent slices per codec at their catalog offsets. Elephant charge has an original synthesized trumpet/foot stamp; zebra stampede has a full one-second rumble. Existing source licenses remain recorded in the audio license files.
- Elephant evacuees wait in formation outside its entry while the courier is inside the active yard, then resume following. The elephant's special spacing preserves its marked line while other bodies yield. Large scavenging/charge actors receive enough navigation budget to finish their routes.
- Initial tunnel pressure is bounded; the animal encounters carry the level after the opening. The southern cohort is led by an ordinary armored infected; the Mega retains its scripted sighting. The APC door faces the courtyard and its departure turns continuously.

## Validation and reproduction

The final runtime passes [typecheck, lint and the unit suite through `verify -- E30`](evidence/verify-final-checks.json): **106 passed, one skipped**, with the 150-case budget unchanged. [Full final log](evidence/verify-final.log).

Two shared-runner attempts hit the existing navigation test's 30-second timeout; [one failure is retained](evidence/verify-shared-timeout.log). The successful gate held both runner slots. Tests and their timeouts were not changed. The runner's synced Git manifest has no HEAD, so an ephemeral runner-only commit was required by the existing HEAD-dependent tool test; native receipts retain explicit source/observer hashes.

Native matrices, tours, lifecycle checks, audio builds/audits and full repository gates ran through `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh`. Native entrypoints:

- `tools/sim-runner/l8-bosses.ts all skilled|passive|standing|kite` (`L8_BOSS_TIER=low|high`).
- `tools/sim-runner/l8-boss-controls.ts`.
- `tools/sim-runner/l8-boss-tour.ts`.
- `tools/sim-runner/l8-route-check.ts`.
- `tools/sim-runner/l8-infection-route.ts` (also `L8_KILL_FLOCK_CARRIER=1`).
- `tools/audio/l8-cue-audit.ts`.

Arena matrix setup uses the production composition, explicit entry placement and real bites/turns during a labelled protected pre-roll. The measured fights use normal damage and ordinary movement/weapon input. The skilled policy uses MG sweeps, melee to shake a grab, and the campaign shotgun for close tunnel intruders. No new registered level tests, dependencies, spec edits, reference edits, push or deployment were added.

## Browser QA needed

No browser was launched, as requested. Inspect all six enclosures at the PO zooms and both quality tiers/backends: monkey silhouette/tail and leader scale, healthy-to-infected continuity, ground marker alignment and visibility, windup poses/sounds, pack bars, prop/corpse/live-infected throws, landing roll, pillar destruction, elephant wall/truck stun, doorway crowding, checkpoint return and the complete APC escape. Rendered performance and visual quality require this manual review.
