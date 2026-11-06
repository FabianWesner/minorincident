# fix73-g2 — merge blockers

Follow-up to [fix73-g](../fix73-g/README.md). Main baseline: `183ca95` (includes fix73-b). Final game source: `ec2b1da`. No performance work, dependency changes, checker/threshold changes, push or deployment.

## Fixes

### L7 high native completion

**Fixed:** the final focused native complete route matches main at both tiers, including its final state hash:

| Tier | Completion | Native state hash | Main comparison |
|---|---:|---|---|
| Low | 138.83 s | `30e28540` | Identical |
| High | 104.48 s | `08b6e3e8` | Identical |

`35d5042` added a nearby escape fallback that could retain a blocked fine-grid route indefinitely. Contact displaced survivor #68 from its planned route; a zero-length walk still claimed it every tick. The courier waited at waypoint 5 before boarding, eventually reaching its 1,200-second budget. `2310b32` releases a blocked pocket route to ordinary navigation. [Diagnosis and intermediate repeat](L7-pocket.json).

Once completion worked, the full acceptance observer exposed departure pace regressions in the extra escort changes. Replanning stale queue legs did not resolve them. Broader tracking cleared a pace vote but introduced a low-seed timeout, so it was rejected. `ec2b1da` restores main's formation, actor-aware corpse planning, NPC motion response and native bot route. It retains the eight-second opening damage grace, boarding latch, courier-last departure within 6 m, empty-roster text and blocked-pocket release. No original body, speed, count or boarding/recovery timer is changed. [Candidate controls and final focused evidence](L7-compatibility.json).

The final focused seed outcomes match main: all low seeds complete; high seeds 1/2 complete and seed 3 retains main's pre-existing timeout. Both canonical human pace votes pass. The requested high seed 1 completion regression is resolved; this does not claim every seed completes.

### L10 R6 dog overlap

**Fixed in `75eb476`:** five corridor dogs were admitted while a surviving research dog was just outside R6. Its later crossing raised the local count to six. Reserve that incoming dog's concurrent slot at admission. Authored once-only dog slots remain deferred, rather than removed. [Boundary trace](L10-boundary.json).

Native complete repeats at both tiers finish with R6 dog peaks **5 low / 3 high**, within the unchanged 3–5 bound. The extended patrol search, earlier complex release, authored slot counts, regional caps and cadence remain intact. Final acceptance adds the standard every-tick census.

## Main merge

`564b16a` merges `183ca95`. All 42 conflicts were documentation/receipts and use main's versions, as requested. Source merged without conflict, preserving main's L4 look/corpse changes and L5 work. Fresh L7/L10 acceptance output is recorded after the merge; shared aggregate indexes are restored afterward.

## Final validation

- `npx tsc --noEmit` and `npm run lint`: PASS on the frozen source.
- `npm run qa:accept -- --level L7 --skip-browser` and the same for L10: both tiers, complete/stationary, fixtures and checkpoint controls rerun. **No new failing rows, globals or clauses versus main; no newly failing native seeds.** Both commands exit 1 because existing failures remain.
- All four canonical completion routes finish without courier deaths. All 60 checkpoint checks PASS with identical controls; 48 fixture clauses report zero errors.
- R6 dog peaks: low complete/stationary 5/5; high complete/stationary 3/5. Every cell meets the unchanged 3–5 bound. Full L10-03 retains its existing stale composition-census failure; the native dog-bound clauses pass.
- `npm run qa:threat`: **PASS, 0 flags**, exit 0, 277.1 s audit / 279.2 s command. Ran alone after all other owned checks ended; admitted at load 1.924 (<6). [Gate receipt](gates.json) retains the exact source, admission, full audit and logs.

| Level | Retained fresh failing rows | New failing rows/clauses | Incomplete rows |
|---|---|---|---:|
| L7 | L7-01, L7-05 | None | 8 |
| L10 | L10-03 | None | 10 |

[Acceptance summary](acceptance.json) records exact clauses, policy outcomes, source hashes and receipt digests; [logs](acceptance-logs.json.gz) retain the commands. Main's aggregate acceptance indexes are restored. The [main baseline](main-baseline.json) contains its published receipts, rather than a new baseline execution: its retained low R6 receipt already records dogPeak 6, so this follow-up independently checks the game bound 5.

The first candidate acceptance retained new L7 pace failures, and its L10 report assembly stopped because a sparse checkout omitted a tracked compressed physical receipt. The exact HEAD blobs were restored; the failed logs remain [archived](first-acceptance-rejected.json.gz). No receipt content, criterion or checker was changed to bypass the missing artifact.

Earlier physical L7 pickup/survival findings and L6 escort losses remain in the original report. This follow-up performs the requested native verification and adds no browser or performance qualification.
