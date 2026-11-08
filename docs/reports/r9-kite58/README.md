# r9-kite58 — kiting pressure fixed at the attack approach

The final complete `npm run qa:threat -- --out /tmp/r9-final-verified` **passes with 0 acceptance flags**, in **327.3 seconds** against the 600-second budget. The original kiting policy measures **L5 6.00/min** and **L8 18.00/min**. L4's matched seed 1/2/3 native and kiting receipts are identical before/after; seed 1's passive observation and high-tier hold census are also identical.

Game source: baseline `f95e7376`, final `d0a02b22` (source tree `3bd297992d3559b7b472f9b8978fd1c08b487c4a`). No specification, acceptance threshold, kiting phase, weapon selection or firing-cadence change is retained. The earlier QA-only handgun/phase candidate was discarded. The original probe file has the same Git blob before and after, recorded in [validation.json](validation.json).

## L5 cause and fix

The original shotgun encounter starts at tick 249. Its three approaching regulars die to shotgun shots at roughly 5–9 m, before reaching the ordinary **4.4 m** attack-start range. The first pursuers already run faster than the courier's **2 m/s** walk; the **1.08 m** separation ring lies inside the start range. Neither chase speed nor crowd spacing is the limiting cause. The old receipt has 40 shotgun shots and zero hostile windups, followed by 1,133 frames without a pressing target.

`9d495fff` gives a **moving L5 pursuer** an earlier approach warning, up to **6 m**. The extra distance is bounded by its current velocity toward the courier times the existing 0.35 s windup. During that warning it continues ordinary chase movement; damage still waits for the telegraph and the unchanged physical strike reach. Stopped attackers retain 4.4 m, and obstacle attacks retain their original stationary windup. This changes neither weapon damage nor any weapon's stagger/knockback.

The first two attackers now telegraph at ticks **250 and 275**, before shotgun kills at **256 and 286**. The original 1,200 firing frames, 40 shotgun shots, sample ticks and target-loss frames remain identical: **2 starts / 20 s = 6/min**. [Before trace](l5-cause-before.json.gz), [after trace](l5-cause-after.json.gz).

The regression in the existing infected-AI case proves that an accelerated approach physically reaches a stationary courier, never damages before its warning finishes, retains actual strike reach, and grants no extra start range to a stopped attacker. It verifies that counted approach attacks can reach their victim.

## Normal L5 pressure — PO handoff

These are separate, non-kiting native routes with seed 1 and the same low-quality setup. Overlapping phase/objective views are not summed.

| Measure | Before | After |
|---|---:|---:|
| Skilled opening player starts/min | 72.00 | 99.00 |
| Skilled search player starts / active seconds | 10 / 137.07 s | 18 / 156.87 s |
| Skilled search player starts/min | **4.38** | **6.88** |
| Skilled metro player + group starts/min | 3.65 + 1.22 | 0 + 0 |
| Passive search player + group starts/min | 649.10 + 0.86 | 630.57 + 0.45 |
| Skilled whole-run damage taken | 150 HP | **225 HP** |
| Skilled whole-run deaths | 1 | 1 |
| Skilled completion time | 208.02 s | 220.65 s |

Normal search pressure and whole-run damage increase. The route remains complete within its 2–4 minute band, with no additional death, and L5's follower pace votes pass. The PO should review this pressure increase. Full phase values and ordinary run receipts are in [comparison.json](comparison.json).

## L8 cause already fixed in the baseline

The historical r8 zero measured game source tree `72b99d76`; this job's `f95e7376` baseline has tree `1254d6ea`, including the later courier/follower soft-contact fixes (`6feb5d98`, `bde97d0b`). A fresh original-policy run already gives six courier-targeting starts over 20 seconds, with one rocket shot.

A controlled comparison temporarily restores **only** `CharacterSeparation.ts` and `SolidRegistry.ts` from `7326320f`, then restores the worktree bytes in `finally`. Old contact gives **0/min**; merged soft contact gives **18/min**, with identical seed, sample ticks and firing policy. In the old-contact trace, nearby infected bite followers; with soft contact, infected 429 acquires the courier and starts six lunges. No additional L8 range, weapon or perception change is needed. [File hashes and receipts](l8-contact-ablation.json).

## L4 identical with the same seeds

| Seed | Native state hash, before = after | Kiting starts/min, before = after |
|---|---|---:|
| 1 | `d9b4c86c` | 58.68 |
| 2 | `6e599b4b` | 35.12 |
| 3 | `b6586d40` | 43.26 |

The comparison checks complete native run reports, observations and kiting receipts. Seed 1 additionally matches its passive run/observation and high-tier hold: first breach 52.7167 s, 70 alive, peak 95, plaza peak/minimum 87/51. Seeds 2/3 were repeated with the complete game source at `f95e7376` and the final source, restoring all files afterward. [Extra seed receipts](l4-extra-seeds.json.gz), [reproduction driver](l4-extra-seeds.mjs).

Reproduce every comparison assertion with:

```sh
node docs/reports/r9-kite58/compare.mjs
```

## Additional baseline findings qualified for the final gate

The job baseline also reproducibly failed L3-08 and L7 departure follower 64. The earlier r8 report did not measure the later merged source that introduced these findings. Both repairs have separate commits; acceptance assertions and seed votes are unchanged.

- **L7 — `a5cc4cd7`:** a lateral trail slot could land inside a wreck, and nearest-clear snapping sent the follower away from the walked route. When that lateral point is blocked, followers now use the walked centreline. Follower 64's departure pace ratios become **98.66 / 98.96 / 95.61%**, from **92.11 / 98.37 / 86.51%**. All required three-seed follower votes pass.
- **L3 — `d0a02b22`:** the finale horde was held until ten metres beyond its authored entrance. Admission now begins at the existing finale start, x=65 instead of x=75; offscreen/clear-door rules, 125/240/710 populations and 100/140 live caps remain. Low seed 3's nearby S3 median rises from 23 to 25, restoring the 2-of-3 density vote. Low army counts change **4/4/2 → 4/4/0**; high counts are **0/4/4**, so both tiers retain the required 2-of-3 squad-survival vote. The formerly known L3-11 rate finding also passes its unchanged band/vote. [Low receipts](gate-repairs.json.gz), [high receipts](l3-high-after.json.gz).

## Validation and evidence

- Final full threat audit: **0 flags**, all **31 stages**, 327.3 s / 600 s, exit 0. [Rendered audit](audit.md), [raw receipt](after.json.gz), [stages](stages.json).
- Typecheck and lint pass on the final game source. Navigation + infected AI: **9/9 pass**. Global inventory remains **150/150 cases, 43/45 files**.
- `npm run verify -- E23` runs typecheck, lint and the global unit suite. It exits 1 solely for the existing asset-contract failure: **106/107 pass**, with 95 missing emissive-node/light-anchor metadata errors in tracked fire-engine, house and bus GLBs. The same failure preceded the game changes; assets, validator inputs and dependencies are unchanged. [Validation receipt](validation.json).
- Baseline evidence: [L4](before-l4.json.gz), [L5/L8](before-l5-l8.json.gz), [L3/L7](before-l3-l7.json.gz). Baseline focused selections are diagnostic receipts; the final gate is the complete ten-level run above.

No deploy or push was performed.
