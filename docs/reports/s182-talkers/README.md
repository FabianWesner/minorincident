# Speaking NPCs — work in progress

The controlled WebGL2 fixture uses HIGH and LOW, zoom 1.5, and steps the conversation before sampling. [Conversation sheet](conversations.jpg): top six frames are Voss over 6 seconds on HIGH; middle four are Sam over 3.6 seconds on HIGH; bottom is Voss on LOW. Subtitles are visible. The HIGH Sam sequence shows him near the courier. Voss is near the courier in the HIGH sequence; the figures are too small to judge the quality of her gaze and hand movement confidently. These fixtures do not establish natural-play framing or obstacle avoidance.

The full-resolution HIGH frame at six seconds, regenerated with `tools/qa/s182-talkers-capture.ts`, shows Voss with an arm raised beside the console. Her figure overlaps the console and her gaze direction cannot be judged reliably at this scale; the eastward indication remains unverified.

[Ruiz HIGH](ruiz-talking-high.jpg) shows him to the courier's right during his subtitle after a controlled lead-in. The contact sheet is too small to verify his gaze and gesture quality.

| Level | In-person speaker currently mapped | Position and clips |
| --- | --- | --- |
| L3 | Sergeant at the armory briefing and handgun pickup | First squad officer at the armory; shared relaxed walk, idle and gestures. Visual check pending. |
| L4 | Quartermaster on gun handoff | Quartermaster post; shared relaxed walk, idle and gestures. Visual check pending. |
| L5 | Dale, Rosa, Okafor, Mia, Sam on discovery | Their revealed survivor positions; shared relaxed walk, idle and gestures. Visual check pending. |
| L8 | Nadia on tour and route lines; Hale on greeting and breach | Existing keeper and major actors; shared relaxed walk, idle and gestures. Visual check pending. |
| L10 | Voss, Ruiz, Sam or Reyes in the hangar | Existing hangar cast; shared relaxed walk, idle and gestures. Sam approaches during the preceding exchange. |
| L10 epilogue | Rosa | Existing survivor montage actor; glance and gesture. Framing and courier presence remain open. |

Radio lines retain their existing radio labels. L8's generic soldier fallback and other levels' in-person lines remain to be mapped; this table is not a complete speaker inventory. The capture fixture directly advances dialogue and is not an ordinary-play proof. Background hangar researchers and guards use waiting clips; nearby prop walks remain open. No new animation clips or rigs were added.

Latest typecheck and lint passed. The remote unit suite and its unchanged retry both exceeded the 240-second budget (241.3 s and 240.3 s, exit 124). The first run's save-progression case exceeded its 30-second case limit; it passed in 27.4 s on retry. Neither full run completed. `qa:threat` byte identity and the full visual coverage have not been verified. The objective is incomplete.
