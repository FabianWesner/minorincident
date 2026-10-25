# Visual QA 17: lane/courier-gear-tex @ d7296385f (courier tier gear) vs PROD 58350fede

**Verdict: GO.** I found no P1 and no load regression (L1, worst of 3: 2438 ms vs PROD 2559 ms). The gloves read as dark gloves with teal cuffs, and vest, pads, goggles and headlamp all read. Tiers t1 to t4 progress visibly on both couriers (01–04). Nothing floats, clips or tears in walk, run, bat, pistol, MG or bike (05) at zoom 1 and 1.5, on WebGPU and WebGL2, low and high. The lane's three notes (angular right glove tip, lumpy armholes, his watch above the cuff) do not show at game-camera zoom 1 or 1.5 in any capture, so they are not P1.

- **Gate:** WebGPU pipeline smoke (`tests/e2e/webgpu-pipelines.spec.ts`, unflagged): 4/4. My in-level runs used the same flags at tiers 0–4: 0 console or pipeline errors.
- **Gate:** `qa:invariants`: sim 28/28 (remote), render 12/12. All ten level loads are ≤ PROD.
- **Gate:** gear catalog: 72/72 WebGPU + 72/72 WebGL2 = 144/144. Attachment gap max 1.5 cm (gate 2).

**Play:** a real-input campaign, male, WebGPU low, zoom 1. L1 finished in 145 s with 0 deaths; the handover into L2 and the fire-truck ride work (07). I stopped the run in L2 for the 21:51 quiet window. A scripted real-input pass covered L1/L6 × both couriers × t0–t4, plus a Scene Lab bike ride and the L6 headlamp at t4 (06). The car was not checked: my spawned sedan never registered an entry.

- **Q-184 (P3, known):** his t1→t2 vest barely shows on the orange shirt (02, 03); t3/t4 read well.
- **Q-185 (P3, tooling):** `__SS__.survivor.select('male')` in a loaded L1 never loads the male model (invisible). PROD does the same; the menu flow is fine.
- **Q-186 (P3, driver):** the L2 playtest driver stalls at the fence near the excavator ("Reach the police checkpoint", 137 m). This is not related to the gear.
