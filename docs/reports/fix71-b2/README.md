# fix71-b2 — restore L6 opening courier pressure

Game fix `855a60d`; merged main `65338bc` via `cca991d`, with no conflicts. Final runtime source hash: `0832704e13ddc34361b53ed2aef8e2104ff1a15e0c03c7668de2d7bd99320703`.

## Fix

The corrected elevated-floor MG fire could erase the ordinary opening attackers before they reached the courier. Bot-only experiments that scoped rifle visibility/rescue targeting or restored shelter panic still yielded zero courier windups. A melee experiment produced one, below the unchanged4/min criterion; none of those controller changes was retained.

The first breach's existing riot front member now uses the existing armored archetype already used at tunnel hatches. It survives the initial fire and engages the courier. This changes one archetype slot; cohort sizes, caps, spawn clocks, weapon/enemy stats and acceptance criteria are unchanged. The production bot, rifle-height correction and follower formation/protection remain intact.

## Merged-source evidence

| Requirement | Low | High |
| --- | --- | --- |
| Complete opening player windups |4 in21.017s;11.420/min|4 in21.017s;11.420/min|
| Complete first player windup |5.983s|5.983s|
| Stationary opening player windups |49;139.889/min|49;139.889/min|
| Stationary first attack after breach1 /2 |2.083s /9.083s|2.083s /9.083s|
| Minimum bounded-path reachable share, complete/stationary |100% /100%|100% /100%|
| Mortal complete rescued |21/29=72.41%;0 deaths|21/29=72.41%;0 deaths|
| Mortal evade-only rescued |1/29=3.45%;12 deaths|1/29=3.45%;12 deaths|

[Opening and rescue summary](merged-summary.json), [full mortal roster/bite/position ledger](merged-protection.json.gz), [independent canonical controls](control-proof.json). Dedicated complete world hashes match fresh qa:accept and uninstrumented checkpoint controls: low`269abc86`, high`51053774`.

The unchanged L6-11 thresholds remain met (complete>=60%, evade-only<=30%). Complete rescues five fewer survivors than the previous26/29 result. This is named native-bot qualification, not a human or physical-controller rescue claim.

## Validation

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS107/107 tests,27 files,26.4s within240s.
- `npm run qa:accept -- --level L6 --skip-browser`: both qualities and both native policies refreshed;0 fresh failing rows,8 fixture clauses and7 checkpoint cases per tier,0 errors, independent controls identical. Cached report regenerated after full-criterion review: L6-05 and L6-07 are PASS, with no failing L6 rows. Overall command still exits1 due global failures, including preexisting G-22; see below.
- Full `npm run qa:threat -- --out test-results/fix71-b2/threat`: **PASS,0 flags across all10 levels**,358.2s within600s. Launched alone in this lane at load4.957 (below6), using main's unchanged two-worker harness. No source-equality override or criterion changes. Automatic source comparison to main is false because lane fixes remain after the merge. [Full report](threat.md), [compressed audit](threat-audit.json.gz), [launch record](threat-window.json).

[Validation record and hashed logs](validation.json).

**G-22 remains FAIL**, as before this follow-up: its generic>=3 cohort check conflicts with L6's explicit2 per side entry. One entry also exceeds the20s contact window (35.583s before,45.133s now). There were16 failing checks before and12 now; this is not a blanket acceptance pass. [Open evidence](G-22-open.json). No checker or criterion was changed.

Main's unrelated receipts are preserved. Global acceptance indexes are restored after the L6-only run; only the fresh L6 level/receipt files are committed from this refresh. L6-11's dedicated proof remains separate from stock automation coverage. Earlier L4 measured failures from fix71-b are outside this follow-up and remain open.

No browser run/capture was requested in this follow-up (`--skip-browser`); no raw captures were created. No push or deployment.
