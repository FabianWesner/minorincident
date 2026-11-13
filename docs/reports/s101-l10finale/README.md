# s101-l10finale — incomplete investigation

**FAIL / goal not achieved. Browser QA needed.** Time box reached; unsuccessful gameplay experiments were reverted. This commit contains investigation evidence only.

Native complete-policy baseline runs for HIGH and LOW seeds 1–3 completed. Their route/death summaries are in [investigation.json](investigation.json). The original s100 HIGH seed 3 receipt remains the authoritative exact finale measurement: 65.70 s, three attack starts, 15.68 s head and 46.48 s tail. No bot policy or observer thresholds were changed.

| HIGH seed 3 | Before | Rejected reservation trial | Rejected slower trial |
| --- | ---: | ---: | ---: |
| Route completes | yes | yes | yes |
| Player deaths | 2 | 3 | 2 |
| Attack starts in sampled finale window | 3 (exact s100 window) | 39 (sampled window) | 1 (sampled window) |
| Acceptance | FAIL tail | FAIL extra death and long gap | FAIL long tail |

Sampled windows use the existing s93 trace's 300-tick samples and are diagnostic, not exact installation/release receipts. Do not interpret them as passing finale evidence.

## Findings

HIGH's outpaced pressure sprinters remain far from the console in wander/attracted states and occupy the resident budget. Dormant actors also wake into newly available capacity. `ChunkResidency.wakeInside` checks the raw director cap without subtracting reserved slots or pending turns. Thus reservation-only experiments did not protect authored assault capacity. Making both sleep/wake admission honor reservations allowed authored assault actors to enter, confirming a capacity interaction, but eight accumulated attackers increased seed 3 deaths from two to three. Six admissions spaced eight seconds apart preserved deaths but did not sustain attack starts. Neither candidate is retained.

Other rejected trials included closer assault slots, more frequent waves, higher population caps, and retargeting pressure hunters. None proved all required constraints. No zombie or weapon stats were edited; no corpses were removed.

## Open work

Find a director/layout solution that sustains contact without the additional death. Validate exact finale head/inter-start/tail gaps for all six native routes, route completion and baseline death counts, and the journey adjacent-gap ≤45 s gate. Run the L10 threat audit, typecheck, lint and the unchanged remote unit suite. These final checks were not run because no acceptable gameplay candidate was established. No browser, deployment, push or main movement occurred.
