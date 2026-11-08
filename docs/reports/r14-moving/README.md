# R14: infected attacks against moving couriers

## Status

Shared ordinary attacks now aim their telegraph at the courier's estimated strike-time position. Their acquisition, separation and live strike checks share a reach envelope that includes the courier's travel during the windup. Special moves lock the predicted target point as well. The threat harness now supports both the existing retreat policy and a deterministic circular movement style, and measures landed hits with positive damage separately from windups. L4 stationary-ring detection now consumes the pre-physics controller step instead of comparing two poses that are identical at AI time.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused `tests/engine/infected-ai.test.ts` — 5/5 pass on Hetzner (8.56 s). The shared attack test exercises accepted hits during running circles for 13 attacker families (expanded follow-up also passes the Mega Alpha), an in-reach straight retreat, unchanged windup delay, and an out-of-reach escape control.
- All-level retreat and circular movement hit-rate samples — running. The gate requires ≥2 landed hits/minute on the moving courier; circle movement coverage excludes forced enemy pins/staggers, while the hit-rate denominator retains the whole sample window.
- Normal threat numbers by level, including PO-accepted L1–L5 — pending.

No browser runs or deployment performed.

## Measurement provenance

Baseline runtime is `a7b70c78`; after runtime is `03679e07`. The runner baseline copy was restored with the inverse runtime diff, and its InfectedSystem SHA-256 exactly matches the base commit (`91e8a4749f2acb6b170c65a9973b432de5d0bb5d512564ba61a455bf8aba4c1e`). The after copy and this worktree match `f7799199b90a4767a0ef18061c3ffaffa8d31c33c869ace182dcd966fa3cef29`. Seed 1, low quality, unchanged native complete/passive routes; separate disposable 20-second movement encounters. Retreat keeps the existing walking/backpedal fire policy. Circles use a fixed 4 m centre (3/2 m if needed), full run, and the same fire policy. L9 is the existing driving-policy N/A.

The shared FIFO contained sandboxed sessions unable to select idle runners. These runs use the supported separate-queue setting with Mac fallback disabled and the ordinary remote slot locks retained. The first broad verification had one shared-load timeout and one missing-HEAD tooling failure in the runner manifest checkout. The isolated repeat supplies a temporary empty Git commit inside that private runner job for the tooling fixture. It does not alter the local repository or the runtime provenance above.
