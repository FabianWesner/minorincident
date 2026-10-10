# Existing peer evidence

Copied read-only on 2026-10-10 from `/private/tmp/minorincident-continuity-before-4970/test-results/epics/E20/`. That checkout reports HEAD `4970fa9e` and an empty `git diff --name-only`. The continuity lane independently produced these batteries; epic-closeout did not launch them. Raw values are preserved, including invalid negative control latencies from the pre-fix collector.

- Complete: 20/20 finished, median 141.5417 s, median deaths 0.
- Newbie: 20/20 finished, median 219.1083 s, median deaths 3. This fails E20-AC03's maximum 1.
- Complete calm: zero infected/combat, alarm 20.03–29.93 s, crew reaches truck in 1.6 s.
- Complete rides: passenger, continuously seated, 16.57 s, crew exits 0.8 s. Some reported control latencies are negative because checkpoint restores rebase mission tick fields.
- Complete reveal: zero infected near forecourt before opening; first civilian 0 s; first visible infected 0.05 s; 12–21 emerge in three seconds; all civilians out 10.63 s.
- Complete perception audit: zero sight violations, non-sight alerts, far/seen emergence events in all 20 reports.
- Complete gate: closes 0.6 s, zero infected crossings in all 20.

Do not substitute the continuity worktree's own reports: its source differs from this baseline and changes bot outcomes. No no-axe/idle/aggressive baseline evidence is claimed here.
