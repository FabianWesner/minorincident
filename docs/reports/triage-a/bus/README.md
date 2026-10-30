# #94 low-quality EVAC livery

Cause: `evac_bus.py` emitted side text only for LOD0, while low-quality nearby vehicles use LOD1. Retain the same closed text meshes in LOD1. The builder validated all exported tiers. LOD1 is 4,966 triangles against its unchanged 6,000 cap; LOD0/LOD2 and all wrecked/burned runtime files are byte-identical (hash receipts). Runtime draw count is unchanged.

Viewed the matched `before/shot-0030.png` and `after/shot-0030.png`: side lettering was absent and now reads **EVAC** on the cream lower body. Wheels, glazing, roof and silhouette match. Both captures use headless pooled WebGL2 low, the L4 lighting preset, identical game camera/seed and zero console errors. Reproduce with `SCENE_PORT=4383 sh tools/e2e-lock.sh npx tsx tools/scenelab/cli.ts docs/reports/triage-a/bus/fixture.json --tier low --out <directory>`.

Only the L4 bus-lettering portion of #94 belongs to this lane; the L10 shelter lamp belongs to triage-b. Camera values and L5 balance are unchanged.
