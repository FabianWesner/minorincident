# TRELLIS zebra — direct replacement of `amb.zebra` / `inf.zebra`, without switches or parallel IDs.
LOD0/1/2: **5801/1751/667 triangles**; exact production pivots, sockets, hidden caps and embedded actions; [source/rebuild and runtime proof](capture-proof.json), pipeline commit `2339b3f`.
[WebGL2 low zoom 1](webgl2-low-zoom1.png), [1.5](webgl2-low-zoom1.5.png): broader source stripes remain distinct at 512; leaner fitted legs, muzzle, mane and tail read cleanly.
[WebGL2 high zoom 1](webgl2-high-zoom1.png), [1.5](webgl2-high-zoom1.5.png): 1024 hide retains face and stripe edges; healthy cream hide and desaturated infected hide separate clearly.
[WebGPU low zoom 1](webgpu-low-zoom1.png), [1.5](webgpu-low-zoom1.5.png): matches WebGL2; no fallback, detached surface fragments or white atlas failures; infected eyes read red.
[WebGPU high zoom 1](webgpu-high-zoom1.png), [1.5](webgpu-high-zoom1.5.png): consistent stripe contrast and connected neck/leg silhouette; every matrix sheet includes main, original draft and the selected pipeline viewer.
[Special motions](special-motions.png): rear kick extends/retracts without detached legs; stampede keeps three striped bodies coherent through the telegraph and charge.
[Walk/chase/hurt/death](gaits-hurt-corpses.png): real movement, light-hit response and permanent kill; the frozen body stays textured at 3/30 s, with 0 cm floor offset.
Zoo native low p95/draw/triangle comparison is pending exclusive admission; decoded atlas memory: main 0 → low 5.33 MiB / high 32 MiB; live batches use 4 buffers / 15 attributes.
Full validator, focused tests and 31 browser + 6 remote smoke checks green; remote unit/levels, E07 verification and browser invariants are in progress.
