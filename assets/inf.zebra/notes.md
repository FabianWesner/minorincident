Source: TRELLIS.2 game-space zebra, SHA256 `867bdd5fa6f953f28c6a10545cba6f1fdd4b77d546c7740b6e40eabdc64f2cc2`. No inference. The optional 5.5 MB clean source was absent, so the supplied source was used.

The pipeline lane `lane/tex-zebra` supplies `scripts/build_zebra_rigid.py`; `provenance.json` pins input and production rig hashes. Fresh xatlas UVs and a source base-colour rebake precede the production-rig fit. Named pivots, sockets, hidden stump caps and embedded actions are retained. Healthy/infected geometry is identical; the infected atlas is desaturated, with red emissive eyes.

Pack all high/low siblings: `npx tsx tools/assets/pack-zebra-textures.ts`. The existing zebra IDs load these exports directly. Runtime textures remain registry-owned through live and frozen corpse use. Review and measured acceptance: `docs/reports/tex-zebra/README.md`.
