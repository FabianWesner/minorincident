# Common worker: textured suit infected

This asset now uses the PO-approved TRELLIS.2 suit zombie, replacing the procedural worker under the existing ID. Source: `experiments/trellis-assembled-jpeg-v1/zombie-suit/raw.glb` in the pipeline repository; SHA256 `739ce9749241b8702236ec73bfc606f68b5f0e2f3c969a67bc5675eba5703906`.

Authoring is reproducible from the pipeline lane's `suit-game-delivery.md` and committed scripts (`lane/tex-infected`, `a688038`). The local `build.py` is the historical procedural sculpt, not the source of the replacement. Rebuild the authored delivery through the pipeline stages and copy its four GLBs and two shared atlases together.

Fresh xatlas UVs and full-source colour rebakes retain navy torn cloth, white shirt, red tie/blood, pale hands/face and the open mouth. One shared atlas is 1024 high / 512 low. LOD triangles: 5718 / 2202 / 900; closed permanent corpse: 1180. All six delivery files total 594148 bytes. Missing source normals are repaired before delivery; valid source normals are preserved. A 20% head enlargement and two head-owned radial eye discs keep the face readable; the discs add four triangles and reuse the body material and existing UV/flag channels.

The existing 17-joint infected hierarchy and sockets retain semantic ownership, including the complete jaw on the head and tie on the torso. The fitted body is approximately 1.78 m; shoes supply one canonical sole bound across LODs. Existing pose-atlas clips animate it. Seven small stump caps have real nonzero geometry and hidden metadata; the crowd shader reveals the relevant surviving joint cap. Frozen corpse pages retain texture UVs.

See `docs/reports/tex-infected/README.md` for current native captures, visual descriptions, performance comparisons and gate receipts.
