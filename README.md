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

- Native seed 1 after the count changes: peak concurrent infected **20** (before **30**); retreat phase births **26** (before **96**). The shorter completion route means this is directional rather than a controlled comparison; full-route births were **38**, including conversions. The historical receipt does not record full-route births, so the before/after full-route total remains unverified.
- Native early-close receipt: **35** authored spawn events, all door-tagged (shelter doors 0/1: 9; service doors 2–7: 26; tunnel ends/door 8: 0). Door close→break ticks: 2 `5719→7039`, 5 `6360→7680`, 3 `7814→9134`, 6 `8825→10145`, 4 `9804→11124`; door 7 stayed closed through the receipt with no arrival. The audit rejects any spawn during a door's closed/unbroken interval; the existing invariant also checks that all six closed leaves produce no pressure candidates and a broken leaf is the sole candidate.
- [Native trace receipt](docs/reports/s239-l6half/native-trace.json) contains every early-close spawn's door id and tick, close/break records, full-route births/peak, and the before baseline. Typecheck and lint pass; the merged two-shard all-level threat audit reports **0 acceptance flags** (L6 skilled and passive complete). The remote unit suite passed (104 passed, 1 skipped; 220.5 s); `qa:threat --proof` also stops at the unrelated existing `road-2` safe-detour assertion in L9.
