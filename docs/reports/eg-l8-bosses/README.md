# eg-l8-bosses — post-merge result

**Goal met: main is merged into the L8 boss branch and all six arenas still pass.**

Main `1141d078` was merged into `lane/eg-l8-bosses` in `104496c4`. Final verified source: `877d7e1d`; subsequent commits contain report/evidence changes only. [Current checkout hashes](evidence/post-merge/source-verification.json) match every final receipt. The original arena implementation, assets/audio and initial lifecycle evidence are retained in the [pre-merge report](pre-merge.md).

## Done / open

- **Done:** all 12 conflict resolutions, both feature sets, corrected arena balance/AI, final low/high skilled matrix and low-tier passive/standing/circle controls, 19 lifecycle/geometry controls, required route acceptance checks, full production tour, typecheck, lint and unit gate.
- **Open — Browser QA needed:** presentation and performance review on both backends/quality tiers. No browser was launched.
- **Open outside the requested speed item:** G-13's separate far-follower waiting-time upper bound remains inconclusive; it is not claimed passed.

## Final arena matrix

[Five receipts / 30 rows](evidence/post-merge/arena-final/) share the same source hash. Every skilled fight is within **45–120 seconds**, with **zero courier deaths** on both tiers. Every passive, standing-fire and circle-kiting row ends in one courier death without clearing the arena.

| Arena | Skilled seconds, low / high | Skilled deaths, low / high | Passive death (s) | Standing death (s) | Circle death (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Flamingo | 47.47 / 47.47 | 0 / 0 | 9.30 | 23.30 | 23.10 |
| Zebra | 48.83 / 48.83 | 0 / 0 | 21.20 | 23.70 | 74.70 |
| Monkey | 57.55 / 57.55 | 0 / 0 | 9.40 | 9.42 | 9.42 |
| Lion/lioness | 73.52 / 73.52 | 0 / 0 | 11.57 | 46.18 | 31.25 |
| Gorilla | 88.60 / 88.60 | 0 / 0 | 34.23 | 78.58 | 88.85 |
| Elephant | 60.68 / 60.68 | 0 / 0 | 9.55 | 9.55 | 9.23 |

The matrix retains the accepted native fixture: production composition, real same-ID bites/turns during an explicitly protected pre-roll, then normal damage and ordinary movement/weapon inputs throughout measurement. The source-matched receipts retain all bite/turn IDs, telegraphs, attack stages, damage, deaths, throws and destruction. Both gorilla skilled rows physically collapse a pillar.

The [untouched production tour](evidence/post-merge/production-tour-low.json), seed 1, reaches APC departure/campaign progression in **768.25 seconds**, with **two courier deaths, 14 rescued and zero collision failures**. Successful arena attempts take **64.37 / 57.65 / 53.05 / 66.35 / 79.72 / 92.23 seconds**, all in band. This tour uses no protected combat or fixture mutations.

## Features retained from both sides

| Area | Merge resolution and evidence |
| --- | --- |
| Infected AI / damage | Retains main's height guards, five Alpha types/moves, moving-hit prediction/glancing and L10 hangar/Mega rules, together with L8 carrier/boss ownership and permanent arena kills. The unit gate covers autonomous Alpha moves, moving contacts and combat rules. |
| Prop throws | Retains main's reserved pickups, Rapier arcs/resting poses, Alpha barrage/living missiles and restore velocity. L8 keeps elevated roof trajectories, real gorilla props/corpses/living infected, landing recovery and actual-endpoint markers through the same owner. |
| CrowdView / VFX | Retains Mega lope/footwork and main's flame effects, plus animal gaits, monkey leader scale and all arena telegraphs. Alpha pounce/bash/throw markers and arena landing circles are combined. Rendered review remains open. |
| Health bars | Regular Alpha eligibility remains within 15 m or after damage; shield/Mega exceptions and L10 gating remain. Engaged animal bosses also retain mandatory bars. Existing unit assertions and native arena controls pass. |
| Group / story | Retains main's idle glances, sway/start reactions and courier-relative nearby pacing. Distant L8 catch-up keeps its 6.4 m/s cap, the elephant entry hold remains, and all story/carried actors and the APC sequence are preserved. |
| World / pickups | Both L8 and L10 layout adapters remain installed. Pickups keep arena rocket stock together with main's story reach/surface options; L9 companion routing remains. |

## Corrections found during merge verification

- [Initial skilled matrix](evidence/post-merge/initial-low-skilled.json): flamingo was 42.82 s and gorilla 161.90 s. Flamingo HP is now 780 instead of 700. A [native trace](evidence/post-merge/scavenge-stall.log) showed a gorilla stalled on a hose-reel route; after two seconds without movement, scavengers now return to combat. The same fix prevents a blocked monkey leader from stopping the whole pack cycle.
- [Monkey stationary/circle wins](evidence/post-merge/monkey-grip-first-standing.json) exposed insufficient pressure during its grip. Close, visible grips now attempt 20-HP bites every 0.5 s through normal damage/invulnerability/height rules. The existing melee shake-off ends the grip; its two-second duration and selection lock are preserved.
- A [gorilla circle win](evidence/post-merge/gorilla-kite-regression.json) exposed excessive free recovery and incorrect rage lead. Throw prediction now uses the actual 18 m/s rage flight. Ordinary throws/pounds expose it for one second; interrupted chest beats retain two seconds, within the binding 0.8–2 s common window.
- Roof monkeys physically descend to the doorway when the courier leaves their arena, including when an ascent must turn back. The native control proves continuous movement and retained melee height protection.
- The production-tour bot rejoins the public elephant entry before waiting for evacuees outside the paddock. Its verifier now requires actual APC completion and zero collision failures.

## Final route acceptance

[Low/high stationary and complete receipts](evidence/post-merge/route-final/) all use source `877d7e1d`. The requested clauses pass:

| Check | Low stationary / complete | High stationary / complete |
| --- | --- | --- |
| L8-06 minimum bounded reach | 100% / 100% | 100% / 90% |
| G-22 first real courier windup | 17.93 s / 18.97 s | 19.38 s / 19.38 s |
| G-22 announced cohort | 13 members | 25 members |
| G-13 every observed follower median / phase median | Minimum 0.997722 | Minimum 0.996781 |

Both complete escape policies finish; their courier death counts are retained in the raw receipts. The separate waiting bound is **NOT CHECKED** (14.56% low / 15.21% high upper bounds), so only the requested G-13 speed item is closed.

The observer includes the real remaining monkey descent, as it already includes authored tunnel/vault legs. For a physically clear ground actor covered by a conservative dynamic-prop navigation footprint, it proves an entry of at most 4 m using the canonical full-radius static sweep, then charges that entire prefix to the unchanged **2.5× direct-distance** bound. It does not move or exclude actors. A closed physical pocket is a negative control. [Before/after comparison](evidence/post-merge/physical-prefix-passivity.json) retains the identical high-route native state hash **`b9e96de8`**, outcome and **182.27 s** duration.

## Controls and repository gates

All **19 [native controls](evidence/post-merge/controls-final-low.json)** pass: bars, one rocket, real death/checkpoint/cover/ammo restoration, chest interruption/exposure, permanent kills, monkey grip/selection/melee/expiry, roof return/height guard, three real elephant wall impacts, a living missile's identity/HP/roll, real landing-marker coordinates, conditional Nadia/courier lines, and physical-path entry with closed-pocket rejection. The no-fire elephant control records fences `189`, `207`, `177` and ends with **52.2 courier HP**.

Final [repository checks](evidence/post-merge/verify-final-checks.json): **typecheck, lint and unit tests pass** through `npm run verify -- E30` (`test:unit` aliases the same `npm test` gate). **106 passed, one skipped**, 27 active test files; registered budget remains **150/150**, 43/45 files. [Full log](evidence/post-merge/verify-final.log). The [existing threat red fixtures](evidence/post-merge/path-proof.log) also pass, including long/disconnected path rejection and passive independent navigation queries.

Heavy verification ran through `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh`. The final gate held both runner slots and Vitest remained capped at four workers. The runner's manifest checkout needs an ephemeral local commit for an existing HEAD-dependent tool test; explicit revision/content hashes identify the native receipts. No test timeouts or acceptance thresholds were changed.

Native entrypoints remain `tools/sim-runner/l8-bosses.ts`, `l8-boss-controls.ts`, `l8-boss-tour.ts` and `l8-route-check.ts`. Arena/route runs accept `L8_BOSS_TIER`, `L8_BOSS_REVISION` and their existing output variables. The full matrix uses low skilled/passive/standing/kite and high skilled. No push or deployment was performed.

## Browser QA needed

Review all six arenas at gameplay zooms and both quality tiers/backends: healthy/infected continuity; monkey silhouette, roof movement and leader scale; marked lanes/landing circles; windup poses/audio and bars; prop/corpse/living throws and landing roll; pillars; elephant walls/truck and held evacuees; checkpoint return and full APC escape. Also review the combined Mega lope, Alpha bar eligibility/moves and flame VFX. Rendered quality/performance remain manual work because this lane forbids browser launches.
