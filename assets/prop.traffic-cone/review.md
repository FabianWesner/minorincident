# Production review — round 3

Reference silhouette and proportions retained: twelve-sided closed cone, one broad ivory band, raised molded foot, thick orange square base. No branding, decals, textures or extra features. Hero is 1600 × 900 at 96 samples; game render is 960 × 540 at 24 samples.

Final GLB audited: 8,352 triangles; two meshes and two material primitives. Ground contact z=0, dimensions 0.48 × 0.48 × 0.646 metres. root/body/reflectiveBand and col:base/col:cone preserved. Light-class physics extras and baked AO vertex colors preserved. No animatable parts apply. No exported cameras/lights/textures.

Final WebGPU and WebGL2 study/rear/game captures load without console errors or warnings. Game silhouette and single stripe read clearly; raised sleeve has clean edges in both backends, with no visible z-fighting in the captured views. Sleeve surface is ≥4 mm proud, so it does not share faces with the cone.

Integration gap: the specified palette has no orange. pal_schoolBusYellow contains scalar reference orange #ff6614; preserve the variant when swapping palette materials, or introduce an approved cone-orange token. The provided GLB displays orange correctly.
