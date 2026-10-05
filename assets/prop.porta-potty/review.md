# Production review

Four modeling/review rounds. Reference silhouette, three peach roof ribs, molded blue side panels, peach restroom pictograms, bronze hinges, door handle and forklift base are present and readable at the game camera. Hero is 1600×900 / 96 samples; game is 960×540 / 24 samples. Visible marking surfaces have physical offsets; no visible z-fighting was observed in the captured game views.

GLB: 10,044 triangles, 11 material draws including door groups, six palette materials, no textures, no zero-area triangles. Named root/body/door/col:body verified; hinge pivot preserved. Geometry is repeatable at micrometre precision independent of exporter ordering.

Final GLB rendered on WebGPU and WebGL2. WebGPU logged no console errors. WebGL2 logged an external Vite HMR WebSocket connection error; final clean reruns are blocked because the shared server's .vite-cache/deps directory has been deleted. The earlier round-2 model passed both backends without errors. Existing final screenshots are retained. The asset needs a clean final WebGL2 recapture after restarting the existing server; report.json records this gap.
