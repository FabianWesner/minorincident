# Shared acceptance closure — E07 / E27 / E28

2026-10-22, base `c867e392b`, branch `lane/ac-close-shared`. This report supersedes the 2026-10-18 partial-AC evidence for the items below. **E07 and E27 verify green on `df390443a`; E28 is refreshing its previously green verification on the same runtime. E27 is done; E07/E28 remain in progress for the two unadopted proposals.** No proposal is adopted, threshold loosened, gameplay difficulty changed, deployment or merge performed.

[Final source/build hashes and unchanged measurement contracts](evidence/final-source.json).

| Partial AC | Current disposition |
| --- | --- |
| E07-AC05 | Met/fixed: all 14 timing/cooldown/restore probes and complete-boundary image review; 168 captures. The initially cropped roars were rejected and recaptured wider. |
| E07-AC06 | Met: all four Alpha moves, spatial/restore controls, 12-case shared-bar matrix and actual Alpha desktop/phone HP captures reviewed. |
| E07-AC12 | Met/fixed: exact pooled-page count, no unowned body/headwear nodes, 17 runner /30 mixed combined draws; full E07 verifier and all five quiet cases pass. |
| E07-AC13 | Met: named 60-runner Checklist D, all five items. |
| E07-AC19 | Zoo timing/boundary/restore and actual phone-bar proof met; literal stampede width remains partial with the unadopted proposal below. |
| E27-AC15 | Met/fixed: named H, all seven spots / seven items; full verify passes; E27 done. |
| E28-AC10 | Real buffer repair + native storm/L5 proof; original legacy heap counter still fails. Proposed measurement clarification below; partial. |
| E28-AC12 | Met: explicit six-mood G/reference signoff, 4/4 must +3/3 should. |

## Repairs and regression evidence

- **Restored/paused warnings:** consumed telegraph events were not replayed after checkpoint restore; paused draw selection also left the second warning at opacity zero. `Vfx.updateSpecialState()` rebuilds from the locked sim attack and remaining ticks without emitting events or changing sim state. All 14 real checkpoint regressions failed before repair; 30 focused VFX tests pass after. [Before](evidence/restore-before.log.txt), [after](evidence/restore-final.log.txt), [opened comparison](warning-repair.jpg).
- **Smoke readability:** isolated survivor labs now use production compositing, preserving the courier's alpha-protected colors; camera-player tube smoke retention is 20%. Existing unchanged player gate improves **1.0134→2.173:1**, coverage **30.58% ≤40%**. The beacon sample is at 2 m inside the actual low cloud instead of empty air at 3 m; unchanged smoke-pixel/1.15× gates measure **2.669×**. Fire smoke is orange below (15.80°), **2.62×** brighter than the top. [Comparison](smoke-repair.jpg), [focused run](evidence/smoke-final.log.txt), JSON readings in `evidence/smoke-*-final.json`.
- **Blast corpse motion:** retained bodies were omitted from the queued impulse pass. They now fly with the existing radial/upward falloff, one tick later, preserving frozen pose/id and landing position. Plain relative delay/velocity survive real checkpoints; cover and body-footprint controls stop wall crossings, explicit grab throws take ownership. No added collider, combat damage, brain, body removal or difficulty change. Frozen pages update bounds once per moving page and stop uploading when settled. [71-test batch](evidence/corpse-alpha-final.log.txt), [cover/handoff/tooling cases](evidence/corpse-cover-handoff-final.log.txt), [H captures](h-high.jpg).
- **Merged Alpha fixture:** the combined scene spawned its body too late/outside pickup range while ordinary melee was active. The original trace lacks a grab-throw; the journal measures **2.87 m >2 m** at its cue and courier death from extra melee. Spawn the body at `(8,1)` before slam recovery expires, cue the throw at that real boundary, then protect the courier only after all three real hits. Strengthened original test requires the actual corpse id and **30+25+30 HP /15 HP remaining** before protection; all four moves and the three support browsers pass. No AI state, cooldown, resistance or campaign tuning is changed. [Original state journal](evidence/alpha-merged-audit.json.gz), [corrected](evidence/alpha-merged-final.json.gz), [three-test recheck](evidence/alpha-support-final.log.txt). The first candidate met the original conditions; the new damage assertion also counted a later protected repeat (zero damage). It now checks the explicit damage-enabled segment before f350, while the complete later event journal is retained.
- **Crowd memory:** compact only vertices not referenced by the final indexed LOD; share immutable prepared CPU arrays through independent geometry/BufferAttribute GPU wrappers. Twenty shipped asset/tier expanded-attribute and triangle hashes remain exact; dedicated packed/interleaved/group/bounds/ownership regressions pass. [Asset audit](evidence/compact-bake-final.json), [regressions](evidence/compact-final2.log.txt). No model, animation, actor, particle or persistent corpse is cut.
- **Fog/wet shading:** hue-preserving 8% figure gain in dense fog repairs **2.9636→3.0349:1**, unchanged 7,585-pixel mask /3:1 gate. Anchored noise breaks regular wet sine bands, retaining wet mask/light-field contribution/0.08 brightness cap. [Fog reading](evidence/fog-final.json), [G images](g-moods.jpg).

## Final verification

All commands use `E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600 E2E_PORT=4051 SCENE_PORT=4052 MI_VERIFY_REMOTE_SIM=1 npm run verify -- E<NN>`. Node/static/build work runs remotely; functional browsers are headless and serial under `e2e-lock.sh`; native browser timing/heap stages use `quiet-run.sh` with a 1,195-second reservation cap. Remote simulation timings use `tools/remote/timing-isolated.sh`. Only one browser runs in this lane.

| Verification | Result |
| --- | --- |
| Full remote units on final runtime | **1,867 passed /345 files**, nine skipped tests /one file. [Final runtime receipt](evidence/units-headwear-final.log.txt); optional FFmpeg/Linux lock exclusions are described below. |
| E07 final | **PASS**, typecheck/lint/build, **377 Node +5 isolated timings +102 functional browsers +5 quiet tests**. [Full receipt](evidence/verify-E07-final.log.txt), [stage exits](evidence/verify-E07-final-checks.json), lossless stage JSONs. |
| E27 final | **PASS**, typecheck/lint/build, **46 Node +41 functional browsers +2 quiet performance tests**. [Receipt](evidence/verify-E27-headwear-final.log.txt), [stage exits](evidence/verify-E27-headwear-final-checks.json); cold-blast p95 **8.7/13.5 ms**, max **13.7/29.8 ms**, sim p95 **0.6/2.0 ms**. |
| E28 previous accepted runtime; final refresh pending | **PASS**, typecheck/lint/build, **28 Node +71 functional browsers +6 quiet performance tests**. [Receipt](evidence/verify-E28-final.log.txt), [stage exits](evidence/verify-E28-final-checks.json), lossless result JSONs. |

The Alpha contact fixture was corrected to separate a courier-provoked Alpha from the unprovoked soldier-contact check; all original HP/knockdown/cooldown expectations stay. The hero-shadow fixture now submits 90 individual fixed-tick views and requires promotion blend 1 before sampling the unchanged shadow gate. The repeat move probe preserves authored radius (including 18 m Alpha roar) instead of passing a generic one-metre area. The merged Alpha scene now stages the retained throw body before the legal slam-recovery boundary, and records all four original special activations plus the three actual 30/25/30 HP hits. A later protected zero-damage slam remains in its complete journal. The authored elephant scene also contains a sedan in the charge corridor: the failed browser receipt records a broken 400 HP barricade and one 80 HP chassis hit, followed by no courier hit. The courier-impact probe now clears that vehicle; a separate admitted-chassis probe retains it and checks the barricade, impulse, single car hit and protected courier. These are fixture corrections, not runtime difficulty changes. [Original elephant receipt](evidence/elephant-charge-failure.json.gz).

## All 14 move warning, restore and cooldown review — E07-AC05/06/19

Opened both seven-move timing sheets and every full-size boundary overview, including the recaptured complete **18 m Alpha /20 m gorilla roar** rings. [Alpha/lion/roar sheet](moves-a-1.jpg), [gorilla/elephant/zebra/flamingo sheet](moves-b-1.jpg), [14 state journals and 168 input image hashes](evidence/move-boundaries.json.gz). No warning image is graded or corrected. The wider camera is only an additional unchanged-tick inspection; every move also retains its authored gameplay view.

The Alpha slam and gorilla pound are complete ground circles; the two roars are much larger complete rings. Charge/pounce/throw/flank warnings are directional corridors with chevrons; the lion flank points laterally away from the courier. The elephant charge shows its entire broad corridor, barricade and sedan; its swipe is a forward arc, while the zebra kick is a rear arc. All three actual zebras and their complete overlapping herd corridors fit; the flamingo flock has a distinct circular dive target. These observations concern warning visibility and framing; the literal stampede collision-width failure below is not signed off.

For **every move**, the receipt checks the last warning tick, activation on the next exact sim tick, no premature activation, matching source/move/attack identity, and disappearance at activation. A real mission checkpoint restores the locked target/area with one tick remaining and an opaque visible warning; restored activation occurs exactly one tick later. A second checkpoint restores remaining cooldown after seven elapsed ticks. Starting one tick too early is rejected; the next legal windup preserves the authored radius and its activation occurs at the rebased cooldown expiry, with elapsed ticks minus those seven restored ticks equal to the unchanged authored cooldown. Both the restored windup and repeated warning are visible while paused. The full-size restored elephant swipe contains only its proper arc, matching its single state marker.

The separately corrected obstacle probe passes alongside the original clear-lane impact expectation: **sedan 300→220 HP**, one 80 HP charge hit, ≥1 m actual chassis displacement, broken 400 HP barricade and courier **100 HP** behind the stopped charge. [Four focused checks](evidence/elephant-roar-final.log.txt), [actual chassis/state journal](evidence/elephant-chassis-final.json.gz). The complete verifier passes all 102 functional cases, including these probes, but fails the separate quiet crowd object-count assertion described below.

## Spatial controls and shared bars — E07-AC05/06/19

[Spatial before/after and solid-cover sheet](spatial.jpg), [complete actor/HP/event receipts](evidence/spatial.json.gz). Opened both seven-move halves at readable size. **28 controls pass; the literal zebra corridor control fails** as detailed below. Every pre-activation receipt asserts `inspectionGhost: false` and `god: false`. These are real Scene Lab actors, manual legal attacks and solid privacy fences, with no altered attack timers or damage.

| Move | Boundary outcome (HP) / scope |
| --- | --- |
| Alpha charge / grab-throw | Inside 100→70; outside 100→100 for each. |
| Alpha ground slam | 4 m inner/outer control: 100→75 / 100→100. |
| Alpha / gorilla roar | Radius−0.01 m receives the roar; radius+0.01 m does not. The covered target hears it, as expected for sound rather than a damaging projectile. Far radius controls are recorded numerically; they do not fit the close image. |
| Lion pounce / flank | Pounce hits 100→70 at 6 m; 20 m control remains 100 and the lunge stops within 8.001 m. Flank moves laterally >2 m without direct damage. |
| Gorilla pound / grab-throw | Inside 100→70; outside 100→100 for each. |
| Elephant charge / swipe | Charge 100→60 / outside 100; swipe 100→75 / outside 100, including the rear/arc control. |
| Zebra kick | Rear inner control 100→80; outside and front controls remain 100. |
| Zebra stampede | Two zebras each hit once: inside 100→50, nominally outside **100→50**. Literal corridor check fails; separate 0.88 m physical-contact control is untouched. |
| Flamingo dive | Inside 100→95; outside 100→100. |

Solid-cover cases pass for all damaging moves; the courier remains untouched behind the fence. The sheets show empty ground warnings before impact, inside knockdowns after the charge/swipe/kick, and the protected courier still standing behind cover. Long charge/stampede cue tails and distant roar targets extend beyond this close camera; the separate per-move timing captures cover full cue framing.

The **12-case shared-bar matrix passes**: WebGL2/WebGPU × day/night × 1600×900 high, 390×844 low and 844×390 low. [Receipt](evidence/bar-matrix.log.txt), [opened matrix](bars.jpg), [pixel/state readings](evidence/bars.json.gz). Minimum sampled pairwise fill/empty/outline contrast is **3.086:1**. Actual HP updates within one redraw; dimensions are **64×8 / 48×6**; camera anchors stay within two CSS pixels. Pristine bars stop just beyond 15 m, damaged bars remain, off-frustum/dead-by-explosion bars disappear, and same-id infection gains eligibility. Recoverable downing has an empty bar and recovery restores it. Separate occlusion and zoo scenes reset their own authored daytime lighting; the matrix's night label applies to the initial shared-bar scene, not those later fixtures.

Opened the full-size WebGPU night phone frame: the pale outline, red fill and dark empty section remain crisp above the infected, with a visible gap to its head; the healthy civilian has no bar. In the occlusion pair the building hides both the infected and bar; the rotated camera reveals both. The zoo frame shows separate lion/gorilla/flamingo bars with half fill. The dedicated actual-Alpha probes now pass at 1600×900 high and 390×844 /844×390 low: actual HP **300→240**, fill **1→0.8**, dimensions **64×8 /48×6**. Opened every damaged Alpha frame and both zoo landscape frames, alongside the earlier portrait zoo review. The complete bar remains visible even where the portrait crops part of the Alpha at the screen edge. Elephant **900/1200** and zebra three-quarter bars remain crisp above their models; the flamingos have separate full bars. [Actual archetype proofs and 58 input image hashes](evidence/phone-bars-final.json.gz). All ten actual Alpha/zoo before/after images from the final 102-pass functional run are byte-identical to the opened captures ([repeat hashes](evidence/phone-bar-repeat.json)).

## Named Checklist D review — E07-AC13

Reviewed the **24** named golden-hour `horde-readability` images: 60 runners, both WebGL2/WebGPU, high/low, real zoom **0.5 / 1 / 1.5**, with a second frame adding Brute/runner warnings. [Matrix](d-horde.jpg), [current state receipts](evidence/headwear-final-vision.json.gz), [24 image hashes](evidence/D-final-images.json). The capture runner records actual backend/tier and asserts 60 infected before warning additions plus actual camera zoom; the [state audit](evidence/D-backend-tier-validation.json) confirms every backend/tier and the 60/62 actor counts; it scales the named camera pose rather than relabeling one fixed view.

| D item | Observed result across all twelve configurations |
| --- | --- |
| Player identifiable within one second | **Pass:** red sleeves, teal backpack, ponytail and separated foreground stance locate the courier immediately at every zoom. |
| Infected/background separation and glowing eyes | **Pass:** pale hands/faces and red eye pairs remain visible against the purple road; rear silhouettes overlap as a crowd, without losing the leading threats. |
| Distinct warning shapes | **Pass:** the runner corridor and Brute ground area remain separate red outlines in the foreground; close zoom makes their distinct outlines particularly clear. |
| Pickups distinguishable from clutter | **Pass:** the bat and grenade have yellow ground rings; the nearby bin, car and bench do not. |
| VFX preserve player/warnings | **Pass for this named spot:** window/streetlight bloom remains local; neither the courier nor warning outlines disappear under it. |

## Final-source named H review — 2026-10-22

This review supersedes the earlier incomplete physical-consequence signoff. I opened both final seven-row high/low frame sheets, plus full-size medium/mega flight, night wind column and the two late grenade frames. `docs/reports/ac-close-shared/h-high.jpg` and `h-low.jpg` retain all seven required spots; `evidence/headwear-final-H.json.gz` records the refreshed 102 frame states and source-image SHA256s; [selected sheet inputs](evidence/H-final-images.json) identify all seven rows. Grenade frames use a pinned production preview after the earlier dev blank frame failed review; both tiers now pass an explicit non-flat-image assertion. A concurrent source edit is only a possible cause of the old blank, not a proved diagnosis.

| Priority | H item | Observed result |
| --- | --- | --- |
| must | Staged blast | PASS — medium f6/8/12/21/46, car f186/190/200/230 and mega f6/20/40/70 separate flash, yellow-orange lobes, expanding pale ring, flying fragments and dark plume. Production L4 f6/40/186 repeats the authored sequence. |
| must | Props / corpses / cars move; scorch stays | PASS — cart/cone displace, car lifts and panels fly; retained body id6 rises to y1.56 in medium and y10.72 in mega, then lands with its original id. Car body id7 rises to y1.47 and lands at (3.82,0.7,3.87); medium late position stays (1.95,0.7,3.90). Late black scorch and burning wreck remain. Cosmetic body flight is now implemented and checkpoint-tested; no combat collider/damage or corpse removal was added. |
| must | Volumetric noisy hot-to-cold fireball | PASS — overlapping lobes have yellow hot centers, orange folded rims, holes and dark cool clouds; mega has a much broader ring and scattered persistent fires. |
| must | Lit / wind-bent smoke; visible player | PASS — night house-front fire and separate column have rounded overlapping puffs drifting right; orange lower smoke/cooler top is quantified at 2.62× luminance. Actual thrown grenade cloud keeps the cap, face and orange clothing visible at f90/240/840, with the ground marker visible through the dither. At f840 the smoke has not fully expired; no fade-to-clear claim is made for that frame. |
| should | Car jump / detached parts / burning wreck | PASS — raised body, separate dark panels and persistent charred burning chassis appear in order. |
| should | Flicker / embers / nearby lighting | PASS — night flames change shape at f60/90/180/600; sparks rise and warm pools light the pavement and porch/facade. |
| should | Class intensity | PASS — grenade is a localized cool gray cloud; medium/car affect a few metres; mega lights a wide area, throws the corpse higher/farther, and leaves multiple fires. |

**AC15 met: 4/4 must and 3/3 should**, across medium/car/mega lab, night house-front building fire, actual smoke grenade, persistent wind column and production L4 `l4-collapse`. The house fire is a real fire hazard against the porch/facade, not a claim of a newly destroyed house mesh. Focused smoke/player regressions pass unchanged thresholds; full final E27 verification passes: 46 Node, 41 functional browser and two quiet performance tests.

## Final-source Checklist G review — 2026-10-22

This review supersedes the earlier AC12 failure above. I opened the fresh **24 six-mood frames** (WebGL2/WebGPU × high/low), the full-size storm and facade frames, and the settled hero-shadow frame. Retained matrix: `docs/reports/ac-close-shared/g-moods.jpg`. References opened: `initial-drafts/weather-and-time-of-day-moods.png` and `initial-drafts/explosions-fire-smoke-and-lighting-fx.png`; `06` §7 permits these interim references while dedicated lighting keyframes are absent.

| Priority | G item | Observed result |
| --- | --- | --- |
| must | Emissive glow and visible pools/spill | PASS — yellow windows, headlamps and streetlamp bloom; orange pools brighten nearby pavement and facade. |
| must | Geometry / hero shadows | PASS — wall-facing window spill remains on the outside pavement; settled lamp casts separate courier, infected and prop shadows. The unchanged hero probe measures 85.88% darkening after promotion blend reaches 1. |
| must | Colored, appropriate shadows | PASS — blue/purple shadows, long and crisp in haze, broader and subdued under overcast; hero shadow hue 254.7°, no black cutout. |
| must | Night readability | PASS — courier cap, orange clothing and limbs remain distinct; gray/green infected silhouette and limbs separate from the dark blue street in storm, fog and snow. Dense-fog player contrast is 3.0349:1 over the unchanged 7,585-pixel mask. |
| should | Beams / haze / glints | PASS — amber shafts cross the haze scene and window spill lights the storm haze; fog softens the distance without hiding the courier. The lightning frame is bright but characters and house remain legible. |
| should | Reflections | PASS — storm pavement carries irregular, broken warm highlights under windows and lamp, with dark gaps; car paint/glass retain specular separation. Dry clear/overcast pavement has no wet streaks. |
| should | Script mood | PASS — clear is cool and crisp; overcast softer/dimmer; haze amber with long purple shadows; storm dark blue with rain/warm practicals; fog blue with softened distance; snow cold night with flakes and gray coated upper surfaces. |

**AC12 met: 4/4 must and 3/3 should.** All six moods are checked against the authorized reference, across both tiers/backends. These fixed scene reviews do not substitute for native storm/L5 performance evidence. Final E28 verifier passes all 28 selected Node, 71 functional browser and six quiet performance tests. The original heap-counter discrepancy remains partial under AC10.

## Quiet memory comparison (diagnostic viewport)

Both builds ran through `quiet-run.sh` with all browser slots held, load <3 and no other headless browser/local Vitest. The fixed **960×600** diagnostic scene uses the same storm, seed 28, 3,600 ticks, camera and three completed-frame collections on each build. It is **not substituted for the native desktop/phone acceptance fixture**. [Before](evidence/heap-before.json), [memory candidate](evidence/heap-memory.json), [build identities](evidence/memory-builds.json), [quiet receipts](evidence/heap-before.log.txt) / [candidate](evidence/heap-memory.log.txt).

| Counter (high / low) | Before | Memory candidate |
| --- | --- | --- |
| Collected CDP JS heap, decimal MB | 114.45 / 113.95 | 114.43 / 113.92 |
| Collected backing stores, decimal MB | 406.70 / 395.93 | 385.76 / 373.35 |
| Legacy `performance.memory`, MiB | 497.33 / 486.58 | 477.36 / 465.02 |
| Live scene geometry arrays, decimal MB | 37.60 / 28.20 | 32.66 / 21.65 |

The real backing-store reduction is **20.94 / 22.58 MB**; it is not presented as hundreds of MB of JS-heap savings. The opened [before/after sheet](heap-pixels.jpg) has matching bodies, rain and pavement. Exact unmasked RGB comparison is **zero changed pixels on both tiers**, at the same 960×600 size ([counts](evidence/heap-pixels.json), [remote receipt](evidence/corpse-audit2.log.txt)). The intermediate transfer attempt omitted ignored inputs; its failure is retained and replaced by the successful staged-input comparison. The memory-only build predates the wet-glint shader change. The legacy counter remains high in this diagnostic; native acceptance readings are below; the measurement-contract decision remains open.

## Native storm and actual L5 peak ash

| Native Metal workload (high / low) | Measurements |
| --- | --- |
| Fully wet storm, 20,000 /6,000 particles | Frame p95 **5.8 /7.3 ms**, max **9.2 /10.1 ms**; sim p95 **0.300 /0.800 ms**; collected JS heap **116.68 /116.11 MB**. Native Apple M4; low 390×844, DPR1.5, 4× CPU throttle. Draw/triangle/particle gates pass. |
| Original storm `perf.heapBytes` counter | **508.07 /564.94 MiB**, still over 400/250; measured before explicit collection. Collected backing stores **385.57 /373.16 decimal MB** are retained separately. Green collected-JS tests do not close this original comparison. |
| L5 pair-plaza, peak authored ash flakes0.35 | **1,750 /525 particles**; five followers, 13 fires, 37 corpses, 27/18 infected. Ash0.35 persists through the later fog transition in `src/data/weather.ts`; no synthetic extra load replaces actual L5. |
| L5 frame / memory / scene gates | High p95/max **8.4 /13.3 ms**; phone p50/p95/max **19.2 /34.7 /47.5 ms** at 4× CPU throttle. Collected JS heap **129.54 /113.98 MB**. Draw/triangle and +20% L4 baseline gates pass; >10 m ordinary walk stays in L5. Existing low gate is p50≤33.3 ms/max≤80 ms; no phone p95≤33.3 claim. |

[Storm native high](evidence/storm-native-final-high.json.gz), [low](evidence/storm-native-final-low.json.gz), [L5 high](evidence/l5-final-high.json.gz), [low](evidence/l5-final-low.json.gz), [opened actual ash images](l5-ash.jpg). I opened both full L5 pair-plaza images: gray ash falls over the burned plaza, scattered bodies/wrecks and fires remain, and the five-person group is clustered around the courier. These are performance/fixture observations, not a new L5 lighting acceptance claim.

## Proposed clarification for E28-AC10 — not adopted

“Use the E18 **JS heap** budget of 400/250 decimal MB, measured as CDP `Runtime.getHeapUsage.usedSize` after pausing, retiring completed-frame temporaries and three explicit collections. Record backing storage and legacy `performance.memory` separately, with units, before/after runtime identity, viewport and workload. Keep frame, sim, particle, draw and triangle gates unchanged.”

Reason: the **pre-existing** verifier gates collected CDP JS heap, while the sweep compares legacy `perf.heapBytes` in MiB. These materially different counters disagree. This lane changed neither the collection helper nor either threshold; it demonstrated a real buffer reduction, but the original counter **still fails**. This proposal resolves the inconsistent measurement contract only if the user accepts it; further optimization of the original counter is not asserted impossible. **AC10 stays partial / E28 in-progress.**

## Earlier failures and evidence history

- Baseline E27 verify: 37 Node /39 browser pass, two smoke failures, stopped before perf. [Original run](evidence/verify-E27.log.txt), [stage receipt](evidence/verify-E27-checks.json).
- Baseline E28 verify: 26 Node /69 browser pass, one fog contrast failure, stopped before perf. [Original run](evidence/verify-E28-before.log.txt), [stage receipt](evidence/verify-E28-before-checks.json).
- First E07 verify: five isolated timings /372 selected Node pass; provoked Alpha contact fixture fails before browsers. [Run](evidence/verify-E07-first.log.txt), [actual target audit](evidence/alpha-contact-before.json.gz).
- The next E07 attempt passed 373 Node tests and five isolated timings, then found the merged-scene fixture failure. Its owned guardian was stopped (exit143) after the red result; remaining browser/perf coverage was unmeasured. [Interrupted run](evidence/verify-E07-merged-failure.log.txt), [stages](evidence/verify-E07-merged-failure-checks.json). The complete verifier restarts after the fixture repair.
- The subsequent complete E07 functional run passed **100 cases /one elephant fixture failure** and stopped before quiet performance. Its trace records the real parked sedan contact; the replacement preserves clear-lane courier impact and adds the admitted-chassis branch. [Full failed run](evidence/verify-E07-elephant-failure.log.txt), [stage exits](evidence/verify-E07-elephant-failure-checks.json), [original browser error](evidence/elephant-charge-failure.md), [four focused replacements](evidence/elephant-roar-final.log.txt). The initially cropped roar overviews were rejected during image review; [pre-framing state/image hashes](evidence/move-boundaries-before-framing.json.gz) remain historical, not accepted full-boundary proof.
- Intermediate failed transfer/fixture/static receipts remain in `evidence/`; successful replacements are identified above. The interrupted E28 remote build unnecessarily reserved browser capacity; remote builds now use no GPU slot and their pull completes before browser stages. [Interrupted receipt](evidence/verify-E28-build-wait.log.txt).
- The original high grenade f840 blank failed review; pinned production repeats pass both tiers with non-flat-image assertions. No proved HMR cause is claimed. [Repeat](evidence/grenade-final.log.txt).

Retained media limit: **12 contact/comparison images** in this directory. Source frame hashes, numeric states, command exits and lossless result JSONs live under `evidence/`; raw transient captures are removed after final review. No baseline worktree was created; the one temporary baseline build was removed. Canonical per-epic `review.md`/`report.md` record the same disposition.


### Proposed rewrite for E07-AC19: zebra stampede corridor

The epic's move row says **1.5 m-wide sweep**, while the current physical-contact rule also hits a human whose centre is **0.76 m** from the lane centre. A fresh remote audit records **100→50 HP** from two distinct zebras at that nominally outside point; the **0.88 m** control remains at **100 HP**. The probe explicitly records `literalCorridorControlPass: false`. [Audit receipt](evidence/corridor-audit.log.txt), [actual positions and hit events](evidence/zebra-corridor.json).

The existing `zoo-s3.test.ts` comment, introduced by **2e4df83867** on 2026-10-15, calls this a PO contact-hit decision: **0.45 m zebra radius + 0.35 m human radius + 0.02 m contact tolerance = 0.82 m**. That comment is secondary provenance; it is not represented as a recovered verbatim PO request. The current test already places its outside control at 0.88 m. This lane changes neither that test nor the contact behavior.

**Proposed wording, awaiting the user's decision:** “The stampede marks a nominal 1.5 m-wide corridor. Ordinary body contact additionally uses the sum of the zebra and human capsule radii plus 0.02 m contact tolerance (0.82 m in the standard human fixture). Each distinct zebra/attack id deals 25 HP once; a target beyond both the marked corridor and that contact boundary is unaffected.”

Reason: this reconciles the nominal ground cue with the established physical-contact behavior. Narrowing collision to the centre corridor would change the current combat behavior, contrary to this task's no-difficulty-change constraint. The literal corridor criterion is **not marked met** by a green existing test.

## Historical E07-AC12 object-count failure — resolved below

The final verifier passes all 102 functional browser cases, then quiet T-E07-12 fails before its offscreen/settled/mixed checks: **185 objects versus 138 reported batch entries +3 fixed objects =141**. The other four quiet checks pass. [Failure context](evidence/horde-object-failure.md), [decoded state](evidence/horde-object-failure.json.gz). This run supplies no fresh passing offscreen/settled/mixed proof.

Source inspection finds `StaticCorpses.prepare()` deliberately creates zero-count instanced pages for shader warm-up; the existing unit `L6 prewarmed corpse pages stay empty until a real body joins` requires one such child and zero draws. `CrowdView.getState()` counts these descendants, while the assertion assumes an empty corpse group. Forty-four such pages could explain the difference, and a live ownership audit now confirms exactly those 44 pages, each a zero-count InstancedMesh with capacity 128, with zero unowned objects. No assertion, counter or runtime has been changed to suppress the failure. Browser work resumed after the orchestrator's 01:35 UTC boundary; the launcher receipt records release at 01:35:00.008 UTC.

The existing prewarm unit suite passes **21/21** remotely ([receipt](evidence/corpse-prewarm-final.log.txt)). The read-only [ownership audit](../../../tools/qa/horde-object-audit.ts) passes remote typecheck/lint ([receipt](evidence/object-audit-static.log.txt)); it leaves the failing verifier unchanged and checks all owned batch/reservation/fixed/corpse nodes, original draw bounds, offscreen culling, retained deaths, empty reset and mixed archetypes. Its browser admission is held outside the browser lock until 01:35 UTC.

The final failure trace frame was opened without a new browser: a dense varied crowd is rendered on the arena grid; it is not later-stage proof ([frame hash/review](evidence/horde-failure-frame.json)). [Git provenance](evidence/horde-object-provenance.json) dates the fixed-count assertion to 10-16 and general corpse prewarming to 10-19, both before this task base. The final [remote evidence-integrity audit](evidence/evidence-audit-repeat.log.txt) passes; two retained audit-only failures came from assuming Git history exists in remote snapshots and confusing 154 tick records with 168 capture hashes. Neither was a product/test failure.

### Fresh ownership audit and mixed-budget defect

[Read-only four-stage state](evidence/horde-object-audit-before.json.gz) proves live runner **14 draws**, offscreen exclusion, zero per-infected/unowned nodes, retained **200** settled corpses and a reset draw delta of **29**. All 44 extra live/reset nodes are empty 128-instance corpse pages. The first diagnostic mistook `isInstancedMesh=false` (the existing static-attribute shader path) for a non-instanced object; its correction uses the same actual class as the original counter, plus capacity/ownership checks. [Diagnostic flag failure](evidence/object-audit-browser-flag-failure.log.txt).

The corrected diagnostic reaches a **real mixed-budget failure: 30 nonempty model batches +1 shadow =31 crowd draws** against the unchanged 30 cap ([receipt](evidence/object-audit-browser-mixed-failure.log.txt)). All nodes are owned; the literal no-per-infected-Object3D requirement passes. The 200 weighted AI units include two crow flocks with 40 rendered birds. The original verifier and diagnostic thresholds are unchanged. A geometry audit is investigating compatible dog-coat batching; no runtime change has yet been made for this failure.

### Historical dog palette batching repair — final result below

Runtime commit `9e5c4b0b1` shares the default/cream dog **LOD1** draw only after exact positions, normals, part ownership, index order and clip matrices match. Authored cream vertex colors remain a separate immutable palette attribute. The actual-asset regression rejects incompatible LOD2 geometry, whose palette-sensitive simplification changes surfaces; no LOD2 equivalence is claimed. Dense high-tier crowds retain both coats using the more detailed shared LOD1 surface. Low tier shares only actors already selected for LOD1, preserving its near-detail cap. Corpses retain their original separate source meshes/materials. No actors, HP, attacks, RNG, thresholds or visible coat identities are removed.

The exact object assertion now includes the independently exposed managed corpse-page count; it still accounts for every descendant rather than subtracting objects from the measured counter. The live/reset ownership audit independently enumerates batch/reservation/fixed/page nodes and finds no orphan. The 30-draw limit and fixed mixed-scene object equality remain unchanged. Remote typecheck/lint and **22 focused tests** passed before the final low-tier guard ([receipt](evidence/dog-coat-batching-remote.log.txt)); final full units, build, visual comparison and three epic verifiers are being repeated on the committed repair. [Geometry audit](evidence/dog-coat-geometry.json), [saved pre-repair production identity](evidence/dog-before-build.json).

## Final batching repair and refreshed visual proof — `df390443a`

The old fixed object formula omitted 44 deliberate empty corpse pages. The exact formula now includes managed pages while leaving the reported object count intact. A subsequent audit exposed a real 31-body-draw mixed case; compatible default/cream dog LOD1 palettes now share one draw, preserving every actor and coat. Profiling then exposed three separate distant headwear draws. Those now use their exact fitted geometry and palette selection inside the existing LOD2 body/pose batch, with per-vertex masks preserving their original lighting, shadow reception, side culling and hit-flash behavior. Original corpse source geometry remains separate. The public crowd counter now **includes** separate infected headwear draws. No threshold, damage, timer, population limit or difficulty changed.

The independent [final ownership/profile audit](evidence/horde-object-audit-final.json.gz) passes: live runner **14 body +3 accessory =17 draws**; mixed **30 +0 =30 draws**, matching the actual renderer categories. Every stage has zero unowned nodes; primary live/reset graphs have 185 descendants including 44 empty 128-instance corpse pages, and the separate accessory graph has **24 fixed owned instanced nodes**. Offscreen exclusion, retained 200 corpses, reset draw delta **17**, and mixed object equality pass. [Receipt](evidence/headwear-object-ownership-final.log.txt).

D remains **5/5** after opening the refreshed 24-frame matrix and full-size WebGPU/high close, WebGL2/low wide-warning, WebGL2/high normal and WebGPU/low warning samples. The courier's red/teal silhouette, pale faces/red eyes, separate warning outlines and yellow pickup rings remain readable. The 12 high-tier before/after frames differ by at most **351 /1,440,000 RGB pixels**, with maximum per-channel mean absolute difference **0.00018125 /255** ([comparison](evidence/headwear-high-rgb.json)). The saved palette-only dog comparison has **zero changed RGB pixels**, all three coats and complete paws framed ([proof](evidence/dog-coats-final.json.gz)); its visual isolation is explicitly recorded and supplies no performance claim.

H remains **4/4 must +3/3 should** after opening both refreshed seven-row sheets and full-size medium/mega flight, wind column, L4 chain and both late grenade frames. All six body peak/landing records match the previous receipt. The L4 fuel-truck sequencer emits its pump/canopy/tank stages at ticks **188/202/222** (offsets **0/14/34**); the sheet now selects early frames **0/2/6/15/40/120**, then 300/900 aftermath, rather than omitting the active mega window. The full-size f40 frame shows the orange/black mega fireball behind the street roofs; no building-collapse geometry claim is made. The grenade f840 frames retain courier, ring and dithered smoke on both tiers.

Remote validation on the committed runtime: typecheck/lint, **27 focused render tests +build** ([receipt](evidence/headwear-inline-focused.log.txt)), then **1,867 full unit passes /345 files, nine skipped tests /one file** ([receipt](evidence/units-headwear-final.log.txt)). Seven skips are the pre-existing Linux/macOS lock exclusions; two optional FFmpeg loudness checks skipped on this runner, with those audio sources unchanged. The final E07/E27 verifiers are green; E28 is refreshing as recorded in the verification table. The earlier dog-only verifier was cancelled through its owned remote launcher before browser admission when the broader headwear defect was found ([receipt](evidence/verify-E07-dog-superseded.log.txt), [stage exits](evidence/verify-E07-dog-superseded-checks.json)); it is not a passing verifier.

All **168** move images from the final functional run are byte-identical to the fully reviewed set ([repeat hashes](evidence/move-final-repeat.json)); the fresh move journals are retained in `move-boundaries.json.gz`. All **ten** actual Alpha/zoo images are also byte-identical ([current runtime repeat](evidence/phone-bar-runtime-repeat.json)). This preserves the prior full-boundary/phone visual review on the final runtime, alongside the repeated gameplay/pixel assertions.

**Final E07 verifier passes on `df390443a`: 377 selected Node tests, five isolated timings, 102 functional browser cases and five quiet native cases, with no browser skips, unexpected results or flaky retries.** The quiet T-E07-12 now verifies the exact object formula, combined body/headwear 30-draw cap, offscreen exclusion, retained 200 corpses, reset and mixed equality. The literal stampede corridor is still partial and its proposal remains unadopted.

**Final E27 verifier passes on `df390443a`: 46 selected Node tests, 41 functional browser cases and two quiet native cases.** High/low cold-blast p95 **8.7/13.5 ms**, max **13.7/29.8 ms**, sim p95 **0.6/2.0 ms**; zero recorded spikes. Refreshed seven-spot H remains 4/4 must +3/3 should. [Stage exits](evidence/verify-E27-headwear-final-checks.json), [high stress](evidence/E27-headwear-final-perf-high.json.gz), [low stress](evidence/E27-headwear-final-perf-low.json.gz).
