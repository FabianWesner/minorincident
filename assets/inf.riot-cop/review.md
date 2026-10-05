# Riot cop final review

Five visual passes, final comparison against both riot-cop references and the accepted common-worker proportions. Identity retained: dark helmet with raised visor, glowing red eyes, exposed snarling face, bloodied pale sleeves, layered armour, utility pouches, left POLICE shield, right bloodied baton. Larger head follows the explicitly requested accepted infected proportions. Relaxed shallow crouch and restrained forward lean; 1.577 m height, soles on z = 0.

Final geometry: 39,518 triangles including hidden caps, 72 material/rigid-parent meshes, nine palette/emissive materials, no textures. Subdivision and bevels are applied. Explicit primitive and font resolutions replace collapse decimation. Two repeat exports match triangle geometry to 0.12 micrometres (float32 rounding); see rebuild-check.json. All required infected nodes, both weapon sockets and backpack socket are present; caps remain on proximal parts. Rest joints have unit scale and zero rotation.

Hero: 1600×900, 96 Cycles samples. Review cameras: front/side/back/3-4 at 960×540, 24 samples; assembled turnaround is 1680×540. Pose test rotates armL, foreArmL and legR, offsets the articulated detached left-arm branch, and exposes stump_armL. The left-arm shield follows the hierarchy. Render reviewed with the exposed shoulder visible.

Final Three.js captures pass WebGPU and WebGL2 with no console errors/warnings or failed requests. The shared root node_modules was removed during the job: capture used the existing worktree Playwright installation and served an inert /@vite/client module in the browser session because the dev HMR file returned 404. Renderer, viewer, shaders and GLB were unchanged. The temporary capture fixture has been removed. Once root dependencies are restored, use the standard experiment/tools/capture_glb.mjs command.

Repository checks completed before the shared dependency removal: npm run typecheck, npm run lint, npm run test:unit -- --maxWorkers=4 (25 tests passed). This standalone asset task does not modify an epic or registry. No specs, references, preview tools or other asset folders were edited.

Final verdict: passed the requested asset review; no remaining artifact gaps.
