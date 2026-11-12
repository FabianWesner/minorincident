# S76 — L3/L4/L7 threat-audit flags

## Outcome

**Open.** The combined audit confirms L3 at zero flags, L4 at two, and L7 at zero. Retained changes advance L3's second wave to +14 s, add one existing fast actor to L4's first west breach roster, and align L4's north approach mouths with its physical breach. Only L4's two population criteria remain open; L7's retained opening Alpha is staged 8.5 m east. Zombie stats and audit rules are unchanged; L8 is untouched.

## Exact audit lines

Baseline was audited at `b06e3197391052367c9ade363608afd997ca1196` before edits:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 1 passive flags (106.6s)
[qa:threat] L4: skilled complete, passive tick-budget, 4 passive flags (109.0s)
[qa:threat] L7: skilled complete, passive complete, 2 passive flags (129.3s)
```

After the retained combined changes, the exact requested command reported:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 0 passive flags (59.0s)
[qa:threat] L4: skilled complete, passive tick-budget, 2 passive flags (121.4s)
[qa:threat] L7: skilled complete, passive tick-budget, 0 passive flags (124.6s)
```

The command summary was `[qa:threat] 125.0s; 3 fail flags; test-results/qa-threat/README.md` (the total includes the partial-selection diagnostic). Before had 8 fail flags by the same count, including that diagnostic.

Remaining acceptance flags:

- L4: `criterion/L4-06 first breach:FAIL`, `criterion/L4-06 sustained horde:FAIL`

## Level-design change

`LevelFourWar.emergePerimeterPressure` now uses one existing runner from the authored spearhead roster for the first arrival at the first west breach. The other two arrivals and subsequent breach cohorts retain their usual roster. This moved the west cohort's first attack inside the 20-second limit without increasing cohort size or heavy count. The L4 north/south alpha reorder trial was reverted: it still produced only two north breach members and reduced high-hold population peaks.

L4 high-hold evidence after the retained change: first breach at 50.08 seconds (17.27 seconds after turn start), 44 alive at breach, peak population 59 (56 in plaza), and plaza minimum 17 over 8,700 post-threshold samples versus the requirement of 60 alive at first breach and 40 in the plaza through line break. Skilled routes completed for L3, L4, and L7. The audit remains short of acceptance.

## Browser QA needed

A partial headless L7 browser sample has been run and its captures opened (see below). Full browser review remains needed for L3’s revised wave overlap, L4’s west spearhead and north approaches, and L7’s shifted opening Alpha. The headless simulation audit verifies contact and completion; it does not establish visual readability or preserve the PO-accepted feel by itself.

## Checks

The exact threat audit above completed. `npm run typecheck` and `npm run lint` passed. The initial remote attempt found no healthy runner. The unchanged retry passed on `46.225.66.90`: 27 test files passed, 106 tests passed and 1 skipped, with the required 150/150 inventory present; 210.3 s under the 240 s budget (exit 0).

## Rejected L7 rear-kerb trial

Moved two of the existing four close opening runners from x=273 to x=284, keeping z=9.5/20.5 and the roster/count fixed. Focused audit `--levels L7 --out test-results/qa-threat-L7-rear-kerb` completed in 53.0 s: skilled and passive routes completed, but passive flags rose from 2 to 11 (nine follower-pace flags), with zero kiting attacks/hits. The 20 s probe began at tick 75, recorded one player attack start, and had 431 frames without threats. This trial was reverted in full; rear pressure at the forming party is not an acceptable fix. The committed runtime remains the validated partial L4 change.

The subsequent one-sprinter composition trial replaced only the first close runner with the existing sprinter archetype, leaving placement/count fixed. Focused L7 audit completed in 21.6 s: skilled/passive completed and follower pace passed across seeds, but a follower-wait flag appeared and both kiting flags remained (zero attacks/hits, 517 frames without threats). Reverted in full. The kiting implementation holds rocket fire for 300 ticks (5 s), then allows one shot; the observed zero contact therefore cannot be attributed solely to continuous rocket fire.

## Rejected L4 high-tier alarm staging trial

Reversing the high-tier alarm's eligible street-mouth order (farther mouths first; unchanged count, roster, caps and low-tier behavior) worsened census results: first breach moved from 50.08 s to 87.33 s, alive at breach fell from 41 to 34, peak plaza population fell from 47 to 40, and first attack moved from 9.83 s to 25.70 s. Plaza minimum remained 15. Focused audit completed in 47.6 s with the same three passive flags and skilled completion. Reverted: the distant approach delays both breach and pressure and does not preserve enough living population.

## Retained north breach alignment

Aligned the three existing north approach mouths at x=-22/-18.6/-15 (unchanged z, counts and roster) with the authored breach. Focused audit:

```text
[qa:threat] L4: skilled complete, passive tick-budget, 2 passive flags (49.8s)
```

North now admits three and attacks after 8.13 s; west admits 22 and attacks after 5.50 s; south admits four and attacks after 8.57 s. Only the two L4-06 flags remain. High hold: 44 alive at first breach (50.08 s), peak alive 59, peak plaza 56, minimum plaza 17. Typecheck and lint passed for this change. The subsequent combined-runtime remote suite passed (210.3 s); see Checks. A rejected wider north offset also admitted three but produced no attack within 20 s, so it was reverted before this aligned trial.

## Rejected high-tier fast alarm expansion

Trialed 24 additional high-tier alarm runners/sprinters (42 versus 18 total, keeping low tier fixed and using the existing fast roster for the added portion). Focused audit completed in 47.8 s: skilled complete, two passive flags remained. High hold reached peak alive 75, but first-breach alive was only 47 at 50.08 s, peak plaza 51, and minimum plaza still 17. Reverted: this adds opening pressure without meeting either census requirement. Counts remain unchanged in the retained runtime.

## L3 second-wave timing evidence

Advancing only the second station wave, keeping its 25 members and all sources fixed, can clear the kiting-hit flag but regresses other criteria. At +10 s (instead of +20), the probe landed four moving hits (12/min) and made 15 attack starts; squad-loss verdict failed with army counts 0/3/0 across seeds. At +15 s it landed two moving hits and army counts passed (4/2/0), but native competent attack rate failed (31.51/21.50/43.31 per minute). At +12 s the army counts failed (1/2/0), although two seeds' competent rates passed (47.48/9.96/22.86). All three focused audits completed skilled routes. Reverted all timing trials: the retained L3 schedule is unchanged. This establishes a pacing mechanism for contact, but a timing-only second-wave adjustment has not met the no-regression requirement.

## Retained L3 second-wave pacing

Advancing the second wave to +14 s (from +20 s), with the same 25 members, sources and all other wave times, passed the focused audit:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 0 passive flags (33.3s)
```

The moving probe recorded four attack starts and one landed hit in 20 seconds (3 hits/min). Skilled flags were also empty. Army counts across seeds were 4/3/0 (two pass); competent rates were 21.53/10.88/34.31 attacks/min (two pass). Typecheck and lint passed. The intermediate +16 s trial failed squad counts and retained a second flag, and was replaced by +14 s. The final combined three-level audit and remote suite remain due for the combined runtime.

## Further rejected L7 close-pack placements

Moving the four close runners' lateral kerb offset from 5.5 m to 3.5 m retained zero kiting attacks/hits and introduced two departure follower flags (four passive flags total; passive tick-budget). Keeping the original lateral offset while moving only the first pair to x=280 retained zero attacks/hits and introduced stuck-chaser and follower flags (12 passive flags total; passive tick-budget). Both focused audits completed skilled routes. Both changes were reverted; they crowd the formation without supplying moving contact. The retained L7 implementation remains unchanged.

## Rejected west Alpha timing extremes

The first ordinary wave already begins at alarm +0 s. Trialed moving the existing west Alpha from +6 s to +14 s: breach at 58.08 s, only 24 alive; plaza minimum 20; three passive flags. Moving it to +0 s instead produced breach at 44.35 s with 55 alive, plaza minimum 13 and three passive flags. Both skilled routes completed. Reverted both: later opening loses population before entry, earlier opening comes closer to 60 alive but worsens sustained plaza pressure and adds a passive flag. Retained +6 s remains at two flags with the aligned north approaches.

Moving the four close opening runners six metres west toward the street ranks also failed: focused L7 audit completed in 57.3 s with four passive flags, skilled completion, passive tick-budget and a skilled follower-pace regression. Reverted; delaying contact by moving the close pack west did not produce an acceptable combined encounter.

## Armor flank placement constraint

Moving the four armor-phase flank anchors toward the plaza produced an identical high-hold census (44 alive at breach, peak 59, plaza peak 56, minimum 17), two passive flags and skilled completion (55.8 s focused audit). Reverted. Inspection of `L4Collapse.push` explains why authored anchors cannot directly supply interior population: eligibility explicitly rejects `inside(p)`, requires offscreen/occluded and >=12 m from courier, and appends all exterior offscreen mouths. Further placement changes must operate on eligible exterior approaches; interior flank anchors are discarded.

Combined the rejected high-tier-only +24 fast alarm cohort with a high-tier-only Alpha release at alarm +0 s, preserving low-tier +6 s timing. Focused audit: skilled complete, two passive flags; breach 43.72 s with 50 alive, peak alive 76, peak plaza 65, minimum plaza 17. Reverted the combined trial and its temporary tier-specific timing field: the transient higher plaza peak did not improve either required census window.

Activating ten existing opening runners instead of six at arming (unchanged placement/count/roster) reduced the probe's frames without threats to 276, but still produced zero attack starts/hits while kiting and introduced a follower-wait flag. Focused audit completed skilled routes, passive tick-budget, three passive flags (64.7 s); multi-seed follower pace itself passed. Reverted: more continuous nearby pursuit did not resolve contact and worsened waiting.

## L7 unchanged-runtime kiting trace

Ran existing read-only `tools/qa/r9-kite-diagnostic.ts L7 1 /tmp/s76-l7-trace.json` against committed runtime (40 half-second snapshots). At tick 77, player x=270.14/z=15.00; all four close runners (IDs 76–79) are already dead. The player retreats east to x≈288 then north off the apron; at tick 677 the nearest living runner (95) is 14.22 m away, while the Alpha is 12.18 m away. Later runner 95 enters bite state while still >11 m from the courier, consistent with attacks on another human. The trace records zero courier attack starts/hits, one courier weapon attack, and 58 frames without queried threats. Close-pack geometry trials act on bodies that are already dead when the moving sample starts; further work should trace admission and target timing of living subsequent ranks instead of shifting those same four positions.

Trialed requesting the existing rear reinforcement at player x<=270 instead of <=185 and moving its centre from x=225 to x=245, preserving counts/roster and offscreen admission. Focused L7 audit completed skilled routes but passive hit tick-budget with 19 flags, including 16 passive follower-pace flags (51.3 s). Reverted: advancing the full reinforcement into the opening overloads follower movement and does not satisfy no-regression acceptance.

Redistributing all 20 opening runners into verge ranks (close cluster 4→0, unchanged total) cleared the kiting attack-start flag with one attack, but landed no hits and introduced two passive follower-pace flags (99.9 s focused audit; skilled/passive complete). A two-runner close cluster instead produced five passive flags, with skilled two/passive one follower-pace flags (19.1 s; both routes complete). Both formations were reverted; the original four-runner close cluster remains. This narrows one contact lever but neither redistribution meets no-regression acceptance.

## L4 census timeline diagnosis

Read-only high passive replay sampled living counts and director count. At alarm +45 s the plaza already has only 33 living (39 total), below 40. The minimum of 17 occurs at +94.33 s with only 18 living total. Director count remains 98 while 13 perimeter arrivals remain pending; it stays approximately 98–100 through most of the hold. At +15 s there are 52 living / director count 88, falling to 14 living / count 89 at +30 s. Thus the sustained deficit is not confined to the armor beat: downed/recovering bodies occupy the tier's slots while living pressure drops, preventing queued replacements from entering. Any compliant follow-up must preserve bodies and recovery/stat behavior and instead reduce simultaneous exposure of existing arrivals to army fire through placement/approach pacing.

Moving the existing west HMG nest to the north-side post (-14.6,-14), facing northwest, retained first-breach alive 44 and only raised plaza minimum from 17 to 18 (peak plaza 61), while increasing passive flags from two to four and delaying first attack to 18 s. Skilled complete; focused audit 54.7 s. Reverted: this firing-position change does not materially fix the census and worsens other criteria.

Replacing two close opening runners with existing riot archetypes (unchanged positions/count and global stats) failed: focused L7 audit 60.5 s, skilled complete, passive tick-budget, ten passive flags including six follower-pace flags. Reverted; standard shielding in this opening composition did not provide an acceptable contact/escort result.

Two standard infected dogs replacing two close runners retained both kiting flags and added two passive follower-pace flags (19.5 s; skilled/passive complete); reverted. Widening the original close runners' lateral offset from 5.5 to 9.5 m also failed (62.4 s; skilled complete, passive tick-budget, three passive flags, follower pace passed); reverted. Neither existing animal composition nor widening the blast footprint yielded a no-regression moving-contact result.

## L7 supported-policy comparison (diagnostic only)

On unchanged runtime, `MI_THREAT_KITING_STYLE=circles ... --levels L7` reports zero passive flags (49.6 s total): 10 enemy attack starts, two landed moving hits, 6 hits/min, all 20 s moving, 89.75 m travelled, radius 4 m, zero stationary hits, skilled/passive complete and no multi-seed follower-pace flags. The required default retreat remains zero attacks/hits and follows the east/north apron escape traced above. This establishes moving-target contact exists under another supported policy and the remaining result is strongly route-dependent. It does not satisfy or replace the required retreat receipt, and is not yet sufficient proof that those flags are audit artifacts. Audit rules and thresholds remain unchanged. Scheduler notified of the comparison.

## Opening Alpha position contact mechanism

Shifting only the existing opening Alpha east by 16 m produced four kiting attack starts but zero hits, primary skilled tick-budget and a follower-wait flag (107.0 s); rejected. An 8 m east shift produced three attack starts and three moving hits, skilled/passive complete, empty skilled flags and passing multi-seed follower pace; only `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` remained (35.9 s). A 6 m shift regressed to three passive flags and passive tick-budget (76.5 s). All are reverted for now: the 8 m case identifies a useful contact mechanism but still violates no-regression acceptance.

## Retained L7 opening Alpha approach

Shifted only the existing opening Alpha east by 8.5 m; all other Alpha anchors, stats and counts remain unchanged. Focused audit:

```text
[qa:threat] L7: skilled complete, passive tick-budget, 0 passive flags (77.0s)
```

Both skilled/passive multi-seed follower pace pass; skilled flags empty. Retreat probe: four attack starts and two moving hits; skilled follower-wait upper bound 4.79%. Typecheck and lint pass. Nearby trials: +7 m had four passive flags; +9 m had only the landed-hit flag and 5.99% skilled waiting. The +8.5 m position is retained because it meets both moving-contact and follower criteria; the combined audit and final remote suite remain due. Browser QA is needed for the altered Alpha approach before visual acceptance.

Shortening existing street-group intervals from 2–4 s to 1–2 s (unchanged scheduled wave sizes/roster) worsened high-hold minima: alive at breach 42, peak alive 62/plaza 59, minimum plaza 8. Focused audit 51.0 s, skilled complete, three passive flags. Reverted: front-loading admissions fills occupied capacity earlier and does not sustain living pressure. Later street reservations were left intact to preserve their authored encounters.

Earlier existing flank breach trial: south Alpha staged at +32 s (from +84), north at +40 (from +92), nests push beat +50 (from +104), with unchanged fallback deadlines/counts/roster. Focused audit 53.5 s, skilled complete, three passive flags; high hold remained 44 alive at first breach, peak plaza 51 and minimum plaza 20. Reverted: modest minimum improvement fails the 40 floor and adds another flag.

Final retained-runtime remote retry passed on 46.225.66.90: 27 files passed, 106 tests passed/one skipped, 150/150 inventory present, 210.3 s within 240 s, exit 0. Exact combined audit confirms L3/L7 zero and L4 two flags with all skilled routes complete. Browser review remains needed; zero-flag objective is incomplete.

Slower existing street-group cadence (4–6 s versus 2–4 s) also failed: first-breach alive 39, peak alive 53/plaza 41, plaza minimum 5. Primary skilled route reached tick-budget; three passive flags (179.4 s focused audit). Reverted. Both faster and slower cadence extremes worsen the retained 17 minimum; changing admission rate alone does not overcome the occupied-slot/living-pressure deficit.

Coordinated earlier first-line pressure trial (line 1 push/earliest/deadline 8/16/24 s, nest push 24 s, south/north Alphas 16/24 s) raised first-breach population to 55 and peak alive 73, but minimum plaza only 18 and four passive flags remained (45.5 s; skilled complete). Reverted all pacing changes: it misses both census thresholds and worsens other criteria while changing the accepted phase sequence.

Shifting the existing helicopter orbit centre west from (-14,4) to (-50,4), with unchanged orbit radius, weapon and firing cadence, did not improve census: first-breach alive 44, peak alive 59/plaza 57, minimum plaza 16. Skilled complete, two passive flags (69.3 s). Reverted the path change; air-support placement was not a useful lever in this trial. No visual claim or capture is made for it.

## L4 damage-source trace

Unchanged-runtime high passive replay counted damage events against infected during war. HMG soldier IDs 110/111 dealt 14,493.30/15,012.79 damage and caused 62/83 nonlethal downs (29,506.09 damage, 145 downs combined). Helicopter: 1,144 damage/seven downs; tank shell: 583 damage/no downs. Civilian IDs 35/45/88 dealt 9,748/9,377.4/8,151.4 damage, respectively. These are repeated damage/down events, not unique bodies. Ground crossfire dominates this trace; further placement work should inspect the two nest lanes and armed civilian positions rather than air-support paths. No runtime or audit behavior changed for this diagnostic.

Moving both existing HMG posts east to convoy-side (-7.6,-14)/(-7.6,16), preserving their weapons and combat values, raised plaza minimum to 25 but reduced first-breach alive to 37 and introduced two other passive flags (four total; skilled complete, 63.2 s focused audit). Reverted: this demonstrates a ground crossfire placement effect on the sustained minimum, but does not meet either census criterion and regresses acceptance elsewhere.

High-tier-only existing line Alpha at +8 s instead of +32 s raised first-breach alive to 47 but left minimum plaza 17 (65.2 s; two flags, skilled complete). Also shortening its northwest approach to (-44,-18) worsened minimum to 12 and restored first-breach alive 44 (46.8 s; two flags, skilled complete). Reverted both timing and placement; unchanged heavy count alone does not make this early pressure effective.

Staging +24 high-tier fast-only alarm arrivals at the farthest eligible street mouths (original 18 roster and low tier fixed) produced first-breach alive 49, peak alive 77/plaza 58 and minimum plaza 9 (46.9 s; skilled complete, two flags). Reverted both the extra cohort and special mouth order: exterior reserve pressure did not preserve enough living population and worsened the sustained minimum.

Shortening the existing west Alpha approach to (-37,21), combined with the previously tested +24 high-tier fast-only alarm bodies, opened the breach at 47.77 s but had only 43 alive; peak alive 75/plaza 59, minimum plaza 15 (50.2 s; skilled complete, two flags). Reverted the position and extra fast cohort; the shorter approach did not align breach opening with the transient population peak.

Combining immediate west Alpha release (+0 s), shorter (-37,21) approach and +24 high-tier fast-only alarm arrivals still opened at 45.17 s with only 44 alive, peak alive 76/plaza 53, minimum plaza 13 (52.3 s; skilled complete, two flags). Reverted all three changes; the transient population peak still precedes the physical opening and added early pressure does not sustain the plaza.

[Compact retained-runtime receipt](current-audit.json) preserves source/observer hashes, exact remaining flags, skilled/passive outcomes, kiting receipts and high-hold census from the combined audit. Its runtime revision predates later report-only commits; `git diff 8cad224a -- src tools` is empty for the retained implementation, confirming those audit inputs are unchanged.

Moving the four west approach mouths toward wall ends (z=-16/-12/16/20 instead of -12/-4/8/16) failed: first-breach alive 31 at 51.08 s, peak alive 54/plaza 49, minimum plaza 17; skilled mission-failed and five passive flags (72.7 s). Reverted all source positions; avoiding the central lane by this geometry does not preserve the complete encounter.

Using the existing fast roster for nine rather than three of the fixed 18 high-tier alarm arrivals worsened first-breach alive to 37 and minimum plaza to 15 (peak alive 59/plaza 48; 46.6 s, skilled complete, two flags). Reverted: changing this opening composition toward fast actors does not sustain the required population.

West-mouth wall-offset trials were both rejected. At 1.5 m outside (from 3 m): first-breach alive 36, peak plaza 45/minimum 10, three passive flags (48.9 s). At 6 m outside: first-breach alive 39, peak plaza 44/minimum 13, three passive flags (51.2 s). Both skilled routes completed; reverted to 3 m. Shortening or lengthening this exterior leg alone does not preserve living population or all breach criteria.

## Partial browser sample of retained L7

Ran the existing headless playtest through `tools/e2e-lock.sh`/browser pool, one browser, port 4976, 600 s reservation, low quality, zoom 1.5, two-minute sample. It ended at the deliberate 120 s sampling limit: not finished, no objective skips, zero driver-reported issues (command exit 1 because completion was not claimed). Opened pickup tick-6 and corridor tick-2708 captures: the pickup ring is visible beside the truck; the later frame shows the following survivor formation and UI reporting 24/24 nearby. [Two-frame sheet](l7-browser-sample.jpg). This is partial visual evidence only; it does not establish full L7 completion, full Alpha-contact readability, or visual acceptance of L3/L4.

Spreading the nine existing first-fallback posts along the north edge (z=-14, x=-30..-10) instead of the central vertical line produced first-breach alive 44, peak plaza 44/minimum 21 and three passive flags (43.8 s; skilled complete). Reverted: the modest sustained improvement adds another flag and does not meet the 40 floor.

Forward exterior HMG posts at (-41,-18)/(-41,24), with unchanged weapons/count, also failed: first-breach alive 43, peak plaza 58/minimum 16 and three passive flags (45.4 s; skilled complete). Reverted. Moving both nests outside the wire does not preserve enough living pressure and changes the accepted positions without passing acceptance.

Advancing the two existing high-tier-only line Alphas to +8/+12 s (from +32/+100, reordered to preserve controller consumption) raised first-breach alive only to 48 and worsened plaza minimum to 7 (peak alive 60/plaza 44; 46.6 s, skilled complete, two flags). Low-tier sequence, counts and archetypes were unchanged. Reverted all timing/order changes; concentrating existing Alpha pressure early does not sustain the required population.

Delayed +24 high-tier fast-only alarm arrivals were also rejected. Waiting until alarm +12 s yielded first-breach alive 51/plaza minimum 15 (46.8 s); +17 s yielded alive 54/minimum 14 (46.9 s). Both skilled routes completed with the two census flags. All extra arrivals and delay logic were reverted: admission under the existing occupied-slot budget cannot deliver enough of this cohort at the breach, and sustained pressure worsens.

Delaying the unchanged ordinary wave schedule after the alarm also failed. +12 s: first-breach alive 43, peak plaza 69/minimum 15, first attack 29.72 s, three flags (48.0 s). +6 s: first-breach alive 56, peak plaza 43/minimum 11, first attack 27.97 s, three flags (45.8 s). Both skilled routes completed. Reverted to +0 s; later wave admission briefly changes peak population but weakens opening contact and sustained density.

## Partial high-tier L4 browser sample

Headless playtest, browser pool/lock, one browser, port 4977, high quality, zoom 1.5, 600 s reservation, deliberate 120 s sample. Driver reported one P2 `stuck-navigating` warning at tick 1244 before reaching the hold; it subsequently progressed. Opened tick-2721 west-wall callout and tick-5423 north-breach captures: defenders and infected are visible around reception, bodies persist in the plaza, and the later frame shows ongoing fire near the tables. [Two-frame sheet](l4-browser-sample.jpg). Run ended unfinished at its sample limit, with no skips; command exit 1. This is visual evidence of a partial hold, not full completion or PO feel acceptance, and does not clear the census failures.

## Criterion interpretation check

`specs/epic-22-level-4-the-safe-city-falls.md` §6 replenishment explicitly keeps recoverable bodies' concurrency slots until they rise; its 2026-11-02 exclusion of downed/recoverable bodies is a low-tier cap override, with high-tier caps unchanged. Therefore the observed high-tier occupied-slot/living-count divergence is not evidence of an audit artifact. The two L4-06 failures remain genuine unmet acceptance criteria in this lane; no threshold, census rule, concurrency policy, recovery behavior or spec was changed to hide them.

Aligning the three existing south mouths around x=-29/-25.9/-22 worsened first-breach alive to 39 and plaza minimum to 11, with three passive flags (53.4 s; skilled complete). Reverted; the north alignment's successful cohort-contact effect does not generalize to this south placement.

## Time-box handoff

At approximately 2.5 hours, the zero-flag objective is **not achieved**. Retained runtime is four focused changes: L3 second-wave +14 s, one fast first-west breach arrival in L4, aligned L4 north mouths, and L7 opening Alpha +8.5 m east. Exact combined receipt is L3 0 / L4 2 / L7 0; all skilled routes complete. Typecheck/lint and the required full remote unit command passed. Browser evidence is partial and its limitations are recorded above.

Open: L4-06 requires 60 living at first breach (retained measurement 44) and a sustained plaza minimum of 40 (retained 17). These are not proven audit artifacts. Further work needs a successful level-design iteration that preserves the PO-accepted feel, existing heavy counts, global zombie behavior and persistent bodies; none of the rejected trials in this report meets that condition. No spec/audit-rule changes, deployments or pushes were made. Working tree is clean after committing this handoff; the retained `src`/`tools` diff against the combined receipt's revision is empty, so later report/capture commits do not invalidate those runtime results.

Existing-archetype support trial: added standard infected nurses to the ordinary arrival roster (unchanged counts and offered heavy roster; existing one-time nearby-runner revival only). Focused audit 48.7 s, skilled complete, five passive flags; first-breach alive 32 at 51.08 s, peak plaza 48/minimum 16. Reverted; the unchanged nurse mechanic did not offset repeated downs and the broader roster regressed other criteria.
