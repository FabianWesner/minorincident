# eg-l8-bosses — L8 animal arenas

Status (2026-11-08, 23:21 CET): six arenas implemented and committed; all focused controls and audio audits pass. Final full-matrix and repository-gate reruns remain in progress. The goal is not yet declared complete. This is a merge handoff checkpoint; the done/open list below is authoritative over historical calibrations.

The binding design is `docs/design/boss-and-alpha-moves.md` (L8 table and common special rules), `docs/design/story-script.md` L8 beat 3, and the lane brief. The PO's 2026-11-08 animal-boss direction supersedes the older endless mixed-horde/regular-Alpha L8 composition. The sanctuary, keeper/K9/flamingo opening, named survivor continuity and APC escape remain required.


## Current done/open handoff

### Done

- Six real healthy animal casts (7 flamingos, 4 zebras, 7 monkeys, lion/lioness, gorilla, elephant), same-ID bites/turns and the six specified move sets, phases, counters, entry checkpoints, engaged bars and one local rocket pickup each. Per-arena implementation commits are retained in branch history.
- [Natural production infection receipt](evidence/natural-infection-final-low.json): all 22 animals bitten and transformed without changing animal/carrier state in the observer, by tick 6053. The courier alone is protected for this lifecycle observation; this is not combat-victory evidence. The keeper/flamingo opening still uses its original bite owner.
- [Final scoped low/high route receipts](evidence/route-final/): all requested L8-06, G-22 and G-13 speed-ratio clauses pass at `e4dafff2`. Both competent evacuation runs complete with zero deaths. Minimum bounded reachability is 100%; first real courier windup is 17.88/18.93 s low stationary/complete and 19.35 s high; every observed follower median ratio is at least 0.9994. The separate G-13 waiting-time upper bound is inconclusive (NOT CHECKED), not claimed passed.
- [Arena candidate receipts](evidence/arena-candidate/) at `9f25be2a`: all six skilled fights finish in 45–120 s, zero deaths on both tiers. Flamingo 51.93 s, zebra 58.83 s, monkey 56.03 s, lion 69.58 s, gorilla 66.62 s, elephant 52.80 s. All passive/standing policies die; circling policies die in the first five arenas. These receipts precede the current elephant correction.
- [All 15 final native controls pass](evidence/controls-final-low.json), including three physical sidestepped wall/truck contacts without firing, mortal entry retry/cover/ammo restoration, real monkey melee shake-off and swap lock, chest-beat interruption, live infected landing roll, bars and conditional dialogue. The no-fire elephant control ends at tick 4243 with courier HP 100; no health/counter assistance is used after its explicit setup placement.
- [Both shipped audio codecs pass](evidence/audio-final.json): all 13 L8 special cues and their four variants (52 slices per codec) are present and non-silent at their catalog offsets. The rebuilt bank includes the trumpet/foot stamp and herd rumble; listening quality remains Browser QA.
- Gorilla native combat collapses a real pillar and follows with scavenged throws. Controlled checks exercise the real live infected missile, airborne identity/HP, landing distance and 0.6 s rolling recovery; monkey melee escape/swap lock, entry retry/cover/ammo restoration and conditional dialogue are covered.
- Typecheck, lint, unit suite and `verify -- E30` passed on the earlier candidate: [runner log](evidence/verify-candidate.log), 106 passed / 1 skipped, 150 collected cases budget unchanged. A final-source gate rerun is still required. The runner manifest has no HEAD, so an ephemeral runner-only commit was needed by the existing HEAD-dependent tool test.

### Open before native completion

- Final full-matrix combat and route reruns after narrowing rigid special spacing to the elephant. The broad spacing change regressed the gorilla to 142.88 s (a stalled long scavenging route) and high-tier G-13 to 0.731 for one early casualty; those runs are not accepted. The latest committed correction restores the first five bosses' prior spacing and gives only the engaged gorilla/elephant the full route-search budget. The [focused elephant receipts](evidence/elephant-final/) already pass: skilled 57.32 s, one death (82.43 s including retry) on both tiers; passive/standing die at 9.55 s and circle-kiting at 9.23 s.
- A production arena-tour diagnostic is additional integration work: its first version ignored ordinary tunnel intruders and exhausted 15 retries in the flock. The skilled arena policy now uses the real campaign shotgun against close intruders. The diagnostic is being rerun with normal damage and no fixture assistance.
- A killed opening carrier could previously keep selecting its own dead ID for unfinished flamingo infections. A committed fallback now walks a real replacement from a tunnel after the retry delay; the existing opening still owns the first bite. A native interrupted-carrier lifecycle proof is running.
- Repository gates passed on `7df08c10`: [check statuses](evidence/verify-7df08c10-checks.json), [full runner log](evidence/verify-7df08c10.log), 106 passed / 1 skipped. The final small source changes still require a gate refresh. Two earlier shared-runner attempts hit the existing 30-second navigation timeout ([retained failure](evidence/verify-shared-timeout.log)); the successful run held both runner slots without changing the test or its timeout.
- Browser QA below remains deliberately unrun by this lane.

## Requirement evidence map

| Requirement | Authoritative evidence |
| --- | --- |
| Flamingo flock: 6–8 animals, circling, 0.6 s marked line dive, faster half-flock phase, sweep counter and landing recovery | Actual same-ID transformations, native special-stage ledger, skilled/passive/standing/kite runs |
| Zebra herd: 4–5 animals, 1 s lane cue, rear kick, fences turn herd, opposite second stampede and straggler recovery | Native lane direction/impact ledger and control runs |
| Monkey pack: 6–10 monkeys, roof/doorway harassment, debris, 2 s swap-blocking grab, melee escape, larger half-pack leader and scatter | Healthy/infected model contract, native grab/weapon-input/leader/scatter controls |
| Lion: stalk/growl, 0.6 s pounce and pin, side dodge/recovery counter, lioness flank while lion roars | Native phase, pounce/pin and recovery ledger |
| Gorilla: interruptible 1 s/8 m chest beat, real scavenged throws, ground-pound ring, half-HP rage/faster throws and real pillar destruction | Real prop IDs/poses, windups/interrupts, destruction HP/collider/nav and checkpoint controls |
| Elephant: 0.9 s charge, close trunk swipe, sidestep-to-wall/truck counter, 2 s exposure, three successful impacts or damage victory | Native charge/contact/counter ledger and mortal runs |
| Every arena: engaged health bars, entry checkpoint, bounded rocket stock/pickups, phases and punish windows | Production bar predicate, mortal checkpoint/stock controls, native event ledger |
| Six skilled native fights, deaths reported, each 45–120 s; passive pressured/fails; standing/kiting cannot trivially win | Current-source native receipts, all six arenas and control policies |
| Nadia line only while alive; courier “I'm sorry.” after elephant death | Native dialogue/continuity controls |
| L8-06: ≥90% bounded reachability, initial attack ≤20 s, opening preserved | Fresh low/high native acceptance and opening story audit |
| G-22: announced cohort attacks courier within 20 s and required real outlet cohorts admitted | Fresh low/high native cohort ledgers |
| G-13: every follower ≥0.95× individual/group median ratio | Fresh low/high native resolved-motion samples, retaining roster caches |
| Repository gates | Typecheck, lint, unit suite and `npm run verify -- E30` |

## Implementation notes

- The arena controller and attack/recovery timers use fixed ticks. Arena state lives in the existing L8 checkpoint seam; infected actors carry their arena ID and punish-window clock.
- Extra normal flock/herd/pack members join the real zoo cast. The existing shared bite/turn owner retains IDs and changes their appearance; boss HP is assigned when the turn event occurs.
- The monkey derivative uses the shipped healthy/infected gorilla skins, reduced to 55% scale with a long hip-skinned tail. It retains the current primate joints, animation clips and healthy/infected eye distinction. `tools/assets/build-l8-monkeys.ts` is its reproducible authoring step. The former cat stand-in is removed.
- Arena cover is added through the existing level layout adaptation before physics/destruction assembly. Gorilla pillars opt into the shared `pillar` destruction policy; benches use the existing movable prop owner.
- Elephant evacuees wait at the entry while the courier is inside its active yard, then resume following. This keeps the column out of the charge lanes. Elephant windups/active moves retain their marked line while nearby bodies yield through the shared separation owner.
- No browser, deployment or push is part of this lane.

## Native calibration 01

The first low-tier native fixture pass completes all six arenas with zero courier deaths. Five fights miss the minimum duration; passive/standing/kiting controls are not yet measured. This is diagnostic evidence, not completion evidence. Each fixture uses the production composition and actual same-ID bites/turns during a labelled protected setup; the measured fight uses ordinary weapon/movement input and normal courier damage.

| Arena | Seconds | Courier HP at finish | Recorded incoming attack damage | Result against 45–120 s |
| --- | ---: | ---: | ---: | --- |
| Flamingo | 35.08 | 38.1 | 96 | Too short |
| Zebra | 44.15 | 100 | 24 | Too short |
| Monkey | 27.32 | 100 | 0 | Too short |
| Lion/lioness | 43.10 | 100 | 0 | Too short |
| Gorilla | 41.67 | 100 | 0 | Too short |
| Elephant | 56.40 | 100 | 0 | In band |

Source and observer hashes and raw stages/poses are retained in [calibration 01](evidence/calibration-01-low-skilled.json). Subsequent tuning increases HP and gives the flock rotating three-bird dive lines, preserving room to counter. Twelve new healthy/infected monkey/lioness model tiers pass the shared validator with zero errors: [asset receipt](evidence/animal-assets.json).

## Browser QA needed

Inspect all six enclosures at the PO zooms and both quality tiers. Check monkey silhouette/tail and leader scale, healthy-to-infected continuity, ground telegraph alignment and visibility, readable windup poses/sounds, engaged pack bars, cover/prop throwing/pillar destruction, elephant wall/truck stun, doorway crowding, checkpoint return and the complete APC escape. Rendered frame time and visual quality are unproven by native combat receipts.

## Calibration 02 and lifecycle controls

All six skilled low-tier fights first entered the requested band at revision `1a476640`: 60.93 / 51.40 / 52.87 / 52.13 / 63.00 / 75.58 seconds, with zero deaths. These are superseded diagnostic runs: stationary and circling policies exposed contact stalls and low pressure. Raw [skilled](evidence/calibration-02-low-skilled.json), [passive](evidence/calibration-02-low-passive.json), [standing](evidence/calibration-02-low-standing.json), and [circling](evidence/calibration-02-low-kite.json) receipts remain available. The old observer double-counted a death when both the mission counter and zero courier HP were present; current receipts use the mission counter once.

Revision `b8ff592f` passes all 14 [low-tier lifecycle controls](evidence/controls-03-low.json), including actual damage death and checkpoint restoration of boss HP, phase, destructible cover and exactly one rocket across world pickup plus arena stock. A respawn can immediately collect its entry pickup, so checking only ground-pickup presence would be incorrect. Other controls cover healthy/engaged health-bar eligibility, ordinary melee shake-off, two-second weapon selection lock, one-second exposed chest-beat interruption, permanent firearm kills and Nadia's alive/dead elephant dialogue.

The elephant control uses ordinary movement after an explicit setup placement and never fires. Three actual solid contacts (east yard wall, truck, west yard wall) kill it through the normal damage owner; courier HP remains 87.77. This is a controlled counter proof, separate from complete-route evidence. Subsequent spacing preserves the normal charge cooldown across the first wall-hit phase transition.

The first cover-stalking lion revision exposed a bot search stall after the male died. Arena movement now brakes at path corners, and the skilled bot routes toward a hidden surviving target to reacquire sight. The focused correction completes in 76.92 seconds with zero deaths; all other arenas are rerun after the shared routing adjustment.
