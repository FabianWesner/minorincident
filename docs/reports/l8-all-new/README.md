# L8 all-new figure rollout

## Census and selection

The census comes from `src/sim/missions/LevelEightZoo.ts`, `src/data/zooStaff.ts`, `layouts/D-ZOO/layout.py`, and `src/assets/manifest.json`. L8 starts with 12 carried survivors, 20 local visitors, 6 guards, 4 zoo staff, and eight animals: one lion, one gorilla, one elephant, two zebras, and three flamingos. Zoo staff reuse the four civilian bases with green uniforms, caps, and work props. The breach adds ordinary infected and up to four Alpha encounters. People and animals can later become corpses; L8 does not pre-place corpses during sanctuary.

| Figure family | L8 use | v2 at census | L8 old-model work |
|---|---|---:|---|
| Civilian man/woman bases | Visitors, staff, carried group; infected turns and corpse poses | Yes | None |
| Civilian kid/elderly variants | Not in L8 initial local population | Yes | None |
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

**Current status:** six of eight rigid L8 animal IDs are built with the shared pipeline: `amb.lion`, `amb.gorilla`, `amb.elephant`, `inf.elephant`, `amb.flamingo`, and `inf.flamingo`. `inf.lion` and `inf.gorilla` still need new infected source forms; the checked-in wave2 cast has no packages for either and the available TRELLIS highs are healthy only. The builder now uses skin-declared animal bones and an explicit quadruped marker and enforces the 8,000 / 3,000 / 1,000 triangle caps. The full `node --import tsx tools/assets/validate.ts` passes with zero errors; targeted counts for the six built figures are in their build receipts. Typecheck, lint, `npm test` (104 passed; 24 files), and `build:qa` pass. `test:smoke` and `scene:gate` cannot start browser jobs here: the shared pool wrapper gets `EPERM` creating its cache under the main checkout, and a `/private/tmp` cache override then gets `EPERM` opening the daemon IPC socket. The gate consequently reports 0/48 rows run. Per-figure game-camera comparisons, 30-figure L8 crowd, scripted scenes, runtime art review, L8 real-input playthrough, perf and showcase are still pending. No inference or paid credit has been used. A commit attempt was denied because the shared `.git/worktrees` metadata is read-only to this job.
