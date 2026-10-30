# N33-02: low-tier cure mist falls below ending coverage guard

**Classification: real VFX coverage regression; filed locally.** New failure against nightly-28 at base `165e05cd2`, native WebGPU, low tier, 960×540, seed 32: `qa-l10-title-credits@low-z0.5`. The production smoke/mist pool peaks at **7 puffs**, below the fixture minimum **10**. The criterion is retained.

The two exact reruns reproduce **7** and the same failed check, so this is deterministic: [rerun 1](../checks/title-repro1.json), [rerun 2](../checks/title-repro2.json), [full first rerun metrics](../evidence/title-repro1.json), [second](../evidence/title-repro2.json). [Original metrics](../failures/qa-l10-title-credits@low-z0.5.json), [original contact sheet](../failures/qa-l10-title-credits@low-z0.5.jpg).

This is the actual production puff-pool counter read by `SceneLab.sampleCure`, not an image segmentation assertion. At this idle ending fixture there are no combat bursts. The normal sheet shows sparse mist during the ending. E32 §5.8 / AC23 and AC26 require visible spreading mist and a legible reversal through camera pull-out/title; the current evidence does not establish that the coverage guard is obsolete. Do not lower it merely to make the run pass.

The [other five camera/tier variants](../checks/title-mist-cameras.json) pass: high z1.5/z1/z0.5 peak at 164/78/22, low z1.5/z1 at 61/29. All six retain the same minimum 10. In the failing row, the title lasts exactly 300 frames, credits appear for 121, fans move for 479, camera pull scale reaches 7, and smoke-over-budget frames remain zero. This is an ending visual coverage defect, not a campaign completion failure.

**Repair investigation:** `Blasts.cureMist` samples only eight candidate positions per update on low tier (24 high), in a disk that grows to radius 144 m during pull-out, then rejects positions outside the camera through `sourceVisible`. Camera/frustum changes can reduce useful emissions at close player zoom; investigate that coverage relation and sample density across all tiers/zooms. The exact causal change is not isolated, and raising density globally needs smoke-budget and epilogue validation. No game or threshold change is made in this lane.

Reproduce in the shared headless pool:

```sh
SCENE_PORT=3345 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgpu --tier low --only qa-l10-title-credits@low-z0.5 --out test-results/nightly-33/repro-title-mist
```
