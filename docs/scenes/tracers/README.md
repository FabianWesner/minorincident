# Moving bullet tracers

These fixtures use the production L4 rifle bursts (four national guards firing at an Alpha) and the courier's army MG. The L4 lighting, real gun poses and hit rays are preserved. No fixture emits synthetic gunshot events.

Run the headless review with one browser admission unit and a private port:

```sh
SCENE_PORT=3497 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/tracers.ts
```

The runner covers WebGL2/WebGPU, high/low, and zoom 0.5/1/1.5. `TRACER_CASE=webgpu-low-z0.5-squad` restricts a diagnostic run. Results go to `test-results/tracers/`: each case has twelve consecutive full-size PNGs after its first shot, a labelled contact sheet, a 60 fps WebM, and the GPU slot/time/head probes. A second PNG sequence samples the first shot every 1/240 s with simulation frozen; its WebM plays at 60 fps (four times slower) so close-zoom travel can be inspected. The summary verifies the actual backend, 320 m/s motion between frames, one-metre maximum streak length, hit clipping, particle caps, and E18 draw/triangle limits.

Review the PNGs in sequence: a thin warm streak should move several metres between adjacent frames and disappear at the hit. Allied guns show one tracer per three rounds; every courier round shows one. Muzzle flashes, brass and miss dust remain visible. There must be no row of stationary dots/dashes across the ray. At close zoom a muzzle or target can lie outside the camera; the short streak must cross the visible portion rather than filling it.

The production change shares the existing instanced particle pool and attributes. Shape 11 interprets size as streak length, gravity as ray distance and aspect as width. Its zero-alpha, premultiplied RGB adds light in the ordinary particle draw; ordinary particles retain normal alpha occlusion. Flight starts 8.3 ms after the emission (half a 60 Hz interval), so the first advancing draw still shows a close-zoom player bullet. The head then moves at 320 m/s; slots expire at the hit and are reused by the existing pool. Ordinary gun projectiles keep their simulation flight but no longer draw a duplicate orange sphere; rocket and throwable bodies remain visible. The existing short, translucent four-metre muzzle aim cue remains a separate aiming aid.
