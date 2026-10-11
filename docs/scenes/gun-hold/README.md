PO 2026-10-11: selected weapon alone in the hands; a gun carried naturally standing, walking and shooting.

Run the full Scene Lab matrix with the shared headless browser lock:

```sh
SCENE_PORT=3367 sh tools/e2e-lock.sh npx tsx tools/scenelab/gun-hold.ts
```

Both courier variants share their campaign rigs across L1–L6. The 88-case matrix includes bare and maximum cumulative gear (`look.gearTier: 4`) for both campaign guns, and covers handgun, fixture pistol, army MG, shotgun, nail gun, SMG, hunting rifle, assault rifle and rocket launcher, each with bat/fists in the other slot, at the game and close cameras. It records shots, labelled contact sheets, sampled grip/visibility/barrel/shot probes and clipping metrics under `test-results/gun-hold/`. The clipping gate is zero and uses the unchanged body radii/tolerances; visible guns are now checked during idle and locomotion too.

The base timelines show idle (0–10), walk (20–30), run/reversal (40–60), aim/raise (64–70), firing/recoil (72–90), turn while aiming (96–110), walking fire (112–150), lowering (160–180), melee selected (192–207), and gun reselected (208–224). The fixture pistol has a separate aim/fire/magazine-empty/reload/resume timeline; campaign handgun and MG have unlimited ammunition and no reload. Neither courier has a crouch state. The companion is a corgi, which cannot equip a gun.

Four additional unprepared-first-click scenes record the current zero-windup edge explicitly: frames 19–20 are low ready and frame 21 raises immediately for the first shot. Preparatory aim, held fire and recovery blend; this edge remains a limitation pending a decision on first-shot windup.

The render regression covers number keys, wheel cycling, pickup, level-style initial loadout, magazine-empty reload, checkpoint respawn, aim blending, gait turns and the muzzle/tracer contract. Existing gun-pose regression also covers armed NPCs, including police/soldier/civilian followers.

Camera geometry: game radius 19 m, close radius 6 m; both retain the production polar/azimuth. The full long muzzle remains in the close framing. See [frame review](review.md) and the eight-line [report](report.md).
