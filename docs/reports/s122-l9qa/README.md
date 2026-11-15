# s122 — L9 pursuit, hatch and save browser QA

Status: **partial QA; coverage audit remains open**. Source batch 103, `2815e0d5`, production optimized QA build. Headless pooled browser, 1280×720, ports 4981/4982. No gameplay changes, deployment, push or main movement.

## Measured passes

All passes used an L9-default progressed save and the visible Continue flow, real keyboard/mouse controls, and one logged authored-map route assist.

| Pass | Result | Glitches and feel |
| --- | --- | --- |
| HIGH WebGL2 z1, road | 480 s; hatch reached, 22 deaths; unfinished | Invalid difficulty estimate: original driver suppressed all vehicle gunfire. Stationary-enemy flags near hull are unconfirmed collision/contact behavior; driver timeout P0 is not a game P0. |
| HIGH WebGL2 z1.5, shortcut | 120 s; hatch reached, one death; unfinished | No driver flags. Same gunfire limitation; no reliable fight verdict. |
| LOW WebGL2 z1, road, corrected driver | **Complete**, 213 s, 0 deaths, 26 shotgun attacks; truck defence and L10 handover | P2 known smoke/readability at trucks: broad plume and overlapping actors obscure hull. Rail view remains readable. Fight is manageable with aimed fire; not a passive safe spot. |
| HIGH requested WebGPU z1.5, shortcut, corrected driver | **Complete**, 205 s, 0 deaths, 38 shotgun attacks; truck defence and L10 handover | Stationary-near-hull driver flags need review. Rail fight reduced courier to 50 HP before trucks: tense, not harmless. Runtime log confirms WebGPU. |

The temporary driver correction released movement and aimed/fired the physical mouse at drawn living infected while the HUD said “Engine stalled”. Original code returned before combat for every vehicle state. It was restored before commits; no final driver diff. Zero source/stat/corpse changes.

## Save fix

**Controlled browser boundary check passed.** Opened pause/settings by real UI, then applied a diagnostic lethal hit while paused. At tick 8, HP 0, changed HIGH→LOW through the quality select. Resume advanced to tick 133 and 100 HP. Changed back to HIGH after respawn; tick advanced to 187. Reloaded and selected L9 through Continue: living 100 HP, HIGH, tick 45. Zero page errors. This checks the zero-HP save boundary; it is not an organic hatch-death settings interaction. Probe source and values are in JSON.

## Visual review and provisional verdict

Personally inspected the current [contact-sheet.jpg](contact-sheet.jpg), six panels at960×870: HIGH GL z1 bus entry and passenger release, HIGH GPU z1.5 rail, HIGH GPU trucks, LOW GL z1 trucks smoke, LOW GPU z1.5 final yield. Earlier loading-screen panel was replaced with the observed incomplete LOW truck state.

The pursuit gives the hatch a visible source of pressure; rail combat is readable in sampled frames. The truck defence is busier and smoky, with a crowd pressing around the APC. With working fire input both routes finish without deaths, while HIGH still costs health. **Provisional feel: tense and manageable, not harmless; smoke makes the truck beat harder to read.** This is an automated real-input observation, not a human playtester rating. No confirmed P1. Known smoke is P2. P3: clustered passenger release obscures individual exits.

Stills do not establish continuous absence of popping, bus clipping, sliding/jitter, unrealistic catch-up speed, or passenger spawn/grounding artifacts. Those checks remain open rather than being inferred from successful completion.

## Validation

Production QA build, typecheck and lint passed. Unchanged remote `sh tools/remote/run.sh "$PWD" -- npm test` passed: runner 46.225.66.90,127.5/240s;150/150 manifest,27 files passed,105 tests passed/1 skipped. Earlier EPERM listener and unavailable-runner attempts were resolved and are retained only as history in JSON. JSON is below 200 KB; one small inspected sheet is committed. Raw captures/logs: `test-results/s122-*` (local).

## Completion audit — still open

- LOW WebGPU z1.5 sampled for 240 s: rail cleared at 100 HP; trucks read Defense complete but only 1/4 survivors at yield. Runtime backend confirmed for both HIGH/LOW GPU passes. Outcome is incomplete, not a successful ending.
- Continuous visual sampling of pursuit/spawn/disembarkation to judge the requested bus defects and 3× pacing.
- HIGH stationary flags were attack-state actors at the hull: not confirmed frozen AI. LOW capture-heavy run recorded 650 ms/P2 and 2533 ms/P1 hitches; capture overhead versus runtime cause is unverified.
- Organic death/retry settings navigation at the hatch, supplementing the passing controlled zero-HP check.

The goal is not complete. No broad “all clear” claim is supported by the current evidence.

## Additional LOW WebGPU review

Reviewed 20 chronological approach/rail samples (ticks 3513–6016) and the final yield at original size. Rail remains readable; the bus is insufficiently visible in this off-road sample to judge pacing or disembarkation. Final trucks show known P2 smoke/crowd hull occlusion, plus **P2 broad pink/purple ground color patches** (cause unverified). The late beat feels congested and stalled rather than tense: defense is complete but the driver remains at 1/4 survivors, alive at 100 HP, when the 240-second sample ends. A longer wait or organic intervention was not measured. These observations do not establish an impossible ending.

## Focused pursuit attempt

A further HIGH WebGL2 z1 road-driver sample captured every half-second for120s. Reviewed20 chronological frames: APC tips visibly at tick3255, later leaves asphalt and does not reach rail in this bound. **P2 APC tipping** is observed; driver steering and capture overhead are not isolated. This run does not resolve bus pacing/disembarkation coverage. Its result is retained as a failed observation attempt, not substituted for the successful earlier route.

## Focused rail sequence

A150-second HIGH GL z1 road pass reached rail; near-rail capture cadence was temporarily increased, then driver restored. Reviewed20 chronological frames (t5417–8445). Bus stays parked behind APC; no bus/APC overlap or floating actor established in sampled frames. Attackers gather around hull and the no-fire driver dies. Arrival and first passenger-release remain outside useful frames; spawn popping and3× pacing remain unverified.

## Arrival/release frame review

Original-size review of t6584/6604/6620/6641/6681/6717/6738/6757/6776/6798 resolves part of the earlier missing view. Bus enters progressively from the top edge (6681→6717), then stops behind APC. No centre-screen pop or APC intersection in this sequence. Passengers appear beside front-left bus at6738 and move away6757–6798; legs appear grounded, no floating established. **P3 clustered release readability:** tight group and smoke overlap obscure individual exits. Short approach reads as fast catch-up then stop, not enough to judge full3× pursuit.
