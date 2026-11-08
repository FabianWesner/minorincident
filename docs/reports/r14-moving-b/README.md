# R14 moving hits: accepted-level balance follow-up

## Result

The moving-hit floor remains **≥2 landed moving hits/minute in every on-foot level**, for both retreat fire and constant running circles. L9 remains the driving-policy N/A. L1–L5 satisfy **deaths ≤ original baseline +1 and damage ≤2× original baseline**. L6–L10 reproduce the reviewed damage, deaths, duration and furthest objective exactly; previously completed normal routes still complete.

[Exact measurements, limits and receipts](measurements.json) retain source hashes, native phase pressure, hit counts, active/moving seconds, progression and the damage traces. The [first R14 report](../r14-moving/README.md) is the historical rejected comparison.

## What caused the spikes

- **L2:** every accepted hit in the rejected run occurs on foot in collapse/escape. 108 controller-moving contacts deal **1,944 HP**; still contacts add **223.7 HP**. Hits reach about **2.68 m** and still apply the full L2 18 HP. Repeated deaths extend exposure and create more contacts. There is **zero accepted damage while boarding/riding**, and the trace sum equals total route damage. The authored calm/alarm/ride phases contain no attacking infected; the fire-engine and route drivers need no change.
- **L4:** **1,190.6 of 1,601.65 HP** occurs while the controller reports movement. Hazmat melee/toxic damage is the largest source (**712.45 HP** total); ordinary runner, firefighter, riot, sprinter and crawler contacts make up most of the remainder. The corrected moving-courier rings and larger strike envelope make those contacts possible; applying full wounds to every moving graze makes them too costly.
- Applying glancing wounds globally was also rejected: the normal L10 bot reached its existing final-hold death loop and accumulated **17,312 HP / 171 deaths** (3,600 s), violating the late-level limit. The accepted tier gate preserves the reviewed late-game balance and progression.
- A **0.75 m blanket margin cap** breaks the crawler running-circle case. Applying it only to ordinary lunges preserves attacker coverage, but L3 circles and the L10 retreat encounter record zero hits. Those candidates are rejected. The accepted introductory correction bounds ordinary lunge lead/reach allowance at **1.6 m** and reduces the damage of moving grazes instead. At normal 4.5 m/s run speed and a 0.35 s windup, the existing 1.575 m travel allowance fits inside that cap; the main balance change is the glancing wound.

The trace's “moving” grouping uses controller velocity for diagnosis. Acceptance hit counts use actual position change after the final physics commit.

## Runtime correction

In **L1–L5**, an ordinary lunge against a courier moving faster than 0.2 m/s deals **10% authored damage**: a regular 10 HP hit becomes 1 HP (L2's existing ×1.8 multiplier makes 1.8 HP). Other ordinary attacks grazing beyond their normal contact reach use the same fraction. Planted-courier wounds and close non-lunge attacks retain authored damage; committed Alpha/zoo special damage, toxic effects, telegraph duration, active burst, recovery and existing invulnerability remain unchanged.

The predictive aim, approach during the warning, relative closing-distance acquisition, live obstruction checks and moving separation-ring correction remain. Slow grab/animal windup envelopes remain sufficient to hit running targets. The balance adjustment has one explicit L1–L5 campaign-tier gate. L6–L10 retain the reviewed moving-hit behavior and damage exactly. No route-driver edit, teleport, god mode or extra healing was added.

## Normal skilled routes: L1–L5

Seed 1, low quality, unchanged complete route and default presets. Damage includes all sources and respawns. “Original” is pre-R14 `a7b70c78`; “reviewed” is the first moving-hit fix; “balanced” is this follow-up. Duration changes reflect actual route decisions and exposure.

| Level | Damage original → reviewed → balanced | Deaths original → reviewed → balanced | Balanced damage / death limits | Balanced sim seconds | Outcome |
|---|---:|---:|---:|---:|---|
| L1 | 30.00 → 300.07 → **39.00** | 0 → 2 → **0** | 60.00 HP / 1 | 115.07 | complete; PASS |
| L2 | 18.00 → 2167.70 → **25.20** | 0 → 19 → **0** | 36.00 HP / 1 | 143.58 | complete; PASS |
| L3 | 22.00 → 66.00 → **36.30** | 0 → 0 → **0** | 44.00 HP / 1 | 194.78 | complete; PASS |
| L4 | 677.53 → 1601.65 → **367.00** | 6 → 13 → **3** | 1355.07 HP / 7 | 327.88 | complete; PASS |
| L5 | 100.00 → 125.00 → **125.00** | 0 → 0 → **0** | 200.00 HP / 1 | 183.82 | complete; PASS |

## Normal skilled routes: L6–L10

| Level | Damage reviewed → balanced | Deaths reviewed → balanced | Sim seconds reviewed → balanced | Outcome reviewed → balanced | Furthest objective reviewed → balanced |
|---|---:|---:|---:|---|---|
| L6 | 358.60 → **358.60** | 1 → **1** | 451.40 → 451.40 | complete → complete | exit → exit |
| L7 | 100.00 → **100.00** | 0 → **0** | 105.28 → 105.28 | complete → complete | bus-departure → bus-departure |
| L8 | 6370.00 → **6370.00** | 63 → **63** | 1200.00 → 1200.00 | tick-budget → tick-budget | escape → escape |
| L9 | 0.00 → **0.00** | 0 → **0** | 128.13 → 128.13 | complete → complete | reach-outskirts → reach-outskirts |
| L10 | 2271.57 → **2271.57** | 18 → **18** | 3600.00 → 3600.00 | tick-budget → tick-budget | research → research |

## Moving-hit comparison

Both versions use the **same frozen movement policy**. Positive accepted courier damage while physically moving is counted separately from attack starts and stationary hits. The rate uses all active sample seconds, including forced holds; each on-foot sample has at least 10 seconds. Circles also require physical movement on ≥95% of controllable ticks. No threshold, horde count, fire policy, phase admission, loadout or circle behavior was relaxed in this follow-up.

| Level | Retreat hits/min reviewed → balanced | Circle hits/min reviewed → balanced | Balanced retreat hits / seconds | Balanced circle hits / seconds | Circle controllable movement |
|---|---:|---:|---:|---:|---:|
| L1 | 36.77 → **42.00** | 27.00 → **27.00** | 14 / 20.00 | 9 / 20.00 | 100.0% |
| L2 | 3.00 → **3.00** | 23.33 → **39.00** | 1 / 20.00 | 13 / 20.00 | 100.0% |
| L3 | 6.00 → **6.00** | 3.00 → **3.00** | 2 / 20.00 | 1 / 20.00 | 100.0% |
| L4 | 26.67 → **30.00** | 18.00 → **18.00** | 10 / 20.00 | 6 / 20.00 | 100.0% |
| L5 | 3.00 → **3.00** | 6.00 → **6.00** | 1 / 20.00 | 2 / 20.00 | 100.0% |
| L6 | 3.00 → **3.00** | 3.00 → **3.00** | 1 / 20.00 | 1 / 20.00 | 100.0% |
| L7 | 3.00 → **3.00** | 40.62 → **40.62** | 1 / 20.00 | 11 / 16.25 | 100.0% |
| L8 | 9.00 → **9.00** | 24.00 → **24.00** | 3 / 20.00 | 8 / 20.00 | 100.0% |
| L9 | N/A: driving | N/A: driving | — | — | — |
| L10 | 6.00 → **6.00** | 21.00 → **21.00** | 2 / 20.00 | 7 / 20.00 | 100.0% |

L10's movement sample uses its actual regional street combat, as in the reviewed policy. Sample phases and original L10 driver hashes are retained in JSON. L8/L10 native routes still reach their existing caps; L10 still stalls at research. Those progression limitations are preserved and explicitly excluded from a claim of campaign completion. The late batch exits 1 solely for those preserved native caps; its movement receipts pass and its normal-route comparison matches exactly. The normal-route table separately records late progression and any route cap; an early street hit sample does not validate an unsampled final hold.

## Validation and reproduction

- `npm run verify -- E07` on an isolated Hetzner runner: typecheck, lint and default unit gate pass; **106 passed, 1 skipped**, with **150/150 collected cases and 43/45 files**.
- Existing infected AI case covers all **21 damaging attacker cases**, actual post-physics running-circle hits, readable windups and out-of-reach escape. It additionally asserts **10 HP stationary vs 1 HP introductory moving** ordinary hits, **10 HP later-campaign moving damage**, and the **1.6 m introductory lead cap**. No registered cases were added.
- `qa:threat -- --proof`: pass. Physical-movement and landed-hit red fixtures remain intact.
- Native limits and both movement policies were checked for all ten levels from per-level receipts. All accepted receipts match the frozen runtime and policy hashes below. Raw candidate/trace logs remain under `test-results/r14-moving-b/`; only the final source receipts are used in the tables.
- All heavy simulations/tests ran through `tools/remote/run.sh`; no browsers, deployment or push. The full Git manifest fixture in the private validation job supplies a valid HEAD for the freshness tests.

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" -- timeout 720 node --import tsx/esm \
  tools/qa/moving-audit.ts --level L2 --policy native --trace --out receipt.json
```

Use `retreat` or `circles` for the same movement policies used by `qa:threat`. The diagnostic `--trace` option only observes damage and state; it does not inject route input.

Runtime commit: `fbb5f530`; SHA-256 `859e042f07b517970f08153460b25e10f472a2b357dd6e82a4e4f2da60174529`. Unchanged movement-policy SHA-256: `b7d11aa6fd16c7e118071e043b9768e2da988184dde0d845a68ad1f694ba7023`. Native drivers and presets are unchanged. Detailed check statuses, limits, exact precision and raw receipt paths are in [measurements.json](measurements.json).
