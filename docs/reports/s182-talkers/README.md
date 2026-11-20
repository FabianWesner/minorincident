# Speaking NPCs — work in progress

The controlled WebGL2 fixture uses HIGH and LOW, zoom 1.5, and steps the conversation before sampling. [Conversation sheet](conversations.jpg): top six frames are Voss over 6 seconds on HIGH; middle four are Sam over 3.6 seconds on HIGH; bottom is Voss on LOW. Subtitles are visible. The HIGH Sam sequence shows him near the courier. Voss is near the courier in the HIGH sequence; the figures are too small to judge the quality of her gaze and hand movement confidently. These fixtures do not establish natural-play framing or obstacle avoidance.

The full-resolution HIGH frame at six seconds, regenerated with `tools/qa/s182-talkers-capture.ts`, shows Voss clear of the canister, turned toward the courier with an arm raised. Her precise gaze direction and the eastward indication remain difficult to judge at this scale.

[Ruiz HIGH](ruiz-talking-high.jpg) shows him to the courier's right during his subtitle after a controlled lead-in. The contact sheet is too small to verify his gaze and gesture quality.

[Rosa epilogue HIGH](rosa-epilogue.jpg) uses an injected healthy Rosa roster entry and release time. Rosa and the existing courier appear together beside the truck, with Rosa gesturing and her subtitle visible. This fixture does not verify the full campaign transition.

[Hangar entry HIGH](hangar-entry.jpg) advances prior objectives and places the courier outside, then uses movement input through the entrance. Voss enters from the left and walks toward the courier during her visible first subtitle; she is still several metres away during the sampled line. The earlier campaign route is not exercised.

| Level | In-person speaker currently mapped | Position and clips |
| --- | --- | --- |
| L1, L2, L6 | Actor identified by an active story bubble | Idle speakers use shared gestures; authored physical actions remain in place. Bubble speaker framing and those action clips need visual review. |
| L3 | Sergeant at the armory briefing and handgun pickup | First squad officer at the armory; shared relaxed walk, idle and gestures. Visual check pending. |
| L4 | Quartermaster on gun handoff | Quartermaster post; shared relaxed walk, idle and gestures. Visual check pending. |
| L5 | Dale, Rosa, Okafor, Mia, Sam on discovery | Their revealed survivor positions; shared relaxed walk, idle and gestures. Visual check pending. |
| L8 | Nadia on tour and route lines; Hale on greeting and breach | Existing keeper and major actors; shared relaxed walk, idle and gestures. Visual check pending. |
| L10 | Voss, Ruiz, Sam or Reyes in the hangar | Existing hangar cast; shared relaxed walk, idle and gestures. Sam approaches during the preceding exchange. |
| L10 epilogue | Rosa | Existing survivor montage actor beside the existing courier; glance and gesture. Controlled HIGH capture reviewed; full campaign transition remains open. |

Radio lines retain their existing radio labels. L8's generic soldier fallback and other levels' in-person lines remain to be mapped; this table is not a complete speaker inventory. The capture fixture directly advances dialogue and is not an ordinary-play proof. Background hangar researchers and guards use waiting clips; nearby prop walks remain open. No new animation clips or rigs were added.

Latest typecheck and lint passed. The remote unit suite and its unchanged retry both exceeded the 240-second budget (241.3 s and 240.3 s, exit 124). The first run's save-progression case exceeded its 30-second case limit; it passed in 27.4 s on retry. Neither full run completed. `qa:threat` byte identity and the full visual coverage have not been verified. The objective is incomplete.

An L10-only remote threat diagnostic completed the skilled route, reached the passive hold budget, and reported zero L10 skilled or passive flags (native state hash `2c15e7eb`). Its overall result correctly flags partial level selection, so it is not a full gate or a byte comparison. There are no branch changes under `src/sim`, `src/data`, `src/levels`, `tools/qa/threat`, or `tools/sim-runner` relative to the merge base.
