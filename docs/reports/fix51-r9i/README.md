# Acceptance review freshness

Manual acceptance review JSON lives at `docs/qa/reviews/<ROW-ID>.json`. Existing fields and verdicts remain unchanged. New reviews must also record `sourceDigest`, the lowercase SHA-256 digest of the relevant source snapshot at review time.

The digest covers the sorted file paths under `src/levels/<LEVEL>`, `src/data`, `src/render`, `src/ui`, `src/assets`, and `public`. For each path, the digest input is the UTF-8 path, a NUL byte, the exact file bytes, and a NUL byte. `reviewSourceDigest(level)` in `tools/qa/accept/reviews.ts` computes the digest for the current worktree; pass the review commit as the second argument to compute the source snapshot from that commit.

Use `writeReview(review, level)` from `tools/qa/accept/reviews.ts` when saving new review JSON; it validates the decision, adds the current digest, and writes the canonical row file. The tracker reports a review as `FRESH` only when the recorded digest equals the current worktree digest. For older review JSON without `sourceDigest`, it computes the digest at the recorded `commit` and compares that snapshot with the current source. A missing or unreadable historical commit is `STALE`; the tracker never fills in or saves a digest for an old review. Evidence hashes, clause text, decisions, and review criteria are evaluated as before.
