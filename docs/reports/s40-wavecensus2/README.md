# s40-wavecensus2

## Change

- L7 census groups now aggregate the actual `group()` calls made by the encounter controller, including opening pack 705 and high-tier satellite packs 712–714. The expected total is captured at the source call boundary, so the test does not duplicate tier quotas. Every measured actor must still be present in the controller's arrival ledger and inside its cohort goal area.
- L8 census now records the route-gated initial east outlet as zero while closed, seals the fixture, and moves the courier through south, north, east, and plaza regions. It advances each region's actual timer and first-entry gate, observes all released IDs, and requires each member to reach that outlet's goal. Outlet 1 is explicitly required to appear after the east region opens.
- The fixture disables the unrelated plaza hold bursts and camping wave while measuring region releases. The production regional/timer admission paths remain active.

## Verification

- `npm run typecheck` — passed.
- `git diff --check` — passed.
- Required nightly command was attempted twice: `sh tools/remote/run.sh "$PWD" -- npx vitest run --project nightly tests/qa/invariants/waves.test.ts` — not executed; runner pool has no healthy Hetzner worker and the Mac fallback refuses nightly-project commands.
- `sh tools/remote/scale.sh add` — failed before provisioning because DNS resolution for the remote API hostname failed.
- Required `sh tools/ops/slim-worktree.sh "$PWD" --no-assets` was attempted first; it could not lock the shared worktree config under the parent repository's `.git` (`Operation not permitted`).

The nightly census is therefore not verified green. No gameplay, AI, stat, or authored content files were changed. No claim is made about a genuinely missing authored cohort: the prior s39 remote run observed each of the measured L7 cohorts, and this turn could not rerun the suite after changing the test.

## Restored remote access

The exact remote command executed on 94.130.181.173, job `/srv/mi/jobs/s40-wavecensus2-b8a73c-11766-1794398818`, and failed 2 census tests while both L4 tests passed. It exposed fixture errors: opening quota observation occurred after population; thresholds for high packs 713/714 were not crossed; split-pack goal areas still used the parent centre; north incorrectly counted the already-spawned K9 twice; and the explicit east assertion had its membership predicate reversed. Observer timing, thresholds, north quota, and east predicate have been corrected. Split-pack goal-area assertions and a new remote run remain required. This supersedes the earlier runner availability blocker.

## Final verification

The exact required remote command passed **4/4 tests** on 94.130.181.173, job `/srv/mi/jobs/s40-wavecensus2-b8a73c-29235-1794398935` (exit 0, Vitest duration 49.06 s). Both tier censuses and both L4 alarm tests passed. `npm run typecheck`, targeted ESLint, and `git diff --check` also passed.

| L7 cohort | High authored / admitted / reached | Low authored / admitted / reached |
| --- | --- | --- |
| 700 | 122 / 122 / 122 | 62 / 62 / 62 |
| 701 + 705 | 71 / 71 / 71 | 36 / 36 / 36 |
| 702 (+ 712 high) | 71 / 71 / 71 | 36 / 36 / 36 |
| 703 (+ 713 high) | 70 / 70 / 70 | 35 / 35 / 35 |
| 704 (+ 714 high) | 71 / 71 / 71 | 36 / 36 / 36 |

The quota observer now starts before world population. Split-pack positions are captured from the controller's source-authored clear placements; each arrival must remain within the existing 20 m tolerance of its own pack's authored road ranks. Parent-cohort and final Alpha checks retain their prior tolerances. The driver crosses the extra thresholds needed for packs 713 and 714.

L8 initial outlets 0–5 admitted/reached 6,0,7,6,5,5 high and 3,0,4,3,3,3 low. South, north, and east regional outlets each admitted/reached 5 high or 3 low; plaza outlets 4 and 5 each admitted/reached one sustaining member. The initial K9 is counted once. The east assertion explicitly requires a new outlet-1 identity absent from the initial closed-gate cohort. No authored cohort in this scope failed to spawn, and every measured admitted identity reached its goal area. Only test tooling and this report changed; no default-project test cases were added.
