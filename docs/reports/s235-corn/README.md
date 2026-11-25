# s235 corn parting — work in progress

The corn-specific opacity fade and the shared player see-through cut were removed. The current shader uses a fixed set of mover uniforms and a one-second directional wake. The courier, corgi and driven car have reserved slots; other nearby infected and vehicles compete for five remaining slots. Corpses and building occlusion code were not changed.

## Evidence

- Typecheck and lint passed on `845ded3a`.
- The remote unit suite passed on `845ded3a` (27 files, 105 passed, one skipped, 216.1 seconds).
- HIGH and LOW WebGL2 captures at zoom 1 and 1.5 were generated under `/private/tmp/s235-corn` on `845ded3a`. Close frames show corn drawn in front of the courier and corgi. They do not establish clean parting, smooth recovery or the absence of distortion and popping.
- A headless WebGPU diagnostic on `de6e7ff6` reported the requested backend at both qualities and zooms, without captured console errors. The zoom 1.5 frames show the courier and corgi partially obscured by dense HIGH crop and more visible in sparser LOW crop. They do not prove smooth parting. Manual WebGPU review remains open.
- Exclusive quiet-runs of `tools/perf/s194-l10hitch.ts` on the parent `7d820cdd` and candidate `845ded3a` used the same HIGH WebGL replay. Baseline: 1,298 samples, max 51.6 ms and p99 31.1 ms; candidate: 1,240 samples, max 49.9 ms and p99 30.5 ms. Both had zero frames above 100 ms and no captured errors. Both traversed x=547–589.57, z≈0: this route does not exercise the corn field and cannot establish the crop's performance impact. Earlier admission attempts expired; one shared-mode attempt was admitted but could not launch the required Chrome channel.
- Six fixed-camera HIGH stopped frames were inspected together. The corgi approaches and the crop remains drawn; overlapping dark silhouettes make individual stalk recovery and popping indeterminate.
- A paired exclusive quiet-run of `tools/perf/s235-corn.ts` traversed x=555–565.17 at z=42 in the field for six seconds, HIGH WebGL2, 1280×720. Parent `7d820cdd`: p95 7.1 ms, p99 8.5 ms, max 12.7 ms (1,004 samples); candidate `845ded3a`: p95 7.2 ms, p99 8.8 ms, max 11.6 ms (961 samples). Both reported no browser errors. This single dev-server pair is an observation rather than a distribution or the original L10 receipt's full-route gate.

## Open

The generator now authors a common root for each stalk, leaf and tassel; all three packed LODs and static bakes contain it, and the shader evaluates influence at that root. Review motion through turns and after passing, including whether the one-second straight-line wake reads naturally.

Verify the eight-slot limit against crowds and vehicles; three slots are reserved for the courier, corgi and driven car. Review HIGH then LOW at both requested zooms with the courier and following corgi, including a temporal sequence. Confirm WebGPU separately and compare L10 frame time against a matching baseline receipt. The current work is not acceptance complete.
