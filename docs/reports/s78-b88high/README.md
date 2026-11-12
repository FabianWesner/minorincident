# Batch 88 HIGH real-input QA — HOLD

Date: 2026-11-12  
Worktree HEAD: `bea2dc9d`  
Scope: L8 (start to boarding), L9 (full level), and the first three minutes of L3, L4, and L7.  
Target comparison: PROD batch 87 at <https://minor-incident.com>.

## Verdict

**HOLD — partial real-input evidence; QA remains incomplete.** The IPC restriction cleared on continuation. A pooled headless GPU run of L8 HIGH zoom 1 reached the flamingo arena, then the driver stopped after 90 seconds without progress at 24/26 killed. This is not yet a confirmed gameplay soft-lock. Other passes and PROD comparisons remain open.

[Opened-capture contact sheet](contact-sheet.jpg) shows the opening route, Nadia-follow pause, and flamingo stall. Raw run: `test-results/playtest/s78-b88high-l8-high-z1/` (logs, captures, runs-campaign.json and issues-campaign.json). The first session ended after 333 seconds; an automatic continuation was stopped to avoid repeating the same attempt without diagnosis.

## Evidence and checks

- `npm run build` passed (production build; public bundle reported no QA hooks).
- `MI_BUILD_CACHE=off npm run build:qa` passed. Disabling the cache was needed because the shared cache lock is outside this worktree and denied access.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `sh tools/remote/run.sh "$PWD" -- npm test` could not start: the runner pool reported no healthy provisioned Hetzner runner, and the command did not qualify for its local Mac fallback. The 150-case suite was not run.
- `sh tools/remote/status.sh` confirmed the local slot was free, but reported local admission unavailable and could not resolve the remote API host from this environment. Current remote runner state therefore remains unavailable here.
- `npm run browser:pool` could not start: Node/tsx failed to create its local IPC pipe with `listen EPERM` (`/var/folders/.../tsx-501/...pipe`). Retrying with `TMPDIR=/tmp` failed identically (`/tmp/tsx-501/...pipe`).
- The playtest driver also could not start for the same sandbox restriction. Its default QA build first hit the shared-cache permission error; with `MI_BUILD_CACHE=off`, the QA build passed and then the driver failed at tsx IPC startup before creating a browser session.

## Requested coverage

Measured coverage is summarized below. No PROD A/B was performed. All incomplete routes remain open.

| Level | HIGH zoom 1 | HIGH zoom 1.5 | LOW zoom 1 |
|---|---|---|---|
| L8 full | Merged build incomplete: 25/26 flamingos, 90 s driver stall | Incomplete: same 25/26 stall | Open |
| L9 full | Incomplete: eight-minute cap at rail encounter | Open | Open |
| L3 first 3 min | Sample complete | Sample complete | Open |
| L4 first 3 min | Sample complete | Sample complete | Open |
| L7 first 3 min | Sample complete | Full route finished in 149 s | Open |

The LOW target is zoom 1 per the job prompt. The PO checklist also calls for zoom 1.5 coverage; that additional LOW coverage is not claimed here.

## Open PO findings (not re-checked)

The 2026-11-11 UAT items remain open pending visual review:

- L8: “lions look and flicker”; “marker in the dark void, rethink L8”.
- L9: “soldier under the APC, APC flicker and flame”; “rail stall, school bus”.

Batch-specific changes also remain unverified: L8 fenced visitor path, six bounded pens, Nadia-following marker, paved plaza, pond rim lights/cover, and settling flamingo corpses; L9 detour throw landings, route recovery, and “N left” objective; L3 second wave at +14 s; L7 opening Alpha moved 8.5 m east; L4 west spearhead runner and aligned north mouths.

## Required to close

Rerun the requested physical-input sessions with the browser pool operational, inspect the captures, record glitches and any stuck interval over 10 seconds, judge fun/harmlessness, compare changed lanes against PROD, then replace this HOLD report with the evidence-backed verdict and contact sheet. P1/P2 status is currently **unknown**.

## Continuation evidence

The opened opening and Nadia-pause captures show the objective ring on pavement with lamps/path lights. The flamingo capture shows a bounded arena, visible rim lighting, many corpses, and remaining health bars. A still cannot establish corpse settling or flicker. The opening escort had a roughly 20-second progress pause; the arena had a 90-second pause. Cause is unresolved because the driver reported no nearby targets while the capture showed remaining health bars. The escort segment was harmless in this attempt (full health), and the long arena stall was boring; fight fun and finishability need a manual-input follow-up. Driver severity labels (including P0 cannot-finish) are automation outcomes, not assigned game severities. P1/P2 gameplay list remains unconfirmed.

## L3 HIGH zoom 1 opening (continuation)

Completed the requested 180-second opening sample with real input, no objective skips, no deaths, and 0 logged driver assists. Ended at the three-minute cap, approximately 50 m from the army checkpoint. The driver labels the time cap `P0 cannot-finish`; this is an expected sample boundary, not a game defect. No P1/P2 driver finding was recorded. Opened `test-results/playtest/s78-b88high-l3-high-z1/captures/campaign-L3-t2717.jpg`: visible street fight with several pursuers, courier at 64 HP, legible objective arrow, pavement and fences intact in that view. Opening combat is active rather than harmless; continuous navigation and combat supplied pressure. This sample did not reach the changed second checkpoint wave, so its +14-second timing remains unverified. Raw summary/log/captures are in `test-results/playtest/s78-b88high-l3-high-z1/`. HIGH zoom 1.5 and LOW remain open.

## L4 HIGH zoom 1 opening (continuation)

Completed the requested 180-second real-input sample with no objective skips, four deaths and one logged driver assist. Reached the south-breach hold, with 50 seconds remaining at the sample cap. The driver P0 label is its time-cap outcome, not a confirmed game defect. Its P2 no-marker interval (maximum no-progress 29.81 s) is the convoy introduction: opened `campaign-L4-1250-stuck-navigating.jpg` shows a cinematic bus with seated passengers and hidden gameplay HUD, followed by resumed combat. This interval is not classified as a navigation bug. Opened `campaign-L4-t8127.jpg` shows the courier at 0 HP among several close brutes, soldiers, and persistent corpses at the south breach. Combat is dangerous rather than harmless; four deaths suggest substantial pressure for this driver, but do not establish whether human play is fun or unfair. The changed west runner and aligned north mouths still need direct observation and PROD comparison. Raw evidence: `test-results/playtest/s78-b88high-l4-high-z1/`. Other quality/zoom passes remain open.

## L7 HIGH zoom 1 opening (continuation)

Completed the requested 180-second real-input sample: 3 deaths, 0 logged assists, no objective skips, and no P1/P2 driver findings. End HUD: group 24/24 nearby, evacuation corridor 151 m away. The P0 driver label is the expected three-minute cap. Opened `test-results/playtest/s78-b88high-l7-high-z1/captures/campaign-L7-t2719.jpg`: courier and weapon/HUD are readable, nearby armed followers have visible health bars, and ash/night lighting leaves much of the ground dark. The group stayed intact during this sample. Escort pressure needs human judgment and matched PROD observation; full-health progress alone does not establish fun. The exact opening Alpha relocation and its encounter effect remain unverified. Other zoom/quality passes and A/B remain open. Raw evidence: `test-results/playtest/s78-b88high-l7-high-z1/`.

## L9 HIGH zoom 1 attempt (continuation)

Real-input run ended at the eight-minute cap (482 seconds), unfinished at the rail stall: 19 deaths, 0 logged driver assists, no objective skips. Two driver P2 enemy-frozen observations were five-second stationary attack states near the courier; these are unconfirmed gameplay defects. P0 cannot-finish is the time-cap label. Opened `campaign-L9-t2714.jpg`: APC hull, headlights and three visible-side wheels are readable; this still does not prove no flicker or correct flame depth. Opened `campaign-L9-t18942.jpg`: 0 HP courier body across the windscreen, several attackers beside the hull, and rail-stall HUD explicitly showing countdown, shoot-boarders instruction, F hatch control, and inability to exit. Repeated countdowns therefore cannot be interpreted as a soft-lock without separating checkpoint replays from normal stall behavior. Driving traversed most of the road, but this attempt did not recover from the rail encounter and did not finish the level. The encounter supplies substantial lethal pressure; fun/fairness remains unresolved because the driver repeatedly dies. Restart/go prompt, soldier placement at start, school-bus telegraph/dodge/defeat, detour landings and recovery still require direct verification. No PO UAT vehicle finding is closed. Raw evidence: `test-results/playtest/s78-b88high-l9-high-z1/`. Other zoom/quality passes and PROD comparison remain open.

## L3 HIGH zoom 1.5 opening (continuation)

Completed 180 seconds of real input with 3 deaths, 0 logged assists and no objective skips. No P1/P2 driver finding; P0 is the expected time-cap label. Opened `campaign-L3-t5428.jpg`: courier at 35 HP in an active street fight, distinct nearby figures and health bars, readable arrow and objective. End distance was 355 m from checkpoint, so the attempt lost progress and did not reach the changed second wave. This is pressure rather than harmless combat, but death/replay and driver navigation prevent a reliable human difficulty judgment. Raw evidence: `test-results/playtest/s78-b88high-l3-high-z15/`.

## L4 HIGH zoom 1.5 and L8 revision update

L4 completed 180 seconds on the original bea2dc9d game revision, with 2 deaths and 0 logged assists, no skips. Reached south hold with 49 seconds remaining. The P2 no-marker interval matches the convoy introduction; the P0 is the sample cap. Opened `test-results/playtest/s78-b88high-l4-high-z15/captures/campaign-L4-t5423.jpg`: north-breach fight with many corpses, multiple visible live infected and soldiers, readable health bars and ring, courier at full HP in that frame. Combat is active; exact mouth alignment and west runner comparison remain unverified.

After this sample, merged main (including 5c6b579f) as 4e6a3c94. `npm run build` passed with clean public-bundle assertion. Full L8 was not previously completed, so the next L8 start-to-boarding attempt must use this merged gate-closing build; the earlier bea2dc9d flamingo stall is historical evidence only. No code was edited by this QA lane.

## L8 after main gate update — HIGH zoom 1

Production build and QA build both passed after merging main including 5c6b579f. Fresh real-input attempt on this merged build stopped at 335 seconds after 90.6 seconds without progress: 25/26 flamingos killed, 0 deaths, 2 logged assists, no skips. Opening Nadia-follow pauses of 21–31 seconds recovered. Opened `test-results/playtest/s78-b88high-l8-merged-high-z1/captures/campaign-L8-15693-stuck-at-ring.jpg`: final enemy health bar is visible near the far pen edge, while courier/group remain at the center ring. The driver observation reports no nearby enemies. This supports a driver target-acquisition/navigation limitation, not a proven game soft-lock. Pen fencing, rim lights, corpse field and count HUD are visible. The gate change does not by itself complete the route in this attempt. Manual physical-input pursuit of the remaining target and the rest of the level are still required. No L8 UAT finding is closed from this still; flicker and settling require temporal inspection.

## Driver diagnosis for next L8 attempt

Read the current driver source after the repeated stalls. `tools/playtest/eyes.ts` filters enemies through `input.visible`, drawn crowd-figure presence and screen/HUD visibility before reporting targets; a visible health bar in a screenshot does not guarantee the driver reports that enemy. `tools/playtest/session.ts` supports a `control.json` override that sends actual keyboard presses and mouse actions, so the next attempt can walk toward the far-edge enemy rather than repeat the stationary automated targeting. This is a source-based explanation of a possible observation limitation, not proof of the specific filter that excluded the final flamingo. No game or driver code was edited.

## L8 physical-input recovery attempt

Fresh merged-build HIGH zoom 1 attempt retained its browser profile at `test-results/playtest/s78-b88high-l8-input-recovery/profile`. Reached 25/26 again; physical-input control commands then moved toward the visible target and held Space to fire normally. Opened `campaign-manual-far-flamingo.jpg` and `campaign-manual-fire.jpg`: courier movement changes camera framing and the final enemy remains in the arena, with its health bar reduced to roughly half in the firing capture. No teleport, god mode or objective skip was used. The driver still ended at 332 seconds after 90.7 seconds without objective-count progress; boarding was not reached. These captures support a damageable target plus an input/target-acquisition difficulty; they do not establish an unkillable enemy or a finishable route. Next continuation can retain this profile and pursue the remaining target rather than replay the opening.

## L7 HIGH zoom 1.5 completion

Merged-build real-input attempt finished L7 in 149 seconds with no skips, zero deaths, zero assists and zero driver findings. Maximum recorded no-progress interval: 5.68 seconds. Opened `test-results/playtest/s78-b88high-l7-high-z15/captures/campaign-L7-t8120.jpg`: boarding HUD says 23/23 aboard, everyone aboard; courier 100 HP, visible lit bus and persistent corpse field. Nearby figures remain outside the bus in that frame, so the relationship between the boarded counter and visible bodies needs separate interpretation rather than automatic closure. Opened `campaign-L7-result.jpg` shows L8 loading, supporting the driver-recorded handover. The summary simSeconds is zero despite live tick progression, so use wallSeconds and capture ticks as timing evidence. Route is finishable for this attempt; this does not establish the exact Alpha relocation effect or a matched PROD improvement. Raw evidence: `test-results/playtest/s78-b88high-l7-high-z15/`.

## L8 HIGH zoom 1.5 attempt

Fresh merged-build run with requested zoom 1.5 stopped at 348 seconds after 90.3 seconds without progress, again at 25/26 flamingos; 0 deaths, 2 logged assists, no skips. Opened `test-results/playtest/s78-b88high-l8-high-z15/captures/campaign-L8-16499-stuck-at-ring.jpg`: partially depleted remaining enemy health bar inside the lit pen, courier/group at the center marker, corpse field visible. Wider requested zoom did not resolve the driver target-acquisition failure. The arena has authored camera framing, so this still does not prove the exact resulting camera scale matches the requested normal gameplay zoom. Full boarding, other animal pens, flicker/settling, and manual recovery remain open; no game soft-lock is assigned.
