# Skinned courier pilot

Both L1 courier variants use fitted skins by default; `?skin=0` selects the rigid fallback.
`DEFAULT_SKIN` in `src/render/characters/RiderContacts.ts` is the one-line default
switch. Explicit URL flags always override it. Later-level survivors keep their
current assets. See `docs/reports/player-anim.md` for the gait/contact revision,
measurements and paired motion-review tools in `tools/playeranim/`.

The inherited skin asset retains the courier's fitted joint names and original
outfit. It is a single welded mesh with an aligned skeleton. Mesh2Motion CC0
human clips are retargeted offline onto that joint contract; this is an adapted
rig rather than the unmodified full Mesh2Motion skeleton. Base/addon clips are
pinned to commit `79f3f61a9852ef70234a5a4a7c13ed87f7a71833`.

Runtime uses the existing AnimationMixer speed blend. Actual view displacement
advances locomotion phase, with the main branch's cadence cap. World-space heel
plants correct support feet after the blend. Two-joint IK uses the loaded rig's
limb lengths. Bike saddle, grips and pedal targets are read from named model
nodes after steering, crank and lean. A 0.4-second presentation transition blends
mount/dismount contacts. The simulation does not read any of these corrections.

The pinned library has no kick or bicycle mount clips. Kick, mount/dismount and
other unsupported actions use our authored animation library. Bat swings reuse
retimed CC0 sword swings with contact at 20% to preserve the combat timing
contract. Ride uses a stable idle upper body with solved limb contacts.

Run the tools from this worktree (all browser work is headless and locked):

```sh
npm run build
E2E_PORT=3354 sh tools/e2e-lock.sh npx tsx tools/skinpilot/l1-ab.ts test-results/skin-pilot
npx tsx tools/skinpilot/profile.ts test-results/skin-pilot --both
E2E_SKIN=0 E2E_PORT=3355 npm run test:smoke
E2E_SKIN=1 E2E_PORT=3355 npm run test:smoke
```

The capture uses identical seeded L1 inputs and deterministic paused stepping,
15 captured frames/second, and emits two 12.80-second VP8 WebM videos plus full
resolution stills, browser CPU/draw samples, a summary and final sim state.
Intermediate frames are deleted after encoding. The mount fixture places the
bike on clear road through the existing test API. The scene covers idle, walk,
run, punches, kick, bat, hit reaction, mount, pedalling and dismount.

Set `FFMPEG_BIN` if the bundled Playwright FFmpeg is elsewhere. Encoding uses
`image2pipe` with JPEG frames, supported by Playwright's minimal FFmpeg; no new package is needed.
`--perf-only` skips image/video capture.

The CPU probe runs the actual CharacterView/mixer/IK, world matrix propagation
and Skeleton.update on the real GLBs, with 300 warm-up and 2,000 measured frames
per pose. It measures presentation only; browser counters provide the renderer
comparison. GPU skinning time is not claimed as CPU work. Keep the CPU report's
hardware and method alongside its timings.

To regenerate the retargeted library, prepare the external pinned checkout as
in `tools/motionlab/README.md`, then:

```sh
MESH2MOTION_SOURCE=/path/to/pinned/mesh2motion-app npx tsx tools/skinpilot/retarget.ts
```

Skin mesh rebuilding uses `assets/char.courier-female-skin/build.py` or
`assets/char.courier-male-skin/build.py`, followed by `tools/skinpilot/compress.ts`.
No bike model changes are needed for contacts.
