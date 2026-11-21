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
| `sh tools/remote/run.sh "$PWD" -- npm test` | Two unchanged attempts on current code timed out at 240 s. Both showed a save-progression case failing before timeout, without an assertion summary. |
| `npm test` on current code | 105/106 passed; `tests/tools/test-budget-tools.test.ts` failed its process-group cleanup assertion. The earlier local pass predates the checkpoint fix. |
| Full threat audit, two local shards and merge | Pass: 0 fail flags; all skilled routes complete. Shards ran in 174.4 s and 251.8 s; merged receipt `test-results/qa-threat/README.md`. Remote runners were unavailable. |
| `node --import tsx/esm tools/verify.ts E32` | Pass; per-change typecheck, lint, and 106-test gate |
| `E2E_PORT=5215 SCENE_PORT=5216 npm run test:smoke` | Pass: six smoke tests and one public-build smoke test; 139.8 s |

## Pacing probe

The complete-route probe is saved in [pacing.json](pacing.json). It does **not** meet the requested pacing:

| Tier | Hangar to gate | Longest fight/story gap | Skilled route |
|---|---:|---:|---|
| LOW | 310.7 s | 14.4 s | Completed in 1284.2 s |
| HIGH | 318.7 s | 25.4 s | Tick budget at 1500 s, before credits |

Both routes miss the 420–540 s hangar-to-gate target. Several beat intervals also miss 45–75 s. Further authored roadblock encounters are required; no player speed reduction was made.

## Captures

The headless capture script subsequently ran through `tools/e2e-lock.sh` on ports 5215/5216. Its ten-frame inspection sheet was reviewed and is inadequate: frames 0 and 1 are nearly black, 2 shows a gate and figures, 3–5 show dark road and vehicles, 6 shows a figure on a road, 7 is obscured by the overpass, 8 shows dark roadside structures, and 9 is nearly black. Debug panels and an unrelated early objective cover every frame. These are static inspection views, not evidence of the actual beats; the Mega and ridden motorbike with corgi are absent. Native gameplay captures and a proper sheet remain outstanding.

## Remaining

The objective is not complete. Required follow-up: add route content to bring both tiers into the 7–9 minute band with the requested beat cadence, obtain and visually review the captures, investigate the unit failures and rerun full gates on the current commit, and update this report with final receipts. The earlier threat and smoke receipts predate commit `d3cb05aa`.
