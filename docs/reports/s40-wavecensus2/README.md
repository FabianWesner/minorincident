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
