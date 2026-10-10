# Instance-buffer diagnosis

The unchanged E24 shelter fixture failed the third infected-eye maximum on lane `9a99a2cb`; untouched main `4970fa9e` passed. Both shelter and tunnel cases pass after `fda25b39`. No L6 data, mission, fixture or assertion was edited.

Two headless remote Scene Lab sessions loaded the existing shelter fixture at seed 1, paused, completed the existing shelter/stop setup, spawned the same three runners, used the existing cinematic camera and stepped 30 ticks. CPU vertex arrays, indices, instance matrices, world matrices and LOD selections matched main. Basic materials still drew different placements; tint removal and disabling material sharing did not fix the failure, and those experiments were reverted.

A temporary diagnostic wrapped the backend draw, sampled only the main-camera station/camp draws, and read the actual matrix vertex buffer with WebGL2 `getBufferSubData`. It restored the ARRAY_BUFFER binding without modifying the buffer. The retained JSONs show the first two 4×4 matrices, CPU versus GPU:

- `cutaway-gpu-lane.json`: station body GPU translation `[2.4279387, -0.5877852, 7.4279385]` while the restored CPU translation is `[0, 0, 0]`. This is exactly the temporary pre-render warm-up placement.
- `cutaway-gpu-main4970.json`: station body matches; the older window buffer independently retains the warm-up translation.
- `cutaway-gpu-fixed.json`: all four sampled station/camp body/window matrix buffers match CPU data.

Three generates an interleaved instance-matrix buffer, synchronizing its version through a frame event. A cached graph can miss synchronization after warm-up restores transforms. `DynamicDrawUsage` forces the existing attribute uploader to refresh the buffer even when that generated version is stale (`three/src/renderers/common/Attributes.js`). The same matrices are rewritten by LOD repartition. This uses the existing instancing path.

`T-E25-05p` retains the identity-tint layout assertion and checks dynamic matrix usage. `cutaway-dynamic.json/.log` records both unchanged E24 pixel tests passing remotely; `cutaway-after.json/png` records shelter contrast 5.272:1 and red maxima for all three infected. The complete native gate and original performance budgets must also pass before closure. The temporary diagnostic tool and unselected captures are removed.
