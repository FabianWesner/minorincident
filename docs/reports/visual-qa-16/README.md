# Visual QA 16: lane/batch16 @ 5c6119791 vs PROD a2fee5bb0 (batch 14)

**Verdict: GO.** I found no P1, no perf regression and no functional regression against PROD.
- **Male courier:** reads well and is clearly better than PROD's palette male in every A/B frame (01).
- **Heroine:** unchanged. The female A/B scores 0.00 % on 12/12 frames.
- **Risk for the PO (Q-179, P2):** the suit zombie that replaces `inf.common-worker` turns the crowds into a uniform dark mass. At close zoom and low quality its silhouette breaks into dark shards (02), and at night it nearly disappears (03). This is the PO's own asset and an intended change, so it does not block. Treat it as the main open "is it stunning?" question for this batch.

Build: `lane/batch16` (5c6119791), `npm run build`. Preview on 3999, one GPU browser at a time; the Scene Lab catalog ran its default two contexts. Default settings were WebGPU, low and zoom 1.5. In this game, zoom 1.5 is the wider view and zoom 1 the closer one.

## Gates
- `npm run qa:invariants:sim:remote`: **8 files / 28 tests green**. Wave census authored = spawned = reached on both tiers.
- `npm run qa:invariants:render` (Mac): **12/12 green**. Single loads, candidate vs PROD in ms:

  | Level | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
  | Candidate | 2584 | 3103 | 3395 | 3815 | 4726 | 2315 | 3892 | 4362 | 9177 | 6500 |
  | PROD | 2583 | 3403 | 3395 | 3948 | 4944 | 2932 | 4144 | 4569 | 9242 | 6776 |

  L9 and L10 are over 6 s in this harness on both builds. That is not new.
- **Perf, worst of 5 cold loads** (`tools/perf/cold-load-time.ts` through `quiet-run.sh`, WebGPU low, fresh profile each, 10 s of real movement on the last sample). PROD is served by the CDN and the candidate by the local preview.

  | Level | Candidate median / max | PROD median / max | Max post-card frame, both |
  |---|---|---|---:|
  | L1 | 2293 / 2427 ms | 2587 / 3109 ms | 33 ms |
  | L4 | 3795 / 3821 ms | 3832 / 3855 ms | 117 ms |
  | L10 | 5721 / 5760 ms | 5883 / 5984 ms | 17 ms |

  Every worst load is ≤ 6 s, no median is slower, and there are 0 errors.
- **`npm run qa:ab`, male:** `--survivor male --levels L1,L4,L10`. 32/32 measured, 22 changed, 0 errors. I reviewed every changed sheet.
  - Every change is the new male courier, or a suit zombie where PROD shows a common worker: depot, lab sign/return, park, fire station, L4 alarm/tank/civilians, L10 start/gate/finale.
  - Same scene otherwise: tank route, sitters, clerk and technician are all unchanged.
- **`npm run qa:ab`, female:** `--levels L1,L7 --stops depot-contact,lab-sign,l7-`. 12/12 frames at 0.00 %, so the heroine is unchanged. The L7 stops contain no infected, so the suit zombie in L7 is covered by the playtest only.
- **Scene Lab, 111/111 pass:**
  - `qa-courier-m-*` + `qa-courier-tex-look-z15` on WebGPU, high+low × zoom matrix: 72/72;
  - `qa-courier-m-*` on WebGL2 low: 21/21;
  - courier-gear male, e18 courier, inf-looks, inf-horde-headwear, night-bodies-eyes, corpse-look-close, e18-l4-corpses, alpha-hit-corpse-worker and corgi-tongue-male on WebGPU low: 18/18. The gear attachment gap is ≤ 1.3 cm against the 2 cm gate.
  - I opened the gear t0–t4, attack, headlamp, canister, look, horde and corpse sheets.

## Real-input playtests (tools/playtest, WebGPU low, male)
- **L1–L3, campaign from a new game, zoom 1.5:** 3/3 finished, 0 skips, 0 issues. L1 took 135 s (1 death), L2 107 s, L3 212 s. No gameplay frame went over 200 ms; only loading-card frames did.
- **L7, debug entry, zoom 1:** finished in 170 s with 0 issues.
- **L10, debug entry, zoom 1, to the credits:** finished with `completedLevels 10` and credits done, 0 deaths. The driver skipped the 150 s epilogue only because my 20-minute level cap ran out (Q-182). There was one gameplay frame of **467 ms at the Mega fight** (Q-180).
- **Zoom 1.5 with debug entry:** the driver asserts at L7 and L10 because its wheel input arrives during the scripted intro camera (Q-181). So L7 and L10 were played at zoom 1.

## Male courier (P1 rules)
- **Locomotion and combat:** walk/run gait, all four melee attacks, hit-react, army MG, bike and carry pass on WebGPU (high and low, zoom matrix) and on WebGL2. There is no clipping, no gear lift-off and no foot slide in the sheets.
- **Gear tiers 0–4 (04):** cap, goggles, the helmet stripes at tier 4 and the rocket launcher read well. Tiers 1–2 read quietly on his busy shirt; this is known.
- **Headlamp, canister, portrait:**
  - L6 headlamp: the cone is visible.
  - L10 canister: it sits on the back, above the bag.
  - The HUD portrait shows the new curly-haired male.
- **In game (01, 06, 07, 08):** orange shirt, teal bag and cargo pants stay readable by day and by night. He is better than PROD's palette male.

## PO checklist (WebGPU low, A/B vs PROD, male save)
| Line | Result |
|---|---|
| P1-107 L1 load ≤ PROD | PASS: worst of 5 is 2427 ms vs 3109 ms |
| P1-108/115 hats/glasses | PASS: invariant green, l1-glasses 0 % |
| P1-109 depot clerk | PASS: unchanged except the courier |
| P1-110 lab handover | PASS: unchanged except the courier |
| P1-111 bike on courier side | PASS: l1-bike-rack 0 % |
| P1-112 seated NPCs | PASS: invariant |
| P1-116 L4 tank vs barrier | PASS: same route and pose |
| P1-118/119 L4 alarm count | PASS: invariant census |
| P1-117 corpses up close | PASS, with Q-179 reservations: suit corpses lie flat and textured |
| Q-126 no frame > 200 ms on L1/L2 | PASS |
| Q-147 L10 slam telegraph | Not reached at the close views |

## Per level: glitches / stunning (1–10)
- **L1** 7: none.
- **L2** 7: none.
- **L3** 7: none.
- **L4** 6: the suit horde is a dark uniform mass at z1 (Q-179).
- **L7** 6: none new.
- **L10** 6: the suit zombie is hard to see at night (Q-179), there is a 467 ms Mega-fight frame (Q-180), and the dispersal-complex approach is still an empty plain (05, known Q-150).

## Findings (ready to paste)
- **Q-179. P2 readability (suit zombie, intended asset).** The TRELLIS suit zombie that replaced `inf.common-worker` makes most crowds look the same: dark navy suit, pale head.
  - At low quality and zoom 1 its silhouette breaks into dark shard-like fragments. PROD's chunky colourful workers read as separate bodies (02, L4 tank hold).
  - At night (L10 gate, 03) he is nearly black against the road, and his eye cores are not visible from behind.
  - The PO should judge whether this look is acceptable. A lighter suit tone, or the solidify stage (lessons learned, 10-24), would help.
- **Q-180. P2 perf hitch.** By real input, one gameplay frame took 467 ms at L10 tick 68110 (4010, −33), step `mega`, WebGPU low, male. Batch15's campaign showed 900 ms at the same place (3999, −23). I did not measure PROD here. It breaks the "no gameplay frame > 200 ms" rule, so it needs a PROD replay at the Mega death.
- **Q-181. P3 tooling.** In `tools/playtest`, with `--entry debug` and `--zoom 1.5`, the L7 and L10 sessions fail the "Requested zoom 1.5, observed target 1" assertion. The wheel burst arrives while `View` ignores the wheel (`blendTarget`/`scripted` intro). Also, `--mode continue` without a save times out on the disabled continue button; it needs `--entry debug`.
- **Q-182. P3 tooling.** The L10 driver reports a P0 "cannot-finish" on `epilogue`: the 150 s watch step is skipped once the level cap is hit. It also reports a P1 "hidden-condition" after 120 s on the credits, which do finish (`credits-finished`, `completedLevels 10`). Exempt watch-only steps from the stuck and cap logic.

## Captures
- 01 L1 depot, PROD vs candidate male;
- 02 L4 hold horde at zoom 1;
- 03 L10 gate at night, suit zombie (PROD left);
- 04 male gear t0/t2/t4 low and t4 high;
- 05 L10 approach, empty plain;
- 06 L10 epilogue;
- 07 L3 highway;
- 08 L7 rocket and corpses.
