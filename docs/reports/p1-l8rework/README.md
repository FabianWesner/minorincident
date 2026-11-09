# L8 arena route and elephant finale

Source implementation: `537b643f` (main, including `p1-l8apes`, merged before verification).
Source content hash: `7b8f8e012c7260b6923e72c36b7e0df5cfa18940d6e3ee05114cfdb399a942ec`.
The native runs started before the source commit, so their recorded revision is `12b46a9e`; their source content hash matches the committed implementation.

## Changes

- The service-yard keeper gates hold both APC approaches until all five enclosure encounters clear. Engaged enclosure gates close once the remaining animals have turned; opening stays available for the real infection carrier. Objective text and minimap point to the next unbeaten arena.
- Bosses take ordinary weapon damage, show hit reactions, and continue moving or attacking during their cycles. Zebra fence stalls launch a fresh telegraphed charge. Monkey roof attacks have bounded waiting and a physical descent. Ordinary infected damage and health rules are unchanged.
- Rocket launcher uses the campaign's normal firing/ammunition rules. There is no arena-specific rocket stock or pickup requirement.
- The same infected elephant breaches the north wall through the destruction system, charges the APC door, and triggers Hale's keys/death beat there. The wall and its protection restore on retry. The driver remains unavailable until the elephant falls and the complete living group is seated.
- No Mega actor in L8. L9 has three distant sightings before its existing bridge/hatch/escape sequence.

## Native verification

| Check | Result | Evidence |
|---|---|---|
| Mortal complete L8, low | PASS, 572.10 s, 1 death, all six arenas clear | [native-low.json](native-low.json) |
| Mortal complete L8, high | PASS, 716.63 s, 1 death, all six arenas clear | [native-high.json](native-high.json) |
| Engaged inactivity | Maximum 32 ticks low / 90 ticks high; limit 120 | Same receipts, `activity` |
| Actual north-wall collapse; Hale at door | PASS both tiers; Hale 1.64 m / 1.45 m from door | Same receipts, `finale` |
| Runner against every remaining enclosure lock | All five block entry; clearing them opens the same route; elephant still blocks driver | [route-gates.json](route-gates.json) |
| Shotgun, MG, hunting rifle, rockets × six bosses | All 24 combinations: ≥2 actual discharges, positive damage and live reaction | [controls/low-controls.json](controls/low-controls.json) |
| Lifecycle/tactics/retry/continuity | All 43 controlled checks pass, including three real sidestepped wall impacts and intact/broken wall restoration | Same control receipt |
| Merged healthy habitats | PASS low/high; 22 animals; original primate gets bitten/turns through real contact | [habitats/native-low.json](habitats/native-low.json), [high](habitats/native-high.json) |
| L9 complete and three sightings | PASS, 213.8 s, zero deaths | [native-l9.json](native-l9.json) |
| Repository gate | Typecheck, lint, all 107 unit tests PASS | [checks/verify-E30.log](checks/verify-E30.log) |

The full-route native policies are mortal and use ordinary input. Controlled weapon tests protect the courier and add the hunting rifle to isolate weapon capability; they are not combat victories. The wall-impact tactic fixture resets the lure positions between its three independent real collisions. The runner fixture protects the courier to isolate physical route closure.

## Browser verification

Pending final pooled low/high playthroughs and contact-sheet review. Earlier physical-input attempts exposed the monkey entry and elephant breach defects and were retained outside the final evidence directory. No browser PASS is claimed for those attempts.

## Tactics

- Flamingos: step sideways out of the shadow lane and sweep the landing flock.
- Zebras: leave the dust lane; shoot the stragglers after their fence turn.
- Monkeys: use the doorway choke; axe hits shake off a grab; prioritize the leader in phase two.
- Lions: keep rocks behind you, dodge sideways at the glint, punish the landing.
- Gorilla: interrupt the chest beat and put a pillar between you and thrown props/infected.
- Elephant: sidestep a charge into the truck or perimeter wall; three real impacts finish him. Weapons also deal permanent damage.

No push or deployment performed.
