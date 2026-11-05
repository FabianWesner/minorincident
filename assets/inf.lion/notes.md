# inf.lion modeling notes

Source: reference-upscaled.png, original reference.png, and infected-animals sheet.
The lion retains the reference's quadruped prowling stance, tawny body, enormous chestnut mane, cream muzzle, open snarl, ivory fangs, red eyes, dark claws, curved tufted tail and pink/purple wounds. No clothes or accessories are present in the source.

The lion is approximately 1.7 m to the mane crest and 2.8 m nose-to-tail. The actual skull is about one-third of standing height; the mane is deliberately much larger. Front legs are broad and forward, rear legs have bent feline hocks. All smoothing is applied before export, as explicitly requested for this asset.

The quadruped and infected contracts coexist in one hierarchy. armL/R -> legFL/FR -> foreArmL/R -> handL/R -> pawFL/FR drive the forelegs; legL/R -> legBL/BR -> shinL/R -> footL/R -> pawBL/BR drive the hind legs. No redundant geometry is added for aliases. The stump meshes belong to the retained parent, hidden by zero scale and tagged with their severed joint names. Palette names use existing tokens with art-directed lion shades; no image textures.

Only static surfaces belonging to a single joint are merged, using material slots. Procedural face details, claws, mane and wounds remain geometry. Wound islands are ray-projected onto the corresponding body surface with at least 4 mm clearance.

Final exported counts: LOD0 23,344 triangles; LOD1 3,382; LOD2 1,068. Each GLB has 28 multi-material mesh containers. The main model expands to 62 Three.js mesh primitives, including hidden caps; the report uses this runtime mesh count.

Rebuild LOD1/LOD2 through the same approved runner, adding --lod 1/--lod 2 and --glb assets/inf.lion/model.lod1.glb or model.lod2.glb. Review-all generates front/side/back/review-hero at 960×540, 24 samples. --view turnaround assembles those panels without rebuilding geometry. --pose --view pose-all renders joint motion and stump exposure; --view pose-sheet assembles the two-panel proof.
