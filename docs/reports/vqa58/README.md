# vqa58: Opus visual QA of batch 58 before deploy

Main `5ce2a27e` (after `lane/perf10`). QA build (`npm run build:qa`), 2026-11-07 18:25–19:25 CET. Findings only, no game code changed.

**What changed since PROD.** PROD and the QA env both run batch 57 (`213b848`, deploy log 18:10/18:15). Batch 58 adds only `lane/perf10`:
- death poses repaired in preparation workers;
- shared corpse palette graphs;
- L10 Alpha shader reuse between hero and far LODs;
- rigid skin copy;
- parallel civilian weapon-prop downloads.

The other items in the brief (L1 bike/fence/slip, L3 ramp joint and coaches, L7 boarding queue, rocket prewarm) were already in batch 57. I checked them anyway, because no Opus visual QA had covered them yet.

## Verdict: GO for an interim PROD deploy (PO 11-03 rule), not a strict-acceptance release

- **perf10 caused no visual regression.** The same staged corpse ring, overlap pile and brute kills ran on batch 57 (QA env, test hooks) and on batch 58 (local dist), on WebGPU at low and high, zoom 0.5 and 1:
  - L10 and L1 corpses are pixel-identical in pose and colour;
  - L3 shows the same bodies, but two lie in slightly different spots;
  - there are no black or white bodies and no wrong palettes;
  - WebGL2 and WebGPU match (spots-full, both tiers).
- **No new P1.** Nothing new was found on the player, the companion or a vehicle the player uses.
- **The strict rule is still not met.** "Every row PASS, no P1/P2" fails on P2s that batch 57 already has (below).
- **Not verified:**
  - **L9:** the real-input run stalled twice at the first step photo (more below). L9 APC smoke was not seen in any frame.
  - **`qa:ab` tour:** it never finished. On the batch-57 side it needed more than the 595 s browser reservation to reach the first L1 stop, and the L3 army pull-back stop was never reached. The corpse A/B probe (`tools/qa/vqa58-corpse-ab.ts`) stood in for it.

## Per level

| Level | Glitches (severity, repro) | Stunning? | Boring / harmless / babysitting |
|---|---|---|---|
| L1 | **P2 (inherited, same in b57):** a corpse that dies against the raised planter edge at the start corner stands folded upside down, legs in the air (high; it is tilted at low). Repro: `tools/qa/vqa58-spots.ts` corpses L1, kill ring 3.5 m around the start. Seen at zoom 0.5 and 1 on both backends.<br>**P2 (needs a human repro):** fresh save, bat, WebGL2 low. The courier stayed pinned at (−75.0, 38.7), 3 m from the fire-bay ring, for 208 s (god mode). Six runners stood at 1.08 m and took no damage from 8 s of swings ("enemy-unhittable"), and a corpse lay on the ring. The progressed-save run with a gun finished L1 in 145 s. It could be the driver; check it by hand with bat-only, fresh save.<br>No defects in the new back-lane fence panels: upright, continuous, no floating or slanted panels from the street, lane or excavator side at zoom 0.5/1/1.5.<br>The bike did not auto-mount at the depot (t954, "Hold still or press E" is the parcel). | Yes. The warm morning streets, the Annex delivery, the clerk handover and the explosion beat look good. | Fine. A real chase starts at the Annex. |
| L3 | **P3 (known):** a blue car still sits on the deck near x≈177, nose into the parapet.<br>**P3:** a large flat yellow objective triangle overlaps the checkpoint wall at arrival (t8389).<br>The infected police corpses at the station are very dark navy, almost silhouettes. Same model colour as the live cops, not a palette fault.<br>The ramp joint near x177 is continuous asphalt, with no wedge (t7441, both zooms).<br>Both checkpoint coaches show seated passengers in the windows (production build, t8389). | Yes. The smoke, the hardware-store horde and the raised corridor at sunset are strong. | The horde at Maple Hardware is a dense blob around the corgi (t4346), but it fights. |
| L4 | **P3 (uncertain):** one corpse appears to lie across the queue rope posts at the registration tables (t13280).<br>The dense corpse field reads as bodies (t11127, t13280). A large grey lump near the courier is probably a brute/Alpha corpse. | Yes. The hold with hundreds of bodies, the convoy and the plaza look good. | Not harmless. The breach waves reach the tables. |
| L7 | **P2 (inherited, vqa-4 #2/#4):** survivor losses.<br>• Fresh save, WebGL2 high: the courier is mobbed at the truck and needs about 15 s to close 3 m to the launcher. The group drops 24 → 7 before the corridor and only 2 board.<br>• Preset save, WebGPU low, male: the group drops 24 → 13 within 6.5 s (t4571–t4964) when red-ring attackers and a point-blank rocket blast hit the column.<br>**"All 24 board" is not met in either run.**<br>The boarding queue south of the bus forms tidily (t10219). The rocket pickup and first shot were fine in the preset run. The fireball is a soft disc, no torus (t8937). | Yes. The ash-fall night, the fires and the long column look great. | **Babysitting / harsh.** "Survivor lost behind you!" shows while the group is all nearby (t4097, t4571). |
| L9 | **Unverified.** The real-input run stalled twice right after the first low-quality photos at tick 8, then the pool closed the page after about 10 min. A staged low→high→low→high switch at the same moment did not hang on b58 (1.7 s) or b57 (2.0 s) (`tools/qa/vqa58-l9-switch.ts`), so the playtest harness is the likely cause.<br>The staged APC drive shows no smoke because the APC was undamaged. | The APC with headlights reads well at zoom 0.5. | n/a |
| L10 | No new glitch.<br>The apron corpse carpet at the console defence reads as bodies, not shards. Rocket-blast victims are whole, and WebGL2 low matches WebGPU (P1-117 fixed).<br>Alpha and corpse colours are identical between b57 and b58 on both backends.<br>**P3 (inherited, staged only):** red brute rings stay drawn around brutes killed with `cheats.killAll` (L1, L3, L10; same on b57). This may be an artifact of the staging. | The console defence with rocket blasts is a spectacle. | **Boring (inherited, vqa-4 #7):** the overland walk and the corridor to the dispersal complex are empty dark grass for minutes. |

## Method

- **Real input** through the shared browser pool. God mode was on for the courier only, with `PLAYTEST_REVEAL_AUDIT=1`. Each run took unpaused frames every 4–5 s, plus per-step photos at low/high × zoom 1.5/1/0.5 (`z0-5` is the closest framing). Runs:

  | Level | Save | Backend / tier | Survivor | Weapon | Result |
  |---|---|---|---|---|---|
  | L1 | L8-default progressed | WebGPU high | — | — | finished |
  | L1 | fresh | WebGL2 low | — | bat | not finished: fire-station pin |
  | L3 | L3-default | WebGPU low | male | — | finished |
  | L4 | L4-default | WebGPU high | — | — | finished |
  | L7 | L7-default | WebGPU low | male | rocket | finished |
  | L7 | fresh | WebGL2 high | — | rocket | finished |
  | L10 | L10-default | WebGPU high | — | — | stopped at the 9 min cap, research approach |
  | L10 | tracked corridor checkpoint | WebGL2 low | — | rocket | reached the console hold at 52/60 s charge before the pool closed the page |
  | L9 | L9-default | WebGPU low | — | — | stalled, twice |

- **Staged spots** (`tools/qa/vqa58-spots.ts`, Scene Lab, WebGPU and WebGL2 × low and high × zoom 0.5/1/1.5):
  - corpse ring, overlap pile and brutes in L1/L3/L4/L7/L10;
  - L1 back-lane fence from the street, lane and excavator sides;
  - L9 APC drive.
- **Corpse A/B against batch 57:** `tools/qa/vqa58-corpse-ab.ts` against `https://qa.minor-incident.pages.dev` (batch 57, test hooks) and the local dist.
- **Evidence:** I looked at every image this report cites, as sheets and as full-size crops. Captures are in `test-results/vqa58/` (git-ignored). The contact sheet is `test-results/vqa58/sheets/vqa58-contact.jpg`.
- **Side effect:** I stopped one of my own pool runs with `pkill`. That may have closed the shared pool browser once (lessons-learned 11-07: "Killing one route-probe closes the shared pool browser"). Later page closures happened at about 10 min per lease.
