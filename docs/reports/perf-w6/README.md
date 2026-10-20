# perf-w6 — remaining native frame-time reds

Base `c80052c37` (PROD 13b). Limits, populations, corpses, gameplay timing (alarm on the machine-gun pickup tick) unchanged. No deploy or merge.

## Native results (headless Metal Chrome, quiet-run, same host, low tier at 4x CPU)

| Check (limit) | Base c80052c37 (b3, 08:49) | Lane after sim/MG changes (b3, 08:52) | Lane final (b4, 09:24) |
| --- | ---: | ---: | ---: |
| L4 low WebGL first turn (50 ms) | **109.9** | **68.9** | **54.6** |
| L4 low WebGL tank shot (50) | 37.4 | 44.9 | 36.5 |
| L4 low WebGL line break (50) | **202.1** | **220.7** | **50.7** |
| L4 low WebGL sim p95 (6) / war p50 (33.3) / collapse p50 (33.3) | 5.1 / 22.3 / 27.3 | 5.5 / 25.7 / 25.6 | 5.0 / 21.8 / 27.2 |
| L4 low WebGPU turn / tank / break (50) | – | 66.9 / 41.0 / 222.8 | **53.7** / 38.9 / **53.7** |
| L4 low WebGPU sim p95 (6) | – | 4.9 | 5.0 |
| L7 low horde WebGL frame p95 (33.3) / sim p95 (6) / max (50) | – | 33.1 / 3.9 / **190.8** | **34.0** / 4.0 / 37.4 |
| L7 high horde WebGL p95 / max | – | 10.9 / **63.7** | 10.8 / 23.3 |
| L8 phone sim p95 (6) / frame p95 (33.3) | – (13a: 7.4) | – | **6.9** / 30.6 |

Base and lane runs of b3 are in one reservation. b4 is a later reservation (lane HEAD `a5cd7a222`). Receipts: [native/](native/) (`quiet-b3.log`, `quiet-b4.log`, full T-E22-20 JSON per run, L7/L8 result lines).

## Causes found and fixes

| Cause (evidence) | Fix | Exactness / test |
| --- | --- | --- |
| Since 13a the machine gun is issued on the alarm tick (no pickup entity). It loaded on first equip; its six `action-held:wpn.machine-gun:*` materials built inside the alarm frame (capped 4x trace: 92 ms render, then a 133 ms catch-up frame). This is the 13a 110.9 ms. | ActionView loads the L4 gun with the loadout; the loading warm-up compiles a held-material clone of every loaded weapon (also racked weapons not in hand). | T-E22-20 now also asserts `turnBuilds === 0` (no node builds in the alarm window). Scene `perf-w6-army-mg-held`. |
| 19bd689a0 (13b visual polish) draws Alpha corpses with LOD0. Where Alphas arrive later (L4 waves) the first Alpha death baked that batch synchronously (capped trace: 233 ms frame, `loadBatch`→`bakeInfected` 43 %, `mergeVertices`). This is the new 200+ ms line-break maximum, present on base. | Alpha definitions always bake LOD0 behind the loading card. | Capped break trace max 233 → 66.7 ms; native break 202/221 → 50.7/53.7 ms. |
| The alarm runs code nothing before it runs: cold ticks cost about twice warm ones (quiet runner: first ten alarm ticks 112–180 ms cold vs 79–92 ms after a scratch alarm). | Once per page, the first L4 load (or promotion of a prefetched L4) plays ride + quartermaster + 30 ticks in a private view-less SimWorld with a copy of the layouts, overlapping the view's asset load. Cost: `level:l4-alarm-warmup` 767 ms in the 4x-throttled capped run (phone-class); it is inside the loading card. | `T-E22-20-alarm-warmup`: the real run after a scratch alarm is state-identical. |
| Event log snapshots used `structuredClone` for every emitted event; checkpoint mission state and settled corpses too. | `cloneData` (perf-w5d's exact plain-data copy, falls back to structuredClone). | Identical end states (below). |
| Per-tick scans: footprint trails ran two regexes and a ground query per actor per tick; night sight scanned every lamp per infected; ground queries allocated a point array per polygon test; L8 zoo copied all entities three times per tick; spatial hash did two map lookups per cell; refuge spots ran the sight ray before the cheap occupancy test. | Memoized pattern tests and standing-body support; sight answer per tick/spot/lamp revision; scalar polygon test; loops; one cell map; reordered pure tests. | Every change is behaviour-preserving: `getState()` hash identical before/after on L4 (bot through the alarm), L7 horde, L8 mixed outbreak, Zoo S1/S2 200 ([node A/B](node-ab-summary-idle-runner.txt), [runs](node-ab-runs.log), [L4 alarm](node-l4-alarm-ab.log)). |

Node timing of the sim changes alone is modest: idle runner warm p50/p95 L7 1.67/2.52 → 1.62/2.33 ms, Zoo S1 1.65/2.55 → 1.57/2.33, Zoo S2 and L8 within noise (runner load varies more than the effect). Browser L7 profiles attribute 8–10 % of its sim to the weather trails and night sight work removed here.

## Still red (not waived)

- L4 low first turn 54.6 / 53.7 ms and line break 50.7 / 53.7 ms (limit 50): one frame each. The turn frame is the alarm tick itself (warm Node ≈ 4–6 ms: alarm spawns and admission, `turn` checkpoint capture, panic). The remaining break maxima are isolated tail frames. Further cuts would need changing what happens on the alarm tick (spreading alarm admission, deferring the checkpoint), which changes tested alarm contracts (`T-E22-20-alarm`, L4.test turn positions); not done.
- L7 low horde frame p95: 33.1 (b3) / 34.0 (b4) against 33.3 — at the limit, run-to-run. Sim p95 passes (3.9–4.0).
- L8 phone sim p95 6.9 ms (limit 6; 13a 7.4).
- Zoo S1/S2 200 p95 on loaded Hetzner sweeps: this lane's full remote suite passed them; on a busy runner the same fixtures reach 4.4–5.5 ms (load dependent).
- The L4 test bot runs inside the measured sim tick (about 6 % of the alarm+1 frame in the capped profile); not changed.
- A `pal_static-colors` static-body build happens in the L4 plaza (tick 1845, outside the measured windows) — not investigated.

## QA

- Scene Lab: new catalog scene `perf-w6-army-mg-held` (added to both `scene:matrix` filters).
  - Remote WebGL2 high/low × zoom 0.5/1/1.5: 12/12 pass with `input-weapons-handgun` ([index](scene-webgl2/index.md)).
  - Mac WebGPU high/low × zoom 0.5/1/1.5: 18/18 pass for `perf-w6-army-mg-held`, `polish-alpha-corpse`, `alphas-at-the-tank` ([index](scene-webgpu/index.md)).
  - Sheets opened (both backends): the courier holds the dark machine gun in both hands at chest height, bat on her back; firing frames show the muzzle flash, its ground glow and a tracer toward the runner, which falls and lies on the asphalt (z1/z1.5 the same at distance). The Alpha corpse lies as the full LOD0 body (purple skin, black clothes, red wounds) beside the courier on low z0.5 and high z1; at the tank the Alphas walk around the hull with their telegraph rings and the courier stays readable. No missing figure, clipping or floating body seen.
  - WebGL2 run of the Alpha scenes on the loaded runner did not finish in this lane (4/18 passed when the report was written).
- Native timing: three quiet-run admissions; the first two hit the 30-minute admission limit (other lanes' matrices held the browsers), the third (08:49, 9 min held) and b4 (09:24, 7 min held) ran. Not measured: L4 high tier, L7 WebGPU, L8 high/low, E18 desktop/device suites.

## Validation

- Typecheck and lint (`eslint src tests tools functions *.config.ts eslint.config.js`): clean. Fresh `npm run build`.
- Remote full suite (unit + sim + levels, timing-isolated, idle runner 2.31.10.108, HEAD `47d7dd075`): **3,245 pass / 4 fail / 11 skip**; all timing cases (Zoo S1/S2/S3 200, E18-02, alpha 200, L10, L9) pass. The 4 failures were the resident-only Alpha prewarm contract (`T-E27-14h`, `PO #21`) broken by the first Alpha change; fixed in `12018b728` (Alpha LOD0 only where resident or in L4/L5/L7), that file now 6/6 locally incl. a new L4 case ([summary](remote-suite-final.txt)). Earlier sweeps on loaded runners failed only timing cases (load).
- `npm run test:smoke`: 31/31 pass (after the last commit).
- `T-E22-20-alarm-warmup` (new) and `T-E22-20` (new `turnBuilds === 0` assertion) — the latter measured in b4 (turn builds 0; the test still fails its unchanged 50 ms limits as listed above).
