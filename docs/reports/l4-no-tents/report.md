# L4 no tents — lane/l4-no-tents

- Alarm arrivals and every later cohort originate outside the camp; tent/internal admissions and new in-view admissions are zero on both tiers. Announced Alphas now attack during the alarm (first at 6 s; high-tier second at 32 s).
- Seed 3 contact: low 75.98%, high 81.56%; unique in-wall entrants in minutes 0/1/2: low 60/80/78, high 89/106/141. Full source counts and model/archetype percentages: [metrics.json](metrics.json).
- Six living archetypes at 60 s and seven at 150 s on low; seven at both samples on high. Largest share 23.8%. The soldier and all five civilian skins plus the suit and existing inf.* models are drawn in the capture census.
- At 150 s, corpses within 6/8/10/14 m: low 0/3/3/26, high 11/17/22/119. Large bodies block movement; small bodies stay walkable; the courier remains visible through corpse fields. No-skip seed 3 bot: complete, 0 deaths, 328.2 s.
- [Capture review](review.md): opening minute and breached-wall flood at zoom 1, solid Alpha contact at 1/1.5, and connected suit corpses at 1.5. Production suit skin deliveries verified against their build hashes.
- Gates: typecheck/lint/build and six native capture checks pass; remote units 2326 passed, 0 failed (7 existing skips). E22 verification, remote campaign levels, native p95 and qa:invariants are still pending.
