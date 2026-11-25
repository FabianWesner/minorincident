# Minor Incident

Minor Incident is a browser based isometric zombie action RPG built with TypeScript, Vite, three.js, and Rapier.

## Get started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development server uses port 3300.

## Build and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke
npm run scene:gate
npm run qa:threat
```

Acceptance reports are generated with `npm run qa:accept -- --level all`. See [the specs index](specs/README.md) for project requirements, [the acceptance guide](docs/reports/fix51-verify/README.md) for evidence and review status, and [acceptance review freshness](docs/reports/fix51-r9i/README.md) for review source digests.

## L6 PO changes (2026-11-25)

- Halved authored breach cohorts: first breach 8 → 4 and second breach 10 → 5. The shelter breach remains a real, attacking wave; the five second-breach arrivals are spaced 1.5 s apart within the authored 10 s stream window, leaving the cohort time to engage.
- Halved authored recurring pressure: group size 4 → 2; the 14-second interval is unchanged. The alternating ahead/behind admission distance is 18 m → 8 m from the walking tail. High director cap is 66 → 33; low tier keeps its existing ×2 scaling, so its effective cap is 132 → 66.
- Halved each of the six maintenance/side-door arrivals from 2 → 1 and removed the old one-member duplicate arrival on breaking an already-served hatch. Recurring pressure can use the reopened door. Zombie stats, speed, damage, and AI are unchanged.
- Removed pressure sources at the west/east tunnel ends and restricted fallback candidates to the six closable service doors. Only the story shelter breach may use its shelter entrances. Closed hatches are excluded until their eight-hit bash breaks them; with every hatch closed, the pressure selector has no source.
- Kept infected nav walls along both track edges, with apertures only at the six authored service doors; a closed hatch installs a collision and nav blocker, and its eight-bash break removes it. Removed west/east tunnel ends from the spawn source/candidate lists. Native receipts record each authored spawn's door id and each hatch's close/break ticks; the audit flags non-service spawns and any arrival through a closed hatch. Player and follower routes retain their side-walkway crossings.
- Updated [L6 acceptance rows](docs/qa/level-acceptance.md) to the authored cohort sizes and closed-corridor rule. These changes follow PO findings that L6 was too hard and that end entries made closing doors ineffective; threat, reachability, and attack checks remain enabled.

- Added the 2026-11-25 PO finding that the L6 tunnel must be a closed corridor: no endpoint or other unclosable admission source, infected respect the track-edge walls, and a closed service hatch physically blocks passage until its authored break. The route audit checks door ids and close/break intervals for both the normal and early-close routes.

- Native seed 1 after the count changes: peak concurrent infected **20** (before **30**); retreat phase births **26** (before **96**). The shorter completion route means this is directional rather than a controlled comparison; full-route births were **38**, including conversions. A reconstructed base-revision native seed 1 route with the same birth and peak counters recorded full-route births **79 → 38** and peak concurrent infected **41 → 20**; route duration was 203.85 → 192.48 seconds. The archived baseline lacked Git metadata, so the audit wrapper failed its provenance step after writing the completed L6 receipt.
- Native early-close receipt: **35** authored spawn events, all door-tagged (shelter doors 0/1: 9; service doors 2–7: 26; tunnel ends/door 8: 0). Door close→break ticks: 2 `5719→7039`, 5 `6360→7680`, 3 `7814→9134`, 6 `8825→10145`, 4 `9804→11124`; door 7 stayed closed through the receipt with no arrival. The audit rejects any spawn during a door's closed/unbroken interval. A native pressure probe initialized all six hatches closed: no arrivals occurred before door 2 broke at tick 1320 after eight bashes, then two entered through door 2 at tick 1681. The probe initialized hatch states directly; the early-close route exercises player closure.
- [Native trace receipt](docs/reports/s239-l6half/native-trace.json) contains every early-close spawn's door id and tick, close/break records, full-route births/peak, and the before baseline. Typecheck and lint pass; the merged two-shard all-level threat audit reports **0 acceptance flags** (L6 skilled and passive complete). The audit aggregates passive acceptance flags and selected skilled criteria; the L8 skilled receipt separately contains 12 diagnostic flags (one reachability, ten follower pace, one delayed wave attack), so the zero acceptance verdict does not mean every diagnostic flag is zero. A native base-revision L8 route reproduced the identical 12 skilled diagnostics and zero passive flags; the archive wrapper failed its Git provenance step after writing the L8 receipt. The base audit uses the same aggregation. The remote unit suite passed (104 passed, 1 skipped; 220.5 s); `qa:threat --proof` also stops at the unrelated existing `road-2` safe-detour assertion in L9.

- The separate remote wave invariant failed on the L6 hatch probe because its sample was 0.55 m from the wall center, outside the 0.53 m collision margin. The sample was moved to 0.50 m and passes on the local rerun. The census then fails on both tiers: it expects 27 filler admissions with six reserved hatch slots, but the controller admits 33 because it reserves only announced nearby hatches. Later L6 entry assertions remain unverified. That invariant also reported an L4 low-tier alarm arrival shortfall (35/36).

- The skilled seed 1 retreat receipt records 1.50 attacks/min against the player and 3.99/min against followers over 120.27 s, below the retained L6-07 acceptance row’s 11/min and 5/min floors. The threat gate does not currently enforce those two floors; additional seeds and tier coverage have not been verified. The announced-nearby hatch reservation rule was already present in the base revision.
