# S153 · L10 farm pacing

## Result

The farm-to-restricted run now has four authored encounter identities: lone pursuers, field hordes, farmhouse defense and an Alpha ambush. The high-tier LevelTenBot cleared the farmstead in **309.1 s**, with **157 kills (30.48/min) and 0 deaths**. The native baseline was **156 kills in 310.2 s (30.17/min), 0 deaths**. The six authored solo-popout targets across the farm/shed route fell to two corn-lane targets, reducing their span from about **1.07 km** to **0.50 km**; the larger groups now give the corn and shed approaches different combat shapes.

The route evidence sheet is a native-simulation schematic, not a rendered game screenshot. It records segment times, encounters, and the low-tier walking deaths. Browser confirmation at HIGH then LOW remains open: the shared browser pool could not start inside this sandbox, and its guarded legacy path could not inspect processes.

## Native route map

Seed 1, L10 default start, fixed-step simulation. The skilled policy is the production `LevelTenBot`; the normal-walk probe uses the `walk: true` input modifier from `tools/qa/escort-walk.ts`. The skilled run uses HIGH density; normal-walk uses LOW density. Kills count `combat.kill` events. Segment boundaries are first crossings of the listed X markers.

| Segment | Skilled HIGH elapsed | Kills in segment | Skilled deaths | Normal-walk LOW elapsed | Normal deaths |
| --- | ---: | ---: | ---: | ---: | ---: |
| Crash entrance → farmhouse (x=698) | 38.3 s | 6 | 0 | 86.2 s | 0 |
| Farmhouse → corn crossing (x=936) | 59.0 s | 38 | 0 | 141.1 s | 1 |
| Corn crossing → sheds (x=1,165) | 50.9 s | 30 | 0 | 120.3 s | 1 |
| Sheds → depot/Alpha (x=1,517) | 84.5 s | 42 | 0 | Did not reach | 40 at x≈1,455 |
| Depot/Alpha → restricted-zone marker (x=1,857) | 76.4 s | 41 | 0 | Did not reach | 0 beyond x=1,517 |

The low-tier normal-walk run was observed for 900 simulated seconds. It recorded **42 deaths**, **261 kills**, and **691 m of X-axis backtracking**; it crossed x=698, 936 and 1,165, then stalled at x=1,442.1 before the restricted-zone marker. Deaths were at x≈760 (1), x≈1,051 (1), and x≈1,447–1,455 (40). This exposes a local late-shed/workshop choke for the slower policy; it does not replay the entire level on each retry. The result is diagnostic and is not used for the skilled-bot comparison.

Authored repeat count: the former four corn scare triggers plus workshop/shed pop-outs at x=1,405 and 1,685 are now two corn triggers (x targets 615 and 1,115); the seven later route ambushes from x=2,040 onward remain. The encounter sequence now interleaves two field-horde groups with a farmhouse defense, then the Alpha set piece. Field-horde slots spread over a 14–26 m ring, leaving the mown lane open and making the threats approach across the field rather than appear as another close roadside pair.

## Design choices

- Replaced the farm's repeated small close-fighting beats with a farmhouse defense (11/9 regulars, one dog, Screamer role), a corn-field horde (14/7 regulars, one dog) and a shed field crossing (17/12 regulars). Counts are HIGH/LOW. Existing encounter archetypes and stats are unchanged.
- Kept the regular Alpha at the depot as a distinct Alpha ambush. The encounter data names the four types so L10 tests can protect the set-piece census.
- Removed two corn pop-outs and the workshop/shed pop-outs at x=1,405 and 1,685. Replaced their pressure with authored group members; HIGH/LOW farm groups have 51/37 regular slots including the crash groups.
- Put a medkit on the corn-route entry at [807, 80] and moved the industrial medkit to the actual route bend at [1297, 80]. L10 campaign ammo remains bottomless, so no ammo pickup was added.
- Kept the existing L10 pace checkpoints: first after 120 m, then every 200 m, plus region checkpoints. The normal-walk retry samples remain local to the later choke.

## Verification

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- Focused `tests/engine/world-systems.test.ts` — 5/5 pass, including encounter-type/count and farm layout checks.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable; runner returned 69 because no healthy remote host was running and this command was not eligible for the Mac fallback.
- E32 verify — pass via `node --import tsx tools/verify.ts E32`: typecheck and lint passed; the full default suite passed 106 tests across 27 files in 158 s. The `npm run verify -- E32` wrapper itself hit sandbox `EPERM` on the `tsx` IPC socket, so the same verify script was invoked directly through Node's loader.
- HIGH and LOW browser scenes — not run. Pool startup returned `EPERM` binding localhost:4329; the guarded fallback repeatedly received `EPERM` inspecting `ps`. No visual pass is claimed.
- An exploratory broader `tests/qa/invariants/waves.test.ts` run exposed existing non-L10 failures (L4 low arrival and L6 hatch filler census); that file remains unchanged. The focused L10 level test passes.

## Artifact

[Route evidence sheet](route-evidence.png) — small native evidence schematic, opened for review. It is not a browser capture.

## Follow-up with unrestricted execution

Implementation and report committed as `f4ab5a34`. HIGH then LOW browser attempts now reach the pool, but both fail before rendering because SceneLab rejects production `infected.sprinter` actors as retired rigid figures. Visual confirmation remains open.

Required remote suite retry passed: 27 files, 105 tests passed and one skipped; 192.2 s within the 240 s budget, exit 0.
