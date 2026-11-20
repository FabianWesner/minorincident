# Speaking NPCs — work in progress

The controlled WebGL2 fixture uses HIGH and LOW, zoom 1.5, and steps the conversation before sampling. [Conversation sheet](conversations.jpg): top six frames are Voss over 6 seconds on HIGH; middle four are Sam over 3.6 seconds on HIGH; bottom is Voss on LOW. Subtitles are visible. The HIGH Sam sequence shows him near the courier. Voss is near the courier in the HIGH sequence; the figures are too small to judge the quality of her gaze and hand movement confidently. These fixtures do not establish natural-play framing or obstacle avoidance.

The full-resolution HIGH frame at six seconds, regenerated with `tools/qa/s182-talkers-capture.ts`, shows Voss clear of the canister, turned toward the courier with an arm raised. Her precise gaze direction and the eastward indication remain difficult to judge at this scale.

[Ruiz HIGH](ruiz-talking-high.jpg) shows him to the courier's right during his subtitle after a controlled lead-in. The contact sheet is too small to verify his gaze and gesture quality.

[Rosa epilogue HIGH](rosa-epilogue.jpg) uses an injected healthy Rosa roster entry and release time. Rosa and the existing courier appear together beside the truck, with Rosa gesturing and her subtitle visible. This fixture does not verify the full campaign transition.

[Hangar entry HIGH](hangar-entry.jpg) advances prior objectives and places the courier outside, then uses movement input through the entrance. Voss enters from the left and walks toward the courier during her visible first subtitle; she is still several metres away during the sampled line. The earlier campaign route is not exercised.

[L8 gate HIGH](l8-gate.jpg) starts the normal briefing with default progression. The nearest recorded guard begins about 27 m away in simulation; the existing guard is staged in presentation during the opening briefing, and the sheet shows a guard near the courier during the subtitle. Other camera positions and later fallback soldier lines remain unverified.

[L5 Rosa HIGH](l5-rosa.jpg) injects the search phase and survivor discovery at the pharmacy. The subtitle appears, but infected crowd the rescue point and Rosa cannot be distinguished confidently in the sheet. A render probe confirms her actor is drawn while in the `flee` state, using locomotion clips during the line. An existing gesture is now layered on unarmed moving speakers; the crowded recapture is still not a gesture pass, and ordinary rescue play needs review.

[L9 opening HIGH](l9-opening.jpg) shows the APC's existing seated-crew cutaway during Sam's opening subtitle, now labelled with his name (or Reyes for the fallback). Several passengers are visible, but Sam cannot be identified confidently and his gaze and gesture are not readable at gameplay scale. A fresh five-frame probe confirms his rendered head remains in frame and his right hand moves over 2 cm while speaking; player-facing speaker readability remains unresolved. The roof is restored after the line.

[L6 medic HIGH](l6-medic.jpg) invokes the authored treatment bubble in a controlled shelter fixture. The probe reports the medic drawn in `npc-cower`; the bubble is visible and existing upper-body gesture is layered. The small, crowded figures make the hand motion hard to judge, so this is a partial check rather than a visual pass.

The full-resolution L6 frame and projected actor probe locate the medic bent over a cot. The hand area is dark and partly occluded, so clean arm motion and her gaze toward the courier remain unverified.

An earlier experimental walk from off-screen left the guard entering at the edge after the subtitle; it was discarded. The gate capture fixture records presentation positions without changing the simulation.

| Level | In-person speaker currently mapped | Position and clips |
| --- | --- | --- |
| L1, L2, L6 | Actor identified by an active story bubble | Idle speakers use shared gestures; selected seated/treatment activities retain their lower-body pose with an upper-body gesture. The L6 medic capture is partial; bubble framing and action clips need further review. |
| L3 | Sergeant at the armory briefing and handgun pickup | First squad officer at the armory; shared relaxed walk, idle and gestures. Visual check pending. |
| L4 | Quartermaster on gun handoff | Quartermaster post; shared relaxed walk, idle and gestures. Visual check pending. |
| L5 | Dale, Rosa, Okafor, Mia, Sam on discovery | Their revealed survivor positions; shared relaxed walk, idle and gestures. Visual check pending. |
| L8 | Nadia on tour and route lines; Hale on greeting and breach; nearest living guard for generic soldier lines | Existing keeper, major and guard actors; shared relaxed walk, idle and gestures. Visual check pending, including when no guard is nearby. |
| L9 | Sam/Reyes, Mia, Dale and Okafor on identified lines | On-foot actors use shared presentation; seated copies use an existing upper-body gesture and the APC cutaway. Individual speaker readability remains unresolved. |
| L10 | Voss, Ruiz, Sam or Reyes in the hangar | Existing hangar cast; shared relaxed walk, idle and gestures. Sam approaches during the preceding exchange. |
| L10 epilogue | Rosa | Existing survivor montage actor beside the existing courier; glance and gesture. Controlled HIGH capture reviewed; full campaign transition remains open. |

Radio lines retain their existing radio labels. Other in-person lines remain to be mapped; this table is not a complete speaker inventory. The capture fixture directly advances dialogue and is not an ordinary-play proof. Background hangar researchers and guards use waiting clips and short clear walks; their activity needs closer visual review. No new animation clips or rigs were added.

Latest typecheck and lint passed. The remote unit suite and its unchanged retry both exceeded the 240-second budget (241.3 s and 240.3 s, exit 124). The first run's save-progression case exceeded its 30-second case limit; it passed in 27.4 s on retry. Neither full run completed. `qa:threat` byte identity and the full visual coverage have not been verified. The objective is incomplete.

An L10-only remote threat diagnostic completed the skilled route, reached the passive hold budget, and reported zero L10 skilled or passive flags (native state hash `2c15e7eb`). Its overall result correctly flags partial level selection, so it is not a full gate or a byte comparison. There are no branch changes under `src/sim`, `src/data`, `src/levels`, `tools/qa/threat`, or `tools/sim-runner` relative to the merge base.

An independent remote L10 diagnostic on merge base `23a6e9a5` produced byte-identical JSON for the native state hash (`2c15e7eb`), skilled and passive runs, observations, flags, and kiting receipt. Wall times and provenance differ. Both diagnostics flag partial level selection, so this verifies L10's measured fields only, not the full campaign audit.
