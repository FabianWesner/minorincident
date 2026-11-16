# Batch 110 real-input QA

Candidate `fc0341d1`. **Not approved as a complete acceptance pass.** The courier chevron materially helps identification in the reviewed L4 crowd frames. L9 seed-2 road, shortcut and LOW road reach L10 without skips; the first HIGH road attempt has a prolonged boarding-count wait and later stalls at the bridge. Ordinary screamer noticeability while moving remains unproven.

## Method and validation

Headless physical keyboard/mouse input through the unchanged `tools/playtest/session.ts`, standard mortal combat, debug level-menu entry, WebGPU. HIGH matrix first, LOW second; a supplemental HIGH road repeat follows LOW to investigate the first timing concern. One browser at a time through `tools/e2e-lock.sh`, reservations at most ten minutes, preview 5007 / scene 5008. Driver map/navigation assists remain logged. No source, playtest-tool, simulation-stat or corpse-lifetime changes. Ignored wrappers request native video, select the seed-2 level-world load seed while preserving other load arguments, and sample read-only state. This is a level-world seed override, not a new campaign seed.

QA build, typecheck and lint passed. Exact required `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90: 105 passed / one platform skip, 27 files, 150-case inventory retained, 126.5 s against 240 s. Earlier sandbox IPC/preview-bind denials produced no gameplay evidence; those restrictions were subsequently removed. Initial remote unavailability was resolved before the passing run.

Raw evidence is under `test-results/b110/<run>/`: `log-campaign.jsonl`, `runs-campaign.json`, captures, and (except the initial road run) native `video/*.webm`. Reviewed exports are under `test-results/b110/review/`. Only this README, `qa.json` below 200 KB, and the opened [contact sheet](contact-sheet.jpg) are committed.

## L9 evacuation and feel

| Run | Tier / zoom | Evacuation evidence | L10 / outcome |
| --- | --- | --- | --- |
| `l9-high-road` | HIGH / 1 | Defense complete first observed 11199; still 3/4 at 12998, +29.98 s; bridge HUD by 13140 | No L10: eight-minute cap, zero deaths/skips, bridge navigation stall |
| `l9-high-seed2` | HIGH / 1 | 4/4 at 9731 with 16 s defense remaining | L10 reached, 206 s, zero deaths/skips |
| `l9-high-shortcut` | HIGH / 1.5 | Defense complete 9364 at 1/4; sprint HUD 9832 (+7.8 s); departure follows around 9878 (+8.57 s) | L10 reached, 200 s, zero deaths/skips; approximately 36.82 wall seconds after first defense-complete sample |
| `l9-low-road` | LOW / 1.5 | 4/4 at 11656 with 15 s defense remaining; direct observer later confirms all four boarded | L10 reached, 242 s, zero deaths/skips |

Supplemental `l9-high-road-observed` HIGH zoom 1 reaches L10 in 220 s, zero deaths/skips. Direct state at tick 10925 records all four IDs aboard, living count four, and no fallback. Defense expires around 10921 (`evacuationAt` 9121 + 1800 ticks); L10 arrives approximately 33.9 wall seconds later. LOW defense expires around 12539 and L10 arrives approximately 29.5 wall seconds later. These later arrivals include the intended crossing content. The supplemental repeat does not reproduce the first road delay.

Times use simulation ticks / 60 unless explicitly wall-clock. First-observed HUD values are sample bounds. The first road run has no survivor identity census, so its 3/4 count alone cannot prove a *living* straggler remained. Do not substitute the later bridge HUD for exact boarding time. Likewise, the shortcut's 3/4-to-departure transition does not prove four survivors lived. L10 follows intended bridge driving, crash and crawl content; its later arrival is separate from the evacuation deadline.

Reviewed shortcut video approximately 172.6–178.6 s at 2 fps (`review/fallback.jpg`) shows survivors running toward the trucks, the sprint HUD, then departure. No obvious teleport or gross truck intersection appears in these views. Smoke, the APC and the follow camera hide portions of the route, so zombie penetration, precise foot sliding and all-truck clearance are not fully qualified. The quick visible retreat reads as purposeful evacuation in this sample. The first road's long wait reads as babysitting, followed by repetitive bridge steering. LOW review 205–211 s shows 4/4 aboard during active hatch combat; it does not exercise fallback. The road/set-piece approach and departure are visually dramatic, with muzzle flashes, smoke and vehicle pressure; no universal performance or “stunning everywhere” claim is made.

## Courier chevron

L4 HIGH zoom 1 has a continuous three-minute pre-cap combat window. At the cap the driver used an objective skip; subsequent footage is excluded, and the run was terminated. L4 HIGH zoom 1.5 uses a clean 180-second bounded sample, seven deaths, no skips. Reviewed z1 video 130–142 s at 1 fps and full-size 132 s frame show multiple overlapping large Alphas. The small teal chevron at the courier's hair and outlined body provide a clear eye landing. Reviewed z1.5 video 130–136 s at 2 fps shows the marker tracking the courier as the crowd approaches. No obvious annoying rapid flicker or confusion with yellow objectives/red warnings was seen in those short sequences. This is subjective visual recognition, not measured reaction time.

L6 HIGH zoom 1 and 1.5 each run 300 seconds with no skips: seven and six deaths respectively. Reviewed both at 100–106 s / 2 fps, plus z1 at 150–156 and 250–256 s. The lit courier stays identifiable through movement, nearby attacks and tunnel transitions; the chevron is supplemental. The L6 samples are less occluded than L4's worst Alpha pile, so they do not establish identical worst-case density coverage. Calm/open tunnel stretches do not show an obvious persistent pin. Riding L9 and the reviewed departure show no conspicuous courier pin. Full calm/cutscene suppression and sub-frame flicker across the whole game are not established by these samples.

L4 feels dangerous and busy, with repeated deaths, rather than harmless. L6 is visually atmospheric, but repeated deaths and retreat/gate handling make these driver samples repetitive. No new geometric glitch is established by the reviewed L4/L6 frames.

## Screamer while moving

L9 seed-2 HIGH zoom 1 logs ordinary scream telegraphs at 5695, 6043 and 6391. Reviewed first-event video approximately 101.1–104.1 s / 4 fps (`review/scream-moving.jpg`) is the authored engine-stall hatch phase, with the source outside the reviewed frame. It shows no conspicuous local violet cue and does not establish the requested moving-camera pass. This is not proof of a missing render effect.

L10 HIGH zoom 1 runs 300 seconds, ten deaths, no skips. Reviewed 150–156 s / 2 fps shows moving axe combat at the farm, clear red ground warnings and repeated close pressure. Captured warnings are Alpha roars, not ordinary screams. It feels punishing and repetitive in this sample; no new geometry defect is established. **Ordinary violet-ring noticeability during movement remains an explicit acceptance gap.** Fixture evidence and Alpha warnings are not substituted for it.

## Findings and driver gaps

- **P2 — bridge progress stalls in the first HIGH road attempt.** `l9-high-road/captures/campaign-L9-17230-stuck-navigating.jpg`, tick 17230; still unfinished at `campaign-L9-28486-cannot-finish.jpg`, tick 28486. Driver/product root cause unproven. Its automatic P0 labels are driver inability-to-finish labels, not an established product P0.
- **P2 provisional — evacuation count remains 3/4 beyond 20 s.** `l9-high-road/log-campaign.jsonl`, tick 12998 (+29.98 s after first defense-complete sample); context capture `captures/campaign-L9-t13532.jpg` is later bridge context, not proof of boarding time. Living-survivor status was not observed, so a product timing failure is not conclusively established by this run alone.
- **P3 — motionless-enemy observations need attribution.** Shortcut ticks 8409 and 9273, corresponding `enemy-frozen` captures; LOW road tick 4144. Scripted/hull attack behavior may explain these warnings. No confirmed frozen-AI defect is claimed.

Driver gaps: the first road run lacks native video and identity census; initial observer version omitted the driving state (corrected for LOW and supplemental repeat); event callbacks do not replace the driver's per-world scream log. The first L4 cap advanced an objective, so only its pre-cap footage is usable. Other bounded fight samples have no skips. Early L4 empty HUD and L6 authored rest generate navigation warnings. Native video is used because the pool profile helper does not forward recording options. Reviewed still sequences cannot exclude every transient flicker or subtle foot slide. All acceptance gaps above remain open; this report does not approve batch 110.
