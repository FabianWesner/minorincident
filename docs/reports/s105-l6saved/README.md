# s105 — L6 survivors saved with courier pressure retained

## Change

L6 perception gives the courier a 6 m target-selection priority over other visible humans. This changes only target choice: infected and weapon stats, damage, survivor health, bot policies, and audit thresholds are unchanged. Infected continue to engage survivors when the courier is outside their perception or focus window.

The original loss ledger was missing the causal event: it watched infected health attacks, while survivor turns are emitted as `outbreak.bite`. The L6 pressure probe now records the bite tick, attacker identity and position for each survivor. The baseline showed ordinary `infected.runner` bites at contact, with 57 losses occurring during retreat. The fixed target preference keeps more of those runners on the courier.

## HIGH seed results

| Run | Complete | Player deaths | Saved | Saved share |
|---|---:|---:|---:|---:|
| Before seed 1 | Yes | 0 | 10/29 | 34.5% |
| Before seed 2 | Yes | 0 | 7/29 | 24.1% |
| Before seed 3 | Yes | 2 | 11/29 | 37.9% |
| **Before mean** | **Yes** | **0.7** | **9.3/29** | **32.2%** |

| After seed 1 | Yes | 1 | 19/29 | 65.5% |
| After seed 2 | Yes | 1 | 12/29 | 41.4% |
| After seed 3 | Yes | 1 | 18/29 | 62.1% |
| **After mean** | **Yes** | **1.0** | **16.3/29** | **56.3%** |

After: all three typical runs complete, deaths average 1.0 (≤3), saved average 56.3% (≥40), minimum 41.4% (≥25). Complete-policy group attack starts per full post-closure 30 s window: seed 1: 4, 6, 27; seed 2: 4, 6, 14; seed 3: 9, 10, 10. Every full window has at least two starts.

## Baseline survivor loss ledger

Each row is the first observed dead/turned status; the bite source position is sampled at the bite event. Coordinates are metres. Full post-change survivor-level receipts are in [evidence.json](evidence.json).

| Seed | Survivor | Cause | Phase | Loss tick (time) | Survivor position X, Z | Attacker source and bite position |
|---:|---|---|---|---:|---|---|
| 1 | shelter-7 | conversion | first | 2129 (35.5 s) | 8.3, -10.9 | infected.runner #69 at 2129 (9.2, -10.0) |
| 1 | shelter-1 | conversion | fails | 3434 (57.2 s) | -9.0, -7.7 | infected.runner #74 at 3434 (-9.6, -8.5) |
| 1 | shelter-9 | conversion | retreat | 3461 (57.7 s) | -5.7, -8.5 | infected.runner #67 at 3461 (-6.7, -8.8) |
| 1 | shelter-16 | conversion | retreat | 3617 (60.3 s) | -4.4, -5.4 | infected.runner #74 at 3617 (-5.3, -5.8) |
| 1 | shelter-20 | conversion | retreat | 4017 (67.0 s) | 21.9, 8.0 | infected.runner #81 at 4017 (22.6, 7.1) |
| 1 | shelter-14 | conversion | retreat | 5135 (85.6 s) | 33.5, 15.7 | infected.runner #90 at 5135 (32.6, 16.1) |
| 1 | okafor | conversion | retreat | 5365 (89.4 s) | 41.8, 16.1 | infected.runner #25 at 5365 (40.8, 16.2) |
| 1 | shelter-10 | conversion | retreat | 5824 (97.1 s) | 66.1, 14.1 | infected.runner #118 at 5824 (67.2, 14.2) |
| 1 | shelter-4 | conversion | retreat | 5915 (98.6 s) | 67.6, 13.5 | infected.runner #118 at 5915 (68.6, 13.8) |
| 1 | dale | conversion | retreat | 5941 (99.0 s) | 58.0, 14.4 | infected.runner #82 at 5941 (57.9, 12.9) |
| 1 | shelter-3 | conversion | retreat | 6040 (100.7 s) | 65.1, 13.8 | infected.runner #103 at 6040 (64.2, 13.4) |
| 1 | mia | conversion | retreat | 6576 (109.6 s) | 84.3, 14.2 | infected.runner #101 at 6576 (83.3, 14.2) |
| 1 | shelter-17 | conversion | retreat | 8166 (136.1 s) | 134.9, 15.6 | infected.runner #17 at 8166 (133.9, 16.1) |
| 1 | shelter-21 | conversion | retreat | 8322 (138.7 s) | 143.3, 14.1 | infected.runner #30 at 8322 (142.4, 13.5) |
| 1 | shelter-18 | death | retreat | 8449 (140.8 s) | 148.5, 14.4 | infected.runner #25 at 8449 (148.8, 15.5) |
| 1 | shelter-6 | death | retreat | 8458 (141.0 s) | 147.4, 14.1 | infected.runner #17 at 8458 (146.9, 15.1) |
| 1 | shelter-23 | death | retreat | 8477 (141.3 s) | 149.7, 15.1 | infected.runner #118 at 8477 (149.3, 16.4) |
| 1 | sam | death | retreat | 10242 (170.7 s) | 212.2, 14.9 | infected.runner #162 at 10242 (211.2, 14.6) |
| 1 | shelter-5 | death | retreat | 10314 (171.9 s) | 213.5, 16.1 | infected.runner #113 at 10314 (212.5, 16.3) |
| 2 | shelter-7 | conversion | first | 2533 (42.2 s) | 8.5, -11.0 | infected.runner #61 at 2533 (9.6, -11.0) |
| 2 | shelter-1 | conversion | first | 2548 (42.5 s) | -6.1, -10.2 | infected.runner #59 at 2548 (-6.1, -11.2) |
| 2 | shelter-9 | conversion | first | 2858 (47.6 s) | -5.7, -8.5 | infected.runner #17 at 2858 (-6.1, -9.4) |
| 2 | shelter-4 | conversion | retreat | 4163 (69.4 s) | 5.4, -2.3 | infected.runner #88 at 4163 (5.4, -3.3) |
| 2 | shelter-20 | conversion | retreat | 4413 (73.5 s) | 22.0, 8.0 | infected.runner #80 at 4413 (22.7, 8.7) |
| 2 | shelter-10 | conversion | retreat | 4576 (76.3 s) | 19.5, 8.3 | infected.runner #80 at 4576 (20.4, 8.6) |
| 2 | shelter-5 | conversion | retreat | 4717 (78.6 s) | 17.9, 9.6 | infected.runner #80 at 4717 (18.6, 8.9) |
| 2 | shelter-15 | conversion | retreat | 4778 (79.6 s) | 17.6, 9.0 | infected.runner #61 at 4778 (17.4, 8.0) |
| 2 | okafor | conversion | retreat | 5253 (87.5 s) | 28.5, 15.9 | infected.runner #59 at 5253 (27.6, 16.2) |
| 2 | mia | conversion | retreat | 6161 (102.7 s) | 55.1, 14.3 | infected.runner #67 at 6161 (54.3, 15.0) |
| 2 | shelter-8 | conversion | retreat | 8619 (143.7 s) | 139.1, 15.3 | infected.runner #81 at 8619 (139.8, 15.9) |
| 2 | shelter-3 | conversion | retreat | 8654 (144.2 s) | 154.8, 14.2 | infected.runner #151 at 8654 (154.9, 15.3) |
| 2 | shelter-13 | death | retreat | 8726 (145.4 s) | 154.6, 14.6 | infected.runner #151 at 8726 (155.8, 15.4) |
| 2 | dale | death | retreat | 8783 (146.4 s) | 149.2, 14.2 | infected.runner #31 at 8783 (148.2, 13.8) |
| 2 | shelter-16 | death | retreat | 8887 (148.1 s) | 154.2, 15.0 | infected.runner #26 at 8887 (153.9, 13.7) |
| 2 | shelter-21 | death | retreat | 8901 (148.3 s) | 154.6, 14.4 | infected.runner #19 at 8901 (155.3, 13.6) |
| 2 | shelter-17 | death | retreat | 9501 (158.3 s) | 177.1, 15.9 | infected.runner #102 at 9501 (176.1, 16.0) |
| 2 | rosa | death | retreat | 9731 (162.2 s) | 185.9, 15.3 | infected.runner #102 at 9731 (184.8, 15.4) |
| 2 | shelter-12 | death | retreat | 10421 (173.7 s) | 204.5, 14.4 | infected.runner #25 at 10421 (204.3, 15.5) |
| 2 | shelter-18 | death | retreat | 10523 (175.4 s) | 209.3, 14.3 | infected.runner #144 at 10523 (208.6, 13.5) |
| 2 | shelter-6 | death | retreat | 10632 (177.2 s) | 213.9, 14.6 | infected.runner #25 at 10632 (213.0, 14.1) |
| 2 | shelter-2 | death | retreat | 10634 (177.2 s) | 212.8, 15.0 | infected.runner #136 at 10634 (212.0, 14.4) |
| 3 | shelter-1 | conversion | first | 3340 (55.7 s) | -6.7, -10.4 | infected.runner #57 at 3340 (-6.4, -11.3) |
| 3 | shelter-7 | conversion | fails | 3582 (59.7 s) | 8.1, -11.0 | infected.runner #69 at 3582 (9.1, -11.0) |
| 3 | shelter-14 | conversion | retreat | 3759 (62.6 s) | 5.7, -8.5 | infected.runner #69 at 3759 (6.6, -8.6) |
| 3 | shelter-17 | conversion | retreat | 3888 (64.8 s) | -4.1, -5.3 | infected.runner #80 at 3888 (-4.8, -6.0); infected.runner #146 at 12032 (204.9, 16.9) |
| 3 | shelter-16 | conversion | retreat | 3920 (65.3 s) | -4.6, -4.3 | infected.runner #84 at 3920 (-5.3, -5.1) |
| 3 | shelter-20 | conversion | retreat | 4299 (71.7 s) | 21.9, 8.0 | infected.runner #86 at 4299 (22.4, 9.0); infected.runner #101 at 10314 (146.0, 16.0) |
| 3 | shelter-10 | conversion | retreat | 4428 (73.8 s) | 19.4, 8.3 | infected.runner #87 at 4428 (20.3, 7.9) |
| 3 | shelter-15 | conversion | retreat | 5184 (86.4 s) | 19.4, 5.8 | infected.runner #101 at 5184 (20.3, 5.3); infected.runner #118 at 10529 (149.2, 13.7) |
| 3 | shelter-5 | conversion | retreat | 5247 (87.5 s) | 17.6, 5.7 | infected.runner #99 at 5247 (17.7, 6.8); infected.runner #117 at 12224 (210.9, 16.0); infected.runner #96 at 14047 (260.0, 15.5) |
| 3 | shelter-4 | conversion | retreat | 5690 (94.8 s) | 5.1, -1.8 | infected.runner #30 at 5690 (5.1, -2.8) |
| 3 | mia | conversion | retreat | 6985 (116.4 s) | 32.8, 14.2 | infected.runner #69 at 6985 (31.9, 14.7) |
| 3 | dale | conversion | retreat | 7913 (131.9 s) | 66.1, 14.5 | infected.runner #104 at 7913 (65.0, 14.4) |
| 3 | okafor | conversion | retreat | 8486 (141.4 s) | 84.8, 15.7 | infected.runner #96 at 8486 (83.8, 15.8) |
| 3 | shelter-21 | conversion | retreat | 8722 (145.4 s) | 89.3, 13.1 | infected.runner #106 at 8722 (88.3, 12.9) |
| 3 | shelter-23 | conversion | retreat | 10078 (168.0 s) | 137.6, 15.8 | infected.runner #107 at 10078 (136.7, 16.4) |
| 3 | shelter-18 | conversion | retreat | 10209 (170.2 s) | 141.7, 14.4 | infected.runner #67 at 10209 (140.7, 14.2) |
| 3 | sam | death | retreat | 10937 (182.3 s) | 164.7, 15.2 | infected.runner #85 at 10937 (163.7, 15.2) |
| 3 | rosa | death | retreat | 11896 (198.3 s) | 200.6, 15.9 | infected.runner #117 at 11896 (199.7, 16.3) |
| 3 | shelter-11 | death | retreat | 12129 (202.2 s) | 208.6, 16.2 | infected.runner #133 at 12129 (209.0, 15.0) |
| 3 | shelter-12 | death | retreat | 12201 (203.3 s) | 208.9, 13.9 | infected.runner #146 at 12201 (209.2, 15.0) |
| 3 | shelter-6 | death | retreat | 12353 (205.9 s) | 217.0, 14.4 | infected.runner #149 at 12353 (216.0, 14.4) |
| 3 | shelter-2 | death | retreat | 12442 (207.4 s) | 220.4, 16.2 | infected.runner #157 at 12442 (219.4, 16.5) |
| 3 | shelter-22 | death | retreat | 12571 (209.5 s) | 218.8, 15.3 | infected.runner #96 at 12571 (218.1, 16.0) |

## Threat and validation

- L6 threat audit: skilled route completed and took 55 HP damage; no `SKILLED_DAMAGE_BELOW_30_HP`. L6-specific flags: L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS. The breach-two first-attack timing flag is retained. The selected-level audit adds its standard `PARTIAL_LEVEL_SELECTION` diagnostic because only L6 was requested.
- Audit wave observer ignores already-consumed zero-member warnings and treats remaining arrivals canceled by a closed hatch as intentional, not a missing spawn. It does not change wave thresholds.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS locally; 27 files, 107 passed, 150/150 inventory, 104 seconds within the 240 second budget.
- `sh tools/remote/run.sh "$PWD" -- npm test`: PASS on 46.225.66.90; 27 files, 106 passed / 1 skipped, unchanged 150/150 inventory; 220.1 seconds within the 240 second budget. The earlier restricted-network attempt was superseded by this successful run.
- Browser QA needed; no browser run.

See [evidence.json](evidence.json) for the raw before/after per-run receipts and all survivor losses.
