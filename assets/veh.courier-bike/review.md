# Courier cargo bicycle rebuild review

Verdict: **PASS for asset geometry and socket contract**, based on the Cycles CPU five-view sheet and lower-tier side views. WebGPU review remains manual.

- Two wheels: one small front wheel under the front loader and one normal rear wheel. No central wheel or wheel-like chainring; the crank has a small filled gear with teeth.
- Rider space: saddle behind tub, open knee space, hand sockets reachable from the saddle. Saddle-top attachment is an empty independent of the cargo box. Runtime uses the seat X position and explicit parcel lid socket.
- Stand: complete separate `kickstand` assembly, mount pivot, deployed at rest; BicycleView rotates it up when mounted.
- Motion: separate hub pivots for both wheels, steering-axis handlebar, bottom-bracket crank and spindle-origin pedal assemblies. Hand sockets move with the bar; pedals move with the crank.
- Style: orange frame/tub, teal side panels, cream fictional “Sunset Grove Courier” lettering, black saddle/tires, silver spokes, front lamp and rear rack retained.
- Lower tiers: explicitly authored closed wheel silhouettes, central rim/spoke details and preserved pivots. No decimation and no spoke spikes. LOD2's handlebar connects to the frame through its stem.
- References and protected source folders untouched.

Evidence: `contact-sheet.png` (four quarter views and true side), `contact-sheet-lods.png` (three side views), `report.json` (decoded runtime measurements and validation), and `tests/unit/assets/courier-bike.test.ts` (LOD and pivot regression).

Validation: `npm run verify -- E17` passed (typecheck, lint, build, 39 selected unit/sim tests, 36 headless browser tests, two browser workers). The focused bike regression passes both tests, including stand retraction/restoration and saddle alignment; the three static-collision checks also pass against the final packed bike. The normal unit suite exposes an unrelated audio-license scan error (`Dirent.parentPath` is undefined); the final full-unit run uses the machine-wide `tools/sim-lock.sh` wrapper and `--maxWorkers=2`. `npm run assets:pack -- veh.courier-bike` and decoded validation passed for all three tiers. The generated static collider cache was refreshed for the new bike GLB.

Final locked full unit result: **228 passed, 1 failed** (229 tests / 73 files). The sole failure is the pre-existing audio-license scan `tests/unit/audio/assets.test.ts:58`, where this Node runtime exposes no `Dirent.parentPath`. Command: `/Users/fabianwesner/Workspace/suburban-survivors/tools/sim-lock.sh npm run test:unit -- --maxWorkers=2`. No asset or collision test fails.

After printing the complete test summary, Vitest retained a busy worker during shutdown. The completed runner was stopped to release the shared slot and avoid leaving CPU work on the overloaded machine.
