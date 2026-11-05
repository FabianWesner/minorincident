# fix64-a — L1/L3 leftovers

**Lane work complete: one PASS; five measured FAILs remain open in the game. All required validation gates pass.**

Source base: `2cc5adb25`. Accepted game change: `5fcfe692e` (L1 approach cues). No deployment or push.

## Row outcomes

| Row | Outcome | Evidence / remaining work |
|---|---|---|
| L3-07 | **PASS**, both tiers | Fresh moving pistol-hit frames and mortal native receipts: low 116/high 37 squad bullet hits, player damage 0/11 HP. The previous spatial filter wrongly excluded valid yard-retreat shots west of x=-126; the PO permits the squad to be overwhelmed there. The corrected check requires completion of the full initial retreat window, positive squad bullet damage, and player damage <100 HP. Kills and unrelated later deaths do not decide this row. Seven checker controls retained. |
| L3-06 | **FAIL**, measured | Low rear medians 6.475/6.364 m and maximum 7.814 m violate 3–6 m. High loses all 4 in the yard. A calm-only velocity correction improved medians but left all 4 at the army line (limit ≤2), and still had outliers; reverted. Final native survivors 1/0, all losses bites. |
| L3-13 | **FAIL**, measured | Personally reviewed 72 full-traversal images and 16 fresh high entry images. Living infected appear past broken inner edges at x=144–156, remaining after 10 s at x=157. Actual entry zoom 0.5/1.5 recorded. 167 root/foot witnesses do not prove collision-root penetration (zero roots outside nominal width); a rendering/support cause remains unresolved. No speculative collision change. |
| L3-16 | **FAIL**, measured; **P** for taste | Final 24 frames: both tiers, static Oak/Commerce/Boulevard at actual zoom 0.5/1.5, plus two ordinary moving poses (x=-80/x=-40) at actual zoom 0.5/1/1.5. The two default-zoom moving poses show two smoke forms; default-zoom moving Boulevard is unqualified. Closest Commerce still has one readable rising stem and a clipped diffuse patch. Two visual trials introduced foreground haze and were reverted. Original smoke retained. **PO:** inspect amber late-afternoon light and whether residential wrecked gardens, looted shop fronts and boulevard jam read as distinct damage types. |
| L1-16 | **FAIL**, measured | Fresh named Luna low run has 66.967 s cumulative lost active time: 36.017 s at the bench/hydrant and 30.950 s in the blue-bin/fence return loop. Forward progress and model latency excluded; this is not one continuous 60 s stall. All 68 images inspected. Ends 10 m from depot without pickup. Annex/garage and high full route remain unqualified. Existing depot walkable-leg cue extended to Annex/garage; destination ring and HUD distance preserved. |
| L3-12 | **FAIL**, qualitative route counterexample | Fresh named Luna low run starts at actual fallback after ordinary native InputFrames. 35 actions, 53.633 s active; all 70 images inspected. Repeated plaza and truck/crate/fence approaches end 351 m from fixed army checkpoint (start 360 m). Onward route not discovered. Crosslinks themselves not reached; their paint and high full route remain unqualified. No claim of a physically impossible route. |

Each review is in `docs/qa/reviews/<ROW>.json`; row packets here retain SHA-256 values and concrete observations. Rejected patches are evidence, not applied changes. No specs, protected references, encounter counts, timers, caps or performance targets changed.

## Screenshot protocol and exclusions

Headless shared browser pool, separate ports 4891–4894, at most two owned contexts. Browser commands are bounded by 595 s. Courier protection and existing combat aim assistance isolate navigation; no mortal-difficulty claim. The clock pauses between decisions; private tick ledgers measure active time and never reach the player. L3 setup follows ordinary native input through actual fallback, with no relocation or progression skips; the screenshot player owns all onward decisions.

The final runner supplies a fresh attached image for exactly one action per model turn. It gives controls and visible HUD only, no map files, source coordinates, route hints or previous lane reports. Earlier attempts are retained as **excluded diagnostics**: an opaque wrapper acquired exclusive admission; concurrent sessions initially shared `shot.jpg`; another multi-action attempt lacked auditable per-action image views. These are harness failures and do not establish acceptance PASS/FAIL. Capture paths are now isolated under each run directory. A later physical-input replay reached a different nearby pose; its 9-action follow-up is a scoped diagnostic, never stitched into route timing. The unused replay feature was reverted (`13d197612`).

## Validation

- `npm run typecheck`: final PASS (`tsc --noEmit` and sim config).
- `npm run lint`: final PASS.
- Literal `npm test`: retry **PASS, 107/107 tests, 27/27 files**, 45.0 s budget wrapper. First run 106/107 with L4 contact 30 s timeout while browsers were active; both logs retained. No limit changed.
- Fresh `npm run qa:accept -- --level L1 --skip-browser --tier both` and L3 equivalent: completed both native routes, fixtures and checkpoint controls; zero fixture/checkpoint errors. Exit 1 represents open acceptance rows. Final exact-source receipt reuse/review refresh: L1 has 1 fresh FAIL and 11 other incomplete rows; L3 has 4 fresh FAILs and 6 other incomplete rows. All six assigned decisions are FRESH. Other incomplete rows are outside this lane.
- Literal `npm run qa:threat`, zero arguments and run alone: **PASS, all 10 levels, 0 failure flags**, 507.2 s audit /511.5 s wrapper, unchanged 600 s limit. [Final gate record](qa-threat-final.json) and [full compressed JSON receipt](qa-threat-final.json.gz). Earlier one-shot timeout and subsequent sequential diagnostic remain historical, not passing one-shot evidence.

Threat gate scope: the existing command aggregates passive and focused-check failures. Its full receipt also retains two L3 skilled-route timing diagnostics: `station-0:WAVE_FIRST_ATTACK_OVER_20_SECONDS` and `station-2:WAVE_NO_ATTACK_WITHIN_20_SECONDS`. These are diagnostic fields outside the command’s exit gate; zero gate flags does not mean every diagnostic array is empty.

Shared all-level indexes are restored to the base rather than committing a two-level regeneration that drops unrelated levels. The coordinator can regenerate them after merging. Updated L1/L3 JSON and native receipts are retained.

Full command logs and SHA-256 values: [validation records](gates.json). The QA build also passed.

## Commits

- `1623f1d50`: L3-07 hit-window correction, boundary controls and visible/native evidence.
- `b49e9c332`: L3-13 full traversal and support diagnosis.
- `5c1efcfe8`: L3-06 rejected spacing trial.
- `5fcfe692e`: L1-16 Annex/garage walkable approach cues.
- `34fdbead3`, `d1335e713`: L3-16 final smoke matrix, rejected trials and exact coverage.
- `91c25c7fe`: L3-07 final-source moving-shot refresh.
- `f8d88ddc1`: L3-06 final native spacing/attrition refresh.
- `943d86cb2`: L3-13 fresh entry zoom/settling evidence.
- `2f65bccac`, `09e648438`: screenshot session isolation and one-image-per-decision protocol, with excluded diagnostics.
- `8f3b46dd3`: L3-12 fresh route-discovery counterexample.
- `7fc617d5e`: L1-16 cumulative lost-time counterexample; scoped replay excluded.
- `7babe37b5`, `13d197612`: physical replay trial and its complete revert.

## Capture cleanup

All 688 owned raw images and derived review sheets were personally inspected, hashed and deleted. [Cleanup manifest](capture-cleanup.json) records every deleted file. No image or binary screenshot is committed; compressed ledgers contain only JSON, actions and observations.
