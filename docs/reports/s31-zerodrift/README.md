# s31-zerodrift

Partial delivery: local threat audit routing fixed. Collision regression remains unresolved; no bisect or driving/threat proof results were produced.

Cause: --single delegated to run-threat-remote.mjs, which always requires run.sh and remote capacity.
Change: invoke node --import tsx/esm tools/qa/threat-audit.ts directly, forwarding arguments and exit status. Remote sharding is unchanged.
Regression: tools/remote/check.py uses a disposable fake node to assert the local child arguments and nonzero exit propagation.

Checks: python3 tools/remote/check.py --unit passed (3 skipped); typecheck and lint completed. npm run test:gate was invoked once and exited 1. Its /tmp/s31-gate.log was overwritten by another s31 lane, so detailed gate results cannot be reliably attributed.
Before: --single required remote runners (reported exit 69). After: fixture verifies local execution and exit 7 propagation. No live L9 audit run.

Outstanding: temporary-worktree bisect from fb3dd88c, collision cause/fix, zero/road/risky/countryside proofs and skilled L9 threat audit.
