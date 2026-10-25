# Male courier rebind: the TRELLIS.2 male on the heroine route

Lane `lane/male-courier`, 2026-10-25. PO 10-25: "I played L1 with the new heroine, she looks much better now! Do the same for the male courier, so both picks match."
The new male is the skinned body of `char.courier-male` (`public/assets/models/char.courier-male.skin.glb` and `.skin.low.glb`), replaced under the existing ID with no switch.
The rigid `?skin=0` fallback (`char.courier-male.glb` + LODs) is unchanged. "Old" in every sheet means the palette male from `main`, in the same scene.

## Source (`source.jpg`)
- **Imagegen:** Codex built-in image_gen redrew `assets/char.courier-male/reference-upscaled.png` as an A-pose with the game head ratio (≈ 35 % including the cap).
  - The first draw hung the arms too close to the body, so a second draw (prompt in `trellis-highs/char.courier-male/prompt.txt`) spread them.
  - Two image calls, no TRELLIS spent on them.
- **TRELLIS.2:** 1 of the 3 allowed inferences (res 1024, seed 42, 12 steps, 300k/2K).
  - The run went straight into `/Users/wesner/Workspace/trellis-highs/char.courier-male/run1/` (the `--cache-root`), with the input, the original and the 6k body next to it.
  - The high is clean: arms free, bag on the back, front pouch, cap, curls.
- **Pipeline v2:**
  - `solidify.py`: 6,000 cap, 256 grid, head-depth carve → 5,990 tris, watertight, 0.2 % slivers;
  - `bake.py`: emission 1K (cage .02, ray .05);
  - `colour_match` (Lab) → `assets/char.courier-male-skin/source.glb`.
  - No `cast_surface.py` repair (orchestrator review): its nearest-surface transfer painted the 300k's teal straps and bag onto his orange shirt front and sleeves. The ray bake alone is clean on every side, with no misses on this figure.
  - The global Lab match turned the teal-green bag, straps and cap back blue-grey, so the build re-tints only that hue family to the reference teal (hue 172°).

## Bind (`assets/char.courier-male-skin/build.py`, same route as the heroine)
- **Skeleton:** the male's own 36-bone v2 armature (`rig-source.skin.glb` = the old palette skin; `build-palette.py` rebuilds it): same names, hierarchy, helpers, sockets and bind convention, no pony bones.
  - The joints are moved onto his anatomy. `SOURCE_JOINTS` was read off horizontal cross-sections of the source.
  - The shoulders sit in line with the spine. 2 cm behind it, `keepTorsoForward` tipped the head and the run lean read 15° against the 8–12° gate.
- **Ownership, on the welded surface:**
  - arm flood from the hands inside a capsule that never enters the torso flank;
  - hands pinned whole below the wrist band;
  - cargo pants: the belt rides the hip, the thighs take over below the crotch, never any arm share;
  - shoes are foot, with the toe at the ball;
  - the bag bends with the back (35 % outer socket share), and the chest straps are chest/clavicle;
  - curls over the nape, the jaw and the sideburns are head (they tore 11× head↔chest in the bat swing);
  - the crotch side blend is 7 cm wide.
- **Delivery:** COLOR_0 copies the map (for the gear fit), with smooth welded normals and the `tex_baseColor` material on the shared `Materials.fromTexture` route.
  - `courier-tex-compress.ts` writes WebP q90 plus meshopt. Low = high (5,990 tris).

## Numbers (old palette male → new)
| | old | new |
|---|---:|---:|
| download, skin high / low | 709,892 / 703,168 B | 411,984 / 411,984 B |
| download, tier gear LOD0 / low / LOD2 | 42,056 / 23,456 / 16,520 B | 41,500 / 23,772 / 17,372 B |
| body triangles high / low | 51,124 / 29,674 | 5,990 / 5,990 |
| body draw calls | 1 (+1 tier gear) | 1 (+1 tier gear); no repair caps |
| decoded texture memory | 0 | 1024² RGBA8 + mips ≈ 5.6 MB |
| look z1 scene, WebGPU low, last frame | 21 draws, 43,110 tris, 31,314 shadow tris | 21 draws, 19,426 tris, 7,630 shadow tris |
| stretch audit max (31 clips, 24 steps) | 22.1× (bat-3) | 7.5× (bat-3, front crotch) |
| edge samples > 4× | 841 | 591 |
| `qa-courier-locomotion-m` foot slide / sink | 0 / 0 cm | 0 / 0 cm |
| tier-gear attachment gap, 72 matrix rows | — | max 1.6 cm (gate 2) |
| L8 start figure luminance vs PROD (`night-l8.json`) | 0.377 | 0.415 |

Stretch details are in `stretch-base.json` and `stretch-tex.json`.
- Walk is 2.8×, run 3.3× and idle 1.5×.
- Melee clips stay ≤ 5×.
- The bat swings reach 7.5× at the front crotch in the lunge.

## Gear, headlamp, canister (`acc.courier-gear/build.py`, male only; the female gear files were not rebuilt)
- `body.slim` marks the textured male. It does not touch the heroine or the palette bodies.
- **Plates copy his skin weights unfolded,** from the barycentric weights of the nearest triangle.
  - On the 6k skin, folded plates left the skin by 3.7–7.6 cm in a bend.
  - A hard arm/torso split on the body instead tore 16× (tried and reverted).
- **Gloves** sit on the rigid hand below the wrist band.
- **Belt** sits on his belt line at the hip joint.
- **Knee pads and lenses** are thinner.
- **Goggles** go on the cap at the old cap height.
- **Headlamp** keeps the male cap fit (.04, .19). `CharacterView` gives the hair fit to the heroine only.
- **Matrix:** the `courier-gear-tier*-male` catalog passes 36/36 on WebGPU and 36/36 on WebGL2 (high/low × zoom 1.5/1/0.5). The 6 gated scenes are t0–t4 and the t4 swing.
- **L6 headlamp:** `SceneLab` `l6Subway` fixtures now honour `look.model` (before, they always loaded the heroine). The lamp sits on his cap.
- **L10 canister:** it rides on his backpack (`l6-headlamp-l10-canister.jpg`).

## Night (`night-l8-start.jpg`, `ab-l8-start/`)
- I measured with `qa:ab --levels L8 --stops l8-start --survivor male`, against PROD, WebGPU low. `--survivor` is a new qa:ab option.
- With the heroine's night lift he reads **0.51 vs PROD 0.377** and looks washed out and pastel.
- His map is lighter than hers, so the lift stays hers. Without it he reads **0.415** (p90 0.673 vs 0.663), hue-true.
- This is a deliberate deviation from "the lift applies to him too": the numbers say it does not fit him.

## Sheets (all opened; old = main, same scene, WebGPU low unless noted)
- `source.jpg`: concept → A-pose → 300k → 6k bake → built skin → clay.
- `look-webgpu-low.jpg` and `look-webgl2-high.jpg`: idle, walk, run, bat at zoom 0.5/1/1.5. White cap, orange shirt, red sneakers and the teal bag read at every zoom, with a real face. At a glance he is at least on par with the old toy, and the closest zoom is clearly better.
- `gait.jpg`: walk, run and a 180 turn, old vs new plus WebGL2 high. Knees bend forward, the pants follow the thighs, and the bag stays on the back.
- `gear-t0-t4.jpg`:
  - t1 gloves and knee pads;
  - t2 olive vest band;
  - t3 shoulder and elbow pads plus the belt;
  - t4 goggles on the cap and forearm guards;
  - nothing floats. t1/t2 are subtler on him than on the old body (his straps and pouch already break up the chest).
- `actions-melee.jpg`: fists, kick, bat, axe. `actions-gun-bike-carry.jpg`: army MG close, bike, carry (bat, handgun) and hit react. Weapons are in hand, the hands are on the bars, and the bag stays on the back.
- `l6-headlamp-l10-canister.jpg`, `night-l8-start.jpg`, `ab-l8-start/l8-start-z1.jpg` and `-z1.5.jpg`.

## Gates
- `npm run typecheck`, `npm run lint`: pass.
- `npm run assets:validate`: 1,262 assets, 0 errors.
- Courier unit files (`courier-rig-v2`, `skin-pilot`, `courier-skin-lod`, `character-loading`, `courier-gear-tiers`): 47/47.
- `npm run test:smoke`: Vitest 6/6, Playwright 31/31.
- `qa:invariants:sim:remote`: 28/28. `qa:invariants:render` and the L1 low p95 are left to the orchestrator's quiet window (batch15 holds a campaign browser).
- Scene Lab:
  - 22 `qa-courier-m-*` and `qa-courier-locomotion-m` runs on WebGPU low pass;
  - 9 on WebGL2 high pass;
  - the gear matrix passes 72/72;
  - 0 console errors.
- Remote `tests/unit tests/levels` on the final build (d98a13162): 485 files passed, 3 skipped, 0 failed (exit 0).

## Open
- His eyes are texture only, so he has no blink (as the heroine).
- The bat-lunge crotch stretch is 7.5× (the old male had 22× at the shoulder).
- The tier-1/2 gear reads quieter on his busy shirt front.
