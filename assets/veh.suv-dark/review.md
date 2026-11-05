# Visual review

- Round 1: reviewed WebGPU/WebGL2 study and game captures. Main boxy SUV
  proportions, slate paint, orange rack and square lights read clearly.
  Found vertical recovery-rope rings and wipers hidden by the hood.
  First geometry pass exceeded budget; smaller bevel segments brought it to 70,444 triangles.
- Round 2: rope coil laid flat, wipers raised above the cowl, window frames reduced.
  Palette-named glazing and explicit triangulation before LOD decimation added.

The shared preview injected an unavailable /@vite/client HMR module (HTTP 404).
capture-loader.mjs resolves cached Playwright; its review browser disables HMR and
supplies a blank favicon. Asset/module/resource errors remain visible.

- Round 3: fixed the render floor at ground level; full Blender ref view reviewed.
  Main GLB WebGPU/WebGL2 study/rear/game captures pass without console errors.
  No coplanar shimmer or decal flicker is visible in the game captures.
- Round 4: low-detail visual check rejected collapse-based LOD2 (damaged geometry).
  Replaced LODs with reduced procedural geometry using the same dimensions/pivots.
  At distance omit tread/lug geometry, simplify wheel rings and flat-shade panels.
  LOD0 construction remains unchanged.

Final LOD0/1/2 captures on WebGPU and WebGL2: zero console errors.
Procedural LOD2 reviewed cleanly at game scale; no collapsed/spiking parts.
Hero delivery: 1600×900 at 96 samples. Game delivery: 960×540 at 24 samples.
Build simplified to one shared part builder with level-dependent detail; removed
collapse-copy logic, neutral AO initialization and incompatible compositor code.

Corrected final game image reviewed: full roof basket and all wheel contacts
fit inside the frame with margin. All required delivery files are present.
