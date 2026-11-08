# R14: infected hit a moving courier

## Result

Both retreat kiting and running circles meet **≥2 accepted moving hits/minute in every on-foot level** (L1–L8, L10). L9 is the existing driving-policy N/A. All circle samples also meet **≥95% physical movement on controllable ticks**. This proves sampled encounters and attacker coverage; it does not establish campaign completion or unchanged difficulty.

[Measurements and receipt paths](measurements.json) preserve counts, active/moving/forced seconds, phase rates, outcomes and source hashes. Seed 1, low quality, unchanged native route drivers and default level presets were used throughout. There were no browser runs, deployment or push.

## Runtime changes

- Ordinary windups lead the courier using actual survivor velocity. Lunges continue their normal approach during the readable warning. Extra acquisition distance uses relative closing speed and is bounded by the existing active burst travel.
- The live strike check includes authored reach, attacker body size and courier travel during the windup, then checks the courier's current position and obstruction. Static target reach and authored windup/recovery timing remain intact; out-of-reach retreat remains a valid escape.
- Special moves lock a visible moving target's predicted point at telegraph time; committed lines/areas stay readable. Dog pack positioning yields when already within strike reach.
- L4's stationary-courier test used two poses that are equal at AI time, so moving couriers incorrectly activated stationary outer waiting rings. It now uses the controller's collision-resolved step.

## Moving encounter results

Rates below count positive-damage infected strikes against the courier, classified by position change **after the final physics commit**. Starts, missed windups, zero damage, follower hits, player shots and stationary hits cannot satisfy the floor. Rates use all active sampled input ticks, including forced holds. The 20-second elapsed window can contain fewer active ticks because of death/cinematic locks; every accepted on-foot sample has at least 10 active seconds.

| Level | Retreat hits/min before → after | Circle hits/min before → after | After retreat hits / active s | After circle hits / active s | Circle controllable movement |
|---|---:|---:|---:|---:|---:|
| L1 | 33.30 → **36.77** | 0.00 → **27.00** | 10 / 16.32 | 9 / 20.00 | 100.0% |
| L2 | 0.00 → **3.00** | 23.33 → **23.33** | 1 / 20.00 | 7 / 18.00 | 100.0% |
| L3 | 6.00 → **6.00** | 0.00 → **3.00** | 2 / 20.00 | 1 / 20.00 | 100.0% |
| L4 | 12.00 → **26.67** | 15.00 → **18.00** | 8 / 18.00 | 6 / 20.00 | 100.0% |
| L5 | 0.00 → **3.00** | 3.00 → **6.00** | 1 / 20.00 | 2 / 20.00 | 100.0% |
| L6 | 0.00 → **3.00** | 3.00 → **3.00** | 1 / 20.00 | 1 / 20.00 | 100.0% |
| L7 | 0.00 → **3.00** | 3.00 → **40.62** | 1 / 20.00 | 11 / 16.25 | 100.0% |
| L8 | 9.00 → **9.00** | 12.00 → **24.00** | 3 / 20.00 | 8 / 20.00 | 100.0% |
| L9 | N/A: driving | N/A: driving | — | — | — |
| L10 | 0.00 → **6.00** | 0.00 → **21.00** | 2 / 20.00 | 7 / 20.00 | 100.0% |

The default `qa:threat` retreat policy still walks/backpedals while firing the selected weapon. Both styles now require a pressing group of at least three infected: sampling an opening lone enemy that the courier kills immediately is not a sustained horde encounter. Admission checks floor height and visibility. L5 includes its opening street fight; L10 includes its existing regional street fights before the cure. **The L10 moving sample is residential-fringe combat, not the final hold.** This is recorded in the receipt, without teleporting or modifying the route driver.

Circles use direct running input around a fixed walkable centre (4 m radius, reduced to 3/2 m for geometry), supported-floor checks and local steering around live bodies/corpses. This avoids inherited click-route smoothing and physical blockage being mistaken for constant movement. Enemy pins/staggers alone are excluded from the controllable-time coverage denominator; all other body/wall stops remain failures. Distance, radius, body avoidance and stationary-hit counts remain in the JSON.

## Normal route effect

These runs contain **no injected kiting input**. Damage is total courier damage from all sources across the route, including respawns; different durations and progression affect totals. Phase pressure is infected attack **starts** per minute, independently observed; it is not landed damage. Overlapping objective/controller rows are never summed.

| Level | Outcome before → after | Sim seconds before → after | Damage HP before → after | Deaths before → after |
|---|---|---:|---:|---:|
| L1 | complete → complete | 115.07 → 156.85 | 30.00 → 300.07 | 0 → 2 |
| L2 | complete → complete | 162.73 → 524.22 | 18.00 → 2167.70 | 0 → 19 |
| L3 | complete → complete | 189.93 → 194.78 | 22.00 → 66.00 | 0 → 0 |
| L4 | complete → complete | 299.88 → 414.42 | 677.53 → 1601.65 | 6 → 13 |
| L5 | complete → complete | 195.03 → 183.82 | 100.00 → 125.00 | 0 → 0 |
| L6 | complete → complete | 413.83 → 451.40 | 230.00 → 358.60 | 1 → 1 |
| L7 | complete → complete | 104.82 → 105.28 | 90.00 → 100.00 | 0 → 0 |
| L8 | tick-budget → tick-budget | 1200.00 → 1200.00 | 6950.00 → 6370.00 | 69 → 63 |
| L9 | complete → complete | 128.13 → 128.13 | 0.00 → 0.00 | 0 → 0 |
| L10 | tick-budget → tick-budget | 3600.00 → 3600.00 | 16565.00 → 2271.57 | 162 → 18 |

| Level | Representative combat phase | Attack starts/min before → after |
|---|---|---:|
| L1 | phase/spread | 28.06 → 42.95 |
| L2 | phase/escape | 9.40 → 33.35 |
| L3 | step/defend | 16.03 → 16.03 |
| L4 | step/hold | 153.92 → 279.41 |
| L5 | step/look | 6.03 → 11.80 |
| L6 | step/stop | 2.85 → 2.85 |
| L7 | step/corridor | 31.94 → 70.56 |
| L8 | step/escape | 38.68 → 53.53 |
| L9 | — | N/A: driving |
| L10 | step/hold | 559.10 → not reached |

**L1–L5 difficulty increased substantially.** L1 now has two deaths; L2 has nineteen versus zero and takes over three times as long; L4 deaths rise from six to thirteen. L3/L5 remain zero-death completions. These are measured consequences of removing movement immunity, and no compensating balance nerf was applied in this lane. L2 collapse and escape phase details are retained separately in JSON.

**Progression limitations:** L8 reaches its 1,200-second route cap both before and after, with repeated deaths. L10 reaches its 3,600-second cap both times: baseline reaches `hold`, while the changed runtime stalls earlier at `research` after 18 deaths. Its lower damage total therefore cannot be read as reduced difficulty, and its final-hold pressure is unmeasured after the change. The unchanged native L10 driver is preserved; an experimental respawn rejoin change was rejected and reverted. Campaign completion and L10 late-phase balance need separate follow-up; this lane's moving-hit result uses actual early regional combat.

## Verification

- `npm run typecheck` and `npm run lint`: pass.
- `npm run verify -- E07` on Hetzner: pass (typecheck, lint, default unit gate). The collected budget remains **150/150 cases, 43/45 files**; default suite **106 passed, 1 skipped**.
- Existing infected AI test: all **21 damaging attacker cases** (human roles, dogs/cats/birds/zoo animals, Alpha and Mega Alpha) land accepted damage during actual running-circle displacement after physics. Existing early-windup, recovery and out-of-reach dodge controls remain. No registered test cases were added.
- `qa:threat -- --proof`: pass. Red fixtures distinguish actual position change from blocked movement intent, positive courier hits from starts/other hits, horde admission from lone/other-floor actors, and safe circles from ledges.
- Final before/after movement batches: all ten levels × both styles, same frozen policy; all nine on-foot levels meet the landed-hit floor after the runtime change, with valid sample duration and circle movement coverage.

## Reproduction and provenance

Run heavy commands through `sh tools/remote/run.sh "$PWD" -- …`. Each bounded command writes its receipt before the next starts:

```sh
timeout 540 node --import tsx/esm tools/qa/moving-audit.ts \
  --level L1 --policy retreat --out receipt.json
```

Use `circles` for running circles or `native` for the unchanged normal route. `MI_THREAT_KITING_STYLE=circles` selects the same circle implementation in the full `qa:threat` harness. This focused comparison reuses its actual kiting policy, mission preparation and native route, without repeating unrelated follower-seed/census work.

The initial unsplit full threat audits hit their 600-second watchdog and are not completion evidence. Per-level receipts replace the discarded aggregates. Shared-load timeouts and runner manifest checkouts lacking a valid HEAD were resolved by isolated remote validation with a full temporary manifest Git tree in the private runner job. The local Git history is unaffected. The supported separate local queue was used with Mac fallback disabled and remote slot locks retained because another queue head could not dispatch to idle runners.

- Baseline gameplay: `a7b70c78`; `InfectedSystem.ts` SHA-256 `91e8a4749f2acb6b170c65a9973b432de5d0bb5d512564ba61a455bf8aba4c1e`. Only that runtime file was restored in private baseline jobs; all other gameplay files match the unchanged base.
- Final gameplay: commit `01f5ce13` (relative-closing behavior introduced in `46c1c19f`); SHA-256 `47c41680c208611dd0453f86998b5e1b3d0e80c71310764cb1c9382bb9fbd908`.
- Final shared movement policy: commit `f637e251`; SHA-256 `b7d11aa6fd16c7e118071e043b9768e2da988184dde0d845a68ad1f694ba7023`. Both source and policy hashes are captured before simulation. Native observers do not apply the movement policy.
- Canonical raw movement: `test-results/r14-moving/verified-before-moving/` and `verified-after-moving/`; normal receipt paths and precise numbers are retained in `measurements.json`. Logs: `final-validation.log`, `catalog-check.log`, and the two `verified-*-moving.log` files in the same raw directory.
