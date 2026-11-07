# blk-b — L4–L6 release blockers

Base: `2162727d4c889774f5c2306fb3a82dfc82caf2ec`. Worktree: `lane/blk-b`.

## Row results

| Row | Result | Commit / evidence | Remaining work |
|---|---|---|---|
| L5-06 | Fix committed: `Hud` now keeps the minimap ♪ only while a live positional voice remains at that cue source. | `122ac63`; both-tier `qa:accept` native observations, fixtures, and checkpoints refreshed. | Full physical low/high × zoom 0.5/1.5 row review remains open. Acceptance report generation is blocked by the stale L4 browser-evidence hash described below. The previous receipt proves Mia's note outlasted audio by 0.821 s; the new runtime check has not yet been observed in a browser capture. |
| L4-11 | Fix committed: healthy mandatory-bar threats bypass the ordinary 15 m healthy-infected cutoff. Added a 16 m healthy riot eligibility assertion. | `935c013`; both-tier `qa:accept` native observations, fixtures, and checkpoints refreshed. | Need a fresh normal-zoom visual capture to confirm the bar is actually visible in both tiers; the machine report cannot finalize because of the stale L4 browser-evidence hash. The row review remains open. |
| L4-13 | **FAIL, retained with evidence.** | `9395abc`; [native admission ledger](L4-13-evidence.json), raw gzip SHA-256 `b784580696d8ce8e8122c38ceebe731e46446bfe69ff6556523c771f9559fe57`. | Both tiers have full 9-second windows with fewer than 3 actual admissions. High reaches the existing 120 cap with 44 reserved slots while demand remains queued. No safe population-capacity fix was established; the cap, wave size, and criterion were left unchanged. |
| L4-07 | Candidate fix committed: moved the two south outer spawn mouths onto the connected south street grid. The high-tier counterexample is cleared in the refreshed native acceptance receipt. | `a86baf5`; L4 high legal-path samples: 80/80, 100%, no blocked IDs. | **Still open:** low reports one blocked-path sample (98.65%, ID 376) in 85 samples, so universal all-body reachability is not proven. Need inspect that actor's exact native position and route before closing the row. |
| L6-14 | Candidate material adjustment committed: increased the infected skin shift toward the existing ash-green material, leaving the separate eye emission intact. | `0581d62`; both-tier `qa:accept` native observations, fixtures, and checkpoints refreshed. | The strict eye-versus-forehead luminance comparison has not been rerun and no post-change close-up was captured. Keep the row open until new captures are visually inspected and the eye pixels measure brighter in both tiers. |

## Gate and limitations

The L4, L5, and L6 commands were each run as `npm run qa:accept -- --level L<N> --tier both --skip-browser` after their changes. Each completed both-tier native observations, fixtures, and checkpoint controls (L4/L5: 10 fixture clauses per tier; L6: 8; all with zero fixture errors). Each command exited during review finalization with the same error: `Review evidence hash mismatch: docs/reports/fix51-verify/receipts/L4-low-webgl2-z1.5-browser.json`. The generated level receipts are committed with their corresponding rows. This prevents treating these commands as passing report runs.

The initial sandbox blocked the slim-worktree helper; after filesystem access was restored, the requested helper completed successfully. No assets were modified. No browser capture, deploy, or push was performed. The missing reference `docs/reports/fix52-corpse/README.md` was not present in this checkout.

## Final validation

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 27/27 files and 107/107 tests.
- `npm run qa:threat` was run alone and did not pass. It exceeded its 600-second budget at 601.0 seconds; the browser reservation hit its 599-second batch limit before the full level set completed. The completed L1–L4 and L6–L8 leaf audits have zero passive threat flags; their one flag is the required `PARTIAL_LEVEL_SELECTION` marker for each isolated child, not a game failure; L5 had no completed result, and L9–L10 were not reached. The L1–L8 reports' runtime-source identity also reports `false` against frozen main because this lane contains the committed source changes. The full required zero-flag threat gate is therefore open.

The initial sandbox rejected the final staging attempt. Filesystem access was subsequently restored and closeout staging can proceed.

The required visual L5/L4 reviews and exact L6 eye-luminance comparison also remain open, as noted above.
