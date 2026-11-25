# s235 corn parting — work in progress

The corn-specific opacity fade and the shared player see-through cut were removed. The current shader uses a fixed set of mover uniforms and a one-second directional wake. The courier has a reserved slot; nearby infected, the corgi and vehicles compete for the remaining slots. Corpses and building occlusion code were not changed.

## Evidence

- Typecheck and lint passed on `e085f7b4`.
- The remote unit suite passed on `bbedaab8` (27 files, 105 passed, one skipped, 216.4 seconds). The later world-reset change has not had a remote suite run.
- HIGH and LOW WebGL2 captures at zoom 1 and 1.5 were generated under `/private/tmp/s235-corn` on `bbedaab8`. Close frames show corn drawn in front of the courier and corgi. They do not establish clean parting, smooth recovery or the absence of distortion and popping.
- A quiet L10 performance attempt was not admitted within 180 seconds due to host load. No current frame-time result is claimed.

## Open

The shader evaluates influence at each vertex. The authored mesh combines stalks, leaves, tassels and soil; vertices of a long leaf can receive different pushes. This can distort a leaf rather than bend its stalk as a unit. `tools/blender/sslib/farm_assets.py` knows the `(x, y)` root while it builds each stalk, but `src/assets/staticBatch.ts` merges only a fixed set of attributes. A proper root attribute needs to survive both GLB loading and `staticBakes.json` delivery before the shader can use a common influence per stalk. Rebuild and validate all three LODs and their static bakes, then review motion through turns and after passing.

Verify the eight-slot limit against crowds and vehicles; only the courier is guaranteed a slot. Review HIGH then LOW at both requested zooms with the courier and following corgi, including a temporal sequence. Confirm WebGPU separately, run the remote unit suite on the final commit, and compare L10 frame time against a matching baseline receipt. The current work is not acceptance complete.
