# s60 — L8 redesign part 1 handoff

Status: implementation committed for handoff at the orchestrator’s time-box stop. The full original goal is **not complete**; remaining work is listed below. No spec, animal-model, or animal-motion files were edited. Animal health/damage/counts retain their definitions; corpses retain persistence.

## §1 — path, fences, gates, markers

Implemented paved arena spurs, eastward monkey exit, appended connector/arrival/tour verges, gorilla-to-service corridor, and caps/barriers at unused road branches. Existing gate physics/rendering close arena entries behind the party, open exits on clear, and close prior sections as the party progresses. Timed connector gates close at the plaza seal. Shoves use the shared solid barriers.

The tour marker follows Nadia, including immediately after sanctuary restore. Combat markers stay at the arena centre; approach markers lead through the entry gate. Objectives use short verb lines; hints remain separate. Existing tests now assert the new sanctuary marker/text and arena centres.

Directional solid sweeps found and closed several real 12 m lawn escapes. Current sampled side exits stop around 2.4 m; unused branch barriers stop around 2.48 m. This is **sample evidence, not exhaustive confinement proof**. Final boarding approach and all junction corners still need a complete sweep/play pass.

## §2 — arena bounds, floors, minimap

All six pens have compact 28 m bounds, light floor material, perimeter fences and emissive ground strips, with entry/exit barriers. The encounter camera centres and widens to fit the active pen at zoom 1. The minimap draws the active boundary and filters enemy dots to its interior.

Opened zoom-1, god-OFF captures:

- [Flamingo](play-route-v8/s007-t12627.jpg)
- [Lion](lion-v8/s003-t976.jpg)
- [Monkey](play-route-v8/s010-t18044.jpg)

Each opened frame shows the full pen outline and minimap boundary. They predate the last connector fences and the switch from live-animal to fixed-centre combat markers. Zebra, gorilla and elephant framing/lighting still need opened captures. No 8/10 visual score is claimed. The deliberate cover/telegraph pass and flamingo-mechanic replacement remain part 2, per the design’s lane split.

## §4 — plaza, breach, finale

Kept the Nadia tour, breach, timed plaza defence, Back-to-the-plaza rule, six-Alpha order, launcher hand-in and APC departure story. Added a paved plaza floor. Hale stages inside the bounded elephant pen, and the charge/death predicate uses that pen so the finale does not depend on him already reaching the APC door. Final remote mission/story assertions pass, including all six mission scenarios.

## Validation

| Check | Result |
|---|---|
| Final D-ZOO rebuild | PASS, source hash `5a76e828e9d32e1462a0ce572dac59dea32270eaae5ba0b41a2434d0afac215b` |
| Layout validator | PASS, zero errors |
| Placement IDs vs pre-pass HEAD | Zero surviving IDs changed; 74 appended, eight filtered after generation |
| Typecheck / lint | PASS during final assertion/marker work |
| Mission scenarios | Final remote six scenarios PASS, 208.10 s |
| Native L8 fixture generation | All seven stages captured after new path barriers; this generation precedes the final cap-material correction and was not copied over the committed fixtures |
| Final smoke | PASS, 6 QA + 1 public tests, 184.9 s, ports4965/4966 through e2e-lock |
| Final remote npm test | PASS on94.130.181.173: 27 files,106 passed/1 skipped,218.5 s;150/150 registered cases. Prior178.104.70.127 attempt hit240.9 s; unchanged-source retry passes |
| Remote nightly | All L8 cohorts high/low PASS. Latest intermediate-geometry run cancelled at the time-box handoff before inventory/placement completed; earlier run had 7 passed / 2 baseline failures |
| Threat audit | Skilled policy completes. Passive first attack 3.42 s after breach; reachability fails (17/25 for 30 s), plus automatic PARTIAL_LEVEL_SELECTION. See [receipt](threat-audit.md) |

Continuous full-start real-input `--follow-marker`, god OFF, zoom 1, 390 s: cleared flamingo → lion → monkey; no browser errors; max frame 83.3 ms, p99 16.8 ms, no frames over 250 ms. This run precedes the last connector pass. No exhaustive ≤10 s stall proof is claimed.

The two earlier nightly failures have baseline evidence: L2 high market 24 admitted / 23 reached reproduced with base `73db6c05` source; the base validator and manifest reproduce the same 14 supermarket inventory errors against unchanged asset files. Neither failure is silently accepted as green.

## Left for a new lane

1. Complete route confinement, junction/corner and shove checks, including the final boarding area; verify one-way closure throughout the final geometry.
2. Repeat full-start marker-only real input against final geometry through the sanctuary gate; prove no travel stall over 10 s and open captures for all six arenas. Repack fixtures if the final route/layout invalidates them.
3. Resolve the threat-audit census conflict: global living infected behind intentionally closed gates are counted as unreachable. No denominator/filter or threshold was weakened. An orchestrator decision or gameplay correction is still required; L8-only selection also currently emits a diagnostic fail flag.
4. Resolve or explicitly adjudicate the baseline L2 census and supermarket validation failures, then obtain required green nightly gates.
5. Check remaining arena lighting/minimap/camera states and portrait behavior. Part 2 separately owns flamingo mechanics and deliberate cover/telegraph work; model/motion lanes remain untouched.

Earlier investigation details: [validation history](validation-history.md).

Final assertion cleanup: sanctuary marker/text assertions now match Follow Nadia / l8-route, including immediate checkpoint restore and live Nadia coordinates. Local vehicles2/2 PASS190.68s. An earlier remote run passed vehicles but retained the last stale missions marker expectation; that assertion is now corrected. Post-fix remote run on178.104.70.127 hit240.9s batch timeout; unchanged-source retry on94.130.181.173 PASS218.5s per orchestrator instruction. Implementation commit487c5405.

Handoff complete at the orchestrator’s requested stop. Implementation commit `487c5405`; README records implemented §1/§2/§4, opened zoom-1 captures, exact passing/unfinished gates and next-lane leftovers. No owned checks, browser jobs or preview servers remain running. The original full goal is not marked achieved.
