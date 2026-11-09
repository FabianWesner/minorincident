# Browser QA — qa-browser2

**In progress; release acceptance is FAIL.** Browser admission recovered. Source `8622b6d1` plus the two small fixes committed as `bfd998ff` has now been rendered headlessly through the shared browser pool. No deploy or push. This report distinguishes observed defects, successful observations and checks blocked or not yet exercised; an unobserved scene receives no visual pass.

## Method and evidence

One pooled GPU browser at a time, private Vite port 4351, reservations capped at 600 seconds, Metal WebGL2 and actual WebGPU (backend checked). Route fixtures use production bots and mortal campaign simulation, with paired zoom 1/1.5 photographs. Paused stepping accelerates simulation and advances presentation; those runs establish neither audio quality nor live frame budgets. `ending.ts` separately runs the L10 ending at natural time. Posed fixtures explicitly identify teleport/protection/setup and are not campaign completion evidence. Receipts retain ticks, positions, cameras, renderer, quality and screenshot hashes. Review sheets will retain selected evidence after raw image deletion.

## Small fixes made

- **L10 retained-find checkpoint save:** picking up the rifle changed the live rack but left the campaign ownership stale. Subsequent `cure-residential` checkpoint failed save validation at tick 3008, `(740.066,22.476)`, low WebGL2. Synchronize the retained find and rack with the campaign. Before receipt: `L10-pickup-save-before.json.gz`.
- **L10 mounted-gun checkpoint save:** mounted shots recorded `weapon.rotary-minigun` usage, rejected by the carried-only save validator. Repro tick 54082, `(3989.228,-32.888)`, y 3.78, low WebGL2. Accept known mounted action IDs in usage without granting carried ownership. Before receipt: `L10-minigun-save-before.json.gz`.
- Both have regression assertions in existing unit cases. `npm run verify -- E32` passes typecheck, lint and 107 tests (27 files), with four workers and unchanged 150/150 case budget; [receipt](E32-checks.json). Commit `bfd998ff`.

## Current findings

| Level | Observed result | Glitches | Is it stunning? |
| --- | --- | --- | --- |
| L3 | Actual weapon hits break glass, collapse a house and ignite/explode a car in all four quality/backend cells, both zooms. Other sampled buildings remain intact. Further PO corridor/evacuation checks pending. | Smoke/debris obscure the initial wreck inspection; later settled-state inspection pending. | Not established from this limited street fixture. Warm lighting and house silhouettes are coherent. |
| L4 | Pending | Pending | Pending |
| L5 | Pending | Pending | Pending |
| L6 | Pending | Pending | Pending |
| L7 | Pending | Pending | Pending |
| L8 | **FAIL to load**, low/high with both requested renderers. Story/arena/departure visuals blocked before Begin. | Low: missing required skinned monkey tier; high: skin semantic owner is not a weighted joint. | Cannot assess: neighborhood does not load. |
| L9 | Low WebGL2 production route completes. Four named evacuees, Sam and safe corgi transfer to L10 with exactly the axe as the carried weapon. High bot reaches repeated deaths near late evacuation gate; no impossible-route conclusion. | Bridge impact/crawl camera is occluded by huge orange/concrete structure. | **No** in the reviewed low route: bridge impact is unreadable. |
| L10 | Whole route through ending/menu completes in low/high WebGL2 and WebGPU after fixes. Actual L9-carried save also completes in low WebGPU. | Hangar roof hides cast/terminal at zoom 1.5; journey shots use isolated green discs; final panorama is blank fog. Long sparse farm/corridor stretches. | **No**: farm needs denser coherent storytelling; hangar and ending framing need repair. |

### L8 loading blocker

Low WebGL2 and requested WebGPU: `amb.monkey is required for the skinned crowd`. Integrated monkey GLBs exist at the normal paths, but their low texture tier paths do not exist. The asset registry selects `.low.glb` for these low-quality skinned assets; placeholders cannot satisfy the mandatory skinned crowd. High WebGL2 and requested WebGPU fail `Crowd semantic owner must be a weighted joint` in `packSkin → bakeInfectedSteps → CrowdView.loadBatch`. The high stack does not identify which model violates the ownership rule. [Reviewed loading-error contact sheet](L8-contact.jpg), with [cell metadata](L8-contact.json). All four attempts stop before Begin (tick 0); fallback photograph metadata records requested backend/zoom, not a gameplay backend assertion. Both are before gameplay; do not infer that any of the six arenas, Nadia tour, breach, K9, boarding, gate or departure was visually accepted. Every `eg-l8-story` and `eg-l8-bosses` browser item is **BLOCKED / QA acceptance FAIL** behind this startup defect, including audio, retries, markers, pillars, throws, survivors and departure. No stunning verdict is possible. Raw error captures were deleted after sheet review.

### L9 scope

Low route: seed 42 preset, final tick 14531, 242.18 simulation seconds, zero courier deaths, no runtime console errors. Both zooms show APC hull/wheels remaining together through the fall. The bot detours around the authored ramp jumps and tanker, so those set pieces remain untested. Impact/crawl framing fails around ticks 13872–13992; geometry fills the frame until camera recovery near tick 14052. High route stops after 11 deaths around `(450,8–11)` near evacuation; this is a failing completion policy, not proof of an unfinishable game. The actual low handover save is retained and used for a subsequent L10 route.

### L10 scope

Four matrix routes complete through credits/thanks/menu with no runtime errors; low/high final ticks are approximately 66781/67100. Six retained finds are collected. The raised gun is reached by actual stairs and the charge completes. This does not substitute for targeted cross-floor attack controls.

**Hangar FAIL:** low tick 31632 / high 31884 near `(2699.5,65.5)`, zoom 1.5, both renderers: a tiny circular hole shows the courier while the roof hides most of Voss/cast, console and canister. Zoom 1 is substantially more readable.

**Ending FAIL:** isolated green circular journey stages float against empty surroundings. Final pullback shows blank blue fog rather than the map in all four route cells. The separate natural-time low WebGL2 replay confirms the blank panorama at local ticks 3493/3801, cure elapsed 3300/3608 (~55–60 s), so the failure is not an accelerated-clock artifact. Original WebGL2 route photos used an over-broad HUD visibility override and cannot certify cinematic HUD hiding; clean WebGPU routes and natural-time replay preserve native HUD rules.

Actual-carried route preserves `dale`, `mia`, `rosa`, `okafor`, Sam and corgi in campaign data. Visual ending continuity still needs inspection; generic epilogue survivor IDs are not a reliable proxy for the named crew.

## Remaining checklist

All 17 merged handoffs named in the brief and `docs/qa/po-checklist.md` remain the scope. Outstanding checks include supported non-zoo fixture matrices, exact farm/vignette sites, L4 truck/camera and L5–L7 followers, L9 high completion and skipped set pieces, destruction rollout L9/L10, platform controls, audio audition, aspect ratio/skip/toy branches, cold load and real-input/performance budgets. No native-only receipt or old report is being recertified as current visual evidence. Production A/B from the PO checklist has not yet been performed.
