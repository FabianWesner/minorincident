| TRELLIS zebra | Proof / reviewed captures |
| --- | --- |
| Delivery | Direct `amb.zebra` / `inf.zebra`; 5801/1751/667 triangles, 512/1024 atlases and fresh UVs; shared `textureMode: baseColor`; unchanged motions, pivots, sockets and caps; desaturated infected, `#ff3b2f` eyes. [Rebuild/rig proof](capture-proof.json), pipeline `1be1c5a`. Every matrix includes main, replacement, original reference and pipeline viewer. |
| WebGL2 low | [Zoom 1](webgl2-low-zoom1.png), [1.5](webgl2-low-zoom1.5.png): 512 stripes remain distinct; lean fitted legs stay connected; healthy cream and infected hide separate clearly. |
| WebGL2 high | [Zoom 1](webgl2-high-zoom1.png), [1.5](webgl2-high-zoom1.5.png): 1024 face edges, ears, mane, muzzle and tail read cleanly without floaters. |
| WebGPU low | [Zoom 1](webgpu-low-zoom1.png), [1.5](webgpu-low-zoom1.5.png): matches WebGL2; red eye dots remain visible, with no missing atlas or detached surfaces. |
| WebGPU high | [Zoom 1](webgpu-high-zoom1.png), [1.5](webgpu-high-zoom1.5.png): consistent contrast and connected neck/legs; broader source striping retained. |
| Motions | [Kick/stampede](special-motions.png): limbs stay attached through kick and charge. [Walk/chase/hurt/death](gaits-hurt-corpses.png): grounded movement; permanent corpses retain textures at 3/30 s, with 0 cm floor offset. |
| L8 cost | [Native low](performance-summary.json): WebGL2 p95 4.15 → 4.40 ms (+0.25), WebGPU 3.30 → 3.30; draws 153 unchanged; triangles 132093 → 132054; decoded atlases 0 → 5.33 MiB low / 32 MiB high; 4 buffers / 15 attributes. |
| Gates / handoff | [Receipts](gates.json): validator 1262/0; unit 2073 passed / 7 skipped; levels 470 passed / 2 probes skipped after isolated L7 retry; campaign 30/30; smoke 31 browser + 6 remote; invariants 28 remote + 12 native green. E07 deferred to orchestrator quiet-window gate; [timeouts](e07-timeouts.json): WebGL high 14/16, low 13/16, WebGPU high 15/16; later WebGPU low 15/16 samples. Retries stopped. |
