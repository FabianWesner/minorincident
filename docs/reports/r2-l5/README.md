# Lane r2-l5 — L5-08 follower formation (Opus)

**Result: L5-08 is not fixed, and no gameplay change is committed.** I tested nine narrow candidates over seeds 1–3 (some also over seeds 4–6), on both tiers. None got every follower to ≥ 95 % with no out-of-band run over 120 ticks. Every candidate was reverted, so the source matches `main`. This lane commits a diagnosis, two read-only probes and this report.

## Main finding: the cause is not one follower

The brief's premise was "one follower (28) is out of band". The data does not support it.

- **Baseline seeds 4–6 fail for 28, 29, 31 and 32.** Over seeds 1–6 and both tiers, 17 follower-runs fail. 28 (slot 3, rear row) fails most often (9 of 17), but 32, 31, 30 and 29 also fail.
- **The overall out-of-band rate is the same in every seed set:** 3.64 % of calm straight-walk ticks for seeds 1–3 and 3.72 % for seeds 1–6.
- **Small changes move the failures around.** Any change to the controller shifts the bot route and timing, so a different follower fails in a different place. A per-follower result on three seeds is mostly noise around that 3.7 % rate.

Baseline per follower. Each cell is the share of calm straight-walk ticks 2–5 m behind, then the longest out-of-band run in ticks. The observer is unchanged (`L5FormationObserver`).

| tier | seed | 28 (slot 3) | 29 (slot 4) | 30 (slot 1) | 31 (slot 0) | 32 (slot 2) |
|---|---|---|---|---|---|---|
| low | 1 | **74.5 / 75** | 100 / 0 | 96.1 / 50 | 97.7 / 27 | 99.5 / 6 |
| low | 2 | **90.5 / 68** | 100 / 0 | 96.4 / 66 | 99.6 / 8 | **88.6 / 127** |
| low | 3 | 100 / 0 | 100 / 0 | 100 / 0 | 100 / 0 | 97.3 / 36 |
| high | 1 | 100 / 0 | 97.1 / 9 | 95.7 / 27 | 97.4 / 23 | 98.5 / 12 |
| high | 2 | 100 / 0 | 100 / 0 | **87.2 / 72** | 99.7 / 6 | 96.5 / 44 |
| high | 3 | **87.8 / 106** | 100 / 0 | **91.9 / 99** | 99.4 / 9 | 97.3 / 29 |
| low | 4–6 | 94.8, 95.4, **93.0** | 98.8, 100, 96.7 | ok | **92.9, 91.8 / 115**, 99.2 | 96.0, **85.0**, **93.3 / 109** |
| high | 4–6 | **91.2, 94.7, 91.4** | **86.3**, 100, 100 | ok | ok | **87.5**, 100, 100 |

## Why followers leave the band

Each out-of-band run starts with a disturbance that leaves a follower 0.5–2 m behind its slot. Recovery is capped at 1.05× the courier's speed, which is +0.225 m/s at 4.5 m/s. Coming back from 5.7 m therefore takes at least 3 s. The rear row has only 1.6 m of margin (slot at 3.4 m) and the front row 2.3 m (slot at 2.7 m).

I added up the lost distance (courier advance minus follower advance) from the last in-slot tick to the end of each bad run. The probe is `tools/qa/accept/r2-l5-loss.ts`. Main causes:

1. **When the courier starts again after a stop (57 % of bad ticks).** At rest the followers bunch 0.5–1 m closer than their moving slots, and some stand beside or ahead of her. When she walks off they re-sort, and the bodies get in each other's way.
2. **Slow change of direction (largest single loss term, 84 m over the six runs).** Calm followers accelerate at 12 m/s², capped in `followerTracking`. Turning a sideways or backward velocity onto the new heading takes 0.5–0.75 s, during which a follower loses 1–2 m. Example: low s2, follower 32 at tick 6755. It asks for +4.2 m/s along the heading and is still moving at −2 m/s.
3. **Contact behind a lagging front-row follower (24 m total), the "28" case.** The rear-row slots sit 0.92 m from two front slots, only 0.2 m more than the body-contact distance of 0.715 m. If a front-row follower lags 0.3 m or more, the rear one walks into its back. The contact solver then pushes the rear follower backward and sideways, and the 1.05× limiter clips the rest.
   - In steady straight walks, a follower behind its slot with free space closes at +0.18 m/s, near the +0.225 m/s ideal.
   - In contact, it closes at −0.03 to −0.10 m/s, so it keeps losing ground.
   - On the narrow-street fallback to single file it closes at −0.2 to −0.6 m/s. Two or three followers then target the same point on the courier's line, because the fallback keeps one depth per row.
   - Low s1 follower 28: three runs of 74–75 ticks, each with 1.9–2.8 m lost to contact pushes behind 31. 31 was itself held up by an obstacle in its side lane at tick 8006.
4. **A dead Alpha in the path (high s2, follower 30).** Its body is solid but missing from the route grid. 30 stood next to the courier at a moment with no clear slot, coasted into the corpse at (47.34, 41.94) and stayed wedged for about 2 s (8.3 m lost). `corpseDetour` is only used in L7.
5. **Combat ending.** Defensive moves at 3.8 m/s can take a follower away from the courier. Turning back afterwards costs another 1–2 m because of cause 2.

### A separate latent deadlock: corgi and followers (not in the baseline seeds)

Several of the changed runs (f5, f6, f11, high tier, seeds 1–2) hit the same spot. The whole group of four froze at about (20, 41) for up to 35 s while the courier walked 25 m on. Each time this alone made 4 follower-runs fail.

- The corgi's route goes to grid cell 73329 and points toward −z, straight through the followers.
- The followers' route goes through the corgi, whose spacing radius is 0.9 m.
- Contact rejects every step on both sides, so nobody moves.

This may be a real P2 for PO play at that L5 crossing. It needs its own lane (Companion route or contact yielding), not formation tuning.

## Candidates tested (all reverted)

Out-of-band ticks are summed over all followers. A "fail" is one follower-run under 95 % or with a run over 120 ticks.

| tag | change | seeds | out-of-band | fails |
|---|---|---|---|---|
| b | baseline | 1–3 / 1–6 | 3.64 % / 3.72 % | 6 / 17 |
| f1 / f2 | step beside a follower ahead when behind the slot | 1–3 | 4.97 % / 4.77 % | 9 / 8: fixes 28 everywhere, the front row breaks instead |
| f3 | queue behind a follower ahead (no pressing) | 1–3 | 7.76 % | 15 |
| f4 | keep 1 m/s of sideways speed while catching up | 1–3 | 4.82 % | 12 |
| f5 | L5 tracking acceleration 12 → 24 (survivors and corgi) | 1–3 | **2.65 %** | 7 (3 from one jam) |
| f6 | survivors only: acceleration 24 (`l5SurvivorTracking`) | 1–6 | **2.94 %** | 15 (4 from the corgi deadlock) |
| f11 | survivors only: acceleration 18 | 1–6 | 3.67 % | 15 |
| f7 / f8 | `corpseDetour` in the calm stride (on contact / proactively) | 1–3 | 3.65 % / 3.89 % | 6 / 7 (the corpse case improved to 0.91) |
| f10 | hand out slots by actual depth and side order | 1–3 | 4.85 % | 11 |

f6 per follower, seeds 1–3, low tier: 28: 99.9 / 94.3 / 100, 31: 93.1 / 133, 32: 95.8. High s2: all four fail at 69 ticks, which is the corgi jam.

Every spacing or ordering change (f1–f4, f10) made the aggregate worse. Only faster calm re-alignment (f5/f6) lowered it, by about 20–30 %, and still not to a pass.

### Threat audit for f6

A remote `threat-audit --levels L5` was run with f6 applied (uncommitted tree). Log: `test-results/r2-l5/threat-f6.log`. Result: see below.

**f6 fails it: exit 1, 3 fail flags in 521.7 s.**

- Follower pace over seeds 1–3: **2 skilled flags** (SLOW_FOLLOWER), 0 passive.
- Passive route: tick-budget with 2 passive flags.

I did not pull the remote receipt, so the flag IDs are not recorded here. Re-run with `--pull test-results/qa-threat` to get them.

Faster acceleration therefore changes which followers count as slow relative to the group median. **f6 is not shippable as it stands.** The baseline itself had 0 pace flags (r2-l4l5 control).

## Recommendation (orchestrator / next lane)

- **L5-08 cannot pass with a narrow fix.** About 3.7 % of calm straight-walk ticks are out of band at baseline, so with five followers, two tiers and three seeds some follower almost always lands under 95 %. Reaching ≥ 95 % for every follower would need the out-of-band rate under about 1 %.
- **Within the fixed rules** (1.05× ceiling, spacing, combat pace) the only lever that helped is faster calm re-alignment (f6). It has a feel risk: followers turning in about 0.25 s at 24 m/s², while the courier uses 9 m/s². It would need a close-zoom visual check.
- **The corgi deadlock and the Alpha-corpse wedge are real bugs** worth a separate lane. They make whole groups or single followers stall for 2–35 s.
- **Otherwise the rule is the bottleneck.** The PO tolerance and the 1.05× ceiling work against each other. A disturbance of more than about 0.45 m (rear row) cannot be recovered within 2 s. Options for the PO:
  - count only followers in their own slot row, or
  - allow a short catch-up above 1.05× right after a stop, turn or combat, or
  - measure "behind" along the courier's trail instead of her current heading.

  Any of these is a target change, which this lane may not make.

## Validation

- `npx tsc --noEmit`: pass.
- `npx eslint` on both probes: pass (no runtime source touched, so the full lint run is unaffected).
- No runtime source change, so unit, acceptance and the baseline threat result are unchanged from `main`.
- Probes: `tools/qa/accept/r2-l5-trace.ts` and `tools/qa/accept/r2-l5-loss.ts`, both read-only. Traces are in `test-results/r2-l5/` (git-ignored).
