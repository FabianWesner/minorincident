# Fire death review

HIGH WebGL2, zoom 1.5, six frames over two seconds: [contact sheet](ash-high.jpg). LOW used the same scene and ended at frame 125; [metrics](low-metrics.json). Both runs reported zero console errors and no clipping flags.

Visual review: the initial capture showed the full-colour corpse still drawn over the heap. Routing fire deaths away from the civilian renderer removed that duplicate. The remaining heap reads as a dark rectangular slab with pale bars rather than ash and bones, and the crumble is not convincing at this zoom. **Visual acceptance fails**; improve the heap and repeat both captures before sign-off. LOW shows the same slab. Scene setup is [scene.json](scene.json); it invokes the real fire damage path on an infected fixture.

Second capture: the heap is now rounded rather than rectangular, and the duplicate body remains absent. HIGH and LOW still show a smooth dark oval with barely visible bones at zoom 1.5; the crumble is not clearly readable. Visual acceptance remains open. Both reruns report zero console errors.
