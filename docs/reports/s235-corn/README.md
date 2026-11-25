# s235 corn parting — work in progress

The corn-specific opacity fade and the shared player see-through cut were removed. The current shader uses a fixed set of mover uniforms and a one-second directional wake. The courier has a reserved slot; nearby infected, the corgi and vehicles compete for the remaining slots. Corpses and building occlusion code were not changed.

## Evidence

- Typecheck and lint passed on `de427978`.
- The remote unit suite passed on `de427978` (27 files, 105 passed, one skipped, 211.9 seconds), after an unchanged rerun of a timed-out attempt.
- HIGH and LOW WebGL2 captures at zoom 1 and 1.5 were generated under `/private/tmp/s235-corn` on `de427978`. Close frames show corn drawn in front of the courier and corgi. They do not establish clean parting, smooth recovery or the absence of distortion and popping.
- A headless WebGPU diagnostic on `bc96c63c` reported the requested backend at both qualities and zooms, without captured console errors. Manual WebGPU review remains open.
- Quiet L10 performance attempts were not admitted within 180 seconds due to host load or another active browser. No current frame-time result is claimed.
- Six fixed-camera HIGH stopped frames were inspected together. The corgi approaches and the crop remains drawn; overlapping dark silhouettes make individual stalk recovery and popping indeterminate.

## Open

The generator now authors a common root for each stalk, leaf and tassel; all three packed LODs and static bakes contain it, and the shader evaluates influence at that root. Review motion through turns and after passing, including whether the one-second straight-line wake reads naturally.

Verify the eight-slot limit against crowds and vehicles; only the courier is guaranteed a slot. Review HIGH then LOW at both requested zooms with the courier and following corgi, including a temporal sequence. Confirm WebGPU separately, run the remote unit suite on the final commit, and compare L10 frame time against a matching baseline receipt. The current work is not acceptance complete.
