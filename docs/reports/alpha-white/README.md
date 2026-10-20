# alpha-white: white/salmon Alphas and Alpha corpses (QA 13b #21/#29)

PO (10-19): "I really like the improved design of the area!!! But the alpha looks terrible."

## Root cause

The crowd hit flash (`CrowdView`, `_state.w`) added a flat 0.45 to every colour channel, then bloom. On the near-black Alpha, that turned the whole figure grey-white. Three things made it last:

1. **The render clock.** `Vfx` decays the pulse on the render clock only. Paused stepping (`__SS__.step`, which the QA drivers and e2e use) never advances that clock, so every hit figure stayed at peak white. In the 13b-style L4 run, 114 figures held a stuck flash (`render.crowd.flashes`); in real time there were 1–5.
2. **Sustained fire.** Under a soldier line or shotgun pellets, every hit restarted the pulse, so a live Alpha blinked white over and over.
3. **Downed bodies.** An Alpha at 0 HP that can still get up is not frozen into `StaticCorpses`. It stays in the live batch, kept its flash, and read as a "white corpse". Frozen corpses were never affected; their state is 0.

## Fix

- `Vfx.pulse`: a target flashes at most once per `hitFlashRest` (0.35 s). Each flash is a 0.1 s pulse, so the figure shows its own colours at least 0.25 s between flashes.
- `CrowdView.flashStrength`: a pulse never lasts longer than `hitFlashTicks` (8) simulation ticks, whatever the render clock does. Downed and dead bodies never flash.
- Flash colour: glow = albedo × (1 − albedo) × 1.2 × strength. It brightens the figure's own colours, about 2× at peak on a night-lit body, and backs off on pale swatches (bone, teeth) so they do not clip to white. There is no white term.
- Scene Lab: an infected `look.model` that names a Mega look (`inf.mega-alpha*`) now draws exactly that look. Before, the look was picked by entity id.

## Regression gate

New `look` spec field (`tools/scenelab/look.ts`). At every sheet frame it compares the frame with and without the crowd view (courier and HUD bars hidden). From the crowd pixels it computes three numbers:

- the pale, unsaturated pixel share;
- the mean brightness against frame 0 (the live look);
- the saturation-weighted hue drift against frame 0.

The gate scenes are `alpha-hit-corpse-{base,worker,hoodie,fire,suit,mega,mega-ashen,mega-ember}`. Each fires 4 close shotgun shells until the body drops, then the body lies to frame 240. They are in `scene:matrix` and `scene:matrix:remote`.

| Run | Scenes | Max white share (≤ 0.03) | Max brightness rise (≤ 2.2) | Max hue drift (≤ 60°) |
|---|---|---|---|---|
| Before fix, WebGL2 (Hetzner) | base, mega | 0.45 | 6.2 | 86.5 |
| After, WebGPU Mac, high/low × zoom 1.5/1/0.5 | 8 looks, 48 runs | 0.0003 | 2.12 | 53.2 |
| After, WebGL2 (Hetzner) | 8 looks | 0.0002 | 2.1 | 43.8 |

## Captures (described)

- **01 → 02, L4 generator, 13b-style paused stepping, high, WebGPU.**
  - Before (t9310): two Alphas at the generator are white faceted masses.
  - After (t9166, same bot route): the Alphas are orange with dark trousers and red wounds. The downed one lies dark and orange beside the generator.
- **03 → 04/05, L5 metro street.**
  - Before (QA 13b capture, t8018): a pink-white live Alpha.
  - After, t7996: a dark helmet, charcoal body and purple-grey hands, under fire.
  - After, t8188: the downed Alpha (0 HP, recoverable) keeps the same palette: lilac-grey head, dark body, red eyes. The followers around it still show the separate L5 lamp/aura bleaching (#28).
- **06 → 07, `vfx-alpha-hit`.** On hit frames f18 and f48 the Alpha used to turn fully white. It now turns a lighter orange of its own look and is back at f24.
- **08 → 09, `alpha-hit-corpse-base`.** Before, hit frames f18 and f54 were grey-white. After, the f18 flash is a lighter purple, and the corpse keeps its dark body, purple arms and red wounds.
- **10, 11.** The Mega ember look (low, zoom 0.5) and the hoodie (high, zoom 0.5) keep burnt-orange/bone and teal through the hit, the fall and the corpse.

Not measured: L4 low tier and the L5 WebGL run in play. The bot route at low tier left no Alpha in frame; the scene matrix covers low tier. I took a real-time (unpaused) L4 baseline on the original code: Alphas mostly looked right there, so the in-play white came mainly from items 1 and 2 above.
