# s162 — L6 real-input escort (interim)

Headless WebGPU, zoom 1.5, level start, mortal, no skipped objectives or manual corrections. HIGH ran before LOW. The driver follows visible survivors and prioritizes infected in contact with them; it attempts E when the HUD says the gate is clear.

| Tier | Out / 29 | Player deaths | Manual assists | Confirmed gate closures |
| --- | ---: | ---: | ---: | ---: |
| HIGH | 16 (55.2%) | 14 | 0 | 2/3 |
| LOW | 19 (65.5%) | 11 | 0 | 1/3 |

**Verdict: inconclusive against the 60% competent-player target.** HIGH misses and LOW reaches it, but repeated deaths and incomplete gate closure show the driver is not yet a competent escort. Losses begin in the shelter and continue at the tunnel entrance; the reviewed [frame](shelter.jpg) shows the group, a nearby infected, the loss alarm and exit direction. A human could respond to those visible cues, but these samples do not establish which individual losses were preventable. Game-side candidates for follow-up are shelter threat readability and gate prompt/interaction persistence; neither is established as a defect by these runs. No gameplay change was made.

The result receipts, renderer, zero logged assists, gate attempts and final gate states are in [qa.json](qa.json). A shelter-rest P2 is a driver stall warning during the intentional rest. Typecheck, lint and remote unit suite passed (105 passed, one platform skip, 150/150 inventory). L1 LOW WebGPU smoke completed in 159 s with one death, one logged navigation assist and no issues. Gate interaction and tunnel survival require further driver work before a final verdict.
