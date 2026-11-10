# r27-l9apc: L9 APC pinned by infected, freeze at the first boarder wave

Lane r27-l9apc (claude-opus-5-5), 2026-11-10. Based on main 39c92dae, merged main again after r27-l9board landed.

## P1 #1: APC pinned in a crowd

**Root cause.** Infected have no Rapier body, so they cannot physically hold a 6 t APC. What held it was a rule. In `Vehicles.apcHit`, every heavy contact onset (brute, armored, riot, elephant) set the APC's velocity to zero and set `impactStallUntil = tick + 60`. That forces throttle 0 and the brake on. In a pile, the next heavy touched before the APC reached the 4 m/s ram speed, so the stops chained without end. Ordinary infected never slowed it: 12 runners gave 98 m in 10 s.

**Fix.** A heavy onset still stops momentum once, as E31-AC06 requires. Further heavy onsets within `apcDurability.heavyStallGraceTicks` (240 ticks) after that hold still cost durability, but they do not stop the hull again. The config is in `src/data/vehicles.ts`. No infected stats changed.

| Fixture: floor APC (0 HP), 16 infected (8 heavy) at the bumper, full throttle | progress in 10 s | top speed after |
|---|---|---|
| before | 2.3 m | 3.9 m/s |
| after | 87 m | 10.7 m/s (floor cap 0.6 × 18) |

The sim test is `l9FloorApcThroughPile` in `tests/engine/vehicles.test.ts`. It asserts ≥ 15 m in 10 s, at least one heavy stop, and the floor speed once clear. It fails on the old code (2.3 m).

**Also at the QA spot.** The APC had stalled at (−328, −335) before the crowd came (QA log: `noProgressSeconds` 16 s with one infected near). Its nose was against L9's roadside hedge row: `prop.hedge:134–137`, static colliders at z = −337.9 along the south edge of the road. With no infected at all, the APC from (−333, −335) at yaw 0.45 also stops there (`tools/qa/diag/l9apcpile.ts --pile 0`). The APC can reverse out of it; the QA's own test was 3.4 m in 3 s. I left the level geometry unchanged. A follow-up could let the APC plough through hedges, or keep the bot away from the verge.

## P1 #2: 2–6 s freezes when the first boarder wave hits

**The sim is ruled out.** Native worst tick was 8.9 ms with 30 infected and 7 boarders (`l9apcpile.ts --pile 30 --mixed`). Over the whole `--zero` road run (26 000 ticks) the worst tick was 49 ms.

**Root cause (render).** `Lighting.setShadowSource` keeps the moon and the hero spot in one stable light list only for L5, L6, L8-zoo and L10-night. L9 was missing from that list. On L9 the promoted shadow spot is the driven APC's headlight. When the APC's lamps die, the hero source drops back to the moon. The lamps die at stage 4 / 0 HP, and on every stage-3 flicker (`apcDamage.lightsOn`). With the list not stable, the spot and the sun swap visibility. Three retires every render object and rebuilds the programs. The swarm is what drives durability down to the floor, which is why the freeze lands on the first boarder wave.

**Fix.** Added `'L9-crossing'` to the stable list. It also uses the active-only shadow filters, as L10 does, so the inactive map costs no taps. The render-contract test now checks L9 and L10. It fails without the fix.

**Browser verification.** `tools/scenelab/r27-l9-boarders.ts`, real time, `?loadProfile=2`, one browser at a time through `tools/e2e-lock.sh`, port 4896:

| run | APC lamps die (wreck → floor) | boarder wave (18 mixed, crawling hull) |
|---|---|---|
| before, low/WebGL2 | **111 node builds, 5455 ms render CPU in one frame** (Background, foliage, grass, terrain, …) | worst frame 433 ms |
| after, low/WebGL2 | 0 builds, worst frame 17 ms | worst frame 50 ms, 0 builds, 1 boarder attached |
| after, high/WebGPU | 0 builds, worst frame 17 ms | worst frame 50 ms; two single ShadowMaterial builds of ~23 ms |

One earlier "after" low/WebGL2 run had a single 2167 ms frame in the wave with 0 node builds and 6 ms render CPU. It did not come back in the next two runs, and its CPU profile was clean. It is likely a dev-server or headless hitch, but it is not proven. Check it on a production build (see below).

## Acceptance: `l9-driving-proof`

| run | result |
|---|---|
| road (healthy) | completed, 199.95 s (unchanged) |
| road `--zero`, main + r27-l9board only | not completed in 600 s |
| road `--zero`, pile fix only | not completed: evacuation stuck at 3 of 4 survivors |
| road `--zero`, final | **completed, 439.5 s**, 0 collision failures |

The `--zero` evacuation stall: with the APC parked north of the bay (457.6, 9.9), Okafor's walk to the far truck goes around the end of the bridge-gate wall. That route needs 135 path cells, and the 1600-node A* budget failed every time, so he stood still forever. Native `nav.steer`: budget 1600 → false, 100 000 → 135 cells. The fix gives `LevelNineDriving.evacuate` an 8000-node budget. That is one line in r27-l9board's file, kept minimal.

Remaining `--zero` slowness, not fixed (bot route): from ticks 17 400–22 500 the bot drives about 10 m off the road line near (400–424, −113…−60). It gets into yard fences (`prop.privacy-fence:3392`, picket fences) with crowds, and reverses and retries for about 85 s.

## Commits

- `8c7e67e9` fix(L9): heavy infected pile no longer pins the floor-state APC; sim test
- `db9c08b7`, `0517358a` merge main (r27-l9board) + merge fix in vehicles.test.ts
- `931305b1` fix(L9): evacuee far-truck route budget 8000; `--zero` road proof completes
- `760fc686` fix(L9): stable light list for L9-crossing; boarder-wave browser probe
- diagnostics: `tools/qa/diag/l9apcpile.ts`, `l9solidsnear.ts`, `l9zerotrace.ts`, `tools/scenelab/r27-l9-boarders.ts`

## Browser QA needed

- **L9 lighting look (P1 check):** the light list is now stable on L9. On the road route at night, compare high and low, zoom 1 and 1.5, on WebGL2 and WebGPU:
  - moon shadows on the road with the APC lamps on, and after they die;
  - the APC headlight pool and its hero shadow as the APC passes street lamps;
  - no flat or black ground, and no missing shadows.
  - Reference: `test-results/r27-l9apc/boarders-high-webgpu-fix/end.png` (local, not committed) looked normal.
- **Freeze:** on a production build (`npm run build:qa`), road route, low, zoom 1, WebGL2 and high, zoom 1.5, WebGPU:
  - drive into the first boarder wave and let durability fall to "barely functional";
  - expect no frame over 200 ms when the lamps flicker (stage 3) or die (floor).
  - Also re-check that the single 2167 ms dev-server frame does not reproduce.
- **Pile:** L9, around tick 3700 with the fixed playtest driver (r26-vqa `484883d0`), floor APC in a crowd with brutes or armored: the APC breaks free within a few seconds at about 60 % speed. Check the hedge row at (−325, −338): the APC reverses off it.
