# s162 — L6 real-input escort

Headless WebGPU, zoom 1.5, level start, mortal, no skipped objectives or manual corrections; HIGH preceded LOW. The driver covers visible contact threats, follows the column, uses the axe against close crowds and attempts E at the clear-gate HUD instruction.

| Tier | Out / 29 | Player deaths | Manual assists | Confirmed gate closures |
| --- | ---: | ---: | ---: | ---: |
| HIGH | 16 (55.2%) | 3 | 0 | 3/3 |
| LOW | 18 (62.1%) | 4 | 0 | 2/3 |

**Verdict: HIGH misses the 60% target; LOW reaches it.** The sampled driver is improved but the missed LOW gate and deaths limit a confident human-player verdict. In each run five were already turned at retreat start; by the first gate HIGH had ten turned and LOW nine. The final counts include further tunnel and exit losses. The reviewed [frame](shelter.jpg) shows the group, nearby infected, loss alarm and exit direction: a player could respond to these visible cues, though the snapshots do not establish which individual losses were preventable. Candidates for game-side investigation are shelter threat readability and gate prompt/interaction persistence; these runs do not prove either is defective. No gameplay change was made.

[qa.json](qa.json) records result receipts, renderer, zero logged assists, gate attempts and final gate states. The P2 is a driver stall warning during intentional shelter rest. Typecheck, lint and remote unit suite passed (105 passed, one platform skip, 150/150 inventory). L1 LOW WebGPU smoke completed in 159 s with one death, one logged navigation assist and no issues. At the time-box limit, reliable LOW gate closure and the competent-human save rate remain open and unmeasured. Later HIGH-only gate-wait and shotgun experiments did not finish with a better result and were reverted.
