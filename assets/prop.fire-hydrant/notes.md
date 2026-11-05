# Red fire hydrant

Reference: reference-upscaled.png. Fixed cast street fixture, 1.082 m tall, 0.57 m base diameter (0.643 m overall outlet bounds). Front is +X; Blender Z up; base contacts z=0.

Part list: sixteen-sided flared foot, barrel, bonnet flange, faceted dome, recessed octagonal operating socket, two layered hose caps with dark hex spindles, four base casting ribs and foot lugs, four bonnet lugs. No lettering or real brands appear in the reference.

Two static meshes joined by material under root. No animatable parts, lights or movable physics. Surface details are volumetric and embedded or offset by more than 3 mm. Palette-only Principled materials; no textures. Reference paint mottling is intentionally represented by clean cast facets rather than image textures.

Validation: three modeling passes (initial shape; bevel budget and full framing; finish and script simplification). Export measured directly: 7,064 triangles, two primitives/materials, nodes root/body/hardware. Three.js study and game views succeed on WebGPU and WebGL2 with no warnings or errors. Adjacent game azimuths 44/45/46 degrees show stable volumetric details without visible z-fighting.
