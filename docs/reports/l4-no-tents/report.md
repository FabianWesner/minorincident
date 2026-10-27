# L4 no tents — lane/l4-no-tents — incomplete

- All authored cohorts originate outside the camp; tent/internal and new in-view admissions are zero on both tiers. Announced Alphas batter the wall; the west breach opens at 19.9 s.
- Seed 3 war contact: low 76.96%, high 60.34%; unique entrants in complete minutes: low 61/91/100, high 68/125 (all ≥6/min). [Metrics and all source counts](metrics.json); observation stops at Fall back, with survival measured separately.
- Six living archetypes at 60 s and seven at 150 s on low; seven at both samples on high. Largest share 19.05%. Soldier, five civilian, suit and existing inf.* appearances are rendered.
- At 150 s, corpses within 6/8/10/14 m: low 2/4/19/37, high 6/9/19/50. Large bodies block courier/corgi movement, small bodies remain walkable, and the courier stays visible through corpses. No-skip seed3 bot: complete, 0 deaths, 311.7 s.
- [Capture review](review.md): opening minute and breach flood at zoom 1, Alpha contact at 1/1.5, welded suit pile at 1.5. Existing production skin deliveries match their build hashes.
- Source checks, captures, remote simulation/unit/levels receipts plus focused corrections, all three timeout retries, and native invariants are recorded in [verification](verification.json). Native coverage is 99/111; [12 unresolved cases](checks/native-unresolved.json) remain. Mac/Linux collapse keeps <10 (0 at90s). Main→branch high sim p957.2→4.4ms/war33.4→16.8ms: perf pending, orchestrator measures in a quiet window ([A/B](perf/ab/comparison.json)).
