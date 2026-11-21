# s212e finale and motorbike

## Work completed

- Restored the L10 finale route, motorbike, sidecar, checkpoint migration, and QA tooling from the reverted merge.
- Fixed the resumed Mega regression. Older console saves can lack `l10-overpass-mega`; when the saved courier position is beyond the overpass, story update now records that one-shot beat as complete instead of re-staging the Mega there.
- Commits: `9f99e544` (resume fix), `3e1cfce4` (finale and motorbike restoration).

## Verification

| Check | Result |
|---|---|
| `npx vitest run tests/nightly/mission-interactions.test.ts` | Pass; unchanged test, including the console save resume case |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test:unit` | Pass; 27 files, 106 tests |
| `sh tools/remote/run.sh "$PWD" -- npm test` | Remote runner unavailable; local `npm run test:unit` passed |
| `npm run qa:threat:sharded` | Not completed; both shards exited 69 because no healthy remote runners are provisioned |
| `node --import tsx/esm tools/verify.ts E32` | Pass; per-change typecheck, lint, and 106-test gate |
| `npm run test:smoke` | Build passed; smoke stopped when browser pool startup returned `EPERM` on 127.0.0.1:4329 |

## Pacing probe

The complete-route probe is saved in [pacing.json](pacing.json). It does **not** meet the requested pacing:

| Tier | Hangar to gate | Longest fight/story gap | Skilled route |
|---|---:|---:|---|
| LOW | 310.7 s | 14.4 s | Completed in 1284.2 s |
| HIGH | 318.7 s | 25.4 s | Tick budget at 1500 s, before credits |

Both routes miss the 420–540 s hangar-to-gate target. Several beat intervals also miss 45–75 s. Further authored roadblock encounters are required; no player speed reduction was made.

## Captures

The ten-beat and motorbike-with-corgi-sidecar capture sheets remain outstanding. The headless capture script was invoked through `tools/e2e-lock.sh` with ports 5215/5216, but the browser pool could not start (`listen EPERM` on 127.0.0.1:4329). No screenshots were produced or visually reviewed.

## Remaining

The objective is not complete. Required follow-up: add route content to bring both tiers into the 7–9 minute band with the requested beat cadence, obtain and visually review the captures, provision/use healthy threat runners for both shards and merge, complete the unavailable gates, and update this report with final receipts.
