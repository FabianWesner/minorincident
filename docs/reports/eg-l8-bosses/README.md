# eg-l8-bosses — L8 animal arenas

Status: implementation and native calibration in progress. This report does not declare the goal complete.

The binding design is `docs/design/boss-and-alpha-moves.md` (L8 table and common special rules), `docs/design/story-script.md` L8 beat 3, and the lane brief. The PO's 2026-11-08 animal-boss direction supersedes the older endless mixed-horde/regular-Alpha L8 composition. The sanctuary, keeper/K9/flamingo opening, named survivor continuity and APC escape remain required.

## Completion evidence to collect

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
