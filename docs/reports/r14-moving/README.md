# R14: infected attacks against moving couriers

## Status

Shared ordinary attacks now aim their telegraph at the courier's estimated strike-time position. Their acquisition, separation and live strike checks share a reach envelope that includes the courier's travel during the windup. Special moves lock the predicted target point as well. The threat harness now supports both the existing retreat policy and a deterministic circular movement style, and measures landed hits with positive damage separately from windups. L4 stationary-ring detection now consumes the pre-physics controller step instead of comparing two poses that are identical at AI time.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused `tests/engine/infected-ai.test.ts` — 5/5 pass on Hetzner (8.56 s). The shared attack test exercises accepted hits during running circles for 13 attacker families, an in-reach straight retreat, unchanged windup delay, and an out-of-reach escape control.
- All-level retreat and circular movement hit-rate samples — pending.
- Normal threat numbers by level, including PO-accepted L1–L5 — pending.

No browser runs or deployment performed.
