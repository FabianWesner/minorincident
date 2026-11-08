# R14 moving hits: merge with main

## Result

**Main `78219de9` is merged in `17c08b81`; final moving-hit and accepted-level balance checks pass.** Both retreat fire and constant running circles land at least 2 moving hits/minute in all nine on-foot levels. L9 remains driving-policy N/A. All five normal L1–L5 routes complete within the original damage/death limits.

Runtime: `a4101523`; final encounter-admission correction: `40564543`. [Exact measurements and source/receipt hashes](measurements.json).

## Merge and runtime changes

- Kept all 14 `combatHeightReachable` guards and main’s support-height routing, including both dog-pack conditions in the conflict.
- Kept all five Alpha types, nine special moves, type move rotation, camera/start admission, projectile ownership and recovery. Prediction runs before the special copies its target and geometry. Each Alpha move asserts that a moving target is predicted and the point stays locked when the caller changes target/velocity.
- Retained readable warnings, live strike obstruction checks, moving separation handling, the accepted L1–L5 1.6 m ordinary lunge lead/reach budget and 10% glancing damage. Added a **two-second per-attacker cooldown after an introductory moving graze**; ordinary end-of-attack bookkeeping preserves it. Planted hits and committed specials retain their authored wounds. L6–L10 do not receive this balance gate.
- Main’s generic height-aware spawn correctly defaults to the ground layer. L7’s Northgate residents nevertheless belong on its authored 1.8–3.9 m street terraces: their spawner now passes the street surface Y explicitly, including queued arrivals. It no longer leaves them beneath the road while the courier stands above them. The existing mission test checks elevated residents; no registered cases were added.

## What the first merge exposed

The first merge passed typecheck/lint/unit/proof, but the unchanged movement policy missed in L3 retreat, L7 circles and L8 retreat. L7 circles recorded zero starts: nearby infected stood at y=0.7 while the courier stood around y=2.7–2.8. The explicit authored street heights restore valid same-floor contacts without removing a height guard.

L3’s native route rose to 86.90 HP. Its trace splits into 42.9 HP from 39 moving grazes and four full 11 HP wounds. Main’s own infected system, with the moving changes removed in a private runner snapshot, measures **44.00 HP / 0 deaths / 191.05 s**. The final two-second recovery returns L3 to **36.30 HP / 0 deaths**.

Rejected candidates are retained in JSON: a 4% wound/brief-stop classification candidate worsened L3 to 139.33 HP / 1 death; a 1 m reach cap measured 88.00 HP; 1.2 m plus two-second recovery measured 93.50 HP. Two- and three-second recovery at the accepted 1.6 m budget both measured 36.3 HP; the shorter recovery was selected.

## Normal skilled routes: accepted before → final after merge

Seed 1, low quality, unchanged native complete policies/default presets. Limits remain damage ≤2× pre-R14 `a7b70c78` and deaths ≤original +1. These routes do not install either movement policy.

| Level | Damage HP before → initial merge → final | Deaths before → initial merge → final | Final sim seconds | Damage / death limits | Outcome |
|---|---:|---:|---:|---:|---|
| L1 | 39.00 → 36.00 → **30.00** | 0 → 0 → **0** | 115.07 | 60.00 HP / 1 | complete; PASS |
| L2 | 25.20 → 30.60 → **27.00** | 0 → 0 → **0** | 148.32 | 36.00 HP / 1 | complete; PASS |
| L3 | 36.30 → 86.90 → **36.30** | 0 → 0 → **0** | 193.40 | 44.00 HP / 1 | complete; PASS |
| L4 | 367.00 → 446.45 → **539.13** | 3 → 3 → **3** | 349.10 | 1355.07 HP / 7 | complete; PASS |
| L5 | 125.00 → 75.00 → **75.00** | 0 → 0 → **0** | 195.05 | 200.00 HP / 1 | complete; PASS |

## Moving-hit floor

The acceptance thresholds, three-body horde, fixed 20-second encounter clock, firing/loadout, retreat speed and circle steering are unchanged. The receipt still counts positive accepted damage only while the courier physically moves after physics; circles require ≥95% controllable movement and every sample ≥10 active seconds.

Encounter admission was corrected for the merged content: a mixed-target horde must include at least one nearby courier pursuer. L3’s protected station hold excludes police-directed attackers from the courier horde, matching its explicit police target bias. L8 loses its former exception admitting distant wandering residents and now uses the existing 12 m close-pursuer condition. Red fixtures reject wandering/distant/NPC-only pressure, accept mixed pressure with a courier pursuer, and check L3’s protected hold.

**The policy hash changes. Before/after rates below describe their respective admitted encounters; they are not a controlled same-window difficulty comparison.** Native balance above is unaffected by admission changes. Failed first-merge receipts and rejected admission candidates remain recorded rather than being treated as passes.

| Level | Retreat hits/min before → final | Circle hits/min before → final | Final retreat hits / seconds | Final circle hits / seconds | Circle controllable movement |
|---|---:|---:|---:|---:|---:|
| L1 | 42.00 → **21.00** | 27.00 → **33.00** | 7 / 20.00 | 11 / 20.00 | 100.0% |
| L2 | 3.00 → **3.00** | 39.00 → **45.00** | 1 / 20.00 | 15 / 20.00 | 99.9% |
| L3 | 6.00 → **3.00** | 3.00 → **6.00** | 1 / 20.00 | 2 / 20.00 | 100.0% |
| L4 | 30.00 → **28.27** | 18.00 → **30.00** | 9 / 19.10 | 10 / 20.00 | 100.0% |
| L5 | 3.00 → **3.00** | 6.00 → **3.00** | 1 / 20.00 | 1 / 20.00 | 100.0% |
| L6 | 3.00 → **12.00** | 3.00 → **27.00** | 4 / 20.00 | 9 / 20.00 | 100.0% |
| L7 | 3.00 → **3.00** | 40.62 → **12.00** | 1 / 20.00 | 4 / 20.00 | 100.0% |
| L8 | 9.00 → **33.33** | 24.00 → **43.33** | 10 / 18.00 | 13 / 18.00 | 100.0% |
| L9 | N/A: driving | N/A: driving | — | — | — |
| L10 | 6.00 → **9.00** | 21.00 → **30.18** | 3 / 20.00 | 10 / 19.88 | 100.0% |

## Validation and scope

- `npm run typecheck`: passed (44.0 s).
- `npm run lint`: passed (26.7 s).
- `npm test`: passed (81.8 s).
- `npm test` is the `test:unit` command: **106 passed, 1 skipped, 27 files**. Existing infected tests retain all 21 damaging attacker movement cases, warnings/escape, planted vs glancing wounds, the two-second recovery, the lead cap and later full damage. Collection stays at **150/150 cases and 43/45 files**.
- `qa:threat -- --proof`: passed, including the final admission fixtures.
- All heavy commands used Hetzner via `tools/remote/run.sh`; validation held both runner slots. Its private full Git manifest supplied HEAD for freshness tests.
- Extra L7 native check after the authored-height fix: **160.00 HP / 0 deaths / 116.37 s; complete**. Pre-merge was 100 HP / 0 deaths / 105.28 s. This late damage number does not match the pre-merge receipt. The trace accounts for 150 HP from moving ordinary runner contacts and 10 HP from one still contact.
- A private incoming-main reference replaces both the infected system and L7 spawner with their exact `78219de9` files: **mission-failed at 43.80 s, 1 death, 0.00 recorded combat HP**. This incomplete reference is not a comparable full-route damage baseline. Final L7 completes with no deaths; no claim of unchanged late native damage is made.
- Repeated both moving policies for all ten levels and normal L1–L5 routes. Other later native routes/full threat-audit flags were outside this merge rerun; no claim is made about unsampled late/final combat or full campaign completion. Main brings separate story and Alpha changes.
- No browsers, deployment or push.

[Accepted pre-merge balance report](../r14-moving-b/README.md). Exact precision, original baselines, limits, phase pressure, failed candidates, and raw receipt hashes are in [measurements.json](measurements.json).

To reproduce one encounter on a runner:

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull test-results/r14-moving-m/repro -- timeout 720 node --import tsx/esm \
  tools/qa/moving-audit.ts --level L3 --policy retreat \
  --out test-results/r14-moving-m/repro/L3-retreat.json
```

Use `circles` for constant running circles or `native` for the unchanged skilled route.

Runtime SHA-256: `9319e1f8921710518498f09a2b840065edd5cb2a12ce9af0db17874f339a88f4`. Final policy SHA-256: `198f696a75557f7c2f5e019fe0fc3bf85097381540e1862731306e0fdcb169a9`.
