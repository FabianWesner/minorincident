# Generic dog (amb.dog) and infected dog (inf.dog)

A medium shepherd/lab mix (not the corgi, not the shipped retriever/K9 hero dogs), built like the zoo animals: closed anatomical sweeps and ovals, no decimation, each tier authored from the same parameters (`build.py`, zebra pattern). `assets/inf.dog/build.py` calls the same builder with infection enabled.

Rig: the zoo-animal contract (`armL/foreArmL/handL` + `legFL/pawFL` aliases for the forelegs, `legL/shinL/footL` + `legBL/pawBL` for the hind legs, `body/neck/jaw/tail`, `front`, `packSocket`, hidden `stump_*` caps, root flag `ss_preserveAnimalJoints`), so QuadrupedAnimator/PawContacts and the crowd clip atlas apply unchanged. Authored clips in the GLB (NLA, 60 fps): `dog-gallop` (rotary gallop cycle, 24 frames) and `dog-lunge-bite` (gather, spring with open jaw, snap, recover, 60 frames). Idle and run come from the shared atlas (`corgi-idle` / `corgi-trot` mapping for animal rigs); wiring the two named clips into `infectedClips` / the dog state machine is runtime work for the systems lane.

Coats are palette variants (manifest `decayVariants`: `black`, `cream`; files `model.<variant>[.lodN].glb`): base shepherd (`woodWarm`, `leather` saddle, `canvasTan`), black-and-tan (`navy`, `uiDark`, `khaki`), cream lab (`canvasTan`, `khakiLight`, `picketWhite`). Healthy dog: 4 materials. Infected dog: lower stance (heights x0.86, head carried low and forward), patchy fur (`infectedSkin` islands and bare belly), exposed bone ribs, bared fangs, torn ears, drooped bare tail, red emissive eyes, blood wounds; 6 materials.

Budgets: amb.dog 4,000 / 1,500 / 700 triangles (built 3,444 / 1,326 / 674), inf.dog 5,000 / 2,000 / 1,000 (built 4,308 / 1,726 / 926), 500 KB LOD0.

Rebuild everything (6 assets x 3 tiers, then pack):

```sh
sh assets/amb.dog/build-all.sh
npm run assets:pack -- amb.dog && npm run assets:pack -- inf.dog
```

QA: `specs/scenes/catalog/inf-dog-lineup.json` (`npm run scene:catalog -- --matrix --filter 'inf-dog-lineup'`), `npx tsx tools/scenelab/lod-objectives.ts <out> amb.dog inf.dog`, unit tests in `tests/unit/assets/mega-alpha-dog.test.ts`.
