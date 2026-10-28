# L8 all-new figure rollout

## Census and selection

The census comes from `src/sim/missions/LevelEightZoo.ts`, `src/data/zooStaff.ts`, `layouts/D-ZOO/layout.py`, and `src/assets/manifest.json`. L8 starts with 12 carried survivors, 20 local visitors, 6 guards, 4 zoo staff, and eight animals: one lion, one gorilla, one elephant, two zebras, and three flamingos. Zoo staff reuse the four civilian bases with green uniforms, caps, and work props. The breach adds ordinary infected and up to four Alpha encounters. People and animals can later become corpses; L8 does not pre-place corpses during sanctuary.

| Figure family | L8 use | v2 at census | L8 old-model work |
|---|---|---:|---|
| Civilian man/woman bases | Visitors, staff, carried group; infected turns and corpse poses | Yes | None |
| Civilian elderly variant | Visitors and carried group; kid not in local pool | Yes | None |
| National guard | Six guards; infected turns and corpse poses | Yes | None |
| Common infected | Breach waves; corpse poses | Yes | None |
| Alpha variants | Breach elites; corpse poses | Yes | None |
| Zebra (`amb.zebra`, `inf.zebra`) | Two animals, healthy and infected; ground locomotion, tail, corpse | Yes | None |
| Lion (`amb.lion`, `inf.lion`) | One animal, healthy and infected; paws, tail, corpse | No | Both forms |
| Gorilla (`amb.gorilla`, `inf.gorilla`) | One animal, healthy and infected; feet, arms, corpse | No | Both forms |
| Elephant (`amb.elephant`, `inf.elephant`) | One animal, healthy and infected; feet, trunk/tail, corpse | No | Both forms |
| Flamingo (`amb.flamingo`, `inf.flamingo`) | Three animals, healthy and infected; feet, wings, corpse | No | Both forms |

Eight old rigid asset IDs are used by the highest-visibility L8 animal family, below the 12-figure cap. No inference is needed for the available animal cast sources; reuse the durable TRELLIS highs and source packages under `/Users/wesner/Workspace/minorincident_3dpipeline/cast/wave2/`. Existing source-sheet reviews are not runtime acceptance. In particular, their healthy lion/gorilla/elephant/flamingo verdicts identify visual defects that must be checked in the final game-camera review.

## Build and checks

The requested v2 production path is `tools/assets/skin-crowd-build.sh`; it must register skinned LOD0/1/2 variants and healthy/infected corpse pages with no manual asset edits. Figure sheets must show old/new at 120 px and 400 px, low/high, with legs and feet on ground, tails, and the frozen corpse pose. The L8 crowd sheet must contain 30 figures. Review every saved sheet before recording verdicts here.

Triangle and standalone file caps per figure are LOD0 8,000 / 600 kB, LOD1 3,000 / 250 kB, LOD2 1,000 / 150 kB (zoo figures). No test cases are added; the current test budget is 144/150.

**Current status:** all eight selected animal IDs are built and validated by the shared script. Infected lion and gorilla derive from the new healthy anatomy with the production infected eye/pose/corpse contract. Build sources, hashes, LOD triangle counts and both-tier file bytes are in [builds.json](builds.json); no inference or paid credit was used. Typecheck, lint, `npm test` (104 passed; 24 files), and `build:qa` pass. Commit `18b0583ec` contains the first six forms. The resumed full-access environment permits Git and the browser pool; runtime portraits are currently queued behind a live foreign pool job. Per-figure comparisons, 30-figure L8 crowd, scripted scenes, runtime art review, real-input playthrough, perf and showcase remain pending.
