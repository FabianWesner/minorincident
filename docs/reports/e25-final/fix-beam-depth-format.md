# Beam-depth copy on native WebGPU

A headless native WebGPU probe exposed a real validation failure: the gameplay depth target uses `depth24plus-stencil8`, while the default viewport-depth helper allocates `depth24plus`. The copied depth texture now explicitly uses `DepthStencilFormat` and `UnsignedInt248Type`. PracticalEffects owns one texture, reuses it across viewport references and disposes it with its geometry.

The rejected probe recorded 146 format validation errors and missing cones. The repaired native WebGPU capture records **zero errors**, pool luminance **0.414816** (WebGL2: **0.414822**), and shadow darkness/hue within the unchanged AC06 limits at both zooms. [Fresh native proof](evidence/webgpu-depth-repair.json). This is a manual headless native-backend probe, not an automated WebGPU CI guarantee.
