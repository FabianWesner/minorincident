# Courier visual and contract review

Verdict: **PASS for this standalone hero outfit asset**. Reviewed by Codex, 2026-10-06. Runtime integration and manual WebGPU checking remain with the integrator.

Compared reference.png, the built-in imagegen reference-upscaled.png, final Eevee hero/turnaround/game/pose renders, and the compressed GLBs in headless WebGL2. LOD0 uses the existing survivor anatomy, face, rig and sockets as specifically requested; it does not remodel those to the new concept illustration.

## Character checklist B

- PASS — courier identity reads from front, side, back and three-quarter: white medical-cross cap, orange visor/top, white chest/back chevrons, teal wristbands, diagonal strap and messenger bag.
- PASS — rolled denim shorts and the original brown ponytail exiting the aligned back cap opening. White socks/sneakers carry orange accents. The female underlayer neckline is dark teal; male collar is white.
- PASS — source survivor anatomy and all joint origins are retained exactly. Female preserves the Opus proportions. The new cap changes total dressed height to 1.455 m; body proportions stay unchanged.
- PASS — scalp is covered from the high camera and rear. Female has a solid rear/nape volume beneath the cap; the ponytail remains the source silhouette. Cap, scalp/hair, ears, eye whites/irises/pupils/glints, brows, nose and mouth stay under head.
- PASS — LOD0 eyes, brows and mouth remain visible in the close review and face the correct +X direction. At game scale the cap/top/bag blocks are the main identity cues.

## Turntable checklist C

- PASS — recognizable at the roughly one-fifth-height game-camera scale in renders/game.png. Final close review is renders/hero.png; four views are in renders/turnaround.png.
- PASS — shirt/shorts, cap/visor/cross, socks/shoes, messenger flap and strap follow the concept part layout. The source face and female ponytail are intentionally retained.
- PASS — canonical palette materials separate skin, hair, fabric, rubber-like shoe soles and small metal clasps. No textures or real-world brands.
- PASS — solid closed surfaces with backface culling enabled. Hair/cap no longer intersect at the visor; decals/chevrons/cross stand proud of their substrate.
- PASS — rigid pose test rotates armL, foreArmL, legR and head. Head decorations follow head; bag follows backpackSocket; weaponSocketL/R remain hand children.
- PASS — lower tiers use closed authored silhouette proxies. An initial shell collapse was discarded after browser images exposed tearing. The final proxies preserve cap/top/bag colors, complete limbs and named nodes without holes; LOD1 has more face/hair/hand detail than LOD2.

## Delivery and validation

| Tier | Triangles | Relative to LOD0 | File size |
| --- | ---: | ---: | ---: |
| lod0 | 35,112 | 100.00% | 186.5 KB |
| lod1 | 4,834 | 13.77% | 45.0 KB |
| lod2 | 1,238 | 3.53% | 27.8 KB |

All three files are quantized and meshopt-compressed. Project validation reports zero errors for dimensions, finite/nondegenerate geometry, palette names, single-sided materials, forward axis, named nodes and budgets. All original joint/socket translations and parent relationships survive packing. Second builds reproduce canonical geometry hashes for LOD0, LOD1 and LOD2 (validation.json).

Headless WebGL2 loaded every tier with zero console/page errors, no double-sided materials and every required node present (browser-validation.json). The source and raw-export dimensions are in report.json; the integrator can apply the existing survivor sourceScale for runtime height. The manifest was not edited and no commit was made by this lane.

## Checks and limitations

Typecheck and lint passed. The serial unit run passed 185 tests and failed only the tracked prop.package-courier registration check, which is outside this asset lane. E17 verification passed its 36 scoped unit/sim tests and 35 browser tests; its remaining L1 art-integration failure was a test spawn rejected inside a collider/outside the grid. These failures are recorded in the local logs and were surfaced to the orchestrator.

WebGPU is explicitly manual in the repository guidance and was not automated. The low tiers deliberately omit tiny glints, stitching, lace detail and the precise source hairstyle surface while retaining the outfit silhouette. The hero face/rig remain the source survivor's, including the male cheek bandage. No specification changes were needed.

Only final hero, turnaround, game and pose-test renders are retained; intermediate renders and raw/rebuild GLBs are removed after inspection.
