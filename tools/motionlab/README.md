# Motion regression lab

For interactive development, start Vite on the assigned port:

```sh
E2E_PORT=3352 npx vite --host 127.0.0.1 --port 3352 --strictPort --configLoader runner
```

Open `/?motionlab&renderer=webgl&count=200`; `view=close` compares survivor,
civilian and infected. `candidate=mesh2motion` displays the actual Mesh2Motion
export as prototype survivor. `candidate=skin` retains the deferred joint-weight study.
The default compares reference steering with production Stage1 motion limits,
rigid crowd crossfades and click-navigation capsule response. `paused=1` installs a deterministic stepping API:
`window.__MOTIONLAB__.step(720)`, `.metrics()`, `.resume()`, `.pause()`.
All animations stay render-only; lab scenes own and dispose their resources.

Capture serially and headlessly, using the machine-wide browser slot limiter. The
harness starts and retires its own production preview server after `npm run build` on 3352 if no server is present:

```sh
E2E_PORT=3352 sh tools/e2e-lock.sh npx tsx tools/motionlab/measure-stage1.ts
```

Metrics are written to `epics-pipeline/motion-stage1-metrics.json`. Temporary frames
are written under the assigned scratchpad/motion-lab path. Keep only the two
reviewed comparison sheets; delete intermediate frames after review.

## Rebuild the Mesh2Motion study

No browser, network service, Blender execution or project dependency installation
is needed. Prepare an external checkout and make this project's already-pinned
node_modules available to that checkout (a symlink is sufficient):

```sh
git clone https://github.com/Mesh2Motion/mesh2motion-app.git /private/tmp/motion-lib-mesh2motion
git -C /private/tmp/motion-lib-mesh2motion checkout 79f3f61a9852ef70234a5a4a7c13ed87f7a71833
ln -s /absolute/path/to/this/worktree/node_modules /private/tmp/motion-lib-mesh2motion/node_modules
MESH2MOTION_SOURCE=/private/tmp/motion-lib-mesh2motion npx tsx tools/motionlab/mesh2motion.ts
```

The adapter uses source joints as manual-fitting landmarks; it is not an
unattended anatomical joint detector. It enables upstream head/arm correction,
indexes geometry for adjacency smoothing, and strips positional root motion.
It uses only the supplied human rig and base animations (CC0); optional external
model variations and user-uploaded packs have separate licenses. See the shipped
`public/assets/motionlab/LICENSE.txt` and research report.
