# L9 start and crossing corner flicker

## Reproduction target

PO report: seed 1, player at `(-550, 0)`, on foot, WebGPU/high, camera zoom 1.14, tick 1170. The supplied frame shows thin dark bands over the light ground and dark rectangular patches at the road edge. `l9-start.json` reproduces the start camera and captures consecutive frames in Scene Lab.

## Finding

The L9 authoring geometry contains overlapping ground surfaces at the road edge. A 2.6 m dirt shoulder is centered 7 m from the road centerline, so its inner 0.3 m overlaps the 12 m asphalt lane. The asphalt is at y=0.002 m and the shoulder at y=0.001 m. That 1 mm vertical separation is small enough for the depth buffer to alternate between them. Road cracks and skid strokes also used non-owning overlays just 1.5–1.7 mm above their pavement. This matches the bands across the road and dark rectangles at its edge; it is a geometry depth conflict rather than shadow acne.

## Change

Make the shoulder, cracks, and skids own their ground footprint. The layout emitter subtracts each owning patch from earlier pavement/ground meshes, leaving one visible surface in those pixels. The streamed layout build now regenerates D-CROSSING's horizon and terrain chunks along with the base GLB, so the authored fix reaches the runtime assets.

## Verification

Not complete yet. The current sandbox prevents the required browser and Blender runs: local TCP/Unix socket binds fail with `EPERM`, and Blender 5.2.2 exits in Metal backend detection (SIGSEGV) before loading the layout script. No before/after browser capture has been produced, so this report does not claim the visual fix is verified. Resume with the repository's headless Scene Lab on a host where the browser pool and Blender can start; capture consecutive frames at the reproduced start, then check the fork, merge, and D-CROSSING chunk corners on WebGL2 high/low and WebGPU high.
