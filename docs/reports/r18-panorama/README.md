# R18 — L10 panorama under the green dust

The epilogue now pulls out over dry fields and clustered woodland into a warm dawn horizon. A green ground wave and eight soft dust volumes spread from the dispersal complex across the complete level. Gameplay overlays disappear during the cinematic shots.

## Changes

- **HUD:** cinematic mode hides portraits, vitals, corgi/weapon panels, minimap, objective markers, pause/touch controls and world health bars. Mission captions, title and credits remain visible. The same rule covers the montage, closing shot, panorama and post-credits shot.
- **Dry soil:** the L10 grass palette texture now uses its authored dry swatch (`#66583f`) in both palette sheets. Coarse terrain and the default backdrop had retained part of the original green palette.
- **Landscape:** replace panorama soil/backdrop slabs with continuous dry field parcels and 8,296 distant woodland instances. Surroundings cost two draws, have no collision or gameplay residency, and extend beyond the level bounds. Keep the R17 building/landmark LOD.
- **Camera and sky:** ease the ending lens from 25° to 60° and fit the complete footprint in an oblique view. Portrait looks along the route. The far plane and atmospheric fog reach the horizon. Weather was overwriting the cure dawn every frame; apply dawn after weather and ease the night grade into the warm ending grade.
- **Green dust:** use a broad feathered ground tint advancing from the console during the pullback, plus eight noise-modulated soft ellipsoids in one instanced draw. This compresses the visual journey into the existing 15 s pullback; simulation cure state and ending duration are unchanged.

No specification changes, new dependencies, deployment or push.

## Verification

- `npm run verify -- E32` — **PASS**: typecheck, lint and all 107 shared tests in 27 files. `npm run test:unit` aliases this same unit command. [Receipt](E32-checks.json), [log](validation.log.gz).
- `npm run build:qa` — **PASS**. [Bundle hashes](build.json), [build log](build.log.gz).
- **Eight browser cases PASS**, with 88 screenshots and 35,330 rendered ending frames. High/low × WebGL2/WebGPU × landscape/portrait; every case captures release, montage, closing shot, 50/55/60/65 s, credits and thanks. No runtime errors, placeholder warnings or gameplay HUD leaks.
- **One reviewed sheet:** [panorama.jpg](panorama.jpg), 16 full-frame thumbnails, 231 KiB. [Image provenance](sheet.json).
- `python3 docs/reports/r18-panorama/audit.py` — **PASS**. [Audit receipt](audit.json). Source, producer, seed and screenshot hashes match; all final level corners lie inside the camera frame on both aspects.

### Every-frame geometry maxima

Low limits: **300 draws / 500,000 triangles**. High limits: **600 / 1,500,000**. All rows pass. These are the same E18 limits used by R17.

| Tier | Renderer | Aspect | Max draws | Max triangles | Rendered frames |
| --- | --- | --- | ---: | ---: | ---: |
| low | webgl2 | landscape | 209 | 274,651 | 4,416 |
| low | webgl2 | portrait | 207 | 268,905 | 4,422 |
| low | webgpu | landscape | 209 | 274,651 | 4,419 |
| low | webgpu | portrait | 207 | 268,905 | 4,415 |
| high | webgl2 | landscape | 253 | 392,936 | 4,398 |
| high | webgl2 | portrait | 230 | 364,685 | 4,421 |
| high | webgpu | landscape | 253 | 392,936 | 4,422 |
| high | webgpu | portrait | 230 | 364,685 | 4,417 |

### Visual review

**PASS:** the level sits in continuous dry fields with dark woodland masses and a warm atmospheric horizon. There is no exposed terrain slab edge or blue void. The green tide is visible over the ground during the pullback, with soft volumes that leave roads and landmark footprints readable. Portrait follows the long route into the horizon; landscape shows it across the frame. The title remains legible. The sheet shows both backends and both tiers; full-size high-tier and portrait images were also reviewed.

The pre-release captures show gameplay UI (including real touch controls); all ten ending captures per case show no gameplay overlays or world health bars. Mission captions/title/credits remain available.

Captured non-fatal renderer warnings are retained: KTX2 loader multiplicity and the WebGPU empty-draw warning. There are no runtime errors or missing-asset placeholders. [Browser run log](browser-matrix.log.gz).

Source fixes are committed locally in `7a947dd6` (cinematic overlays), `52b34765` (dry soil), `11919f3d` (touch CSS priority), and `aacba203` (landscape, mist, camera and dawn).

## Capture method

`capture.ts` restores the retained quality-specific production pre-release campaign saves, runs the production completion bot until release, detaches it, and follows the natural simulation clock through title, credits and thanks. Photographs pause the same state. Every rendered ending frame contributes draw/triangle maxima, including camera/LOD transitions. This is a geometry check; no frame-time or FPS claim is made.

Each command uses one headless SceneSession/browser-pool context at a time, preview port 4351 and a 600 s outer watchdog. Landscape is 1280×720. Portrait is 720×1280 with real touch controls enabled; its pre-release image proves those controls are visible before cinematic mode hides them. Receipts verify the actual WebGL 2 context or WebGPU backend, requested quality, simulation clock, gameplay overlay visibility, and final projection of all four level corners.

Each receipt retains source revision, source file hashes, capture-producer hash, seed hash, camera/state, image path/hash, and every-frame geometry maxima. The raw JPEGs are local under `/private/tmp/r18-panorama/final/`; the compact contact sheet is the retained visual evidence.

Reproduce one case, substituting tier/backend/aspect as needed:

```sh
SCENE_SERVER=preview SCENE_PORT=4351 BROWSER_POOL_JOB_ID=r18-panorama \
  python3 tools/browser-job.py --seconds 600 -- \
  node --import tsx/esm docs/reports/r18-panorama/capture.ts low webgl2 landscape
```

After the full matrix: `python3 docs/reports/r18-panorama/sheets.py`, then `python3 docs/reports/r18-panorama/audit.py`. Regeneration/audit uses the raw JPEGs while they remain available.
