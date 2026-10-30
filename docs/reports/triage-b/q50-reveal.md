# Q-50 · Open · Reveal exposes hollow prop interiors

The requested L6→credits visual review found black angular wedges at the L10 dispersal console. This is a current reproduction of the existing reveal/interior problem, not a separate confirmed GPU corruption bug. It reproduces on closing main `be9698905` and this lane; green smoke/gates do not close it.

## Matched control, actually viewed

- [Reveal enabled](captures/epilogue-reveal/raw-after-60-raf.png): the console appears sliced into black wedges after resuming the saved epilogue and rendering normally for 60 RAFs.
- [Reveal disabled](captures/epilogue-reveal/no-reveal.png): the console is complete. Same save, camera and geometry; only the existing debug `seeThroughOff` setting changes. Nearby corpse reveal also changes because this is a global diagnostic switch. It is not a proposed shipped workaround.
- [Receipt](captures/epilogue-reveal/receipt.json), [same defect on main](captures/epilogue-main-low/raw-after-60-raf.png), [main receipt](captures/epilogue-main-low/receipt.json). Also reproduced on [WebGL2 low](captures/epilogue-gl-low/raw-after-60-raf.png) and [WebGPU high](captures/epilogue-gpu-high/raw-after-60-raf.png).
- Hiding VFX or corpse materials did not remove the console wedges. CPU mesh bounds/indices and placement matrices were valid. A constant-white material experiment preserved the source shader's discard operations, so it did **not** rule out reveal clipping. An index-format experiment failed and was reverted; no production renderer experiment remains.

## Root and proposed fix

`src/render/SeeThrough.ts:seeThroughKeep` cuts eligible prop fragments inside the subject disc and retains the low support surface. The console is a closed exterior shell, without an authored exposed interior/cut cap; revealing the subject exposes back-facing/absent inner surfaces and leaves angular dark remnants. Disabling the cut restores the shell, establishing reveal as the necessary cause in this reproduction. The precise interaction of courier/corgi coverage and each remaining dark surface needs a focused art/material review.

Proposed: add restrained interior/back surfaces or a deliberate cut-cap treatment to eligible props/buildings, and review the console plus L3/L5 roofs and L6 arches on both tiers/backends. Preserve courier/corgi visibility, corpse persistence, support surfaces and all camera framing. A console-only exemption could hide the corgi and would not close the original multi-level item; the complete safe change exceeds one hour.

## Replay

[Exact saved campaign](checks/n1/resume.json.gz), [helper](../../../tools/qa/triage-b-epilogue.ts). Through the shared headless pool:

```sh
SCENE_PORT=33969 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/triage-b-epilogue.ts review
```

Set `TRIAGE_BACKEND=webgl2` or `TRIAGE_TIER=high` for the other controls. The helper records the server working tree revision; its artifact paths resolve relative to the helper. Captured diagnostic settings are reset before the remaining controls. No game save or production behavior is modified.
