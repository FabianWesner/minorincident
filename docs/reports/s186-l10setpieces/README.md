# s186-l10setpieces

## Change

Added six authored L10 dispersal fight beats to `curePaceEncounters`, positioned along the R6 corridor and released within 35 m of their authored station. Each beat uses the existing deterministic encounter slot and fair-admission path, preserves the existing infected definitions/stats, and participates in the existing paced-wave re-targeting. Scarecrow field has five HIGH / four LOW members; the other set pieces retain their authored high/low cohorts. Fixed district dressing uses the ordinary placement and LOD pipeline. Added six Scene Lab fixtures with one Trellis-backed infected beside the courier for capture and placement review.

The six scenes are arranged around the existing corridor groups at 2940, 3060, 3190, 3260, 3390 and 3520 m. This preserves the PO's distinct visual themes and leaves the existing corridor groups interleaved with them.

## Verification

- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `npx vitest run tests/engine/world-systems.test.ts --project default --configLoader runner`: **PASS**, 5 tests. Added assertions for the six authored scene identifiers, nonempty HIGH/LOW encounter slots and fixed dressing.
- `npm run qa:threat`: **PASS on the earlier placement**, 395.0 s, all ten skilled routes completed, **0 fail flags**. The last three scene stations were subsequently moved 60 m; the audit must be rerun on the current source. L10's earlier native skilled route completed in 1103.4 s of simulation; the delivery-corridor objective boundary ran from 705.7 s to 881.5 s.
- Required `sh tools/remote/run.sh "$PWD" -- npm test`: **NOT RUN**. Runner returned exit 69 because no healthy/provisioned Hetzner runner was available and the remote command is ineligible for local fallback.
- Supplemental local `npm test`: **FAIL**, 26 files / 105 passed and one failed in 112.0 s. The failing `tests/engine/l4-contact.test.ts` LOW perimeter-routing assertion matches the previously recorded Mac-specific failure; this does not replace the missing remote result.
- Catalog enumeration through `node --import tsx/esm tools/scenelab/catalog.ts --list --filter 's186-l10-*'`: **PASS**, all six scene fixtures load. The `tsx` executable form itself cannot open its IPC socket in this sandbox.
- Headless Scene Lab capture attempt: **BLOCKED** before browser launch. Browser-pool startup failed because its listener could not bind `127.0.0.1:4329` (`listen EPERM`). No image captures were produced.
- Retried with unrestricted socket access: HIGH WebGL2 catalog completed, **2/6 passed**. Convoy, underpass and scarecrow fixtures reported clipping; billboard rejected the retired rigid sprinter. The gate sheet was opened: it shows a tiny courier against a dark empty background, without the authored gate. These fixtures do not demonstrate production composition or the requested key moments and their sheets are not acceptance captures. Fix the fixture's production L10 composition before interpreting placement results.

## Open

This is not a completion report. The brief still requires scene captures (HIGH zoom 1 for each beat and LOW gate), visual review, a successful required remote unit suite, and final cadence evidence showing nearby fights no more than 20 seconds apart at each beat. The authored static props also do not yet deliver the requested readable quarantine/billboard copy, swaying warning effigies, collapsing billboard, bursting hospital tents, or route-specific amber dust, embers and siren. No zombies were stat-tuned and no corpses are removed.

## Commit status

The first commit attempt was blocked by sandbox access to shared Git metadata. The continuation has unrestricted access and will commit this partial work with explicit paths.
