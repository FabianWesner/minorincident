# QA reports and repository pruning

Generate acceptance with `npm run qa:accept -- --level all --skip-browser --reuse`.
The report is [fix51-verify/README.md](fix51-verify/README.md); manual decisions
remain in [docs/qa/reviews](../qa/reviews) with each evidence SHA-256 and observation.

Evidence files may be **ARCHIVED** (absent). Their absence does not change review
freshness or verdict. Present evidence must still match its recorded digest.
Exact criterion matching and current source checks still govern qualification;
an older review with different clause text stays historical and cannot qualify
an exact-criterion PASS. Required machine receipt inputs remain mandatory.

New screenshots, sheets, videos, model exports, and disposable logs belong in
ignored `test-results/`. Capture and sheet tools default there. Committed evidence
is compact JSON, documentation, and compressed structured source receipts that
an evaluator or reviewed proof chain actually reads. Some required JSONL archives
are receipt inputs, rather than disposable execution logs. Two L9 producer
snapshots remain byte-identical because the qualification manifest hashes them.

Current E25 emitter contract repair: [E25-AC02 report](e25-emitters/README.md).

## Retained report subtrees

| Subtree | Required use |
|---|---|
| `fix51-verify/` | Current acceptance reports, reusable native/fixture/checkpoint receipts, evaluator proofs and validation attestations. |
| `batch51-qa/` | Historical criterion ledger used to construct every acceptance row. |
| `fix51-perf2/` | Performance criterion remeasurement ledger and scope documentation. |
| `fix51-r4/` | Physical L10 Resume/batch proof chains checked by the acceptance audit and publisher. The hashed v1 runner snapshot moved intact into `tools/qa/`. |
| `fix51-r10c/` | Current evaluator inputs, review metadata and their referenced compressed source artifacts. Diagnostic and duplicate trials were removed. |
| `fix55-a/` | L2 visibility proof consumed by the evaluator. |
| `fix55-c/` | L7 corridor/rocket, L8 outbreak/bite/enclosure and L9 native proofs. |
| `fix56-c/` | L10 camera and pursuit proofs. |
| `sweep-c/` | L8 boarding/radar source receipts and L9 group census. |
| `sweep-c3/` | L9 qualification manifest, its three physical inputs, two hashed producer snapshots and two review records. |

The keep set follows static readers in `tools/qa/accept/`, test/tool dependencies,
and traced filesystem reads during the full reused acceptance run. Manual review
artifact reads were distinguished from required evaluator inputs. Archived
artifacts keep their review metadata; missing machine inputs do not gain a pass.

`docs/scenes/` retains authored scene JSON, the roof-sweep input read by tools,
and small review text. Generated captures and metrics were removed. Canonical
gate scenes stay in `specs/scenes/` and `tests/scenes/`; test fixtures remain intact.
Asset scripts, model/rig/atlas sources read by build tools, runtime public assets,
licenses and asset notes remain. Unread concept/UI originals, review renders,
unused rebuild exports and Python bytecode were removed.

Protected `initial-drafts/` and `experiment/` are unchanged. `folio-2025/` and
`references/` have no tracked files in this checkout and were not modified.
No `assets/*/reference*.png` was modified or removed (none is tracked here).
`preview/` and `experiment/tools/` remain intact. Specs and gameplay code are unchanged.

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` and `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS: 27 files / 107 tests |
| `npm run build` | PASS, including public-build QA-hook exclusion |
| `E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke` | PASS: six QA smoke cases plus public smoke, 188.4 s / 240 s budget |
| `npm run scene:gate` | PASS: 48/48 rows, no known failures or missing rows; 8.4 min |
| `npm run qa:threat` (alone) | PASS: 0 fail flags; 318.9 s / 600 s budget; exclusive quiet admission |
| `npm run qa:accept -- --level all --skip-browser --reuse` before/after | Identical table; both exit 1 for existing open acceptance findings |

Archive handling is covered by the shared review tests: absent evidence is accepted,
valid present evidence matches, and changed bytes fail validation. All 30 changed
Python tools parse successfully. Five sheet publishers also completed with
synthetic 1280×720 captures in an isolated folder, leaving no images under
`docs/reports/` while preserving JSON metadata.

Acceptance is still **NO-GO**: 23 FAIL, 112 NOT CHECKED, 34 PASS across 169 rows.
The regenerated baseline was captured before tracked evidence deletion; the
previously committed table was an older report. The before/after `diff -u` is
empty, including timestamps. Both files have SHA-256 `17682b28b36019f0569b06736a4ffd76069f906f7c51172bde54e5576c8476cb`.

## Tracked bytes

Logical Git blob bytes (no `.git`, caches, dependencies, ignored outputs or disk
allocation overhead). Before is `dbfa8ec85`; after is this pruned tree, including
this report. Preserved protected directories are included. History compaction
is performed separately by the orchestrator; this commit only prunes the tree.

| Top level | Before bytes | After bytes |
|---|---:|---:|
| `(root files)` | 249,440 | 250,998 |
| `.github` | 1,273 | 1,273 |
| `assets` | 753,468,385 | 699,318,341 |
| `docs` | 4,142,494,354 | 57,675,880 |
| `drafts-pipeline` | 1,302,453 | 1,302,453 |
| `epics-pipeline` | 653,310 | 653,310 |
| `experiment` | 21,125,634 | 21,125,634 |
| `functions` | 22,732 | 22,732 |
| `initial-drafts` | 77,904,463 | 77,904,463 |
| `layouts` | 297,369 | 297,369 |
| `migrations` | 2,221 | 2,221 |
| `preview` | 1,779 | 1,779 |
| `public` | 521,787,761 | 521,787,761 |
| `scripts` | 9,715 | 9,715 |
| `specs` | 1,321,687 | 1,321,687 |
| `src` | 8,938,232 | 8,938,232 |
| `tests` | 39,899,801 | 39,900,646 |
| `tools` | 6,195,155 | 6,163,352 |

Total: **5,575,675,764 → 1,436,677,846 bytes** (74.2% removed). Tracked files: **37,853 → 10,364**.

`docs/reports`: **3,959,962,958 → 47,749,121 bytes**.
