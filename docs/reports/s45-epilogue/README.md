# S45 Epilogue

The panorama tide clouds used a broad pale-green overlay (`#b6f27a`, base opacity .16). Darkened the dust and reduced opacity so the pull-out retains terrain colour while the green release column remains visible.

The closing corgi reuses its existing idle/sit clips and rig. A fixed presentation pose bows the head and aligns the muzzle toward the courier’s near knee. The pair sits 35 cm farther forward on the lowest stair, clearing the railing. Both figures remain drawn. No gameplay or statistics changed; shared clip code was untouched.

## Opened captures

Captured before/after at zoom 1 and 1.5, low/high, WebGL2/WebGPU (8 pairs). Baseline render files came from fc167cd0; final captures use the delivered render changes. Backend receipts confirm actual WebGL and WebGPU with zero browser errors. Raw images are ignored under `test-results/s45-epilogue/`; [capture manifest](captures.json) lists the cases.

Opened the before/after closing and panorama contact sheets, the final closing sheet, and full-size closing frames including a later sample. Before: dog upright in front of the courier; broad pale-green patches over terrain. After: dog beside her with muzzle resting at the near knee, railing behind the pair; the terrain keeps its dry/olive regional colours beneath a subtler dust tide. The later closing sample retains the pose without accumulated head rotation. [Closing comparison](closing-pairs.jpg).

The QA runner uses the campaign save with the current dispersal checkpoint because the old fixture resume is salvaged away, and isolated Scene Lab resets the cinematic camera. It stages the release clock through the production epilogue controller, then uses the production camera and renderer.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `sh tools/remote/run.sh "$PWD" -- npm test`: passed on 94.130.181.173, 106 passed / 1 skipped, 27 files, 166.8 seconds (240-second budget); case budget 150/150. Render-contracts: 14 passed.
- One headless browser at a time through `tools/e2e-lock.sh`, Scene Lab port 4939. No servers left running by the capture runner.
- No specs, reference assets, gameplay, or shared animation clips changed.
