# L8 opening and APC sequence

## Cause and changes

PO 2026-11-08: production `27414470` activated the APC escape objective immediately and allowed early driver entry. Entering the APC could therefore activate `depart` before the 60-second breach. The inherited `c463d595` driver guard closes the original entry path; this lane also fixes the mission dependency that made the destination wrong from the start.

The opening objective is now **“Lead the group to the zoo gate · N m”**, with the ordinary world marker/edge arrow and minimap target from the first controlled frame. At the gate during the calm period it says “Wait with the group at the zoo gate”. `sanctuary` requires both the real breach and the player's presence at the zoo gate `(7,78)`. Only then does `escape` point to the APC. Camping at the APC through the breach leaves escape/depart pending and directs the player back to the gate.

Passenger queueing, driver entry, driving, the gold entry ring and the escape-route checkpoint use that same story order. The alarm also directs an absent player back to the gate. The 3,600 active-tick calm timer and initial spawn counts are unchanged. Existing tunnel cohorts cross the gate/APC road; the gate-side cohort retains its authored courier focus while other cohorts can attack survivors. Debug objective completion reconstructs the real breach, and the native bot follows the gate objective first.

The old “no waypoint during the calm opening” requirement was wrong for the PO's intended opening. E30-AC04, the epic's narrative section and T-E30-04 now agree with the PO 2026-11-08 acceptance clause in [level acceptance](../../qa/level-acceptance.md).

## Checks

- [Native acceptance receipt](validation-native.json), game source `ae818a71`: **0 fresh failing L8 rows**, 10 manual/browser rows incomplete. Low/high complete in 104.92/112.95 s; contact 4.63/10.22 per minute; initial breach attacks at 5.6 s. All six checkpoint clauses pass with identical controls. The command exits 1 because the full gate is incomplete and the unrelated global G-24 Alpha health-bar fixture fails; this is not an all-level acceptance pass.
- [Threat receipt](validation-threat.json): skilled route completes, passive observation has zero flags, six actual kiting attacks in 20 s (18/min). The sole audit flag is `PARTIAL_LEVEL_SELECTION` because this is an L8-only diagnostic; the command exits 1 for that scope flag. No threshold was weakened.
- [Final code checks](validation-checks.json): typecheck and lint pass; the affected mission/vehicle files pass all 8 tests, one worker, on `ae818a71`.
- Earlier full `npm test` completed: 107 tests passed under the 150-case cap. That run predates the final focus/checkpoint/ring follow-ups; it does not replace final focused verification. A later full verify attempt under host overload timed out in the vehicle test; the focused rerun passed. A final full-suite rerun is pending Hetzner admission, which currently fails DNS resolution in this Mac execution context. Re-run `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --env VITEST_MAX_WORKERS=1 --pull test-results/epics/E30 -- npm run verify -- E30` once the runner is reachable. Local fallback is disabled, in accordance with the PO's CPU rule.
- Browser verification is assigned to the dedicated QA lane after merge. No browser is running from this coding lane.

## Retained earlier real-input evidence

[Manifest](captures/manifest.json), source `60ff4a6f`, records eight real-input opening captures: fresh empty storage and a persisted progressed L8 campaign, low/high quality, actual zoom 1/1.5. Objective and marker were present at ticks 6–18; captures at ticks 42–54. Every image was inspected: objective with gate distance at upper right, gold direction arrow below the courier, and minimap destination toward the gate. Zoom 1 shows the courier, bus, corgi and following group closely; zoom 1.5 shows more of the gate building. High has denser grass detail. All are calm, without infected or corpses. The saved campaign retains its rocket selection; the fresh campaign begins with the bat.

| Start / quality | Zoom 1 | Zoom 1.5 |
| --- | --- | --- |
| Fresh / low | [Capture](captures/fresh-low-zoom-1.jpg) | [Capture](captures/fresh-low-zoom-1-5.jpg) |
| Progressed / low | [Capture](captures/progressed-low-zoom-1.jpg) | [Capture](captures/progressed-low-zoom-1-5.jpg) |
| Fresh / high | [Capture](captures/fresh-high-zoom-1.jpg) | [Capture](captures/fresh-high-zoom-1-5.jpg) |
| Progressed / high | [Capture](captures/progressed-high-zoom-1.jpg) | [Capture](captures/progressed-high-zoom-1-5.jpg) |

The same run used physical WASD to reach the APC door, then held E. At tick 3138 (52.3 s) and tick 3662 (61.0 s), sanctuary stayed active, escape/depart pending, gate marker selected, driver absent and passenger count zero. Before the breach there were zero infected; afterward there were 24. The [52-second image](captures/early-apc-52s.jpg) revealed a misleading gold entry ring despite the locked vehicle; `cc2b64d9` subsequently gates that ring. These captures predate that rendering fix and the later checkpoint/alarm/AI refinements and are **not final visual approval**.

## Browser QA needed

Run only in the dedicated QA lane, headless, one browser at a time. [Reusable capture runner](../../../tools/qa/accept/l8-opening-capture.ts): `node --import tsx tools/qa/accept/l8-opening-capture.ts` (one exclusive pooled context, one page, Vite shared optimizer cache; no dist build).

1. **L8 seed 1, first controlled second, start `(0,70)`**: fresh empty storage and progressed persisted L8 save, low/high, zoom 1 and 1.5 (eight cases). Enter through the normal mission button and use physical W. Look for gate objective + distance, correct gold world marker or edge arrow and minimap pin. Confirm calm group and no enemies. At `(7,78)` before tick 3600, objective should say wait with the group; APC marker must not activate.
2. **Early APC attempt, L8 seed 1, driver door near `(96.5,76.5)`, ticks 3125–3140 (~52 s)**: high, zoom 1.5; physically walk the south road and hold E. Expect sanctuary active, escape/depart pending, checkpoint sanctuary, marker at the gate, zero infected, no driver/passengers/entry prompt/gold entry ring. The APC must remain unusable.
3. **Remain at the same door through ticks 3600–3660 (60–61 s)**: high, zoom 1.5. Expect the real breach and infected, checkpoint breach, gate objective/marker still active, alarm says regroup at the gate, no driver/passenger boarding/entry ring. Camping must not skip the gate or set escape-route checkpoint.
4. **Return physically to `(7,78)` after tick 3600, then follow the road to the APC**: low/high, zoom 1 and 1.5. Gate rendezvous should activate escape and move world/minimap guidance to the APC. Fight and survivor evacuation remain in order. Driver prompt/ring should appear only after all living passengers are seated; boarding then activates depart and the L9 handover.

Earlier recapture attempts failed before gameplay in both direct Chromium and the managed pool (`bootstrap_check_in … MachPortRendezvousServer`, error 141, SIGTRAP). No further browser attempt was made after the PO reassigned browser QA.

## Disk cleanup

Removed disposable `test-results/`, temporary dist builds, stale `/tmp` QA baselines/traces and unused receipts. Retained only the linked compact checks and nine earlier JPEGs plus their manifest (under 1 MB); no contact sheet or new dist build. No push or deployment.

## Handoff

Opening guidance and the early-APC sequence fix are implemented and covered by current native/focused checks. Final browser review follows the PO's dedicated-QA rule. Game source ends at `ae818a71`; the capture helper is `c1704921`. No generated acceptance dashboard or raw threat output is retained.
