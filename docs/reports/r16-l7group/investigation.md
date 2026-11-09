# R16 L7 investigation

Base: `8622b6d1`. The unchanged mortal completion route does **not** complete all six cases on this base. Fresh runner results reproduce R12's archived results exactly:

| Tier | Seed | Outcome | Seconds | Native hash |
| --- | ---: | --- | ---: | --- |
| low | 1 | complete | 116.37 | `7531f27e` |
| low | 2 | mission-failed | 74.78 | `02602b10` |
| low | 3 | complete | 120.12 | `66622d3c` |
| high | 1 | mission-failed | 105.32 | `f303c8ff` |
| high | 2 | mission-failed | 64.52 | `470e45ff` |
| high | 3 | mission-failed | 101.13 | `e2128f94` |

The baseline receipts in `evidence/baseline-full-*.json.gz` retain outcomes, damage, roster, collisions, observations and source provenance. Baseline game source SHA-256: `c0e03f21fbe6a3669defc2ca955c943821ef88bf6e25594f477fb13c288867bd`.

## Raised road support during stun

`KinematicController` sampled logical floor support only while player controls were enabled. Northgate's road is 3.9 m above the underlying ground. Alpha roar disables movement long enough for gravity to carry the capsule below that road; subsequent support queries then retain the lower layer.

The ordinary low/1 route shows the courier at y=4.62 before roar, y=3.1175 at tick 180, and y=0.717 at tick 210, although road support remains 3.9. With support sampling enabled during stun, the same prefix stays at y=4.62. The before/after prefix receipts and traces are archived here. The regression assertion also removes support during the stun and checks that gravity still works.

Once the courier stays on the road, enemies can reach her throughout the encounter. The completion bot needs ordinary connected dodges around close attackers and telegraphed Alpha attacks. Its original rocket/shotgun attacks, mortal health and all enemy parameters remain intact.

## Casualties and the group wait

After casualties, living survivors retain their original slots. The bot previously computed its waiting distance from the number of living survivors. In high/3, eighteen survivors included original slot 23, whose assigned position remained 12.21 m away while the bot waited for everyone to come within 12.2 m. With no threats present, neither side could make progress. The original 1,200-second run and its last samples are retained in `evidence/casualty-wait-deadlock.json.gz`.

The bot now derives the same row allowance from occupied slots. The mission's 18 m group requirement and boarding requirements are unchanged. The existing navigation test includes a surviving slot-23 case after the other slots are lost.

## Natural movement and turns

Loose slots, start reactions and idle glances are enabled for L7. Wide encounter formation sway is applied before clearance checks. In the corridor, pairs follow a walked trail with small shared and personal sway; real corners and blocked legs remain in that trail. Gentle clear corrections can be shortened, so a small courier dodge does not require everyone to repeat the loop.

Generic sway must not displace a controller's already solved detour or bus queue target. L7 applies its sway in the encounter controller instead. R13's distinct three-column boarding rows remain unchanged, and the dog's existing tracking response is retained.

The first six-completion candidates still added pace flags at turns. Rejected moving-slot velocity trackers added more flags; these were discarded. Historical route receipts are retained in `evidence/rejected-route-trials.json.gz`. Completion alone is insufficient evidence for the requested follower regression constraint.

A later high-tier opening trace narrows the frontage problem to normal following after the launcher is already collected: a courier sidestep rotates the far tail's target off the road. Preserving exact pickup positions alone did not fix this. Extending the walked street trail removed high-tier aggregate pace flags but introduced a high/3 courier death and low-tier departure flags. That experiment was discarded. The selected handoff keeps the reproducible six-route candidate; the strict supplemental high-tier constraint remains open, as detailed in `README.md`.

## Verification limits

Two complete ten-level threat audits, on baseline and an intermediate lane snapshot, exhausted the unchanged 600-second wall budget. Neither supplied a final aggregate receipt. They do not establish a full threat-gate pass. Focused L7 comparisons must retain the unchanged evaluator, seed qualification, policies and observation windows.

No browser was used. **Browser QA needed.**
