# vqa59: Opus visual QA of batch 59 before an interim deploy

Main `b5348ed4` (after `lane/r6-truck`). QA build (`npm run build:qa`) and the Scene Lab dev server. 2026-11-07 23:48 to 2026-11-08 00:35 CET. Findings only, no game code changed.

**What changed since PROD (batch 58):**
- r6-truck: the L2 fire engine rides as an open-top crew cab (PO P1 "some part is missing of the truck").
- r5-l7: follower bites wound (34 HP) instead of kill; survivor warnings need > 18 m; a two-runner opening press at arming.
- r5-vis: corpses settle on one support across the body width, with a last-resort lift; threat rings retire when their source dies (all levels).
- perf11: LOD warm-up callbacks are installed before early camera requests.

The objective-arrow depth test (48467da8) was reverted (0f85e3c8) and is not in this batch.

## Verdict: GO for an interim PROD deploy (PO 11-03 rule), with one P2 to fix next

- **Every targeted fix holds visually** and beats batch 57 in direct A/B:
  - the fire-engine cab;
  - the dead-brute rings;
  - the L1 planter-corner corpse;
  - false "lost behind you" warnings.
- **No new defect on the player, the companion or a vehicle the player uses.** The new L7 finding below is a boarding block, not a visual defect.
- **L7 does not meet "all living followers board".** Two of three real-input runs lost most of the group at the launcher, and the run that kept all 24 got stuck at the bus. The batch-57 run with the same setup did worse: 1 boarded, 9 false warnings. So this is no regression, and it does not block an interim deploy. It is still not strict-acceptance PASS, and the new bus block needs a human repro.

## Findings

| Sev | Level | Finding | Evidence |
|---|---|---|---|
| **P2 (new to observe; needs a human repro, possible softlock)** | L7 departure | **The courier is boxed in by her own column of 24 survivors between the army truck and the school bus.** It happened with the whole group alive in the WebGPU low, preset, male run.<br>• The driver tried every direction (W/A/S/D and diagonals, 10 `navBlocked` retries) and moved < 0.5 m for 150 s, from t9589 to t18269. Then the run ended "cannot-finish".<br>• The HUD showed "Get everyone aboard the bus · 24 m · Aboard 0/24 · Waiting for a survivor · 3 m".<br>• Boarding only starts when the courier reaches the boarding point (`LevelSevenDeparture.update`, `boardRadius`), so it never started.<br>• Batch 57 never shows this, because the group is already down to 1–4 people at the bus. The native `complete` bot boards 24/24 (`tools/qa/vqa59-l7-bot.ts`). | `test-results/vqa59/l7-preset-gpu-low-2/captures/l7-preset-gpu-low-2-L7-t7345.jpg`, `-t9791.jpg`; log `log-l7-preset-gpu-low-2.jsonl` |
| P2 (inherited, smaller than b57) | L7 opening | **The group collapses at the launcher when the courier fights instead of grabbing it.**<br>• WebGL2 high, preset, female: 24 → 5 within 40 s (t628–t2445), with 4 turned by t995. 4 boarded, and the level finished.<br>• WebGPU low, preset, male: the courier stayed pinned 3 m from the launcher for 37 s (t1411–t3663, holding D+S, `navBlocked`). The group fell to 9 alive (13 dead, 2 turned), and the run hit the 10-minute cap in the corridor.<br>• The second WebGPU low run grabbed the launcher at t687 and kept all 24.<br>• r5-l7 already flagged that the driver does not step the last 3 m. In the frames (t2062, t1384), followers stand on the launcher ring while a large horde with a brute presses in, so a human could be blocked the same way. | `l7-preset-gpu-low/captures/…-t2062.jpg`, `…-t2716.jpg`; `l7-preset-gl-high/captures/…-t1384.jpg` |
| P3 | L7 corridor | "Wait for us! Stay with the group." showed for about 8 s (t5094–t5599) while all 24 followers were within 18 m. This is the column-stretch `wait` warning (`formationBack + 10`), not the old false "lost/attack" warning. No "lost behind you" or "under attack" warning fired in any b59 run; b57 fired "lost behind you" 9 times with every follower within 18 m. | `log-l7-preset-gpu-low-2.jsonl`, `log-l7-b57-gpu-low.jsonl` |
| P3 | L2 ride | Blood decals on the road next to the cab read as small red squares or hexes at zoom 0.5, at both tiers (po-checklist Q-143 asks for blood, not red squares). | `spots/L2-ride-s12-z0.5-webgpu-low.jpg`, `spots3/L2-ride-s12-z1-webgpu-high.jpg` |
| P3 | L2 arrival | After arrival, the courier stands behind the truck. The yellow see-through silhouette draws her over the equipment body, so at a glance she seems to stand on the roof. This is the intended x-ray reveal. Same for the corgi behind the L7 truck. | `spots2/L2-ride-s30-z1-webgl2-high.jpg` |
| P3 (staged only) | L7 start | A body draped over the army truck's tailgate, half outside the bed. It is not one of my staged kills: all 20 staged bodies are within 0.44 m of the ground. Its origin is unknown. | `spots/L7-corpses-start-z1-webgpu-low.jpg` |

## Targeted checks

| Item | Result | Evidence (all under `test-results/vqa59/`, opened) |
|---|---|---|
| **L2 fire-engine ride** (native boarding bot, ride +3 s/+12 s/+30 s, zoom 0.5/1/1.5, WebGPU low/high, WebGL2 high) | **PASS.**<br>• The whole truck reads: an open-top crew cab with a dark sill and rear rail, a windscreen header with posts, and a ladder resting on its hoop.<br>• There is no black void at the shutter housing and no floating trim.<br>• Six firefighters in helmets plus the courier (backpack, hair) are readable at every zoom.<br>• After arrival the roof is closed again and the crew is out. | `spots/L2-ride-s12-z0.5-webgpu-low.jpg`, `spots2/L2-ride-s3-z0.5-webgl2-high.jpg`, `spots3/L2-ride-s12-z1-webgpu-high.jpg` |
| **L10 brute rings on death** (brutes spawned 9 m out, run until a charge ring is live, then killed by a real damage event, not `killAll`) | **PASS.** One live red charge chevron appeared at t920 (`vfx.tells` = 1). After the kill, `tells` stayed 0 at every 10-tick sample over 60 ticks, with no ring and no HP bar on the corpses. WebGPU high and WebGL2 high. In the first WebGPU low pass the brutes spawned at 5 m and formed no ring within 300 ticks; their corpses were also clean. | `spots2/L10-brutes-live-z1-webgl2-high.jpg` → `spots2/L10-brutes-dead-z1-webgl2-high.jpg`, `spots3/*L10*` |
| **Corpses on raised edges**: 20-body kill rings on the start spot and on an auto-found 13–20 cm edge in L1 (planter corner, kerb), L4, L5 (shed steps) and L7; WebGPU low, WebGPU/WebGL2 high; zoom 1/1.5 | **PASS for the PO case.**<br>• The L1 planter-corner body that stood upside down in b57 now lies flat on its back. A/B: `ab-L1-low-z1.jpg`, b57 left, b59 right; crop `crop-L1-planter-b59.jpg`.<br>• No standing bodies (0 of 20 in every run with drawn height > 0.8 m), and no body buried in its own support except the L7 auto-edge spot. That spot sat under a deck, a staging artifact.<br>• Bent knees remain part of the authored pose.<br>• My "hover" counter (lowest vertex > 12 cm above floor) counts bodies stacked on bodies (exact 0.22/0.44 m layers), so I did not use it as a verdict.<br>• L4's preset start is inside the convoy bus, so L4 corpses are not visible there. | `spots/L1-corpses-edge-z1-webgpu-low.jpg`, `crop-L1-edge.jpg`, `spots/L5-corpses-edge-z1-webgpu-low.jpg`, `spots3/L1-corpses-edge-z1-webgpu-high.jpg` |
| **Survivor warnings** | **PASS for false lost/attack warnings:** 0 in three b59 runs, against 9 in the b57 run. See the P3 above for the `wait` warning. | logs |
| **Boarding count** (real input, god-mode courier, rocket, preset) | **Not met.** 4/24 (WebGL2 high, finished); 9 alive at the 10-minute cap in the corridor (WebGPU low #1); 0/24 with 24 alive, boxed in (WebGPU low #2). **b57, same setup as WebGPU low: 1/24.** Native `complete` bot on b59: 24/24 at t103 s. | `l7-bot/low-s1.json` |
| **L1/L4/L5 regression vs b57** (QA env, test hooks), WebGPU low, plain start and corpse ring, zoom 1/1.5 | **No regression.** Plain views of L1/L4/L5 are the same (L4 bus passengers seated, L5 cellar). L1 corpses are better: no upside-down body, no leftover red rings around dead brutes (b57 still shows them). | `ab-L1-plain-low-z1.jpg`, `ab-L4-plain-low-z1.jpg`, `ab-L5-low-z1.jpg`, `ab/` |

## Stunning?

- **L2:** yes. The open crew cab with six helmets and the courier among them, the ladder rack and the warm suburb make the ride read like a set piece now.
- **L7:** yes. The ash night with the column of 24 behind the courier at the bus is impressive.
- **L1, L5, L10:** unchanged and good.

## Not covered

- I took no WebGL2 low captures of the truck or brutes; I covered WebGPU low/high and WebGL2 high.
- The A/B ran at low tier only. The QA-env side needed more than the 10-minute reservation for both tiers.
- There is no A/B against PROD batch 58 itself, which has no test hooks. Batch 58 differs from b57 only by perf10, which vqa58 showed to be visually identical.
- I ran no L9 or L3 checks (out of scope).

## Method

- **Staged spots:** `tools/qa/vqa59-spots.ts` (Scene Lab, production levels, follow camera):
  - the truck with the native `no-axe` boarding bot;
  - corpse rings with per-body floor measurement;
  - brute rings killed with real damage.
- **Real input:** `tools/qa/vqa59-run.ts`, a copy of vqa58-run. `VQA_ORIGIN` points the same driver at the QA env for b57. The courier is in god mode, and `PLAYTEST_L7_ROSTER_AUDIT=1` writes the roster and alarm every observation.
- **L7 bot reference:** `tools/qa/vqa59-l7-bot.ts`.
- **A/B:** `tools/qa/vqa59-ab.ts` (`VQA_SIDES`, `VQA_TIERS`).
- **Pool:** every run went through the shared pool, with at most 2 contexts of mine at once. No browsers were killed.
