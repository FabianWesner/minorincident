# Visual QA 13j: lane/gate-13j @ afb864015 vs PROD 73bce8bc5

**Verdict: NO-GO, by the rule "any STILL BROKEN P1 checklist line".** The one line is P1-117: corpses must look like bodies up close. Alphas now fall on their faces and the crater/maw is hidden, but the boots still stick straight up as two large brown slabs, and the Mega Alpha corpse is a red lump with a pale ball (08, 09). Every other PO line, P1-107…P1-119, is FIXED, and I found **no regression against PROD**. The candidate is better than PROD on every line I checked, and nothing I saw affects the player, the companion or the player vehicle. Whether to ship it as a strict improvement is the orchestrator's call.

Build: `git checkout --detach afb864015`, then `lane/qa-ab` (d695aea90) merged for `npm run qa:ab`. That merge is tools only; on the remote-cache test conflict I kept the 13j side. Then `npm install` and `npm run build`. Settings: WebGPU, low, zoom 1.5 (A/B also at zoom 1), headless. One browser at a time through `tools/e2e-lock.sh` (E2E_UNITS=1).

## Tools
- `npm run qa:invariants:sim:remote`: **8 files / 27 tests green** (accessories, seats, cast visibility, vehicles vs solids, wave counts, objective marker, walkable height).
- `npm run qa:invariants:render`: **11/11 green**. Single cold load, level click → playable, WebGPU low, candidate vs PROD in ms: L1 2428/2500, L2 3037/3153, L3 3366/3566, L4 3612/4063, L5 4551/4990, L6 2259/3399, L7 3624/4144, L8 4245/23677, L9 8461/9611, L10 6257/9112. The candidate is faster on all ten levels. L9 and L10 are above the separate 6 s absolute budget. That budget was not part of this run: it needs 20 cold loads.
- `npm run qa:ab -- --candidate dist --levels L1-L4`: 32/32 measured, 26 above the 2 % threshold, 0 errors. I reviewed every changed sheet:
  - Intended fixes: lab sign and lab return (the technician stays visible), depot return (the clerk is visible walking in), L2 ride start (benches under the sitters), both L3 ramp wedges filled, L4 tank off the barrier wall, L4 civilians stand and aim.
  - Same picture with sim drift: L4 alarm, L1 park and glasses.
  - Not useful: the `l3-army-pullback` stop never reaches the pull-back (the courier waits by a horde at 50 m on both sides). I replaced it with my own real-input approach A/B (05).
- Own probes (helper scripts, not committed): full-resolution burst A/B at the tour stops, and an L3 army-line approach holding D+S.
  - The bike-dismount browser probe was inconclusive (the mount did not hold in my setup). `tests/sim/bicycle-fence-side.test.ts` passes remotely: more than 400 dismount cases, all on the courier side.
- Scene Lab, WebGPU low: 17/17 pass for corpse-look-*, polish-*-corpse, alpha-hit-corpse-*, alpha/mega variants, telegraph-alpha-slam, l10-q1-mega-slam, ped-hats-*, inf-horde-headwear, e18-l4-corpses and seat-grip-coffee. I opened every sheet.

## Real-input playtest (tools/playtest, WebGPU variant of the driver, low, z1.5)
- Campaign from a new game, female: L1→L4 all finished with 0 skips and 0 driver issues. L1 222 s (3 deaths), L2 138 s (2), L3 168 s (0), L4 264 s (0).
- Frame hitches: 266 ms at L1 tick 1909 and 450 ms at L2 tick 285. PROD was not compared (Q-126).
- Continue mode, male, debug entry: L5 151 s, L6 241 s, L7 94 s, L8 72 s, L9 235 s, all finished with 0 skips.
- L10: with only the fire axe, the driver could not kill the Mega Alpha. The debug skip of `mega` loops release→mega (Q-128), so I stopped the run.
- Q-120 looks fixed: a death in the boss step now returns to "Kill the Mega Alpha", not to a fresh 60 s charge.
- L6 fists (male, seeded fists save, `l6-weapons.sh … fists`): finished in 247 s with 2 deaths and 0 skips, no soft-lock.

## PO checklist (WebGPU low z1.5, A/B vs PROD)
| Line | Result | Evidence |
|---|---|---|
| P1-107 L1 load ≤ PROD | FIXED | 2428 vs 2500 ms; all levels faster |
| P1-108/115 hats/glasses on head | FIXED | 10; accessory invariant green; L4 hold crowd at z1.5 |
| P1-109 depot clerk walks back, nobody vanishes | FIXED | 02: PROD clerk half-vanished at the door, candidate fully visible walking in. The door stays open while the courier stands beside it, same on PROD |
| P1-110 lab handover | FIXED | 01: PROD technician vanishes at handover, candidate signs, then walks back in through the doors |
| P1-111 bike on courier side | FIXED (sim) | Remote sim test green; not confirmed visually |
| P1-112 seated NPCs have a seat | FIXED | 03 |
| P1-113/113b L3 deck gaps | FIXED | 04; both wedges closed. A thin dark seam remains on the west ramp (Q-129) |
| P1-114 L3 ring/marker during pull-back | FIXED | 05: PROD marker hidden from x≈195, candidate ring and diamond visible all the way |
| P1-116 L4 tank vs barrier | FIXED | 06 |
| P1-118/119 L4 alarm wave count, civilians not at wall | FIXED | Wave invariant green; 07: the hold is full of infected, civilians in mid-plaza |
| P1-117/#85 corpses look like bodies up close | **STILL BROKEN (improved)** | 08, 09 (Q-124) |
| L6 fists finishable | FIXED | 247 s, 2 deaths |

## Per level: glitches / stunning (1–10)
- **L1** 7: no P1. 266 ms hitch.
- **L2** 7: no P1. 450 ms hitch at ride start.
- **L3** 7: no P1. West-ramp seam line.
- **L4** 7: no P1. Alpha corpse boots-up slabs in the plaza, and a dead Alpha keeps an empty HP bar (Q-125, 07/12).
- **L5** 6: no glitches seen. The driver spent 20–33 s finding the wrecked-bus and pharmacy rings (readability; the ring sits between the bus and the fence).
- **L6** 7: no glitches seen.
- **L7** 6: the end shot shows the map edge (11, Q-127).
- **L8** 6: no glitches seen.
- **L9** 4: no glitches, but the night drive is an empty black void around the APC.
- **L10** 6: the Mega Alpha alive and attacking reads well; its corpse does not (09).

## New findings (for epics-pipeline/po-bugs-1019.md; the worktree sandbox blocked my direct append)
- Q-124. P2 (P1-117 still broken, improved) Corpses up close: Alphas now lie face down, so the maw/crater is hidden, but both boots stick straight up as two big brown slabs and dominate the silhouette (Scene Lab corpse-look-alpha; L4 hold at z1.5). The Mega Alpha corpse is a red lump with slabs and a pale ball and does not read as the creature (polish-mega-corpse). Captures 07–09.
- Q-125. P2 A dead Alpha keeps an empty HP bar floating above its corpse for at least 4 s (alpha-hit-corpse-base f60–f240; L4 hold t5469 beside the corpse). Not compared with PROD. Capture 12.
- Q-126. P2 Gameplay frame hitches by real input, WebGPU low z1.5: 266 ms at L1 tick 1909 (9.5, −32.7, deliver leg) and 450 ms at L2 tick 285 (−71.2, 39.5, ride start). The gate allows no frame over 200 ms. Not compared with PROD.
- Q-127. P3 L7 end cinematic (pull-back to the evacuation buses): dark rectangles of void along the top edge of the frame, so the map edge shows past the fog. Capture 11.
- Q-128. P3 tooling: the L10 playtest driver, with only the fire axe, cannot kill the Mega Alpha. The debug skip of `mega` moves on to "Release the cure", the still-alive boss kills the courier, and the step returns to `mega`. This loops endlessly past the level cap (I stopped the run).
- Q-129. P3 L3 west ramp/deck junction: the filled wedge leaves a thin dark seam line across the deck (capture 04).

## Captures kept (12)
01 lab return · 02 depot clerk · 03 L2 benches · 04 L3 wedge · 05 L3 ring pull-back · 06 L4 tank · 07 L4 hold with Alpha corpse · 08 Alpha corpses · 09 Mega corpse · 10 hats/glasses close · 11 L7 map edge · 12 dead Alpha HP bar. Each A/B pair shows PROD on the left and the candidate on the right.
