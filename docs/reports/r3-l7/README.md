# r3-l7 — L7 boarding and first-use frames

Both brief items are fixed. The original boarding route now has all **24 passengers aboard by tick 5640**, and the unchanged quiet **50 ms pickup/first-shot gate passes at 16.8 ms for every low/high event**.

| Fix | Commit | Evidence |
| --- | --- | --- |
| G-27 boarding queue deadlock | `d79c5c2d` | Seed 1 low default complete browser route; 24/24, no assistance, zero browser errors |
| L7-01 first-use preparation | `4ec0166c` | CPU profiles, material graph traces, both-tier physical quiet gate, existing regression test extended |

[Audited measurements, event-window frames, source identity and artifact hashes](evidence.json).

## G-27 — queue placement

The queue occupied the bus road at `z=47`, across the courier's boarding position. The remaining followers could stop about 3.2 m from their assigned slots and wait for recovery. The HUD's “2 m” is distance to the courier, rather than the bus door.

Moved the queue south to `z=45.1`, giving followers an approach clear of the courier. The door, boarding radius, entry cadence and 20-second recovery threshold are unchanged.

The final-source browser repro progresses 0 → 4 → 12 → 20 boarded at ticks 5160/5280/5400/5520. The final entry starts at 5534, all passengers finish at 5570, and departure starts at 5630. At tick 5640, where the original repro remained at 21/24, the bus now has everyone aboard and is departing. The same 24 IDs are retained; no assisted boarding is used. The route completes with zero browser errors.

## L7-01 — prepare the models actually used in play

L7 created its resident horde before loading, but assigned their final pedestrian appearances on the first AI tick. Asset loading therefore saw different models from those used in play. Subsequent living/corpse batches baked geometry and built shaders around pickup and first shot. After those were moved into loading, the blanket background queue still baked distant Alpha variants during the first shot.

The fix assigns resident appearances during preparation, stages nearby civilian and Alpha tiers before scene warm-up, and uses the existing approach-based requests for distant L7 models. Streamed L7 corpse pages also use the existing hidden compile queue. Populations, effects, clocks and acceptance thresholds are unchanged.

The CPU profiles identify `skinnedVertexMatrix` during deferred geometry preparation: sampled self time is **116.45 ms low / 118.39 ms high before**, and **0 ms in both final captures**. The low baseline records 10 late graph builds, four intersecting the action windows. Both final captures have **zero late graph builds**. Intermediate failed attempts remain under `test-results/r3-l7/`; staging nearby models alone did not resolve identities assigned after loading.

These diagnostic profiles ran under shared host load and are used for attribution, not a controlled timing speedup claim. The final gate is a separate, unprofiled exclusive run:

| Tier | Moving pickup max | First physical rocket max | Eligible frames per window | Gate |
| --- | ---: | ---: | ---: | --- |
| low | 16.8 ms | 16.8 ms | 22 / 22 | PASS |
| high | 16.8 ms | 16.8 ms | 22 / 22 | PASS |

Quiet admission recorded load **2.9736 < 3**, no busy foreign work, and one context at a time. Admission plus execution stayed below five minutes, within the brief's 20-minute cap. Each tier restores the authentic carried save, walks with physical WASD to auto-pickup without E, then uses physical Digit7/Shift+LMB. Collection occurs 2.1949 m from the launcher; it starts 3 m from the exit. No god mode, actor edits, manual simulation steps, photos or extra weapon use precede measurement. The unchanged windows intersect 100 ms before through 250 ms after each event; all retained frames are unpaused, non-loading L7 gameplay.

## Validation

- `npm run verify -- E29`: PASS on `4ec0166c`; typecheck, lint, **27 files / 107 tests**. Its unit command is the same suite used by `test:unit`.
- Extended the existing L7 helper to require resident identities at tick zero. An injected missing preparation produces 0/190 prepared residents; the fix produces 190/190.
- The first uncommitted gate failed the review-freshness fixture. Committing the fix and rerunning resolved it; both logs are retained.
- Final `npm run qa:threat -- --levels L7 --out test-results/r3-l7/qa-threat-final`: skilled and passive routes complete; **zero L7 gameplay, passive and follower-pace flags**, including pace seeds 1–3. The command exits 1 solely for `PARTIAL_LEVEL_SELECTION`; this scoped run does not claim the whole-campaign gate.
- Evidence audit recomputes the quiet event maxima, validates physical pickup mechanics, checks current source hashes, confirms all 24 boarding IDs and verifies the repository/threat results.

## Reproduction and artifacts

The rr-b timing producer was absent from the checkout, so the tracked `tools/qa/accept/fix72-c-l7-pickup.mjs` producer was copied with output/seed paths redirected and post-measurement photos omitted. Its input sequence, frame probe and 50 ms gate are preserved. The carried-save bytes were restored from the tracked Git blobs. Exact producer, seed and receipt hashes are retained in `evidence.json`.

```sh
npm run build:qa
L7_PROFILE=1 L7_OUT=test-results/r3-l7/complete-profile BROWSER_POOL_JOB_ID=r3-l7 \
  node --import tsx/esm test-results/r3-l7/first-use.mjs both
BROWSER_POOL_JOB_ID=r3-l7 E2E_ADMISSION_TIMEOUT_SECONDS=300 \
  PERF_CONDITIONS_LOG=test-results/r3-l7/quiet-admission.jsonl \
  L7_OUT=test-results/r3-l7/quiet sh tools/perf/quiet-run.sh \
  node --import tsx/esm test-results/r3-l7/first-use-timing.mjs both
SCENE_PORT=4868 BROWSER_POOL_JOB_ID=r3-l7 \
  node --import tsx/esm test-results/r3-l7/g27-boarding.mjs 7 7
node --import tsx/esm test-results/r3-l7/audit.mjs
```

Raw profiles, frame receipts, harnesses, logs and images are under `test-results/r3-l7/`. Images are confined to `test-results/`. All checks are terminal, owned servers are stopped and browser reservations released. No specs changes, deploy or push.
