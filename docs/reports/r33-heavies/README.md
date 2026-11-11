# r33-heavies: own bodies for brute, armored, butcher, screamer, bloated; fewer heavies in L4

Audit finding P1-C (r31): the five heavy roles had no skinned body and were drawn as the suit office worker. Each now has its own
crowd skin. L4 draws fewer of the heavy roles. Branch: `worktree-agent-a689469e8e6a86e14`.

## How the bodies are built
`tools/assets/heavy-roles.ts` + `heavy-roles-data.ts` (recipes). Each role is derived from a shipped skinned infected look, so rig,
joints, atlas classes and every crowd clip are unchanged:
1. bind-pose proportion edits per joint (radial/axial scale, belly bulge, open jaw) with rebuilt normals on moved vertices;
2. one uniform scale of the whole rig (vertices, joint translations, inverse binds = inverse of the new joint world matrices, sole
   bounds, carried props);
3. extra solid pieces (helmet, plates, apron blood, cap, cleaver, pustules ...) skinned 100% to one joint and merged into `skin_body`,
   coloured from a 32 px swatch strip appended to the atlas, placed relative to the joint's vertex bounding box (works on every LOD);
4. garment texels of chosen parts recoloured (skin and blood spared), marked "authored" so the per-person crowd tint leaves them.
Output goes through the normal `compressSkin` (KTX2 + meshopt, high and low atlases), `validateAssets`, `skinCrowdBakes`, manifest
(`crowdSkin: true`, `textureMode: baseColor`) and `civilianBakes.json`. Rebuild: `node --import tsx tools/assets/heavy-roles.ts all`.
Blender is used only for the quick bind-pose preview (`tools/assets/heavy-preview.py`); the build itself is glTF-transform, because the
shipped skins are not rebuildable from Blender (they come from the TRELLIS cast pipeline) and a Blender round trip would rewrite the rig.

| Role (asset id) | Base look | Look | Tri LOD0 / 1 / 2 | Caps (budget / authored LOD) | File KB high LOD0 / 1 / 2 (low LOD0) |
|---|---|---|---|---|---|
| brute (`inf.brute`) | common-worker | x1.28, torso 1.45x wide, arms 1.7x thick, fists 1.9x, torn safety-orange vest, yellow reflective strips, grey shoulder lumps, belt | 6016 / 2356 / 888 | 6600 / 2700 / 1000 | 309 / 134 / 97 (240) |
| armored (`inf.armored-football`) | common-worker | x1.1, olive fatigues, steel helmet with dark visor, chest and back plates with dark rim, pauldrons, shin plates | 6504 / 2568 / 974 | 6800 / 2700 / 1050 | 310 / 137 / 98 (244) |
| butcher (`inf.butcher`) | bbq-dad | x1.32, bulky, brown shorts, bloodied apron (spatula and "CHILL" decal removed), chef cap, cleaver in the right hand | 5220 / 2136 / 2052 | 6200 / 2600 / 2600 | 204 / 105 / 104 (180) |
| screamer (`inf.screamer`) | nurse | x1.16, thin torso and arms (long forearms), pale hospital gown, jaw dropped open on a dark cavity with teeth | 5968 / 2440 / 808 | 6300 / 2600 / 900 | 348 / 148 / 65 (313) |
| bloated (`inf.bloated`) | cashier | x1.18, swollen belly (bulge 0.27 m), red apron over it, yellow-green and purple pustules | 6086 / 2488 / 2428 | 6800 / 2900 / 2900 | 373 / 148 / 138 (329) |

Triangle counts are the build's (the validator counts hidden stump caps too and passes the caps shown). The existing looks use
6000/2500/900 (infected) and 8000/3000/1000 (Alpha). Butcher and bloated LOD2 equal LOD1 because their bases already shipped one mid
tier for both. Bounds tolerance is 0.25 (screamer) and 0.35 (bloated) because the bulge/jaw/thin-gown edits change the LOD0/LOD2 bounds
more than 15% (without it the registry falls back to LOD0 for the far tiers; checked: no `asset.lod-fallback` events now).

## In-level census (which model each heavy draws)
`tools/qa/r33/heavy-census.ts` (seed 1, complete policy): per infected archetype the asset the crowd draws
(`infectedDef(archetype).asset`, the selection CrowdView uses) and whether it is a skinned crowd look. Every heavy entity: own model,
`ownSkinned: true`. No heavy draws `inf.common-worker` any more.

| Level | Heavy archetype -> drawn asset (skinned) | Count |
|---|---|---|
| L4 | brute -> `inf.brute`, armored -> `inf.armored-football`, butcher -> `inf.butcher` | see mix table |
| L5 | butcher -> `inf.butcher` (L5 spawns 1 in this run; 2 authored) | 1 |

Scene Lab (real CrowdView, actors `infected.<role>`) shows the same: all five draw their own bodies next to the runner. Not run here:
screamer/bloated in L9/L10 (not touched; their archetype->asset map is the same).

## L4 mix and threat audit (follow-up after the orchestrator decision: breach cohorts keep their roster)
Mechanism (`LevelFourWar.emerge`): a heavy pick is redrawn as the least represented of runner/sprinter/firefighter for `l4HeavyReplaceShare`
(.6) of the draws (deterministic `appearanceSample`, no gameplay RNG, no stat/count/wave-size change). Thinning is paused for the first
`l4HeavyThinFromS` (60 s) and for `l4HeavyBreachWindowS` (30 s) after every breach opens. A per-source flag was tried first and had no effect:
the war-wave spawns come from the same `side`-tagged camp sources as the breach cohorts, so "breach cohort" had to be defined by time window.

Census (seed 1, complete bot, unique infected, L4): r31 before 12 + 10 + 10 = 32 heavies; old mix with the new bodies 29 of 120 (24.2%).
| Setting (share .6 unless noted) | Heavies | L4 skilled threat flags (baseline: `war-0` only) | Complete |
|---|---|---|---|
| shipped: pause < 60 s and 30 s breach windows | 29 of 120 (24.2%): **no real reduction** | `war-0` only (= baseline) | yes |
| thin from 0, 45 s breach windows | 24 of 126 (19.0%) | war-0 + breach-west + breach-north first attack > 20 s | yes |
| thin from 0, no windows | 21 of 126 (16.7%) | same two extra flags | yes |
| thin after 40 arrivals + 45 s windows | 23 of 124 (18.5%) | hold UNREACHABLE_SHARE_OVER_30_PERCENT, breach-south NO_ATTACK_WITHIN_20_SECONDS | yes (482 s) |
| share .75, thin from 0 | 11 of ~126 (9%) | 9 flags | yes |

**Result: the two goals conflict in this mechanism.** Only 17 of 103 `emerge` draws fall outside the protected windows, and the ones that
matter (war-0/war-1, breach cohorts) are exactly the draws whose heavies reach the courier first; thinning any of them delays breach-west
first contact (15 s -> 26-66 s) or leaves infected piled at the wire (heavies break it). The shipped default therefore keeps the audit at
baseline and reduces nothing in the census; the real reduction needs a different lever (for example fewer heavies per authored wave in
`l4.ts` data, or a PO call that breach first-contact may slip ~6-10 s). To get ~19% set `l4HeavyThinFromS = 0` and `l4HeavyBreachWindowS = 45`
(two extra first-attack flags). L4 contact and spawn-director tests pass, typecheck passes; `war-waves` nightly fails identically on baseline.

Night: at night the heavies look washed out like the other crowd figures (WebGPU low lineup) - no action needed in this lane.

## Visual verification (Scene Lab, raw captures in the scratchpad, `r33-heavies/sl-<backend>-<tier>/`)
Specs: `specs/scenes/r33-heavies/` (lineup of runner + 5 roles at game zoom 1.5 and 1.0 day, game zoom 1.5 night, orbit close lineup, and a
runner + role pair per role). Run on WebGL2 high, WebGL2 low, WebGPU high, WebGPU low: 36 scenes, all `consoleErrors: 0`, clipping 0.
Contact sheets in git (left WebGL2 high close, right WebGPU low close): `brute.jpg`, `armored.jpg`, `butcher.jpg`, `screamer.jpg`,
`bloated.jpg`; `lineup.jpg` (left zoom 1.0 day WebGL2 high, right zoom 1.5 night WebGPU low).
Opened and described:
- **Lineup at the game camera (zoom 1.5 and 1.0)**: five distinct silhouettes next to the runner: butcher widest and pale with a white cap and
  cleaver, armored grey helmet and green fatigues, brute hunched in orange with grey shoulders, screamer pale gown, bloated red-bellied.
  Heights: butcher and brute clearly above the runner. At night (WebGPU low) all five still read as different shapes; the butcher is the
  brightest.
- **brute (close)**: huge fists, orange vest torn at the hem, two yellow strips, grey shoulder lumps, dark belt. Reads "construction-site tank".
  The yellow strips and the belt are plain flat boxes.
- **armored (close, low)**: helmet with visor slit, round chest plate with dark rim, pauldrons. Reads as armour at game zoom; at close
  zoom the plates are flat discs and the helmet a plain dome: a modelling pass would help (flat panels were the Sol failure mode too).
- **butcher (close)**: bulk, bloody discs on the apron, cap, cleaver. The cleaver is a flat slab and the blood discs look like red plastic
  at close zoom (WebGPU high capture); fine at game zoom.
- **screamer (close)**: pale thin figure, dark open mouth with the chin dropped. The open jaw reads mostly as a dark beard at game zoom.
- **bloated (close)**: round red apron belly with yellow-green/purple pustules; the collar/gown shards on the chest are a little noisy.
Not verified: animated poses (only idle; the heavy gaits/attacks are unchanged shared clips, so the dedicated heavy gait/attack asks of
P1-C remain open), dismemberment/corpse look of the new bodies, L4/L5 in-level browser capture (sim census only), and A/B against PROD.

## Files
`tools/assets/heavy-roles.ts`, `heavy-roles-data.ts`, `heavy-preview.py`, `tools/qa/r33/heavy-census.ts`, `specs/scenes/r33-heavies/*`,
`assets/inf.{brute,armored-football,butcher,screamer,bloated}/model.skin.glb`, `public/assets/models/skinned/inf.<role>.lod{0,1,2}[.low].glb`,
`public/assets/civilians/inf.<role>.*.bin.gz`, `src/assets/manifest.json`, `civilianBakes.json`, `src/data/l4.ts`,
`src/sim/missions/LevelFourWar.ts`.

## Lessons
- A uniform rig scale must rebind with the inverse of the new joint world matrices; scaling the old inverse binds is only right when the
  joint chain has no rotation/scale, and the in-engine bounds (three skin bounds vs raw positions) caught it: raw 1.446 m vs skinned 1.25 m.
- Reducing heavies in L4 shifts first-contact timing in the threat audit; knob and options above.
