# s235 corn parting — work in progress

The corn-specific opacity fade and the shared player see-through cut were removed. The current shader uses a fixed set of mover uniforms and a one-second directional wake. The courier, corgi and driven car have reserved slots; other nearby infected and vehicles compete for five remaining slots. Corpses and building occlusion code were not changed.

## Evidence

- Typecheck and lint passed on `845ded3a`.
- The remote unit suite passed on `845ded3a` (27 files, 105 passed, one skipped, 216.1 seconds).
- HIGH and LOW WebGL2 captures at zoom 1 and 1.5 were generated under `/private/tmp/s235-corn` on `845ded3a`. Close frames show corn drawn in front of the courier and corgi. They do not establish clean parting, smooth recovery or the absence of distortion and popping.
- A headless WebGPU diagnostic on `de6e7ff6` reported the requested backend at both qualities and zooms, without captured console errors. The zoom 1.5 frames show the courier and corgi partially obscured by dense HIGH crop and more visible in sparser LOW crop. They do not prove smooth parting. Manual WebGPU review remains open.
- An exclusive quiet-run of `tools/perf/s194-l10hitch.ts webgl2 high s235-final` on `845ded3a` collected 1,240 samples at the L10 crash checkpoint: max 49.9 ms, p99 30.5 ms, zero frames above 100 ms and no captured errors. This is a different route from the earlier L10 receipt and does not establish a before/after regression comparison. Earlier admission attempts expired; one shared-mode attempt was admitted but could not launch the required Chrome channel.
- Six fixed-camera HIGH stopped frames were inspected together. The corgi approaches and the crop remains drawn; overlapping dark silhouettes make individual stalk recovery and popping indeterminate.

## Open

The generator now authors a common root for each stalk, leaf and tassel; all three packed LODs and static bakes contain it, and the shader evaluates influence at that root. Review motion through turns and after passing, including whether the one-second straight-line wake reads naturally.

Verify the eight-slot limit against crowds and vehicles; three slots are reserved for the courier, corgi and driven car. Review HIGH then LOW at both requested zooms with the courier and following corgi, including a temporal sequence. Confirm WebGPU separately and compare L10 frame time against a matching baseline receipt. The current work is not acceptance complete.
