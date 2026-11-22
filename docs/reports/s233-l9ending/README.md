# s233 — L9 scripted ending

## Change

Removed the player crawl phase and input objective from the L9 crash. After the APC lands, the courier stays prone and invulnerable through a two second dazed hold, then uses the existing prone get-up clip. The Mega emerges from the burning wreck, faces and roars at the courier without attacking, then leaps east toward the city and is hidden after it leaves the frame. Sam's line says it survived and is heading for the city; the existing end caption follows. The result transition fires when the leap ends. Legacy crawl save data migrates to a safe dazed checkpoint.

Updated retired crawl references in the L9 QA probes and corrected E31 acceptance wording in `specs/epic-31-level-9-the-crossing.md` and `specs/91-test-plan.md` to reflect the Nov 22 PO decision.

## Validation

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- Focused default tests — 2 files, 8 tests passed.
- `tests/nightly/mission-interactions.test.ts` — 1 test passed.
- Full `tools/qa/threat-audit.ts` — 353 s, zero fail flags; L9 skilled and passive complete.
- `npm run build:qa` — pass.
- `npm run verify -- E31` — blocked by the sandbox denying tsx's Unix socket (`listen EPERM`). Running `node --import tsx/esm tools/verify.ts E31` instead completed typecheck and lint, then failed the repository-wide test-budget preflight: 151/150 cases across 45 files. No test cases were added or removed for this change.
- `sh tools/remote/run.sh "$PWD" -- npm test` — reached a healthy remote runner, then failed the same 151/150 preflight before running tests.
- `npm run qa:threat -- --levels L9` — preflight rejected the same 151/150 global test-case budget. The direct full all-level audit above completed with zero fail flags.

## Visual review and open gates

High then low zoom-1 WebGL frames were captured through `tools/e2e-lock.sh` with no page errors. Review exposed a phase-timer bug that moved the wreck back across the bridge during the ending. The crash motion is now limited to approach, fall and impact; fresh high and low roar frames show the burning wreck, Mega, courier and corgi together. The dazed and rise frames show the courier beside the wreck. The sampled leap frame already has the Mega offscreen, and the sampled result frame still shows gameplay: capture earlier in the leap and wait for the actual result screen to verify both beats. A complete reviewed sheet is still needed.

The nightly vehicle-scenes invariant failed before L9 at `L10/start-100` because its vehicle hull fixture was unavailable. Typecheck, lint and the QA build passed after the phase-timer fix.

The result capture showed mission phase `progression`: `Mission.result()` automatically continued L9. Removed that exception so L9 remains on the result screen, and changed the leap capture to ten ticks after takeoff. Typecheck, lint, QA build and nightly mission interactions pass after this change. A fresh high capture was admitted but its browser closed during the route (exit 143); the revised leap and result frames remain unverified and must be recaptured on both tiers.

Remaining to close the goal: resolve the framing defect, complete visual review/contact sheet, and pass the remote unit suite and test-budget gate without trimming tests.
