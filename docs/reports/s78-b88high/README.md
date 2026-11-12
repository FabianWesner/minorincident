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

Only the first L8 HIGH zoom 1 attempt was measured. No PROD A/B was performed.

| Level / pass | Requested route and settings | Result |
|---|---|---|
| L8 HIGH zoom 1 | Opening through flamingo arena | Incomplete: 24/26, 90-second driver stall |
| L8 HIGH zoom 1.5 | Full start → boarding | Unmeasured |
| L8 LOW zoom 1.5 | Full start → boarding | Unmeasured |
| L9 HIGH zoom 1 | Full level | Unmeasured |
| L9 HIGH zoom 1.5 | Full level | Unmeasured |
| L9 LOW zoom 1.5 | Full level | Unmeasured |
| L3 HIGH zoom 1 / 1.5, LOW zoom 1.5 | First 3 minutes each | Unmeasured |
| L4 HIGH zoom 1 / 1.5, LOW zoom 1.5 | First 3 minutes each | Unmeasured |
| L7 HIGH zoom 1 / 1.5, LOW zoom 1.5 | First 3 minutes each | Unmeasured |

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
