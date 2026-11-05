# vqa-2 — Opus visual QA of L4, L5, L6 (pre-deploy)

Main `dbfa8ec85`, QA build (`npm run build:qa`), 2026-11-05 20:05–21:00 CET. Findings only. No game code changed.
Tooling: `tools/qa/vqa-1b-run.ts` (real-input playtest through the shared browser pool on 4329, god mode for the courier only, one context per run, at most two at once, private ports) plus a throw-away Scene Lab script for the Harbor Street alley. Every run took per-step photos at low/high × zoom 1.5/0.5 and an unpaused frame every 5 s (0.5 s for the two strip runs). I looked at every capture used here. Raw captures were deleted after review.

## Verdict

**No P1 found. Nothing I saw blocks the PROD deploy.** Seven P2s, mostly readability and escort feedback. Treat #1 (courier lost in dense L4 hordes at zoom 1.5) as the one to weigh: the new gold contour does not show at that size. Most of the escort losses in L5/L6 come from the driver, which does not protect the group, but the game gives no on-screen alarm when a survivor dies.

| Level | Glitches | Stunning? | Boring / harmless / babysitting |
|---|---|---|---|
| L4 | P2 courier lost in breach hordes at zoom 1.5 (#1); P2 corpses are camo mosaics at zoom 0.5 (#2); P3 shield label over the HUD cards, distance jump, porthole cut, hovering medkit | Yes for the convoy ride into lit Harbor Street and the plaza battle at zoom 0.5. At zoom 1.5 the breaches become a brown carpet of bodies under a wall of stacked red bars. | No. All three breaches arrive with full hordes and Alpha callouts. Both runs finished. Spearhead soldiers holding fire are not noticeable: the plaza is full of armed civilians and soldiers firing. |
| L5 | P2 rescued survivors die off-screen, the only signal is the name card vanishing (#3); P2 metro start at zoom 0.5: a truck wreck fills 65 % of the frame (#4); P2 corgi away from the courier for about 3.5 min while the HUD says "following" (#5); P3 Rosa walks with her arms raised | The ash-fall/fog streets are moody. At low quality and zoom 1.5 everything is one mauve tone, and small figures blend into the fog. | **Frustrating, not boring:** in both runs every rescued survivor was lost (preset closed the metro shutter with "Survivors in 0/1"). Mia died about 5 s after she was found in both runs. |
| L6 | P2 a riot cop pins the courier on the platform ledge for 100 s (#6); P2 the group shrinks to 0/1 with no alarm (#7); P3 "BLOCKED · FLANK" label and the bar ladder ride over the horde for minutes | The shelter lamps, the tunnel rails and the riot cops at zoom 0.5 look good. At zoom 1.5 the tunnel is a dark slab with orange strips. | Driver stall at the hatch (#6). Otherwise there is pressure all the way through the retreat. |

## Requested focus items

- **L4 Harbor Street alley** (Scene Lab, courier at (−20.25, −37 / −29 / −22), WebGPU and WebGL2 × low/high × zoom 0.5/1.5, 24 frames): continuous tiled paving, no void, no floating props. The narrowed storefront keeps its end wall, roof and AC units, and the roof is not cut wrongly. Two P3 nits (#11): a thin bright seam line across the paving where the alley meets the plaza (zoom 0.5), and at zoom 1.5 mid-alley the courier shows only through a porthole in the Bakery / Harbor Books facade, so you cannot see from the game camera that there is a passage. Neither real-input run walked the alley; the escape route goes west via Lakeshore.
- **L4 spearhead soldiers holding fire:** 0.5 s strip over the first contact (t2601–t4658, zoom 1, high WebGPU, 124 frames). Soldiers and armed civilians fire constantly. I could not find a soldier standing idle next to a runner. Believable, because nobody stands out as idle.
- **L4 waves:** west, north and south breaches each arrived in both runs with a dense horde, Alpha announcements and "They're inside" callouts. The plaza was never empty. Both runs finished (deaths 0, god mode).
- **L5 follower motion / corgi parking:** NOT JUDGED. In the 0.5 s strip (preset, WebGPU high, zoom 1, t1609–t8056) Mia and Rosa each died 5–15 s after rescue, before any calm group start. I saw no twitch in the few follow frames (Mia trails 2–8 m and flees during combat). In the strip the corgi stayed at heel the whole time.
- **L6 shelter recovery corpses:** not seen. The camera never returned to the shelter after the retreat started. **Riot-cop hatch members:** read well at zoom 0.5 high (dark armour, red visor, "POLICE" shield slab). One pinned the fresh-run courier for 100 s (#6).
- **Gold courier contour in dense hordes:** at zoom 0.5 the courier draws on top of the horde and reads well for both survivors and both tiers (fresh low WebGL2 male, preset low/high). At zoom 1.5 high WebGPU I could not see the contour. She is a 40 px head-and-gun between infected under 15–25 stacked bars (#1).
- **Tall-prop see-through cut:** trees dither cleanly around the courier (L5 t3703). Vehicles are not covered: the L5 metro truck at zoom 0.5 (#4).

## Ranked list

### P1
None.

### P2
1. **L4 courier lost in breach hordes at zoom 1.5** — preset, WebGPU high, ticks 4407 (−24.6, −4.4), 7178 (−18.0, 8.9) and 9397. The reveal audit puts her at the frame centre with `courierForeground: true`, yet only her hair and gun show between yellow firefighters and riot-shield infected. The new gold contour cannot be seen at this size. Above her, 15–25 enemy bars stack into a red wall. You find her through the red ring and the corgi. At zoom 0.5 the same moments read well. [L4-horde-courier.jpg](L4-horde-courier.jpg)
2. **L4 corpses read as camo mosaics at zoom 0.5** — fresh, WebGL2 low t11145/t11447, and high = low at t12918 (south breach). Bodies are red/yellow/black triangle patchworks, and one has a black dithered wedge. The living infected beside them look fine. PO checklist P1-117. Not compared with PROD. [L4-corpses-labels.jpg](L4-corpses-labels.jpg) frames 1–2
3. **L5 rescued survivors die within seconds of the rescue, with no on-screen signal** — Mia was lost 5–10 s after she was found in all three runs (fresh t2528→t2834; preset t1851→t2468; 0.5 s strip t1646→t1960: about six infected reach her, and she drops while the courier fights 3–6 m away). In the strip, Rosa (t5280) met an Alpha-sized brute at her spot and went 60→35 HP by t5753; she was gone by t6198. The preset run lost Rosa, Sam, Okafor and Dale one after another. It reached the metro with "Survivors in 0/1" and closed the shutter on nobody. The driver does not guard the group (native qa:accept rescues 5), but a lost survivor deserves a visible alarm. [L5-followers-metro.jpg](L5-followers-metro.jpg) frames 1–3
4. **L5 metro start at zoom 0.5: truck wreck fills the frame** — preset t14754, courier at (−5.3, 1.8), occluder `veh.military-truck@-4.2,5.7`, high and low the same. The courier sits at the top edge, half on the wreck. No see-through cut on vehicles. Frame 4.
5. **L5 corgi away from the courier for about 3.5 min** — preset, WebGPU low, zoom 1.5. The corgi is at heel until t3392, then absent from every frame (and from the paused zoom 0.5 photos at t4388/t7992, both tiers) until t15727, while the HUD says "Corgi · following". It is back at the metro, and the station waited only 3 s for it. The fresh run kept it at heel. I took no position trace, so I could not tell separation from a render dropout. **Check this before deploy if a companion render dropout would be a P1.** Frame 3.
6. **L6 riot cop pins the courier on the platform ledge** — fresh, WebGPU low, zoom 0.5, male, t4575→t10339 at (−1.1, −28). Every shot shows "BLOCKED · FLANK". The courier stays on the glowing ledge by a hatch, and the driver ends with P0 cannot-finish while the HUD says "Stay with the group · 247 m". A human can probably flank or step down to the rails. Needs a human try. [L6-alley.jpg](L6-alley.jpg) frame 1
7. **L6 group shrinks to 0/1 with no visible alarm** — preset, WebGL2 high t6776 "Let everyone pass · 0/1 through", t11082 "Bring the survivors into the night · 0/1 out". Same pattern as vqa-1b #7: the driver runs ahead. Frame 2.

### P3
8. The L4 "SHIELD STRAIN · CHIP" / "SHIELD BROKEN" world label draws over the courier and corgi HUD cards (spear t2669–t3122, fresh t7756, t9424). [L4-corpses-labels.jpg](L4-corpses-labels.jpg) frame 3
9. L4 fall-back route distance jumps 312 → 329 → 80 m within 10 s (fresh t13010–t13638).
10. L4 Lakeshore apartments t14032 (−47.8, −22.1): courier shown through a porthole in the facade, as if she stood on a balcony. Frame 4.
11. L4 alley: seam line at the plaza join, and a porthole-only view at zoom 1.5 (see focus items). [L6-alley.jpg](L6-alley.jpg) frames 3–4
12. L6 "BLOCKED · FLANK" label plus 20+ red/teal bars ride over the chasing horde for minutes (t3925–t11082).
13. L4 medkit pickup hovers at chest height, bigger than the courier's torso (fresh t11447).
14. L5 Rosa walks right behind the courier with both arms raised (preset t6802, t7107).

### Driver/harness notes (not game bugs)
- L5 hiding places have no marker by design (Q-302). The fresh driver circled one corpse field for 225 s at (−60, −33) and found 1/5.
- Fresh entries show the debug "Controls / Sound" strip at the top.
- The god-mode courier does not guard followers. Escort losses (#3, #7) are partly the driver's doing.

## Coverage

| Run | Save | Survivor | Backend / tier / base zoom | Result |
|---|---|---|---|---|
| L4 | preset `L4-default` | female | WebGPU high 1.5 | finished |
| L4 | fresh | male | WebGL2 low 0.5 | finished |
| L4 contact strip, 0.5 s | preset | female | WebGPU high 1 | 85 s contact phase |
| L5 | preset `L5-default` | male | WebGPU low 1.5 | finished, 0 survivors |
| L5 | fresh | female | WebGL2 high 0.5 | 275 s, 1/5 found |
| L5 follower strip, 0.5 s | preset | female | WebGPU high 1 | 135 s, 3/5 found, Mia and Rosa lost |
| L6 | preset `L6-default` | female | WebGL2 high 1.5 | finished, 0/1 out |
| L6 | fresh | male | WebGPU low 0.5 | driver stalled at hatch |
| L4 alley | Scene Lab | female | WebGPU + WebGL2 × low/high × 0.5/1.5 | 24 frames |

Every real-input run also took per-step photos at low/high × zoom 1.5/0.5. Not covered: A/B against PROD, perf, L4 tank vs barrier and alarm-wave count (P1-116/118), L6 shelter corpses after the retreat, the male courier in L6 preset/L4 preset. Machine-readable list: [findings.json](findings.json).
