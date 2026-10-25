# Capture guide

Every proof has `-webgl2.png` and `-webgpu.png` versions. The gallery uses low quality; the LOD distance series explicitly uses high quality. Wound close-ups deliberately magnify the low LOD. Numerical receipts are in [visual-verification.json](visual-verification.json).

| Proof | Captures | What is checked |
| --- | --- | --- |
| Civilian and infected bodies | [humans](humans-webgl2.png) | Native textured bodies, welded joints and fitted headwear through the production renderers. |
| All 52 civilian clips | `clips-{0,8,16,24,32,40,48}-{5,13,21}-*.png` | Three phases of each requested clip; receipt asserts the selected production clip and renderer submission. Carry, cane and watering props use the corresponding pose. |
| Arm, leg and head cuts | [arm](nurse-cap-arm-webgl2.png), [leg](nurse-cap-leg-webgl2.png), [head](nurse-cap-head-webgpu.png) | Red surfaces close every opening, including secondary loops; body edge coverage is also checked at every shipped LOD. |
| Severed frozen corpses | [arm](nurse-frozen-arm-webgpu.png), [leg](nurse-frozen-leg-webgl2.png), [head](nurse-frozen-head-webgpu.png) | Removed parts remain absent after 180 ticks; the retained cap is visible. All twelve live/frozen wound HDR readbacks must contain zero nonfinite channels. |
| Combat and flash | [before](flash-before-webgl2.png), [after](flash-after-webgl2.png), [explosive kill](explosive-severance-webgpu.png) | Flash brightens visible body pixels; the combat damage route emits all five detached parts. |
| Headwear and infection | [healthy glasses](healthy-glasses-webgl2.png), [turned body](turning-glasses-webgpu.png) | Hat and spectacle fit, retained clothing paint, desaturated skin and red eyes. The fit oracle separately checks the 12 mm spectacle clearance. |
| Shared atlas graphs | [living civilians](mixed-atlases-live-webgpu.png), [frozen civilians](mixed-atlases-frozen-webgpu.png) | Orange and red clothing remain distinct when textured civilians share their shader graph; frozen pages rebind their own atlas. [Receipts](texture-sharing.json) include finite HDR checks. |
| Quadrupeds | [animals](quadrupeds-webgpu.png) | Healthy/infected zebra and dog on the quadruped skeleton, including the paw/hoof contact probes. |
| LOD changes | [near](lod-3-webgl2.png), [middle](lod-14-webgl2.png), [far](lod-48-webgl2.png) | A weighted body is submitted at each production LOD; the receipt records the selected batch. |

`gate-attempts/wound-*-hdr-before.png` retains the rejected WebGL2 NaN captures. The final wound captures use posed face normals and are checked again by HDR readback; those rejected captures are not acceptance evidence.
