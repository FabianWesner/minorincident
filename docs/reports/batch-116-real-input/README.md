# Batch 116 real-input QA — incomplete acceptance

Candidate `ea21b122b4e31f6fe866ba6ebe47ab6cb814e01b`. Report only. **Latest outcomes:** standard HIGH L4 and LOW L4 complete; HIGH L6 and aligned LOW L6 complete; HIGH L10 reaches inspected credits; LOW L10 passes depot. Earlier failed attempts remain below. HIGH ran before LOW for each level, explicit `PLAYTEST_BACKEND=webgpu`, zoom 1.5. Logs contain `renderer: webgpu` receipts. All browser work used the pool through `tools/e2e-lock.sh`, headless Metal, one browser at a time, ports5049/5050, reservations no longer than ten minutes. Initial sandbox admission failures were overcome after permissions changed.

## Results

| Run | Evidence and outcome |
| --- | --- |
| L4 HIGH | 540-second visible-input cap; no skips; 20 deaths: eleven defense, nine escape. Does not meet escape target ≤5 and does not finish. |
| L4 LOW | Full level completed463 seconds, no skips/issues;15 deaths: nine defense, six escape. |
| L6 HIGH | Full level completed293 seconds, four player deaths, no skips. Completion receipt:10 survivors out /29 at start,19 lost. Final trace:17 turned, two dead, ten out. |
| L6 LOW |480-second cap at exit, x249.3/z11.7,14 player deaths, no skips. HUD0/3 out,24m; final roster25 turned, one dead, three following. No completion panel; starting cohort29, actual escaped0. |
| L10 HIGH | Three production Resume segments, first two480 seconds each. Full objective sequence reaches actual Credits, opened at segment3 tick27061. Driver later times out on ending condition and reports finished=false; visual credits proof is retained. |
| L10 LOW | Cleared farms/depot in first481-second segment. Production Resume segment2 reaches restricted-zone at x2206.9, tick1291. Extra continuation saved after480 seconds; the process closed at its configured16-minute bound. |

Raw paths: `test-results/playtest/b116-{high-l4-live,low-l4,high-l6,low-l6,high-l10,low-l10}/`. Each includes captures and JSONL logs. Only this report, compact JSON and one inspected contact sheet are intended for git.

## Findings

**P2 provisional — L4 HIGH escape pressure exceeds target.** Nine escape deaths and no completion within540 seconds. Capture `b116-high-l4-live/captures/continue-L4-L4-t29933.jpg`, tick29933, opened full size, shows the courier enveloped by a dense armored crowd on Harbor Street. Navigation warning at tick20963 near(5.1,-34.9),17m from marker. This is not proof of a corner-marker defect: collision, combat and driver behavior are confounded. LOW completes with six escape deaths. The opening route corner advances in both runs; a guarantee covering every corner is unproven.

**P2 provisional — L6 cohort attrition and LOW exit difficulty.** HIGH loses19/29; LOW loses26/29 and does not finish. First recorded infected grab at tick2037 near(8.58,-10.99), followed by a loss alarm at2097; companion sampling first shows survivor23 turned at2100. Many early losses occur in the shelter opening, rather than solely at the exit. HIGH final17 turned/two dead and LOW25 turned/one dead support infected pressure as a major cause. Checkpoint restores can reverse sampled status, so repeated transitions are not independent deaths. Exact killing-blow attribution and every loss position remain unqualified. HIGH saving ten disproves “everyone always dies”; reasonable-player winnability is not established by this map-assisted driver. Capture `b116-high-l6/captures/continue-L6-L6-t16246.jpg`, tick16246, opened in the sheet, shows followers and threats at the stairs. LOW final0/3 is an unfinished exit outcome, not a completed0/29 panel.

**P3 driver limitation — dialogue and opening rest warnings.** Both L6 runs report shelter-rest navigation delay and recover. HIGH L10 segment2 tick18560 reports “Enter the hangar ·0m”; opened `campaign-2-L10-18560-stuck-at-ring.jpg` shows Voss dialogue while courier stands in the ring. Later objectives advance. Treat this as progress-observer limitation pending contrary evidence. HIGH farm warning at segment1 tick23333,x1652.3/-41.6 also recovers. Credits are visually reached despite the later driver ending timeout. No confirmed P1.

## Pacing, fairness and visual review

L4 is dangerous rather than harmless in the inspected crowd frame; repeated deaths dominate this sample. L6 requires escort protection and loses most of its cohort; it cannot be described as harmless babysitting. L10 contains long repeated travel and pursuit between landmarks. The inspected late-farm frames show sheds, corn edges, containers and nearby enemies. These sparse frames do not independently qualify farmhouse defence, corn horde, shed crossing and depot Alpha ambush as four distinct fair fights. Full farm encounter identity/fairness remains a Driver gap. Regional deaths grouped by latest HUD are in JSON; they are objective-based event counts, not exact geographical killing-blow locations. Exact medkit use remains unqualified.

The opened contact sheet contains HIGH L4 tick29933, HIGH L6 tick16246, HIGH L10 ticks16250/24381. No confirmed visual glitch is identified from these frames; this does not establish absence of glitches across every traversal. Actual Credits frame was separately opened. Side-street L4 Alpha/heavy detours were not deliberately fought, and the final cellar-ring close-up was not independently reviewed: both are open coverage.

## Validation and Driver gaps

QA build, typecheck and lint passed. Required unchanged remote `sh tools/remote/run.sh "$PWD" -- npm test` retry passed on46.225.66.90:27 files,105 passed,one skipped,183.9 seconds within240. First attempt exceeded240 seconds; no test trimming or timeout changes. No build, static or unit checks remain running. No gameplay process remains running.

Driver gaps: deliberate L4 side-street fights; final cellar-ring inspection; unassisted LOW L6 stair guidance; per-survivor continuous loss positions/causes and reasonable-player escort evaluation; four farm encounter qualification; exact medkit accounting; universal visual-glitch coverage; L10 ending timeout. No source or playtest edits, stat tuning, corpse removal, protected-reference edits, push, deploy or main movement.

## HIGH L4 standard-input follow-up

`test-results/playtest/b116-high-l4-standard/`: explicit WebGPU, zoom1.5, standard map-assisted physical-input driver. Full level completed257 seconds with no skips, five defense deaths and **zero escape deaths**. Hide begins tick13507, cellar bar objective tick14652, wait tick14782. This meets the ≤5 target for this policy and supersedes the HIGH-completion gap, while the original visible-only failure remains retained. No route-corner warning occurred. Deliberate side-street Alpha/heavy combat is still unqualified. Two provisional stationary-infected warnings during defense: ticks10280 and11929; neither prevented completion. The strong policy difference prevents attributing the original failed run solely to product balance.

## LOW L6 aligned retry

`test-results/playtest/b116-low-l6-align/`: full completion in323 seconds, no skips. Completion panel receipt: **2/29 out**, 27 lost, 4 player deaths. One527ms physical KeyA+KeyS alignment was submitted near x244.04/z11.28 at observed tick15119 and consumed at15142. It is a recorded driver assist. Courier crossed to x255 and HUD2/2 out at16685, then completed. This closes LOW completion coverage but does not erase the first failed attempt or establish unassisted stair guidance. Capture `continue-L6-low-stair-physical-align.jpg` is retained in the raw capture directory.

## Additional capture review

Opened the full HIGH farm sequence as an uncommitted review mosaic and farmhouse tick5413 full size. Frames5413/8117 show farmhouse pursuit and corn lanes,10823/13530 corn and field threats,16250 sheds,18955/21671/24381 the container/depot approach. These support distinct visual spaces and route reach, not proof that every authored encounter was fought completely. Foreground farmhouse roof masks part of the ground while the courier remains visible at5413; no definite visual defect follows. Fairness remains provisional because sparse captures omit attacks between frames. The repeated long open travel is the clearest pacing concern; close threats and five HIGH farm deaths prevent classifying it as harmless.

Interior L4 brace markers at the bar objective are recorded drawn and pinVisible=true in both completed tiers, anchor l4-brace, x74.6/z-1.8. This is interior marker evidence only; exterior cellar-door ring visibility remains unverified.

## Deliberate L4 detour attempt

`test-results/playtest/b116-high-l4-detours/`: at escape transition13558 near(-11.31,-16.44), submitted ten seconds physical KeyA+KeyW with ordinary combat through control.json. Opened `captures/continue-L4-north-side-street-attempt.jpg`: courier dead among heavy threats. This does not prove arrival at the authored side-street group; deliberate north/south encounter coverage stays open. Standard input resumed and the run subsequently completed. The original zero-escape-death run remains the clean standard-policy receipt.

## Survivor audit and final coverage

The JSON survivorLossAudit covers every final dead/turned ID in all three L6 runs, with first observed status tick, every retained grab tick, and loss-alarm positions when present. These distinguish observed turning/death from merely being left behind; no permanent geometry-stuck survivor is confirmed. Checkpoint restores repeat some trajectories, so counts use final cohorts rather than summing transitions. HIGH saves10/29; first LOW sample0 escaped with3 following at cap; aligned LOW saves2/29. Escort completion is demonstrably possible, but losing19–27 of29 remains a serious attrition concern. These assisted runs do not establish a reasonable-player survival rate.

Deliverable audit: committed report, JSON below200KB and one82.9KB inspected sheet; HIGH-before-LOW passes retained for all three levels; explicit WebGPU receipts; both L4/L6 tiers have full completion evidence including failed attempts; HIGH L10 actual credits inspected and LOW past depot. Report findings retain capture paths/ticks and provisional severity. Open driver gaps are deliberate side-street fight proof, exterior cellar ring, exact medkit consumption, complete four-encounter fight/fairness qualification, and exact survivor killing-blow/continuous obstruction attribution. These are reported incomplete acceptance checks, not inferred passes. Only the three report artifacts differ from the candidate.
