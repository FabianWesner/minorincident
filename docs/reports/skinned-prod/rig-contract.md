# Crowd skin rig contract

The converter keeps these humanoid joints, in order:

`root hip torso head armL armR foreArmL foreArmR handL handR legL legR shinL shinR footL footR`

The dog/zebra/lion contract adds:

`body neck jaw tail legFL legFR legBL legBR pawFL pawFR pawBL pawBR`

Only present source joints are retained; a lion rig may omit paw aliases. The complete contract is 28 deforming joints, below the shader's 32-joint packing limit. The runtime bake can append its existing nondeforming presentation parts.

Front chains use `legFL/FR → foreArmL/R → pawFL/FR`; hind chains use `legBL/BR → shinL/R → pawBL/BR`. The five gore groups include both humanoid aliases and the corresponding animal chain; the animal head group includes `head`, `neck`, and `jaw`.

[Healthy zebra](builds/amb.zebra/lod0.json), [infected zebra](builds/inf.zebra/lod0.json), and [dog](builds/inf.dog/lod0.json) receipts record the actual joint lists. Both zebras and the dog are captured in the [quadruped gallery](quadrupeds-webgpu.png). The weighted pose, paw/hoof probe, picking and wound-boundary regressions exercise the animal path.
