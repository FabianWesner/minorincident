# vqa-3: Opus visual QA of L1–L5 before deploy

Main `be99181` (after fix64–fix71 and sweeps since batch 54 on PROD). QA build (`npm run build:qa`), 2026-11-06 09:35–11:15 CET. This report lists findings only. No game code was changed.

**Tooling**
- `tools/qa/vqa-3-run.ts`: a copy of `vqa-1b-run.ts` plus a `replay` source (the `L8-default` progressed save with level select). L1 has no preset of its own.
- Real input runs through the shared browser pool on 4329, with a private preview port per run and at most two contexts at once. God mode is on for the courier only, and `PLAYTEST_REVEAL_AUDIT=1` is set.
- Each run took per-step photos at low/high × zoom 1.5/0.5, plus an unpaused frame every 5 s. The L3 opening strip took one about every 1 s.
- Scene Lab covered the L4 Harbor Street alley and the L3 west on-ramp. `npm run scene:hat-eye` ran for the hats.
- I looked at every capture used here, and at full size or as a crop wherever a finding depends on it.
- Evidence sheets are in `test-results/vqa-3/evidence/` (git-ignored, on the lane's disk only).

## Verdict

**One P1. It is very likely already on PROD, so it does not make this build worse than PROD.** On L2, the parked fire engine gets a hard-edged pale disc punched through its body for about 15 s, in every run (#1). The PO rule says a defect on a vehicle the player uses is a P1. The batch-54 change list says "fire-engine cutaway (on foot and riding)", and the code path is the on-foot "bounded hull disc" in `VehicleView` (`on = 1`). I could not A/B this against PROD, because the history is squashed.

Under the PO 11-03 rule (interim deploys allowed when the batch beats PROD and adds no new P1), it does not block an interim deploy. It does block a "every row PASS" deploy.

There are six P2s. Most of them are in L3: the ghosted courier on the ramp, the smoke curtains, the uncapped enemy bars, and the detour arrows against G-08. L4 has clearly improved since vqa-2:
- the courier can be found in the hordes;
- at most 6 enemy bars show;
- the corpses read as bodies at zoom 0.5;
- the corpse piles are spread out.

| Level | Glitches | Stunning? | Boring / harmless / babysitting |
|---|---|---|---|
| L1 | Only P3s:<br>• the progress counts while the courier stands outside the depot ring (#11)<br>• a 36 s horde jam at the fire-bay door in the fresh run (#10)<br>No route chevrons remain: only fixed rings and the gold screen-edge pointer. The Main Row planters and the depot planter sit flush, and I saw no pocket. | Yes. Warm afternoon suburb, the depot and the annex read well at both zooms. The Elm Street horde chase at zoom 1.5 is a good set piece. | The delivery leg is calm by design, and the fire-station run has real pressure. |
| L2 | **P1 #1:** the fire engine hull disc. During the ride, the roof-off crew cutaway reads as intended (t2838). | Yes for the ride and the fall-back to the bridge through crowds. | No. The horde chases all the way to the checkpoint. |
| L3 | P2s:<br>• the courier turns into a gold x-ray ghost on the ramp at zoom 1.5 (#2)<br>• the smoke columns read as dark curtains (#3)<br>• 40–140 stacked enemy bars (#4)<br>• glowing detour arrows (#5)<br>P3: the billboard at the ramp has no legs at low tier (#12). | Close to it. The sunset haze, ash fall and the raised corridor look great at zoom 0.5. At zoom 1.5 the hanging dark smoke shapes and the yellow arrows pull it down. | Not harmless: in the fresh run, 142 infected converged on a stalled courier. The officers move with the group and fire ("Reloading!" while following, strip t2177–t3868). |
| L4 | P2: the courier is now a gold ghost in the breach hordes at zoom 1.5. She is findable, but low contrast at times (#6).<br>P3s: the alley porthole (#13), debris and labels (#14), and the cellar-door progress outside the ring (#11). | Yes. The convoy into lit Harbor Street, and the plaza battles at zoom 0.5. The spread corpse field reads as a battlefield, with no mounds. | No. All breaches arrive full, and both runs finished with the plaza never empty. |
| L5 | P2: rescued survivors still die within seconds to a minute (#7). The new "Survivor under attack! Turn back!" and "Survivor lost!" alarms now show.<br>P3: the near-camera ruin parapet outline (#15). | Moody, but one mauve tone at low quality. At zoom 0.5 the fresh male courier reads very well. | **Babysitting risk:** the preset run closed the metro shutter at "Survivors in 0/2", and Mia died about 20 s after she was found. Partly the driver's fault (it does not guard). A human try is needed. |

## Requested re-checks

- **L1 shop-front planters and hedges:** the depot (Main Row, z ≈ −38.5) planter pot and bench sit flush to the facade, and the hedges stand behind the bike rack. I saw no gap or pocket (replay t952 high, fresh t941 low at zoom 0.5).
- **L1 route chevrons removed (G-08):** no ground chevron in any L1 frame from either run. What remains are the fixed destination rings and the gold screen-edge pointer.
  - **L3 is different:** 14 fixed bright yellow detour arrows remain on the road (#5).
- **L2 fire-engine cutaway:** while riding, the roof-off crew cutaway reads as intended. While parked at the doors, there is a hard-edged disc hole (#1).
- **L3 smoke columns:**
  - They read as dark curtains: stacked grey teardrop shapes with soft vertical sides and rounded bottoms, hanging over streets and roofs. That is true at both tiers and at zoom 1.5 and 0.5 (#3).
  - The thinning near the courier works: she and the corgi stay readable inside a column (t3811).
- **L3 ramp deck rails:**
  - Both rails stay on during the climb at zoom 0.5 and 1.5, with no seam or void on the deck. That holds in real input (t6953, t7266) and in Scene Lab (WebGPU low and WebGL2 high).
  - At zoom 1.5 the courier is drawn as a ghost for the whole climb (#2).
- **L3 yard cover truck spawns:** the military truck at the station yard corner (strip t2566) is parked along the kerb, with no clipping into the fence or the sandbags.
- **L3 officers firing while moving:** in the strip, the officers follow the group, keep shooting, and show "Reloading!" while moving (t2177, t2769, t3065). I saw no officer standing idle once contact started.
- **L4 Harbor Street alley** (Scene Lab, WebGPU low and WebGL2 high, zoom 0.5/1.5, 24 shots):
  - At zoom 0.5 the paving runs continuously into the plaza, with no void and no floating props.
  - At zoom 1.5 the passage still shows only as a porthole in the Bakery / Harbor Books block (vqa-2 #11, unchanged, #13).
  - Neither real-input run walked the alley.
- **L4 courier contour at zoom 1.5:** she is now drawn as a gold x-ray figure. I could find her in every hold crop I looked at (t3526, t4160, t4829, t7071, t10765). At t12011 she is a faint outline in a riot-shield knot (#6). This is better than vqa-2 #1.
- **L4 enemy bar declutter:** at most about 6 bars over the plaza hordes. The cap works (`l4InfectedBarCap = 6`).
- **L4 spread corpse piles:** the bodies lie spread across the plaza in one layer, with no mounds.
  - At close zoom, WebGL2 low (fresh t9591), they read as bodies, not camo mosaics. vqa-2 #2 is better.
  - A few loose limbs and blobs lie among them.
- **L4 spearhead:** soldiers and armed civilians fire throughout the first contact (muzzle flashes at fresh t2836 and t3447). Nobody stands out as idle.
- **L5 corgi and escort:**
  - The corgi followed or hid near the courier in every L5 frame. I did not see the 3.5-min absence from vqa-2 #5.
  - The escort is still lost quickly (#7).
- **Hats (cap and hard hat):** `scene:hat-eye` PASSES (60 receipts, WebGPU low).
  - On every body, the baseball cap, hard hat and sun hat each have their own shape, sit on the head, and leave both eyes visible.
  - In play, caps on peds and on the male courier sit on the head at zoom 0.5.
  - Woman-a's hard hat looks slightly large, but within the ratio gate.
- **Infected lean (40° cap):** I saw no infected leaning beyond a normal hunch in the close crowd shots (L1 fresh t11607, L4 fresh t5908–t7126, L5 fresh t6056–t9236).

## Ranked list

### P1
1. **L2 fire engine: hard-edged pale disc cut through the parked engine.** It shows in the "Cover the firefighters while they force the doors" phase, and the camera framing is scripted (the zoom 0.5 and 1.5 photos are identical).
   - **When:** about t2950–t3960, roughly 15 s. Seen at preset t2954 (WebGL2 high and low) and t3145, and fresh t3051 (WebGPU low) and t3960.
   - **What:** the courier stands behind the parked engine. A perfect circle of the pavement and crates behind it shows through the red body, with no dither and with sharp edges. At t3960 two firefighters stand inside the hole too. It reads as a hole in the truck, not as see-through.
   - **Scope:** reproduced on both backends, both tiers, both saves and both survivors.
   - **Rating:** P1 by the vehicle rule. It is likely pre-existing on PROD (see Verdict).
   - **Suggested fix:** use the world-space roof-off cutaway for the on-foot case too, or dither the disc edge the way the building cut does.
   - Evidence: `test-results/vqa-3/evidence/L2-engine-disc.jpg`

### P2
2. **L3 ramp at zoom 1.5: the courier is a gold x-ray ghost for the whole climb.**
   - **Where:** real input, preset WebGPU low, t6953 (148.3, 2.0) and t7266 (162.2, −3.6). The reveal audit reports `courierForeground: true` with `occluder kit.highway-onramp`.
   - **What:** she stands in open view on the deck between infected and is drawn only as a pale, see-through figure with a gold outline.
   - **Reproduction:** Scene Lab walk (shots 320–479) on WebGPU low and WebGL2 high. At zoom 0.5 she is drawn normally.
   - **Why P2:** when a billboard really covers her, the ghost is right (shot 400), but it fires on the ramp itself. A visible change to the player, but she stays visible, so I rated it P2 and not P1.
   - Evidence: `evidence/L3-ramp-ghost.jpg`, `evidence/L3-ramp-scene-webgpu-low.jpg`, `evidence/L3-ramp-scene-webgl2-high.jpg`
3. **L3 smoke columns read as dark curtains.**
   - **Where:** preset t3811 (Maple Hardware), t6953 (six stacked dark teardrops over the ramp), strip t3739 (a curtain over the top half of the frame), and every L3 frame at both tiers.
   - **What:** they are flat, dark-grey, semi-opaque vertical shapes with rounded bottoms and no billow or rise you can see. They look like dark ghosts or curtains, not smoke.
   - **No gameplay cost:** the thinning near the courier keeps her readable.
   - Evidence: `evidence/L3-smoke-arrows.jpg` frames 1–3
4. **L3 (and every level except L4 and L10): enemy health bars have no cap.**
   - **Where:** fresh WebGL2 high, Maple Hardware (−112, 2). The god-mode driver stalled there for 2 min, and the horde grew from 25 bars (t7316) to 42 (t4507) to 142 (t5751) and 105 (t10773).
   - **What:** a slab of red bars covers the horde and the courier. At 42 she is still findable as a ghost; at 142 she is hidden.
   - **Caveat:** the stalled god-mode driver inflated the horde. But the slab is already a wall at about 25–40 bars, which a real player can meet in the L3 retreat.
   - **Code:** `src/render/HealthBars.ts` caps only `l4InfectedBarCap = 6` and `l10InfectedBarCap = 5`. Applying the L4 rule everywhere is the obvious fix. The 11-01 lessons treated a 25–30 bar slab over the heroine as a P1.
   - Evidence: `evidence/L3-bar-slab.jpg`
5. **L3 glowing detour arrows against G-08 ("no route steering … let the user find the way by themselves").**
   - **What:** 14 fixed, unlit, bright yellow road arrows at the open cross-links (`src/render/L3Props.ts`, "Fixed road paint identifies the open cross-links"). They do not move, but they point the way at junctions, and at zoom 1.5 they read as HUD arrows rather than paint (preset t2269, strip t3298, t3553, t3868).
   - **Context:** the L1 chevrons were removed for this rule.
   - **Decision needed:** either G-08 allows them as painted world signage, or they go too. If they stay, they should be dull road paint, not glowing.
   - Evidence: `evidence/L3-smoke-arrows.jpg` frame 4
6. **L4 courier at zoom 1.5 in the breach hordes is a gold x-ray outline.**
   - **What:** findable, but at t12011 (−21.6, 0.5), inside a riot-shield knot, she is a faint outline about 40 px tall.
   - **Status:** clearly better than vqa-2 #1, and I would accept it for an interim deploy.
   - Evidence: `evidence/L4-horde-courier.jpg`
7. **L5 rescued survivors still die within seconds to a minute.**
   - **Fresh run:** Mia was found at t2873 and "Survivor lost!" showed at t4103.
   - **Preset run:** Rosa was lost at t7697. The run ended "Survivors in 0/2" as the shutter closed (t14656).
   - **What changed:** the alarms now show ("Survivor under attack! Turn back!" at t2557 and t13127, plus "Survivor lost!"), which addresses vqa-2 #3's missing signal.
   - **Caveat:** the god-mode driver does not guard the group. A human try should decide whether a normal player can protect them without babysitting.
   - Evidence: `evidence/L5-escort.jpg`

### P3
8. L1 shop and depot planters are flush, and no chevrons remain. Not a defect; listed for traceability. `evidence/L1-overview.jpg`
9. L1 hats and eyes look fine in play. Woman-a's hard hat looks a touch large at close range (within the gate). `evidence/hats-gate.jpg`
10. **L1 fire-bay door horde jam.** In the fresh run (male, WebGL2 low, zoom 0.5), the god-mode courier stood 3 m from the fire-bay trigger (−76.6, 41.3) inside a horde for at least 36 s (t10644–t12823). The driver logged infected #233 and #231 taking no damage from 8 s of bat attacks at 1.1 m (t11559, t12117). It needs a human try to tell a target-selection problem apart from a driver aim problem. `evidence/L1-firestation-stall.jpg`
11. **"Hold still or press E" progress counts while the courier stands about 2 m outside the drawn ring.** Seen at the L1 depot (fresh t941, 17 %, courier at the door, ring at the kerb) and the L4 cellar door (fresh t14599, 27 %). The ring does not match the trigger.
12. **L3 ramp billboard at low tier has no legs or frame.** From above, it reads as a large flat pale board floating across the ramp. At high tier it has its wooden legs and green top edge. `evidence/L3-ramp-scene-webgpu-low.jpg` vs `-webgl2-high.jpg`
13. **L4 Harbor Street alley at zoom 1.5 shows the passage only as a porthole in the Bakery / Harbor Books block** (unchanged from vqa-2 #11). At zoom 0.5 the paving is continuous. `evidence/L4-alley-webgpu-low.jpg`, `evidence/L4-alley-webgl2-high.jpg`
14. **L4 small debris and labels.**
    - Many small black square bits (casings?) on the plaza around the courier (preset t4160).
    - "SHIELD STRAIN · CHIP" / "SHIELD BROKEN" labels still ride over the horde.
    - A thin green vertical line from the courier (fresh t11428).
15. **L5 near-camera ruin.** The roofless ruin's pale parapet tops form a bright outline over the street at zoom 1.5 (preset t3249, t5735). `evidence/L5-misc.jpg`

### Driver/harness notes (not game bugs)
- **L2:** both runs stalled 20 s at "Take the fire axe" (t1225 and t1227), with no marker on the axe.
- **L3:** the fresh run stalled for 2 min at Maple Hardware, pinned by the horde (source of #4). Run stopped by hand.
- **L5:** the fresh run found 1 of 5 survivors and circled (t8109). Run stopped by hand.
- **L1:** no progressed L1 preset exists, so `vqa-3-run.ts replay` uses the `L8-default` save with level select.
- Fresh and replay entries show the debug "Controls / Sound" strip.

## Coverage

| Run | Save | Survivor | Backend / tier / base zoom | Result |
|---|---|---|---|---|
| L1 | replay (L8-default) | female | WebGPU high 1.5 | finished |
| L1 | fresh | male | WebGL2 low 0.5 | fire-bay jam, stopped after 214 s |
| L2 | preset L2-default | female | WebGL2 high 1.5 | finished |
| L2 | fresh | male | WebGPU low 0.5 | finished |
| L3 | preset L3-default | female | WebGPU low 1.5 | finished |
| L3 | fresh | male | WebGL2 high 0.5 | stalled at Maple Hardware, stopped |
| L3 strip (about 1 s per frame) | preset | female | WebGPU high 1 | 100 s opening and retreat |
| L4 | preset L4-default | female | WebGPU high 1.5 | finished |
| L4 | fresh | male | WebGL2 low 0.5 | finished |
| L5 | preset L5-default | female | WebGPU low 1.5 | finished, 0/2 survivors in |
| L5 | fresh | male | WebGL2 high 0.5 | 1/5 found, stopped |
| L4 alley | Scene Lab | female | WebGPU low and WebGL2 high × zoom 0.5/1.5 | 24 shots |
| L3 on-ramp | Scene Lab | female | WebGPU low × 0.5/1.5, WebGL2 high × 1.5 | 18 shots |
| Hats | `scene:hat-eye` | 5 bodies × 7 hats × live/infected | WebGPU low | PASS |

Every real-input run also took per-step photos at low/high × zoom 1.5/0.5.

**Not covered:**
- An A/B against PROD (so whether #1 and #4 are pre-existing is not proven).
- Perf.
- The L4 tank-vs-barrier and alarm-wave counts.
- A real-input walk through the L4 alley.
- The male courier in L3 and L5 preset runs.
