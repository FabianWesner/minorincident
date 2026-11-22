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
- `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable: no healthy remote runner was provisioned, and the local Mac fallback is disallowed by that command.
- `npm run qa:threat -- --levels L9` — preflight rejected the same 151/150 global test-case budget. The direct full all-level audit above completed with zero fail flags.

## Visual review and open gates

The requested high/low, zoom-1 native frame sequence and contact sheet are not included. Capture was attempted through `tools/e2e-lock.sh`; the sandbox returned `listen EPERM` for local preview and browser-pool listeners (including port 4329), so no browser could be admitted. Frames have therefore not been reviewed. The capture driver is `tools/qa/s233-l9ending-capture.ts`; run high and low captures through the browser pool, inspect every phase, and add one small contact sheet here once a browser-capable environment is available.

Remaining to close the goal: visual review/contact sheet, successful remote unit suite (healthy runner required), and resolution of the existing 151/150 test-budget gate without trimming tests.
