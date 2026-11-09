# qa-browser2 — final browser QA verdicts

**Overall acceptance: FAIL.** 2026-11-09 review within the three-hour timebox of the17requested merged lanes on baseline`8622b6d1`, with two small fixes. L10 completes on current source in all four quality/backend cells, but its finale has major framing/density defects. L8 cannot start. L9's bridge camera and APC cab, L4's canvas, L5's shutter composition and L7's departure framing also fail visual review.

This completes the requested QA/report task; it does **not** certify all game acceptance criteria. **PASS means only the stated observed sample. FAIL (defect) is reproduced; FAIL (blocked/unverified) means acceptance was not established, not that an untested feature is proven broken.** [Detailed request-by-request ledger](handoff-verdicts.md), [extracted handoffs](handoffs.json).

## Method / evidence

- One pooled headless GPU browser at a time, reservations≤600s, private port4351. Actual Metal WebGL2 and actual WebGPU backend checked. Low/high, game zoom1/1.5; L4 also0.5. WebGPU observations are automated visual inspections, not a claim of a separate human manual session.
- Mortal production bots cover actual mission flow; accelerated stepping is explicitly excluded from live timing/audio approval. Natural ending replays use physical Pause/Resume/Skip. Protected/teleported/forced-action or normalized-damage fixtures are labelled in each receipt and never used to certify mission difficulty.
- Personally inspected selected full screenshots, labelled review montages and every final contact sheet. Each level retains **one small JPEG sheet**, exact cell metadata, source screenshot hashes and compressed run receipts. Only selected frames were reviewed; producing a screenshot is not visual approval. Raw screenshots, temporary review sheets and failure traces were deleted after selection.
- Native HUD behavior is preserved in current route harness. `route-v1.ts` forced HUD visibility and is retained only as provenance; it cannot certify cinematic HUD hiding. Requested zoom metadata is separate from actual authored/inspection camera state.
- Receipts identify revision/source tree, producer hash and any working source diff where captured. Old before-fix failures, invalid mouse-scheme low ramp tests, failed L7 fixtures and pre-correction crash-harness exceptions remain explicitly archived. `driver` in old route snapshots is the bot object, not vehicle occupancy. Final handover photographs are excluded when the renderer has already loaded the next level.

## Per-level questions

| Level | Glitches / acceptance verdict | Is it stunning? | Evidence |
| --- | --- | --- | --- |
| L3 | Sampled glass/collapse/burn/wreck, ramp joints and checkpoint PASS. Dense body piles lose silhouettes; full budget/restoration coverage unverified. | **No overall:** coherent warm street, needs crowd readability. | [Review](L3.md), [sheet](L3-contact.jpg), [cells](L3-contact.json) |
| L4 | Geometry/camera/radio sampled PASS. **FAIL shiny metallic-looking canvas**; late hold becomes a heap. Tank entrance/hold sampled PASS. | **No:** material and late-wave composition need work. | [Review](L4.md), [sheet](L4-contact.jpg), [cells](L4-contact.json) |
| L5 | Five rescued and transfer PASS; **FAIL shutter/entry composition**, overlapping silhouettes. Newer no-search-ring rule sampled PASS at low bus approach. | **No:** readable bodies/spacing and doorway framing needed. | [Review](L5.md), [sheet](L5-contact.jpg), [cells](L5-contact.json) |
| L6 |27/29/2result counts, real stair/floor separation sampled PASS. Bot waits/dies on stairs then completes retry; not a proven soft-lock. | **No overall:** ordered procession and intense stair pattern dominate. | [Review](L6.md), [sheet](L6-contact.jpg), [cells](L6-contact.json) |
| L7 | Departure reached, then L8 load blocked. **FAIL dark wreck and bottom-cropped departing bus**. High policy loses all24followers. | **No:** truck lighting, group clarity and departure framing needed. | [Review](L7.md), [sheet](L7-contact.jpg), [cells](L7-contact.json) |
| L8 | **FAIL blocked:** all four cells fail before Begin. Tour/breach/arenas/departure unavailable. | **Cannot assess:** no playable zoo image renders. | [Review](L8.md), [sheet](L8-contact.jpg), [cells](L8-contact.json) |
| L9 | Actual completion/ramps/tanker/fire sampled PASS. **FAIL cab/glazing pose and impact/crawl framing**. | **No:** good individual set pieces, central sequence obstructed. | [Review](L9.md), [sheet](L9-contact.jpg), [cells](L9-contact.json) |
| L10 | Four complete routes, finds/flame/platform/controls sampled PASS. **FAIL farm/hangar/ending/barn lettering/geometry**. | **No overall:** sparse route and finale staging prevent a coherent payoff. | [Review](L10.md), [sheet](L10-contact.jpg), [cells](L10-contact.json) |

## L8 loading blocker

All four requested startup attempts fail at tick0, before Begin. Low GL/GPU: `amb.monkey is required for the skinned crowd`; required `.low.glb` paths are missing although normal GLBs exist. High GL/GPU: `Crowd semantic owner must be a weighted joint`.

A passive in-page diagnostic that logs then rethrows the unchanged exception localizes the high error to **`healthy.monkey`, `amb.monkey`, LOD2** (five repeated failures). [Diagnostic](L8-diagnostic.json), [producer](l8-diagnostic.ts). Generic SceneLab/gate low loading also fails on`inf.lioness`; monkey repair alone is not proven sufficient. Actual L7→L8 automatic handover reproduces the loader failures.

Consequently Nadia tour, pond breach, K9/keeper/flamingo continuity, all six arenas, monkey roof leader, pillar/elephant/throw interactions, Hale keys/cab/gates/whole-group escape, audio, skip/retry and actual L8→L9 continuity are **FAIL (blocked)**. Separate non-zoo fixtures do not accept those story sequences.

## Reproduced failures / exact repro

Positions below are`(x,z)`; ticks are simulation ticks unless explicitly local replay. “All4” means low/high × WebGL2/WebGPU. Cell metadata contains full camera/state details.

| Failure | Exact repro | Retained evidence |
| --- | --- | --- |
| L10 optional-find checkpoint crash — **fixed** | LowGL tick3008 near`(740.066,22.476)`; retained farm pickup lacked campaign ownership/rack sync. | [Before](L10-pickup-save-before.json.gz), fix`bfd998ff` |
| L10 mounted usage checkpoint crash — **fixed** | LowGL tick54082 near`(3989.228,-32.888)`,y3.78; known mounted usage rejected as unowned carried action. | [Before](L10-minigun-save-before.json.gz), fix`bfd998ff` |
| Destruction stale Rapier body — **fixed** | L9/L10 rollout after chunk unload/reload, normalized prop damage/queued kick; cached body no longer owned by live physics world. | [Before/after regression gate](E31-checks.json), fix`016ea78f` |
| L10 sparse farm | PO`(858.66,-93.68)`, posed tick1; actual route1250–1750/3050–3650. All4,z1/1.5. | L10cells1/5/9/13 |
| L10 hangar roof hides scene | Low31632/high31884 near`(2699.5,65.5)`,all4,z1.5. Earlier intro31416/31644 near`(2705.5,58.7)`also occluded; z1control reads. | L10cells2/6/10/14,control17 |
| L10 barn grave presentation | Intact roof, posed ticks60–180 at`(944,-26)/(942,-28)/(946,-24)`,all4,z1/1.5; crosses hidden. | L10cell26; all4POreceipts |
| L10 stale roof lettering after collapse | Normalized collapse tick4326,`(951,-19)`,all4,z1/1.5; HELPtext floats above foundation. Crosses now visible. | L10cells4/8/12/16 |
| L10 isolated tableaux / closing cast | Natural/actual ending; carried replay59952`(4004.2,-28.6)`clumped bodies; default59838`(4013.3,-27.1)`floor/console crop. | L10cell46 and ending receipts |
| L10 panorama blank blue fog | All4,ending-playable11; natural desktop local3493/3801,elapsed3300/3608,about55–60s. | L10cells3/7/11/15 |
| L10 ending geometry exceeds E18 | Natural low portrait local3942`(4001.8,-28.5)`:778draw/1.109Mtri; high portrait credits4458`(4003.3,-28)`:933/3.293M. Excluding shadows still741/1.084M and782/1.969M. | [Low portrait](L10-ending-real-low-webgl2portrait-skip.json.gz), [high portrait](L10-ending-real-high-webgl2portrait-skip.json.gz); counters in natural ending receipts |
| L10 hazard placeholder warning | Actual route warning`haz.propane-tank…PLACEHOLDER BOX (status reference)`; not assigned to a particular visible model. | Route warnings, scope explained in[L10](L10.md) |
| L9 APC open cab / upright pose | Physical E entry tick61`(0,0)`,all4,z1/1.5 and front80/110 inspection. | L9cells1/2,9/10,17/18,25/26 |
| L9 bridge impact/crawl occlusion | Actual low13872–13992/highGPU12144–12276 near`(527.5,2.6)`; clean replay local240 all4,z1/1.5. Huge girders fill view. | L9cells7/15/23/31 |
| L4 truck canvas looks metallic | Actual arrival1949–1955,all4,z0.5/1/1.5; high has strongest chrome-like vertical highlights. | L4cells1/2,6/7,11/12,16/17 |
| L5 shutter silhouettes overlap | LowGL11657/lowGPU11652,highGL16000/highGPU15998,near`(38.20,-50.04)`,z1/1.5. Entry posts/caption compress five bodies. No collider penetration proven. | [L5](L5.md),cells4/9/14/19 |
| L7 wreck too dark | Tick0`(273,15)`,all4,z1/1.5; lantern does not read truck body. | L7cells1/6/11/16 |
| L7 departing bus cropped | Low10752/high6204 onward,about1s after departure,all4,z1/1.5. | L7cells5/10/15/20 |
| L6 exit stair policy stall | Waits~40simsec then dies26652`(252.368,14.981)`,y3.091; retry completes27422. | [L6](L6.md),cells3/8/13/18; not a proven hard-lock |

## Shared rendering fixtures — all four quality/backend cells

[L10 sheet](L10-contact.jpg) retains six finds, Mega poses, fuel/fire, Alpha shapes, height controls and G-24 examples; [L9 sheet](L9-contact.jpg) retains APC/headlights/ramps/damage. Detailed PASS/FAIL and unverified branches are in the[acceptance ledger](handoff-verdicts.md).

Positive samples: six gold world rings and actual collection; farm machinery/corn silhouettes; six-frame toward/away/across Mega lope strips; continuous moving/turning muzzle flame and warm spill; sustained60fuel exhaustion/reload/restart in all4; five Alpha looks/six forced move shapes; full/near/damaged/dead/riot/occluded G-24 states; platform isolation with flat damage control and actual stairs; selected moving headlights/one map/practical/power; real glass/collapse/burn/wreck plus normalized L9/L10 damage rollout. Protected/forced fixtures do not establish normal counters, difficulty or first-hit allocation budgets.

## Gates / natural performance

| Check | Result / practical limit |
| --- | --- |
| Typecheck / lint / unit / verify E31,E32 | **PASS:** current regression suites107tests/27files; `verify E31/E32` run the per-change gate (retired per-epic AC tests). Catalogue budget150/150 is usage/cap, not150executed passes. [E31](E31-checks.json), [E32](E32-checks.json), [logs](validation-logs.json.gz). |
| E07 shared check gate | **PASS** typecheck/lint/unit107tests; [receipt](E07-checks.json). Dedicated smoke result remains failing below. |
| QA production build | **PASS**7.53s; source/hash retained,[receipt](production-build.json). No claim about public production debug exclusion. |
| scene:gate | **FAIL**1/50PASS,49loading failures:26required-lioness/23weighted-owner errors; four serial batches,1.9min. [Full JSON](scene-gate.json), [summary](scene-gate-summary.md). Passing L3bar-cap four-frame strip personally reviewed; this cannot approve49unrendered scenes. |
| WebGL smoke | **FAIL**1/3PASS,2asset-loading failures,[receipt](smoke.json). No FPS approval from this nonquiet smoke. |
| Original destruction tool | Literal **FAIL** while still briefing tick0. Begin-only wrapper **PASS** all unchanged assertions. [L3 follow-up](L3.md#original-destruction-tool),cells25–28. |
| Quiet native cold observation | **PASS sampled**,n=1fresh cache/browser perquality: low4459.1ms/high4139.9ms; max post-card50.1ms each. **Full20-sample gate unverified.** |
| Quiet actual-district jam | **PASS sampled**6.5sphysical traversal,z1.5,normalHP/AI: lowp95/max7.8/18.6ms,high9.2/64.2ms;25.647/28.599m movement; no>66/200msframes,zeroerrors. Initial courier pose only. Not whole-route/finalfight/first-hit approval. |
| Ending geometry | **FAIL** low/high draw/triangle budgets above, even excluding shadow passes. No quiet ending frame-time claim. |

[Quiet admission](performance-admission.json):load1=2.9995; [data](performance.json),[L10 interpretation](L10.md#quiet-performance). Natural portrait720×1280 all4 physical pause/resume/skip/thanks/menu PASS; full landscape90s credits reaches thanks/menu. Sampled credit/licence type reads. Audible hymn, every credit line and toy branch remain unverified.

## Fixes / source identity

1. **`bfd998ff`** synchronizes retained farm finds with campaign ownership/racks before checkpoint; validator accepts known mounted-action usage without carried ownership. Existing missions/save unit cases extended. Both original route failures reproduced before fix.
2. **`016ea78f`** resolves a destruction prop against current world items after chunk reload, preserves unloaded plain pose, and avoids stale Rapier handle use for queued kicks/explosion impulses/collider reconciliation. Existing world-systems test extended with burn/blast→unload→kick/ticks→reload; RED before/GREEN after.

Eight corrected L9/L10 rollout matrix runs have zero runtime errors. Four complete current L10 routes preserve the observed pre/post tick/position/phase/find/charge/ending fields with zero mismatches ([parity receipt](poststreamfix-parity.json)); not a full-world deterministic hash or performance A/B. No large art/story fix, specs edit, deploy or push.

## Remaining acceptance gaps

The[ledger](handoff-verdicts.md) covers every requested handoff item with explicit PASS/FAIL scope. L8 content is blocked; audio was not evaluated. Every route choice, all-seed rescue difficulty, original-source/PROD A/B,20cold samples, first-hit allocation, universal animal/grab/roof/vehicle-height variants, normal Alpha counter/interruption/kill branches, male/accessory/grip/all-LOD matrices, continuous prompt/beam tracking and optional phone/toy endings remain unverified. Newer PO Q-302 (no hiding-place search ring) supersedes older Q-140. L1/L2-only routes were outside this touched-level sweep.

Reproduce with the committed TypeScript harnesses through`tools/e2e-lock.sh`, one command at a time,`SCENE_PORT=4351 E2E_SERIAL=1 E2E_UNITS=1 E2E_RESERVATION_SECONDS=600 BROWSER_POOL_JOB_ID=qa-browser2`. Compressed receipts retain raw paths/hashes for provenance; raw files are intentionally absent. Contact plans record base selections; appended follow-up rows are documented in each manifest's method/previous-sheet hash. [Execution/retention receipt](execution.json) records command outcomes,215selected contact cells and the eight sheet hashes. No secrets are included.
